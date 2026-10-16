// ============================================================================
// 35. Subtrahera olika nämnare (src/brakresan/utmaningar/u35.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 35: subtrahera med gemensam delstorlek. Två lika långa stavar visar
// a/n (utgångsstaven) och b/m (det som tas bort). Eleven delar om stavarna
// ("Dela varje bit i k" – helheten och den färgade längden ändras inte),
// markerar borttagningen på UTGÅNGSSTAVEN (klickar bort färgade bitar – samma
// helhet, inte en annan referensstav), skriver de två omskrivna bråken och
// skillnaden. EN uppgift med tre delsvar (multi = en poäng, inga dolda
// delpoäng; borttagningen i bilden är ett verktyg och bedöms inte):
//   • båda omskrivna bråken rätt värde och SAMMA nämnare ≤ 24 – annan gemensam
//     nämnare än den minsta godtas
//   • skillnaden rätt värde (likvärdigt bråk godtas)
// Generering: nämnare 2–8, n ≠ m, minsta gemensamma nämnare ≤ 24,
// a/n ≥ b/m, båda ≤ 1. Slot "noll": en uppgift per omgång ger 0 med olika
// skrivna men likvärdiga bråk (2/4 − 1/2). Återkopplingen påstår aldrig att
// man subtraherar nämnarna.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { q, sub, gcd, lcm, cmp } from "../math/index.js";
import { fractionWords, partName } from "../math/words.js";
import { brak, falt, NUMBER_FRACTION } from "./f-delat.js";

const MAX_LCD = 24;
const DELAR = ["a", "b", "skillnad"];
const SLOTS = ["intro", "intro", "intro", "normal", "normal", "noll", "normal", "overforing", "overforing", "overforing"];

/** Alla par: förkortade äkta bråk, n ≠ m, mgn ≤ 24, a/n > b/m. */
const PAR = [];
/** Lika värden med olika nämnare (noll-uppgifterna), första bråket får vara oförkortat. */
const NOLL = [];
for (let n = 2; n <= 8; n++) {
  for (let m = 2; m <= 8; m++) {
    if (n === m || lcm(n, m) > MAX_LCD) continue;
    for (let a = 1; a < n; a++) {
      for (let b = 1; b < m; b++) {
        const c = cmp(q(a, n), q(b, m));
        if (c === 0) NOLL.push({ a, n, b, m });
        else if (c > 0 && gcd(a, n) === 1 && gcd(b, m) === 1) PAR.push({ a, n, b, m, multipel: n % m === 0 || m % n === 0 });
      }
    }
  }
}
export { PAR as PAR35, NOLL as NOLL35 };

const SITUATIONER = [
  { id: "saft", text: (x, y) => `En kanna är fylld till ${x}. Någon häller ut ${y} av kannan. Hur mycket finns kvar?` },
  { id: "band", text: (x, y) => `${x} av ett band är målat. ${y} av samma band tvättas bort. Hur stor del är fortfarande målad?` },
  { id: "pizza", text: (x, y) => `Det finns ${x} av en pizza. Sam äter ${y} av pizzan. Hur mycket av pizzan är kvar?` },
  { id: "vag", text: (x, y) => `Lea ska gå ${x} av en vandringsled i dag. Hon har gått ${y} av leden. Hur stor del av leden har hon kvar i dag?` },
];

const MEDDELANDE = {
  "olika-namnare": "Bitarna måste vara lika stora innan du tar bort: skriv om båda bråken med samma nämnare.",
  "for-stor-namnare": `Välj en gemensam nämnare som är högst ${MAX_LCD}.`,
  "fel-omskrivning": "Ett omskrivet bråk är inte lika mycket som bråket på staven. Dela varje bit i lika många nya bitar: täljare och nämnare ändras lika många gånger.",
  "fel-skillnad": "Skillnaden stämmer inte. När bitarna är lika stora tar du bort så många bitar – nämnaren, bitarnas storlek, är densamma.",
};

