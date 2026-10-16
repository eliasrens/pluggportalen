// ============================================================================
// 09. Vilket är störst? (src/brakresan/utmaningar/u09.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 09: jämföra bråk genom storlek, inte enbart siffror. Två bildmodeller
// A och B (två lika långa stavar från samma startpunkt, eller två lika stora
// cirklar) – välj <, = eller > (knapparna har också texten "är större än").
//   • "samma": samma nämnare (3/4 > 1/4), "halv": jämförelse mot en halv,
//     "lika": samma värde med olika indelning (1/2 = 2/4) – minst två per omgång
//   • exakt rationell jämförelse (compare.relation)
// Bilderna visar inga bråketiketter före kontroll – storleken ska jämföras.
// Hjälp: lägg stavarna ovanför varandra och följ den markerade längden (ett
// exempel med andra tal) – ingen automatisk rangordning.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, relation, RELATION_WORDS } from "../math/index.js";
import { modell, ord, stor } from "./delat-e.js";

const SLOTS = ["samma", "samma", "samma", "halv", "lika", "samma", "halv", "lika", "halv", "samma"];

/** Alla likvärdiga par a/n = (ka)/(kn) med olika indelning, nämnare ≤ 12. */
const LIKA = [];
for (let n = 2; n <= 6; n++) for (let a = 1; a < n; a++) {
  if (q(a, n).d !== n) continue;
  for (let k = 2; k * n <= 12; k++) LIKA.push([a, n, a * k, n * k]);
}

export default defineChallenge({
  id: "09",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const form = index < 3 ? "stav" : rng.pick(["stav", "stav", "cirkel"]);
    let x;
    let y;
    if (slot === "samma") {
      const n = index < 3 ? rng.int(2, 6) : rng.int(3, 10);
      const [a, b] = rng.sample(Array.from({ length: n }, (_, i) => i + 1), 2);
      x = [a, n];
      y = [b, n];
    } else if (slot === "halv") {
      const n = rng.int(3, 10);
      let a = rng.int(1, n - 1);
      if (2 * a === n) a = a + (rng.chance(0.5) ? 1 : -1);
      x = [a, n];
      y = [1, 2];
    } else {
      const [a, n, b, m] = rng.pick(LIKA);
      x = [a, n];
      y = [b, m];
    }
    const [A, B] = rng.chance(0.5) ? [x, y] : [y, x];
    return { slot, form, A, B };
  },

  core: ({ slot, form, A, B }) => `${slot}-${form}-${[`${A[0]}/${A[1]}`, `${B[0]}/${B[1]}`].sort().join("|")}`,

  build({ slot, form, A, B }) {
    const rel = relation(q(A[0], A[1]), q(B[0], B[1]));
    const bild = form === "stav"
      ? { component: "stav", bars: [{ parts: A[1], marked: A[0], label: "A" }, { parts: B[1], marked: B[0], label: "B" }], label: "Varje stav = 1 hel" }
      : null;
    const delar = form === "stav"
      ? [{ view: bild }]
      : [{ view: modell("cirkel", A[1], A[0], { label: "Hela cirkeln = 1" }), rubrik: "A" }, { view: modell("cirkel", B[1], B[0], { label: "Hela cirkeln = 1" }), rubrik: "B" }];
    const ex = slot === "lika" ? [[2, 5], [4, 10]] : [[2, 5], [4, 5]];
    const exRel = slot === "lika" ? "=" : "<";
    const wa = ord(A[0], A[1]);
    const wb = ord(B[0], B[1]);
    const fel = ["<", "=", ">"].filter((r) => r !== rel);
    return {
      core: `${slot}-${form}-${[`${A[0]}/${A[1]}`, `${B[0]}/${B[1]}`].sort().join("|")}`,
      prompt: "Jämför de markerade delarna. Är A mindre än, lika med eller större än B?",
      values: { A: { n: A[0], d: A[1] }, B: { n: B[0], d: B[1] }, relation: rel },
      view: {
        component: "sammansatt",
        delar: [
          { view: { component: "sammansatt", rad: form === "cirkel", delar }, label: "A och B" },
          { view: { component: "relationsval", vanster: { text: "A" }, hoger: { text: "B" } }, svar: true },
        ],
      },
      answer: { type: "relation" },
      key: {
        type: "relation", correct: rel, display: `A ${rel} B`,
        examples: { right: [{ value: rel }], wrong: fel.map((value) => ({ value })) },
      },
      help: [
        { step: "orientering", text: form === "stav" ? "Båda stavarna är lika långa – de är lika stora helheter och börjar på samma ställe." : "Båda cirklarna är lika stora – de är lika stora helheter.", highlight: { whole: true, del: 0 } },
        { step: "princip", text: "Jämför hur mycket som är markerat – inte hur många delar det finns. Följ den markerade längden." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex[0][0]}/${ex[0][1]} och ${ex[1][0]}/${ex[1][1]}. Lägg stavarna ovanför varandra: ${exRel === "=" ? "de markerade delarna slutar på samma ställe, så de är lika stora." : "den övre markeringen slutar tidigare, så den är mindre."}`,
          view: { component: "stav", bars: ex.map(([a, n]) => ({ parts: n, marked: a })) },
        },
        { step: "atergang", text: "Nu provar du själv: var slutar den markerade delen i A, och var slutar den i B?" },
      ],
      misconceptions: slot === "lika" ? ["fler-delar-ar-mer"] : slot === "halv" ? ["jamfor-mot-halv"] : ["storre-taljare"],
      feedback: {
        correct: `Ja! A är ${A[0]}/${A[1]} och B är ${B[0]}/${B[1]}: ${wa} ${RELATION_WORDS[rel]} ${wb}.`,
        wrong: `A är ${wa} och B är ${wb}. ${rel === "=" ? "De markerade delarna är lika långa, fast indelningen är olika." : `Den markerade delen i ${rel === ">" ? "A" : "B"} är längre.`} Alltså A ${rel} B.`,
      },
      review: `A = ${A[0]}/${A[1]}, B = ${B[0]}/${B[1]}. ${stor(wa)} ${RELATION_WORDS[rel]} ${wb}: A ${rel} B.`,
    };
  },

  reserve: [
    ["samma", "stav", [3, 4], [1, 4]], ["samma", "stav", [2, 5], [4, 5]], ["samma", "stav", [1, 3], [2, 3]],
    ["samma", "cirkel", [5, 8], [3, 8]], ["halv", "stav", [3, 8], [1, 2]], ["halv", "cirkel", [1, 2], [2, 3]],
    ["halv", "stav", [7, 10], [1, 2]], ["lika", "stav", [1, 2], [2, 4]], ["lika", "cirkel", [4, 6], [2, 3]],
    ["lika", "stav", [3, 4], [6, 8]], ["lika", "stav", [2, 10], [1, 5]],
  ].map(([slot, form, A, B]) => ({ slot, params: { slot, form, A, B } })),
});
