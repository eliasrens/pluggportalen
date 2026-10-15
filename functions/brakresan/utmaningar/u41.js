// ============================================================================
// 41. Procent i hundrarutan (src/brakresan/utmaningar/u41.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 41: procent som hundradelar. Hundrarutan: tio rader med tio rutor,
// 1 ruta = 1/100 = 0,01 = 1 % och 1 rad = 10 %.
//   • fem MÅLA: måla p % (antal rutor, alla lika stora urval godtas)
//   • fem LÄSA: skriv hur många procent som är markerat – ibland hela
//     kolumner eller ett block i stället för läsordning (omgrupperad bild)
// Generering: hela procent 0–100 (målning 1–100, en tom målning går inte att
// lämna in), tyngd på 1, 10, 20, 25, 50, 75, 100 och varierade mellanvärden.
// Ingen timer, inga poäng för snabb målning.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { ids, text, nd } from "./delat-g.js";

const SLOTS = ["mala", "las", "mala", "las", "mala", "las", "mala", "las", "mala", "las"];
const TYNGD = [1, 10, 20, 25, 50, 75, 100];
const delar = ids(100);

/** Markerade rutor: läsordning, hela kolumner (vänster till höger) eller ett kvadratiskt block. */
export function markering(p, layout) {
  if (layout === "kolumner") {
    const ut = [];
    for (let c = 0; c < 10; c++) for (let r = 0; r < 10; r++) ut.push(`p${r * 10 + c}`);
    return ut.slice(0, p);
  }
  if (layout === "block") {
    const s = Math.sqrt(p);
    const ut = [];
    for (let r = 0; r < s; r++) for (let c = 0; c < s; c++) ut.push(`p${r * 10 + c}`);
    return ut;
  }
  return p;
}

const exempel = (p) => [37, 64, 18].find((x) => x !== p && x !== 100 - p);
/** "3 rader och 7 rutor". */
const radText = (p) => [Math.floor(p / 10) ? `${Math.floor(p / 10)} ${Math.floor(p / 10) === 1 ? "rad" : "rader"}` : null, p % 10 ? `${p % 10} ${p % 10 === 1 ? "ruta" : "rutor"}` : null]
  .filter(Boolean).join(" och ") || "inga rutor";

const kärna = (p) => `${p.typ}:${p.p}${p.layout && p.layout !== "rader" ? `:${p.layout}` : ""}`;

export default defineChallenge({
  id: "41",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const tung = index < 4 ? rng.chance(0.7) : rng.chance(0.35);
    let p = tung ? rng.pick(TYNGD) : rng.int(2, 99);
    if (slot === "mala") return { typ: "mala", p };
    if (!tung && rng.chance(0.08)) p = 0;
    const layout = [25, 4, 9, 16, 36, 49, 64, 81].includes(p) && rng.chance(0.5) ? "block" : p % 10 === 0 && p > 0 && p < 100 && rng.chance(0.5) ? "kolumner" : rng.chance(0.15) && p < 100 ? "kolumner" : "rader";
    return { typ: "las", p, layout };
  },

  core: kärna,

  build(params) {
    const { typ, p, layout = "rader" } = params;
    const v = q(p, 100);
    const ex = exempel(p);
    const help = [
      { step: "orientering", text: "Hela hundrarutan är 100 % och har 100 lika rutor.", highlight: { whole: true } },
      { step: "princip", text: "Procent betyder hundradelar: 1 ruta är 1 % och en hel rad är 10 %.", highlight: { count: true } },
      {
        step: "modellering",
        text: `Ett exempel med ett annat tal: ${ex} % är ${ex} av 100 rutor – ${radText(ex)}.`,
        view: { component: "hundraruta", marked: ex },
      },
      { step: "atergang", text: typ === "mala" ? "Nu provar du själv: hela rader för tiotalen, rutor för resten." : "Nu provar du själv: räkna hela rader (eller kolumner) och enstaka rutor." },
    ];
    const common = {
      core: kärna(params),
      values: { procent: p, value: nd(v) },
      help,
      misconceptions: ["procent-ar-hundradelar", "raknar-omarkerade", "rad-ar-en-procent"],
      review: `${p} % = ${p}/100: ${p} av 100 lika rutor (${radText(p)}).`,
    };
    if (typ === "mala") {
      const fel = [p >= 10 && p % 10 === 0 ? p / 10 : p + 10 <= 100 ? p + 10 : p - 10, p < 100 ? p + 1 : p - 1, 100 - p]
        .filter((x, i, l) => x > 0 && x !== p && l.indexOf(x) === i);
      return {
        ...common,
        prompt: `Måla ${p} % av hundrarutan.`,
        view: { component: "hundraruta", label: "Hela hundrarutan = 100 % = 100 rutor" },
        answer: { type: "paint", parts: delar },
        key: {
          type: "paint", count: p,
          display: `${p} % = ${p} rutor av 100`,
          examples: { right: [{ selected: delar.slice(0, p) }, { selected: delar.slice(100 - p) }, { selected: markering(p, "kolumner") }], wrong: fel.map((x) => ({ selected: delar.slice(0, x) })) },
        },
        feedback: {
          correct: `Ja! ${p} % är ${p} av 100 rutor: ${radText(p)}.`,
          wrong: `${p} % betyder ${p} hundradelar: ${radText(p)} i hundrarutan.`,
        },
      };
    }
    const felP = [100 - p, p % 10 === 0 ? p / 10 : (p % 10) * 10 + Math.floor(p / 10), p === 0 ? 1 : p - 1]
      .filter((x, i, l) => x !== p && x >= 0 && x <= 100 && l.indexOf(x) === i);
    return {
      ...common,
      prompt: "Hur många procent av hundrarutan är markerat?",
      view: { component: "hundraruta", marked: markering(p, layout), label: "Hela hundrarutan = 100 % = 100 rutor", expr: [{ text: "Markerat:" }, { input: true }] },
      answer: { type: "number", input: "percent" },
      key: {
        type: "number", value: nd(v), requirement: { kind: "percent" },
        display: `${p} % (${p} av 100 rutor)`,
        examples: { right: [text(p), text(`${p} %`), text(`${p}%`)], wrong: felP.map((x) => text(x)) },
      },
      feedback: {
        correct: `Ja! ${p} av 100 rutor är markerade: ${p} %.`,
        wrong: `Räkna rutorna: ${p} av 100 är markerade. ${p} hundradelar är ${p} %.`,
      },
    };
  },

  reserve: [
    { slot: "mala", params: { typ: "mala", p: 37 } },
    { slot: "mala", params: { typ: "mala", p: 25 } },
    { slot: "mala", params: { typ: "mala", p: 1 } },
    { slot: "mala", params: { typ: "mala", p: 75 } },
    { slot: "mala", params: { typ: "mala", p: 100 } },
    { slot: "las", params: { typ: "las", p: 50, layout: "kolumner" } },
    { slot: "las", params: { typ: "las", p: 10, layout: "rader" } },
    { slot: "las", params: { typ: "las", p: 25, layout: "block" } },
    { slot: "las", params: { typ: "las", p: 63, layout: "rader" } },
    { slot: "las", params: { typ: "las", p: 0, layout: "rader" } },
    { slot: "las", params: { typ: "las", p: 20, layout: "kolumner" } },
  ],
});
