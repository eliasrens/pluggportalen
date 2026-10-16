// ============================================================================
// 46. Blandad storleksordning (src/brakresan/utmaningar/u46.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 46: jämföra tal oavsett skrivform. Sortera fyra kort (minst ett
// bråk, ett decimaltal och ett procenttal) från minst till störst (order).
// Två uppgifter per omgång placerar sedan hela ordningen på tallinjen: en
// tallinje 0–1 med 0 och 1 utskrivna och fyra punkter A–D (bokstäverna
// i slumpad ordning); eleven lägger varje kort vid sin punkt (categories).
// Båda delarna krävs (multi, en poäng). Tallinjen omvandlar aldrig korten.
// Generering: fyra OLIKA värden 0–1 (ingen strikt sortering med lika värden),
// bråk med nämnare 2, 4, 5, 10, 20, 25 (högst två decimaler), hela procent.
// Tallinjeuppgifterna använder multiplar av 0,05 så att punkterna hamnar på
// tydliga streck (20 delar).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, sortAscending } from "../math/index.js";
import { kortId, br, dec, pct, decText, pctText, nd } from "./delat-g.js";

const SLOTS = ["ordna", "ordna", "ordna", "ordna", "tallinje", "ordna", "ordna", "tallinje", "ordna", "ordna"];
const BOKSTAV = ["A", "B", "C", "D"];
const NAMNARE = [2, 4, 5, 10, 20, 25];

const V = (p) => q(p, 100);
/** Kan p % skrivas som bråk med en av de vanliga nämnarna? */
const somBrak = (p) => NAMNARE.includes(V(p).d);

function framsida(k) {
  const v = V(k.p);
  if (k.form === "brak") return br(v.n, v.d);
  if (k.form === "dec") return dec(v);
  return pct(v);
}
const kortText = (k) => {
  const v = V(k.p);
  return k.form === "brak" ? `${v.n}/${v.d}` : k.form === "dec" ? decText(v) : pctText(v);
};

const kärna = ({ kort, typ }) => `${typ}:${[...kort].sort((a, b) => a.p - b.p).map((k) => `${k.form}${k.p}`).join("<")}`;

