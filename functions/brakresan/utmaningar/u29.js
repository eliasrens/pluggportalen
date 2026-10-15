// ============================================================================
// 29. Tre fjärdedelar av ett antal (src/brakresan/utmaningar/u29.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 29: a/n av en mängd. Eleven delar HELA mängden i n lika grupper
// (verktyget "Dela i g grupper" – ingen förifylld gruppering), markerar a
// grupper och skriver antalet föremål. EN uppgift med två delar (multi, en
// poäng): markeringen (a·k föremål) och antalet.
//   • n = 3–8, 1 < a < n, N = n·k med k = 2–10, N ≤ 80
//   • N ≤ 36: alla föremål ritas (mängdbild, grupper med verktyget)
//   • N > 36: ett band med n lika delar ("Hela = 48 böcker") – eleven
//     markerar a delar av bandet
//   • elevnära texter om kulor, knappar, stjärnor, klossar, böcker, deltagare
// Hjälp: "Hitta en fjärdedel först", resultatet jämförs med helheten – en
// äkta andel ger färre än alla.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { fractionWords, partName } from "../math/words.js";
import { heltal, ids, NUMBER_INTEGER, talNyckel } from "./f-delat.js";

const MAX_BILD = 36;
const MAX_N = 80;

const SAKER = {
  kula: { en: "kula", flera: "kulor", text: (N, x) => `Elsa har ${N} kulor. Hon ger bort ${x} av kulorna.`, fraga: "Hur många kulor ger hon bort?" },
  knapp: { en: "knapp", flera: "knappar", text: (N, x) => `I en burk finns ${N} knappar. ${x} av knapparna är blå.`, fraga: "Hur många knappar är blå?" },
  stjarna: { en: "stjärna", flera: "stjärnor", text: (N, x) => `Leo har ${N} klistermärken med stjärnor. ${x} av dem sitter i boken.`, fraga: "Hur många stjärnor sitter i boken?" },
  kloss: { en: "kloss", flera: "klossar", text: (N, x) => `Ett torn byggs av ${N} klossar. ${x} av klossarna är röda.`, fraga: "Hur många klossar är röda?" },
};
const BAND = {
  bok: { flera: "böcker", text: (N, x) => `Skolbiblioteket har ${N} nya böcker. ${x} av böckerna är lånade.`, fraga: "Hur många böcker är lånade?" },
  deltagare: { flera: "deltagare", text: (N, x) => `I ett lopp springer ${N} deltagare. ${x} av deltagarna har gått i mål.`, fraga: "Hur många deltagare har gått i mål?" },
  elev: { flera: "elever", text: (N, x) => `På skolan går ${N} elever i årskurs 5. ${x} av eleverna cyklar till skolan.`, fraga: "Hur många elever cyklar?" },
};

const ALLA = [];
for (let n = 3; n <= 8; n++) for (let a = 2; a < n; a++) for (let k = 2; k <= 10 && n * k <= MAX_N; k++) ALLA.push({ n, a, k });

