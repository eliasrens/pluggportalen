// ============================================================================
// 10. Bråk i vardagen (src/brakresan/utmaningar/u10.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 10: del–helhet i korta bildbaserade situationer. Katalogens egen
// blandning: fyra bilduppgifter med val, tre målningsuppgifter och tre
// tal/bråksvar (SLOTS). Minst två frågor gäller det som finns KVAR.
//   • situationer: band (stav), smörgås (rektangel), pizza (cirkel), kulor
//     (mängd); nämnare 2–6, små heltalsmängder
//   • bilden visar hela den ursprungliga helheten; de använda delarna är
//     markerade (mönster + färg), resten är det som finns kvar
//   • värdet bedöms – likvärdiga bråk godtas (2/4 eller 1/2); målning bedöms
//     på antalet delar, vilka som helst
// Hjälp: "Frågar vi om det som används eller det som finns kvar?"
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { modell, brakForm, skildaVarden, kortId, ids, ord, stor } from "./delat-e.js";

const SLOTS = ["bild-anvant", "bild-kvar", "mala-kvar", "tal-anvant", "bild-anvant", "mala-anvant", "tal-kvar", "bild-kvar", "mala-kvar", "tal-anvant"];

const SIT = {
  band: { shape: "stav", hel: "Hela bandet = 1", text: (n, k) => `Ett band delas i ${n} lika långa bitar. ${k} ${k === 1 ? "bit" : "bitar"} används.`, sak: "bandet", anv: "används", del: "bitar" },
  smorgas: { shape: "rutnat", hel: "Hela smörgåsen = 1", text: (n, k) => `En smörgås delas i ${n} lika stora bitar. ${k} ${k === 1 ? "bit" : "bitar"} äts upp.`, sak: "smörgåsen", anv: "äts upp", del: "bitar" },
  pizza: { shape: "cirkel", hel: "Hela pizzan = 1", text: (n, k) => `En pizza delas i ${n} lika stora bitar. ${k} ${k === 1 ? "bit" : "bitar"} äts upp.`, sak: "pizzan", anv: "äts upp", del: "bitar" },
  kulor: { shape: "mangd", hel: null, text: (n, k) => `Det finns ${n} kulor. ${k} ${k === 1 ? "kula" : "kulor"} ges bort.`, sak: "kulorna", anv: "ges bort", del: "kulor" },
};

function bild(sit, n, marked, extra = {}) {
  const s = SIT[sit];
  // Med markerade delar säger etiketten vad markeringen betyder (använt), resten finns kvar.
  const tillagg = marked ? ` · markerat: ${s.anv}` : "";
  if (s.shape === "mangd") return { component: "mangd", count: n, item: "kula", ...(marked ? { marked } : {}), label: `Alla kulorna = ${n} kulor${tillagg}`, ...extra };
  return modell(s.shape, n, marked || 0, { label: `${s.hel}${tillagg}`, ...extra });
}

const falt = (a, b) => ({ fields: { n: String(a), d: String(b) } });

