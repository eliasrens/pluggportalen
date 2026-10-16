// ============================================================================
// 04. Bråk med ord (src/brakresan/utmaningar/u04.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 04: läsa och förstå bråkbenämningar. Sex kort: tre målkort – symbol
// a/n, svensk text ("två tredjedelar") och bild (a av n delar markerade) –
// och tre distraktorer (en symbol, en text, en bild) med andra värden.
// Eleven väljer de tre som hör ihop.
//   • enkla a/n, n ∈ {2, 3, 4, 5, 6, 8, 10}, 1 ≤ a < n; böjningen kommer ur
//     math/words.js ("en halv", "tre fjärdedelar")
//   • målbilden har SAMMA a/n som symbolen (ingen förlängning – språkmålet)
//   • distraktorerna bygger på missuppfattningar: fel nämnarord, omarkerade
//     delar, samma antal markerade men fler delar … – tre olika värden, alla
//     skilda från målet, så ingen annan trippel finns
// Hjälp: ordet för nämnaren pekar på indelningen, ordet för täljaren på de
// markerade delarna; ett exempel med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { modell, brakForm, skildaVarden, kortId, ord, stor } from "./delat-e.js";

const NAMNARE = [2, 3, 4, 5, 6, 8, 10];
const BAS = NAMNARE.flatMap((n) => Array.from({ length: n - 1 }, (_, i) => [i + 1, n]));

/** Distraktorkandidater per korttyp (prioritetsordning). */
function kandidater(a, n) {
  const text = [
    { n: a, d: n + 1, tag: "fel-namnarord" }, { n: a, d: n * 2, tag: "fel-namnarord" },
    ...(n - 1 > a && n - 1 >= 2 ? [{ n: a, d: n - 1, tag: "fel-namnarord" }] : []),
    { n: n - a, d: n, tag: "raknar-omarkerade" }, { n: a + 1 <= n ? a + 1 : a - 1, d: n, tag: "fel-taljarord" },
  ];
  const symbol = [
    { n: n - a, d: n, tag: "raknar-omarkerade" }, { n: a, d: n + 2, tag: "fel-namnare" },
    ...(a > 1 ? [{ n: a - 1, d: n, tag: "fel-taljare" }] : []), { n: a + 1, d: n + 1, tag: "additiv" },
  ];
  const bild = [
    { n: a, d: n + 1, tag: "samma-antal-fler-delar" }, { n: n - a, d: n, tag: "raknar-omarkerade" },
    ...(a + 1 < n ? [{ n: a + 1, d: n, tag: "fel-antal-markerade" }] : []), { n: a, d: n + 2, tag: "samma-antal-fler-delar" },
  ];
  // Reserv om de vanliga redan tagits av en annan sort (t.ex. 1/2).
  const reserv = [{ n: a, d: n + 3, tag: "fel-namnare" }, { n: a + 1, d: n + 2, tag: "additiv" }, { n: 1, d: n + 1, tag: "fel-namnare" }];
  return { text: [...text, ...reserv], symbol: [...symbol, ...reserv], bild: [...bild, ...reserv] };
}

/** Tre distraktorer – en av varje sort – med olika värden. */
function valjDistraktorer(a, n, ordning) {
  const k = kandidater(a, n);
  const valda = [];
  for (const sort of ["text", "symbol", "bild"]) {
    const lista = ordning(k[sort].slice(0, -3));
    const okej = (x) => x.d <= 12 && x.n >= 1 && x.n < x.d && !valda.some((v) => v.n * x.d === x.n * v.d);
    const [c] = skildaVarden(q(a, n), [...lista, ...k[sort].slice(-3)].filter(okej), 1);
    valda.push({ ...c, sort });
  }
  return valda;
}

function kortFace(c, shape) {
  if (c.sort === "text") return { text: ord(c.n, c.d) };
  if (c.sort === "symbol") return brakForm(c.n, c.d);
  return modell(shape, c.d, c.n, { label: " " });
}

