// ============================================================================
// 22. Det saknade talet (src/brakresan/utmaningar/u22.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 22: en bråklikhet där ett heltal saknas, t.ex. 2/3 = 8/? eller
// ?/15 = 2/5. Eleven skriver talet i rutan inne i bråket.
//   • fem täljaruppgifter och fem nämnaruppgifter (SLOTS), blandat
//     förlängning (det saknade talet sitter i det större bråket) och
//     förkortning (i det mindre)
//   • genereras ur ett förkortat basbråk p/q (q = 2–10) och en heltalsfaktor
//     k = 2–6, så att exakt ett positivt heltal fullbordar likheten
//   • täljaren ≥ 1 – inga nollbråk, då kunde nämnaruppgifter bli obestämda
//   • det fullständiga bråket står ibland till vänster, ibland till höger
// Hjälp: pilar mellan motsvarande tal ("× ?" eller "÷ ?", utan faktorn) och
// en omdelningsstav med andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { basbrak, heltal, talNyckel, NUMBER_INTEGER } from "./f-delat.js";

const BASER = basbrak(2, 10);
// t/n = täljare/nämnare saknas; forl = i det större bråket, fork = i det mindre.
const SLOTS = ["t-forl", "n-forl", "t-fork", "n-fork", "t-forl", "n-forl", "t-fork", "n-fork", "t-fri", "n-fri"];

