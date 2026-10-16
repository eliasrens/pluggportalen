// ============================================================================
// 37. Multiplicera med heltal (src/brakresan/utmaningar/u37.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 37: heltal gånger bråk som upprepad addition. Överst EN portion
// (a/n på en stav, "Hela staven = 1"), under k lika långa stavramar delade i
// n delar – en ram per kopia. Eleven bygger k kopior (markerar delar, vilka
// som helst) och skriver produkten. EN uppgift, två delsvar (multi):
//   • k · a markerade delar
//   • produkten – likvärdiga svar godtas (inget formkrav): 6/5 och 1 1/5
// Generering: k = 2–5, a/n förkortat äkta bråk med n = 2–8, produkt ≤ 4.
// Överföring: vardagsproblem med längd (meter) eller volym (liter), minst två
// per omgång. Återkopplingen säger att ett HELTAL större än 1 här ökar en
// positiv mängd – inte att multiplikation alltid gör större.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, mul, gcd, formatForm, fractionWords, numberWords } from "../math/index.js";
import { ids, br, blandadText, blandatSvar, falt, nd } from "./delat-g.js";

const SLOTS = ["intro", "intro", "intro", "normal", "normal", "normal", "normal", "overforing", "overforing", "overforing"];

/** Alla (k, a, n): k 2–5, a/n förkortat äkta, n 2–8, k·a/n ≤ 4. */
export const TRIPPLAR = [];
for (let k = 2; k <= 5; k++) {
  for (let n = 2; n <= 8; n++) {
    for (let a = 1; a < n; a++) if (gcd(a, n) === 1 && k * a <= 4 * n) TRIPPLAR.push({ k, a, n });
  }
}

const SITUATIONER = {
  langd: { enhet: "m", text: (k, b) => `Sara klipper ${k} snören som vart och ett är ${b} meter långt. Hur många meter snöre är det tillsammans?` },
  saft: { enhet: "liter", text: (k, b) => `Leo häller upp ${k} glas med ${b} liter saft i varje. Hur många liter saft är det sammanlagt?` },
  band: { enhet: "m", text: (k, b) => `Till en dekoration behövs ${k} band som är ${b} meter vardera. Hur många meter band behövs?` },
  vatten: { enhet: "liter", text: (k, b) => `En vattenkanna rymmer ${b} liter. Ella fyller den ${k} gånger. Hur många liter vatten har hon hällt?` },
};

const kärna = ({ k, a, n }) => `${k}·${a}/${n}`;

