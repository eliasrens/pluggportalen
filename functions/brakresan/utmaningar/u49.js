// ============================================================================
// 49. Rabatter och procentproblem (src/brakresan/utmaningar/u49.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 49: använda procent och skilja rabattens belopp från det nya
// priset. Fast blandning: fyra frågor om rabatten i kronor, fyra om priset
// efter rabatt, två om prisökning. Prisbandet: hela priset = 100 %, delat i
// lika delar (10 % → 10 delar, 25 % → 4 …); rabatten är den randiga delen.
// Ökningen ritas som en ny del med SAMMA ursprungsbas (andra stav).
// Generering: priser 40–800 kr, 10, 20, 25 eller 50 %, bara hela kronor
// (exakt, percent.js). Ingen moms, ränta, successiva rabatter eller
// procentenheter. Svaret: det som faktiskt efterfrågas.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gcd, percentOf, discount, increase } from "../math/index.js";
import { text, kr } from "./delat-g.js";

const SLOTS = ["rabatt", "nytt", "rabatt", "nytt", "okning", "rabatt", "nytt", "rabatt", "nytt", "okning"];
const PROCENT = [10, 20, 25, 50];
const delar = (p) => 100 / gcd(p, 100);

const VAROR = ["en jacka", "ett par skor", "en cykelhjälm", "ett brädspel", "en ryggsäck", "en lampa", "ett par hörlurar", "en fotboll"];

const kärna = ({ typ, pris, p }) => `${typ}:${p}%:${pris}`;

