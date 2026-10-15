// ============================================================================
// 26. Sortera bråk i ordning (src/brakresan/utmaningar/u26.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 26: fyra bråkkort ordnas från minst till störst (order) – dra, eller
// klicka och flytta med knappar/pilar. EN poäng för en komplett korrekt
// ordning, aldrig per kort.
//   • fyra OLIKA värden mellan 0 och 1, nämnare 2–12, gemensam nämnare ≤ 24
//   • intro: stambråk och nämnare som är multiplar (1/4 < 1/3 < 1/2 < 3/4)
//   • överföring: värden på båda sidor om en halv och nära varandra
// Jämförelsestavar under korten syns bara medan hjälpen är öppen
// (view.stavar, samma mekanism som 12) – frivilliga och utan facitetikett.
// Genomgången placerar korten på en gemensam tallinje i ord.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, cmp, lcm, valueKey } from "../math/index.js";

const MAX_L = 24;
const ALLA = [];
for (let d = 2; d <= 12; d++) for (let n = 1; n < d; n++) ALLA.push({ n, d });

const text = (c) => `${c.n}/${c.d}`;
const varde = (c) => q(c.n, c.d);
const sortera = (lista) => [...lista].sort((x, y) => cmp(varde(x), varde(y)));

/** Fyra kort med olika värden och gemensam nämnare ≤ 24, ur en pool. */
function valj(rng, pool, krav = () => true) {
  for (let f = 0; f < 200; f++) {
    const kort = rng.sample(pool, 4);
    if (new Set(kort.map((c) => valueKey(varde(c)))).size < 4) continue;
    if (kort.reduce((L, c) => lcm(L, c.d), 1) > MAX_L) continue;
    if (!krav(kort)) continue;
    return kort;
  }
  return [{ n: 1, d: 4 }, { n: 1, d: 3 }, { n: 1, d: 2 }, { n: 3, d: 4 }];
}

export default defineChallenge({
  id: "26",
  version: 1,

  generate(rng, { slot }) {
    let kort;
    if (slot === "intro") {
      const familj = rng.pick([[2, 4, 8], [2, 3, 6], [2, 4, 12], [3, 6, 12], [2, 5, 10], [2, 3, 12]]);
      kort = valj(rng, ALLA.filter((c) => familj.includes(c.d) && (c.n === 1 || c.n === c.d - 1)));
    } else if (slot === "overforing") {
      const halv = q(1, 2);
      kort = valj(rng, ALLA.filter((c) => c.d >= 3), (k) => k.some((c) => cmp(varde(c), halv) < 0) && k.some((c) => cmp(varde(c), halv) > 0) &&
        Math.abs(k[0].n / k[0].d - k[1].n / k[1].d) < 0.3);
    } else kort = valj(rng, ALLA);
    return { kort: kort.map(({ n, d }) => ({ n, d })) };
  },

  core: ({ kort }) => sortera(kort).map(text).join("<"),

  build({ kort }) {
    const cards = kort.map((c, i) => ({ id: `k${i + 1}`, face: { kind: "fraction", n: c.n, d: c.d } }));
    const idAv = (c) => cards[kort.indexOf(c)].id;
    const ordnade = sortera(kort);
    const ratt = ordnade.map(idAv);
    const L = kort.reduce((acc, c) => lcm(acc, c.d), 1);
    // Missuppfattningar: ordnat efter nämnaren (större nämnare = större), efter täljaren, omvänt.
    const efter = (f) => [...kort].sort((x, y) => f(x) - f(y) || x.n * y.d - y.n * x.d).map(idAv);
    const wrong = [[...ratt].reverse(), efter((c) => c.d), efter((c) => c.n)]
      .filter((ids) => ids.join() !== ratt.join())
      .map((ids) => ({ ids }));
    const omskrivna = ordnade.map((c) => `${text(c)} = ${(c.n * L) / c.d}/${L}`).join(", ");
    const ex = kort.some((c) => c.d === 5) ? [[1, 6], [1, 2], [2, 3]] : [[1, 5], [1, 2], [4, 5]];
    return {
      core: ordnade.map(text).join("<"),
      prompt: "Ordna bråken från minst till störst.",
      values: { cards: Object.fromEntries(cards.map((c, i) => [c.id, varde(kort[i])])), lcd: L },
      view: { component: "sortering", cards, order: true, ends: ["Minst", "Störst"], stavar: true },
      answer: { type: "order", count: 4 },
      key: {
        type: "order",
        values: Object.fromEntries(cards.map((c, i) => [c.id, { n: kort[i].n, d: kort[i].d }])),
        display: ordnade.map(text).join(" < "),
        examples: { right: [{ ids: ratt }], wrong },
      },
      help: [
        { step: "orientering", text: "Alla bråken gäller samma sorts helhet. Börja med att hitta det minsta." },
        { step: "princip", text: "Vilka ligger på varsin sida om en halv? Jämför sedan dem som ligger på samma sida – med lika stora bitar om det behövs.", highlight: { stavar: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.map(([n, d]) => `${n}/${d}`).join(", ")}. ${ex[0][0]}/${ex[0][1]} är mindre än en halv och ${ex[2][0]}/${ex[2][1]} är mer. ` +
            `Ordningen blir ${ex.map(([n, d]) => `${n}/${d}`).join(" < ")}.`,
          view: { component: "stav", bars: ex.map(([n, d]) => ({ parts: d, marked: n })) },
          highlight: { stavar: true },
        },
        { step: "atergang", text: "Nu provar du själv: lägg det minsta kortet först och fortsätt ett kort i taget.", highlight: { stavar: true } },
      ],
      misconceptions: ["storre-namnare-storre", "storre-taljare-storre"],
      feedback: {
        correct: `Ja! ${ordnade.map(text).join(" < ")}.`,
        wrong: "Jämför bråken med lika stora bitar, eller med en halv. Ett större tal i nämnaren betyder mindre bitar.",
      },
      review: `På en gemensam tallinje från 0 till 1: ${omskrivna}. Ordningen blir ${ordnade.map(text).join(" < ")}.`,
    };
  },

  reserve: [
    [[1, 4], [1, 3], [1, 2], [3, 4]],
    [[1, 6], [2, 3], [1, 2], [5, 6]],
    [[3, 8], [1, 4], [7, 8], [1, 2]],
    [[2, 5], [1, 10], [7, 10], [1, 2]],
    [[5, 12], [1, 3], [3, 4], [1, 6]],
    [[2, 3], [3, 4], [1, 6], [5, 12]],
    [[3, 5], [1, 2], [3, 10], [4, 5]],
    [[5, 8], [3, 4], [1, 3], [1, 6]],
    [[1, 8], [5, 6], [2, 3], [3, 8]],
    [[7, 12], [1, 4], [2, 3], [1, 2]],
    [[4, 9], [1, 3], [5, 6], [2, 9]],
  ].map((k) => ({ params: { kort: k.map(([n, d]) => ({ n, d })) } })),
});