export default defineChallenge({
  id: "37",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? TRIPPLAR.filter((t) => t.k <= 3 && t.n <= 5) : TRIPPLAR;
    const t = rng.pick(pool);
    return { ...t, ...(slot === "overforing" ? { situation: rng.pick(Object.keys(SITUATIONER)) } : {}) };
  },

  core: kärna,

  build({ k, a, n, situation = null }) {
    const P = mul(q(k), q(a, n));
    const ka = k * a;
    const delar = ids(k * n);
    const sit = SITUATIONER[situation];
    const bråk = `${a}/${n}`;
    const upprepad = Array.from({ length: k }, () => bråk).join(" + ");
    const svar = blandadText(P);
    const kedja = `${k} · ${bråk} = ${upprepad} = ${ka}/${n}${svar !== `${ka}/${n}` ? ` = ${svar}` : ""}`;
    const ex = k === 2 && a === 3 && n === 4 ? { k: 3, a: 2, n: 5 } : { k: 2, a: 3, n: 4 };
    const exP = mul(q(ex.k), q(ex.a, ex.n));
    const right = [
      { parts: { stav: { selected: delar.slice(0, ka) }, svar: falt(ka, n) } },
      { parts: { stav: { selected: delar.filter((_, i) => i % n < a) }, svar: blandatSvar(P) } },
    ];
    if (P.d !== n || P.d === 1) right.push({ parts: { stav: { selected: delar.slice(0, ka) }, svar: blandatSvar(P, P.d) } });
    const fel = [
      { parts: { stav: { selected: delar.slice(0, ka) }, svar: falt(ka, k * n) } }, //   multiplicerar täljare och nämnare
      { parts: { stav: { selected: delar.slice(0, ka) }, svar: falt(a + k, n) } }, //    adderar heltalet till täljaren
      { parts: { stav: { selected: delar.slice(0, a) }, svar: falt(ka, n) } }, //        bara en kopia byggd
    ].filter((x) => !(x.parts.svar.fields.n * P.d === P.n * x.parts.svar.fields.d && x.parts.stav.selected.length === ka));
    return {
      core: kärna({ k, a, n }),
      prompt: sit
        ? `${sit.text(k, bråk)} Bygg ${numberWords(k)} kopior på stavarna och skriv svaret.`
        : `Räkna ut ${k} · ${bråk}. Bygg ${numberWords(k)} kopior av portionen på stavarna och skriv produkten.`,
      values: { k, portion: { n: a, d: n }, produkt: nd(P) },
      view: {
        component: "sammansatt",
        delar: [
          { view: { component: "stav", parts: n, marked: a, label: sit ? `En portion (hela staven = 1 ${sit.enhet})` : "En portion – hela staven = 1" } },
          {
            view: { component: "stav", wholes: k, parts: n, label: sit ? `Varje stav = 1 ${sit.enhet}` : "Varje stav = 1 hel" },
            svar: "stav",
            label: `Bygg ${numberWords(k)} kopior`,
          },
          { view: { component: "notation", expr: [{ kind: "integer", v: k }, { op: "·" }, br(a, n), { op: "=" }, { input: "svar" }, ...(sit ? [{ text: sit.enhet }] : [])] }, svar: "svar" },
        ],
      },
      answer: { type: "multi", parts: { stav: { type: "paint", parts: delar }, svar: { type: "number", input: "mixed" } } },
      key: {
        type: "multi",
        parts: { stav: { type: "paint", count: ka }, svar: { type: "number", value: nd(P), requirement: { kind: "value" } } },
        display: kedja,
        examples: { right, wrong: fel },
      },
      help: [
        { step: "orientering", text: `Överst är en portion. Varje stav är en hel, delad i ${n} lika delar – samma storlek som portionens delar.`, highlight: { whole: true } },
        { step: "princip", text: `${numberWords(k).replace(/^./, (c) => c.toUpperCase())} gånger betyder ${numberWords(k)} lika stora portioner. Lägg portionerna efter varandra och räkna alla delarna.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.k} · ${ex.a}/${ex.n} = ${Array.from({ length: ex.k }, () => `${ex.a}/${ex.n}`).join(" + ")} = ${ex.k * ex.a}/${ex.n} = ${blandadText(exP)}.`,
          view: { component: "stav", wholes: Math.ceil((ex.k * ex.a) / ex.n), parts: ex.n, marked: ex.k * ex.a },
        },
        { step: "atergang", text: "Nu provar du själv: markera en portion i taget och räkna sedan de fulla stavarna och delarna som blir över." },
      ],
      misconceptions: ["multiplicerar-namnaren", "adderar-heltalet"],
      feedback: {
        correct: `Ja! ${numberWords(k).replace(/^./, (c) => c.toUpperCase())} portioner om ${fractionWords(a, n)}: ${kedja}. Här blev mängden större, eftersom vi tog en positiv mängd flera gånger.`,
        wrong: `${k} · ${bråk} är ${upprepad}. Delarna är fortfarande ${n}-delar – nämnaren ändras inte, men antalet delar blir ${k} · ${a} = ${ka}.`,
      },
      review: `${kedja}. Nämnaren (delens storlek) är densamma; antalet delar multipliceras med ${k}.`,
    };
  },

  reserve: [
    [3, 2, 5], [2, 3, 4], [4, 1, 3], [5, 1, 2], [2, 5, 6], [3, 3, 8], [4, 3, 5], [5, 2, 3], [3, 5, 8], [2, 7, 8], [4, 2, 7],
  ].map(([k, a, n], i) => ({ slot: i < 3 ? "intro" : i >= 8 ? "overforing" : "normal", params: { k, a, n, ...(i >= 8 ? { situation: ["langd", "saft", "vatten"][i - 8] } : {}) } })),
});
