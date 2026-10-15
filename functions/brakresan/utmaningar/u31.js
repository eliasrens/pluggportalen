// ============================================================================
// 31. Addera lika nämnare (src/brakresan/utmaningar/u31.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 31: addera antal delar av samma storlek. Två stavar visar a/n (ett
// mönster) och b/n (ett annat mönster). Eleven flyttar båda bitarna till en
// tom helhetsmall (klick eller drag) och skriver summan. EN uppgift med två
// delar (multi): mallen (a + b delar, båda addenderna – annars "flytta båda
// bitarna", som är inmatningshjälp och inget fel) och summan.
//   • samma nämnare 3–12, positiva täljare, summan ≤ 1
//   • summan: rätt värde räcker (likvärdigt bråk godtas, förkortning begärs
//     inte); "adderar nämnarna" är felet som återkopplingen förklarar
//   • två överföringsuppgifter är vardagsfrågor om delar av samma band
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { q } from "../math/index.js";
import { fractionWords, partName } from "../math/words.js";
import { brak, falt, ids, NUMBER_FRACTION, talNyckel } from "./f-delat.js";

const SLOTS = ["intro", "intro", "intro", "normal", "normal", "normal", "normal", "normal", "vardag", "vardag"];
const ALLA = [];
for (let n = 3; n <= 12; n++) for (let a = 1; a < n; a++) for (let b = 1; a + b <= n; b++) ALLA.push({ n, a, b });

const VARDAG = [
  { id: "staket", text: (x, y) => `Ella målar ${x} av ett staket på måndagen och ${y} av samma staket på tisdagen. Hur stor del av staketet har hon målat?` },
  { id: "band", text: (x, y) => `Ett band klipps i lika delar. Omar tar ${x} av bandet och Lina ${y} av samma band. Hur stor del tar de tillsammans?` },
  { id: "tarta", text: (x, y) => `Av en tårta äter Sam ${x} och Mia ${y}. Hur stor del av tårtan äter de tillsammans?` },
  { id: "promenad", text: (x, y) => `Ali går ${x} av vägen till skolan, vilar, och går sedan ${y} av samma väg. Hur stor del av vägen har han gått?` },
];

/** Egen bedömning: mallen måste ha båda bitarna (annars inmatningshjälp), sedan summan. */
function validate(task, answer) {
  const mall = answer?.parts?.mall?.selected;
  if (!Array.isArray(mall) || mall.length !== task.key.parts.mall.count) {
    return { status: "invalid", error: "ofullstandig", message: "Flytta båda bitarna till den tomma staven först.", part: "mall" };
  }
  const r = gradeWith(task.answer.parts.summa, task.key.parts.summa, answer.parts.summa);
  if (r.status === "invalid") return { ...r, part: "summa", message: r.error === "tom" ? "Skriv summan." : r.message };
  const adderat = r.form?.kind === "fraction" && r.form.d === 2 * task.values.n;
  return {
    status: "graded", correct: r.correct, reason: r.correct ? null : adderat ? "adderar-namnarna" : r.reason,
    message: r.correct ? null : adderat ? "Delarna har samma storlek före och efter – nämnaren ska inte adderas. Räkna hur många delar det blir." : r.message,
    parts: { mall: true, summa: r.correct },
  };
}