export default defineChallenge({
  id: "22",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const intro = index < 3;
    const [p, q] = rng.pick(intro ? BASER.filter(([, qq]) => qq <= 6) : BASER);
    const k = rng.int(2, intro ? 4 : 6);
    const [del, riktning] = slot.split("-");
    const i = riktning === "fri" ? rng.pick(["stor", "liten"]) : riktning === "forl" ? "stor" : "liten";
    // Hela bråket till vänster (2/3 = 8/?) eller till höger (?/15 = 2/5).
    return { p, q, k, saknas: del, i, helaVanster: rng.chance(0.5) };
  },

  core: ({ p, q, k, saknas, i }) => `${p}/${q}×${k}:${i}-${saknas}`,

  build({ p, q, k, saknas, i, helaVanster }) {
    const liten = { n: p, d: q };
    const stor = { n: p * k, d: q * k };
    const ofull = i === "stor" ? stor : liten; //  bråket med rutan
    const hel = i === "stor" ? liten : stor; //    det fullständiga bråket
    const x = saknas === "t" ? ofull.n : ofull.d;
    const kand = saknas === "t" ? ofull.d : ofull.n; // det kända talet i bråket med rutan
    const brakMedRuta = saknas === "t" ? { brak: { n: { input: "svar" }, d: ofull.d } } : { brak: { n: ofull.n, d: { input: "svar" } } };
    const helt = { kind: "fraction", n: hel.n, d: hel.d };
    const vanster = helaVanster ? helt : brakMedRuta;
    const hoger = helaVanster ? brakMedRuta : helt;
    const facit = helaVanster ? `${hel.n}/${hel.d} = ${ofull.n}/${ofull.d}` : `${ofull.n}/${ofull.d} = ${hel.n}/${hel.d}`;
    // Pilen går från vänster till höger: × om höger bråk är det större, annars ÷.
    const hogerStor = (i === "stor") === helaVanster;
    const pil = hogerStor ? "×" : "÷";

    // Missuppfattningar: additiv ändring (samma tal adderat), faktorn själv, talet avskrivet.
    const motsv = saknas === "t" ? hel.n : hel.d; //   samma plats i det fullständiga bråket
    const andraHel = saknas === "t" ? hel.d : hel.n; // den andra platsen i det fullständiga
    const additiv = motsv + (kand - andraHel);
    const fel = [...new Set([additiv, k, motsv, x + 1, x - 1].filter((v) => Number.isSafeInteger(v) && v >= 0 && v !== x))];
    const ex = p === 1 && q === 4 ? { p: 1, q: 3, k: 2 } : { p: 1, q: 4, k: 3 };
    return {
      core: `${p}/${q}×${k}:${i}-${saknas}`,
      prompt: `Vilket tal ska stå i rutan, så att bråken blir lika stora?`,
      values: { left: helaVanster ? hel : ofull, right: helaVanster ? ofull : hel, missing: x, factor: k },
      view: {
        component: "verkstad",
        expr: [vanster, { op: "=", pilar: pil }, hoger],
      },
      answer: NUMBER_INTEGER,
      key: {
        ...talNyckel({ n: x, d: 1 }),
        display: facit,
        examples: { right: [heltal(x), heltal(`0${x}`)], wrong: fel.slice(0, 4).map(heltal) },
      },
      help: [
        { step: "orientering", text: "De två bråken ska vara lika mycket. Jämför tal på samma plats: täljare med täljare, nämnare med nämnare.", highlight: { pilar: true } },
        { step: "princip", text: "Vilket tal har ändrats och med vilken faktor? Samma förändring behövs på andra sidan bråkstrecket – annars blir det inte lika mycket.", highlight: { pilar: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.p}/${ex.q} = ?/${ex.q * ex.k}. Nämnaren ${ex.q} har blivit ${ex.q * ex.k}, alltså ${ex.k} gånger så stor: varje bit delas i ${ex.k}. ` +
            `Då blir det ${ex.k} gånger så många färgade bitar: ${ex.p} · ${ex.k} = ${ex.p * ex.k}.`,
          view: { component: "stav", bars: [{ parts: ex.q, marked: ex.p }, { parts: ex.q * ex.k, marked: ex.p * ex.k }] },
        },
        { step: "atergang", text: "Nu provar du själv: hitta faktorn mellan de två tal du känner, och gör samma sak med det andra talet." },
      ],
      misconceptions: ["additiv-forandring", "skriver-faktorn", "andrar-bara-ena-talet"],
      feedback: {
        correct: `Ja! ${facit}: täljare och nämnare har ${hogerStor ? "multiplicerats" : "delats"} med ${k}. Det är lika mycket.`,
        wrong: `Två lika stora bråk får man genom att multiplicera (eller dela) både täljare och nämnare med samma tal – inte genom att lägga till.`,
      },
      review: `${facit}. Från ${p}/${q} till ${p * k}/${q * k} multipliceras både täljaren och nämnaren med ${k}.`,
    };
  },

  reserve: [
    { slot: "t-forl", params: { p: 2, q: 3, k: 4, saknas: "t", i: "stor", helaVanster: true } },
    { slot: "n-forl", params: { p: 2, q: 3, k: 4, saknas: "n", i: "stor", helaVanster: true } },
    { slot: "t-forl", params: { p: 2, q: 5, k: 3, saknas: "t", i: "stor", helaVanster: false } },
    { slot: "n-forl", params: { p: 3, q: 4, k: 2, saknas: "n", i: "stor", helaVanster: false } },
    { slot: "t-fork", params: { p: 1, q: 2, k: 5, saknas: "t", i: "liten", helaVanster: true } },
    { slot: "n-fork", params: { p: 3, q: 5, k: 3, saknas: "n", i: "liten", helaVanster: false } },
    { slot: "t-fork", params: { p: 5, q: 6, k: 2, saknas: "t", i: "liten", helaVanster: false } },
    { slot: "n-fork", params: { p: 4, q: 7, k: 2, saknas: "n", i: "liten", helaVanster: true } },
    { slot: "t-fri", params: { p: 3, q: 8, k: 3, saknas: "t", i: "stor", helaVanster: true } },
    { slot: "t-fri", params: { p: 7, q: 10, k: 2, saknas: "t", i: "liten", helaVanster: false } },
    { slot: "n-fri", params: { p: 4, q: 9, k: 3, saknas: "n", i: "liten", helaVanster: true } },
    { slot: "n-fri", params: { p: 1, q: 6, k: 6, saknas: "n", i: "stor", helaVanster: false } },
  ],
});
