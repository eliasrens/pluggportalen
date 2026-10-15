// ============================================================================
// 48. Hur många får plats? – EXTRA UTMANING (src/brakresan/utmaningar/u48.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 48: division som mätning med en given bråkstorlek. Överst
// målsträckan A (på en eller två stavar, varje stav = 1), under lika långa
// stavar delade i måttbitar 1/m – SAMMA skala. Eleven fyller sträckan med
// måttbitar (markerar bitar) och skriver antalet. EN uppgift, två delsvar:
//   • antal markerade måttbitar = A ÷ (1/m), helt antal
//   • antalet bitar (heltal)
// Generering: positivt A ≤ 2, bitstorlek 1/2 … 1/8, A/B ett positivt heltal
// 2–8. Inga dolda halva bitar, ingen rest, ingen reciprokregel.
// Bara stambråk går att lägga som lika bitar på en stav, så §8:s gränser ger
// 43 talpar (minVariants). Introduktionen jämför med 47: "hur många bitar",
// inte "hur stor är varje portion".
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, toQ, formatForm, partName, mixedFormOf } from "../math/index.js";
import { ids, text, br, nd } from "./delat-g.js";

const SLOTS = ["intro", "intro", "intro", "normal", "normal", "normal", "normal", "overforing", "overforing", "overforing"];

/** Alla (c, m): bitstorlek 1/m (m 2–8), A = c/m ≤ 2, c 2–8. */
export const PAR = [];
for (let m = 2; m <= 8; m++) for (let c = 2; c <= 8; c++) if (c <= 2 * m) PAR.push({ c, m });

const SITUATIONER = {
  glas: { text: (A, B) => `En kanna rymmer ${A} liter saft. Hur många glas om ${B} liter kan fyllas?`, enhet: "liter", bit: "glas" },
  band: { text: (A, B) => `Ett band är ${A} meter långt. Det klipps i bitar som är ${B} meter. Hur många bitar blir det?`, enhet: "m", bit: "bitar" },
  pizza: { text: (A, B) => `Det finns ${A} pizza kvar. Varje portion är ${B} pizza. Hur många portioner blir det?`, enhet: "pizza", bit: "portioner" },
  stig: { text: (A, B) => `En stig är ${A} km lång. Var ${B} km står en skylt. Hur många sträckor på ${B} km är stigen?`, enhet: "km", bit: "sträckor" },
};

const Atext = (c, m) => formatForm(mixedFormOf(q(c, m)));
const kärna = ({ c, m }) => `${Atext(c, m)}÷1/${m}`;