export default defineChallenge({
  id: "49",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    // 50 % ger lika stor rabatt som nytt pris – då skiljer frågan inte på dem.
    const p = rng.pick((index < 2 ? [10, 50] : PROCENT).filter((x) => slot !== "nytt" || x !== 50));
    // Hela kronor: priset är en multipel av 100/gcd(p, 100), helst runda priser.
    const steg = delar(p);
    const alla = [];
    for (let x = 40; x <= 800; x += steg) if (x % steg === 0) alla.push(x);
    const runda = alla.filter((x) => x % 20 === 0 || (x % 10 === 0 && x <= 200));
    return { typ: slot, pris: rng.pick(rng.chance(0.8) ? runda : alla), p, vara: rng.int(0, VAROR.length - 1) };
  },

  core: kärna,

  build({ typ, pris, p, vara }) {
    const k = delar(p);
    const del = percentOf(p, pris).n;
    const enDel = pris / k;
    const nytt = typ === "okning" ? increase(pris, p).newPrice.n : discount(pris, p).newPrice.n;
    const sak = VAROR[vara];
    const den = sak.startsWith("ett ") ? "Det" : "Den";
    const kort = (x) => `${kr(x)} kr`;
    const svar = typ === "rabatt" ? del : nytt;
    const band = { component: "stav", parts: k, marked: (p * k) / 100, label: `Hela priset = ${kort(pris)} = 100 %` };
    const prompt = {
      rabatt: `${sak.replace(/^./, (c) => c.toUpperCase())} kostar ${kort(pris)}. ${den} säljs med ${p} % rabatt. Hur många kronor är rabatten?`,
      nytt: `${sak.replace(/^./, (c) => c.toUpperCase())} kostar ${kort(pris)}. ${den} säljs med ${p} % rabatt. Vad kostar ${den.toLowerCase()} efter rabatten?`,
      okning: `${sak.replace(/^./, (c) => c.toUpperCase())} kostade ${kort(pris)}. Priset höjs med ${p} %. Vad kostar ${den.toLowerCase()} nu?`,
    }[typ];
    const fragar = typ === "rabatt" ? "rabatten" : typ === "nytt" ? "priset efter rabatt" : "det nya priset";
    const svarRad = [{ text: `${fragar.replace(/^./, (c) => c.toUpperCase())}:` }, { input: true }, { text: "kr" }];
    const felV = typ === "rabatt" ? [nytt, p, pris + del] : typ === "nytt" ? [del, pris - p, pris + del] : [del, pris + p, pris - del];
    const fel = [...new Set(felV)].filter((x) => x !== svar && x >= 0).map(text);
    const rakna = p === 10 ? `10 % är en tiondel: ${kort(pris)} ÷ 10 = ${kort(del)}` : p === 20 ? `10 % är ${kort(pris / 10)}, och 20 % är dubbelt så mycket: ${kort(del)}` :
      p === 25 ? `25 % är en fjärdedel: ${kort(pris)} ÷ 4 = ${kort(del)}` : `50 % är hälften: ${kort(pris)} ÷ 2 = ${kort(del)}`;
    const slut = typ === "rabatt" ? `Rabatten är ${kort(del)}.` : typ === "nytt" ? `Nytt pris: ${kort(pris)} − ${kort(del)} = ${kort(nytt)}.` : `Nytt pris: ${kort(pris)} + ${kort(del)} = ${kort(nytt)}.`;
    const ex = pris === 300 ? { pris: 400, p: 25 } : { pris: 300, p: 10 };
    const exDel = percentOf(ex.p, ex.pris).n;
    return {
      core: kärna({ typ, pris, p }),
      prompt,
      values: { pris, p, rabatt: del, nytt },
      view: typ === "okning"
        ? {
          // Ökningen: en tillagd del mätt med SAMMA ursprungsbas – två lika långa band.
          component: "sammansatt",
          delar: [
            { view: { component: "stav", parts: k, marked: k, label: `Det gamla priset = ${kort(pris)} = 100 %` } },
            { view: { component: "stav", parts: k, marked: (p * k) / 100, label: `Ökningen: ${p} % av samma pris` } },
            { view: { component: "notation", expr: svarRad }, svar: true },
          ],
        }
        : { ...band, expr: svarRad },
      answer: { type: "number", input: "integer" },
      key: {
        type: "number", value: svar, requirement: { kind: "integer" },
        display: `${p} % av ${kort(pris)} = ${kort(del)}; ${typ === "rabatt" ? `rabatten är ${kort(del)}` : `${fragar} är ${kort(nytt)}`}`,
        examples: { right: [text(svar)], wrong: fel },
      },
      help: [
        { step: "orientering", text: `Vad är 100 % här? ${typ === "okning" ? "Det gamla priset" : "Hela priset"}, ${kort(pris)}. Bandet är delat i ${k} lika delar.`, highlight: { whole: true } },
        { step: "princip", text: typ === "okning" ? "Ökningen räknas på det gamla priset och läggs till." : `Frågar vi efter rabatten eller priset efter rabatt? Rabatten är den randiga delen – det du betalar är resten.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.p} % av ${kort(ex.pris)} är ${kort(exDel)}. Med ${ex.p} % rabatt kostar det ${kort(ex.pris)} − ${kort(exDel)} = ${kort(ex.pris - exDel)}.`,
          view: { component: "stav", parts: delar(ex.p), marked: 1, label: `Hela priset = ${kort(ex.pris)} = 100 %` },
        },
        { step: "atergang", text: `Nu provar du själv: hur mycket är en del av bandet – och vilket belopp frågar uppgiften efter?` },
      ],
      misconceptions: typ === "rabatt" ? ["svarar-nytt-pris", "procentsiffran-som-kronor"] : typ === "nytt" ? ["svarar-rabatten", "drar-av-procentsiffran"] : ["drar-av-i-stallet", "svarar-okningen"],
      feedback: {
        correct: `Ja! ${rakna}. ${slut}`,
        wrong: `${rakna}. ${slut} Uppgiften frågar efter ${fragar}.`,
      },
      review: `${rakna}. ${slut}`,
    };
  },

  reserve: [
    ["rabatt", 200, 25], ["nytt", 200, 25], ["rabatt", 80, 10], ["nytt", 450, 20], ["rabatt", 360, 50],
    ["nytt", 640, 25], ["okning", 300, 10], ["okning", 120, 25], ["rabatt", 740, 20], ["nytt", 90, 10],
  ].map(([typ, pris, p], i) => ({ slot: typ, params: { typ, pris, p, vara: i % VAROR.length } })),
});
