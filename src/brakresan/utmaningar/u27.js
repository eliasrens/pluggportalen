// ============================================================================
// 27. Mer än en hel (src/brakresan/utmaningar/u27.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 27: bråk större än 1. Uppgifterna växlar mellan
//   • bygg: måla a/n på TRE lika stora helheter (stavar eller cirklar) – rätt =
//     a målade delar oavsett vilka (paint); antalet helheter avslöjar inget
//   • bild: flera helheter med a delar målade – skriv bråket (7/4 eller
//     1 3/4, ännu inget tvång på blandad form: requirement "value")
//   • tallinje: placera a/n på en tallinje från 0 till 3 med steget 1/n
// Generering: n = 2–8, a = n+1 … 3n (värde ≤ 3). Ingen bild fyller mer än en
// helhet i en enda cirkel: varje helhet ritas för sig, nämnaren är delarnas
// storlek och växer aldrig när fler helheter tillkommer.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { fractionWords, partName } from "../math/words.js";
import { falt, blandat, ids, NUMBER_MIXED, talNyckel } from "./f-delat.js";

const SLOTS = ["bygg", "bild", "bygg", "bygg-cirkel", "bild", "tallinje", "bild-cirkel", "bygg", "tallinje", "bild"];
const HELHETER = 3;
const MODELL = {
  stav: { en: "stav", flera: "stavar", helhet: "Varje stav = 1 hel" },
  cirkel: { en: "cirkel", flera: "cirklar", helhet: "Varje cirkel = 1 hel" },
};
const delarNamn = (n) => `${partName(n) || "del"}ar`.replace("halvar", "halvor");

