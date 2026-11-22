// ============================================================================
// Matchdagen (#880): TOPPLISTAN PER ÅRSKURS – ren (ingen DOM, ingen Firebase, ingen klocka).
// Delas av servern (functions/md-topplista-bygg.js bygger listan en gång i timmen) och
// elevens flik Topplista (vy/md-vy-topplista.js). docs/MATCHDAGEN.md §21.
//
// Rangordningen (enkel och rättvis – samma för alla årskurser):
//   1. bästa division som klubben (eller en tidigare klubb) nått, 0 = Division 6 … 7 = Superligan
//   2. legendstjärnor (klubbar tagna hela vägen, #873)
//   3. vinster totalt (summa.v)
//   4. målskillnad totalt (summa.gjorda − summa.inslappta)
// Lika på alla fyra = delad plats (1, 2, 2, 4). Listan visar topp 5 (TOPP); en delad
// femteplats tas med, högst TAK rader.
//
// Rimlighetskontrollen (karriären skrivs av eleven själv – reglerna prövar formen men inte att
// talen hänger ihop): en karriär som inte klarar rimligKarriar() kommer inte med på listan.
//
//   arskursAvKlass(namn)            → 4 | 10 | "Övriga"  (samma som src/tavling/arskurs.js)
//   akNyckel(ak), akLabel(nyckel)   → "4" | "ovriga";  "Åk 4" | "Övriga"
//   elevArskurs(klasser, uid, har)  → elevens årskursnyckel (klasserna med Matchdagen) | null
//   bastaDiv(K)                     → 0–7
//   minMatcherTill(div)             → minsta antal matcher för att nå divisionen från Division 6
//   rimligKarriar(K)                → { ok, skal }
//   radFor(uid, K, { namn, klass }) → topplistans rad (utan plats)
//   rangordna(rader)                → raderna sorterade med plats, högst TAK med plats ≤ TOPP
//   byggTopplistor(elever)          → { arskurser: { [nyckel]: rader }, antal: { [nyckel]: n }, uteslutna }
//   sorteraNycklar(nycklar)         → stigande årskurser, "ovriga" sist
// ============================================================================

import { DIVISIONER, LAGANTAL, TOPP_DIV, TOPPLISTA } from "./md-config.js";

export const TOPP = TOPPLISTA.topp;
export const TAK = TOPPLISTA.tak;
export const OVRIGA = "Övriga";
export const OVRIGA_NYCKEL = "ovriga";

/** "4B" → 4, "10A" → 10, "Klass 3"/"Fritids"/""/null → "Övriga" – som src/tavling/arskurs.js (#845). */
export function arskursAvKlass(namn) {
  const m = /^([1-9][0-9]?)(?![0-9])/.exec(String(namn ?? ""));
  return m ? Number(m[1]) : OVRIGA;
}
export const akNyckel = (ak) => (ak === OVRIGA ? OVRIGA_NYCKEL : String(ak));
export const akLabel = (n) => (n === OVRIGA_NYCKEL ? OVRIGA : `Åk ${n}`);

/** Stigande årskurser, "ovriga" sist. */
export function sorteraNycklar(nycklar) {
  return [...nycklar].sort((a, b) => (a === OVRIGA_NYCKEL) - (b === OVRIGA_NYCKEL) || Number(a) - Number(b));
}

/**
 * Elevens årskurs: klasserna där eleven har Matchdagen (`har(klass, uid)`), den lägsta
 * årskursen (en siffra går före "Övriga"). null utan någon sådan klass.
 */
export function elevArskurs(klasser, uid, har) {
  const nycklar = (Array.isArray(klasser) ? klasser : []).filter((k) => har(k, uid)).map((k) => akNyckel(arskursAvKlass(k?.name)));
  return nycklar.length ? sorteraNycklar(nycklar)[0] : null;
}

const heltal = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

/** Bästa divisionen: den nuvarande, säsongshistoriken, och Superligan för en legendklubb. */
export function bastaDiv(K) {
  let d = heltal(K?.div) ?? 0;
  for (const s of Array.isArray(K?.sasonger) ? K.sasonger : []) {
    const sd = heltal(s?.div);
    if (sd != null && sd > d) d = sd;
  }
  if ((heltal(K?.klubb?.legendStjarnor) ?? 0) > 0) d = TOPP_DIV;
  return Math.min(d, TOPP_DIV);
}

/** En säsong i division k är LAGANTAL[k] − 1 omgångar, + kvalmatchen = LAGANTAL[k] matcher per uppflyttning. */
export function minMatcherTill(div) {
  let n = 0;
  for (let k = 0; k < Math.min(div, TOPP_DIV); k++) n += LAGANTAL[k];
  return n;
}

/**
 * Hänger talen ihop? Inga omöjliga hopp: varje uppflyttning kräver en hel säsong och ett kval,
 * så divisionen kräver ett minsta antal matcher och säsonger. Vunna + oavgjorda + förlorade =
 * matcherna, rimligt många mål per match, rätt ≤ frågor, högst TOPPLISTA.maxMatcherDag matcher en dag
 * och dagarnas matcher ≤ alla matcher.
 */
