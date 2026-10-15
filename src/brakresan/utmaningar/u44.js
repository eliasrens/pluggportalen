// ============================================================================
// 44. Procent av antal (src/brakresan/utmaningar/u44.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 44: beräkna procentdelen av ett känt antal. Sex taluppgifter med
// grupp- eller bandmodell och fyra vardagssituationer.
//   • procent främst 10, 20, 25, 50, 75 – 5 % bara i de två sista rundorna
//   • N ≤ 200 väljs så att delen blir ett heltal (exakt, percent.js)
//   • modellen: N ≤ 36 = föremål i lika stora grupper (en grupp = en lika del
//     av 100 %, inget markerat – att räkna markerade vore facit); annars ett
//     band med hela antalet utskrivet, delat i lika delar, procentdelen randig
//   • två rundor har en obligatorisk rimlighetsfråga (multi): är delen mindre
//     än hälften, precis hälften, mer än hälften men mindre än hela antalet …
//   • kontrollen gäller delANTALET – procentsiffran är fel svar
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gcd, percentOf } from "../math/index.js";
import { kortId, text } from "./delat-g.js";

const SLOTS = ["tal", "tal", "tal", "tal", "tal-rimlig", "tal", "vardag", "vardag-rimlig", "vardag-5", "vardag-5"];
const PROCENT = [10, 20, 25, 50, 75];

/** Hur många lika delar 100 % delas i för p: 25 → 4, 75 → 4, 10 → 10, 5 → 20. */
export const delar = (p) => 100 / gcd(p, 100);

const SITUATIONER = {
  elever: { sak: "elever", text: (p, N) => `I en skola går ${N} elever i mellanstadiet. ${p} % av dem cyklar till skolan. Hur många elever cyklar?` },
  appel: { sak: "äpplen", text: (p, N) => `I en låda finns ${N} äpplen. ${p} % av äpplena är röda. Hur många röda äpplen finns det?` },
  sidor: { sak: "sidor", text: (p, N) => `En bok har ${N} sidor. Maja har läst ${p} % av boken. Hur många sidor har hon läst?` },
  kronor: { sak: "kronor", text: (p, N) => `Omar har ${N} kr. Han sparar ${p} % av pengarna. Hur många kronor sparar han?` },
  frön: { sak: "frön", text: (p, N) => `Ella sår ${N} frön. ${p} % av fröna gror. Hur många frön gror?` },
};

const RIMLIG = [
  { id: "under-halv", text: (N) => `Mindre än hälften av ${N}` },
  { id: "halv", text: (N) => `Precis hälften av ${N}` },
  { id: "over-halv", text: (N) => `Mer än hälften men mindre än ${N}` },
  { id: "over-hel", text: (N) => `Mer än ${N}` },
];
const rimligSvar = (p) => (p < 50 ? "under-halv" : p === 50 ? "halv" : "over-halv");

// Situationen är inte ny matematik – kärnan är bara p och N.
const kärna = ({ p, N }) => `${p}%av${N}`;

