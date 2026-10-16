// ============================================================================
// 47. Dela ett bråk – EXTRA UTMANING (src/brakresan/utmaningar/u47.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 47: bråk delat med ett positivt heltal som lika delning. Staven
// visar a/n ("Hela staven = 1"). Eleven delar den markerade längden i k lika
// portioner och skriver hur stor EN portion är av hela staven. Verktyget
// "Dela varje bit i …" (omdelning, samma som 13/34) behåller helheten och den
// markerade längden. EN uppgift, två delsvar (multi):
//   • delningen: de markerade bitarna ska gå att fördela lika i k portioner –
//     a · j delbart med k (j = stavens delning). När täljaren redan går jämnt
//     ut (3/4 ÷ 3) räcker staven som den är; annars måste bitarna delas om
//     (1/2 ÷ 3: dela varje bit i 3 → 3/6).
//   • portionen: a/(n · k), förkortat eller inte
// Generering: a/n med n = 2–8, k = 2–4, n · k ≤ 24; främst fall där täljaren
// delas jämnt (sex av tio), fyra som kräver omdelning.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { q, div, eq, partName, numberWords } from "../math/index.js";
import { falt, text, br, nd } from "./delat-g.js";

const SLOTS = ["jamn", "jamn", "jamn", "jamn", "omdela", "jamn", "omdela", "jamn", "omdela", "omdela"];
const MAX = 24;

/** Alla (a, n, k): a/n äkta, n 2–8, k 2–4, n · k ≤ 24. */
export const TRIPPLAR = [];
for (let n = 2; n <= 8; n++) for (let a = 1; a < n; a++) for (let k = 2; k <= 4; k++) if (n * k <= MAX) TRIPPLAR.push({ a, n, k, jamn: a % k === 0 });

const g = (x, y) => (y ? g(y, x % y) : x);
/** Minsta delning j som gör a · j delbart med k. */
export const minstaDelning = (a, k) => k / g(a, k);
const maxDela = (n) => Math.floor(MAX / n);
const delNamn = (n) => (n === 2 ? "halva" : partName(n) ?? `${n}-del`);

const MEDDELANDE = {
  ojamn: "Portionerna blir inte lika: de markerade bitarna går inte att fördela lika. Dela varje bit i fler små bitar först.",
  "fel-portion": "Hur stor är EN portion jämfört med hela staven? Räkna hur många sådana portioner som skulle fylla hela staven.",
};

function validate(task, answer) {
  const { a, n, k } = task.params;
  const j = Number(answer?.parts?.dela?.text);
  if (!Number.isSafeInteger(j) || j < 1 || j > maxDela(n)) return { status: "invalid", error: "ogiltig", message: "Använd knapparna för att dela staven.", part: "dela" };
  const r = gradeWith(task.answer.parts.svar, task.key.parts.svar, answer?.parts?.svar);
  if (r.status === "invalid") return { ...r, part: "svar", message: r.error === "tom" ? "Skriv hur stor en portion är." : r.message };
  const jamn = (a * j) % k === 0;
  const reason = !r.correct ? "fel-portion" : !jamn ? "ojamn" : null;
  return { status: "graded", correct: !reason, reason, message: reason ? MEDDELANDE[reason] : null, parts: { dela: jamn, svar: r.correct } };
}

const kärna = ({ a, n, k }) => `${a}/${n}÷${k}`;

