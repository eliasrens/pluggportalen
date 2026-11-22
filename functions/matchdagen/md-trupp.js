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
//   pris(st)                         → kr (tabellen MARKNAD.pris: 150, 560, 1 210, 3 150, 5 200)
//   marknadMaxSt(div)                → högsta stjärnorna marknaden kan ge i divisionen (reglerna)
//   nyMarknad(K, rng)                → 6 spelare till salu (nya efter varje match)
//   kopInfo(K, id)                   → vem som ersätts, vad det kostar, om reserverna är fulla
//   kop(K, id, { slapp? })           → { K, info, salda }   (slapp = köpt reserv som släpps när reserverna är fulla)
//   bytIn(K, reservId, truppId)      → K   (reserv ↔ startspelare på samma position)
//   lagerNyckel(K)                   → nyckeln för ett ledigt (eller påbörjat) träningsläger, eller null
//   lagerNummer(nyckel)              → lägrets nummer i omgången (1–3), "Träningsläger 2/3"
//   lagerKvar(K)                     → hur många läger som är kvar före nästa match (också det påbörjade)
//   lagerPaborjat(K), lagerStart(K), lagerAvbrutet(K)  → påbörjat? / starta / räkna som använt
//   xpTill(st), traningsVarde(p)     → poängen till nästa stjärna / stjärnor + poäng som ett tal (#883)
//   tranaSpelare(p, ratt)            → { p, nyStjarna }
//   lagerResultat(K, { nyckel, spelareId, svar, sekunder?, nu }) → { K, spelare, stjarnor }
//   kaptenPlats(trupp)               → index för kaptensbindeln på planen
//   truppFalt(K)                     → K med reserver och marknad (äldre dokument från Etapp 1–2a)
//   marknadTillDok(m), marknadFranDok(m) → marknaden i dokumentet: en rad "id|namn|pos|nr|st" per spelare
// ============================================================================

import * as C from "./md-config.js";
import { EFTERNAMN, FORNAMN } from "./md-namn.js";

const kl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const kopia = (v) => JSON.parse(JSON.stringify(v));
const valj = (rng, lista) => lista[Math.floor(rng() * lista.length)];
/** Poängen som krävs från st till st + 1 (#883: 50, 100, 250, 500) – 0 vid taket. */
export const xpTill = (st) => C.TRANING.xpTillStjarna[(Number(st) || 0) + 1] || 0;
/**
 * Spelarens träning som ETT tal (stjärnorna + poängen): poängen för alla stjärnor från 1★ upp
 * till st, plus xp. Ökar med exakt 12 per rätt svar – samma tal som reglerna (mdPlatsOk) jämför.
 */
export function traningsVarde(p) {
  const st = Number(p?.st) || 0;
  let v = Number(p?.xp) || 0;
  for (let s = 2; s <= st; s++) v += C.TRANING.xpTillStjarna[s] || 0;
  return v;
}
/** Spelarens "värde" för att jämföra: stjärnor först, sedan träningspoängen. */
const varde = traningsVarde;