export default defineChallenge({
  id: "27",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const [typ, form = "stav"] = slot.split("-");
    const maxN = typ === "tallinje" ? 6 : index < 3 ? 4 : 8;
    const n = rng.int(2, maxN);
    const a = rng.int(n + 1, typ === "bild" || typ === "tallinje" ? 3 * n - 1 : 3 * n);
    return { typ, form, n, a };
  },

  core: ({ typ, form, n, a }) => `${typ}-${form}-${a}/${n}`,

  build({ typ, form, n, a }) {
    const v = q(a, n);
    const w = Math.floor(a / n); // hela
    const r = a % n; //             resten i n-delar (oförkortad: 6/4 = 1 2/4 i bilden)
    const m = MODELL[form];
    const ord = fractionWords(a, n);
    const blandText = r ? `${w} ${w === 1 ? "hel" : "hela"} och ${fractionWords(r, n)}` : `${w} hela`;
    const exN = n === 3 ? 4 : 3;
    const exA = exN + 2;
    const hjalpExempel = {
      step: "modellering",
      text: `Ett exempel med andra tal: ${exA}/${exN}. ${exN} ${delarNamn(exN)} fyller en hel. Det blir ${exA - exN} ${delarNamn(exN)} över: ` +
        `${exA}/${exN} = 1 ${exA - exN}/${exN}.`,
      view: { component: "stav", parts: exN, wholes: 2, marked: exA, label: "Varje stav = 1 hel" },
    };
    const gemensam = {
      misconceptions: ["namnaren-vaxer-med-helheter", "allt-i-en-helhet", "taljare-namnare-ombytt"],
      feedback: {
        correct: `Ja! ${ord[0].toUpperCase()}${ord.slice(1)} är ${blandText}: ${n} ${delarNamn(n)} fyller en hel.`,
        wrong: `Nämnaren ${n} säger hur stora delarna är – den ändras inte när det blir fler helheter. ${n} ${delarNamn(n)} fyller en hel.`,
      },
      review: `${a}/${n} = ${w}${r ? ` ${r}/${n}` : ""}: ${n} ${delarNamn(n)} är en hel. ${a} ${delarNamn(n)} räcker till ${w} hela${r ? ` och ${r} ${r === 1 ? (partName(n) || "del") : delarNamn(n)} till` : ""}.`,
    };

    if (typ === "bygg") {
      const parts = ids(HELHETER * n);
      const view = form === "cirkel"
        ? { component: "cirkel", parts: n, wholes: HELHETER, label: m.helhet }
        : { component: "stav", parts: n, wholes: HELHETER, label: m.helhet };
      return {
        core: `${typ}-${form}-${a}/${n}`,
        prompt: `Måla ${a}/${n}. ${m.helhet}.`,
        values: { target: { n: a, d: n } },
        view,
        answer: { type: "paint", parts },
        key: {
          type: "paint",
          count: a,
          display: `${a} ${delarNamn(n)} målade (${blandText})`,
          examples: {
            right: [{ selected: parts.slice(0, a) }, { selected: parts.slice(parts.length - a) }],
            wrong: [{ selected: parts.slice(0, a - n) }, { selected: parts.slice(0, n) }, { selected: parts.slice(0, Math.min(a + 1, parts.length - 1)) }]
              .filter((x) => x.selected.length !== a && x.selected.length > 0),
          },
        },
        help: [
          { step: "orientering", text: `${m.helhet}. Varje ${m.en} är delad i ${n} lika stora delar.`, highlight: { whole: true } },
          { step: "princip", text: `${n} ${delarNamn(n)} fyller en hel ${m.en}. Bråket säger hur många ${delarNamn(n)} du ska måla – fortsätt på nästa ${m.en} när en är full.` },
          hjalpExempel,
          { step: "atergang", text: `Nu provar du själv: hur många hela ${m.flera} blir det, och hur många ${delarNamn(n)} till?` },
        ],
        ...gemensam,
      };
    }

    if (typ === "tallinje") {
      return {
        core: `${typ}-${form}-${a}/${n}`,
        prompt: `Placera ${a}/${n} på tallinjen.`,
        values: { target: { n: a, d: n } },
        view: { component: "tallinje", min: 0, max: 3, ticks: n, labels: "hela", label: "Från 0 till 1 är en hel" },
        answer: { type: "point", snap: n, min: 0, max: 3 },
        key: {
          type: "point",
          value: { n: a, d: n },
          display: `${a}/${n} = ${w}${r ? ` ${r}/${n}` : ""}`,
          examples: {
            right: [{ value: { n: a, d: n } }, { value: { n: 2 * a, d: 2 * n } }],
            wrong: [{ value: { n: a - 1, d: n } }, { value: { n: a + 1, d: n } }, ...(r ? [{ value: { n: r, d: n } }] : [])],
          },
        },
        help: [
          { step: "orientering", text: `Från 0 till 1 är en hel. Mellan varje heltal finns ${n} lika långa steg.`, highlight: { whole: true, count: true } },
          { step: "princip", text: `Varje steg är 1/${n}. ${n} steg tar dig till 1, ${2 * n} steg till 2. Räkna mellanrum, inte streck.` },
          { ...hjalpExempel, view: { component: "tallinje", min: 0, max: 3, ticks: exN, labels: "hela", points: [{ id: "x", value: { n: exA, d: exN } }] } },
          { step: "atergang", text: "Nu provar du själv: hur många hela steg och hur många småsteg till?" },
        ],
        ...gemensam,
      };
    }

    // bild: helheterna ritas med a delar målade – eleven skriver bråket.
    const wholes = Math.ceil(a / n);
    const view = form === "cirkel"
      ? { component: "cirkel", parts: n, wholes, marked: a, label: m.helhet }
      : { component: "stav", parts: n, wholes, marked: a, label: m.helhet };
    return {
      core: `${typ}-${form}-${a}/${n}`,
      prompt: `Hur mycket är målat? Skriv som bråk eller i blandad form. ${m.helhet}.`,
      values: { target: { n: a, d: n } },
      view,
      answer: NUMBER_MIXED,
      key: {
        ...talNyckel(v),
        display: `${a}/${n}${r ? ` = ${w} ${r}/${n}` : ` = ${w}`}`,
        examples: {
          right: [falt(a, n), ...(r ? [blandat(w, r, n)] : []), falt(2 * a, 2 * n)],
          wrong: [falt(a, wholes * n), falt(r || n, n), falt(n, a)],
        },
      },
      help: [
        { step: "orientering", text: `${m.helhet}. Räkna delarna i en ${m.en}: så stora är delarna.`, highlight: { whole: true } },
        { step: "princip", text: `Nämnaren säger hur stora delarna är. Den ändras inte när det blir fler ${m.flera} – räkna alla målade delar.` },
        hjalpExempel,
        { step: "atergang", text: `Nu provar du själv: hur många ${delarNamn(n)} är målade sammanlagt?` },
      ],
      ...gemensam,
    };
  },

  reserve: [
    { slot: "bygg", params: { typ: "bygg", form: "stav", n: 4, a: 7 } },
    { slot: "bygg", params: { typ: "bygg", form: "stav", n: 3, a: 5 } },
    { slot: "bygg", params: { typ: "bygg", form: "stav", n: 2, a: 5 } },
    { slot: "bygg-cirkel", params: { typ: "bygg", form: "cirkel", n: 6, a: 11 } },
    { slot: "bild", params: { typ: "bild", form: "stav", n: 4, a: 9 } },
    { slot: "bild", params: { typ: "bild", form: "stav", n: 5, a: 7 } },
    { slot: "bild", params: { typ: "bild", form: "stav", n: 3, a: 8 } },
    { slot: "bild-cirkel", params: { typ: "bild", form: "cirkel", n: 8, a: 13 } },
    { slot: "tallinje", params: { typ: "tallinje", form: "stav", n: 2, a: 5 } },
    { slot: "tallinje", params: { typ: "tallinje", form: "stav", n: 4, a: 9 } },
    { slot: "tallinje", params: { typ: "tallinje", form: "stav", n: 3, a: 4 } },
  ],
});
