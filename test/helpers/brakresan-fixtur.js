// ============================================================================
// Bråkresan (#706): en TESTFIXTUR som följer generatorkontraktet – en förenklad
// "måla bråket" – så att kontraktet, omgångsplanen och granskningen kan testas
// innan D/E/F/G byggt riktiga utmaningar. Inte registrerad i utmaningar/.
// ============================================================================

import { defineChallenge } from "../../src/brakresan/schema/kontrakt.js";
import { fractionWords } from "../../src/brakresan/math/words.js";

const parts = (n) => Array.from({ length: n }, (_, i) => `p${i}`);

export function fixtureDef(overrides = {}) {
  return {
    id: "03",
    version: 1,
    generate(rng, { slot }) {
      const n = slot === "intro" ? rng.int(2, 5) : rng.int(2, 10);
      return { a: rng.int(1, n), n, shape: rng.pick(["cirkel", "rektangel"]) };
    },
    core: ({ a, n, shape }) => `${shape}-${a}/${n}`,
    build({ a, n, shape }) {
      const ids = parts(n);
      return {
        core: `${shape}-${a}/${n}`,
        prompt: `Måla ${a}/${n} av ${shape === "cirkel" ? "cirkeln" : "rektangeln"}.`,
        values: { target: { n: a, d: n } },
        view: { component: shape === "cirkel" ? "cirkel" : "rutnat", parts: n, label: false },
        answer: { type: "paint", parts: ids },
        key: {
          type: "paint",
          count: a,
          display: `${a} av ${n} delar`,
          examples: {
            right: [{ selected: ids.slice(0, a) }, { selected: ids.slice(n - a) }],
            wrong: [{ selected: ids.slice(0, a === n ? a - 1 : a + 1) }],
          },
        },
        help: [
          { step: "orientering", text: "Hela figuren är en hel. Räkna alla lika stora delar." },
          { step: "princip", text: "Nämnaren säger hur många lika delar helheten är delad i." },
        ],
        misconceptions: ["raknar-omarkerade"],
        feedback: {
          correct: `Ja! ${a} av ${n} lika stora delar är ${fractionWords(a, n)}.`,
          wrong: `Inte riktigt ännu. ${fractionWords(a, n)} betyder ${a} av ${n} lika stora delar.`,
        },
        review: `${a}/${n}: markera ${a} av de ${n} delarna.`,
      };
    },
    reserve: Array.from({ length: 12 }, (_, i) => ({ params: { a: 1 + (i % 3), n: 4 + (i % 7), shape: "rektangel" } })),
    ...overrides,
  };
}

export const fixture = (overrides) => defineChallenge(fixtureDef(overrides));
