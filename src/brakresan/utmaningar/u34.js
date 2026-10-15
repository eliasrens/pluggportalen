// ============================================================================
// 34. Addera olika nämnare (src/brakresan/utmaningar/u34.js) · #709 D
// ----------------------------------------------------------------------------
// Spec §8 34: förstå och använda gemensam delstorlek. Två lika långa stavar
// visar a/n och b/m. Eleven delar om stavarna (verktyget "Dela varje bit i …"
// behåller helheten och den färgade längden), skriver de två omskrivna
// bråken och summan. EN uppgift med tre delsvar (multi = en poäng, inga
// dolda delpoäng):
//   • båda omskrivna bråken har rätt värde och SAMMA nämnare ≤ 24 – annan
//     gemensam nämnare än den minsta godtas
//   • summan har rätt värde (likvärdigt bråk godtas, förkortning begärs inte)
// Generering: nämnare 2–8, minsta gemensamma nämnare ≤ 24, summan ≤ 1;
// intro = tre par där en nämnare är multipel av den andra, överföring = kort
// vardagssituation på samma band/stav.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { q, add, gcd, lcm } from "../math/index.js";
import { fractionWords, partName } from "../math/words.js";

const MAX_LCD = 24;
const DELAR = ["a", "b", "summa"];
const NUMBER = { type: "number", input: "fraction" };

/** Alla tillåtna par (reducerade, äkta bråk, n ≠ m, mgn ≤ 24, summa ≤ 1), n < m eller tvärtom. */
const PAR = [];
for (let n = 2; n <= 8; n++) {
  for (let m = 2; m <= 8; m++) {
    if (n === m || lcm(n, m) > MAX_LCD) continue;
    for (let a = 1; a < n; a++) {
      for (let b = 1; b < m; b++) {
        if (gcd(a, n) !== 1 || gcd(b, m) !== 1) continue;
        if (a * m + b * n > n * m) continue; // summan ≤ 1
        PAR.push({ a, n, b, m, multipel: n % m === 0 || m % n === 0 });
      }
    }
  }
}
export { PAR };

const SITUATIONER = [
  { id: "band", text: (x, y) => `Ella målar ${x} av ett band blått och ${y} av samma band rött. Hur stor del av bandet är målad?` },
  { id: "staket", text: (x, y) => `Omar målar ${x} av ett staket på morgonen och ${y} av samma staket på kvällen. Hur stor del har han målat?` },
  { id: "choklad", text: (x, y) => `Sara äter ${x} av en chokladkaka och Leo äter ${y} av samma kaka. Hur stor del av kakan har de ätit?` },
  { id: "planka", text: (x, y) => `På en planka slipas först ${x} och sedan ${y} av samma planka. Hur stor del är slipad?` },
];

const brak = (n, d) => ({ kind: "fraction", n, d });
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

/** Hur många nya bitar varje bit högst kan delas i (stavens verktyg): n·k ≤ 24. */
export const maxDela = (n) => Math.floor(MAX_LCD / n);

const MEDDELANDE = {
  "olika-namnare": "Bitarna måste vara lika stora innan du räknar ihop dem: skriv om båda bråken med samma nämnare.",
  "for-stor-namnare": `Välj en gemensam nämnare som är högst ${MAX_LCD}.`,
  "fel-omskrivning": "Ett omskrivet bråk är inte lika mycket som bråket på staven. Dela varje bit i lika många nya bitar: täljare och nämnare ändras lika många gånger.",
  "fel-summa": "Summan stämmer inte. När bitarna är lika stora räknar du ihop täljarna – nämnaren (bitarnas storlek) ändras inte.",
};

