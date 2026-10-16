// ============================================================================
// 11. Lika mycket – olika bilder (src/brakresan/utmaningar/u11.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 11: oförändrat värde vid olika indelning. Fyra bildkort ska paras
// ihop i två par; en komplett parning är EN uppgift.
//   • värdena 1/2, 1/3, 2/3, 1/4, 3/4 och 1/5; två OLIKA parvärden per uppgift
//   • i varje par samma värde men olika indelning (faktorerna k1 ≠ k2,
//     nämnare högst 12) och helst olika figurer (cirkel ↔ stav ↔ rutnät)
//   • alla bilder har samma helhetsstorlek i korten; inga decimaltal/procent
//   • varje parning där båda paren har samma värde godtas (gradeWith pairs) –
//     med två olika parvärden finns bara en sådan
// Hjälp: lägg två stavar på varandra / dela om samma figur (andra tal).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { valueKey, q } from "../math/index.js";
import { modell, kortId, ord } from "./delat-e.js";

const VARDEN = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]];
const FORMER = ["cirkel", "stav", "rutnat"];

/** Faktorer så att nämnaren blir högst 12. */
const faktorer = (d) => [1, 2, 3, 4, 5, 6].filter((k) => d * k <= 12);

export default defineChallenge({
  id: "11",
  version: 1,

  generate(rng, { slot }) {
    const [v1, v2] = rng.sample(slot === "intro" ? VARDEN.slice(0, 4) : VARDEN, 2);
    const kort = [];
    for (const [a, d] of [v1, v2]) {
      // Intro: en bild i grundindelning och en omdelad; annars två omdelade/olika.
      const fs = slot === "intro" ? [1, rng.pick(faktorer(d).filter((k) => k > 1))] : rng.sample(faktorer(d), 2);
      const [s1, s2] = rng.sample(FORMER, 2);
      kort.push({ a: a * fs[0], d: d * fs[0], shape: s1 }, { a: a * fs[1], d: d * fs[1], shape: s2 });
    }
    return { kort: rng.shuffle(kort) };
  },

  core: ({ kort }) => kort.map((c) => `${c.a}/${c.d}`).sort().join("|"),

  build({ kort }) {
    const cards = kort.map((c, i) => ({ id: kortId(i), face: modell(c.shape, c.d, c.a, { label: " " }) }));
    const nyckel = Object.fromEntries(cards.map((c, i) => [c.id, valueKey(q(kort[i].a, kort[i].d))]));
    const grupper = {};
    cards.forEach((c) => (grupper[nyckel[c.id]] ||= []).push(c.id));
    const par = Object.values(grupper).map(([a, b]) => ({ a, b }));
    const [p1, p2] = par;
    const vText = (p) => {
      const i = cards.findIndex((c) => c.id === p.a);
      const j = cards.findIndex((c) => c.id === p.b);
      const v = q(kort[i].a, kort[i].d);
      return `${kort[i].a}/${kort[i].d} = ${kort[j].a}/${kort[j].d} (${ord(v.n, v.d)})`;
    };
    return {
      core: kort.map((c) => `${c.a}/${c.d}`).sort().join("|"),
      prompt: "Para ihop korten två och två så att varje par visar lika mycket.",
      values: { cards: Object.fromEntries(cards.map((c, i) => [c.id, { n: kort[i].a, d: kort[i].d }])) },
      view: { component: "kort", cards, stora: true },
      answer: { type: "pairs" },
      key: {
        type: "pairs", cards: nyckel,
        display: `${vText(p1)} och ${vText(p2)}`,
        examples: {
          right: [{ pairs: par }, { pairs: [{ a: p2.b, b: p2.a }, { a: p1.b, b: p1.a }] }],
          wrong: [{ pairs: [{ a: p1.a, b: p2.a }, { a: p1.b, b: p2.b }] }, { pairs: [{ a: p1.a, b: p2.b }, { a: p1.b, b: p2.a }] }],
        },
      },
      help: [
        { step: "orientering", text: "Varje kort har en hel figur. Hur stor del av sin helhet är markerad?", highlight: { whole: true } },
        { step: "princip", text: "Samma andel kan delas på olika sätt: fler delar, men lika mycket markerat. Formen kan vara olika – jämför andelen av helheten." },
        {
          step: "modellering",
          text: "Ett exempel med andra tal: 2 av 5 delar och 4 av 10 delar. Lägg stavarna på varandra – de markerade delarna är lika långa.",
          view: { component: "stav", bars: [{ parts: 5, marked: 2 }, { parts: 10, marked: 4 }] },
        },
        { step: "atergang", text: "Nu provar du själv: ta ett kort i taget och leta efter det andra som visar lika mycket." },
      ],
      misconceptions: ["fler-delar-ar-mer", "samma-antal-markerade"],
      feedback: {
        correct: `Ja! ${vText(p1)} och ${vText(p2)}. Olika indelning, samma andel.`,
        wrong: `Paren är ${vText(p1)} och ${vText(p2)}. Jämför andelen av helheten, inte antalet delar.`,
      },
      review: `${vText(p1)}; ${vText(p2)}. Varje par har samma värde med olika indelning.`,
    };
  },

  reserve: [
    [[1, 2, "cirkel"], [4, 8, "stav"], [1, 3, "stav"], [2, 6, "rutnat"]],
    [[2, 3, "cirkel"], [8, 12, "stav"], [1, 4, "rutnat"], [3, 12, "cirkel"]],
    [[3, 4, "stav"], [6, 8, "cirkel"], [1, 5, "cirkel"], [2, 10, "stav"]],
    [[1, 2, "rutnat"], [3, 6, "cirkel"], [3, 4, "cirkel"], [9, 12, "rutnat"]],
    [[1, 3, "cirkel"], [4, 12, "stav"], [2, 3, "rutnat"], [4, 6, "stav"]],
    [[1, 4, "stav"], [2, 8, "cirkel"], [1, 5, "rutnat"], [2, 10, "cirkel"]],
    [[2, 4, "stav"], [5, 10, "rutnat"], [2, 6, "cirkel"], [3, 9, "stav"]],
    [[2, 3, "stav"], [6, 9, "cirkel"], [1, 2, "cirkel"], [6, 12, "stav"]],
    [[3, 4, "rutnat"], [9, 12, "stav"], [1, 3, "stav"], [3, 9, "cirkel"]],
    [[1, 5, "stav"], [2, 10, "rutnat"], [1, 4, "cirkel"], [3, 12, "rutnat"]],
  ].map((l) => ({ params: { kort: [l[0], l[2], l[1], l[3]].map(([a, d, shape]) => ({ a, d, shape })) } })),
});
