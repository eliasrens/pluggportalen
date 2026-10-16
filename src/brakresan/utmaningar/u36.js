// ============================================================================
// 36. Räkna över en hel (src/brakresan/utmaningar/u36.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 36: räkna när flera helheter och bråkdelar behövs. Tre lika långa
// stavar (varje stav = 1) delade i L delar. Staven visar det första talet;
// eleven bygger på (addition: markera fler delar) eller tar bort
// (subtraktion: avmarkera delar) och skriver svaret i blandad form. EN uppgift
// med två delsvar (multi = en poäng):
//   • stavens markerade delar = resultatet (vilka delar som helst)
//   • svaret i blandad form (kravet "mixed", bråkdelen behöver inte förkortas –
//     målet här är att gå över en hel, inte att förkorta)
// Generering: fem additioner och fem subtraktioner, värden 0–3, nämnare 2–8,
// gemensam nämnare L ≤ 12 (≤ 24 i specen; 12 håller stavdelarna klickbara på
// tre stavar). Alla additioner går över en hel (resultat > 1), alla
// subtraktioner kräver att en hel bryts upp. Inga heltalsresultat, inga noll.
// Hjälp: "En hel kan skrivas som fyra fjärdedelar" – ingen osynlig låning.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, add, sub, lcm, cmp, eq, formatForm, partName, fractionWords } from "../math/index.js";
import { ids, formAv, blandadText, blandadMed, blandatSvar, nd } from "./delat-g.js";

const SLOTS = ["plus", "minus", "plus", "minus", "plus", "minus", "plus", "minus", "plus", "minus"];
const HELA = 3;      // stavar i byggmodellen (värden 0–3)
const MAX_L = 12;    // delar per stav

/** Alla tillåtna tal W + x/n (0 < värde ≤ 3, äkta förkortad bråkdel eller heltal ≥ 1). */
function tal(n) {
  const ut = [];
  for (let W = 0; W <= 2; W++) {
    for (let x = 0; x < n; x++) {
      if (x > 0 && gcd2(x, n) !== 1) continue;
      if (W === 0 && x === 0) continue;
      ut.push({ W, x, n });
    }
  }
  ut.push({ W: 3, x: 0, n });
  return ut;
}
const gcd2 = (a, b) => (b ? gcd2(b, a % b) : a);
const varde = (t) => add(q(t.W), q(t.x, t.n));

/** Alla tillåtna uppgifter, uppdelade i plus/minus. */
const UPPGIFTER = { plus: [], minus: [] };
for (let n = 2; n <= 8; n++) {
  for (let m = 2; m <= 8; m++) {
    const L = lcm(n, m);
    if (L > MAX_L) continue;
    for (const A of tal(n)) {
      for (const B of tal(m)) {
        if (A.x === 0 && B.x === 0) continue;
        if (n !== m && (A.x === 0 || B.x === 0)) continue; // olika nämnare bara när båda har en bråkdel
        const a = varde(A);
        const b = varde(B);
        // Plus: bråkdelarna räcker till mer än en hel, summan ≤ 3 och inget heltal.
        const s = add(a, b);
        if (A.x && B.x && cmp(add(q(A.x, n), q(B.x, m)), q(1)) > 0 && cmp(s, q(HELA)) <= 0 && s.d !== 1 && n <= m) {
          UPPGIFTER.plus.push({ op: "+", A, B, L });
        }
        // Minus: den borttagna bråkdelen är större än startens – en hel måste brytas.
        const d = sub(a, b);
        if (B.x && A.W > B.W && cmp(q(B.x, m), q(A.x, n)) > 0 && d.n > 0 && d.d !== 1) {
          UPPGIFTER.minus.push({ op: "−", A, B, L });
        }
      }
    }
  }
}
export { UPPGIFTER };

const tt = (t) => formatForm(formAv(t.W, t.x, t.n));
const resultat = ({ op, A, B }) => (op === "+" ? add(varde(A), varde(B)) : sub(varde(A), varde(B)));
const kärna = ({ op, A, B }) => (op === "+" ? [tt(A), tt(B)].sort().join("+") : `${tt(A)}−${tt(B)}`);