export function rimligKarriar(K) {
  const nej = (skal) => ({ ok: false, skal });
  if (!K || typeof K !== "object") return nej("ingen karriär");
  const s = K.summa;
  if (!s || typeof s !== "object") return nej("ingen summa");
  const [m, v, o, f, g, i, fr, r] = ["matcher", "v", "o", "f", "gjorda", "inslappta", "fragor", "ratt"].map((k) => heltal(s[k]));
  if ([m, v, o, f, g, i, fr, r].includes(null)) return nej("summan är inte heltal");
  if (v + o + f !== m) return nej("vunna + oavgjorda + förlorade ≠ matcher");
  if (g > m * TOPPLISTA.maxMalMatch || i > m * TOPPLISTA.maxMalMatch) return nej("för många mål");
  if (r > fr) return nej("fler rätt än frågor");
  if (m > 0 && fr < m) return nej("färre frågor än matcher");
  const div = heltal(K.div);
  if (div == null || div > TOPP_DIV) return nej("okänd division");
  const ls = heltal(K.klubb?.legendStjarnor ?? 0);
  if (ls == null || ls > TOPPLISTA.maxLegend) return nej("okända legendstjärnor");
  const basta = bastaDiv(K);
  // Uppflyttningar totalt: den nuvarande klubbens + 7 per legendklubb (tidigare klubbar tog sig hela vägen).
  const upp = div + ls * TOPP_DIV;
  if (m < minMatcherTill(div) + ls * minMatcherTill(TOPP_DIV) || m < minMatcherTill(basta)) return nej("för få matcher för divisionen");
  const sasong = heltal(K.sasong);
  // Efter ett vunnet kval står div redan på nästa division medan säsongen är densamma (nySasong räknar upp).
  if (sasong == null || sasong < 1 || sasong < upp) return nej("för få säsonger för divisionen");
  let dagM = 0;
  for (const d of Object.values(K.dagar && typeof K.dagar === "object" ? K.dagar : {})) {
    const dm = heltal(d?.m);
    if (dm == null || dm > TOPPLISTA.maxMatcherDag) return nej("för många matcher en dag");
    dagM += dm;
  }
  if (dagM > m) return nej("fler matcher i dagarna än totalt");
  return { ok: true, skal: "" };
}

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Topplistans rad för en (rimlig) karriär. namn = elevens visningsnamn, klass = klassens namn. */
export function radFor(uid, K, { namn = "", klass = "" } = {}) {
  const s = K.summa;
  return {
    uid,
    n: text(namn, 40) || "Elev",
    lag: text(K.klubb?.namn, 24),
    f: /^#[0-9a-fA-F]{6}$/.test(String(K.klubb?.farg || "")) ? K.klubb.farg : "#888888",
    k: text(klass, 20),
    d: bastaDiv(K),
    ls: heltal(K.klubb?.legendStjarnor ?? 0) ?? 0,
    v: s.v,
    gm: s.gjorda,
    im: s.inslappta,
    m: s.matcher,
  };
}

/** Jämförelsen: division, legendstjärnor, vinster, målskillnad (högst först). 0 = delad plats. */
export function jamfor(a, b) {
  return (b.d - a.d) || (b.ls - a.ls) || (b.v - a.v) || ((b.gm - b.im) - (a.gm - a.im));
}

/** Sortera och ge plats (delad vid lika). Högst TAK rader, bara plats ≤ TOPP. Inom en delad plats: namnet. */
export function rangordna(rader) {
  const lista = [...rader].sort((a, b) => jamfor(a, b) || a.n.localeCompare(b.n, "sv") || (a.uid < b.uid ? -1 : 1));
  const ut = [];
  for (let i = 0; i < lista.length && ut.length < TAK; i++) {
    const plats = i > 0 && jamfor(lista[i - 1], lista[i]) === 0 ? ut[i - 1].plats : i + 1;
    if (plats > TOPP) break;
    ut.push({ ...lista[i], plats });
  }
  return ut;
}

/**
 * Alla årskursers topplistor. elever = [{ uid, K, namn, klass, ak }] (ak = årskursnyckel).
 * En karriär som inte är rimlig, eller utan klubb eller matcher, kommer inte med.
 */
export function byggTopplistor(elever) {
  const per = new Map();
  const antal = {};
  let uteslutna = 0;
  for (const e of Array.isArray(elever) ? elever : []) {
    if (!e?.ak || !e.K?.klubb) continue;
    if (!rimligKarriar(e.K).ok) { uteslutna++; continue; }
    if (!e.K.summa.matcher) continue;
    if (!per.has(e.ak)) per.set(e.ak, []);
    per.get(e.ak).push(radFor(e.uid, e.K, e));
    antal[e.ak] = (antal[e.ak] || 0) + 1;
  }
  const arskurser = {};
  for (const n of sorteraNycklar(per.keys())) arskurser[n] = rangordna(per.get(n));
  return { arskurser, antal, uteslutna };
}

/** Divisionens namn för raden. */
export const divNamn = (d) => DIVISIONER[Math.min(Math.max(Number(d) || 0, 0), TOPP_DIV)];
