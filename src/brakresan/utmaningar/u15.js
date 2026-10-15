// ============================================================================
// 15. Sortera bråkfamiljer (src/brakresan/utmaningar/u15.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 15: organisera likvärdiga bråk. Sex kort ska dras (eller klickas)
// till tre familjer med två kort var; alla sex sorteras före kontroll.
//   • tre olika förkortade värden; varje familj har ett ankarkort (symbol,
//     eller en bild i överföringen) och får två förlängningar med olika
//     faktorer; alla nämnare högst 24
//   • familjerna väljs gärna så att de delar siffror (1/2, 1/3, 2/3 …) – då
//     prövas likvärdighet, inte att leta likadana siffror
//   • facken skiljs genom ankare och position ("Familj A"), aldrig värdefärg;
//     ordningen inom ett fack spelar ingen roll
// Hjälp: jämförelsestavar för ett exempel med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { modell, brakForm, kortId, ord } from "./delat-e.js";

const BAS = [];
for (let d = 2; d <= 8; d++) for (let n = 1; n < d; n++) if (q(n, d).d === d) BAS.push([n, d]);
const FAMILJ = ["A", "B", "C"];

export default defineChallenge({
  id: "15",
  version: 1,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? BAS.filter(([, d]) => d <= 5) : BAS.filter(([, d]) => d <= 6 || slot === "overforing");
    // Första värdet slumpas; de andra gärna med samma täljare eller nämnare (delar siffror).
    const forsta = rng.pick(pool);
    const slakt = rng.shuffle(pool.filter(([n, d]) => (n === forsta[0] || d === forsta[1]) && !(n === forsta[0] && d === forsta[1])));
    const ovriga = rng.shuffle(pool.filter(([n, d]) => !(n === forsta[0] && d === forsta[1]) && !slakt.some(([a, b]) => a === n && b === d)));
    const varden = [forsta, ...[...slakt, ...ovriga].slice(0, 2)];
    const familjer = varden.map(([n, d]) => {
      const fs = rng.sample((slot === "intro" ? [2, 3] : [2, 3, 4, 5, 6]).filter((k) => d * k <= 24), 2).sort((x, y) => x - y);
      return { n, d, fs };
    });
    const kort = rng.shuffle(familjer.flatMap((f, i) => f.fs.map((k) => ({ n: f.n * k, d: f.d * k, fam: i }))));
    return { familjer, kort, ankare: slot === "overforing" ? "bild" : "symbol" };
  },

  core: ({ familjer }) => familjer.map((f) => `${f.n}/${f.d}×${f.fs.join(",")}`).sort().join("|"),

  build({ familjer, kort, ankare }) {
    const cards = kort.map((c, i) => ({ id: kortId(i), face: brakForm(c.n, c.d) }));
    const bins = familjer.map((f, i) => ({
      id: `f${i + 1}`, label: `Familj ${FAMILJ[i]}`,
      face: ankare === "bild" ? modell("stav", f.d, f.n, { label: " " }) : brakForm(f.n, f.d),
    }));
    const nyckel = Object.fromEntries(cards.map((c, i) => [c.id, bins[kort[i].fam].id]));
    const ratt = Object.fromEntries(bins.map((b) => [b.id, cards.filter((c) => nyckel[c.id] === b.id).map((c) => c.id)]));
    // Felexempel: två kort ur olika familjer byter fack.
    const [x, y] = [ratt.f1[0], ratt.f2[0]];
    const byt = { ...ratt, f1: [y, ratt.f1[1]], f2: [x, ratt.f2[1]] };
    const famText = familjer.map((f, i) => `${f.n}/${f.d}: ${kort.filter((c) => c.fam === i).map((c) => `${c.n}/${c.d}`).join(" och ")}`);
    return {
      core: familjer.map((f) => `${f.n}/${f.d}×${f.fs.join(",")}`).sort().join("|"),
      prompt: "Lägg varje kort i familjen där det är lika mycket som ankarkortet – två kort i varje familj.",
      values: { familjer: familjer.map((f) => ({ n: f.n, d: f.d })), cards: Object.fromEntries(cards.map((c, i) => [c.id, { n: kort[i].n, d: kort[i].d }])) },
      view: { component: "sortering", cards, bins },
      answer: { type: "categories", bins: bins.map((b) => b.id) },
      key: {
        type: "categories", bins: nyckel,
        display: famText.join("; "),
        examples: {
          right: [{ bins: ratt }, { bins: Object.fromEntries(Object.entries(ratt).map(([k, l]) => [k, [...l].reverse()])) }],
          wrong: [{ bins: byt }, { bins: { f1: ratt.f2, f2: ratt.f3, f3: ratt.f1 } }],
        },
      },
      help: [
        { step: "orientering", text: `Varje familj har ett ankarkort${ankare === "bild" ? " med en bild" : ""}. Korten i familjen ska vara lika mycket som ankaret.` },
        { step: "princip", text: "Ett bråk är lika mycket om täljare och nämnare har gångrats med samma tal. Hur många gånger fler delar? Lika många gånger fler markerade?" },
        {
          step: "modellering",
          text: "Ett exempel med andra tal: 2/7 och 4/14 är i samma familj – dela varje sjundedel i två, så blir 2 delar 4 delar av 14.",
          view: { component: "stav", bars: [{ parts: 7, marked: 2 }, { parts: 14, marked: 4 }] },
        },
        { step: "atergang", text: "Nu provar du själv: ta ett kort, dela nämnaren med ankarets nämnare – blir täljaren lika många gånger större?" },
      ],
      misconceptions: ["samma-siffror", "additiv-forlangning"],
      feedback: {
        correct: `Ja! ${famText.join("; ")}.`,
        wrong: `Familjerna är ${famText.join("; ")}. Varje kort är samma bråk som sitt ankare, fast delat i fler delar.`,
      },
      review: `${famText.join("; ")}. Till exempel ${familjer[0].n}/${familjer[0].d} = ${ord(familjer[0].n, familjer[0].d)}: samma andel med fler delar.`,
    };
  },

  reserve: [
    [[1, 2, [2, 3]], [1, 3, [2, 3]], [2, 3, [2, 4]]], [[1, 4, [2, 3]], [3, 4, [2, 5]], [1, 2, [3, 4]]],
    [[2, 5, [2, 3]], [1, 5, [3, 4]], [3, 5, [2, 4]]], [[1, 6, [2, 4]], [5, 6, [2, 3]], [1, 3, [3, 5]]],
    [[1, 2, [5, 6]], [1, 4, [3, 5]], [2, 3, [3, 6]]], [[3, 8, [2, 3]], [1, 8, [2, 3]], [3, 4, [2, 4]]],
    [[2, 7, [2, 3]], [3, 7, [2, 3]], [1, 2, [2, 4]]], [[4, 5, [2, 4]], [1, 3, [2, 6]], [3, 4, [3, 5]]],
    [[1, 3, [4, 5]], [2, 3, [5, 6]], [1, 6, [3, 4]]], [[5, 8, [2, 3]], [1, 2, [3, 6]], [1, 4, [4, 6]]],
  ].map((fam, r) => {
    const familjer = fam.map(([n, d, fs]) => ({ n, d, fs }));
    const kort = familjer.flatMap((f, i) => f.fs.map((k) => ({ n: f.n * k, d: f.d * k, fam: i })));
    const ordning = [3, 0, 5, 1, 4, 2];
    return { params: { familjer, kort: ordning.map((i) => kort[i]), ankare: r % 3 === 0 ? "bild" : "symbol" } };
  }),
});
