// ============================================================================
// 21. Förkorta bråket (src/brakresan/utmaningar/u21.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 21: gruppering som motsats till omdelning, svaret i enklaste form.
// En stav visar a/n (n = q·k små bitar, a = p·k färgade). Verktyget "Slå ihop
// g bitar till en" grupperar ALLA bitar med samma g (bara g som går jämnt upp
// i n); blir en grupp delvis färgad säger verktyget det i stället för att
// påstå en färdig förkortning. Eleven skriver det förkortade bråket.
//   • basbråk p/q med q = 2–10, förlängt med k = 2–5, n = q·k ≤ 40
//   • rätt = samma värde OCH enklaste form (requirements "simplest"); 6/8 för
//     12/16 är rätt värde men inte färdigt – egen förklaring (§6)
//   • flera förkortningssteg tillåts: verktyget kan prova flera g efter varandra
//   • överföring: kort vardagssituation med samma stav
// Hjälp: "Hur många små delar kan bli en ny del?", oförändrad färgad längd och
// varför ett bråk som 2/3 inte kan förkortas mer – med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { fractionWords } from "../math/words.js";
import { basbrak, brak, falt, talNyckel, NUMBER_FRACTION } from "./f-delat.js";

const MAX_N = 40;
const BASER = basbrak(2, 10);

/** Gruppstorlekar verktyget erbjuder: alla delare av n utom 1 och n. */
export const gruppstorlekar = (n) => Array.from({ length: n - 2 }, (_, i) => i + 2).filter((g) => n % g === 0 && g < n);

const SITUATIONER = [
  { id: "pizza", text: (x) => `Ali har ätit ${x} av en pizza. Skriv hur mycket det är i enklaste form.` },
  { id: "band", text: (x) => `${x} av ett band är målat. Förkorta bråket så långt det går.` },
  { id: "saft", text: (x) => `En kanna är fylld till ${x}. Skriv bråket i enklaste form.` },
  { id: "promenad", text: (x) => `Mira har gått ${x} av vägen till skolan. Skriv bråket i enklaste form.` },
];

/** Exemplet i hjälpen: en annan förkortning (annat basbråk och annan stav). */
const EXEMPEL = [[2, 5, 2], [1, 3, 3], [3, 4, 2], [2, 3, 4], [1, 2, 5]];
function exempel(p, q, k) {
  return EXEMPEL.find(([ep, eq, ek]) => !(ep === p && eq === q) && eq * ek !== q * k) || EXEMPEL[0];
}

export default defineChallenge({
  id: "21",
  version: 1,

  generate(rng, { slot }) {
    if (slot === "intro") {
      const [p, q] = rng.pick(BASER.filter(([, qq]) => qq <= 5));
      return { p, q, k: rng.int(2, 3) };
    }
    const [p, q] = rng.pick(BASER);
    const k = rng.int(2, Math.min(5, Math.floor(MAX_N / q)));
    return slot === "overforing" ? { p, q, k, situation: rng.pick(SITUATIONER).id } : { p, q, k };
  },

  core: ({ p, q, k }) => `${p}/${q}×${k}`,

  build({ p, q, k, situation = null }) {
    const n = q * k;
    const a = p * k;
    const sit = SITUATIONER.find((s) => s.id === situation);
    const [ep, eq, ek] = exempel(p, q, k);
    const wrong = [falt(a, n), falt(p, n), falt(a, q)];
    // Ett steg kvar: förkortat med en äkta delare av k (12/16 → 6/8).
    for (let g = 2; g < k; g++) if (k % g === 0) wrong.push(falt(a / g, n / g));
    return {
      core: `${p}/${q}×${k}`,
      prompt: sit ? sit.text(`${a}/${n}`) : `Förkorta ${a}/${n} så långt det går. Slå ihop små bitar till större.`,
      values: { start: { n: a, d: n }, target: { n: p, d: q }, factor: k },
      view: {
        component: "verkstad",
        stavar: [{ id: "s", parts: n, marked: a, namn: brak(a, n), helhet: "Hela staven = 1", verktyg: ["ihop"], ihop: gruppstorlekar(n) }],
        expr: [brak(a, n), { op: "=" }, { input: "svar" }],
      },
      answer: NUMBER_FRACTION,
      key: {
        ...talNyckel({ n: p, d: q }, { kind: "simplest" }),
        display: `${a}/${n} = ${p}/${q}`,
        examples: { right: [falt(p, q)], wrong },
      },
      help: [
        { step: "orientering", text: "Hela staven = 1. Räkna alla små bitar och de färgade bitarna.", highlight: { whole: true, count: true } },
        { step: "princip", text: "Förkorta betyder att slå ihop lika många små bitar till en ny, större bit. Gör samma grupper av ALLA bitar – då är lika mycket färgat som förut. Det går bara när varje grupp blir helt färgad eller helt ofärgad." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ep * ek}/${eq * ek}. Grupper om ${ek} små bitar ger ${eq} nya bitar, och ${ep} av dem är färgade: ` +
            `${ep * ek}/${eq * ek} = ${ep}/${eq}. ${ep}/${eq} går inte att förkorta mer – ingen gruppstorlek större än 1 går jämnt upp i både ${ep} och ${eq}.`,
          view: { component: "stav", parts: eq, marked: ep, regroup: ek, label: "Hela staven = 1" },
        },
        { step: "atergang", text: "Nu provar du själv: prova olika gruppstorlekar med knapparna. Vilken är den största som gör varje grupp helt färgad eller helt ofärgad?" },
      ],
      misconceptions: ["ej-enklaste-form", "bara-taljaren-forkortad", "bara-namnaren-forkortad"],
      feedback: {
        correct: `Ja! Grupper om ${k} små bitar ger ${q} nya bitar, och ${p} av dem är färgade. Lika mycket är färgat: ${fractionWords(p, q)}.`,
        wrong: `Värdet ska vara detsamma och bråket ska inte gå att förkorta mer. Slå ihop bitarna i grupper och se vilka grupper som blir helt färgade.`,
      },
      review: `${a}/${n} = ${p}/${q}: slå ihop ${k} små bitar till en. Både ${a} och ${n} delas med ${k}. ` +
        `${p} och ${q} har ingen gemensam delare större än 1, så ${p}/${q} är i enklaste form.`,
    };
  },

  reserve: [
    { slot: "intro", params: { p: 1, q: 2, k: 2 } },
    { slot: "intro", params: { p: 2, q: 3, k: 2 } },
    { slot: "intro", params: { p: 3, q: 4, k: 3 } },
    { slot: "intro", params: { p: 1, q: 5, k: 3 } },
    { params: { p: 3, q: 8, k: 2 } },
    { params: { p: 2, q: 5, k: 4 } },
    { params: { p: 5, q: 6, k: 3 } },
    { params: { p: 7, q: 10, k: 4 } },
    { slot: "overforing", params: { p: 3, q: 4, k: 4, situation: "pizza" } },
    { slot: "overforing", params: { p: 4, q: 9, k: 2, situation: "band" } },
    { slot: "overforing", params: { p: 2, q: 7, k: 5, situation: "saft" } },
    { slot: "overforing", params: { p: 1, q: 6, k: 4, situation: "promenad" } },
  ],
});
