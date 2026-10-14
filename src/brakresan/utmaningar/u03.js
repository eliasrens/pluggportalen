// ============================================================================
// 03. Måla bråket (src/brakresan/utmaningar/u03.js) · #709 D
// ----------------------------------------------------------------------------
// Spec §8 03: konstruera en given andel. Modellen är redan indelad i n lika
// delar; eleven klickar/avmarkerar delar och kontrollerar. Rätt = antalet
// markerade delar är a, oavsett VILKA delar (paint, bedomning.js).
//   • nämnare 2–10, täljare 1–n
//   • minst fyra cirklar och fyra rektanglar per omgång, två fria variationer
//     (stav eller rektangel i två rader) – se SLOTS
//   • ingen "3/5 markerat"-etikett före kontroll (komponenten visar bara
//     "Valda: …" neutralt); efter kontroll märker omgångsvyn modellen med det
//     bråk eleven faktiskt byggde
// Hjälp: helheten, vad nämnaren betyder, ett exempel med ANDRA tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { fractionWords } from "../math/words.js";

const SLOTS = ["intro-cirkel", "intro-rektangel", "intro-cirkel", "cirkel", "rektangel", "cirkel", "rektangel",
  "rektangel", "fri", "fri"];

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
const MODELL = {
  cirkel: { namn: "cirkeln", helhet: "Hela cirkeln = 1" },
  rektangel: { namn: "rektangeln", helhet: "Hela rektangeln = 1" },
  rader: { namn: "rektangeln", helhet: "Hela rektangeln = 1" },
  stav: { namn: "staven", helhet: "Hela staven = 1" },
};

/** Exemplet i hjälpen: ett annat bråk (annan nämnare och annan täljare) på samma sorts modell. */
function exempel(a, n) {
  const m = n <= 5 ? n + 2 : n - 2;
  let b = Math.max(1, Math.min(m - 1, a === 1 ? 2 : a - 1));
  // Varken samma täljare eller samma värde (3/6 som exempel till 4/8 vore samma andel).
  if (b === a || b * n === a * m) b = b > 1 ? b - 1 : b + 1;
  return { b, m };
}

function viewFor(shape, n, opts = {}) {
  const label = MODELL[shape].helhet;
  if (shape === "cirkel") return { component: "cirkel", parts: n, label, ...opts };
  if (shape === "stav") return { component: "stav", parts: n, label, ...opts };
  if (shape === "rader") return { component: "rutnat", rows: 2, cols: n / 2, label, ...opts };
  return { component: "rutnat", rows: 1, cols: n, label, ...opts };
}

export default defineChallenge({
  id: "03",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot.startsWith("intro")) {
      const n = rng.int(2, 5);
      return { shape: slot === "intro-cirkel" ? "cirkel" : "rektangel", n, a: rng.int(1, n - 1) };
    }
    const n = rng.int(2, 10);
    // a = n (hela figuren) förekommer men sällan – det är också "en hel".
    const a = rng.chance(0.08) ? n : rng.int(1, n - 1);
    if (slot === "fri") {
      const shape = n % 2 === 0 && n >= 4 && rng.chance(0.5) ? "rader" : "stav";
      return { shape, n, a };
    }
    return { shape: slot, n, a };
  },

  core: ({ shape, n, a }) => `${shape}-${a}/${n}`,

  build({ shape, n, a }) {
    const parts = ids(n);
    const m = MODELL[shape];
    const ord = fractionWords(a, n);
    const ex = exempel(a, n);
    const exShape = shape === "rader" ? "rektangel" : shape;
    const fel = [];
    if (a < n) fel.push({ selected: parts.slice(0, a + 1) });
    if (a > 1) fel.push({ selected: parts.slice(0, a - 1) });
    if (n - a !== a && n - a > 0) fel.push({ selected: parts.slice(0, n - a) }); // målar de omålade
    return {
      core: `${shape}-${a}/${n}`,
      prompt: `Måla ${a}/${n} av ${m.namn}.`,
      values: { target: { n: a, d: n }, parts: n },
      view: viewFor(shape, n),
      answer: { type: "paint", parts },
      key: {
        type: "paint",
        count: a,
        display: `${a} av ${n} delar målade`,
        examples: {
          // Flera olika rätta markeringsmönster (§15): först, sist, varannan.
          right: [
            { selected: parts.slice(0, a) },
            { selected: parts.slice(n - a) },
            { selected: parts.filter((_, i) => i % 2 === 0).concat(parts.filter((_, i) => i % 2 === 1)).slice(0, a) },
          ],
          wrong: fel,
        },
      },
      help: [
        { step: "orientering", text: `Hela ${m.namn} är en hel. Räkna alla delarna – de är lika stora.`, highlight: { whole: true, count: true } },
        { step: "princip", text: "Talet under bråkstrecket, nämnaren, säger hur många lika stora delar helheten är delad i. Talet över, täljaren, säger hur många av dem du ska måla." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.b}/${ex.m} betyder ${ex.b} av ${ex.m} lika stora delar. Här är ${ex.b} delar målade.`,
          view: viewFor(exShape, ex.m, { marked: ex.b, label: MODELL[exShape].helhet }),
        },
        { step: "atergang", text: "Nu provar du själv: titta på täljaren och måla så många delar. Vilka delar spelar ingen roll." },
      ],
      misconceptions: ["raknar-omarkerade", "taljare-namnare-ombytt", "fel-antal"],
      feedback: {
        correct: `Ja! ${a} av ${n} lika stora delar är ${ord}.`,
        wrong: `${ord[0].toUpperCase()}${ord.slice(1)} betyder ${a} av de ${n} lika stora delarna. Räkna hur många du målade.`,
      },
      review: `${a}/${n}: helheten är delad i ${n} lika stora delar (nämnaren). Måla ${a} av dem (täljaren) – vilka som helst.`,
    };
  },

  reserve: [
    { slot: "intro-cirkel", params: { shape: "cirkel", n: 2, a: 1 } },
    { slot: "intro-cirkel", params: { shape: "cirkel", n: 4, a: 3 } },
    { slot: "intro-cirkel", params: { shape: "cirkel", n: 5, a: 2 } },
    { slot: "intro-rektangel", params: { shape: "rektangel", n: 3, a: 2 } },
    { slot: "intro-rektangel", params: { shape: "rektangel", n: 4, a: 1 } },
    { slot: "cirkel", params: { shape: "cirkel", n: 8, a: 5 } },
    { slot: "cirkel", params: { shape: "cirkel", n: 6, a: 1 } },
    { slot: "cirkel", params: { shape: "cirkel", n: 10, a: 7 } },
    { slot: "rektangel", params: { shape: "rektangel", n: 7, a: 4 } },
    { slot: "rektangel", params: { shape: "rektangel", n: 9, a: 2 } },
    { slot: "rektangel", params: { shape: "rektangel", n: 10, a: 3 } },
    { slot: "fri", params: { shape: "stav", n: 6, a: 5 } },
    { slot: "fri", params: { shape: "rader", n: 8, a: 3 } },
    { slot: "fri", params: { shape: "stav", n: 9, a: 4 } },
  ],
});
