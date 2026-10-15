// ============================================================================
// 20. Hälften, tredjedelen, fjärdedelen (src/brakresan/utmaningar/u20.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 20: enhetsbråk av ett antal. Föremålen grupperas i n lika grupper
// (komponenten gruppering – tomma gruppytor, inga förifyllda storlekar) och
// eleven anger antalet i en grupp.
//   • n ∈ {2, 3, 4}, N = n·k, k = 2–8, N ≤ 24
//   • "tal": grupperingen är ett verktyg, bara talet bedöms
//   • "fordela" (tre per omgång): fördelningen ingår i inlämningen och måste
//     vara jämn (alla föremål, k i varje grupp) – OCH talet rätt (multi)
//   • situationer: "1/3 av 18", dela lika mellan barn, ge bort en andel
// Återkopplingen skiljer antalet föremål (6 äpplen) från bråket som anger
// andelen (1/3 = en av tre lika grupper).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { brakForm, ord, tal } from "./delat-e.js";

const SLOTS = ["tal", "tal", "fordela", "tal", "fordela", "tal", "tal", "fordela", "tal", "tal"];
const FOREMAL = { kula: "kulor", knapp: "knappar", stjarna: "stjärnor", kloss: "klossar" };
const BARN = { 2: "två", 3: "tre", 4: "fyra" };

export const TAL = [];
for (const n of [2, 3, 4]) for (let k = 2; k <= 8; k++) if (n * k <= 24) TAL.push({ n, k });

function situation(sit, n, N, fler) {
  if (sit === "dela") return `${N} ${fler} delas lika mellan ${BARN[n]} barn. Varje barn får 1/${n}. Hur många ${fler} får ett barn?`;
  if (sit === "ge") return `Ali har ${N} ${fler} och ger bort 1/${n} av dem. Hur många ${fler} ger Ali bort?`;
  return `Hur många är 1/${n} av ${N} ${fler}?`;
}

/** Egen bedömning för "fordela": alla föremål i grupperna, lika många i varje, och rätt tal. */
function validate(task, answer) {
  if (task.answer.type !== "multi") return gradeWith(task.answer, task.key, answer);
  const { n, k } = task.params;
  const N = n * k;
  const bins = answer?.parts?.grupper?.bins;
  const placerade = bins && typeof bins === "object" ? Object.values(bins).flat().map(String) : [];
  const giltiga = new Set(Array.from({ length: N }, (_, i) => `p${i}`));
  if (!bins || Object.keys(bins).some((b) => !task.answer.parts.grupper.bins.includes(b)) ||
      new Set(placerade).size !== placerade.length || placerade.some((id) => !giltiga.has(id))) {
    return { status: "invalid", error: "ogiltig", message: "Lägg föremålen i grupperna.", part: "grupper" };
  }
  if (placerade.length < N) return { status: "invalid", error: "ofullstandig", message: "Lägg alla föremål i grupperna först.", part: "grupper" };
  const s = gradeWith(task.answer.parts.svar, task.key.parts.svar, answer?.parts?.svar);
  if (s.status === "invalid") return { ...s, part: "svar" };
  const jamn = task.answer.parts.grupper.bins.every((b) => (bins[b] || []).length === k);
  const correct = jamn && s.correct;
  return {
    status: "graded", correct, reason: !jamn ? "ojamn-fordelning" : s.correct ? null : "fel-antal",
    message: !jamn ? "Grupperna är inte lika stora. Flytta föremål så att alla grupper får lika många." : null,
    parts: { grupper: jamn, svar: s.correct },
  };
}

