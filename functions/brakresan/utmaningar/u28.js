// ============================================================================
// 28. Blandad form (src/brakresan/utmaningar/u28.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 28: växla mellan bråkform och blandad form – fem uppgifter åt varje
// håll (SLOTS), med rätt inmatningsfält:
//   • till blandad form: 11/4 → 2 3/4, fälten heltal + bråk, krav "mixed"
//     med förkortad bråkdel ("Skriv i blandad form med bråkdelen förkortad");
//     minst två uppgifter har en förkortningsbar rest (10/4 → 2 1/2)
//   • till bråkform: 1 2/3 → 5/3, bråkfälten, krav "fraction" (likvärdigt
//     bråk som 10/6 godtas – bara formen begärs)
// Generering: nämnare 2–10, heltalsdel 1–3, 0 < rest < n.
// Byggmodellen (n smådelar samlas till en hel, helheterna ritas för sig)
// syns medan hjälpen är öppen (view.modellIHjalp): en färdig bild av 2 hela +
// 3 fjärdedelar skulle annars vara själva svaret.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gcd } from "../math/index.js";
import { fractionWords, wholeWords, partName } from "../math/words.js";
import { brak, falt, blandat, talNyckel, NUMBER_FRACTION, NUMBER_MIXED } from "./f-delat.js";

const SLOTS = ["till-blandad", "till-brak", "till-blandad-fork", "till-brak", "till-blandad", "till-brak", "till-blandad-fork",
  "till-brak", "till-blandad", "till-brak"];

/** Alla (n, w, r): nämnare 2–10, heltal 1–3, rest 1 … n−1. */
const ALLA = [];
for (let n = 2; n <= 10; n++) for (let w = 1; w <= 3; w++) for (let r = 1; r < n; r++) ALLA.push({ n, w, r, fork: gcd(r, n) > 1 });

const delarNamn = (n) => (n === 2 ? "halvor" : `${partName(n)}ar`);

