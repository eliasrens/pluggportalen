// ============================================================================
// Ekvationsresan – vågens visning och teman (src/ekvationsresan/vag-visning.js)
// ----------------------------------------------------------------------------
// #617, spec E1.5. Ren logik (ingen DOM). Väljer AUTOMATISKT hur vågen ritas:
//
//   "foremal"     alla tal under lösningen är heltal ≤ 20 (x − 3 räknas som
//                 "ta bort 3"), x högst 5 gånger, x bara i ett led, lösningen
//                 och båda ledens värden positiva → behållare + föremål
//   "block"       tal upp till ca 100 → x-block och talbrickor med siffror
//                 (även x i båda leden och minustal – "skuld"-brickor, Etapp 2)
//   "stiliserad"  ännu större tal → stiliserad våg med uttrycken som etiketter
//
// "Under lösningen" = startekvationen OCH varje tillstånd längs den optimala
// vägen (x/4 = 6 är litet men slutar i x = 24). En uppgift får EN grundvisning
// (taskView); ett tillstånd som kräver mer abstraktion (eleven gör +50) lyfter
// visningen tillfälligt (viewDuring) – vågen motsvarar alltid ekvationen exakt.
// ============================================================================

import { coefOf, solve, evaluateSide, fromJSON, term } from "./equation.js";
import { q, isInteger, isDecimal, isNegative, isZero } from "./rational.js";
import { applyOperation } from "./operations.js";

export const VIEWS = Object.freeze(["foremal", "block", "stiliserad"]);
const RANK = Object.freeze({ foremal: 0, block: 1, stiliserad: 2 });

/** Gränserna i tabellen i E1.5 – finjusteras här. */
export const VIEW_LIMITS = Object.freeze({
  foremalMax: 20, //  största tal (belopp) som ritas som föremål
  foremalMaxX: 5, //  högst så många behållare totalt
  blockMax: 100, //   största tal (belopp) på en talbricka
});

/** Den mer abstrakta av två visningar. */
export const moreAbstract = (a, b) => (RANK[a] >= RANK[b] ? a : b);

const value = (c) => Math.abs(c.n) / c.d;

/** Visningen för ETT tillstånd. */
export function viewForEquation(eq) {
  const terms = [...eq.left, ...eq.right];
  const sol = solve(eq);
  const coefs = terms.map(coefOf);
  const all = sol ? [...coefs, sol] : coefs;
  const max = Math.max(0, ...all.map(value));
  const xTerms = terms.filter((t) => t.x);
  const xSides = [eq.left, eq.right].filter((s) => s.some((t) => t.x)).length;
  const xCount = xTerms.reduce((s, t) => s + value(coefOf(t)), 0);
  const sidesPositive = !sol || [eq.left, eq.right].every((s) => !isNegative(evaluateSide(s, sol)));

  const foremal =
    all.every(isInteger) &&
    max <= VIEW_LIMITS.foremalMax &&
    xCount <= VIEW_LIMITS.foremalMaxX &&
    xSides <= 1 &&
    xTerms.every((t) => t.n > 0) &&
    (!sol || (sol.n > 0 && !isZero(sol))) &&
    sidesPositive;
  if (foremal) return "foremal";
  // Talbrickor visar heltal och korta decimaler (2,5); x/4 blir ett bråkblock.
  const showable = terms.every((t) => t.x || isDecimal(coefOf(t)));
  if (showable && max <= VIEW_LIMITS.blockMax) return "block";
  return "stiliserad";
}

/** Den mest abstrakta visningen som behövs för en följd tillstånd. */
export function chooseView(states) {
  return states.reduce((v, eq) => moreAbstract(v, viewForEquation(eq)), "foremal");
}

/** Tillstånden längs en väg [{op, value}] från eq (spärrade steg hoppas över). */
export function statesAlong(eq, path = [], rules) {
  const out = [eq];
  let cur = eq;
  for (const m of path) {
    const r = applyOperation(cur, m.op, term(q(m.value), 0), rules);
    if (!r.ok) break;
    cur = r.after;
    out.push(cur);
  }
  return out;
}

/** Grundvisningen för en uppgift (generatorns task eller en ekvation). */
export function taskView(task) {
  if (task.display && VIEWS.includes(task.display)) return task.display;
  const eq = task.equation ? fromJSON(task.equation) : task;
  return chooseView(statesAlong(eq, task.optimalPath || []));
}

/** Visningen just nu: aldrig mindre abstrakt än uppgiftens grundvisning. */
export const viewDuring = (base, eq) => moreAbstract(base || "foremal", viewForEquation(eq));

// --- teman (tidiga nivåer) ----------------------------------------------------

/** x är ALLTID en behållare med okänt innehåll. */
export const THEMES = Object.freeze([
  { id: "spargris", container: "spargris", item: "mynt", name: "Spargris och mynt" },
  { id: "sack", container: "sack", item: "present", name: "Säck och presenter" },
  { id: "korg", container: "korg", item: "apple", name: "Korg och äpplen" },
  { id: "burk", container: "burk", item: "kula", name: "Burk och kulor" },
  { id: "paket", container: "paket", item: "smasak", name: "Paket och småsaker" },
]);

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

/** Stabilt tema per uppgift (samma uppgift → samma tema, olika uppgifter varierar). */
export function themeFor(task) {
  const key = String(task?.key ?? task ?? "");
  let h = 0;
  for (const ch of key) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return THEMES[Math.abs(h) % THEMES.length];
}
