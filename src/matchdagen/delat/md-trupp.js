// ============================================================================
// Matchdagen (#871, Etapp 2b): TRUPPEN, RESERVERNA, MARKNADEN och TRÄNINGS-
// LÄGRET – ren modul (spec §8). Ingen DOM, ingen Firebase, ingen klocka: slumpen
// (rng) och tiden (nu) skickas in. Testas i node (test/matchdagen-trupp.test.js).
//
// Truppen är startelvan i fast ordning (MV, FÖR, FÖR, MIT, MIT, ANF, ANF – samma
// index som formationen och reglerna). Grundpelarna (grundpelare: true) säljs
// aldrig: ersätts en av dem flyttas den till reserverna (högst 5). En köpt spelare
// har ingen grundpelare-flagga och säljs för halva priset när den ersätts.
//
//   pris(st)                         → kr (avrunda(150 × st^1,9; 10))
//   marknadMaxSt(div)                → högsta stjärnorna marknaden kan ge i divisionen (reglerna)
//   nyMarknad(K, rng)                → 6 spelare till salu (nya efter varje match)
//   kopInfo(K, id)                   → vem som ersätts, vad det kostar, om reserverna är fulla
//   kop(K, id, { slapp? })           → { K, info, salda }   (slapp = köpt reserv som släpps när reserverna är fulla)
//   bytIn(K, reservId, truppId)      → K   (reserv ↔ startspelare på samma position)
//   lagerNyckel(K)                   → nyckeln för ett ledigt träningsläger, eller null
//   tranaSpelare(p, ratt)            → { p, nyStjarna }
//   lagerResultat(K, { nyckel, spelareId, svar, sekunder?, nu }) → { K, spelare, stjarnor }
//   kaptenPlats(trupp)               → index för kaptensbindeln på planen
//   truppFalt(K, rng)                → K med reserver och marknad (äldre dokument från Etapp 1)
// ============================================================================

import * as C from "./md-config.js";
import { EFTERNAMN, FORNAMN } from "./md-namn.js";

const kl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const kopia = (v) => JSON.parse(JSON.stringify(v));
const valj = (rng, lista) => lista[Math.floor(rng() * lista.length)];
/** Spelarens "värde" för att jämföra: stjärnor först, sedan träningspoängen. */
const varde = (p) => (Number(p?.st) || 0) * C.TRANING.xpPerStjarna + (Number(p?.xp) || 0);

/** Priset för en spelare med st stjärnor (§8.3): ~560, 1 210, 2 080, 3 190 kr för 2–5. */
export function pris(st) {
  const p = C.MARKNAD.pris;
  return Math.round((p.bas * Number(st) ** p.exponent) / p.avrunda) * p.avrunda;
}
/** Vad en köpt spelare säljs för när den ersätts eller släpps: halva priset för dess stjärnor. */
export const saljPris = (st) => Math.round(pris(st) * C.MARKNAD.salj);

/** Stjärnorna för en spelare på marknaden: kl(avrunda(slump(2; 3,2 + div × 0,3)); 2; 5). */
export function marknadStjarnor(div, rng) {
  const s = C.MARKNAD.st;
  const hog = s.bas + (Number(div) || 0) * s.perDiv;
  return kl(Math.round(s.min + rng() * (hog - s.min)), s.min, s.max);
}
/** Det högsta marknaden kan ge i divisionen (slumpen < 1, så avrunda(hog) räcker alltid) – reglerna har tabellen. */
export const marknadMaxSt = (div) => kl(Math.round(C.MARKNAD.st.bas + div * C.MARKNAD.st.perDiv), C.MARKNAD.st.min, C.MARKNAD.st.max);

/** Id:t "k" + upp till sex tecken i bas 36; namn och tröjnummer lottas om högst FORSOK gånger. */
const BAS36 = 36;
const ID_TAL = BAS36 ** 6;
const FORSOK = 50;
const allaSpelare = (K) => [...(K.trupp || []), ...(K.reserver || [])];

/** Sex nya spelare till salu – namn, id och tröjnummer som ingen i klubben redan har. */
export function nyMarknad(K, rng) {
  const tagnaNamn = new Set(allaSpelare(K).map((p) => p.namn));
  const tagnaId = new Set(allaSpelare(K).map((p) => p.id));
  const tagnaNr = new Set(allaSpelare(K).map((p) => p.nr));
  const ut = [];
  for (let i = 0; i < C.MARKNAD.antal; i++) {
    let namn, id, nr;
    for (let f = 0; f < FORSOK; f++) { namn = `${valj(rng, FORNAMN)} ${valj(rng, EFTERNAMN)}`; if (!tagnaNamn.has(namn)) break; }
    do id = `k${Math.floor(rng() * ID_TAL).toString(BAS36)}`; while (tagnaId.has(id));
    for (let f = 0; f < FORSOK; f++) { nr = C.MARKNAD.nr.min + Math.floor(rng() * (C.MARKNAD.nr.max - C.MARKNAD.nr.min + 1)); if (!tagnaNr.has(nr)) break; }
    tagnaNamn.add(namn); tagnaId.add(id); tagnaNr.add(nr);
    ut.push({ id, namn, pos: valj(rng, C.LAGDELAR), nr, st: marknadStjarnor(K.div, rng), xp: 0 });
  }
  return ut;
}

