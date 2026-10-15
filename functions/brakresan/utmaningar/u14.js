// ============================================================================
// 14. Förläng bråket (src/brakresan/utmaningar/u14.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 14: likvärdigt bråk med given nämnare. Eleven fyller i faktorn
// (samma tal över och under bråkstrecket) och det förlängda bråket.
//   • förkortat a/b med b = 2–10, faktor 2–5, målnämnare b·f ≤ 40
//   • rätt = faktorn OCH bråket med just nämnaren b·f (requirement
//     "denominator"); 3/4 som slutsvar på 3/4 = ?/12 uppfyller inte
//     instruktionen och får förklaringen "uppgiften ber om nämnaren 12"
//   • omdelningsstaven är frivillig men lätt tillgänglig ("Visa staven")
// Hjälp: "Hur många gånger fler delar blir det totalt? Gör samma förändring i
// de markerade delarna." – en faktorberäkning med andra tal.
// (Specens undantag "100 med hundraruta" används inte: faktorerna 2–5 når aldrig 100.)
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { brakForm, ord } from "./delat-e.js";

export const PAR = [];
for (let b = 2; b <= 10; b++) for (let a = 1; a < b; a++) if (q(a, b).d === b) for (let f = 2; f <= 5; f++) if (b * f <= 40) PAR.push({ a, b, f });

const falt = (x, y) => ({ fields: { n: String(x), d: String(y) } });

export default defineChallenge({
  id: "14",
  version: 1,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? PAR.filter((p) => p.b <= 5 && p.f <= 3) : slot === "overforing" ? PAR.filter((p) => p.b * p.f > 20) : PAR;
    return { ...rng.pick(pool) };
  },

  core: ({ a, b, f }) => `${a}/${b}→${b * f}`,

  build({ a, b, f }) {
    const B = b * f;
    const ex = (a === 2 && b === 5) || b * f === 15 ? { a: 1, b: 3, f: 4 } : { a: 2, b: 5, f: 3 };
    const fx = f === 2 ? 3 : f - 1;
    return {
      core: `${a}/${b}→${B}`,
      prompt: `Förläng ${a}/${b} så att nämnaren blir ${B}. Skriv faktorn och det nya bråket.`,
      values: { start: { n: a, d: b }, faktor: f, ny: { n: a * f, d: B } },
      view: {
        component: "omdelning",
        visaStav: "Visa staven",
        bars: [{ parts: b, marked: a, maxDela: Math.min(5, Math.floor(40 / b)) }],
        expr: [{ text: "Faktor" }, { input: "faktor" }, { text: "→" }, brakForm(a, b), { op: "=" }, { input: "svar" }],
      },
      answer: { type: "multi", parts: { faktor: { type: "number", input: "integer" }, svar: { type: "number", input: "fraction" } } },
      key: {
        type: "multi",
        parts: {
          faktor: { type: "number", value: f, requirement: { kind: "integer" } },
          svar: { type: "number", value: { n: a, d: b }, requirement: { kind: "denominator", d: B } },
        },
        display: `Faktor ${f}: ${a}/${b} = ${a * f}/${B}`,
        examples: {
          right: [{ parts: { faktor: { text: String(f) }, svar: falt(a * f, B) } }],
          wrong: [
            { parts: { faktor: { text: String(f) }, svar: falt(a, b) } }, //               rätt värde, fel nämnare
            { parts: { faktor: { text: String(f) }, svar: falt(a + B - b, B) } }, //       adderar samma tal
            { parts: { faktor: { text: String(f) }, svar: falt(a, B) } }, //               bara nämnaren
            { parts: { faktor: { text: String(fx) }, svar: falt(a * f, B) } }, //          fel faktor
          ],
        },
      },
      help: [
        { step: "orientering", text: `Nämnaren ska bli ${B}. Hur många gånger fler delar blir det totalt?` },
        { step: "princip", text: "Gör samma förändring i de markerade delarna: gånger samma tal över och under bråkstrecket. Då är det lika mycket – bara fler, mindre delar." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.b} = ?/${ex.b * ex.f}. ${ex.b} · ${ex.f} = ${ex.b * ex.f}, så faktorn är ${ex.f}. Täljaren: ${ex.a} · ${ex.f} = ${ex.a * ex.f}. Alltså ${ex.a}/${ex.b} = ${ex.a * ex.f}/${ex.b * ex.f}.`,
          view: { component: "stav", parts: ex.b, marked: ex.a, regroup: ex.f },
        },
        { step: "atergang", text: "Nu provar du själv: vilket tal gånger nämnaren blir den nya nämnaren? Använd samma tal på täljaren." },
      ],
      misconceptions: ["additiv-forlangning", "bara-namnaren", "fel-namnare"],
      feedback: {
        correct: `Ja! Faktorn är ${f}: ${a}/${b} = ${a * f}/${B}. Lika mycket, bara ${f} gånger fler delar.`,
        wrong: `${b} · ${f} = ${B}, så faktorn är ${f}. Samma faktor på täljaren: ${a} · ${f} = ${a * f}. ${a}/${b} = ${a * f}/${B} – lika mycket.`,
      },
      review: `${a}/${b} = ?/${B}: ${B} ÷ ${b} = ${f}. ${a} · ${f} = ${a * f}. ${stor14(ord(a, b))} är lika mycket som ${ord(a * f, B)}.`,
    };
  },

  reserve: [[3, 4, 3], [1, 2, 3], [2, 3, 2], [2, 5, 4], [5, 6, 3], [3, 8, 2], [7, 10, 4], [4, 9, 3], [1, 7, 5], [3, 10, 3], [2, 3, 5]]
    .map(([a, b, f]) => ({ slot: b <= 5 && f <= 3 ? "intro" : b * f > 20 ? "overforing" : "normal", params: { a, b, f } })),
});

function stor14(t) { return `${t[0].toUpperCase()}${t.slice(1)}`; }
