// ============================================================================
// 01. Lika stora delar (src/brakresan/utmaningar/u01.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 01: bråkdelar av en area måste vara lika stora. Tio bildrundor:
//   • "valj": tre figurer av samma sort (cirkel, rektangel eller stav), välj
//     den som är delad i n LIKA STORA delar, n = 2–6. De andra två har
//     verifierbart olika stora delar (vikter 2–4: tydligt, men ingen karikatyr)
//     eller lika stora delar men fel antal (n ± 1)
//   • "olikform": rektanglar på ett rutnät med synliga rutor – den rätta har
//     lika stora delar med OLIKA FORM (lika många rutor), de andra har olika
//     många rutor per del (spec: "lika stor betyder inte alltid samma form")
//   • "janej" (två per omgång): EN figur – är den delad i n lika stora delar,
//     eller behöver delningen ändras? Ibland lika stora delar med olika form
// Figurerna ritas av komponenten figur ur delarnas storlek – aldrig handritat.
// Hjälp: "Fyra bitar räcker inte. Varje bit måste vara lika stor." och en
// jämförelse där ett ANNAT exempels delar läggs bredvid/över varandra.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { kortId, tal, stor } from "./delat-e.js";

const SLOTS = ["valj-intro", "valj-intro", "valj-intro", "valj", "janej", "valj", "olikform", "valj", "janej", "valj"];
const FORMER = ["cirkel", "rektangel", "stav"];
const NAMN = { cirkel: "cirkel", rektangel: "rektangel", stav: "stav" };
const BEST = { cirkel: "cirkeln", rektangel: "rektangeln", stav: "staven" };

// --- Rektanglar på rutnät: lika area med olika form ---------------------------
// Celler r * cols + c. "lika" = lika många celler per del (olika form),
// "fel" = en cell flyttad till grannen (olika area), "andra" = olika breda
// remsor eller fel antal lika delar på samma rutnät.
const rad = (r, c0, c1, cols) => Array.from({ length: c1 - c0 + 1 }, (_, i) => r * cols + c0 + i);
const block = (r0, r1, c0, c1, cols) => Array.from({ length: r1 - r0 + 1 }, (_, i) => rad(r0 + i, c0, c1, cols)).flat();
const kolumner = (bredder, rows, cols) => {
  let c = 0;
  return bredder.map((b) => { const r = block(0, rows - 1, c, c + b - 1, cols); c += b; return r; });
};
const flytta = (regions, cell, fran, till) => regions.map((r, i) => (i === fran ? r.filter((x) => x !== cell) : i === till ? [...r, cell].sort((a, b) => a - b) : r));

export const OLIKFORM = {
  "2": { n: 2, rows: 4, cols: 4,
    lika: [[0, 1, 2, 3, 4, 5, 8, 12], [6, 7, 9, 10, 11, 13, 14, 15]] },
  "3": { n: 3, rows: 4, cols: 6,
    lika: [[...rad(0, 0, 5, 6), ...rad(1, 0, 1, 6)], [...rad(1, 2, 5, 6), ...rad(2, 2, 5, 6)], [...rad(2, 0, 1, 6), ...rad(3, 0, 5, 6)]] },
  "4": { n: 4, rows: 4, cols: 6,
    lika: [rad(0, 0, 5, 6), rad(1, 0, 5, 6), block(2, 3, 0, 2, 6), block(2, 3, 3, 5, 6)] },
  "4b": { n: 4, rows: 4, cols: 4,
    lika: [block(0, 1, 0, 1, 4), block(0, 1, 2, 3, 4), rad(2, 0, 3, 4), rad(3, 0, 3, 4)] },
  "6": { n: 6, rows: 4, cols: 6,
    lika: [block(0, 3, 0, 0, 6), block(0, 3, 1, 1, 6), block(0, 1, 2, 3, 6), block(2, 3, 2, 3, 6), block(0, 1, 4, 5, 6), block(2, 3, 4, 5, 6)] },
};
OLIKFORM["2"].fel = flytta(OLIKFORM["2"].lika, 5, 0, 1);
OLIKFORM["3"].fel = flytta(OLIKFORM["3"].lika, 8, 1, 0);
OLIKFORM["4"].fel = flytta(OLIKFORM["4"].lika, 15, 3, 2);
OLIKFORM["4b"].fel = flytta(OLIKFORM["4b"].lika, 5, 0, 2);
OLIKFORM["6"].fel = flytta(OLIKFORM["6"].lika, 2, 2, 1);
OLIKFORM["2"].andra = kolumner([1, 3], 4, 4);
OLIKFORM["3"].andra = kolumner([1, 2, 3], 4, 6);
OLIKFORM["4"].andra = kolumner([1, 1, 2, 2], 4, 6);
OLIKFORM["4b"].andra = [block(0, 1, 0, 3, 4), block(2, 3, 0, 3, 4)]; // två lika delar – fel antal
OLIKFORM["6"].andra = OLIKFORM["4"].lika; //                        fyra lika delar – fel antal