export default defineChallenge({
  id: "29",
  version: 1,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? ALLA.filter((x) => x.n <= 4 && x.n * x.k <= 24)
      : slot === "overforing" ? ALLA.filter((x) => x.n * x.k > MAX_BILD)
        : ALLA.filter((x) => x.n * x.k <= MAX_BILD);
    const { n, a, k } = rng.pick(pool);
    const sak = n * k > MAX_BILD ? rng.pick(Object.keys(BAND)) : rng.pick(Object.keys(SAKER));
    return { n, a, k, sak };
  },

  core: ({ n, a, k }) => `${a}/${n}×${k}`,

  build({ n, a, k, sak }) {
    const N = n * k;
    const x = a * k;
    const bild = N <= MAX_BILD;
    const s = bild ? SAKER[sak] : BAND[sak];
    const del = partName(n);
    const view = bild
      ? { component: "verkstad", mangd: { id: "grupper", count: N, item: sak, maxGrupper: 10, label: `Hela samlingen = ${N} ${s.flera}` }, expr: [{ input: "antal" }, { text: s.flera }] }
      : {
        component: "verkstad",
        stavar: [{ id: "grupper", parts: n, marked: 0, helhet: `Hela bandet = ${N} ${s.flera}`, verktyg: ["mala"], etiketter: [{ fran: 0, till: n, text: `${N} ${s.flera}` }] }],
        expr: [{ input: "antal" }, { text: s.flera }],
      };
    const delar = ids(bild ? N : n);
    const markera = bild ? x : a;
    const ex = n === 4 ? { n: 3, a: 2, N: 12 } : { n: 4, a: 3, N: 20 };
    return {
      core: `${a}/${n}×${k}`,
      prompt: `${s.text(N, `${a}/${n}`)} ${s.fraga} ${bild ? `Dela i ${n} lika grupper och markera ${a} av dem.` : `Markera ${a}/${n} av bandet.`}`,
      values: { whole: N, fraction: { n: a, d: n }, part: x },
      view,
      answer: { type: "multi", parts: { grupper: { type: "paint", parts: delar }, antal: NUMBER_INTEGER } },
      key: {
        type: "multi",
        parts: { grupper: { type: "paint", count: markera }, antal: talNyckel({ n: x, d: 1 }) },
        display: `${a}/${n} av ${N} = ${x} ${s.flera}`,
        examples: {
          right: [
            { parts: { grupper: { selected: delar.slice(0, markera) }, antal: heltal(x) } },
            { parts: { grupper: { selected: delar.slice(delar.length - markera) }, antal: heltal(x) } },
          ],
          wrong: [
            { parts: { grupper: { selected: delar.slice(0, markera) }, antal: heltal(k) } }, //      bara en grupp
            { parts: { grupper: { selected: delar.slice(0, markera) }, antal: heltal(N - x) } }, //  det som är kvar
            { parts: { grupper: { selected: delar.slice(0, markera) }, antal: heltal(a) } }, //      täljaren
            { parts: { grupper: { selected: delar.slice(0, bild ? k : 1) }, antal: heltal(x) } }, //  en grupp markerad
          ].filter((w) => w.parts.antal.text !== String(x) || w.parts.grupper.selected.length !== markera),
        },
      },
      help: [
        { step: "orientering", text: `Hela ${bild ? "samlingen" : "bandet"} är ${N} ${s.flera}. Det är helheten.`, highlight: { whole: true } },
        { step: "princip", text: `Hitta en ${del} först: dela alla ${N} i ${n} lika stora grupper. ${a}/${n} är ${a} sådana grupper.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} av ${ex.N}. En ${partName(ex.n)} av ${ex.N} är ${ex.N / ex.n}. ${ex.a} sådana grupper är ${ex.a} · ${ex.N / ex.n} = ${(ex.a * ex.N) / ex.n}.`,
          view: { component: "mangd", count: ex.N, groups: ex.n, marked: (ex.a * ex.N) / ex.n },
        },
        { step: "atergang", text: `Nu provar du själv: hur många blir det i en grupp? Hur många blir ${a} grupper? Svaret ska vara färre än alla ${N}.` },
      ],
      misconceptions: ["en-grupp-i-stallet-for-a", "det-som-ar-kvar", "taljaren-som-antal"],
      feedback: {
        correct: `Ja! En ${del} av ${N} är ${k}, och ${fractionWords(a, n)} är ${a} · ${k} = ${x}.`,
        wrong: `Dela alla ${N} i ${n} lika stora grupper – en grupp är en ${del}. Hur många är ${a} sådana grupper?`,
      },
      review: `${a}/${n} av ${N}: ${N} ÷ ${n} = ${k} i varje grupp. ${a} grupper är ${a} · ${k} = ${x}. Det är färre än ${N}, som det ska vara för en del av helheten.`,
    };
  },

  reserve: [
    { slot: "intro", params: { n: 4, a: 3, k: 5, sak: "kula" } },
    { slot: "intro", params: { n: 3, a: 2, k: 6, sak: "knapp" } },
    { slot: "intro", params: { n: 4, a: 2, k: 3, sak: "kloss" } },
    { slot: "intro", params: { n: 3, a: 2, k: 4, sak: "stjarna" } },
    { params: { n: 5, a: 2, k: 6, sak: "kula" } },
    { params: { n: 6, a: 5, k: 4, sak: "knapp" } },
    { params: { n: 8, a: 3, k: 4, sak: "stjarna" } },
    { params: { n: 7, a: 4, k: 3, sak: "kloss" } },
    { slot: "overforing", params: { n: 4, a: 3, k: 10, sak: "bok" } },
    { slot: "overforing", params: { n: 6, a: 5, k: 8, sak: "deltagare" } },
    { slot: "overforing", params: { n: 8, a: 3, k: 6, sak: "elev" } },
    { slot: "overforing", params: { n: 5, a: 2, k: 9, sak: "bok" } },
  ],
});