export default defineChallenge({
  id: "04",
  version: 1,

  generate(rng, { slot }) {
    const bas = slot === "intro" ? BAS.filter(([, n]) => n <= 4) : slot === "overforing" ? BAS.filter(([, n]) => n >= 5) : BAS;
    const [a, n] = rng.pick(bas);
    const shape = slot === "overforing" ? rng.pick(["stav", "rutnat"]) : rng.pick(["cirkel", "stav"]);
    const dis = valjDistraktorer(a, n, (l) => rng.shuffle(l));
    const kort = rng.shuffle([
      { sort: "symbol", n: a, d: n, ratt: true }, { sort: "text", n: a, d: n, ratt: true }, { sort: "bild", n: a, d: n, ratt: true },
      ...dis.map((c) => ({ sort: c.sort, n: c.n, d: c.d, tag: c.tag })),
    ]);
    return { a, n, shape, kort };
  },

  core: ({ a, n, shape }) => `${a}/${n}-${shape}`,

  build({ a, n, shape, kort }) {
    const cards = kort.map((c, i) => ({ id: kortId(i), face: kortFace(c, shape) }));
    const ratt = cards.filter((_, i) => kort[i].ratt).map((c) => c.id);
    const fel = cards.filter((_, i) => !kort[i].ratt).map((c) => c.id);
    const o = ord(a, n);
    const ex = a === 3 && n === 8 ? { b: 2, m: 5 } : { b: 3, m: 8 };
    const delOrd = ord(2, n).split(" ").slice(1).join(" "); // "fjärdedelar"
    return {
      core: `${a}/${n}-${shape}`,
      prompt: "Välj de tre korten som visar samma bråk: siffror, ord och bild.",
      values: { target: { n: a, d: n }, cards: Object.fromEntries(cards.map((c, i) => [c.id, { n: kort[i].n, d: kort[i].d }])) },
      view: { component: "kort", cards, stora: true },
      answer: { type: "select", count: 3, options: cards.map((c) => c.id) },
      key: {
        type: "select",
        groups: [{ ids: ratt }],
        display: `${a}/${n} – ${o} – ${a} av ${n} delar markerade`,
        examples: {
          right: [{ ids: ratt }, { ids: [...ratt].reverse() }],
          wrong: [{ ids: [ratt[0], ratt[1], fel[0]] }, { ids: [ratt[0], fel[1], ratt[2]] }, { ids: fel }],
        },
      },
      help: [
        { step: "orientering", text: "Tre kort hör ihop: ett med siffror, ett med ord och en bild. De visar exakt samma bråk." },
        { step: "princip", text: "Ordets slut säger nämnaren: fjärdedelar betyder att helheten har fyra lika delar. Ordets början säger täljaren: hur många delar vi har." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.b}/${ex.m} läses ${ord(ex.b, ex.m)}. "${stor(ord(ex.b, ex.m).split(" ").slice(1).join(" "))}" – helheten har ${ex.m} lika delar. "${stor(ord(ex.b, ex.m).split(" ")[0])}" – ${ex.b} delar är markerade.`,
          view: modell("stav", ex.m, ex.b),
        },
        { step: "atergang", text: "Nu provar du själv: läs ett ordkort och leta efter bilden med lika många delar och lika många markerade." },
      ],
      misconceptions: [...new Set(kort.filter((c) => c.tag).map((c) => c.tag))],
      feedback: {
        correct: `Ja! ${a}/${n} läses ${o}: helheten har ${n} lika delar (${delOrd}) och ${a} är markerade.`,
        wrong: `De tre som hör ihop är ${a}/${n}, "${o}" och bilden med ${a} av ${n} lika delar markerade.`,
      },
      review: `${a}/${n} = ${o}. "${stor(delOrd)}" säger att helheten har ${n} lika delar, och ${a} av dem är markerade.`,
    };
  },

  reserve: [[1, 2, "cirkel"], [2, 3, "stav"], [3, 4, "cirkel"], [1, 4, "stav"], [2, 5, "stav"], [5, 6, "cirkel"],
    [3, 8, "stav"], [7, 10, "rutnat"], [4, 5, "rutnat"], [1, 3, "cirkel"], [5, 8, "rutnat"]]
    .map(([a, n, shape]) => {
      const dis = valjDistraktorer(a, n, (l) => l);
      const r = (sort) => ({ sort, n: a, d: n, ratt: true });
      const d = dis.map((c) => ({ sort: c.sort, n: c.n, d: c.d, tag: c.tag }));
      return { slot: n <= 4 ? "intro" : "normal", params: { a, n, shape, kort: [d[0], r("bild"), d[1], r("symbol"), d[2], r("text")] } };
    }),
});