/** Den sämsta startspelaren på positionen (lägst stjärnor och träning; vid lika en grundpelare – den går till reserverna). */
function samstaPa(trupp, pos) {
  let bast = -1;
  trupp.forEach((p, i) => {
    if (p.pos !== pos) return;
    const b = trupp[bast];
    if (bast < 0 || varde(p) < varde(b) || (varde(p) === varde(b) && p.grundpelare && !b.grundpelare)) bast = i;
  });
  return bast;
}

/**
 * Köpet av spelaren id (§8.3): vem som ersätts, kostnaden, återbetalningen och om
 * eleven först måste släppa en köpt reserv. kan = false med orsak när det inte går.
 */
export function kopInfo(K, id) {
  const ny = (K.marknad || []).find((p) => p.id === id);
  if (!ny) return { kan: false, orsak: "saknas" };
  const index = samstaPa(K.trupp, ny.pos);
  const ersatt = K.trupp[index];
  const kostnad = pris(ny.st);
  const tillReserv = !!ersatt?.grundpelare;
  const reserver = K.reserver || [];
  const slappbara = reserver.filter((p) => !p.grundpelare);
  const masteSlappa = tillReserv && reserver.length >= C.RESERVER_MAX;
  const info = { ny, index, ersatt, kostnad, tillReserv, aterbetalning: tillReserv ? 0 : saljPris(ersatt.st), masteSlappa, slappbara };
  if (!ersatt) return { ...info, kan: false, orsak: "position" };
  if (ny.st <= ersatt.st) return { ...info, kan: false, orsak: "inteBattre" };
  if (masteSlappa && !slappbara.length) return { ...info, kan: false, orsak: "reserverFulla" };
  // Pengarna: en släppt reserv ger sin halva i samma köp, men eleven ska ha råd utan den.
  if ((Number(K.kassa) || 0) + info.aterbetalning < kostnad) return { ...info, kan: false, orsak: "kassa" };
  return { ...info, kan: true };
}

/**
 * Köp (§8.3). Den köpta ersätter den sämsta på samma position: en köpt säljs för halva
 * priset, en grundpelare flyttas till reserverna – är de fulla släpps först `slapp`
 * (bara en köpt reserv, som också säljs för halva priset). Ändrar inte K.
 * @returns {{ K, info, salda: Array<{ namn, belopp }> }}
 */
export function kop(K0, id, { slapp = null } = {}) {
  const info = kopInfo(K0, id);
  if (!info.kan) throw Object.assign(new Error(`kop: ${info.orsak}`), { orsak: info.orsak });
  const K = kopia(K0);
  const salda = [];
  K.reserver = [...(K.reserver || [])];
  if (info.tillReserv) {
    if (info.masteSlappa) {
      const r = K.reserver.findIndex((p) => p.id === slapp && !p.grundpelare);
      if (r < 0) throw Object.assign(new Error("kop: välj en reserv att släppa"), { orsak: "slapp" });
      const [ut] = K.reserver.splice(r, 1);
      salda.push({ namn: ut.namn, belopp: saljPris(ut.st) });
    }
    K.reserver.push(kopia(info.ersatt));
  } else {
    salda.push({ namn: info.ersatt.namn, belopp: info.aterbetalning });
  }
  K.trupp[info.index] = kopia(info.ny);
  K.marknad = K.marknad.filter((p) => p.id !== id);
  K.kassa = Math.round((Number(K.kassa) || 0) - info.kostnad + salda.reduce((s, x) => s + x.belopp, 0));
  return { K, info, salda };
}

/** Byt in en reserv för en startspelare på samma position (§8.2) – de byter plats. Ändrar inte K. */
export function bytIn(K0, reservId, truppId) {
  const r = (K0.reserver || []).findIndex((p) => p.id === reservId);
  const t = K0.trupp.findIndex((p) => p.id === truppId);
  if (r < 0 || t < 0) throw new Error("bytIn: spelaren finns inte");
  if (K0.reserver[r].pos !== K0.trupp[t].pos) throw new Error("bytIn: inte samma position");
  const K = kopia(K0);
  [K.trupp[t], K.reserver[r]] = [K.reserver[r], K.trupp[t]];
  return K;
}

/**
 * Träningslägret (§8.4): ett per spelad omgång ("säsong-omgång", när minst en omgång
 * är spelad) och ett extra före kvalet ("säsong-k"). K.lager är det senast använda.
 * Ett läger som inte används före nästa match går förlorat – eleven varvar match och träning.
 */
