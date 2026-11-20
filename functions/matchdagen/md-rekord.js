// ============================================================================
// Matchdagen (#872, Etapp 2c): REKORDEN – ren (spec §9.2). Ingen DOM, ingen
// Firebase, ingen klocka. K.rekord är EN rad text (som marknadens rader och
// lägret) – så att reglerna prövar alla rekord med ETT reguljärt uttryck
// (REKORD_MONSTER, firestore.rules) och 1000-uttrycksgränsen håller:
//
//   "mm5.3|ms30.2|ss6-0.3|sv12.4|lt3.5|os1.2|ar85.2|sm2.1|nu3.12.140.110.6.4.2.12"
//    mm flest mål i en match · ms flest mål på en säsong · ss största seger (vi-de)
//    sv längsta svit utan förlust · lt flest ligatitlar i rad · os obesegrade säsonger
//    ar bästa andel rätt på en säsong (%, minst REKORD.minMatcher matcher) · sm snabbaste mål (minut)
//    – värde.säsong, tomt = inget rekord än
//    nu = säsongen.mål.frågor.rätt.matcher (den här säsongen).svit.ligatitlar i rad (pågående).
//         svitrekordet när den pågående sviten började (så att den annonseras EN gång, när den slår det)
//
//   lasRekord(text, sasong?)            → { mm, ms, ss, sv, lt, os, ar, sm, nu } (tålig – dokumentet skrivs av eleven)
//   rekordText(R)                        → texten ovan
//   rekordEfterMatch(K, res)             → ["Nytt rekord: 5 mål i en match!", …]  (ändrar K.rekord)
//   rekordEfterSasong(K, { plac, forlust }) → samma, för säsongens rekord när ligan är slut
//   rekordRader(text)                    → [{ id, namn, varde, sasong }] för Statistik och lärarens vy
// ============================================================================

import { REKORD } from "./md-config.js";

export const REKORD_NYCKLAR = ["mm", "ms", "ss", "sv", "lt", "os", "ar", "sm"];
const V = "[0-9]{1,5}[.][0-9]{1,5}";
/** Samma uttryck som i firestore.rules (validMatchdagen, rekord) – testat i test/matchdagen-cup.test.js. */
export const REKORD_MONSTER = `mm(${V})?[|]ms(${V})?[|]ss([0-9]{1,2}-[0-9]{1,2}[.][0-9]{1,5})?[|]sv(${V})?[|]lt(${V})?[|]os(${V})?[|]ar(${V})?[|]sm(${V})?[|]nu[0-9]{1,5}([.][0-9]{1,9}){7}`;

const heltal = (x, max = 99999) => Math.min(max, Math.max(0, Math.floor(Number(x) || 0)));
const nyttNu = (s, svit = 0, lt = 0, svBas = 0) => ({ s, mal: 0, fragor: 0, ratt: 0, matcher: 0, svit, lt, svBas });

/** Rekorden ur texten. Okända eller trasiga delar hoppas över – aldrig ett fel. */
export function lasRekord(text, sasong = 1) {
  const R = { nu: nyttNu(heltal(sasong) || 1) };
  for (const k of REKORD_NYCKLAR) R[k] = null;
  for (const del of String(text ?? "").split("|")) {
    const k = del.slice(0, 2);
    const v = del.slice(2);
    if (k === "nu") {
      const t = v.split(".");
      if (t.length === 8) {
        const [s, mal, fragor, ratt, matcher, svit, lt, svBas] = t.map((x) => heltal(x, 999999999));
        R.nu = { s, mal, fragor, ratt: Math.min(ratt, fragor), matcher, svit, lt, svBas };
      }
    } else if (REKORD_NYCKLAR.includes(k) && v) {
      const [varde, s] = v.split(".");
      if (k === "ss") {
        const [oss, dem] = String(varde).split("-");
        R.ss = { oss: heltal(oss, 99), dem: heltal(dem, 99), s: heltal(s) };
      } else R[k] = { v: heltal(varde), s: heltal(s) };
    }
  }
  return R;
}

/** Texten som sparas – alltid i REKORD_MONSTER:s form. */
export function rekordText(R) {
  const del = (k) => {
    const x = R[k];
    if (!x) return k;
    return k === "ss" ? `ss${heltal(x.oss, 99)}-${heltal(x.dem, 99)}.${heltal(x.s)}` : `${k}${heltal(x.v)}.${heltal(x.s)}`;
  };
  const n = R.nu;
  const nu = [heltal(n.s), ...[n.mal, n.fragor, n.ratt, n.matcher, n.svit, n.lt, n.svBas].map((x) => heltal(x, 999999999))];
  return [...REKORD_NYCKLAR.map(del), `nu${nu.join(".")}`].join("|");
}

/** Rekorden med den här säsongens löpande värden – nollade när en ny säsong har börjat (sviterna fortsätter). */
function rekordFor(K) {
  const s = heltal(K.sasong) || 1;
  const R = lasRekord(K.rekord, s);
  if (R.nu.s !== s) R.nu = nyttNu(s, R.nu.svit, R.nu.lt, R.nu.svBas);
  return { R, s };
}

