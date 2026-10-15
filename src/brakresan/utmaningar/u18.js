// ============================================================================
// 18. Vilken punkt är rätt? (src/brakresan/utmaningar/u18.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 18: läsa bråk som tal och avstånd från noll. Tallinjen 0–1 med fyra
// märkta punkter A–D (från vänster); välj den som visar a/n.
//   • n = 2–10, graderingen är n eller en enkel multipel av n (högst 12 delar);
//     minst en uppgift med 0 och en med 1 per omgång (slots "noll", "ett")
//   • facit = punktens EXAKTA koordinatvärde (bedöms som val av punktens id,
//     id:t pekar på ett exakt värde) – aldrig pixelnärhet
//   • felpunkterna: räknar streck i stället för mellanrum (ett steg fel),
//     täljaren som antal streck på en finare gradering, räknar från fel ände
//   • bara 0 och 1 har etiketter – ingen extramarkering avslöjar facit
// Hjälp: räkna mellanrum snarare än streck, ett exempel med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { ord, stor } from "./delat-e.js";

const SLOTS = ["intro", "intro", "intro", "normal", "noll", "normal", "finare", "ett", "finare", "normal"];
const BOKSTAV = ["A", "B", "C", "D"];

/** Graderingar för n: n själv (om minst 3 mellanrum) och multiplar upp till 12. */
const graderingar = (n) => [n, 2 * n, 3 * n, 4 * n, 6 * n].filter((t) => t <= 12 && t >= 3);

export default defineChallenge({
  id: "18",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    let n;
    let a;
    let ticks;
    if (slot === "noll" || slot === "ett") {
      n = rng.int(2, 10);
      a = slot === "noll" ? 0 : n;
      ticks = rng.pick(graderingar(n).length ? graderingar(n) : [n]);
    } else if (slot === "finare") {
      n = rng.pick([2, 3, 4, 5, 6]);
      a = rng.int(1, n - 1);
      ticks = rng.pick(graderingar(n).filter((t) => t > n));
    } else {
      n = slot === "intro" ? rng.int(3, 6) : rng.int(3, 10);
      a = rng.int(1, n - 1);
      ticks = n;
    }
    const t = (a * ticks) / n;
    // Felpunkter (streck från 0): missuppfattningar först, sedan grannar.
    const kand = [t - 1, t + 1, ...(ticks !== n ? [a] : []), ticks - t, t + 2, t - 2, ...Array.from({ length: ticks + 1 }, (_, i) => i)];
    const fel = [];
    for (const k of rng.shuffle(kand.slice(0, 4)).concat(kand.slice(4))) {
      if (k >= 0 && k <= ticks && k !== t && !fel.includes(k)) fel.push(k);
      if (fel.length === 3) break;
    }
    return { n, a, ticks, streck: [t, ...fel].sort((x, y) => x - y) };
  },

  core: ({ a, n, ticks }) => `${a}/${n}@${ticks}`,

  build({ n, a, ticks, streck }) {
    const t = (a * ticks) / n;
    const points = streck.map((k, i) => ({ id: BOKSTAV[i], value: { n: k, d: ticks }, label: BOKSTAV[i] }));
    const ri = streck.indexOf(t);
    const ratt = BOKSTAV[ri];
    const ex = n === 3 ? { b: 3, m: 5 } : { b: 2, m: 3 };
    const steg = `${ord(1, n).split(" ")[1]}ssteg`;
    const avstand = a === 0 ? "Noll ligger vid startpunkten" : a === n ? `${a}/${n} är en hel – hela vägen till 1` : `${stor(ord(a, n))} ligger ${a === 1 ? "ett" : ord(a, n).split(" ")[0]} ${steg} från 0`;
    return {
      core: `${a}/${n}@${ticks}`,
      prompt: `Vilken punkt visar ${a}/${n}?`,
      values: { target: { n: a, d: n }, ticks, points: Object.fromEntries(points.map((p) => [p.id, p.value])) },
      view: { component: "tallinje", min: 0, max: 1, ticks, labels: "hela", points, label: "Från 0 till 1 är en hel" },
      answer: { type: "choice", options: [...BOKSTAV] },
      key: {
        type: "choice", correct: ratt, display: `Punkt ${ratt}`,
        examples: { right: [{ id: ratt }], wrong: BOKSTAV.filter((b) => b !== ratt).map((id) => ({ id })) },
      },
      help: [
        { step: "orientering", text: "Sträckan från 0 till 1 är en hel. Bråket säger hur långt från 0 punkten ligger.", highlight: { whole: true } },
        { step: "princip", text: `Räkna mellanrummen från 0 – inte strecken. Linjen har ${ticks} lika långa mellanrum.`, highlight: { count: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.b}/${ex.m} ligger ${ex.b} mellanrum från 0 när linjen är delad i ${ex.m}.` +
            (ticks > n ? " Har linjen fler streck än nämnaren? Räkna hur många små mellanrum en del är." : ""),
          view: { component: "tallinje", min: 0, max: 1, ticks: ex.m, labels: "alla", points: [{ id: "ex", value: { n: ex.b, d: ex.m }, label: "★" }] },
        },
        { step: "atergang", text: "Nu provar du själv: börja på 0 och räkna mellanrummen till varje punkt." },
      ],
      misconceptions: ["raknar-streck", ...(ticks !== n ? ["taljare-pa-finare-gradering"] : []), "fel-ande"],
      feedback: {
        correct: `Ja! Punkt ${ratt}. ${avstand}.`,
        wrong: `${a}/${n} är punkt ${ratt}. ${avstand}${ticks !== n ? ` – på den här linjen ${t} av ${ticks} mellanrum` : ""}.`,
      },
      review: `${a}/${n} = ${t}/${ticks}: punkt ${ratt}, ${t} av ${ticks} lika mellanrum från 0. Bråket anger en position, inte antalet streck.`,
    };
  },

  reserve: [
    [3, 4, 4, "intro"], [1, 3, 3, "intro"], [2, 5, 5, "intro"], [5, 8, 8, "normal"], [7, 10, 10, "normal"],
    [0, 4, 4, "noll"], [0, 3, 6, "noll"], [5, 5, 5, "ett"], [2, 2, 8, "ett"], [1, 2, 8, "finare"], [2, 3, 6, "finare"], [3, 4, 12, "finare"],
  ].map(([a, n, ticks, slot]) => {
    const t = (a * ticks) / n;
    const fel = [t - 1, t + 1, ticks - t, t + 2, t - 2, 0, 1, 2, 3].filter((k, i, l) => k >= 0 && k <= ticks && k !== t && l.indexOf(k) === i).slice(0, 3);
    return { slot, params: { n, a, ticks, streck: [t, ...fel].sort((x, y) => x - y) } };
  }),
});