export default defineChallenge({
  id: "48",
  version: 1,
  slots: SLOTS,
  minVariants: 40,
  minVariantsReason: "§8 48 (A ≤ 2, bitstorlek 1/2–1/8, A/B helt antal 2–8) ger med stambråk – de enda bitar som kan läggas lika på en stav – exakt 43 talpar (PAR).",

  generate(rng, { slot }) {
    const pool = slot === "intro" ? PAR.filter((p) => p.m <= 4) : PAR;
    const { c, m } = rng.pick(pool);
    return { c, m, ...(slot === "overforing" ? { situation: rng.pick(Object.keys(SITUATIONER)) } : {}) };
  },

  core: kärna,

  build({ c, m, situation = null }) {
    const A = q(c, m);
    const W = Math.ceil(A.n / A.d);
    const at = Atext(c, m);
    const bt = `1/${m}`;
    const sit = SITUATIONER[situation];
    const delar = ids(W * m);
    const aForm = mixedFormOf(A);
    const malVy = { component: "stav", wholes: W, parts: A.d, marked: A.n, label: W > 1 ? "Varje stav = 1 hel" : "Hela staven = 1" };
    const fel = [m, c + 1, c - 1].filter((x, i, l) => x !== c && x > 0 && l.indexOf(x) === i).map((x) => ({ parts: { bitar: { selected: delar.slice(0, c) }, antal: text(x) } }));
    fel.push({ parts: { bitar: { selected: delar.slice(0, c - 1) }, antal: text(c) } });
    const ex = m === 4 && c === 3 ? { A: "1/2", m: 8, c: 4, W: 1, d: 2, n: 1 } : { A: "3/4", m: 8, c: 6, W: 1, d: 4, n: 3 };
    return {
      core: kärna({ c, m }),
      prompt: sit ? `${sit.text(at, bt)} Fyll sträckan med bitar och skriv antalet.` : `Hur många bitar ${bt} får plats på ${at}? Fyll sträckan med bitar och skriv antalet.`,
      values: { A: nd(A), B: { n: 1, d: m }, antal: c },
      view: {
        component: "sammansatt",
        delar: [
          { view: malVy, rubrik: `Sträckan: ${at}${sit ? ` ${sit.enhet}` : ""}` },
          { view: { component: "stav", wholes: W, parts: m, label: `Måttbitar: ${bt} – lika stor skala` }, svar: "bitar", rubrik: `Bitar ${bt}`, label: "Markera bitar tills sträckan är fylld" },
          { view: { component: "notation", expr: [aForm, { op: "÷" }, br(1, m), { op: "=" }, { input: true }, { text: sit ? sit.bit : "bitar" }] }, svar: "antal" },
        ],
      },
      answer: { type: "multi", parts: { bitar: { type: "paint", parts: delar }, antal: { type: "number", input: "integer" } } },
      key: {
        type: "multi",
        parts: { bitar: { type: "paint", count: c }, antal: { type: "number", value: c, requirement: { kind: "integer" } } },
        display: `${at} ÷ ${bt} = ${c}: ${c} bitar ${bt} fyller ${at}`,
        examples: { right: [{ parts: { bitar: { selected: delar.slice(0, c) }, antal: text(c) } }], wrong: fel },
      },
      help: [
        { step: "orientering", text: `Sträckan överst är ${at}. Under ligger bitar som är ${bt} – på samma skala, varje stav är 1.`, highlight: { whole: true } },
        { step: "princip", text: "Frågan är hur MÅNGA bitar som får plats – inte hur stor varje bit blir (som när man delar i lika portioner). Lägg bitar tills sträckan är fylld." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.A} ÷ 1/${ex.m}. ${partName(ex.m)?.replace(/^./, (x) => x.toUpperCase())}ar läggs efter varandra: ${ex.c} stycken fyller ${ex.A}.`,
          view: { component: "stav", bars: [{ parts: ex.d, marked: ex.n }, { parts: ex.m, marked: ex.c }] },
        },
        { step: "atergang", text: "Nu provar du själv: markera en bit i taget tills den markerade längden är lika lång som sträckan." },
      ],
      misconceptions: ["portionsstorlek-i-stallet-for-antal", "bitar-i-en-hel", "halva-bitar"],
      feedback: {
        correct: `Ja! ${c} bitar ${bt} fyller ${at}: ${at} ÷ ${bt} = ${c}.`,
        wrong: `Lägg bitar ${bt} efter varandra tills de är lika långa som ${at}: det blir ${c} bitar. ${at} ÷ ${bt} = ${c}.`,
      },
      review: `${at} ÷ ${bt} = ${c}, eftersom ${c} · ${bt} = ${c}/${m}${toQ(A).d !== m ? ` = ${at}` : ""}. Mätdivision: hur många bitar får plats?`,
    };
  },

  reserve: [
    [2, 4], [3, 6], [4, 8], [6, 4], [3, 2], [5, 5], [6, 8], [4, 3], [7, 6], [8, 5], [2, 3],
  ].map(([c, m], i) => ({ slot: i < 3 ? "intro" : i >= 8 ? "overforing" : "normal", params: { c, m, ...(i >= 8 ? { situation: Object.keys(SITUATIONER)[i - 8] } : {}) } })),
});