export default defineChallenge({
  id: "28",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const fork = slot.endsWith("-fork");
    const pool = ALLA.filter((x) => (fork ? x.fork : true) && (index < 3 ? x.n <= 6 && x.w <= 2 : true));
    const { n, w, r } = rng.pick(pool.length ? pool : ALLA.filter((x) => x.fork));
    return { riktning: slot.startsWith("till-blandad") ? "blandad" : "brak", n, w, r };
  },

  core: ({ riktning, n, w, r }) => `${riktning}-${w} ${r}/${n}`,

  build({ riktning, n, w, r }) {
    const a = w * n + r;
    const g = gcd(r, n);
    const rr = r / g;
    const rn = n / g;
    const modell = { component: "stav", parts: n, wholes: w + 1, marked: a, label: "Varje stav = 1 hel" };
    const ex = n === 3 && r === 1 ? { n: 4, w: 1, r: 3 } : { n: 3, w: 1, r: 1 };
    const exA = ex.w * ex.n + ex.r;
    const blandText = `${wholeWords(w)} och ${fractionWords(rr, rn)}`;
    const tillBlandad = riktning === "blandad";
    const help = [
      { step: "orientering", text: `Varje hel är delad i ${n} lika stora delar: ${n} ${delarNamn(n)} fyller en hel.`, highlight: { stavar: true, whole: true } },
      {
        step: "princip",
        text: tillBlandad
          ? `Hur många hela grupper om ${n} delar finns det? Det som blir över är bråkdelen. Förkorta bråkdelen om det går.`
          : `En hel är ${n} ${delarNamn(n)}. Gör om varje hel till ${delarNamn(n)} och lägg till bråkdelen.`,
        highlight: { stavar: true },
      },
      {
        step: "modellering",
        text: `Ett exempel med andra tal: ${exA}/${ex.n} = ${ex.w} ${ex.r}/${ex.n}. ${ex.n} ${delarNamn(ex.n)} blir en hel, och ${ex.r} ${ex.r === 1 ? partName(ex.n) : delarNamn(ex.n)} blir över. ` +
          `${ex.w} ${ex.r}/${ex.n} betyder ${ex.w} + ${ex.r}/${ex.n}, inte ${ex.w} · ${ex.r}/${ex.n}.`,
        view: { component: "stav", parts: ex.n, wholes: ex.w + 1, marked: exA, label: "Varje stav = 1 hel" },
        highlight: { stavar: true },
      },
      { step: "atergang", text: tillBlandad ? "Nu provar du själv: räkna hela stavar i bilden, sedan delarna som blir över." : "Nu provar du själv: hur många delar finns i de hela stavarna, och hur många till?", highlight: { stavar: true } },
    ];
    const gemensamt = {
      misconceptions: ["blandad-som-multiplikation", "adderar-heltal-till-taljare", "rest-ej-forkortad"],
      review: `${a}/${n} = ${w} ${r}/${n}${g > 1 ? ` = ${w} ${rr}/${rn}` : ""}: ${w} · ${n} = ${w * n} ${delarNamn(n)} är ${wholeWords(w)}, och ${r} ${r === 1 ? partName(n) : delarNamn(n)} blir över. ` +
        `${w} ${rr}/${rn} betyder ${w} + ${rr}/${rn}.`,
    };

    if (tillBlandad) {
      return {
        core: `${riktning}-${w} ${r}/${n}`,
        prompt: `Skriv ${a}/${n} i blandad form med bråkdelen förkortad.`,
        values: { improper: { n: a, d: n }, whole: w, rest: { n: r, d: n } },
        view: { component: "verkstad", modell, modellIHjalp: true, expr: [brak(a, n), { op: "=" }, { input: "svar" }] },
        answer: NUMBER_MIXED,
        key: {
          ...talNyckel({ n: a, d: n }, { kind: "mixed", simplified: true }),
          display: `${a}/${n} = ${w} ${rr}/${rn}`,
          examples: {
            right: [blandat(w, rr, rn)],
            wrong: [
              falt(a, n), //                                      bråkform, inte blandad
              ...(g > 1 ? [blandat(w, r, n)] : []), //           resten inte förkortad
              ...(n > 2 ? [blandat(w, r + 1 < n ? r + 1 : r - 1, n)] : []), // fel rest
              blandat(w + 1, rr, rn), //                          fel antal hela
            ].filter((x, i, l) => l.findIndex((y) => JSON.stringify(y) === JSON.stringify(x)) === i),
          },
        },
        help,
        feedback: {
          correct: `Ja! ${a}/${n} är ${blandText}: ${w} hela grupper om ${n} delar och ${r} ${r === 1 ? partName(n) : delarNamn(n)} över.`,
          wrong: `Räkna hela grupper om ${n} delar – varje grupp är en hel. Det som blir över är bråkdelen${g > 1 ? ", och den går att förkorta" : ""}.`,
        },
        ...gemensamt,
      };
    }
    return {
      core: `${riktning}-${w} ${r}/${n}`,
      prompt: `Skriv ${w} ${r}/${n} som ett bråk.`,
      values: { improper: { n: a, d: n }, whole: w, rest: { n: r, d: n } },
      view: { component: "verkstad", modell, modellIHjalp: true, expr: [{ kind: "mixed", whole: w, n: r, d: n }, { op: "=" }, { input: "svar" }] },
      answer: NUMBER_FRACTION,
      key: {
        ...talNyckel({ n: a, d: n }, { kind: "fraction" }),
        display: `${w} ${r}/${n} = ${a}/${n}`,
        examples: {
          right: [falt(a, n), falt(2 * a, 2 * n)],
          wrong: [falt(w + r, n), falt(w * r, n), falt(a, w * n)].filter((x) => !(x.fields.n === String(a) && x.fields.d === String(n))),
        },
      },
      help,
      feedback: {
        correct: `Ja! ${wholeWords(w)} är ${w * n} ${delarNamn(n)}, och ${r} till ger ${a}/${n}.`,
        wrong: `${w} ${r}/${n} betyder ${w} + ${r}/${n}. Varje hel är ${n} ${delarNamn(n)}: ${w} · ${n} delar, och sedan ${r} till.`,
      },
      ...gemensamt,
    };
  },

  reserve: [
    { slot: "till-blandad", params: { riktning: "blandad", n: 4, w: 2, r: 3 } },
    { slot: "till-blandad", params: { riktning: "blandad", n: 3, w: 1, r: 2 } },
    { slot: "till-blandad", params: { riktning: "blandad", n: 5, w: 3, r: 1 } },
    { slot: "till-blandad-fork", params: { riktning: "blandad", n: 4, w: 2, r: 2 } },
    { slot: "till-blandad-fork", params: { riktning: "blandad", n: 6, w: 1, r: 4 } },
    { slot: "till-blandad-fork", params: { riktning: "blandad", n: 10, w: 2, r: 5 } },
    { slot: "till-brak", params: { riktning: "brak", n: 3, w: 1, r: 2 } },
    { slot: "till-brak", params: { riktning: "brak", n: 4, w: 2, r: 1 } },
    { slot: "till-brak", params: { riktning: "brak", n: 8, w: 1, r: 5 } },
    { slot: "till-brak", params: { riktning: "brak", n: 6, w: 3, r: 5 } },
    { slot: "till-brak", params: { riktning: "brak", n: 10, w: 2, r: 7 } },
  ],
});