export function lagerNyckel(K) {
  const omg = Number(K?.liga?.omg) || 0;
  if (omg < 1) return null;
  const omgang = `${K.sasong}-${omg}`;
  const kval = `${K.sasong}-k`;
  if (K.lager === kval) return null;
  if (K.lager !== omgang) return omgang;
  return K.kval && !K.kval.spelad ? kval : null;
}

/** Ett svar i lägret: rätt ger 12 träningspoäng, vid 100 en stjärna till och poängen räknas om från 0 (taket 5★). */
export function tranaSpelare(p, ratt) {
  const t = C.TRANING;
  if (!ratt || p.st >= t.maxSt) return { p, nyStjarna: false };
  let st = p.st;
  let xp = (Number(p.xp) || 0) + t.xpPerRatt;
  let nyStjarna = false;
  if (xp >= t.xpPerStjarna) { st++; xp -= t.xpPerStjarna; nyStjarna = true; }
  if (st >= t.maxSt) xp = 0;
  return { p: { ...p, st, xp }, nyStjarna };
}

// Samma dagnyckel som md-sasong.js dagNyckel (som importerar den här modulen – ingen cirkelimport).
const SVENSK_DAG = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" });
export const TRANING_KALLA = "traning";

/**
 * Lägret med svaren hittills (också ett avbrutet – omladdningen spelar upp samma svar
 * igen): K.lager = nyckeln, spelarens träning och frågorna i statistiken som källan
 * "träning" (summa, perKalla.traning, dagarna). Ändrar inte K.
 * @param {{ nyckel, spelareId, svar: Array<{ ratt }>, sekunder?: number, nu: number }} o
 * @returns {{ K, spelare, stjarnor: number }}  stjarnor = nya stjärnor i lägret
 */
export function lagerResultat(K0, { nyckel, spelareId, svar, sekunder = 0, nu }) {
  if (!nyckel || nyckel !== lagerNyckel(K0)) throw new Error("lagerResultat: inget ledigt träningsläger");
  const i = K0.trupp.findIndex((p) => p.id === spelareId);
  if (i < 0 || K0.trupp[i].st >= C.TRANING.maxSt) throw new Error("lagerResultat: välj en spelare med färre än 5 stjärnor");
  const K = kopia(K0);
  K.lager = nyckel;
  const lista = svar.slice(0, C.TRANING.fragor);
  let p = K.trupp[i];
  let stjarnor = 0;
  for (const s of lista) {
    const r = tranaSpelare(p, !!s.ratt);
    p = r.p;
    if (r.nyStjarna) stjarnor++;
  }
  K.trupp[i] = p;
  const fragor = lista.length;
  const ratt = lista.filter((s) => s.ratt).length;
  const sek = Math.max(0, Math.round(Number(sekunder) || 0));
  const s = K.summa;
  s.fragor += fragor;
  s.ratt += ratt;
  const pk = (s.perKalla[TRANING_KALLA] ??= { fragor: 0, ratt: 0 });
  pk.fragor += fragor;
  pk.ratt += ratt;
  pk.namn = "Träning";
  s.spelminuter = Math.round(((Number(s.spelminuter) || 0) + sek / 60) * 10) / 10;
  const dag = SVENSK_DAG.format(nu);
  const dagar = { ...(K.dagar || {}) };
  const d = (dagar[dag] ??= { m: 0, sek: 0, fragor: 0, ratt: 0 });
  d.sek = Math.round(d.sek + sek);
  d.fragor += fragor;
  d.ratt += ratt;
  K.dagar = Object.fromEntries(Object.entries(dagar).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, C.DAGAR_MAX));
  return { K, spelare: p, stjarnor };
}

/** Kaptensbindeln på planen: lagkaptenen, eller – när kaptenen sitter bland reserverna – den första grundpelaren ute på planen. */
export function kaptenPlats(trupp = []) {
  const k = trupp.findIndex((p) => p?.kapten);
  if (k >= 0) return k;
  const g = trupp.findIndex((p, i) => i > 0 && p?.grundpelare);
  return g >= 0 ? g : 1;
}

/** Ett äldre dokument (Etapp 1–2a) saknar reserver och marknad: lägg till dem (sparas med nästa skrivning). */
export function truppFalt(K, rng) {
  if (!K || (Array.isArray(K.reserver) && Array.isArray(K.marknad))) return K;
  const ut = { ...K, reserver: Array.isArray(K.reserver) ? K.reserver : [] };
  return { ...ut, marknad: Array.isArray(K.marknad) ? K.marknad : nyMarknad(ut, rng) };
}

/** Lagdelarnas snittstjärnor (Truppen visar dem med lagbonusen). */
export function lagdelSnitt(trupp = []) {
  return Object.fromEntries(C.LAGDELAR.map((d) => {
    const st = trupp.filter((p) => p.pos === d).map((p) => Number(p.st) || 0);
    return [d, st.length ? st.reduce((a, b) => a + b, 0) / st.length : 0];
  }));
}