/** Semantisk kärna: sort, figurform, antal delar och vilka sorters fel som visas. */
function karna(p) {
  if (p.typ === "valj") return `valj-${p.shape}-${p.n}-${p.figurer.map((f) => f.kind).filter((k) => k !== "lika").sort().join("+")}`;
  if (p.typ === "olikform") return `olikform-${p.lay}`;
  return `janej-${p.shape}-${p.n}-${p.lay ? `olikform-${p.lay}` : p.figur.kind}`;
}

/** Olika vikter 2–4 (inte alla lika) – tydligt olika stora delar utan karikatyr. */
function olikaVikter(rng, n) {
  for (;;) {
    const v = Array.from({ length: n }, () => rng.int(2, 4));
    if (new Set(v).size > 1) return v;
  }
}

/** En figurbeskrivning (params) → figurens vy. */
function figurView(shape, f, extra = {}) {
  if (f.lay) {
    const L = OLIKFORM[f.lay];
    return { component: "figur", form: "rektangel", rows: L.rows, cols: L.cols, regions: L[f.v].map((cells) => ({ cells })), ...extra };
  }
  if (shape === "rektangel") {
    if (f.rader) return { component: "figur", form: "rektangel", rows: 2, cols: f.sizes.length / 2, regions: f.sizes.map((_, i) => ({ cells: [i] })), ...extra };
    const cols = f.sizes.reduce((a, b) => a + b, 0);
    let c = 0;
    return { component: "figur", form: "rektangel", rows: 1, cols, regions: f.sizes.map((w) => ({ cells: Array.from({ length: w }, () => c++) })), ...extra };
  }
  return { component: "figur", form: shape, sizes: f.sizes, ...extra };
}

/** Delarnas areor (i samma enhet) – för kontroll och förklaring. */
export function areor(shape, f) {
  if (f.lay) return OLIKFORM[f.lay][f.v].map((r) => r.length);
  return f.sizes;
}

function likaFigur(rng, shape, n) {
  return shape === "rektangel" && n >= 4 && n % 2 === 0 && rng.chance(0.5)
    ? { kind: "lika", sizes: Array(n).fill(1), rader: true } : { kind: "lika", sizes: Array(n).fill(1) };
}