export default defineChallenge({
  id: "47",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const jamn = slot === "jamn";
    const pool = TRIPPLAR.filter((t) => t.jamn === jamn && (index > 1 || t.n <= 6));
    const { a, n, k } = rng.pick(pool);
    return { a, n, k };
  },

  core: kärna,
  validate,

  build({ a, n, k }) {
    const P = div(q(a, n), q(k));
    const j = minstaDelning(a, k);
    const N = n * k;
    const per = (a * j) / k; // bitar per portion efter delningen
    const bitar = n * j;
    const kort = P.d !== N ? ` = ${P.n}/${P.d}` : "";
    const display = `${a}/${n} ÷ ${k} = ${a}/${N}${kort}${j > 1 ? ` (dela varje bit i ${j}: ${a * j}/${bitar}, ${per} ${per === 1 ? "bit" : "bitar"} per portion)` : ""}`;
    const fel = [
      { parts: { dela: text(j), svar: falt(a * k, n) } }, //  multiplicerar
      { parts: { dela: text(j), svar: falt(a, n + k) } }, //  adderar till nämnaren
    ].filter((x) => !eq(q(Number(x.parts.svar.fields.n), Number(x.parts.svar.fields.d)), P));
    if (j > 1) fel.push({ parts: { dela: text(1), svar: falt(P.n, P.d) } }); // rätt tal men ingen jämn fördelning
    const right = [{ parts: { dela: text(j), svar: falt(a, N) } }, { parts: { dela: text(j), svar: falt(P.n, P.d) } }];
    if (j * 2 <= maxDela(n)) right.push({ parts: { dela: text(j * 2), svar: falt(per * 2, bitar * 2) } });
    const ex = n === 2 && k === 2 ? { a: 1, n: 3, k: 2 } : { a: 1, n: 2, k: 2 };
    return {
      core: kärna({ a, n, k }),
      prompt: `Dela ${a}/${n} i ${numberWords(k)} lika portioner. Hur stor del av hela staven blir en portion? Dela staven om det behövs.`,
      values: { start: { n: a, d: n }, k, portion: nd(P), delning: j },
      view: {
        component: "omdelning",
        bars: [{ parts: n, marked: a, maxDela: maxDela(n), svar: "dela" }],
        expr: [br(a, n), { op: "÷" }, { kind: "integer", v: k }, { op: "=" }, { input: "svar" }],
      },
      answer: { type: "multi", parts: { dela: { type: "number", input: "integer" }, svar: { type: "number", input: "fraction" } } },
      key: {
        type: "multi",
        parts: { dela: { type: "number", value: j, requirement: { kind: "integer" } }, svar: { type: "number", value: nd(P), requirement: { kind: "value" } } },
        display,
        examples: { right, wrong: fel },
      },
      help: [
        { step: "orientering", text: `Hela staven = 1. Den markerade delen är ${a}/${n}. Den ska delas i ${numberWords(k)} lika stora portioner.`, highlight: { whole: true } },
        {
          step: "princip",
          text: a % k === 0
            ? `De markerade bitarna räcker att fördela lika – lika många bitar i varje portion. Vilken andel av den FÖRSTA hela staven är en portion?`
            : `${numberWords(a).replace(/^./, (c) => c.toUpperCase())} ${a === 1 ? "bit" : "bitar"} går inte att fördela lika i ${numberWords(k)} portioner. Dela varje bit i mindre bitar – hela den markerade längden delas, inte bara de gamla bitarna.`,
        },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} delat i ${numberWords(ex.k)}. Dela varje bit i ${ex.k}: då är det ${ex.a * ex.k}/${ex.n * ex.k}, och en portion är 1/${ex.n * ex.k} av hela staven.`,
          view: { component: "stav", parts: ex.n, marked: ex.a, regroup: ex.k },
        },
        { step: "atergang", text: "Nu provar du själv: gör så att bitarna räcker till lika många i varje portion, och jämför en portion med hela staven." },
      ],
      misconceptions: ["multiplicerar-i-stallet", "flyttar-gamla-bitar", "portion-av-delen-inte-helheten"],
      feedback: {
        correct: `Ja! ${a}/${n} i ${numberWords(k)} lika portioner: en portion är ${a}/${N}${kort} av hela staven.`,
        wrong: `${j > 1 ? `Dela varje ${delNamn(n)} i ${j}: ${a}/${n} = ${a * j}/${bitar}. ` : ""}Varje portion får ${per} av de ${bitar} lika bitarna i hela staven: ${per}/${bitar}${per !== P.n || bitar !== P.d ? ` = ${P.n}/${P.d}` : ""}.`,
      },
      review: `${display}. ${a}/${n} ÷ ${k} är lika delning: en portion är 1/${k} av ${a}/${n}, alltså ${a}/${N}${kort} av hela.`,
    };
  },

  reserve: [
    [3, 4, 3], [2, 3, 2], [4, 5, 2], [2, 4, 2], [6, 8, 3], [4, 6, 2],
    [1, 2, 3], [1, 3, 2], [2, 3, 3], [3, 5, 2], [1, 4, 4],
  ].map(([a, n, k]) => ({ slot: a % k === 0 ? "jamn" : "omdela", params: { a, n, k } })),
});
