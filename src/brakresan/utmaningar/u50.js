// ============================================================================
// 50. Mästarkluringarna – EXTRA UTMANING (src/brakresan/utmaningar/u50.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 50: välja strategi, flera steg, rimlighet. Tio OLIKA problemfamiljer
// per omgång – en per slot, alltid i samma ordning:
//   aterstaende    återstående bråkdel (1 − a/n − b/m)
//   delavdel       del av en del i en samling (3/4 av 24 röda, hälften ges bort → 15 kvar)
//   helhet         helheten ur en given del (2/5 av klassen = 10 elever → 25)
//   jamfor         olika stora helheter (1/4 av 40 kr mot 1/2 av 16 kr) + vem
//   procentkvar    procentdel och återstående antal
//   budget         enkel rabatt + given budget: räcker pengarna? + belopp
//   langd          blandad längdberäkning (hela meter och bråkdelar)
//   matt           måttdivision (hur många glas om 3/4 liter ur 3 liter?)
//   felresonemang  upptäck ett felaktigt resonemang (ibland är det rätt) + rätt svar
//   proportion     dubblering/halvering (pris eller recept)
// Varje uppgift: ett tal- eller bråksvar plus högst ETT tydligt
// strategi-/rimlighetsval; en poäng för hela uppgiften (multi). Svår genom
// resonemang, inte långa texter eller stora tal. Alla svar är exakta värden
// ur math/ – ingen fritext, ingen AI. Varje familj har betydligt fler än sex
// validerade varianter (granskningen räknar per familj).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { F } from "./u50-familjer.js";
import { felresonemang } from "./u50-resonemang.js";

export const FAMILJER = ["aterstaende", "delavdel", "helhet", "jamfor", "procentkvar", "budget", "langd", "matt", "felresonemang", "proportion"];
const FAMILJ = { ...F, felresonemang };

// ------------------------------------------------------------------ utmaningen

const kärna = (p) => `${p.familj}:${FAMILJ[p.familj].core(p)}`;

export default defineChallenge({
  id: "50",
  version: 1,
  slots: FAMILJER,

  generate(rng, { slot }) {
    return { familj: slot, ...FAMILJ[slot].gen(rng) };
  },

  core: kärna,

  build(params) {
    const { familj, ...p } = params;
    const b = FAMILJ[familj].build(p);
    return {
      core: kärna(params),
      prompt: b.prompt,
      values: { familj, ...b.values },
      view: { component: "sammansatt", delar: b.delar },
      answer: b.answer,
      key: { ...b.key, display: b.display, examples: { right: b.right, wrong: b.wrong } },
      help: [
        { step: "orientering", text: `Vad är helheten? ${b.helhet}`, highlight: { whole: true } },
        { step: "princip", text: b.andras },
        { step: "modellering", text: "Gör en bild eller skriv stegen: vad vet du, vad förändras i varje steg, och vad frågar uppgiften efter?" },
        { step: "atergang", text: "Nu provar du själv: ett steg i taget – och kontrollera att svaret är rimligt." },
      ],
      misconceptions: [`familj-${familj}`],
      feedback: { correct: `Ja! ${b.steg}`, wrong: b.steg },
      review: b.steg,
    };
  },

  reserve: [
    { slot: "aterstaende", params: { familj: "aterstaende", a: 1, n: 4, b: 1, m: 3, vem: 0, sak: 0 } },
    { slot: "delavdel", params: { familj: "delavdel", N: 24, a: 3, n: 4, b: 1, m: 2, item: "kula" } },
    { slot: "helhet", params: { familj: "helhet", a: 2, n: 5, N: 25, sak: 0 } },
    { slot: "jamfor", params: { familj: "jamfor", a: 1, n: 4, X: 40, b: 1, m: 2, Y: 16, vem: 2 } },
    { slot: "procentkvar", params: { familj: "procentkvar", p: 25, N: 40, sak: 0 } },
    { slot: "budget", params: { familj: "budget", P: 400, p: 25, B: 320, vara: 0, vem: 2 } },
    { slot: "langd", params: { familj: "langd", op: "−", A: { W: 2, x: 1, n: 2 }, B: { W: 0, x: 3, n: 4 } } },
    { slot: "matt", params: { familj: "matt", b: 3, m: 4, c: 4, sak: 0 } },
    { slot: "felresonemang", params: { familj: "felresonemang", typ: "addnamn", n: 3, a: 1, b: 1, vem: 3 } },
    { slot: "proportion", params: { familj: "proportion", typ: "pris", st: 3, pris: 45, ny: 6 } },
    { slot: "felresonemang", params: { familj: "felresonemang", typ: "delavdel", a: 1, n: 2, b: 3, m: 4, vem: 1 } },
  ],
});

