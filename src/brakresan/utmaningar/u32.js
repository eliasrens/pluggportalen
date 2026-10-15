// ============================================================================
// 32. Subtrahera lika nämnare (src/brakresan/utmaningar/u32.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 32: ta bort delar av samma storlek. Staven visar a/n färgat; eleven
// klickar bort b färgade delar (de tonas och får streckad kontur – helhets-
// ramen och delningen finns kvar) och skriver vad som är kvar. EN uppgift med
// två delar (multi): borttagningen (b delar) och resten.
//   • n = 3–12, 1 ≤ b ≤ a ≤ n, aldrig negativt
//   • minst en uppgift per omgång ger 0 (slot "noll": b = a) – svaret 0/n
//   • resten: rätt värde räcker (likvärdigt bråk godtas)
// Efter svaret förklaras att antalet delar ändras, inte hur helheten är delad.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { fractionWords, partName } from "../math/words.js";
import { brak, falt, ids, NUMBER_FRACTION, talNyckel } from "./f-delat.js";

const SLOTS = ["intro", "intro", "intro", "normal", "normal", "noll", "normal", "normal", "overforing", "overforing"];
const ALLA = [];
for (let n = 3; n <= 12; n++) for (let a = 1; a <= n; a++) for (let b = 1; b <= a; b++) ALLA.push({ n, a, b });

const VARDAG = [
  { id: "pizza", text: (x, y) => `Det finns ${x} av en pizza kvar. Leo äter ${y} av pizzan. Hur mycket av pizzan finns kvar sedan?` },
  { id: "saft", text: (x, y) => `En flaska är fylld till ${x}. Mira dricker ${y} av flaskan. Hur mycket finns kvar?` },
  { id: "band", text: (x, y) => `Ett band är målat till ${x}. Regnet tvättar bort ${y} av bandet. Hur stor del är fortfarande målad?` },
];

export default defineChallenge({
  id: "32",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot === "noll") {
      const { n, a } = rng.pick(ALLA.filter((x) => x.a === x.b && x.a < x.n));
      return { n, a, b: a };
    }
    const pool = slot === "intro" ? ALLA.filter((x) => x.n <= 8 && x.b < x.a) : ALLA.filter((x) => x.b < x.a);
    const { n, a, b } = rng.pick(pool);
    return slot === "overforing" ? { n, a, b, vardag: rng.pick(VARDAG).id } : { n, a, b };
  },

  core: ({ n, a, b }) => `${a}-${b}/${n}`,

  build({ n, a, b, vardag = null }) {
    const r = a - b;
    const R = q(r, n);
    const v = VARDAG.find((x) => x.id === vardag);
    const markerade = ids(a);
    const del = partName(n);
    const ex = n === 6 ? { n: 5, a: 4, b: 3 } : { n: 6, a: 5, b: 2 };
    const right = [
      { parts: { bort: { selected: markerade.slice(0, b) }, kvar: falt(r, n) } },
      { parts: { bort: { selected: markerade.slice(a - b) }, kvar: falt(r, n) } },
    ];
    if (r > 0 && R.d !== n) right.push({ parts: { bort: { selected: markerade.slice(0, b) }, kvar: falt(R.n, R.d) } });
    const wrong = [
      { parts: { bort: { selected: markerade.slice(0, b) }, kvar: falt(b === r ? r + 1 : b, n) } }, //   skriver det borttagna
      { parts: { bort: { selected: markerade.slice(0, b) }, kvar: falt(a + b <= 2 * n ? a + b : r + 1, n) } }, // adderar
      ...(b > 1 ? [{ parts: { bort: { selected: markerade.slice(0, b - 1) }, kvar: falt(r, n) } }] : []), // tog bort för få
      ...(r > 0 && n - b >= 2 ? [{ parts: { bort: { selected: markerade.slice(0, b) }, kvar: falt(r, n - b) } }] : []), // ändrar nämnaren
    ];
    return {
      core: `${a}-${b}/${n}`,
      prompt: (v ? v.text(`${a}/${n}`, `${b}/${n}`) : `Räkna ut ${a}/${n} − ${b}/${n}.`) + ` Klicka bort ${b} ${b === 1 ? "färgad del" : "färgade delar"} och skriv vad som är kvar.`,
      values: { start: q(a, n), bort: q(b, n), rest: { n: R.n, d: R.d }, n },
      view: {
        component: "verkstad",
        stavar: [{ id: "bort", parts: n, marked: a, namn: brak(a, n), helhet: "Hela staven = 1", verktyg: ["bort"] }],
        expr: [brak(a, n), { op: "−" }, brak(b, n), { op: "=" }, { input: "kvar" }],
      },
      answer: { type: "multi", parts: { bort: { type: "paint", parts: markerade }, kvar: NUMBER_FRACTION } },
      key: {
        type: "multi",
        parts: { bort: { type: "paint", count: b }, kvar: talNyckel(R) },
        display: `${a}/${n} − ${b}/${n} = ${r}/${n}`,
        examples: { right, wrong },
      },
      help: [
        { step: "orientering", text: `Hela staven = 1, delad i ${n} lika stora delar. ${a === n ? "Alla" : `${a} av dem`} är färgade.`, highlight: { whole: true } },
        { step: "princip", text: `Vilken storlek har delarna som tas bort? Det är ${del}ar – samma storlek som de färgade. Ta bort så många delar och räkna det som är kvar.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} − ${ex.b}/${ex.n}. Av ${ex.a} färgade ${partName(ex.n)}ar tas ${ex.b} bort. Kvar är ${ex.a - ex.b}/${ex.n}.`,
          view: { component: "stav", bars: [{ parts: ex.n, marked: ex.a }, { parts: ex.n, marked: ex.a - ex.b }] },
        },
        { step: "atergang", text: "Nu provar du själv: klicka bort delarna och räkna de färgade som är kvar." },
      ],
      misconceptions: ["andrar-namnaren", "adderar-i-stallet", "svarar-det-borttagna"],
      feedback: {
        correct: r === 0
          ? `Ja! Alla färgade delar togs bort, så inget är kvar: ${a}/${n} − ${b}/${n} = 0/${n} = 0.`
          : `Ja! ${a} ${del}ar minus ${b} ${del}ar är ${fractionWords(r, n)}.`,
        wrong: `Antalet färgade delar ändras när du tar bort – men helheten är fortfarande delad i ${n} lika delar, så nämnaren är densamma.`,
      },
      review: `${a}/${n} − ${b}/${n} = ${r}/${n}${r === 0 ? " = 0" : R.d !== n ? ` = ${R.n}/${R.d}` : ""}. Antalet delar ändras (${a} − ${b} = ${r}), inte hur helheten är delad.`,
    };
  },

  reserve: [
    { slot: "intro", params: { n: 8, a: 5, b: 2 } },
    { slot: "intro", params: { n: 5, a: 4, b: 1 } },
    { slot: "intro", params: { n: 6, a: 5, b: 3 } },
    { slot: "noll", params: { n: 7, a: 3, b: 3 } },
    { slot: "noll", params: { n: 10, a: 4, b: 4 } },
    { slot: "noll", params: { n: 4, a: 2, b: 2 } },
    { params: { n: 9, a: 7, b: 4 } },
    { params: { n: 12, a: 12, b: 5 } },
    { params: { n: 10, a: 9, b: 3 } },
    { slot: "overforing", params: { n: 8, a: 6, b: 4, vardag: "pizza" } },
    { slot: "overforing", params: { n: 10, a: 7, b: 2, vardag: "saft" } },
    { slot: "overforing", params: { n: 6, a: 5, b: 1, vardag: "band" } },
  ],
});