/** Egen bedömning: delarna tolkas var för sig, sedan gäller kraven TILLSAMMANS (som 34). */
function validate(task, answer) {
  const forms = {};
  for (const pid of DELAR) {
    const r = gradeWith(task.answer.parts[pid], task.key.parts[pid], answer?.parts?.[pid]);
    if (r.status === "invalid") {
      const vad = pid === "skillnad" ? "skillnaden" : pid === "a" ? "det första omskrivna bråket" : "det andra omskrivna bråket";
      return { ...r, part: pid, message: r.error === "tom" ? `Fyll i ${vad}.` : `${r.message} (${vad})` };
    }
    forms[pid] = r;
  }
  const fa = forms.a.form;
  const fb = forms.b.form;
  const samma = fa.kind === "fraction" && fb.kind === "fraction" && fa.d === fb.d;
  const lagom = samma && fa.d <= MAX_LCD;
  const aOk = forms.a.correct;
  const bOk = forms.b.correct;
  const diffOk = forms.skillnad.correct;
  const reason = !aOk || !bOk ? "fel-omskrivning" : !samma ? "olika-namnare" : !lagom ? "for-stor-namnare" : !diffOk ? "fel-skillnad" : null;
  return {
    status: "graded", correct: !reason, reason, message: reason ? MEDDELANDE[reason] : null,
    parts: { a: aOk && samma && lagom, b: bOk && samma && lagom, skillnad: diffOk },
  };
}

