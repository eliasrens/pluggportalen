// ============================================================================
// 08. Vilket kort är fel? (src/brakresan/utmaningar/u08.js) · #710 E
// ----------------------------------------------------------------------------
// Spec §8 08: granska representationer. Fyra kort – tre visar samma enkla
// bråk p/q, ett visar ett annat värde. Välj det avvikande kortet.
//   • q = 2–8; korten är fyra OLIKA representationer bland symbol, text,
//     cirkel, stav och mängd (typen avslöjar alltså inget)
//   • bilderna är mycket konkreta: samma indelning som bråket, eller i en
//     mängd/stav dubbelt så många delar (två av fyra kulor = en halv)
//   • det avvikande kortet bygger på en missuppfattning: samma antal
//     markerade men fler delar (stav med en av fyra delar för 1/2), omarkerade,
//     ett mer/mindre … – och har garanterat ett annat värde
// Efter svar: varför tre hör ihop och vilket värde det fjärde har.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, eq } from "../math/index.js";
import { modell, brakForm, kortId, ord, stor } from "./delat-e.js";

const BAS = [2, 3, 4, 5, 6, 8].flatMap((d) => Array.from({ length: d - 1 }, (_, i) => [i + 1, d])).filter(([n, d]) => q(n, d).d === d);
const TYPER = ["symbol", "text", "cirkel", "stav", "mangd"];

/** Kortets framsida för värdet n/d, ev. med f gånger fler delar (konkret likvärdighet). */
function face(sort, n, d, f = 1) {
  if (sort === "symbol") return brakForm(n, d);
  if (sort === "text") return { text: ord(n, d) };
  if (sort === "mangd") return { component: "mangd", count: d * f, marked: n * f, item: "kula", label: " " };
  return modell(sort, d * f, n * f, { label: " " });
}

const beskriv = (c) => (c.sort === "symbol" ? `${c.n}/${c.d}` : c.sort === "text" ? `"${ord(c.n, c.d)}"`
  : `${c.sort === "mangd" ? `${c.n * c.f} av ${c.d * c.f} kulor` : `${c.sort === "cirkel" ? "cirkeln" : "staven"} med ${c.n * c.f} av ${c.d * c.f} delar`}`);

function avvikare(p, d) {
  return [
    { n: p, d: d * 2, tag: "samma-antal-fler-delar" }, { n: p, d: d + 1, tag: "samma-antal-fler-delar" },
    { n: d - p, d, tag: "raknar-omarkerade" }, { n: p + 1, d, tag: "fel-antal-markerade" },
    { n: p - 1, d, tag: "fel-antal-markerade" }, { n: p, d: d - 1, tag: "samma-antal-farre-delar" },
  ].filter((c) => c.n >= 1 && c.n < c.d && c.d <= 10 && !eq(q(c.n, c.d), q(p, d)));
}

