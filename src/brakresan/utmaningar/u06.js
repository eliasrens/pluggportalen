// ============================================================================
// 06. Hitta tre som hör ihop (src/brakresan/utmaningar/u06.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 06: se samma andel i olika modeller. Sex kort, välj de tre som
// visar lika mycket; en komplett trippel = en uppgift.
//   • enkla bråk a/n, n ∈ {2, 3, 4, 5, 6, 8}; målkorten är tre av symbol,
//     cirkel, stav, rutnät och text – med SAMMA synliga indelning (n delar),
//     ingen avancerad likvärdighet
//   • distraktorerna har samma tre korttyper (varje typ syns två gånger, så
//     typen avslöjar inget) och tre olika värden skilda från målet: fel antal
//     markerade, fel antal delar, omarkerade … – bara en trippel finns
//   • jämförbara helheter: alla bilder i samma kortstorlek, ingen färgkodning
// Hjälp: "Formen kan ändras, men hur stor del av helheten är markerad?"
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { modell, brakForm, skildaVarden, kortId, ord } from "./delat-e.js";

const NAMNARE = [2, 3, 4, 5, 6, 8];
const BAS = NAMNARE.flatMap((n) => Array.from({ length: n - 1 }, (_, i) => [i + 1, n]));
const TYPER = ["symbol", "cirkel", "stav", "rutnat", "text"];

function face(sort, n, d) {
  if (sort === "symbol") return brakForm(n, d);
  if (sort === "text") return { text: ord(n, d) };
  return modell(sort, d, n, { label: " " });
}

function kandidater(a, n) {
  return [
    { n: a + 1, d: n, tag: "fel-antal-markerade" }, { n: a - 1, d: n, tag: "fel-antal-markerade" },
    { n: a, d: n + 1, tag: "samma-antal-fler-delar" }, { n: a, d: n - 1, tag: "samma-antal-farre-delar" },
    { n: n - a, d: n, tag: "raknar-omarkerade" }, { n: a, d: n + 2, tag: "samma-antal-fler-delar" },
    { n: a + 1, d: n + 1, tag: "additiv" }, { n: 1, d: n + 1, tag: "fel-antal-delar" },
  ].filter((c) => c.n >= 1 && c.n < c.d && c.d >= 2 && c.d <= 10);
}

export default defineChallenge({
  id: "06",
  version: 1,

  generate(rng, { slot }) {
    const [a, n] = rng.pick(slot === "intro" ? BAS.filter(([, x]) => x <= 4) : BAS);
    // Intro: symbol är alltid med (läser bilden mot siffrorna). Annars tre valfria typer.
    const typer = slot === "intro" ? ["symbol", ...rng.sample(["cirkel", "stav", "rutnat"], 2)] : rng.sample(TYPER, 3);
    typer.sort();
    const fel = skildaVarden(q(a, n), rng.shuffle(kandidater(a, n)), 3);
    const sorter = rng.shuffle(typer);
    const kort = rng.shuffle([
      ...typer.map((sort) => ({ sort, n: a, d: n, ratt: true })),
      ...fel.map((c, i) => ({ sort: sorter[i], n: c.n, d: c.d, tag: c.tag })),
    ]);
    return { a, n, typer, kort };
  },

  core: ({ a, n, typer }) => `${a}/${n}-${typer.join("+")}`,

  build({ a, n, typer, kort }) {
    const cards = kort.map((c, i) => ({ id: kortId(i), face: face(c.sort, c.n, c.d) }));
    const ratt = cards.filter((_, i) => kort[i].ratt).map((c) => c.id);
    const fel = cards.filter((_, i) => !kort[i].ratt).map((c) => c.id);
    const ex = n === 3 ? { b: 1, m: 4 } : { b: 2, m: 3 };
    const delText = (c) => (c.sort === "symbol" ? `${c.n}/${c.d}` : c.sort === "text" ? `"${ord(c.n, c.d)}"` : `${c.sort === "cirkel" ? "cirkeln" : c.sort === "stav" ? "staven" : "rutnätet"} med ${c.n} av ${c.d} delar`);
    return {
      core: `${a}/${n}-${typer.join("+")}`,
      prompt: "Välj de tre korten som visar lika mycket.",
      values: { target: { n: a, d: n }, cards: Object.fromEntries(cards.map((c, i) => [c.id, { n: kort[i].n, d: kort[i].d }])) },
      view: { component: "kort", cards, stora: true },
      answer: { type: "select", count: 3, options: cards.map((c) => c.id) },
      key: {
        type: "select",
        groups: [{ ids: ratt }],
        display: kort.filter((c) => c.ratt).map(delText).join(", "),
        examples: {
          right: [{ ids: ratt }, { ids: [ratt[2], ratt[0], ratt[1]] }],
          wrong: [{ ids: [ratt[0], ratt[1], fel[0]] }, { ids: [fel[0], fel[1], ratt[2]] }, { ids: fel }],
        },
      },
      help: [
        { step: "orientering", text: "Tre kort visar lika mycket, fast på olika sätt. Titta på helheten på varje kort.", highlight: { whole: true } },
        { step: "princip", text: "Formen kan ändras, men hur stor del av helheten är markerad? Räkna alla delarna och de markerade delarna på varje bild." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.b}/${ex.m}, "${ord(ex.b, ex.m)}" och en stav med ${ex.b} av ${ex.m} delar markerade visar lika mycket.`,
          view: modell("stav", ex.m, ex.b),
        },
        { step: "atergang", text: "Nu provar du själv: välj ett kort och leta efter två till med samma antal delar och samma antal markerade." },
      ],
      misconceptions: [...new Set(kort.filter((c) => c.tag).map((c) => c.tag))],
      feedback: {
        correct: `Ja! Alla tre visar ${ord(a, n)}: ${a} av ${n} lika stora delar.`,
        wrong: `De tre som hör ihop visar ${ord(a, n)} – ${a} av ${n} lika stora delar, fast på olika sätt.`,
      },
      review: `${kort.filter((c) => c.ratt).map(delText).join(", ")} visar alla ${a}/${n}. De andra korten visar andra bråk.`,
    };
  },

  reserve: [[1, 2, ["cirkel", "stav", "symbol"]], [1, 3, ["rutnat", "symbol", "text"]], [2, 3, ["cirkel", "stav", "text"]],
    [3, 4, ["cirkel", "stav", "symbol"]], [1, 4, ["rutnat", "stav", "text"]], [2, 5, ["cirkel", "symbol", "text"]],
    [5, 6, ["rutnat", "stav", "symbol"]], [3, 8, ["cirkel", "rutnat", "text"]], [4, 5, ["stav", "symbol", "text"]],
    [5, 8, ["cirkel", "rutnat", "stav"]]].map(([a, n, typer]) => {
    const fel = skildaVarden(q(a, n), kandidater(a, n), 3);
    const r = typer.map((sort) => ({ sort, n: a, d: n, ratt: true }));
    const d = fel.map((c, i) => ({ sort: typer[(i + 1) % 3], n: c.n, d: c.d, tag: c.tag }));
    return { slot: n <= 4 && typer.includes("symbol") ? "intro" : "normal", params: { a, n, typer, kort: [d[0], r[0], r[1], d[1], d[2], r[2]] } };
  }),
});