export default defineChallenge({
  id: "35",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot === "noll") return { ...rng.pick(NOLL) };
    const pool = slot === "intro" ? PAR.filter((p) => p.multipel) : slot === "overforing" ? PAR.filter((p) => !p.multipel) : PAR;
    const { a, n, b, m } = rng.pick(pool);
    return { a, n, b, m, ...(slot === "overforing" ? { situation: rng.pick(SITUATIONER).id } : {}) };
  },

  core: ({ a, n, b, m }) => `${a}/${n}−${b}/${m}`,

  build({ a, n, b, m, situation = null }) {
    const L = lcm(n, m);
    const D = sub(q(a, n), q(b, m));
    const x = a * (L / n);
    const y = b * (L / m);
    const sit = SITUATIONER.find((s) => s.id === situation);
    const key = (v) => ({ type: "number", value: { n: v.n, d: v.d }, requirement: { kind: "value" } });
    const L2 = 2 * L <= MAX_LCD ? 2 * L : null;
    const ex = [n, m].sort().join() === "3,4" ? { a: 5, n: 6, b: 1, m: 2 } : { a: 3, n: 4, b: 1, m: 3 };
    const exL = lcm(ex.n, ex.m);
    const exX = ex.a * (exL / ex.n);
    const exY = ex.b * (exL / ex.m);
    const right = [
      { parts: { a: falt(x, L), b: falt(y, L), skillnad: falt(x - y, L) } },
      ...(D.n > 0 && D.d !== L ? [{ parts: { a: falt(x, L), b: falt(y, L), skillnad: falt(D.n, D.d) } }] : []),
    ];
    if (L2) right.push({ parts: { a: falt(2 * x, L2), b: falt(2 * y, L2), skillnad: falt(2 * (x - y), L2) } });
    const wrong = [
      { parts: { a: falt(a, n), b: falt(b, m), skillnad: falt(x - y, L) } }, //                       olika nämnare kvar
      { parts: { a: falt(x, L), b: falt(y, L), skillnad: falt(x - y + 1, L) } }, //                   räknat fel
      { parts: { a: falt(a, L), b: falt(b, L), skillnad: falt(Math.max(a - b, 0), L) } }, //           byter bara nämnaren
      ...(x !== y ? [{ parts: { a: falt(x, L), b: falt(y, L), skillnad: falt(x - y, Math.abs(n - m) || 1) } }] : []), // drar nämnarna
    ].filter((w) => !(w.parts.a.fields.n === String(x) && w.parts.a.fields.d === String(L) && w.parts.b.fields.d === String(L) &&
      Number(w.parts.skillnad.fields.d) > 0 && cmp(q(Number(w.parts.skillnad.fields.n), Number(w.parts.skillnad.fields.d)), D) === 0));
    const ord = (k, d) => fractionWords(k, d);
    const L_namn = partName(L) ? `${partName(L)}ar` : `${L} lika bitar`;
    return {
      core: `${a}/${n}−${b}/${m}`,
      prompt: sit ? sit.text(`${a}/${n}`, `${b}/${m}`) : `Räkna ut ${a}/${n} − ${b}/${m}. Dela stavarna så att bitarna blir lika stora och ta bort på den översta staven.`,
      values: { A: q(a, n), B: q(b, m), diff: { n: D.n, d: D.d }, lcd: L },
      view: {
        component: "verkstad",
        stavar: [
          { id: "s1", parts: n, marked: a, namn: brak(a, n), helhet: "Hela staven = 1", verktyg: ["dela", "bort"], maxDela: Math.floor(MAX_LCD / n) },
          { id: "s2", parts: m, marked: b, monster: "b", namn: brak(b, m), helhet: "Det som tas bort", verktyg: ["dela"], maxDela: Math.floor(MAX_LCD / m) },
        ],
        expr: [brak(a, n), { op: "−" }, brak(b, m), { op: "=" }, { input: "a" }, { op: "−" }, { input: "b" }, { op: "=" }, { input: "skillnad" }],
      },
      answer: { type: "multi", parts: { a: NUMBER_FRACTION, b: NUMBER_FRACTION, skillnad: NUMBER_FRACTION } },
      key: {
        type: "multi",
        parts: { a: key(q(a, n)), b: key(q(b, m)), skillnad: key(D) },
        display: `${a}/${n} − ${b}/${m} = ${x}/${L} − ${y}/${L} = ${x - y}/${L}`,
        examples: { right, wrong },
      },
      help: [
        { step: "orientering", text: "Båda stavarna är lika långa: hela staven = 1. Den översta är det du har, den nedre det som ska bort. Bitarna är olika stora.", highlight: { whole: true } },
        { step: "princip", text: "Jämför delstorlekarna. Gör bitarna lika stora i båda stavarna – dela varje bit i lika många nya. Ta sedan bort rätt antal bitar på den översta staven." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} − ${ex.b}/${ex.m}. Med ${partName(exL)}ar: ${exX}/${exL} − ${exY}/${exL} = ${exX - exY}/${exL}. ` +
            "Nämnaren är bitarnas storlek – den ändras inte när bitar tas bort.",
          view: { component: "stav", bars: [{ parts: exL, marked: exX }, { parts: exL, marked: exY }, { parts: exL, marked: exX - exY }] },
        },
        { step: "atergang", text: "Nu provar du själv: vilken bitstorlek går att få i båda stavarna? Dela, ta bort och skriv bråken." },
      ],
      misconceptions: ["subtraherar-namnarna", "olika-delstorlek", "byter-bara-namnaren"],
      feedback: {
        correct: x === y
          ? `Ja! ${a}/${n} och ${b}/${m} är lika mycket – ${x}/${L} båda två – så inget blir kvar: skillnaden är 0.`
          : `Ja! Med lika stora bitar: ${ord(x, L)} minus ${ord(y, L)} är ${ord(x - y, L)}.`,
        wrong: `Gör bitarna lika stora först. Med ${L_namn} blir ${a}/${n} = ${x}/${L} och ${b}/${m} = ${y}/${L} – sedan tar du bort bitar.`,
      },
      review: `${a}/${n} − ${b}/${m} = ${x}/${L} − ${y}/${L} = ${x - y}/${L}${x === y ? " = 0" : D.d !== L ? ` = ${D.n}/${D.d}` : ""}. ` +
        `Båda stavarna delas i ${L} lika bitar; ${y} bitar tas bort från ${x}.`,
    };
  },

  validate,

  reserve: [
    { slot: "intro", params: { a: 3, n: 4, b: 1, m: 2 } },
    { slot: "intro", params: { a: 5, n: 6, b: 1, m: 3 } },
    { slot: "intro", params: { a: 7, n: 8, b: 1, m: 4 } },
    { slot: "intro", params: { a: 1, n: 2, b: 1, m: 6 } },
    { slot: "noll", params: { a: 2, n: 4, b: 1, m: 2 } },
    { slot: "noll", params: { a: 2, n: 6, b: 1, m: 3 } },
    { slot: "noll", params: { a: 6, n: 8, b: 3, m: 4 } },
    { params: { a: 3, n: 4, b: 1, m: 6 } },
    { params: { a: 2, n: 3, b: 1, m: 4 } },
    { slot: "overforing", params: { a: 4, n: 5, b: 1, m: 2, situation: "saft" } },
    { slot: "overforing", params: { a: 5, n: 6, b: 3, m: 4, situation: "band" } },
    { slot: "overforing", params: { a: 7, n: 8, b: 2, m: 3, situation: "pizza" } },
  ],
});