export default defineChallenge({
  id: "20",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const { n, k } = rng.pick(index < 2 ? TAL.filter((t) => t.n === 2 && t.k <= 6) : TAL);
    return { mode: slot, n, k, sit: rng.pick(["av", "dela", "ge"]), item: rng.pick(Object.keys(FOREMAL)) };
  },

  core: ({ mode, n, k, sit }) => `${mode}-${sit}-1/${n}·${n * k}`,

  validate,

  build({ mode, n, k, sit, item }) {
    const N = n * k;
    const fler = FOREMAL[item];
    const del = ord(1, n);
    const expr = [brakForm(1, n), { text: `av ${N} =` }, { input: true }];
    const ex = n === 3 && k === 4 ? { n: 2, N: 10 } : { n: 3, N: 12 };
    const help = [
      { step: "orientering", text: `Hela samlingen är ${N} ${fler}. Nämnaren ${n} säger hur många lika stora grupper du ska dela den i.`, highlight: { whole: true } },
      { step: "princip", text: `Dela hela samlingen i ${tal(n)} lika stora grupper. ${del[0].toUpperCase()}${del.slice(1)} är en sådan grupp.`, highlight: { groups: true } },
      {
        step: "modellering",
        text: `Ett exempel med andra tal: 1/${ex.n} av ${ex.N}. Dela ${ex.N} kulor i ${ex.n} lika grupper – en grupp är ${ex.N / ex.n} kulor.`,
        view: { component: "mangd", count: ex.N, groups: ex.n, marked: ex.N / ex.n, item: "kula", label: `Hela samlingen = ${ex.N} kulor` },
      },
      { step: "atergang", text: `Nu provar du själv: lägg ut ${fler} en i taget i grupperna tills alla är slut. Räkna en grupp.` },
    ];
    const common = {
      core: `${mode}-${sit}-1/${n}·${N}`,
      prompt: `${situation(sit, n, N, fler)}${mode === "fordela" ? " Fördela alla i grupperna och skriv svaret." : ""}`,
      values: { andel: { n: 1, d: n }, helhet: N, svar: k },
      help,
      misconceptions: ["antal-grupper-i-stallet-for-antal-i-grupp", "brak-som-antal"],
      feedback: {
        correct: `Ja! 1/${n} är andelen – en av ${tal(n)} lika grupper. Antalet i en grupp är ${k} ${fler}.`,
        wrong: `1/${n} av ${N}: dela ${N} ${fler} i ${n} lika stora grupper. En grupp är ${k} ${fler}. Bråket 1/${n} är andelen, ${k} är antalet.`,
      },
      review: `1/${n} av ${N} = ${N} ÷ ${n} = ${k}. ${tal(n)} lika grupper med ${k} i varje.`,
    };
    const gruppView = { component: "gruppering", count: N, groups: n, item };
    if (mode === "fordela") {
      const bins = Array.from({ length: n }, (_, i) => `g${i + 1}`);
      const jamn = Object.fromEntries(bins.map((b, i) => [b, Array.from({ length: k }, (_, j) => `p${i * k + j}`)]));
      const varannan = Object.fromEntries(bins.map((b, i) => [b, Array.from({ length: k }, (_, j) => `p${j * n + i}`)]));
      const ojamn = { ...jamn, g1: [...jamn.g1, jamn.g2[0]], g2: jamn.g2.slice(1) };
      return {
        ...common,
        view: {
          component: "sammansatt",
          delar: [{ view: gruppView, svar: "grupper" }, { view: { component: "notation", expr }, svar: "svar" }],
        },
        answer: { type: "multi", parts: { grupper: { type: "categories", bins }, svar: { type: "number", input: "integer" } } },
        key: {
          type: "multi",
          parts: { grupper: { type: "categories", per: k, bins: {} }, svar: { type: "number", value: k, requirement: { kind: "integer" } } },
          display: `${tal(n)} grupper med ${k} – 1/${n} av ${N} = ${k}`,
          examples: {
            right: [{ parts: { grupper: { bins: jamn }, svar: { text: String(k) } } }, { parts: { grupper: { bins: varannan }, svar: { text: String(k) } } }],
            wrong: [{ parts: { grupper: { bins: ojamn }, svar: { text: String(k) } } }, { parts: { grupper: { bins: jamn }, svar: { text: String(k === n ? k + 1 : n) } } }],
          },
        },
      };
    }
    return {
      ...common,
      view: {
        component: "sammansatt",
        delar: [{ view: gruppView, verktyg: true }, { view: { component: "notation", expr }, svar: true }],
      },
      answer: { type: "number", input: "integer" },
      key: {
        type: "number", value: k, requirement: { kind: "integer" },
        display: `1/${n} av ${N} = ${k}`,
        examples: { right: [{ text: String(k) }], wrong: [...new Set([n, N - k, k + 1])].filter((x) => x !== k).map((x) => ({ text: String(x) })) },
      },
    };
  },

  reserve: [
    ["tal", 2, 4, "av"], ["tal", 3, 6, "dela"], ["tal", 4, 3, "ge"], ["tal", 2, 7, "dela"], ["tal", 3, 2, "av"],
    ["fordela", 2, 5, "av"], ["fordela", 3, 4, "dela"], ["fordela", 4, 2, "ge"], ["fordela", 3, 3, "ge"], ["tal", 4, 6, "av"], ["tal", 2, 8, "ge"],
  ].map(([mode, n, k, sit]) => ({ slot: mode, params: { mode, n, k, sit, item: "kula" } })),
});
