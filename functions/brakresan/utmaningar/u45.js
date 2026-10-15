// ============================================================================
// 45. Hur många procent? (src/brakresan/utmaningar/u45.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 45: procentandelen när del och helhet är givna. Bild/situation med
// bråkuppställning och procentfält (multi, en poäng):
//   • bråket k/N – eller ett likvärdigt bråk
//   • procenten 100 · k/N (hel procent)
// Bilden: N ≤ 36 = föremål i lika stora grupper med k markerade och tydlig
// total; större N = band med hela antalet utskrivet och lika delar.
// Generering: helhet N ≤ 100 där 100k/N är ett heltal, många olika helheter
// (inte bara 100). Två uppgifter per omgång JÄMFÖR samma antal delar i olika
// stora helheter (6 av 12 och 6 av 24) – samma antal är inte samma procent.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { falt, text, nd } from "./delat-g.js";

const SLOTS = ["intro", "intro", "intro", "normal", "jamfor", "normal", "normal", "jamfor", "overforing", "overforing"];

/** Alla (k, N): 4 ≤ N ≤ 100, 1 ≤ k < N, 100k/N heltal; band (N > 36) bara med högst 20 delar. */
export const PAR = [];
for (let N = 4; N <= 100; N++) {
  for (let k = 1; k < N; k++) {
    if ((100 * k) % N !== 0) continue;
    if (N > 36 && q(k, N).d > 20) continue;
    PAR.push({ k, N });
  }
}
/** Jämförelsepar: samma k, två olika N ≤ 36, båda hela procent. */
export const JAMFOR = [];
for (const a of PAR) for (const b of PAR) if (a.k === b.k && a.N < b.N && b.N <= 36) JAMFOR.push({ k: a.k, N: a.N, N2: b.N });

const SITUATIONER = {
  glasogon: { sak: "elever", item: "kula", text: (k, N) => `${k} av ${N} elever i klassen har glasögon.` },
  mal: { sak: "skott", item: "stjarna", text: (k, N) => `Leo sköt ${N} skott på mål och gjorde ${k} mål.` },
  knappar: { sak: "knappar", item: "knapp", text: (k, N) => `I en burk finns ${N} knappar. ${k} av dem är röda.` },
  klossar: { sak: "klossar", item: "kloss", text: (k, N) => `Sara bygger med ${N} klossar. ${k} av klossarna är gröna.` },
};

const pct = (k, N) => (100 * k) / N;

/** Bilden för k av N: föremål i grupper (N ≤ 36) eller band. */
function bild(k, N, item = "kula", sak = "st") {
  const v = q(k, N);
  if (N <= 36) return { component: "mangd", count: N, marked: k, item, ...(v.d >= 2 && v.d <= 12 && v.d < N ? { groups: v.d } : {}), label: `Hela gruppen = ${N} ${sak === "st" ? "" : sak}`.trim() };
  return { component: "stav", parts: v.d, marked: v.n, label: `Hela bandet = ${N} ${sak}, varje del = ${N / v.d}` };
}

const kärna = (p) => (p.N2 ? `jamfor:${p.k}/${p.N}|${p.k}/${p.N2}` : `${p.k}/${p.N}`);