export default defineChallenge({
  id: "44",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const p = slot === "vardag-5" ? 5 : rng.pick(index < 3 ? [10, 25, 50] : PROCENT);
    const enhet = delar(p);
    const max = Math.floor(200 / enhet);
    const min = Math.ceil(8 / enhet);
    const alla = [];
    for (let m = Math.max(min, enhet >= 10 ? 1 : 2); m <= (index < 3 ? Math.min(max, Math.max(min + 3, 10)) : max); m++) alla.push(enhet * m);
    // Oftast "runda" antal (tiotal eller högst 40), ibland vilket som helst.
    const runda = alla.filter((x) => x % 10 === 0 || x <= 40);
    const N = rng.pick(runda.length && rng.chance(0.75) ? runda : alla);
    return { p, N, ...(slot.startsWith("vardag") ? { situation: rng.pick(Object.keys(SITUATIONER)) } : {}), ...(slot.endsWith("rimlig") ? { rimlig: true } : {}) };
  },

  core: kärna,

  build({ p, N, situation = null, rimlig = false }) {
    const del = percentOf(p, N).n;
    const k = delar(p);
    const enDel = N / k;
    const sit = SITUATIONER[situation];
    const sak = sit?.sak ?? "st";
    const bandVy = { component: "stav", parts: k, marked: (p * k) / 100, label: `Hela bandet = ${N}${sit ? ` ${sak}` : ""} = 100 %` };
    const grupper = !sit && N <= 36 ? { component: "mangd", count: N, groups: k, item: "kula", label: `Hela samlingen = ${N} kulor = 100 %` } : null;
    const modell = grupper ?? bandVy;
    const expr = [{ text: `${p} % av ${N} =` }, { input: true }, ...(sit ? [{ text: sak }] : [])];
    const fel = [p, N - del, del + enDel <= N ? del + enDel : del - enDel].filter((x, i, l) => x !== del && x >= 0 && l.indexOf(x) === i);
    const strategi = p === 25 || p === 75 ? `25 % är en fjärdedel: ${N} ÷ 4` : p === 50 ? `50 % är hälften: ${N} ÷ 2` : p === 5 ? `5 % är hälften av 10 %` : `10 % är en tiondel: ${N} ÷ 10`;
    const steg = p === 75 ? `25 % av ${N} är ${N / 4}, och 75 % är tre sådana: ${del}` : p === 20 ? `10 % av ${N} är ${N / 10}, och 20 % är dubbelt så mycket: ${del}` :
      p === 5 ? `10 % av ${N} är ${N / 10}, och 5 % är hälften: ${del}` : `${strategi} = ${del}`;
    const exP = p === 25 ? 10 : 25;
    const exN = exP === 25 ? 60 : 70;
    const base = {
      core: kärna({ p, N }),
      values: { p, N, del },
      help: [
        { step: "orientering", text: `Hela antalet är ${N}${sit ? ` ${sak}` : ""} – det är 100 %. ${grupper ? `Kulorna är delade i ${k} lika grupper.` : `Bandet är delat i ${k} lika delar.`}`, highlight: { whole: true, ...(rimlig ? { del: 0 } : {}) } },
        { step: "princip", text: `${p === 25 || p === 75 ? "25 % är en fjärdedel." : p === 50 ? "50 % är hälften." : "Hitta 10 % först – en tiondel av hela antalet."} Hur många är en lika del?`, highlight: { count: true, ...(rimlig ? { del: 0 } : {}) } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${exP} % av ${exN}. ${exP === 25 ? `En fjärdedel av ${exN} är ${exN / 4}.` : `En tiondel av ${exN} är ${exN / 10}.`}`,
          view: { component: "stav", parts: delar(exP), marked: 1, label: `Hela bandet = ${exN} = 100 %` },
        },
        { step: "atergang", text: "Nu provar du själv: hur många är en del av bandet, och hur många delar ska du ta?" },
      ],
      misconceptions: ["svarar-med-procentsiffran", "raknar-resten", "fel-del"],
      feedback: {
        correct: `Ja! ${steg}. ${p} % av ${N} = ${del}.`,
        wrong: `${p} % är ${(p * k) / 100} av ${k} lika delar av ${N}. En del är ${enDel}, så ${p} % av ${N} = ${del} – inte ${p}.`,
      },
      review: `${p} % av ${N} = ${del}. ${steg}.`,
    };
    const prompt = sit ? sit.text(p, N) : `Hur mycket är ${p} % av ${N}?`;
    if (!rimlig) {
      return {
        ...base,
        prompt,
        view: { ...modell, expr },
        answer: { type: "number", input: "integer" },
        key: {
          type: "number", value: del, requirement: { kind: "integer" },
          display: `${p} % av ${N} = ${del}`,
          examples: { right: [text(del)], wrong: fel.map(text) },
        },
      };
    }
    const cards = RIMLIG.map((r, i) => ({ id: kortId(i), face: { text: r.text(N) } }));
    const rId = cards[RIMLIG.findIndex((r) => r.id === rimligSvar(p))].id;
    const fId = cards.find((c) => c.id !== rId).id;
    return {
      ...base,
      prompt: `${prompt} Bedöm också: hur stort är svaret?`,
      view: {
        component: "sammansatt",
        delar: [
          { view: modell },
          { view: { component: "notation", expr }, svar: "antal" },
          { view: { component: "kort", cards, lista: true }, svar: "rimlig", rubrik: "Är svaret rimligt? Svaret är …", label: "Välj ett påstående" },
        ],
      },
      answer: { type: "multi", parts: { antal: { type: "number", input: "integer" }, rimlig: { type: "choice", options: cards.map((c) => c.id) } } },
      key: {
        type: "multi",
        parts: { antal: { type: "number", value: del, requirement: { kind: "integer" } }, rimlig: { type: "choice", correct: rId } },
        display: `${p} % av ${N} = ${del} (${RIMLIG.find((r) => r.id === rimligSvar(p)).text(N).toLowerCase()})`,
        examples: {
          right: [{ parts: { antal: text(del), rimlig: { id: rId } } }],
          wrong: [{ parts: { antal: text(del), rimlig: { id: fId } } }, ...fel.map((f) => ({ parts: { antal: text(f), rimlig: { id: rId } } }))],
        },
      },
      feedback: {
        ...base.feedback,
        correct: `${base.feedback.correct} Rimligt: ${p} % är ${p < 50 ? "mindre än" : p === 50 ? "precis" : "mer än"} hälften, och under 100 % blir delen mindre än hela antalet.`,
      },
    };
  },

  reserve: [
    [25, 80], [75, 40], [10, 70], [50, 36], [20, 45], [25, 24], [10, 150], [75, 120],
  ].map(([p, N], i) => ({ slot: i === 4 ? "tal-rimlig" : "tal", params: { p, N, ...(i === 4 ? { rimlig: true } : {}) } }))
    .concat([
      { slot: "vardag", params: { p: 20, N: 60, situation: "appel" } },
      { slot: "vardag-rimlig", params: { p: 75, N: 160, situation: "sidor", rimlig: true } },
      { slot: "vardag-5", params: { p: 5, N: 120, situation: "kronor" } },
      { slot: "vardag-5", params: { p: 5, N: 40, situation: "frön" } },
    ]),
});