export default defineChallenge({
  id: "10",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const sit = rng.pick(Object.keys(SIT));
    const n = sit === "kulor" ? rng.int(3, 6) : rng.int(2, 6);
    const k = rng.int(1, n - 1);
    const p = { typ: slot.split("-")[0], fraga: slot.split("-")[1], sit, n, k };
    if (p.typ === "bild") {
      const m = p.fraga === "kvar" ? n - k : k;
      const fel = skildaVarden(q(m, n), rng.shuffle([
        { n: n - m, d: n, tag: "anvant-mot-kvar" }, { n: m, d: n - m, tag: "del-mot-del" }, { n: n - m, d: m, tag: "del-mot-del" },
        { n: m, d: n + 1, tag: "fel-helhet" }, { n: 1, d: n, tag: "en-bit" }, { n: m + 1, d: n + 1, tag: "fel-helhet" },
      ].filter((c) => c.n >= 1 && c.d >= 2)).concat([
        { n: m + 1, d: n, tag: "fel-antal" }, { n: m, d: n + 2, tag: "fel-helhet" }, { n: 1, d: n + 1, tag: "fel-helhet" },
      ].filter((c) => c.n >= 1 && c.d >= 2)), 3);
      p.kort = rng.shuffle([{ n: m, d: n, ratt: true }, ...fel.map((c) => ({ n: c.n, d: c.d, tag: c.tag }))]);
    }
    return p;
  },

  core: ({ sit, n, k, fraga }) => `${sit}-${k}/${n}-${fraga}`,

  build({ typ, fraga, sit, n, k, kort }) {
    const s = SIT[sit];
    const m = fraga === "kvar" ? n - k : k;
    const vad = fraga === "kvar" ? "finns kvar" : s.anv;
    const fragaText = fraga === "kvar" ? `Hur stor del av ${s.sak} finns kvar?` : `Hur stor del av ${s.sak} ${s.anv}?`;
    const red = q(m, n);
    const ex = { n: n === 4 ? 5 : 4, k: 1 };
    const help = [
      { step: "orientering", text: `Hela ${s.sak} är helheten: ${n} lika stora ${s.del}.${typ === "mala" ? "" : ` De markerade ${s.del} ${s.anv}.`}`, highlight: { whole: true, del: 0 } },
      { step: "princip", text: "Frågar vi om det som används eller det som finns kvar? Räkna just de delarna – och alla delarna för nämnaren." },
      {
        step: "modellering",
        text: `Ett exempel med andra tal: ett band i ${ex.n} lika bitar, ${ex.k} bit används. Då används 1/${ex.n} och ${ex.n - 1}/${ex.n} finns kvar.`,
        view: modell("stav", ex.n, ex.k, { label: "Hela bandet = 1" }),
      },
      { step: "atergang", text: "Nu provar du själv: läs frågan igen – används eller kvar?" },
    ];
    const common = {
      core: `${sit}-${k}/${n}-${fraga}`,
      values: { target: { n: m, d: n }, n, used: k, left: n - k },
      help,
      misconceptions: ["anvant-mot-kvar", "del-mot-del"],
      feedback: {
        correct: `Ja! ${m} av ${n} ${s.del} ${vad}: ${m}/${n}${red.d !== n ? ` = ${red.n}/${red.d}` : ""}.`,
        wrong: `${k} av ${n} ${s.del} ${s.anv}, och ${n - k} finns kvar. Frågan gäller det som ${vad}: ${m}/${n}${red.d !== n ? ` = ${red.n}/${red.d}` : ""}.`,
      },
      review: `${s.text(n, k)} ${fraga === "kvar" ? `Kvar: ${n - k} av ${n} = ${m}/${n}.` : `${stor(s.anv)}: ${k} av ${n} = ${m}/${n}.`}`,
    };
    if (typ === "mala") {
      const delar = ids(n);
      return {
        ...common,
        prompt: `${s.text(n, k)} Måla den del som ${vad}.`,
        view: bild(sit, n, 0),
        answer: { type: "paint", parts: delar },
        key: {
          type: "paint", count: m, display: `${m} av ${n} ${s.del} målade`,
          examples: {
            right: [{ selected: delar.slice(0, m) }, { selected: delar.slice(n - m) }],
            wrong: [...(n - m !== m ? [{ selected: delar.slice(0, n - m) }] : []), { selected: delar.slice(0, m < n ? m + 1 : m - 1) }],
          },
        },
      };
    }
    if (typ === "tal") {
      const right = [falt(m, n), ...(red.d !== n ? [falt(red.n, red.d)] : []), falt(2 * m, 2 * n)];
      const wrong = [[n - m, n], [m, n - m], [k === m ? n - k : k, n]].filter(([a, b]) => b > 0 && a * n !== m * b).map(([a, b]) => falt(a, b));
      return {
        ...common,
        prompt: `${s.text(n, k)} ${fragaText} Skriv ett bråk.`,
        view: { ...bild(sit, n, k), expr: [{ text: `${fraga === "kvar" ? "Kvar" : stor(s.anv)}:` }, { input: true }] },
        answer: { type: "number", input: "fraction" },
        key: { type: "number", value: { n: m, d: n }, requirement: { kind: "value" }, display: `${m}/${n}${red.d !== n ? ` = ${red.n}/${red.d}` : ""}`, examples: { right, wrong } },
      };
    }
    const cards = kort.map((c, i) => ({ id: kortId(i), face: brakForm(c.n, c.d) }));
    const ratt = cards[kort.findIndex((c) => c.ratt)].id;
    return {
      ...common,
      prompt: `${s.text(n, k)} ${fragaText}`,
      view: {
        component: "sammansatt",
        delar: [{ view: bild(sit, n, k) }, { view: { component: "kort", cards }, svar: true, label: "Välj ett bråk" }],
      },
      answer: { type: "choice", options: cards.map((c) => c.id) },
      key: {
        type: "choice", correct: ratt, display: `${m}/${n}`,
        examples: { right: [{ id: ratt }], wrong: cards.filter((c) => c.id !== ratt).map((c) => ({ id: c.id })) },
      },
      misconceptions: [...new Set(kort.filter((c) => c.tag).map((c) => c.tag))],
    };
  },

  reserve: [
    { slot: "bild-anvant", params: { typ: "bild", fraga: "anvant", sit: "band", n: 4, k: 1, kort: [{ n: 3, d: 4, tag: "anvant-mot-kvar" }, { n: 1, d: 4, ratt: true }, { n: 1, d: 3, tag: "del-mot-del" }, { n: 1, d: 5, tag: "fel-helhet" }] } },
    { slot: "bild-kvar", params: { typ: "bild", fraga: "kvar", sit: "pizza", n: 6, k: 2, kort: [{ n: 4, d: 6, ratt: true }, { n: 2, d: 6, tag: "anvant-mot-kvar" }, { n: 4, d: 2, tag: "del-mot-del" }, { n: 4, d: 7, tag: "fel-helhet" }] } },
    { slot: "bild-kvar", params: { typ: "bild", fraga: "kvar", sit: "kulor", n: 5, k: 3, kort: [{ n: 3, d: 5, tag: "anvant-mot-kvar" }, { n: 2, d: 3, tag: "del-mot-del" }, { n: 2, d: 5, ratt: true }, { n: 2, d: 6, tag: "fel-helhet" }] } },
    { slot: "mala-kvar", params: { typ: "mala", fraga: "kvar", sit: "band", n: 5, k: 2 } },
    { slot: "mala-kvar", params: { typ: "mala", fraga: "kvar", sit: "smorgas", n: 4, k: 1 } },
    { slot: "mala-anvant", params: { typ: "mala", fraga: "anvant", sit: "pizza", n: 6, k: 4 } },
    { slot: "mala-anvant", params: { typ: "mala", fraga: "anvant", sit: "smorgas", n: 3, k: 2 } },
    { slot: "tal-anvant", params: { typ: "tal", fraga: "anvant", sit: "band", n: 4, k: 2 } },
    { slot: "tal-anvant", params: { typ: "tal", fraga: "anvant", sit: "kulor", n: 6, k: 3 } },
    { slot: "tal-kvar", params: { typ: "tal", fraga: "kvar", sit: "pizza", n: 6, k: 1 } },
    { slot: "tal-kvar", params: { typ: "tal", fraga: "kvar", sit: "smorgas", n: 5, k: 3 } },
  ],
});
