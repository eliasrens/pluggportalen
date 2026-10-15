// ============================================================================
// 13. Dela bråkstaven (src/brakresan/utmaningar/u13.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 13: varför täljare och nämnare multipliceras med samma faktor. En
// markerad stav a/n och instruktionen "dela varje gammal del i k nya delar":
// eleven väljer delningen med verktyget (−/+) och fyller i det nya bråket.
//   • a/n med n = 2–6, 1 ≤ a < n, k = 2–4, ny nämnare n·k ≤ 24
//   • rätt = BÅDE omdelningen (k) och bråket (täljare a·k, nämnare n·k) –
//     multi; 2/3 som svar på "dela i två" uppfyller inte den begärda formen
//   • odelad stav (k = 1) är inte ett fel svar utan en ofullständig struktur:
//     "Dela staven först" (§5), uppgiften låses inte
//   • stavkomponenten behåller gamla gränser kraftiga och nya tunna; den
//     markerade längden är exakt densamma (geometri.omdela)
// Talrymden: 15 bråk × 3 faktorer = 45 kärnor (minVariants).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeAnswer } from "../schema/bedomning.js";
import { brakForm, ord } from "./delat-e.js";

const PAR = [];
for (let n = 2; n <= 6; n++) for (let a = 1; a < n; a++) for (let k = 2; k <= 4; k++) if (n * k <= 24) PAR.push({ a, n, k });

const falt = (x, y) => ({ fields: { n: String(x), d: String(y) } });
const delNamn = (n) => (n === 2 ? "halva" : ord(1, n).split(" ")[1]);

/** Egen bedömning: odelad stav = ofullständig; fel delning eller fel bråk får egna förklaringar. */
function validate(task, answer) {
  const { a, n, k } = task.params;
  if (answer?.parts?.k?.text === "1") {
    return { status: "invalid", error: "ofullstandig", message: `Dela staven först: varje ${delNamn(n)} i ${k} nya delar.`, part: "k" };
  }
  const r = gradeAnswer(task, answer);
  if (r.status !== "graded" || r.correct) return r;
  if (!r.parts.k) return { ...r, reason: "fel-delning", message: `Varje gammal del ska delas i ${k} nya delar – inte ${answer.parts.k.text}.` };
  if (r.reason === "fel-namnare") return { ...r, message: `Rätt värde, men skriv bråket med stavens nya delar: nämnaren ${n * k}.` };
  return { ...r, message: `Räkna de nya delarna: hela staven har nu ${n * k} delar. Hur många av dem är markerade?` };
}

export default defineChallenge({
  id: "13",
  version: 1,
  minVariants: 40,
  minVariantsReason: "§8 13 låser a/n med n = 2–6 och k = 2–4: 15 äkta bråk × 3 faktorer = 45 kärnor (granskningen kräver 40 av 200 slumpexempel).",

  generate(rng, { slot }) {
    const pool = slot === "intro" ? PAR.filter((p) => p.n <= 4) : slot === "overforing" ? PAR.filter((p) => p.n >= 4) : PAR;
    return { ...rng.pick(pool) };
  },

  core: ({ a, n, k }) => `${a}/${n}×${k}`,

  validate,

  build({ a, n, k }) {
    const N = n * k;
    const fk = k === 4 ? 3 : k + 1; // fel delning (verktyget går till 4)
    const ex = n === 2 && k === 3 ? { a: 1, n: 3, k: 2 } : { a: 1, n: 2, k: 3 };
    return {
      core: `${a}/${n}×${k}`,
      prompt: `Dela varje ${delNamn(n)} i ${k} nya delar. Skriv sedan det nya bråket.`,
      values: { start: { n: a, d: n }, k, ny: { n: a * k, d: N } },
      view: {
        component: "omdelning",
        bars: [{ parts: n, marked: a, maxDela: 4, svar: "k" }],
        expr: [brakForm(a, n), { op: "=" }, { input: "ny" }],
      },
      answer: { type: "multi", parts: { k: { type: "number", input: "integer" }, ny: { type: "number", input: "fraction" } } },
      key: {
        type: "multi",
        parts: {
          k: { type: "number", value: k, requirement: { kind: "integer" } },
          ny: { type: "number", value: { n: a, d: n }, requirement: { kind: "denominator", d: N } },
        },
        display: `Varje del i ${k}: ${a}/${n} = ${a * k}/${N}`,
        examples: {
          right: [{ parts: { k: { text: String(k) }, ny: falt(a * k, N) } }],
          wrong: [
            { parts: { k: { text: String(k) }, ny: falt(a, n) } }, //           skriver av det gamla bråket
            { parts: { k: { text: String(k) }, ny: falt(a, N) } }, //           bara nämnaren ändrad
            { parts: { k: { text: String(k) }, ny: falt(a + k, N) } }, //       adderar i stället
            { parts: { k: { text: String(fk) }, ny: falt(a * fk, n * fk) } }, // annan delning än den begärda
          ].filter((x, i) => i !== 2 || a + k !== a * k),
        },
      },
      help: [
        { step: "orientering", text: `Hela staven = 1. Den är delad i ${n} lika delar, och ${a} är markerade.`, highlight: { whole: true } },
        { step: "princip", text: `Dela varje gammal del i ${k} nya. De gamla gränserna blir kraftiga, de nya tunna. Den markerade längden är exakt densamma – fler bitar betyder inte mer.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n}, dela varje del i ${ex.k}. Då blir det ${ex.n * ex.k} delar, och den markerade delen blir ${ex.a * ex.k} små delar: ${ex.a * ex.k}/${ex.n * ex.k}.`,
          view: { component: "stav", parts: ex.n, marked: ex.a, regroup: ex.k },
        },
        { step: "atergang", text: "Nu provar du själv: följ en markerad gammal del – hur många nya delar blir den? Och hur många delar har hela staven?" },
      ],
      misconceptions: ["fler-bitar-ar-mer", "bara-namnaren", "additiv-forlangning"],
      feedback: {
        correct: `Ja! Varje ${delNamn(n)} blev ${k} delar: ${a}/${n} = ${a * k}/${N}. Lika mycket är markerat.`,
        wrong: `Varje gammal del delas i ${k}: hela staven får ${n} · ${k} = ${N} delar, och de ${a} markerade blir ${a} · ${k} = ${a * k}. ${a}/${n} = ${a * k}/${N}.`,
      },
      review: `${a}/${n}: varje del delas i ${k} nya. Nämnaren ${n} · ${k} = ${N}, täljaren ${a} · ${k} = ${a * k}. Samma markerade längd: ${a}/${n} = ${a * k}/${N}.`,
    };
  },

  reserve: [[1, 2, 2], [2, 3, 2], [3, 4, 2], [1, 3, 3], [2, 5, 2], [4, 5, 3], [5, 6, 2], [1, 4, 4], [3, 5, 4], [1, 6, 4], [2, 3, 4]]
    .map(([a, n, k]) => ({ slot: n <= 3 ? "intro" : n >= 5 ? "overforing" : "normal", params: { a, n, k } })),
});