/** Egen bedömning: delarna tolkas var för sig, sedan gäller kraven TILLSAMMANS. */
function validate(task, answer) {
  const forms = {};
  for (const pid of DELAR) {
    const r = gradeWith(task.answer.parts[pid], task.key.parts[pid], answer?.parts?.[pid]);
    if (r.status === "invalid") {
      const vad = pid === "summa" ? "summan" : pid === "a" ? "det första omskrivna bråket" : "det andra omskrivna bråket";
      return { ...r, part: pid, message: r.error === "tom" ? `Fyll i ${vad}.` : `${r.message} (${vad})` };
    }
    forms[pid] = r;
  }
  const fa = forms.a.form;
  const fb = forms.b.form;
  const aOk = forms.a.correct;
  const bOk = forms.b.correct;
  const samma = fa.kind === "fraction" && fb.kind === "fraction" && fa.d === fb.d;
  const lagom = samma && fa.d <= MAX_LCD;
  const sumOk = forms.summa.correct;
  const parts = { a: aOk && samma && lagom, b: bOk && samma && lagom, summa: sumOk };
  const reason = !aOk || !bOk ? "fel-omskrivning" : !samma ? "olika-namnare" : !lagom ? "for-stor-namnare" : !sumOk ? "fel-summa" : null;
  return { status: "graded", correct: !reason, reason, message: reason ? MEDDELANDE[reason] : null, parts };
}