/** Priset för en spelare med st stjärnor (§8.3, #890): 150, 560, 1 210, 3 150, 5 200 kr för 1–5. */
export function pris(st) {
  return C.MARKNAD.pris[Number(st)] ?? 0;
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

/**
 * Marknaden i dokumentet (#871 F1): en rad "id|namn|pos|nr|st" per spelare (otränad, xp 0) –
 * så att reglerna kan pröva hela listan med ETT reguljärt uttryck i varje matchsparning
 * (firestore.rules mdMarknadOk) och ett köp med en jämförelse (mdKopOk). I appen är spelarna objekt.
 */
export const saluRad = (p) => (typeof p === "string" ? p : [p.id, p.namn, p.pos, p.nr, p.st].join("|"));
export const marknadTillDok = (m) => (Array.isArray(m) ? m : []).map(saluRad);
export function marknadFranDok(m) {
  return (Array.isArray(m) ? m : []).flatMap((x) => {
    if (x && typeof x === "object") return [x]; // ett dokument från före radformen
    const [id, namn, pos, nr, st] = String(x).split("|");
    return id && namn && pos ? [{ id, namn, pos, nr: Number(nr) || 0, st: Number(st) || 0, xp: 0 }] : [];
  });
}

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
  // En position som inte finns i startelvan (ett dokument skrivet förbi appen) – inget köp, ingen krasch.
  if (!ersatt) return { ny, index, kostnad, kan: false, orsak: "position" };
  const tillReserv = !!ersatt.grundpelare;
  const reserver = K.reserver || [];
  const slappbara = reserver.filter((p) => !p.grundpelare);
  const masteSlappa = tillReserv && reserver.length >= C.RESERVER_MAX;
  const info = { ny, index, ersatt, kostnad, tillReserv, aterbetalning: tillReserv ? 0 : saljPris(ersatt.st), masteSlappa, slappbara };
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

/** Ett påbörjat läger: nyckeln + PABORJAT (sparas på servern när lägret startar). */
export const PABORJAT = "-p";

/** Ett läger i K.lager: "säsong-omgång[-nummer][-p]" (utan nummer = det första, före #883) eller "säsong-k[-p]". */
const LAGER_FORM = /^(\d+)-(\d+|k)(?:-([1-9]))?(-p)?$/;

/**
 * Träningslägret (§8.4, #883): upp till TRANING.perOmgang (3) läger per spelad omgång,
 * "säsong-omgång-nummer" (när minst en omgång är spelad). K.lager är det senast använda –
 * eller det påbörjade (+ "-p"): då är det lägret som gäller tills det är klart (bara med
 * svaren som redan sparats lokalt – annars räknas det som använt, lagerAvbrutet). Läger som
 * inte används före nästa ligamatch (eller kvalet) går förlorade – eleven varvar match och träning.
 * Äldre nycklar (före #883) gäller fortfarande: "säsong-omgång" = det första lägret i omgången,
 * "säsong-k" = kvalets extra läger (då är omgångens läger slut – nya ges inte längre).
 */
export function lagerNyckel(K) {
  const omg = Number(K?.liga?.omg) || 0;
  if (omg < 1) return null;
  const omgang = `${K.sasong}-${omg}`;
  const L = String(K.lager ?? "");
  const m = LAGER_FORM.exec(L);
  const denna = !!m && m[1] === String(K.sasong) && (m[2] === String(omg) || m[2] === "k");
  if (denna && m[4]) return L.slice(0, -PABORJAT.length); // påbörjat: samma läger tills det är klart
  if (K.kval?.spelad) return null; // kvalet är en match – säsongens läger är slut
  if (denna && m[2] === "k") return null;
  const nr = denna ? Number(m[3] || 1) : 0;
  return nr < C.TRANING.perOmgang ? `${omgang}-${nr + 1}` : null;
}
/** Lägrets nummer i omgången (1–3) ur nyckeln – null för kvalets äldre extra läger. */
export function lagerNummer(nyckel) {
  const m = LAGER_FORM.exec(String(nyckel ?? ""));
  return m && m[2] !== "k" ? Number(m[3] || 1) : null;
}
/** Läger kvar före nästa match – det påbörjade räknas med. */
export function lagerKvar(K) {
  const n = lagerNummer(lagerNyckel(K));
  return n ? C.TRANING.perOmgang - n + 1 : lagerNyckel(K) ? 1 : 0;
}
/** Är det lediga lägret redan påbörjat (på servern)? */
export const lagerPaborjat = (K) => { const n = lagerNyckel(K); return !!n && K.lager === n + PABORJAT; };
/** Lägret startar: nyckeln + "-p" i karriären (EN skrivning) – en omladdning ger aldrig ett nytt läger. Ändrar inte K. */
export const lagerStart = (K) => ({ ...K, lager: lagerNyckel(K) + PABORJAT });
/** Ett påbörjat läger utan sparade svar (lokal lagring rensad, annan dator): räknas som använt, ingen träning. */
export const lagerAvbrutet = (K) => ({ ...K, lager: lagerNyckel(K) });

/**
 * Ett svar i lägret: rätt ger 12 träningspoäng, vid xpTill(st) (50/100/250/500) en stjärna till
 * och resten följer med (taket 5★, då nollas poängen).
 */
export function tranaSpelare(p, ratt) {
  const t = C.TRANING;
  if (!ratt || p.st >= t.maxSt) return { p, nyStjarna: false };
  let st = p.st;
  let xp = (Number(p.xp) || 0) + t.xpPerRatt;
  let nyStjarna = false;
  if (xp >= xpTill(st)) { xp -= xpTill(st); st++; nyStjarna = true; }
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

/** Ett äldre dokument (Etapp 1–2a) saknar reserver och marknad: tomma (nya spelare till salu efter nästa match). */
export function truppFalt(K) {
  if (!K) return K;
  return { ...K, reserver: Array.isArray(K.reserver) ? K.reserver : [], marknad: marknadFranDok(K.marknad) };
}

/** Lagdelarnas snittstjärnor (Truppen visar dem med lagbonusen). */
export function lagdelSnitt(trupp = []) {
  return Object.fromEntries(C.LAGDELAR.map((d) => {
    const st = trupp.filter((p) => p.pos === d).map((p) => Number(p.st) || 0);
    return [d, st.length ? st.reduce((a, b) => a + b, 0) / st.length : 0];
  }));
}
