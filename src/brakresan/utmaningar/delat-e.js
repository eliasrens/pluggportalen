// ============================================================================
// Bråkresan – hjälpfunktioner för utmaningarna 01–20 (utmaningar/delat-e.js) · #710 E
// ----------------------------------------------------------------------------
// Rena funktioner (inget rng här – generatorerna slumpar själva) som flera av
// E:s utmaningar delar: modellvyer ur ett bråk, kortlistor, ord och exempel
// med ANDRA tal till hjälpen. Synkas till functions/ som resten av mappen.
// ============================================================================

import { q, eq, valueKey } from "../math/index.js";
import { fractionWords, numberWords } from "../math/words.js";

export const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
export const stor = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;
export const ord = fractionWords;
export const tal = numberWords;

export const HELHET = {
  cirkel: { namn: "cirkeln", etikett: "Hela cirkeln = 1" },
  stav: { namn: "staven", etikett: "Hela staven = 1" },
  rutnat: { namn: "rektangeln", etikett: "Hela rektangeln = 1" },
};

/** Rutnätets form för n delar: två rader när n är jämnt och ≥ 6, annars en rad. */
export const rutor = (n) => (n % 2 === 0 && n >= 6 ? { rows: 2, cols: n / 2 } : { rows: 1, cols: n });

/**
 * En modell av a/n: cirkel, stav eller rutnät med n lika delar och a markerade.
 * `marked` kan vara en lista med index (spridda markeringar).
 */
export function modell(shape, n, marked, extra = {}) {
  const m = Array.isArray(marked) ? marked.map((i) => `p${i}`) : marked;
  const label = extra.label ?? HELHET[shape]?.etikett;
  if (shape === "cirkel") return { component: "cirkel", parts: n, marked: m, label, ...extra };
  if (shape === "stav") return { component: "stav", parts: n, marked: m, label, ...extra };
  return { component: "rutnat", ...rutor(n), marked: m, label, ...extra };
}

/** Ett bråk som kortets framsida (riktig notation). */
export const brakForm = (n, d) => ({ kind: "fraction", n, d });

/** Välj bland kandidater: värden skilda från varandra och från målet. Ordning = prioritet. */
export function skildaVarden(target, kandidater, antal) {
  const sett = new Set([valueKey(target)]);
  const ut = [];
  for (const c of kandidater) {
    if (ut.length >= antal) break;
    if (!(c.d >= 1) || !(c.n >= 0)) continue;
    const k = valueKey(q(c.n, c.d));
    if (sett.has(k)) continue;
    sett.add(k);
    ut.push(c);
  }
  return ut;
}

/** Ett annat exempelbråk (annan nämnare och annat värde) till hjälpens modellering. */
export function annatBrak(a, n, { namnare = [2, 3, 4, 5, 6, 8, 10], hel = false } = {}) {
  const m = namnare.find((x) => x !== n && x !== n * 2 && 2 * x !== n && x >= 3) ?? 3;
  let b = Math.max(1, Math.min(m - 1, a === 1 ? 2 : a - 1));
  if (hel) b = m;
  if (eq(q(b, m), q(a, n))) b = b > 1 ? b - 1 : b + 1;
  return { b, m };
}

/** Kort-id k1 … i visningsordning (avslöjar aldrig vilket kort som är rätt). */
export const kortId = (i) => `k${i + 1}`;

/** Två lika långa stavar under varandra (samma start), med bråket som rubrik – 16, 17. */
export function tvaStavar(A, B) {
  return [
    { view: { component: "stav", parts: A[1], marked: A[0], label: "Hela staven = 1" }, rubrik: brakForm(A[0], A[1]) },
    { view: { component: "stav", parts: B[1], marked: B[0], label: "Hela staven = 1" }, rubrik: brakForm(B[0], B[1]) },
  ];
}

/**
 * Jämförelse (relation) med valfri förklaring (16, 17). `forklaringar` = [{ text, ratt? }]
 * i visningsordning; utan förklaring blir svaret en enkel relation.
 * Svarar { view, answer, key } (key utan display/examples – utmaningen lägger dem).
 */
export function jamforelseUppgift({ A, B, rel, bild, forklaringar }) {
  const relDel = { view: { component: "relationsval", vanster: brakForm(A[0], A[1]), hoger: brakForm(B[0], B[1]) } };
  const delar = [...(bild ? tvaStavar(A, B) : [])];
  if (!forklaringar) {
    return {
      view: { component: "sammansatt", delar: [...delar, { ...relDel, svar: true }] },
      answer: { type: "relation" },
      key: { type: "relation", correct: rel },
      examples: { right: [{ value: rel }], wrong: ["<", "=", ">"].filter((r) => r !== rel).map((value) => ({ value })) },
    };
  }
  const cards = forklaringar.map((f, i) => ({ id: `f${i + 1}`, face: { text: f.text } }));
  const ratt = cards[forklaringar.findIndex((f) => f.ratt)].id;
  const felRel = ["<", "=", ">"].find((r) => r !== rel);
  const felF = cards.find((c) => c.id !== ratt).id;
  return {
    view: {
      component: "sammansatt",
      delar: [...delar, { ...relDel, svar: "rel" }, { view: { component: "kort", cards, lista: true }, svar: "forkl", rubrik: "Varför?", label: "Välj förklaringen" }],
    },
    answer: { type: "multi", parts: { rel: { type: "relation" }, forkl: { type: "choice", options: cards.map((c) => c.id) } } },
    key: { type: "multi", parts: { rel: { type: "relation", correct: rel }, forkl: { type: "choice", correct: ratt } } },
    examples: {
      right: [{ parts: { rel: { value: rel }, forkl: { id: ratt } } }],
      wrong: [{ parts: { rel: { value: felRel }, forkl: { id: ratt } } }, { parts: { rel: { value: rel }, forkl: { id: felF } } }],
    },
  };
}
