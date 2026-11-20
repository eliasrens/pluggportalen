// ============================================================================
// Matchdagen (#869, Etapp 1c): klubben, säsongen och karriären – REN modul
// (spec §5, §6.1, §8.3). Ingen DOM, ingen Firebase, ingen Math.random/Date.now:
// slumpen (rng: () → [0, 1)) och tiden (nu, ms) skickas in. Testas i node
// (test/matchdagen-sasong.test.js). Karriären K är formen på matchdagen/{uid}
// (utom senast, som sätts av servern) – se docs/MATCHDAGEN.md §10.
//
//   nyKarriar({ namn, farg, rng })        → K: ny klubb i Division 6, säsong 1
//   lagnamnOk(s)                          → trimmat namn (1–24 tecken) eller null
//   nastaMatch(K)                         → { omg, antal, mot, hemma } | null (säsongen klar)
//   lagInfo(K, id)                        → { id, namn, farg, vi, styrka? }
//   motFarg(egen, mot)                    → motståndarens tröja i matchen (aldrig samma som vår)
//   matchKlar(K, { res, rng, nu, matchId, kallNamn? })
//                                         → { K, match, pengar, sasongKlar, plac }
//                                           ligavinnaren under Superligan får K.kval (§7.2, spelas i md-kval.js)
//   tabellRader(K)                        → tabellen i placeringsordning med namn och färg
//   nySasong(K, rng)                      → K för nästa säsong (samma division – kvalet ändrar den, md-kval.js)
//   bokforMatch(K, { res, nu, matchId, kallNamn, mot, typ, omg? }) → { match, pengar }   (ändrar K – liga och kval)
//   sasongFro(K, uid)                     → frö för nästa ligas lottning (samma vid omladdning)
//   dagNyckel(nu), sekunderSenaste(dagar, nu, n), veckoRatt(dagar, nu, n)
// ============================================================================

import * as C from "./md-config.js";
import { schema, simMal, styrkaFor, nyTabell, laggTill, sorteraTabell } from "./md-liga.js";
import { EFTERNAMN, FORNAMN, LAGFARGER, MOTSTANDARE, STARTELVA, STANDARD_LAGNAMN, TROJFARGER } from "./md-namn.js";

export const VERSION = 1;
export const OSS = "oss";