export default defineChallenge({
  id: "01",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot === "olikform") {
      const lay = rng.pick(Object.keys(OLIKFORM));
      const L = OLIKFORM[lay];
      const figurer = rng.shuffle([
        { kind: "olikform", lay, v: "lika" },
        { kind: "olikform-fel", lay, v: "fel" },
        { kind: L.andra.length === L.n ? "remsor" : "fel-antal", lay, v: "andra" },
      ]);
      return { typ: "olikform", shape: "rektangel", n: L.n, lay, figurer };
    }
    if (slot === "janej") {
      const sort = rng.pick(["ja", "nej", "nej", "olikform"]);
      if (sort === "olikform") {
        const lay = rng.pick(Object.keys(OLIKFORM));
        return { typ: "janej", shape: "rektangel", n: OLIKFORM[lay].n, lay, figur: { kind: "olikform", lay, v: "lika" } };
      }
      const shape = rng.pick(FORMER);
      const n = rng.int(2, 6);
      return { typ: "janej", shape, n, figur: sort === "ja" ? likaFigur(rng, shape, n) : { kind: "olika", sizes: olikaVikter(rng, n) } };
    }
    const shape = rng.pick(FORMER);
    const n = slot === "valj-intro" ? rng.int(2, 4) : rng.int(2, 6);
    const andra = rng.pick(["olika", "fler", ...(n > 2 ? ["farre"] : [])]);
    const d2 = andra === "olika" ? { kind: "olika", sizes: olikaVikter(rng, n) }
      : { kind: andra, sizes: Array(andra === "fler" ? n + 1 : n - 1).fill(1) };
    let d1 = { kind: "olika", sizes: olikaVikter(rng, n) };
    while (andra === "olika" && d1.sizes.join() === d2.sizes.join()) d1 = { kind: "olika", sizes: olikaVikter(rng, n) };
    return { typ: "valj", shape, n, figurer: rng.shuffle([likaFigur(rng, shape, n), d1, d2]) };
  },

  core: karna,

  build(p) {
    const { typ, shape, n } = p;
    const core = karna(p);
    const nOrd = tal(n);
    const rutor = typ === "olikform" || p.figur?.kind === "olikform";
    const ex = exempel(p);
    const help = [
      { step: "orientering", text: typ === "janej"
        ? `Räkna delarna. Är det ${nOrd} delar? Titta sedan på storleken på varje del.`
        : `Räkna delarna i varje figur. Titta sedan på storleken på delarna.`, highlight: { whole: true } },
      { step: "princip", text: `${stor(nOrd)} bitar räcker inte. Varje bit måste vara lika stor.${rutor ? " Räkna rutorna i varje del: lika många rutor är lika stor del." : ""}` },
      { step: "modellering", text: ex.text, view: ex.view },
      { step: "atergang", text: "Nu provar du själv: jämför delarna i din uppgift." },
    ];
    const misconceptions = ["raknar-bara-antal", ...(rutor ? ["lika-form-kravs"] : [])];

    if (typ === "janej") {
      const ja = p.figur.kind !== "olika";
      const cards = [
        { id: "ja", face: { text: `Ja, ${n} lika stora delar` } },
        { id: "nej", face: { text: "Nej, delningen behöver ändras" } },
      ];
      const a = areor(shape, p.figur);
      return {
        core,
        prompt: `Är ${BEST[shape]} delad i ${nOrd} lika stora delar?`,
        values: { n, areor: a, lika: ja },
        view: {
          component: "sammansatt",
          delar: [
            { view: figurView(shape, p.figur, rutor ? { rutor: true } : {}) },
            { view: { component: "kort", cards }, svar: true, label: "Välj ja eller nej" },
          ],
        },
        answer: { type: "choice", options: ["ja", "nej"] },
        key: {
          type: "choice", correct: ja ? "ja" : "nej", display: ja ? "Ja" : "Nej",
          examples: { right: [{ id: ja ? "ja" : "nej" }], wrong: [{ id: ja ? "nej" : "ja" }] },
        },
        help,
        misconceptions,
        feedback: ja
          ? { correct: p.figur.kind === "olikform" ? `Ja! Delarna har olika form, men varje del är ${a[0]} rutor – de är lika stora.` : `Ja! Alla ${n} delar är lika stora.`,
            wrong: p.figur.kind === "olikform" ? `Delarna har olika form, men räkna rutorna: varje del är ${a[0]} rutor. De är lika stora, så delningen är rätt.` : `Alla ${n} delar är lika stora, så delningen är rätt.` }
          : { correct: `Ja! Det är ${n} delar, men de är inte lika stora. Delningen behöver ändras.`,
            wrong: `Det är ${n} delar, men de är inte lika stora – några är större än andra. Då är det inte ${nOrd} lika stora delar.` },
        review: ja
          ? `${stor(BEST[shape])} är delad i ${n} lika stora delar${p.figur.kind === "olikform" ? ` (olika form, men ${a[0]} rutor var)` : ""}.`
          : `${stor(BEST[shape])} har ${n} delar, men de är olika stora (${a.join(", ")}). För ${nOrd} lika stora delar måste varje del vara lika stor.`,
      };
    }

    // valj / olikform: tre kort med figurer, välj den med n lika stora delar.
    const figurer = p.figurer;
    const cards = figurer.map((f, i) => ({ id: kortId(i), face: figurView(shape, f, rutor ? { rutor: true } : {}) }));
    const ri = figurer.findIndex((f) => f.kind === "lika" || f.kind === "olikform");
    const ratt = cards[ri].id;
    const fel = cards.filter((_, i) => i !== ri).map((c) => c.id);
    const varfor = figurer.map((f, i) => {
      if (i === ri) return null;
      const a = areor(shape, f);
      if (f.kind === "fler" || f.kind === "farre" || f.kind === "fel-antal") return `kort ${i + 1} har ${a.length} delar`;
      return `kort ${i + 1} har olika stora delar`;
    }).filter(Boolean);
    return {
      core,
      prompt: `Vilken ${NAMN[shape]} är delad i ${nOrd} lika stora delar?`,
      values: { n, figurer: figurer.map((f) => ({ kind: f.kind, areor: areor(shape, f) })) },
      view: { component: "kort", cards, stora: true },
      answer: { type: "choice", options: cards.map((c) => c.id) },
      key: {
        type: "choice", correct: ratt, display: `Kort ${ri + 1}`,
        examples: { right: [{ id: ratt }], wrong: fel.map((id) => ({ id })) },
      },
      help,
      misconceptions: [...misconceptions, ...(figurer.some((f) => f.kind === "fler" || f.kind === "farre" || f.kind === "fel-antal") ? ["fel-antal-delar"] : [])],
      feedback: {
        correct: typ === "olikform"
          ? `Ja! Delarna har olika form, men varje del är ${areor(shape, figurer[ri])[0]} rutor – lika stora.`
          : `Ja! Där är alla ${n} delar lika stora.`,
        wrong: `Kort ${ri + 1} har ${n} lika stora delar. ${stor(varfor.join(" och "))}.`,
      },
      review: `Kort ${ri + 1} är delad i ${n} lika stora delar${typ === "olikform" ? ` – olika form, men ${areor(shape, figurer[ri])[0]} rutor var` : ""}. ${stor(varfor.join(" och "))}.`,
    };
  },

  reserve: [
    { slot: "valj-intro", params: { typ: "valj", shape: "cirkel", n: 2, figurer: [{ kind: "olika", sizes: [2, 3] }, { kind: "lika", sizes: [1, 1] }, { kind: "fler", sizes: [1, 1, 1] }] } },
    { slot: "valj-intro", params: { typ: "valj", shape: "rektangel", n: 4, figurer: [{ kind: "lika", sizes: [1, 1, 1, 1] }, { kind: "olika", sizes: [2, 3, 2, 4] }, { kind: "farre", sizes: [1, 1, 1] }] } },
    { slot: "valj-intro", params: { typ: "valj", shape: "stav", n: 3, figurer: [{ kind: "olika", sizes: [2, 4, 3] }, { kind: "olika", sizes: [3, 3, 2] }, { kind: "lika", sizes: [1, 1, 1] }] } },
    { slot: "valj", params: { typ: "valj", shape: "cirkel", n: 5, figurer: [{ kind: "farre", sizes: [1, 1, 1, 1] }, { kind: "lika", sizes: [1, 1, 1, 1, 1] }, { kind: "olika", sizes: [2, 3, 2, 4, 3] }] } },
    { slot: "valj", params: { typ: "valj", shape: "stav", n: 6, figurer: [{ kind: "olika", sizes: [2, 2, 3, 2, 4, 2] }, { kind: "fler", sizes: [1, 1, 1, 1, 1, 1, 1] }, { kind: "lika", sizes: [1, 1, 1, 1, 1, 1] }] } },
    { slot: "valj", params: { typ: "valj", shape: "rektangel", n: 6, figurer: [{ kind: "lika", sizes: [1, 1, 1, 1, 1, 1], rader: true }, { kind: "olika", sizes: [3, 2, 2, 4, 2, 3] }, { kind: "olika", sizes: [2, 4, 3, 3, 2, 2] }] } },
    { slot: "janej", params: { typ: "janej", shape: "cirkel", n: 4, figur: { kind: "olika", sizes: [2, 4, 3, 3] } } },
    { slot: "janej", params: { typ: "janej", shape: "stav", n: 5, figur: { kind: "lika", sizes: [1, 1, 1, 1, 1] } } },
    { slot: "janej", params: { typ: "janej", shape: "rektangel", n: 4, lay: "4", figur: { kind: "olikform", lay: "4", v: "lika" } } },
    { slot: "olikform", params: { typ: "olikform", shape: "rektangel", n: 3, lay: "3", figurer: [
      { kind: "olikform-fel", lay: "3", v: "fel" }, { kind: "olikform", lay: "3", v: "lika" },
      { kind: "remsor", lay: "3", v: "andra" }] } },
    { slot: "olikform", params: { typ: "olikform", shape: "rektangel", n: 6, lay: "6", figurer: [
      { kind: "olikform", lay: "6", v: "lika" }, { kind: "fel-antal", lay: "6", v: "andra" },
      { kind: "olikform-fel", lay: "6", v: "fel" }] } },
  ],
});

