// ============================================================================
// 02. Vilket bråk visar bilden? (src/brakresan/utmaningar/u02.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 02: koppla markerade delar till täljaren och alla lika delar till
// nämnaren. En bild (cirkel, stav eller rutnät) + fyra bråkkort, välj ett.
//   • a/n med 1 ≤ a ≤ n, n ∈ {2, 3, 4, 5, 6, 8, 10}
//   • två uppgifter per omgång visar en hel (a = n) – slots "hel"
//   • överföringen: rutnät med spridda markerade rutor
//   • felalternativen: ombytta tal (n/a) och antalet omarkerade delar
//     ((n − a)/n) när de verkligen ger andra värden, sedan del mot del,
//     fel antal delar och fel antal markerade – fyra OLIKA värden
// Hjälp: alla delarna, sedan de markerade, ett annat exempel med täljare/nämnare.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { modell, brakForm, skildaVarden, annatBrak, kortId, ord, stor, HELHET } from "./delat-e.js";

const NAMNARE = [2, 3, 4, 5, 6, 8, 10];
const SLOTS = ["intro", "intro", "intro", "normal", "hel", "normal", "normal", "overforing", "hel", "overforing"];

/** Felalternativen i prioritetsordning (spec: ombytt och omarkerade först). */
function kandidater(a, n) {
  const ut = [];
  if (a !== n) ut.push({ n, d: a, tag: "taljare-namnare-ombytt" });
  if (n - a >= 1) ut.push({ n: n - a, d: n, tag: "raknar-omarkerade" });
  if (n - a >= 1) ut.push({ n: a, d: n - a, tag: "del-mot-del" });
  ut.push({ n: a, d: n + 1, tag: "fel-antal-delar" });
  if (a > 1) ut.push({ n: a - 1, d: n, tag: "fel-antal-markerade" });
  if (a < n) ut.push({ n: a + 1, d: n, tag: "fel-antal-markerade" });
  if (a === n) ut.push({ n: 1, d: n, tag: "en-del" }, { n: n - 1, d: n, tag: "fel-antal-markerade" });
  return ut;
}

export default defineChallenge({
  id: "02",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    let shape;
    let n;
    let a;
    let spridd = null;
    if (slot === "intro") {
      shape = rng.pick(["cirkel", "stav"]);
      n = rng.pick([2, 3, 4, 5]);
      a = rng.int(1, n - 1);
    } else if (slot === "hel") {
      shape = rng.pick(["cirkel", "stav", "rutnat"]);
      n = rng.pick(NAMNARE);
      a = n;
    } else if (slot === "overforing") {
      shape = "rutnat";
      n = rng.pick([4, 6, 8, 10]);
      a = rng.int(1, n - 1);
      spridd = rng.sample(Array.from({ length: n }, (_, i) => i), a).sort((x, y) => x - y);
    } else {
      shape = rng.pick(["cirkel", "stav", "rutnat"]);
      n = rng.pick(NAMNARE);
      a = rng.int(1, n - 1);
    }
    const alla = kandidater(a, n);
    // Ombytt och omarkerade först (när de finns), sedan slumpvis bland resten.
    const forst = alla.filter((c) => c.tag === "taljare-namnare-ombytt" || c.tag === "raknar-omarkerade");
    const fel = skildaVarden(q(a, n), [...forst, ...rng.shuffle(alla.filter((c) => !forst.includes(c)))], 3);
    const kort = rng.shuffle([{ n: a, d: n, ratt: true }, ...fel]).map((c) => (c.ratt ? { n: c.n, d: c.d, ratt: true } : { n: c.n, d: c.d, tag: c.tag }));
    return { shape, n, a, ...(spridd ? { spridd } : {}), kort };
  },

  core: ({ shape, n, a, spridd }) => `${shape}-${a}/${n}${spridd ? "-spridd" : ""}`,

  build({ shape, n, a, spridd, kort }) {
    const cards = kort.map((c, i) => ({ id: kortId(i), face: brakForm(c.n, c.d) }));
    const ratt = cards[kort.findIndex((c) => c.ratt)].id;
    const fel = cards.filter((_, i) => !kort[i].ratt).map((c) => c.id);
    const bild = modell(shape, n, spridd || a);
    const namn = HELHET[shape].namn;
    const ex = annatBrak(a, n, { hel: a === n });
    const exShape = shape === "rutnat" ? "stav" : shape;
    const helText = a === n ? ` Alla ${n} delar är markerade – det är en hel.` : "";
    return {
      core: `${shape}-${a}/${n}${spridd ? "-spridd" : ""}`,
      prompt: "Vilket bråk visar den markerade delen?",
      values: { target: { n: a, d: n }, parts: n, marked: a },
      view: {
        component: "sammansatt",
        delar: [
          { view: bild },
          { view: { component: "kort", cards }, svar: true, label: "Välj ett bråk" },
        ],
      },
      answer: { type: "choice", options: cards.map((c) => c.id) },
      key: {
        type: "choice",
        correct: ratt,
        display: `${a}/${n}`,
        examples: { right: [{ id: ratt }], wrong: fel.map((id) => ({ id })) },
      },
      help: [
        { step: "orientering", text: `Hela ${namn} är en hel. Räkna ALLA delarna – både de markerade och de vita.`, highlight: { whole: true, count: true, del: 0 } },
        { step: "princip", text: "Nämnaren, talet under strecket, är hur många lika stora delar helheten har. Täljaren, talet över strecket, är hur många av dem som är markerade.", highlight: { marked: true, del: 0 } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: här är ${ex.b} av ${ex.m} lika stora delar markerade. Det skrivs ${ex.b}/${ex.m}.`,
          view: modell(exShape, ex.m, ex.b),
        },
        { step: "atergang", text: "Nu provar du själv: räkna alla delarna i din bild, sedan de markerade, och välj kortet." },
      ],
      misconceptions: [...new Set(kort.filter((c) => c.tag).map((c) => c.tag))],
      feedback: {
        correct: `Ja! ${a} av ${n} lika stora delar är markerade: ${ord(a, n)}.${helText}`,
        wrong: `${stor(namn)} har ${n} lika stora delar – det är nämnaren. ${a} av dem är markerade – det är täljaren: ${a}/${n}.`,
      },
      review: `${a}/${n}: ${namn} är delad i ${n} lika stora delar (nämnaren), och ${a} är markerade (täljaren).${helText}`,
    };
  },

  reserve: [
    ["intro", "cirkel", 4, 3], ["intro", "stav", 5, 2], ["intro", "cirkel", 3, 1],
    ["normal", "rutnat", 8, 3], ["normal", "stav", 10, 7], ["normal", "cirkel", 6, 5],
    ["hel", "cirkel", 4, 4], ["hel", "stav", 6, 6], ["hel", "rutnat", 8, 8],
    ["overforing", "rutnat", 6, 4], ["overforing", "rutnat", 10, 3], ["overforing", "rutnat", 4, 1],
  ].map(([slot, shape, n, a]) => ({ slot, params: reservParams(slot, shape, n, a) })),
});

function reservParams(slot, shape, n, a) {
  const fel = skildaVarden(q(a, n), kandidater(a, n), 3);
  const kort = [fel[0], { n: a, d: n, ratt: true }, fel[1], fel[2]].map((c) => (c.ratt ? c : { n: c.n, d: c.d, tag: c.tag }));
  return { shape, n, a, ...(slot === "overforing" ? { spridd: Array.from({ length: n }, (_, i) => i).sort((x, y) => (x % 2) - (y % 2) || x - y).slice(0, a).sort((x, y) => x - y) } : {}), kort };
}