const valj = (rng, lista) => lista[Math.floor(rng() * lista.length)];
function blanda(rng, lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const kopia = (v) => JSON.parse(JSON.stringify(v));

/** Lagnamnet: blanksteg ihopslagna, 1–24 tecken, inga vinkelparenteser – annars null. */
export function lagnamnOk(s) {
  const t = String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= C.LAGNAMN_MAX ? t : null;
}

/** De sju grundpelarna med färdiga namn (§5, §8.2): alla 2★, en av dem lagkapten. */
export function nyTrupp(rng) {
  const anvanda = new Set(); // förnamnen – två "Jonatan" i samma lag blir förvirrande
  const kapten = 1 + Math.floor(rng() * (STARTELVA.length - 1)); // aldrig målvakten
  return STARTELVA.map(({ pos, nr }, i) => {
    let fornamn;
    do fornamn = valj(rng, FORNAMN); while (anvanda.has(fornamn));
    anvanda.add(fornamn);
    const namn = `${fornamn} ${valj(rng, EFTERNAMN)}`;
    return { id: `g${i + 1}`, namn, pos, nr, st: 2, xp: 0, grundpelare: true, kapten: i === kapten };
  });
}

/** Schemat som strängar ("a:b|c:d|e:f" per omgång) – Firestore tillåter inga listor i listor. */
const schemaText = (omgangar) => omgangar.map((par) => par.map(([a, b]) => `${a}:${b}`).join("|"));
/** En omgångs par ur ligans schema. */
export const omgangsPar = (liga, omg) => String(liga.schema[omg] || "").split("|").filter(Boolean).map((p) => p.split(":"));

/** En ny liga i divisionen: vi + påhittade motståndare med dold styrka (§5). */
export function nyLiga(div, trojfarg, rng) {
  const antal = C.LAGANTAL[div] ?? C.LAGANTAL[0];
  const namn = blanda(rng, MOTSTANDARE).slice(0, antal - 1);
  const farger = blanda(rng, LAGFARGER.filter((f) => f !== trojfarg));
  const lag = [{ id: OSS }, ...namn.map((n, i) => ({
    id: `m${i + 1}`, namn: n, farg: farger[i % farger.length], styrka: Math.round(styrkaFor(div, rng) * 1000) / 1000,
  }))];
  const ids = blanda(rng, lag.map((l) => l.id));
  return { lag, schema: schemaText(schema(ids)), tabell: nyTabell(lag.map((l) => l.id)), omg: 0 };
}

/** Kvalmotståndaren (§7.2): ett lag från divisionen ovanför, inte ur ligan, med styrka(div + 1). */
function nyKval(K, rng) {
  const tagna = new Set(K.liga.lag.map((l) => l.namn));
  const namn = valj(rng, MOTSTANDARE.filter((n) => !tagna.has(n)));
  const farg = valj(rng, LAGFARGER.filter((f) => f !== K.klubb.farg));
  const styrka = Math.round(styrkaFor(K.div + 1, rng) * 1000) / 1000;
  return { div: K.div, sasong: K.sasong, mot: { namn, farg, styrka }, spelad: false };
}

const tomSumma = () => ({ matcher: 0, v: 0, o: 0, f: 0, gjorda: 0, inslappta: 0, fragor: 0, ratt: 0, perKalla: {}, spelminuter: 0 });

/** En ny klubb: namn (1–24 tecken) och en av de 8 tröjfärgerna (§5). */
export function nyKarriar({ namn, farg, rng }) {
  const klubbFarg = TROJFARGER.includes(farg) ? farg : TROJFARGER[0];
  return {
    version: VERSION,
    klubb: { namn: lagnamnOk(namn) || STANDARD_LAGNAMN, farg: klubbFarg, legendStjarnor: 0 },
    div: 0, sasong: 1, kassa: C.KASSA.start,
    trupp: nyTrupp(rng),
    liga: nyLiga(0, klubbFarg, rng),
    kval: null, pokaler: [], summa: tomSumma(), senaste: [], sasonger: [], dagar: {},
  };
}

/** Är dokumentet en användbar karriär? (annars börjar eleven med en ny klubb) */
export function karriarOk(K) {
  return !!(K && K.klubb && typeof K.klubb.namn === "string" && K.liga && Array.isArray(K.liga.lag) &&
    Array.isArray(K.liga.schema) && K.liga.tabell && Array.isArray(K.trupp) && K.trupp.length);
}

/** Lagets namn och färg (vårt lag ur klubben – lärarens återställning rör bara klubb.namn). */
export function lagInfo(K, id) {
  if (id === OSS) return { id, namn: K.klubb.namn, farg: K.klubb.farg, vi: true };
  const l = K.liga.lag.find((x) => x.id === id);
  return l ? { id, namn: l.namn, farg: l.farg, styrka: l.styrka, vi: false } : { id, namn: "?", farg: "#7a8899", vi: false };
}

/** Motståndarens tröja i matchen: deras egen, eller en annan om eleven bytt till samma färg mitt i säsongen. */
export function motFarg(egen, mot) {
  const lika = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  return !lika(egen, mot) ? mot : LAGFARGER.find((f) => !lika(f, egen)) || "#1c2433";
}

/** Nästa ligamatch, eller null när säsongens alla omgångar är spelade. */
export function nastaMatch(K) {
  const antal = K.liga.schema.length;
  const omg = K.liga.omg;
  if (omg >= antal) return null;
  const par = omgangsPar(K.liga, omg).find(([a, b]) => a === OSS || b === OSS);
  if (!par) return null;
  const motId = par[0] === OSS ? par[1] : par[0];
  return { omg, antal, hemma: par[0] === OSS, mot: lagInfo(K, motId) };
}

/** Klubbkassan efter en match (§8.3). */
export function pengarFor({ oss, dem }, ratt, div = 0) {
  const k = C.KASSA;
  const grund = oss > dem ? k.vinst : oss === dem ? k.oavgjort : k.forlust;
  return Math.round((grund + ratt * k.perRatt + oss * k.perMal) * (1 + div * k.perDiv));
}

/**
 * Datumnyckeln ÅÅÅÅ-MM-DD i svensk tid – samma dag i webbläsaren och (Etapp 4)
 * på servern, oberoende av maskinens tidszon. Ingen klocka: tiden skickas in.
 */
const SVENSK_DAG = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" });
export const dagNyckel = (nu) => SVENSK_DAG.format(nu);
/** Dagnummer (dagar sedan 1970-01-01) för en datumnyckel – för att räkna dagar mellan två nycklar. */
const dagNr = (k) => Math.round(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 86400000);

/** Tabellen i placeringsordning, med namn och färg. */
export function tabellRader(K) {
  return sorteraTabell(K.liga.tabell).map((r, i) => ({ ...r, plac: i + 1, ...lagInfo(K, r.id) }));
}

const runda1 = (x) => Math.round(x * 10) / 10;

/**
 * Elevens match är slut: tabellen (med omgångens övriga matcher via simMal),
 * kassan, summan, de senaste matcherna, dagarna och – efter sista omgången –
 * säsongens placering och pokal. Ändrar inte K.
 * @param {object} K0
 * @param {{ res: object, rng: Function, nu: number, matchId: string, kallNamn?: object }} o
 *   res = resultat(m) ur md-motor.js (oss, dem, utfall, mal, stat)
 * @returns {{ K, match, pengar, sasongKlar: boolean, plac: number|null }}
 */
export function matchKlar(K0, { res, rng, nu, matchId, kallNamn = {} }) {
  const nasta = nastaMatch(K0);
  if (!nasta) throw new Error("matchKlar: säsongen är redan slut");
  const K = kopia(K0);
  const { oss, dem } = res;
  let tabell = K.liga.tabell;
  for (const [a, b] of omgangsPar(K.liga, nasta.omg)) {
    if (a === OSS || b === OSS) {
      tabell = a === OSS ? laggTill(tabell, a, b, oss, dem) : laggTill(tabell, a, b, dem, oss);
      continue;
    }
    const [ga, gb] = simMalFor(K, a, b, rng);
    tabell = laggTill(tabell, a, b, ga, gb);
  }
  K.liga.tabell = tabell;
  K.liga.omg = nasta.omg + 1;
  const { match, pengar, dag } = bokforMatch(K, { res, nu, matchId, kallNamn, mot: nasta.mot.namn, typ: "liga", omg: nasta.omg + 1 });

  const sasongKlar = K.liga.omg >= K.liga.schema.length;
  let plac = null;
  if (sasongKlar) {
    plac = tabellRader(K).findIndex((r) => r.id === OSS) + 1;
    K.sasonger = [{ sasong: K.sasong, div: K.div, plac, lag: K.liga.lag.length }, ...(K.sasonger || [])].slice(0, 200);
    if (plac === 1) {
      K.pokaler = [...(K.pokaler || []), { typ: "liga", namn: `Vinnare ${C.DIVISIONER[K.div]}`, sasong: K.sasong, datum: dag }];
      // Bara ligavinnaren kvalar uppåt (§7.2). Superligan är toppen (Mästarcupen: Etapp 3).
      if (K.div < C.TOPP_DIV) K.kval = nyKval(K, rng);
    }
  }
  return { K, match, pengar, sasongKlar, plac };
}

/**
 * Bokför en spelad match i K (ändrar K – anroparen har kopierat): kassan, summan,
 * de senaste matcherna och dagarna. Ger matchdokumentet (matcher/{id}) och pengarna.
 * typ "liga" har omg; "kval" har straffar när det avgjordes på straffar.
 */
export function bokforMatch(K, { res, nu, matchId, kallNamn = {}, mot, typ, omg = null, div = K.div, extraPengar = 0 }) {
  const { oss, dem, stat } = res;
  const pengar = pengarFor(res, stat.ratt, div) + extraPengar;
  K.kassa = Math.round((Number(K.kassa) || 0) + pengar);

  const s = K.summa || tomSumma();
  s.matcher++;
  if (oss > dem) s.v++; else if (oss < dem) s.f++; else s.o++;
  s.gjorda += oss;
  s.inslappta += dem;
  s.fragor += stat.fragor;
  s.ratt += stat.ratt;
  for (const [k, v] of Object.entries(stat.perKalla || {})) {
    const p = (s.perKalla[k] ??= { fragor: 0, ratt: 0 });
    p.fragor += v.fragor;
    p.ratt += v.ratt;
    if (kallNamn[k]) p.namn = String(kallNamn[k]).slice(0, 60);
  }
  s.spelminuter = runda1((Number(s.spelminuter) || 0) + stat.sekunder / 60);
  K.summa = s;

  const straffar = Array.isArray(res.straffar) ? res.straffar.slice(0, 2) : null;
  const dag = dagNyckel(nu);
  const senast = { id: matchId, datum: dag, mot, oss, dem, ratt: stat.ratt, fragor: stat.fragor, sasong: K.sasong };
  if (omg != null) senast.omg = omg;
  if (typ !== "liga") senast.typ = typ;
  if (straffar) senast.straffar = straffar;
  K.senaste = [senast, ...(K.senaste || [])].slice(0, C.SENASTE_MAX);
  const dagar = { ...(K.dagar || {}) };
  const d = (dagar[dag] ??= { m: 0, sek: 0, fragor: 0, ratt: 0 });
  d.m++;
  d.sek = Math.round(d.sek + stat.sekunder);
  d.fragor += stat.fragor;
  d.ratt += stat.ratt;
  K.dagar = Object.fromEntries(Object.entries(dagar).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, C.DAGAR_MAX));

  const match = {
    sasong: K.sasong, div, typ, mot, oss, dem,
    mal: res.mal.map((x) => ({ min: x.min, lag: x.lag })), stat: kopia(stat), fragor: stat.fragor, ratt: stat.ratt,
    perKalla: kopia(stat.perKalla || {}), sekunder: Math.round(stat.sekunder),
  };
  if (omg != null) match.omg = omg;
  if (straffar) match.straffar = straffar;
  delete match.stat.perKalla;
  return { match, pengar, dag };
}

