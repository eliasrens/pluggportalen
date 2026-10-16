// ============================================================================
// 07. Bråk av en samling (src/brakresan/utmaningar/u07.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 07: andel av diskreta föremål. En räkningsbar samling (identiska
// föremål, inga överlapp) och bråkinmatning.
//   • N = 6–24 föremål, k markerade, k/N förkortat har en enkel nämnare
//     (2, 3, 4, 5, 6, 8, 10, 12)
//   • alla likvärdiga bråk godtas (4/12 och 1/3) – förkortning är inte målet
//   • "markera": eleven markerar först föremålen (k av dem, vilka som helst)
//     och skriver sedan andelen – multi, båda delarna krävs
//   • "grupper": samma samling ritad i lika stora grupper (variation: samma
//     värde, föremålen flyttade)
// Hjälp: hela samlingen är helheten, "del av alla", gruppera om det hjälper –
// ett exempel med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { ids } from "./delat-e.js";

const SLOTS = ["visa", "visa", "visa", "markera", "visa", "markera", "grupper", "visa", "markera", "grupper"];
const FOREMAL = {
  kula: { flera: "kulor", farg: "blå", en: "blå" },
  knapp: { flera: "knappar", farg: "röda", en: "röd" },
  stjarna: { flera: "stjärnor", farg: "gula", en: "gul" },
  kloss: { flera: "klossar", farg: "gröna", en: "grön" },
};
const ENKLA = [2, 3, 4, 5, 6, 8, 10, 12];

/** Alla (k, N) med N 6–24, 1 ≤ k < N och enkel förkortad nämnare. */
export const PAR = [];
for (let N = 6; N <= 24; N++) for (let k = 1; k < N; k++) if (ENKLA.includes(q(k, N).d)) PAR.push([k, N]);

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export default defineChallenge({
  id: "07",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const pool = index < 3 ? PAR.filter(([, N]) => N <= 12) : slot === "grupper" ? PAR.filter(([k, N]) => q(k, N).d < N) : PAR;
    const [k, N] = rng.pick(pool);
    return { mode: slot, k, N, item: rng.pick(Object.keys(FOREMAL)) };
  },

  core: ({ k, N }) => `${k}/${N}`,

  build({ mode, k, N, item }) {
    const f = FOREMAL[item];
    const r = q(k, N);
    const grupper = mode === "grupper" ? r.d : 0;
    const mangd = { component: "mangd", count: N, item, ...(mode === "markera" ? {} : { marked: k }), ...(grupper ? { groups: grupper } : {}) };
    const expr = [{ text: `${mode === "markera" ? f.farg : "markerade"} av alla:` }, { input: true }];
    const right = [falt(k, N), ...(r.d !== N ? [falt(r.n, r.d)] : []), ...(2 * N <= 48 ? [falt(2 * k, 2 * N)] : [])];
    const wrongBrak = [[k, N - k], [N - k, N], [N, k], [k, N + 1]].filter(([a, b]) => b > 0 && a * N !== k * b);
    const ex = N === 9 && k === 3 ? { k: 2, N: 10, d: 5 } : { k: 3, N: 9, d: 3 };
    const help = [
      { step: "orientering", text: `Hela samlingen är alla ${N} ${f.flera} – det är helheten.`, highlight: { whole: true, ...(mode === "markera" ? { del: 0 } : {}) } },
      { step: "princip", text: `Andelen är "del av alla": hur många ${mode === "markera" ? f.farg : "markerade"} av hur många totalt. Det totala antalet blir nämnaren.` },
      {
        step: "modellering",
        text: `Ett exempel med andra tal: ${ex.k} av ${ex.N} kulor är markerade. Det är ${ex.k}/${ex.N}. I grupper om ${ex.N / ex.d} syns det att det också är 1/${ex.d}.`,
        view: { component: "mangd", count: ex.N, marked: ex.k, groups: ex.d, item: "kula" },
      },
      { step: "atergang", text: "Nu provar du själv: räkna alla föremål och de som söks." },
    ];
    const common = {
      core: `${k}/${N}`,
      values: { target: { n: k, d: N }, count: N, marked: k },
      help,
      misconceptions: ["del-mot-del", "raknar-omarkerade"],
      feedback: {
        correct: `Ja! ${k} av ${N} ${f.flera}: ${k}/${N}${r.d !== N ? ` = ${r.n}/${r.d}` : ""} av hela samlingen.`,
        wrong: `Hela samlingen är ${N} ${f.flera} (nämnaren), och ${k} av dem söks (täljaren): ${k}/${N}${r.d !== N ? `, samma som ${r.n}/${r.d}` : ""}.`,
      },
      review: `${k} av ${N} = ${k}/${N}${r.d !== N ? ` = ${r.n}/${r.d}` : ""}. Nämnaren är alla föremål, inte de som är kvar.`,
    };
    if (mode === "markera") {
      const delar = ids(N);
      return {
        ...common,
        prompt: `Det finns ${N} ${f.flera} och ${k} är ${k === 1 ? f.en : f.farg}. Markera ${k} som ${k === 1 ? f.en : f.farg}. Skriv sedan hur stor del av alla ${f.flera} som är ${f.farg}.`,
        view: {
          component: "sammansatt",
          delar: [
            { view: mangd, svar: "markera", label: `Markera de ${f.farg} ${f.flera}` },
            { view: { component: "notation", expr }, svar: "svar" },
          ],
        },
        answer: { type: "multi", parts: { markera: { type: "paint", parts: delar }, svar: { type: "number", input: "fraction" } } },
        key: {
          type: "multi",
          parts: { markera: { type: "paint", count: k }, svar: { type: "number", value: { n: k, d: N }, requirement: { kind: "value" } } },
          display: `${k} markerade, ${k}/${N}${r.d !== N ? ` = ${r.n}/${r.d}` : ""}`,
          examples: {
            right: right.map((s, i) => ({ parts: { markera: { selected: i % 2 ? delar.slice(N - k) : delar.slice(0, k) }, svar: s } })),
            wrong: [
              { parts: { markera: { selected: delar.slice(0, k) }, svar: falt(...wrongBrak[0]) } },
              { parts: { markera: { selected: delar.slice(0, k === N - 1 ? k - 1 : k + 1) }, svar: falt(k, N) } },
            ],
          },
        },
      };
    }
    return {
      ...common,
      prompt: `Hur stor del av alla ${f.flera} är markerade? Skriv ett bråk.`,
      view: { ...mangd, expr },
      answer: { type: "number", input: "fraction" },
      key: {
        type: "number", value: { n: k, d: N }, requirement: { kind: "value" },
        display: `${k}/${N}${r.d !== N ? ` = ${r.n}/${r.d}` : ""}`,
        examples: { right, wrong: wrongBrak.map(([a, b]) => falt(a, b)) },
      },
    };
  },

  reserve: [
    ["visa", 4, 12, "kula"], ["visa", 3, 6, "knapp"], ["visa", 2, 8, "stjarna"], ["visa", 6, 10, "kloss"],
    ["markera", 5, 20, "kula"], ["markera", 9, 12, "knapp"], ["markera", 4, 16, "kloss"],
    ["grupper", 6, 18, "stjarna"], ["grupper", 10, 15, "kula"], ["grupper", 15, 24, "knapp"], ["visa", 7, 14, "kula"],
  ].map(([mode, k, N, item]) => ({ slot: mode, params: { mode, k, N, item } })),
});