/**
 * En spelad match (liga, kval eller cup): flest mål, största seger, snabbaste mål och
 * svit utan förlust (en straffvinst är ingen förlust, en straffförlust är det – res.vann === false). Ett rekord
 * som sätts första gången annonseras inte – bara när ett gammalt slås. En svit annonseras
 * en gång: när den slår rekordet från före sviten (minst 3 matcher). Ändrar K.rekord.
 * @param {{ oss: number, dem: number, mal: Array<{ min, lag }>, stat: { fragor, ratt } }} res
 */
export function rekordEfterMatch(K, res) {
  const { R, s } = rekordFor(K);
  const nya = [];
  const oss = heltal(res.oss, 99);
  const dem = heltal(res.dem, 99);
  const n = R.nu;
  n.mal += oss;
  n.fragor += heltal(res.stat?.fragor);
  n.ratt += heltal(res.stat?.ratt);
  n.matcher++;

  if (oss > 0 && (!R.mm || oss > R.mm.v)) {
    if (R.mm) nya.push(`Nytt rekord: ${oss} mål i en match!`);
    R.mm = { v: oss, s };
  }
  if (oss > dem && (!R.ss || oss - dem > R.ss.oss - R.ss.dem)) {
    if (R.ss) nya.push(`Nytt rekord: största segern någonsin, ${oss}–${dem}!`);
    R.ss = { oss, dem, s };
  }
  const forsta = (res.mal || []).filter((x) => x?.lag === "oss").map((x) => heltal(x.min, 999)).filter((x) => x > 0);
  if (forsta.length) {
    const min = Math.min(...forsta);
    if (!R.sm || min < R.sm.v) {
      if (R.sm) nya.push(`Nytt rekord: snabbaste målet någonsin – redan i minut ${min}!`);
      R.sm = { v: min, s };
    }
  }
  if (oss < dem || res.vann === false) { // en förlust – också på straffar (utslagna ur cupen, förlorat kval)
    n.svit = 0;
    n.svBas = R.sv?.v || 0;
  } else n.svit++;
  if (n.svit > (R.sv?.v || 0)) R.sv = { v: n.svit, s };
  // En gång per svit: när den slår det gamla rekordet, men aldrig under 3 (gammalt rekord 1 → vid 3).
  if (n.svBas > 0 && n.svit === Math.max(n.svBas + 1, 3)) nya.push(`Nytt rekord: ${n.svit} matcher i rad utan förlust!`);
  K.rekord = rekordText(R);
  return nya;
}

/**
 * Ligan är slut (sista omgången): flest mål och bästa andel rätt på säsongen (ligan och
 * cupen hittills – kvalet efteråt räknas inte), ligatitlar i rad och obesegrad säsong
 * (ingen förlust i ligan). Ändrar K.rekord.
 */
export function rekordEfterSasong(K, { plac, forlust }) {
  const { R, s } = rekordFor(K);
  const nya = [];
  const n = R.nu;
  if (n.mal > 0 && (!R.ms || n.mal > R.ms.v)) {
    if (R.ms) nya.push(`Nytt rekord: ${n.mal} mål på en säsong!`);
    R.ms = { v: n.mal, s };
  }
  if (n.matcher >= REKORD.minMatcher && n.fragor > 0) {
    const pct = Math.round((100 * n.ratt) / n.fragor);
    if (!R.ar || pct > R.ar.v) {
      if (R.ar) nya.push(`Nytt rekord: ${pct} % rätt svar på en säsong!`);
      R.ar = { v: pct, s };
    }
  }
  n.lt = plac === 1 ? n.lt + 1 : 0;
  if (n.lt > (R.lt?.v || 0)) {
    if (n.lt >= 2) nya.push(`Nytt rekord: ${n.lt} ligatitlar i rad!`);
    R.lt = { v: n.lt, s };
  }
  if (Number(forlust) === 0) {
    const v = (R.os?.v || 0) + 1;
    nya.push(v === 1 ? "Nytt rekord: en obesegrad säsong!" : `Nytt rekord: ${v} obesegrade säsonger!`);
    R.os = { v, s };
  }
  K.rekord = rekordText(R);
  return nya;
}

/** Raderna i Statistik (och lärarens vy): bara tal ur texten – inget i dokumentet blir HTML. */
export function rekordRader(text) {
  const R = lasRekord(text);
  const rad = (id, namn, varde) => ({ id, namn, varde: R[id] ? varde(R[id]) : null, sasong: R[id]?.s ?? null });
  return [
    rad("mm", "Flest mål i en match", (x) => `${x.v} mål`),
    rad("ms", "Flest mål på en säsong", (x) => `${x.v} mål`),
    rad("ss", "Största seger", (x) => `${x.oss}–${x.dem}`),
    rad("sv", "Längsta svit utan förlust", (x) => `${x.v} ${x.v === 1 ? "match" : "matcher"}`),
    rad("lt", "Flest ligatitlar i rad", (x) => `${x.v}`),
    { ...rad("os", "Obesegrad säsong", (x) => (x.v > 1 ? `Ja, ${x.v} gånger` : "Ja")), ...(R.os ? {} : { varde: "Inte än" }) },
    rad("ar", `Bästa andel rätt på en säsong (minst ${REKORD.minMatcher} matcher)`, (x) => `${x.v} %`),
    rad("sm", "Snabbaste mål", (x) => `minut ${x.v}`),
  ];
}