export default defineChallenge({
  id: "45",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot === "jamfor") return { ...rng.pick(JAMFOR) };
    const pool = slot === "intro" ? PAR.filter((x) => x.N <= 20) : rng.chance(0.25) ? PAR.filter((x) => x.N > 36) : PAR.filter((x) => x.N <= 36);
    const p = rng.pick(pool);
    return { ...p, ...(slot === "overforing" ? { situation: rng.pick(Object.keys(SITUATIONER)) } : {}) };
  },

  core: kärna,

  build({ k, N, N2 = null, situation = null }) {
    const help = [
      { step: "orientering", text: "Hela gruppen är 100 %. Räkna hur många det är totalt och hur många som söks.", highlight: { whole: true } },
      { step: "princip", text: "Vilket bråk av hela gruppen är delen? Skriv det som hundradelar – procent betyder hundradelar." },
      {
        step: "modellering",
        text: "Ett exempel med andra tal: 3 av 15 är 3/15 = 1/5. En femtedel är 20/100 – alltså 20 %.",
        view: { component: "mangd", count: 15, marked: 3, groups: 5, item: "kloss" },
      },
      { step: "atergang", text: "Nu provar du själv: skriv delen av hela som ett bråk och gör om bråket till hundradelar." },
    ];
    if (N2) {
      const a = pct(k, N);
      const b = pct(k, N2);
      const fel = [{ parts: { a: text(b), b: text(a) } }, { parts: { a: text(a), b: text(a) } }, { parts: { a: text(k), b: text(k) } }];
      return {
        core: kärna({ k, N, N2 }),
        prompt: `Två grupper har lika många markerade: ${k} av ${N} och ${k} av ${N2}. Hur många procent är markerade i varje grupp?`,
        values: { k, N, N2, a, b },
        view: {
          component: "sammansatt",
          rad: true,
          delar: [
            { view: bild(k, N), rubrik: `${k} av ${N}` },
            { view: bild(k, N2), rubrik: `${k} av ${N2}` },
            { view: { component: "notation", expr: [{ text: `${k} av ${N} =` }, { input: true }] }, svar: "a" },
            { view: { component: "notation", expr: [{ text: `${k} av ${N2} =` }, { input: true }] }, svar: "b" },
          ],
        },
        answer: { type: "multi", parts: { a: { type: "number", input: "percent" }, b: { type: "number", input: "percent" } } },
        key: {
          type: "multi",
          parts: { a: { type: "number", value: nd(q(k, N)), requirement: { kind: "percent" } }, b: { type: "number", value: nd(q(k, N2)), requirement: { kind: "percent" } } },
          display: `${k} av ${N} = ${a} % och ${k} av ${N2} = ${b} %`,
          examples: { right: [{ parts: { a: text(a), b: text(`${b} %`) } }], wrong: fel },
        },
        help,
        misconceptions: ["samma-antal-samma-procent", "antalet-ar-procenten"],
        feedback: {
          correct: `Ja! ${k} av ${N} är ${a} %, men ${k} av ${N2} är bara ${b} %. Samma antal – olika stora helheter.`,
          wrong: `${k}/${N} = ${a}/100 = ${a} % och ${k}/${N2} = ${b}/100 = ${b} %. Samma antal är inte samma procent när helheterna är olika stora.`,
        },
        review: `${k} av ${N} = ${a} %; ${k} av ${N2} = ${b} %. Procenten beror på hur stor helheten är.`,
      };
    }
    const sit = SITUATIONER[situation];
    const P = pct(k, N);
    const v = q(k, N);
    const kedja = N === 100 ? `${k}/100 = ${P} %` : `${k}/${N}${v.d !== N ? ` = ${v.n}/${v.d}` : ""}${v.d !== 100 ? ` = ${P}/100` : ""} = ${P} %`;
    const fel = [
      { parts: { brak: falt(k, N), procent: text(k === P ? P + 1 : k) } }, //        antalet som procent
      { parts: { brak: falt(N - k, N), procent: text(100 - P) } }, //               de andra
      { parts: { brak: falt(N, k), procent: text(P) } }, //                         omvänt bråk
    ].filter((x) => !(x.parts.procent.text === String(P) && Number(x.parts.brak.fields.n) * N === k * Number(x.parts.brak.fields.d)));
    return {
      core: kärna({ k, N }),
      prompt: sit ? `${sit.text(k, N)} Hur stor del är det? Skriv bråket och procenten.` : `${k} av ${N} är markerade. Hur stor del är det? Skriv bråket och procenten.`,
      values: { k, N, procent: P },
      view: {
        component: "sammansatt",
        delar: [
          { view: bild(k, N, sit?.item, sit?.sak) },
          { view: { component: "notation", expr: [{ text: "Bråk:" }, { input: true }] }, svar: "brak" },
          { view: { component: "notation", expr: [{ text: "Procent:" }, { input: true }] }, svar: "procent" },
        ],
      },
      answer: { type: "multi", parts: { brak: { type: "number", input: "fraction" }, procent: { type: "number", input: "percent" } } },
      key: {
        type: "multi",
        parts: { brak: { type: "number", value: nd(v), requirement: { kind: "value" } }, procent: { type: "number", value: nd(v), requirement: { kind: "percent" } } },
        display: kedja,
        examples: {
          right: [{ parts: { brak: falt(k, N), procent: text(P) } }, { parts: { brak: falt(v.n, v.d), procent: text(`${P} %`) } }, { parts: { brak: falt(P, 100), procent: text(P) } }],
          wrong: fel,
        },
      },
      help,
      misconceptions: ["antalet-ar-procenten", "raknar-resten", "omvant-brak"],
      feedback: {
        correct: `Ja! ${kedja}.`,
        wrong: `Delen av hela gruppen är ${k}/${N}. ${kedja}.`,
      },
      review: `${kedja}. Bråket del/helhet görs om till hundradelar.`,
    };
  },

  reserve: [
    { slot: "intro", params: { k: 1, N: 4 } },
    { slot: "intro", params: { k: 3, N: 10 } },
    { slot: "intro", params: { k: 7, N: 20 } },
    { slot: "normal", params: { k: 6, N: 24 } },
    { slot: "normal", params: { k: 9, N: 12 } },
    { slot: "normal", params: { k: 12, N: 40 } },
    { slot: "normal", params: { k: 45, N: 60 } },
    { slot: "jamfor", params: { k: 6, N: 12, N2: 24 } },
    { slot: "jamfor", params: { k: 3, N: 10, N2: 20 } },
    { slot: "overforing", params: { k: 6, N: 24, situation: "glasogon" } },
    { slot: "overforing", params: { k: 4, N: 5, situation: "mal" } },
  ],
});