export default defineChallenge({
  id: "34",
  version: 1,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? PAR.filter((p) => p.multipel) : slot === "overforing" ? PAR.filter((p) => !p.multipel) : PAR;
    const { a, n, b, m } = rng.pick(pool);
    return { a, n, b, m, ...(slot === "overforing" ? { situation: rng.pick(SITUATIONER).id } : {}) };
  },

  core: ({ a, n, b, m }) => (n < m ? `${a}/${n}+${b}/${m}` : `${b}/${m}+${a}/${n}`),

  build({ a, n, b, m, situation = null }) {
    const L = lcm(n, m);
    const A = q(a, n);
    const B = q(b, m);
    const S = add(A, B);
    const x = a * (L / n);
    const y = b * (L / m);
    const sit = SITUATIONER.find((s) => s.id === situation);
    const key = (v) => ({ type: "number", value: { n: v.n, d: v.d }, requirement: { kind: "value" } });
    const L2 = 2 * L <= MAX_LCD ? 2 * L : null;
    // Exemplet i hjälpen har andra tal än uppgiften.
    const ex = [n, m].sort().join() === "2,8" ? { a: 1, n: 3, b: 1, m: 6 } : { a: 1, n: 2, b: 1, m: 8 };
    const exL = lcm(ex.n, ex.m);
    const ord = (k, d) => fractionWords(k, d);
    const right = [
      { parts: { a: falt(x, L), b: falt(y, L), summa: falt(x + y, L) } },
      { parts: { a: falt(x, L), b: falt(y, L), summa: falt(S.n, S.d) } },
    ];
    if (L2) right.push({ parts: { a: falt(2 * x, L2), b: falt(2 * y, L2), summa: falt(2 * (x + y), L2) } });
    const wrong = [
      { parts: { a: falt(a, n), b: falt(b, m), summa: falt(S.n, S.d) } }, //           olika nämnare kvar
      { parts: { a: falt(x, L), b: falt(y, L), summa: falt(a + b, n + m) } }, //     adderar nämnarna
      { parts: { a: falt(a, L), b: falt(b, L), summa: falt(a + b, L) } }, //         byter bara nämnaren
      { parts: { a: falt(x, L), b: falt(y, L), summa: falt(x + y, 2 * L) } }, //     adderar nämnarna på omskrivna
    ];
    return {
      core: n < m ? `${a}/${n}+${b}/${m}` : `${b}/${m}+${a}/${n}`,
      prompt: sit ? sit.text(`${a}/${n}`, `${b}/${m}`) : `Räkna ut ${a}/${n} + ${b}/${m}. Dela stavarna så att bitarna blir lika stora.`,
      values: { A: { n: A.n, d: A.d }, B: { n: B.n, d: B.d }, sum: { n: S.n, d: S.d }, lcd: L },
      view: {
        component: "omdelning",
        // maxDela = största k i "Dela varje bit i k" (stavens nya nämnare ≤ 24).
        bars: [{ parts: n, marked: a, label: `${a}/${n}`, maxDela: maxDela(n) }, { parts: m, marked: b, label: `${b}/${m}`, maxDela: maxDela(m) }],
        expr: [brak(a, n), { op: "+" }, brak(b, m), { op: "=" }, { input: "a" }, { op: "+" }, { input: "b" }, { op: "=" }, { input: "summa" }],
      },
      answer: { type: "multi", parts: { a: NUMBER, b: NUMBER, summa: NUMBER } },
      key: {
        type: "multi",
        parts: { a: key(A), b: key(B), summa: key(S) },
        display: `${a}/${n} + ${b}/${m} = ${x}/${L} + ${y}/${L} = ${x + y}/${L}`,
        examples: { right, wrong },
      },
      help: [
        { step: "orientering", text: "Båda stavarna är lika långa: hela staven = 1. Titta på bitarna – de är olika stora.", highlight: { whole: true } },
        { step: "princip", text: "Gör bitarna lika stora innan du räknar dem tillsammans. Dela varje bit i lika många nya bitar – då är lika mycket färgat som förut." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} + ${ex.b}/${ex.m}. Dela bitarna tills båda stavarna har ${partName(exL)}ar: ` +
            `${ex.a * exL / ex.n}/${exL} + ${ex.b * exL / ex.m}/${exL} = ${ex.a * exL / ex.n + ex.b * exL / ex.m}/${exL}.`,
          view: { component: "stav", bars: [{ parts: exL, marked: ex.a * exL / ex.n }, { parts: exL, marked: ex.b * exL / ex.m }] },
        },
        { step: "atergang", text: "Nu provar du själv: vilken bitstorlek går att få i båda stavarna? Dela stavarna med knapparna och skriv bråken." },
      ],
      misconceptions: ["adderar-namnarna", "olika-delstorlek", "byter-bara-namnaren"],
      feedback: {
        correct: `Ja! När bitarna är lika stora kan du räkna dem: ${ord(x, L)} och ${ord(y, L)} är ${ord(x + y, L)}.`,
        wrong: `Gör bitarna lika stora först. Med ${partName(L) ? `${partName(L)}ar` : `${L} lika delar`} blir ${a}/${n} = ${x}/${L} lättare att lägga ihop med ${b}/${m}.`,
      },
      review: `${a}/${n} + ${b}/${m} = ${x}/${L} + ${y}/${L} = ${x + y}/${L}${S.d !== L ? ` = ${S.n}/${S.d}` : ""}. Båda stavarna delas i ${L} lika bitar innan bitarna räknas ihop.`,
    };
  },

  validate,
  minVariants: 40,
  minVariantsReason: "Spec §8 34 (nämnare 2–8, minsta gemensamma nämnare ≤ 24, summa ≤ 1, äkta förkortade bråk) " +
    "ger exakt 42 olika talpar (PAR). Överföringsuppgifterna varierar dessutom situationen (fyra sorter).",

  reserve: [
    { slot: "intro", params: { a: 1, n: 2, b: 1, m: 4 } },
    { slot: "intro", params: { a: 1, n: 3, b: 1, m: 6 } },
    { slot: "intro", params: { a: 1, n: 4, b: 3, m: 8 } },
    { slot: "intro", params: { a: 1, n: 2, b: 1, m: 6 } },
    { params: { a: 1, n: 2, b: 1, m: 3 } },
    { params: { a: 1, n: 4, b: 2, m: 3 } },
    { params: { a: 1, n: 5, b: 1, m: 2 } },
    { params: { a: 3, n: 8, b: 1, m: 6 } },
    { slot: "overforing", params: { a: 1, n: 3, b: 1, m: 4, situation: "band" } },
    { slot: "overforing", params: { a: 2, n: 5, b: 1, m: 2, situation: "choklad" } },
    { slot: "overforing", params: { a: 1, n: 6, b: 3, m: 4, situation: "staket" } },
    { slot: "overforing", params: { a: 1, n: 8, b: 2, m: 3, situation: "planka" } },
  ],
});