function simMalFor(K, a, b, rng) {
  const sa = lagInfo(K, a).styrka ?? C.STYRKA.bas;
  const sb = lagInfo(K, b).styrka ?? C.STYRKA.bas;
  return simMal(sa, sb, rng);
}

/**
 * Nästa säsong: ny liga med nya motståndare i K.div – efter ett vunnet kval är det
 * redan divisionen ovanför (md-kval.js). Ingen åker ner (§7.2). Ett kval måste
 * vara spelat först.
 */
export function nySasong(K0, rng) {
  if (nastaMatch(K0)) throw new Error("nySasong: säsongen är inte slut");
  if (K0.kval && !K0.kval.spelad) throw new Error("nySasong: kvalet är inte spelat");
  const K = kopia(K0);
  K.sasong = (Number(K.sasong) || 1) + 1;
  K.liga = nyLiga(K.div, K.klubb.farg, rng);
  K.kval = null;
  return K;
}

/** Fröet för nästa ligas lottning: samma klubb + säsong ger samma liga vid omladdning. */
export const sasongFro = (K, uid = "") => `${uid}|${K.sasong}|${K.div}|liga`;

/** Speltid i sekunder de senaste n dagarna (idag inräknat). */
/** Bara riktiga dagar ("ÅÅÅÅ-MM-DD" → map) – dokumentet skrivs av eleven och kan vara trasigt. */
const DAG = /^\d{4}-\d{2}-\d{2}$/;
const dagRader = (dagar) => Object.entries(dagar && typeof dagar === "object" ? dagar : {})
  .filter(([k, v]) => DAG.test(k) && v && typeof v === "object");

export function sekunderSenaste(dagar = {}, nu, n = 7) {
  const grans = dagNyckel(nu - (n - 1) * 86400000);
  return dagRader(dagar).filter(([k]) => k >= grans).reduce((s, [, v]) => s + (Number(v.sek) || 0), 0);
}

/** Andel rätt per vecka, de n senaste veckorna (äldst först) – null för en vecka utan frågor. */
export function veckoRatt(dagar = {}, nu, n = 8) {
  const ut = Array.from({ length: n }, () => ({ fragor: 0, ratt: 0 }));
  const idag = dagNr(dagNyckel(nu));
  for (const [k, v] of dagRader(dagar)) {
    const dagarSedan = idag - dagNr(k);
    const vecka = Math.floor(dagarSedan / 7);
    if (vecka < 0 || vecka >= n) continue;
    ut[n - 1 - vecka].fragor += Number(v.fragor) || 0;
    ut[n - 1 - vecka].ratt += Number(v.ratt) || 0;
  }
  return ut.map((v) => (v.fragor ? v.ratt / v.fragor : null));
}
