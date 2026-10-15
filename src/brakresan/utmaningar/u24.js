// ============================================================================
// 24. Mer eller mindre än en halv? (src/brakresan/utmaningar/u24.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 24: en halv som referens. Sex bråkkort sorteras i facken "Mindre än
// 1/2", "Lika med 1/2" och "Större än 1/2" (categories, ordning inom fack fri).
//   • bråk mellan 0 och 1, nämnare 2–12, sex OLIKA kort
//   • minst ett kort i varje fack; "lika"-korten är förlängningar av 1/2
//     (2/4, 5/10 …) – samma gränsvärde
//   • intro: nämnare ≤ 8 och tydligt avstånd till en halv; överföring: kort
//     nära en halv (5/12, 4/7 …)
//   • facken visar aldrig rätt svar före kontroll (sorteringsytan)
// Efter kontroll (genomgången) visas 2·täljaren mot nämnaren för varje kort –
// bildförståelsen kommer först: hjälpen jämför med en stav där hälften är
// markerad, med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { relation } from "../math/index.js";
import { q } from "../math/rational.js";

const FACK = [
  { id: "mindre", label: "Mindre än 1/2" },
  { id: "lika", label: "Lika med 1/2" },
  { id: "storre", label: "Större än 1/2" },
];
const KAT = { "<": "mindre", "=": "lika", ">": "storre" };

/** Alla kort n/d, 1 ≤ n < d, d = 2–12, med sitt fack. */
const ALLA = [];
for (let d = 2; d <= 12; d++) for (let n = 1; n < d; n++) ALLA.push({ n, d, fack: KAT[relation(q(n, d), q(1, 2))] });
/** Avstånd till en halv i "tolftedels-steg" ungefär: |2n − d| / d. */
const avstand = (c) => Math.abs(2 * c.n - c.d) / c.d;

const kortText = (c) => `${c.n}/${c.d}`;

export default defineChallenge({
  id: "24",
  version: 1,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? ALLA.filter((c) => c.d <= 8 && (c.fack === "lika" || avstand(c) >= 0.25))
      : slot === "overforing" ? ALLA.filter((c) => c.fack === "lika" || avstand(c) <= 0.25)
        : ALLA;
    const lika = rng.int(1, 2);
    const mindre = rng.int(lika === 1 ? 2 : 1, 3); // större får 1–3 kort
    const antal = { lika, mindre, storre: 6 - lika - mindre };
    const kort = [];
    for (const [fack, k] of Object.entries(antal)) kort.push(...rng.sample(pool.filter((c) => c.fack === fack), k));
    return { kort: rng.shuffle(kort).map(({ n, d }) => ({ n, d })) };
  },

  core: ({ kort }) => kort.map(kortText).sort().join(","),

  build({ kort }) {
    const cards = kort.map((c, i) => ({ id: `k${i + 1}`, face: { kind: "fraction", n: c.n, d: c.d } }));
    const fack = Object.fromEntries(cards.map((c, i) => [c.id, KAT[relation(q(kort[i].n, kort[i].d), q(1, 2))]]));
    const bins = Object.fromEntries(FACK.map((f) => [f.id, cards.filter((c) => fack[c.id] === f.id).map((c) => c.id)]));
    const lista = (id) => kort.filter((_, i) => fack[cards[i].id] === id).map(kortText).join(", ");
    // Felexempel: ett kort i fel fack; alla "lika"-kort som "större" (större tal = större bråk).
    const flytta = (id, till) => ({ bins: Object.fromEntries(FACK.map((f) => [f.id, [...bins[f.id].filter((x) => x !== id), ...(f.id === till ? [id] : [])]])) });
    const ettMindre = bins.mindre[0];
    const ettLika = bins.lika[0];
    const ettStorre = bins.storre[0];
    // Exemplet i hjälpen: en nämnare som inget kort har.
    const exD = [7, 9, 11, 5, 3].find((d) => !kort.some((c) => c.d === d)) || 7;
    const exN = Math.floor(exD / 2) + 1;
    const tvaGanger = kort.map((c) => `${c.n}/${c.d}: 2 · ${c.n} = ${2 * c.n} ${2 * c.n < c.d ? "<" : 2 * c.n === c.d ? "=" : ">"} ${c.d}`).join(" · ");
    return {
      core: kort.map(kortText).sort().join(","),
      prompt: "Sortera korten: är bråket mindre än, lika med eller större än en halv?",
      values: { cards: Object.fromEntries(cards.map((c, i) => [c.id, q(kort[i].n, kort[i].d)])) },
      view: { component: "sortering", cards, bins: FACK },
      answer: { type: "categories", bins: FACK.map((f) => f.id) },
      key: {
        type: "categories",
        bins: fack,
        display: `Mindre än 1/2: ${lista("mindre")}. Lika med 1/2: ${lista("lika")}. Större än 1/2: ${lista("storre")}.`,
        examples: {
          right: [{ bins }],
          wrong: [flytta(ettMindre, "storre"), flytta(ettLika, "storre"), flytta(ettStorre, "lika")],
        },
      },
      help: [
        { step: "orientering", text: "Alla korten gäller samma sorts helhet. Jämför varje bråk med en halv: hälften av helheten." },
        { step: "princip", text: "Hur många delar skulle vara hälften? Av 10 delar är 5 hälften, så 5/10 är precis en halv. Fler delar än hälften – större än en halv." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${exN}/${exD}. Hälften av ${exD} delar är ${exD / 2 % 1 ? `${Math.floor(exD / 2)} och en halv` : exD / 2} delar. ` +
            `${exN} delar är mer än så, alltså är ${exN}/${exD} större än en halv. Den övre staven visar en halv.`,
          view: { component: "stav", bars: [{ parts: 2, marked: 1 }, { parts: exD, marked: exN }] },
        },
        { step: "atergang", text: "Nu provar du själv: ta ett kort i taget. Är täljaren mindre än, lika med eller mer än hälften av nämnaren?" },
      ],
      misconceptions: ["storre-tal-storre-brak", "halften-av-namnaren", "lika-med-halv-missas"],
      feedback: {
        correct: "Ja! Du jämförde varje bråk med en halv.",
        wrong: "Jämför täljaren med hälften av nämnaren: är det färre, lika många eller fler delar än hälften?",
      },
      review: `Jämför 2 · täljaren med nämnaren: ${tvaGanger}.`,
    };
  },

  reserve: [
    [[1, 4], [2, 4], [5, 6], [1, 3], [3, 4], [4, 8]],
    [[3, 8], [5, 10], [2, 3], [1, 5], [7, 8], [2, 6]],
    [[1, 6], [3, 6], [4, 5], [2, 7], [5, 9], [1, 2]],
    [[5, 12], [6, 12], [7, 12], [1, 8], [3, 5], [4, 6]],
    [[2, 5], [4, 7], [3, 10], [2, 4], [9, 10], [5, 8]],
    [[3, 7], [5, 9], [6, 12], [1, 10], [5, 6], [2, 9]],
    [[4, 10], [3, 6], [6, 10], [1, 3], [7, 9], [3, 11]],
    [[1, 2], [5, 11], [6, 11], [2, 8], [3, 4], [4, 9]],
    [[4, 12], [8, 12], [2, 4], [3, 5], [2, 10], [7, 10]],
    [[1, 7], [6, 7], [4, 8], [3, 9], [5, 7], [2, 12]],
    [[5, 10], [4, 11], [9, 12], [2, 5], [7, 11], [1, 9]],
  ].map((k) => ({ params: { kort: k.map(([n, d]) => ({ n, d })) } })),
});