export default defineChallenge({
  id: "46",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const tallinje = slot === "tallinje";
    const steg = tallinje ? 5 : 1;
    // Fyra olika procentvärden, minst 4 procentenheter isär (läsbart på tallinjen: minst ett streck).
    const ps = [];
    for (let i = 0; ps.length < 4 && i < 200; i++) {
      const p = steg * rng.int(1, Math.floor(99 / steg));
      if (ps.every((x) => Math.abs(x - p) >= (tallinje ? 10 : 4))) ps.push(p);
    }
    // Formerna: minst ett bråk (värdet måste gå som vanligt bråk), ett decimaltal, ett procenttal.
    const brakIdx = ps.findIndex(somBrak);
    if (brakIdx < 0) ps[0] = rng.pick(index < 3 ? [25, 50, 75] : [20, 40, 60, 80, 25, 75].filter((x) => ps.every((y) => Math.abs(y - x) >= (tallinje ? 10 : 4))).concat([50]).slice(0, 3));
    const fIdx = ps.findIndex(somBrak);
    const rest = rng.shuffle([0, 1, 2, 3].filter((i) => i !== fIdx));
    const former = [];
    former[fIdx] = "brak";
    former[rest[0]] = "dec";
    former[rest[1]] = "pct";
    former[rest[2]] = somBrak(ps[rest[2]]) ? rng.pick(["brak", "dec", "pct"]) : rng.pick(["dec", "pct"]);
    const kort = rng.shuffle(ps.map((p, i) => ({ p, form: former[i] })));
    if (!tallinje) return { typ: "ordna", kort };
    const bokstaver = rng.shuffle(BOKSTAV);
    return { typ: "tallinje", kort: kort.map((k, i) => ({ ...k, punkt: bokstaver[i] })) };
  },

  core: kärna,

  build({ typ, kort }) {
    const cards = kort.map((k, i) => ({ id: kortId(i), face: framsida(k) }));
    const values = Object.fromEntries(cards.map((c, i) => [c.id, nd(V(kort[i].p))]));
    const stigande = sortAscending(cards.map((c, i) => ({ id: c.id, v: V(kort[i].p) })), (x) => x.v).map((x) => x.id);
    const texter = Object.fromEntries(cards.map((c, i) => [c.id, kortText(kort[i])]));
    const ordning = stigande.map((id) => texter[id]).join(" < ");
    const hundra = stigande.map((id) => `${texter[id]} = ${kort[cards.findIndex((c) => c.id === id)].p}/100`).join(", ");
    const fel1 = [...stigande];
    [fel1[1], fel1[2]] = [fel1[2], fel1[1]];
    const fel2 = [...stigande].reverse();
    const sorteringVy = { component: "sortering", cards, order: true, ends: ["Minst", "Störst"] };
    const help = [
      { step: "orientering", text: "Korten är skrivna på olika sätt. Alla är tal mellan 0 och 1 – hela = 1 = 100 %." },
      { step: "princip", text: "Skriv två av talen i samma form, till exempel hundradelar. Vilket ligger närmast noll?" },
      {
        step: "modellering",
        text: "Ett exempel med andra tal: 3/10 = 30/100, 0,25 = 25/100 och 28 % = 28/100. Ordningen blir 0,25 < 28 % < 3/10 – fler siffror betyder inte större.",
      },
      { step: "atergang", text: "Nu provar du själv: skriv vartannat kort som hundradelar och ordna sedan." },
    ];
    const common = {
      core: kärna({ typ, kort }),
      values: { kort: values },
      help,
      misconceptions: ["fler-siffror-ar-storre", "storre-namnare-ar-storre", "procent-och-decimal-for-sig"],
      feedback: {
        correct: `Ja! ${ordning}. I hundradelar: ${hundra}.`,
        wrong: `Skriv korten som hundradelar: ${hundra}. Ordningen är ${ordning}.`,
      },
      review: `${ordning} (${hundra}).`,
    };
    if (typ === "ordna") {
      return {
        ...common,
        prompt: "Sortera korten från minst till störst.",
        view: sorteringVy,
        answer: { type: "order" },
        key: {
          type: "order", values,
          display: ordning,
          examples: { right: [{ ids: stigande }], wrong: [{ ids: fel1 }, { ids: fel2 }] },
        },
      };
    }
    // Tallinjen: punkterna A–D på korten värden, korten läggs vid sin punkt.
    const punkter = kort.map((k) => ({ id: k.punkt, value: nd(V(k.p)), label: k.punkt })).sort((a, b) => a.id.localeCompare(b.id));
    const bins = BOKSTAV.map((b) => ({ id: b, label: `Punkt ${b}` }));
    const binsNyckel = Object.fromEntries(cards.map((c, i) => [c.id, kort[i].punkt]));
    const ratt = Object.fromEntries(BOKSTAV.map((b) => [b, cards.filter((_, i) => kort[i].punkt === b).map((c) => c.id)]));
    const fel = Object.fromEntries(BOKSTAV.map((b, j) => [b, ratt[BOKSTAV[(j + 1) % 4]]]));
    const placering = stigande.map((id) => `${texter[id]} vid ${binsNyckel[id]}`).join(", ");
    return {
      ...common,
      prompt: "Sortera korten från minst till störst. Lägg sedan varje kort vid sin punkt på tallinjen.",
      view: {
        component: "sammansatt",
        delar: [
          { view: sorteringVy, svar: "ordning", rubrik: "1. Ordna korten" },
          { view: { component: "tallinje", min: 0, max: 1, ticks: 20, labels: "hela", points: punkter, label: "Från 0 till 1 är en hel" } },
          { view: { component: "sortering", cards, bins }, svar: "placering", rubrik: "2. Lägg korten vid punkterna", label: "Lägg korten vid punkterna" },
        ],
      },
      answer: { type: "multi", parts: { ordning: { type: "order" }, placering: { type: "categories", bins: BOKSTAV } } },
      key: {
        type: "multi",
        parts: { ordning: { type: "order", values }, placering: { type: "categories", bins: binsNyckel } },
        display: `${ordning}; ${placering}`,
        examples: {
          right: [{ parts: { ordning: { ids: stigande }, placering: { bins: ratt } } }],
          wrong: [{ parts: { ordning: { ids: fel1 }, placering: { bins: ratt } } }, { parts: { ordning: { ids: stigande }, placering: { bins: fel } } }],
        },
      },
      feedback: {
        correct: `${common.feedback.correct} På tallinjen: ${placering}.`,
        wrong: `${common.feedback.wrong} På tallinjen: ${placering}.`,
      },
    };
  },

  reserve: [
    [["pct", 20], ["brak", 25], ["dec", 40], ["pct", 75]],
    [["dec", 35], ["brak", 30], ["pct", 32], ["dec", 9]],
    [["brak", 50], ["dec", 45], ["pct", 5], ["pct", 55]],
    [["dec", 6], ["brak", 10], ["pct", 60], ["dec", 66]],
    [["pct", 80], ["brak", 75], ["dec", 78], ["brak", 20]],
    [["brak", 40], ["dec", 4], ["pct", 44], ["dec", 14]],
    [["dec", 99], ["brak", 90], ["pct", 9], ["dec", 19]],
    [["pct", 12], ["brak", 25], ["dec", 21], ["pct", 2]],
  ].map((l) => ({ slot: "ordna", params: { typ: "ordna", kort: l.map(([form, p]) => ({ form, p })) } }))
    .concat([
      { slot: "tallinje", params: { typ: "tallinje", kort: [["pct", 20, "C"], ["brak", 25, "A"], ["dec", 40, "D"], ["pct", 75, "B"]].map(([form, p, punkt]) => ({ form, p, punkt })) } },
      { slot: "tallinje", params: { typ: "tallinje", kort: [["dec", 65, "B"], ["brak", 50, "D"], ["pct", 15, "A"], ["dec", 90, "C"]].map(([form, p, punkt]) => ({ form, p, punkt })) } },
      { slot: "tallinje", params: { typ: "tallinje", kort: [["brak", 80, "A"], ["dec", 35, "C"], ["pct", 60, "D"], ["brak", 10, "B"]].map(([form, p, punkt]) => ({ form, p, punkt })) } },
    ]),
});


