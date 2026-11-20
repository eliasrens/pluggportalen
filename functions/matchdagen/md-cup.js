// ============================================================================
// Matchdagen (#872, Etapp 2c): SILVERPOKALEN – ren (spec §9.1). Ingen DOM, ingen
// Firebase, ingen klocka. En utslagsturnering per säsong i fyra rundor
// (sextondel, kvart, semi, final) som spelas MELLAN ligaomgångarna: med 5
// omgångar efter omgång 1, 2, 3 och 4, och lika jämnt med fler (cupSchema).
// Motståndarna lottas från divisioner inom ±2 (också högre – skrällar ska vara
// möjliga), oavgjort → straffar, förlust → ute för säsongen, finalvinst →
// pokalen och CUP.seger × multiplikatorn. Cupen flyttar aldrig laget (div).
//
// K.cup är EN rad text (reglerna prövar den med ett reguljärt uttryck):
//   "säsong-spelade" (vidare, "3-2") · "säsong-spelade-u" (utslagna i den rundan, "3-2-u")
//   – "säsong-4" = cupen vunnen. Saknas fältet, eller gäller det en annan säsong: ingen runda spelad.
//
//   cupSchema(antal)                  → [omgång, …] ligaomgångarna som varje runda spelas efter
//   cupLage(K)                        → { spelade, ute, vann }
//   cupLottning(K, uid)               → fyra motståndare { id, namn, farg, div, styrka } (samma vid omladdning)
//   cupMatch(K, uid)                  → { runda, namn, mot } | null   (en cupmatch väntar nu)
//   cupKlar(K, { res, nu, matchId, uid, kallNamn?, rng? })
//                                     → { K, match, pengar, vann, vannCupen, runda, rekord }
// ============================================================================

import * as C from "./md-config.js";
import { kl } from "./md-motor.js";
import { styrkaFor } from "./md-liga.js";
import { LAGFARGER, MOTSTANDARE } from "./md-namn.js";
import { skapaPrng } from "./md-prng.js";
import { bokforMatch } from "./md-sasong.js";
import { nyMarknad } from "./md-trupp.js";

export const CUP_RUNDOR = C.CUP.rundor.length;
const kopia = (v) => JSON.parse(JSON.stringify(v));

/**
 * Ligaomgångarna som cupens rundor spelas efter: ligans omgångar delas i fem jämna bitar
 * (före, mellan rundorna och efter) – 5 → 1, 2, 3, 4 · 7 → 1, 3, 4, 6 · 9 → 2, 4, 5, 7 · 11 → 2, 4, 7, 9.
 * Finalen spelas alltid före sista ligaomgången.
 */
export function cupSchema(antal) {
  const n = Number(antal) || 0;
  return Array.from({ length: CUP_RUNDOR }, (_, i) => kl(Math.round(((i + 1) * n) / (CUP_RUNDOR + 1)), 1, Math.max(1, n - 1)));
}

/** Cupen den här säsongen: spelade rundor, utslagna, vunnen. */
export function cupLage(K) {
  const [, sasong, sp, u] = /^(\d+)-(\d)(-u)?$/.exec(String(K?.cup ?? "")) || [];
  const spelade = Number(sp) || 0;
  if (Number(sasong) !== Number(K?.sasong) || spelade < 1 || spelade > CUP_RUNDOR) return { spelade: 0, ute: false, vann: false };
  return { spelade, ute: !!u, vann: !u && spelade >= CUP_RUNDOR };
}

/** Fröet för säsongens lottning: samma klubb, säsong och division ger samma motståndare. */
export const cupFro = (K, uid = "") => `${uid}|${K.sasong}|${K.div}|cup`;

function blanda(rng, lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Säsongens fyra motståndare: lag som inte är med i ligan, var och en från en division inom
 * ±CUP.spridning (aldrig under Division 6 eller över Superligan), de svagaste först – finalen
 * är oftast tuffast. Styrkan är divisionens (styrkaFor), så ett lag från en högre division är
 * starkare – men det går att slå.
 */
export function cupLottning(K, uid = "") {
  const rng = skapaPrng(cupFro(K, uid)).tal;
  const div = Number(K.div) || 0;
  const tagna = new Set((K.liga?.lag || []).map((l) => l.namn));
  const namn = blanda(rng, MOTSTANDARE.filter((n) => !tagna.has(n))).slice(0, CUP_RUNDOR);
  const sp = C.CUP.spridning;
  const divs = namn.map(() => kl(div - sp + Math.floor(rng() * (2 * sp + 1)), 0, C.TOPP_DIV)).sort((a, b) => a - b);
  const farger = blanda(rng, LAGFARGER.filter((f) => f !== K.klubb?.farg));
  return namn.map((n, i) => ({
    id: "cup", namn: n, farg: farger[i % farger.length], div: divs[i],
    styrka: Math.round(styrkaFor(divs[i], rng) * 1000) / 1000,
  }));
}

/** Väntar en cupmatch nu? Efter ligaomgången i cupSchema, så länge laget är kvar och ligan inte är slut. */
export function cupMatch(K, uid = "") {
  if (!K?.liga?.schema) return null;
  const L = cupLage(K);
  if (L.ute || L.vann) return null;
  const antal = K.liga.schema.length;
  const omg = Number(K.liga.omg) || 0;
  if (omg >= antal || omg < cupSchema(antal)[L.spelade]) return null;
  return { runda: L.spelade, namn: C.CUP.rundor[L.spelade], mot: cupLottning(K, uid)[L.spelade] };
}

/** Gick vi vidare? res.vann ur motorn (straffarna inräknade) – annars målen. */
function vidare(res) {
  if (typeof res.vann === "boolean") return res.vann;
  if (res.oss === res.dem) throw new Error("cupKlar: oavgjord cupmatch utan straffar");
  return res.oss > res.dem;
}

/**
 * Cupmatchen är spelad. Ändrar inte K. Bokförs som en match (kassa, summa, senaste, dagar,
 * rekord; matchdokumentet med typ "cup" och omg = rundan 1–4). Vinst → nästa runda, i finalen
 * pokalen och prispengarna. Förlust → ute för säsongen. Divisionen ändras aldrig.
 */
export function cupKlar(K0, { res, nu, matchId, uid = "", kallNamn = {}, rng = null }) {
  const cm = cupMatch(K0, uid);
  if (!cm) throw new Error("cupKlar: ingen cupmatch att spela");
  const vann = vidare(res);
  const K = kopia(K0);
  const runda = cm.runda + 1;
  const vannCupen = vann && runda >= CUP_RUNDOR;
  const extraPengar = vannCupen ? Math.round(C.CUP.seger * (1 + (Number(K.div) || 0) * C.KASSA.perDiv)) : 0;
  const { match, pengar, dag, rekord } = bokforMatch(K, { res, nu, matchId, kallNamn, mot: cm.mot.namn, typ: "cup", omg: runda, extraPengar });
  K.cup = `${K.sasong}-${runda}${vann ? "" : "-u"}`;
  if (vannCupen) K.pokaler = [...(K.pokaler || []), { typ: "cup", namn: C.CUP.namn, sasong: K.sasong, datum: dag }];
  if (rng) K.marknad = nyMarknad(K, rng); // nya spelare efter varje match (§8.3)
  return { K, match, pengar, vann, vannCupen, runda: cm.runda, rekord };
}