export default defineChallenge({
  id: "08",
  version: 1,

  generate(rng, { slot }) {
    const [p, d] = rng.pick(slot === "intro" ? BAS.filter(([, x]) => x <= 4) : BAS);
    const typer = rng.sample(TYPER, 4);
    const udda = rng.int(0, 3);
    const fel = rng.pick(avvikare(p, d));
    const kort = typer.map((sort, i) => {
      // Konkret likvärdighet: en bild/mängd med dubbelt så många delar (bara i normal/överföring).
      const f = sort !== "symbol" && sort !== "text" && slot !== "intro" && d <= 6 && rng.chance(0.4) ? 2 : 1;
      if (i === udda) return { sort, n: fel.n, d: fel.d, f: sort === "symbol" || sort === "text" || fel.d * f > 12 ? 1 : f, udda: true, tag: fel.tag };
      return { sort, n: p, d, f };
    });
    return { p, d, kort };
  },

  core: ({ p, d, kort }) => `${p}/${d}-${kort.map((c) => `${c.sort}${c.f > 1 ? "×2" : ""}${c.udda ? "!" : ""}`).sort().join("+")}`,

  build({ p, d, kort }) {
    const cards = kort.map((c, i) => ({ id: kortId(i), face: face(c.sort, c.n, c.d, c.f) }));
    const ui = kort.findIndex((c) => c.udda);
    const ratt = cards[ui].id;
    const u = kort[ui];
    const tre = kort.filter((c) => !c.udda).map(beskriv);
    const ex = eq(q(p, d), q(2, 3)) || eq(q(u.n, u.d), q(2, 3)) ? [3, 4] : [2, 3];
    return {
      core: `${p}/${d}-${kort.map((c) => `${c.sort}${c.f > 1 ? "×2" : ""}${c.udda ? "!" : ""}`).sort().join("+")}`,
      prompt: "Tre kort visar lika mycket. Vilket kort är fel?",
      values: { target: { n: p, d }, udda: { n: u.n, d: u.d } },
      view: { component: "kort", cards, stora: true },
      answer: { type: "choice", options: cards.map((c) => c.id) },
      key: {
        type: "choice", correct: ratt, display: `Kort ${ui + 1}: ${beskriv(u)}`,
        examples: { right: [{ id: ratt }], wrong: cards.filter((c) => c.id !== ratt).map((c) => ({ id: c.id })) },
      },
      help: [
        { step: "orientering", text: "Titta på helheten på varje kort: hela cirkeln, hela staven eller alla kulorna.", highlight: { whole: true } },
        { step: "princip", text: "Jämför hur mycket av varje helhet som visas. Räkna alla delarna och de markerade delarna." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: en stav med ${ex[0]} av ${ex[1]} delar och en stav med ${2 * ex[0]} av ${2 * ex[1]} delar visar lika mycket – lägg dem på varandra så ser du det. En stav med ${ex[0]} av ${ex[1] + 2} delar visar mindre.`,
          view: { component: "stav", bars: [{ parts: ex[1], marked: ex[0] }, { parts: 2 * ex[1], marked: 2 * ex[0] }, { parts: ex[1] + 2, marked: ex[0] }] },
        },
        { step: "atergang", text: "Nu provar du själv: vilket bråk visar de flesta korten? Leta efter kortet som inte passar." },
      ],
      misconceptions: [u.tag],
      feedback: {
        correct: `Ja! ${stor(tre.join(", "))} är alla ${ord(p, d)}. Kort ${ui + 1} visar ${u.n}/${u.d}.`,
        wrong: `${stor(tre.join(", "))} visar alla ${ord(p, d)}. Kort ${ui + 1} visar ${ord(u.n, u.d)} – det är fel kort.`,
      },
      review: `Tre kort visar ${p}/${d}: ${tre.join(", ")}. Kort ${ui + 1} (${beskriv(u)}) visar ${u.n}/${u.d}, ett annat värde.`,
    };
  },

  reserve: [
    [1, 2, ["symbol", "text", "mangd", "stav"], 3, { n: 1, d: 4, tag: "samma-antal-fler-delar" }, [1, 1, 2, 2]],
    [1, 3, ["cirkel", "symbol", "text", "stav"], 0, { n: 2, d: 3, tag: "raknar-omarkerade" }, [1, 1, 1, 1]],
    [3, 4, ["stav", "mangd", "symbol", "text"], 2, { n: 3, d: 5, tag: "samma-antal-fler-delar" }, [1, 1, 1, 1]],
    [2, 5, ["text", "cirkel", "mangd", "symbol"], 1, { n: 3, d: 5, tag: "fel-antal-markerade" }, [1, 1, 1, 1]],
    [5, 6, ["mangd", "stav", "cirkel", "text"], 3, { n: 1, d: 6, tag: "raknar-omarkerade" }, [2, 1, 1, 1]],
    [3, 8, ["symbol", "stav", "text", "cirkel"], 1, { n: 3, d: 9, tag: "samma-antal-fler-delar" }, [1, 1, 1, 1]],
    [2, 3, ["stav", "text", "symbol", "mangd"], 0, { n: 2, d: 4, tag: "samma-antal-fler-delar" }, [2, 1, 1, 2]],
    [1, 4, ["cirkel", "mangd", "text", "symbol"], 2, { n: 1, d: 5, tag: "samma-antal-fler-delar" }, [1, 2, 1, 1]],
    [4, 5, ["text", "symbol", "stav", "cirkel"], 3, { n: 3, d: 5, tag: "fel-antal-markerade" }, [1, 1, 2, 1]],
    [1, 6, ["mangd", "cirkel", "symbol", "stav"], 1, { n: 2, d: 6, tag: "fel-antal-markerade" }, [2, 1, 1, 1]],
  ].map(([p, d, typer, udda, fel, fs]) => ({
    slot: d <= 4 ? "intro" : "normal",
    params: { p, d, kort: typer.map((sort, i) => (i === udda ? { sort, n: fel.n, d: fel.d, f: 1, udda: true, tag: fel.tag } : { sort, n: p, d, f: d <= 4 && i !== udda ? 1 : fs[i] })) },
  })),
});