/** Exempel i hjälpen med andra tal: [A, B, R, L] för samma räknesätt. */
const EXEMPEL = {
  "+": [[{ W: 0, x: 2, n: 3 }, { W: 0, x: 2, n: 3 }], [{ W: 1, x: 3, n: 5 }, { W: 0, x: 4, n: 5 }]],
  "−": [[{ W: 2, x: 1, n: 3 }, { W: 0, x: 2, n: 3 }], [{ W: 1, x: 1, n: 5 }, { W: 0, x: 3, n: 5 }]],
};

export default defineChallenge({
  id: "36",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const lista = UPPGIFTER[slot];
    // Första plus/minus i omgången: samma nämnare (introduktion), sedan blandat.
    const pool = index < 2 ? lista.filter((u) => u.A.n === u.B.n) : rng.chance(0.3) ? lista.filter((u) => u.A.n !== u.B.n) : lista;
    const u = rng.pick(pool);
    return { op: u.op, A: { ...u.A }, B: { ...u.B } };
  },

  core: kärna,

  build({ op, A, B }) {
    const L = lcm(A.n, B.n);
    const a = varde(A);
    const b = varde(B);
    const R = resultat({ op, A, B });
    const RL = (R.n * L) / R.d;
    const aL = (a.n * L) / a.d;
    const bL = (b.n * L) / b.d;
    const plus = op === "+";
    const del = partName(L);
    const delar = ids(HELA * L);
    const uttryck = `${tt(A)} ${op} ${tt(B)}`;
    const svarL = blandadMed(R, L);
    const svarR = blandadText(R);
    const kedja = svarL === svarR ? svarR : `${svarL} = ${svarR}`;
    const ex = EXEMPEL[op].find(([x, y]) => kärna({ op, A: x, B: y }) !== kärna({ op, A, B }) && x.n !== L);
    const exR = plus ? add(varde(ex[0]), varde(ex[1])) : sub(varde(ex[0]), varde(ex[1]));
    const exL = ex[0].n;
    const exStart = (varde(ex[0]).n * exL) / varde(ex[0]).d;
    const exSlut = (exR.n * exL) / exR.d;

    // Felsvar: bråkform i stället för blandad form, vanliga missuppfattningar, fel antal delar.
    const fel = [];
    const overEn = R.n > R.d;
    // Samma värde skrivet som bråk utan heltal (formkravet: blandad form).
    if (overEn) fel.push({ parts: { stav: { selected: delar.slice(0, RL) }, svar: { fields: { whole: "", n: String(RL), d: String(L) } } } });
    if (plus) {
      // Adderar täljare och nämnare i bråkdelen: 3/4 + 3/4 = 6/8.
      const v = add(q(A.W + B.W), q(A.x * (L / A.n) + B.x * (L / B.n), 2 * L));
      if (!eq(v, R)) fel.push({ parts: { stav: { selected: delar.slice(0, RL) }, svar: blandatSvar(v) } });
      // Glömmer att samla till en hel: hela + bråkdelarna utan växling (värdet blir rätt men formen fel = ej-blandad, se ovan).
    } else {
      // Osynlig "låning" baklänges: hela minus hela, bråkdel minus bråkdel åt andra hållet.
      const v = add(q(A.W - B.W), sub(q(B.x, B.n), q(A.x, A.n)));
      if (!eq(v, R) && v.n > 0) fel.push({ parts: { stav: { selected: delar.slice(0, RL) }, svar: blandatSvar(v) } });
    }
    const felAntal = RL + 1 <= HELA * L ? RL + 1 : RL - 1;
    fel.push({ parts: { stav: { selected: delar.slice(0, felAntal) }, svar: blandatSvar(R, L) } });

    return {
      core: kärna({ op, A, B }),
      prompt: plus
        ? `Räkna ut ${uttryck}. Staven visar ${tt(A)}. Markera ${tt(B)} till och skriv svaret i blandad form.`
        : `Räkna ut ${uttryck}. Staven visar ${tt(A)}. Ta bort ${tt(B)} genom att avmarkera delar, och skriv svaret i blandad form.`,
      values: { A: nd(a), B: nd(b), R: nd(R), L, op },
      view: {
        component: "sammansatt",
        delar: [
          {
            view: { component: "stav", wholes: HELA, parts: L, marked: aL, label: `Varje stav = 1 hel = ${L} ${del ? `${del}ar` : "delar"}` },
            svar: "stav",
            label: plus ? "Markera fler delar" : "Avmarkera delar",
          },
          { view: { component: "notation", expr: [formAv(A.W, A.x, A.n), { op }, formAv(B.W, B.x, B.n), { op: "=" }, { input: "svar" }] }, svar: "svar" },
        ],
      },
      answer: { type: "multi", parts: { stav: { type: "paint", parts: delar }, svar: { type: "number", input: "mixed" } } },
      key: {
        type: "multi",
        parts: {
          stav: { type: "paint", count: RL },
          svar: { type: "number", value: nd(R), requirement: { kind: "mixed", simplified: false } },
        },
        display: `${uttryck} = ${kedja}`,
        examples: {
          right: [
            { parts: { stav: { selected: delar.slice(0, RL) }, svar: blandatSvar(R) } },
            { parts: { stav: { selected: delar.slice(HELA * L - RL) }, svar: blandatSvar(R, L) } },
          ],
          wrong: fel,
        },
      },
      help: [
        { step: "orientering", text: `Varje stav är en hel, delad i ${L} lika delar. Staven visar ${tt(A)}: hela stavar och en del av nästa.`, highlight: { whole: true, del: 0 } },
        plus
          ? { step: "princip", text: `En hel kan skrivas som ${fractionWords(L, L)}. När delarna fyller en hel stav kan du samla dem till en hel.` }
          : { step: "princip", text: `Räcker inte delarna i den sista staven? Bryt en hel stav i ${L} delar – en hel är ${fractionWords(L, L)}. Ta sedan bort.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${tt(ex[0])} ${op} ${tt(ex[1])}. ${plus ? "Lägg till delarna – när en stav blir full är det en hel." : "Bryt en hel stav i delar och ta bort."} Det blir ${blandadText(exR)}.`,
          view: { component: "stav", wholes: 2, parts: exL, marked: plus ? exSlut : exStart },
        },
        { step: "atergang", text: plus ? "Nu provar du själv: markera fler delar, räkna de fulla stavarna och delarna som blir över." : "Nu provar du själv: avmarkera delar – bryt en hel om det behövs – och räkna det som är kvar." },
      ],
      misconceptions: plus ? ["adderar-namnarna", "vaxlar-inte-till-hel"] : ["osynlig-laning", "tar-mindre-fran-storre"],
      feedback: {
        correct: plus
          ? `Ja! Delarna fyllde mer än en stav: ${uttryck} = ${kedja}.`
          : `Ja! En hel bröts upp i ${L} delar innan du tog bort: ${uttryck} = ${kedja}.`,
        wrong: plus
          ? `${uttryck}: räkna alla delarna – ${RL} ${del ? `${del}ar` : "delar"}. ${L} delar är en hel, så det blir ${kedja}.`
          : `${uttryck}: bryt en hel i ${L} delar så att det finns nog att ta bort. Kvar blir ${RL} delar = ${kedja}.`,
      },
      review: `${uttryck} = ${kedja}. ${plus ? `Delarna samlas till hela: ${L} delar = 1 hel.` : `En hel bryts upp i ${L} delar innan delarna tas bort.`}` +
        (overEn ? ` Svaret skrivs i blandad form, inte som ${RL}/${L}.` : ""),
    };
  },

  reserve: [
    ["+", [0, 3, 4], [0, 3, 4]], ["+", [0, 2, 3], [0, 2, 3]], ["+", [1, 3, 5], [0, 4, 5]], ["+", [0, 5, 6], [0, 1, 2]], ["+", [1, 7, 8], [0, 3, 8]],
    ["−", [2, 1, 4], [0, 3, 4]], ["−", [1, 1, 3], [0, 2, 3]], ["−", [3, 0, 5], [1, 2, 5]], ["−", [2, 1, 6], [0, 1, 2]], ["−", [2, 3, 8], [1, 5, 8]],
  ].map(([op, [Wa, xa, na], [Wb, xb, nb]]) => ({ slot: op === "+" ? "plus" : "minus", params: { op, A: { W: Wa, x: xa, n: na }, B: { W: Wb, x: xb, n: nb } } })),
});