export default defineChallenge({
  id: "31",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? ALLA.filter((x) => x.n <= 8 && x.a + x.b < x.n) : ALLA;
    const { n, a, b } = rng.pick(pool);
    return slot === "vardag" ? { n, a, b, vardag: rng.pick(VARDAG).id } : { n, a, b };
  },

  core: ({ n, a, b }) => `${Math.min(a, b)}+${Math.max(a, b)}/${n}`,

  build({ n, a, b, vardag = null }) {
    const s = a + b;
    const S = q(s, n);
    const v = VARDAG.find((x) => x.id === vardag);
    const mall = ids(n);
    const del = partName(n);
    const ex = n === 5 ? { n: 6, a: 1, b: 4 } : { n: 5, a: 2, b: 1 };
    return {
      core: `${Math.min(a, b)}+${Math.max(a, b)}/${n}`,
      prompt: v ? v.text(`${a}/${n}`, `${b}/${n}`) : `Räkna ut ${a}/${n} + ${b}/${n}. Flytta båda bitarna till den tomma staven.`,
      values: { a: q(a, n), b: q(b, n), sum: { n: S.n, d: S.d }, n },
      view: {
        component: "verkstad",
        stavar: [
          { id: "s1", parts: n, marked: a, monster: "a", namn: brak(a, n), helhet: "Hela staven = 1", verktyg: ["flytta"] },
          { id: "s2", parts: n, marked: b, monster: "b", namn: brak(b, n), helhet: "Hela staven = 1", verktyg: ["flytta"] },
        ],
        mall: { id: "mall", parts: n, kallor: ["s1", "s2"], helhet: "Hela staven = 1" },
        expr: [brak(a, n), { op: "+" }, brak(b, n), { op: "=" }, { input: "summa" }],
      },
      answer: { type: "multi", parts: { mall: { type: "paint", parts: mall }, summa: NUMBER_FRACTION } },
      key: {
        type: "multi",
        parts: { mall: { type: "paint", count: s }, summa: talNyckel(S) },
        display: `${a}/${n} + ${b}/${n} = ${s}/${n}`,
        examples: {
          right: [{ parts: { mall: { selected: mall.slice(0, s) }, summa: falt(s, n) } }, ...(S.d !== n ? [{ parts: { mall: { selected: mall.slice(0, s) }, summa: falt(S.n, S.d) } }] : [])],
          wrong: [
            { parts: { mall: { selected: mall.slice(0, s) }, summa: falt(s, 2 * n) } }, // adderar nämnarna
            { parts: { mall: { selected: mall.slice(0, s) }, summa: falt(s + 1, n) } },
            { parts: { mall: { selected: mall.slice(0, s) }, summa: falt(a * b === s ? s + 2 : a * b, n) } },
          ],
        },
      },
      help: [
        { step: "orientering", text: `Alla stavarna är lika långa: hela staven = 1. De är delade i ${n} lika stora delar.`, highlight: { whole: true } },
        { step: "princip", text: `Det är fortfarande ${del}ar när du lägger ihop dem. Hur många ${del}ar blir det tillsammans? Nämnaren – delarnas storlek – ändras inte.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} + ${ex.b}/${ex.n}. ${ex.a} och ${ex.b} ${partName(ex.n)}ar är ${ex.a + ex.b} ${partName(ex.n)}ar: ${ex.a}/${ex.n} + ${ex.b}/${ex.n} = ${ex.a + ex.b}/${ex.n}.`,
          view: { component: "stav", bars: [{ parts: ex.n, marked: ex.a }, { parts: ex.n, marked: ex.b }, { parts: ex.n, marked: ex.a + ex.b }] },
        },
        { step: "atergang", text: "Nu provar du själv: flytta bitarna till den tomma staven och räkna delarna." },
      ],
      misconceptions: ["adderar-namnarna", "multiplicerar-taljarna", "raknar-fel"],
      feedback: {
        correct: `Ja! ${a} och ${b} ${del}ar är ${fractionWords(s, n)}: ${a}/${n} + ${b}/${n} = ${s}/${n}.`,
        wrong: `Det är ${del}ar hela tiden – delarnas storlek ändras inte. Räkna hur många ${del}ar som ligger i staven.`,
      },
      review: `${a}/${n} + ${b}/${n} = ${s}/${n}${S.d !== n ? ` = ${S.n}/${S.d}` : ""}. Täljarna räknas ihop: ${a} + ${b} = ${s}. Nämnaren ${n} är delarnas storlek och adderas inte.`,
    };
  },

  validate,

  reserve: [
    { slot: "intro", params: { n: 7, a: 2, b: 3 } },
    { slot: "intro", params: { n: 5, a: 1, b: 2 } },
    { slot: "intro", params: { n: 8, a: 3, b: 4 } },
    { slot: "intro", params: { n: 4, a: 1, b: 2 } },
    { params: { n: 9, a: 4, b: 2 } },
    { params: { n: 10, a: 3, b: 5 } },
    { params: { n: 12, a: 5, b: 7 } },
    { params: { n: 6, a: 1, b: 3 } },
    { slot: "vardag", params: { n: 8, a: 3, b: 2, vardag: "staket" } },
    { slot: "vardag", params: { n: 6, a: 2, b: 3, vardag: "tarta" } },
    { slot: "vardag", params: { n: 10, a: 4, b: 3, vardag: "band" } },
  ],
});