/** Hjälpens exempel: ANDRA tal (annat antal delar), delarna jämförda bredvid/över varandra. */
function exempel(p) {
  const rutor = p.typ === "olikform" || p.figur?.kind === "olikform";
  if (rutor) {
    const lay = p.lay === "6" ? "3" : "6";
    const L = OLIKFORM[lay];
    return {
      text: `Ett exempel: den här rektangeln har ${L.n} delar med olika form. Lägg delarna bredvid varandra och räkna rutorna – varje del är ${L.lika[0].length} rutor, så delarna är lika stora.`,
      view: { component: "figur", form: "rektangel", rows: L.rows, cols: L.cols, regions: L.lika.map((cells) => ({ cells })), jamfor: true },
    };
  }
  const m = p.n === 3 ? 4 : 3;
  const sizes = m === 3 ? [2, 4, 3] : [3, 2, 4, 3];
  const form = p.shape === "cirkel" ? "cirkel" : "stav";
  return {
    text: form === "cirkel"
      ? `Ett exempel: en cirkel med ${m} delar. Lägg delarna ovanpå varandra – de täcker inte lika mycket, så de är inte lika stora.`
      : `Ett exempel: en stav med ${m} delar. Lägg delarna under varandra från samma start – de är olika långa, så de är inte lika stora.`,
    view: { component: "figur", form, sizes, jamfor: true },
  };
}
