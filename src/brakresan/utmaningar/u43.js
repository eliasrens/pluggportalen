// ============================================================================
// 43. Vilken passar inte? (src/brakresan/utmaningar/u43.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 43: fyra kort – bråk, decimal, procent och en bild (hundraruta eller
// stav med uttalad helhet "Hela … = 1"). Exakt tre är lika mycket, ett
// avviker. Välj avvikaren (choice).
//   • vilken form som avviker varierar: bråket, bilden, procenten, decimalen
//   • avvikarens värde bygger på missuppfattningar (0,5/0,05, 25/75, 1/4 och
//     4/1, 0,5 → 5 %) och kontrolleras så att det ALDRIG sammanfaller med
//     målvärdet
// Generering: hel procent, högst två decimaler, värden 0–1.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, eq } from "../math/index.js";
import { kortId, br, dec, pct, decText, pctText, nd } from "./delat-g.js";
import { kandidater } from "./u42.js";

const SLOTS = ["brak", "bild", "pct", "dec", "bild", "brak", "dec", "pct", "bild", "brak"];
const NAMN = { brak: "bråket", dec: "decimaltalet", pct: "procenttalet", bild: "bilden" };
const V = (p) => q(p, 100);
const VANLIGA = [50, 25, 75, 20, 40, 60, 80, 10, 30, 70, 90, 5, 35, 45, 15, 65, 12, 24, 36, 48, 64, 85, 95, 2, 8, 37, 63, 18, 54];

/** Bilden: stav (tiondelar, fjärdedelar, halvor, femtedelar) eller hundraruta. */
function bildVy(p, typ) {
  const v = V(p);
  if (typ === "stav" && [2, 4, 5, 10].includes(v.d)) return { component: "stav", parts: v.d, marked: v.n, label: "Hela staven = 1" };
  return { component: "hundraruta", marked: p, label: "Hela hundrarutan = 1" };
}
const bildText = (p, typ) => {
  const v = V(p);
  return typ === "stav" && [2, 4, 5, 10].includes(v.d) ? `${v.n} av ${v.d} delar` : `${p} av 100 rutor`;
};

function kärna({ p, udda, uddaP, bild }) {
  return `${p}:${udda}:${uddaP}:${bild}`;
}

export default defineChallenge({
  id: "43",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const p = rng.pick(index < 3 ? VANLIGA.slice(0, 11) : VANLIGA);
    const v = V(p);
    const bild = [2, 4, 5, 10].includes(v.d) && rng.chance(0.5) ? "stav" : "ruta";
    let cand;
    if (slot === "bild") {
      cand = [100 - p, p % 10 === 0 ? p / 10 : null, p + 10 <= 100 ? p + 10 : p - 10, p > 10 ? p - 10 : null].filter((x) => x !== null && x > 0 && x !== p);
    } else {
      cand = kandidater(p, { n: v.n, d: v.d })[slot].map((x) => (x.n * 100) / x.d).filter((x) => Number.isInteger(x) || slot === "brak");
    }
    // Avvikaren som hel procent (bråk får vara > 1 och icke-hela procent, t.ex. 4/1 eller 1/3 – sparas som bråk).
    if (slot === "brak") {
      const c = kandidater(p, { n: v.n, d: v.d }).brak.filter((x) => !eq(x, v));
      const u = rng.pick(c.slice(0, 3));
      return { p, udda: "brak", uddaP: `${u.n}/${u.d}`, bild };
    }
    const u = rng.pick(cand.slice(0, 3));
    // En stav kan bara visa avvikaren om den också går i stavens delar.
    const bildTyp = slot === "bild" && bild === "stav" && ![2, 4, 5, 10].includes(V(u).d) ? "ruta" : bild;
    return { p, udda: slot, uddaP: String(u), bild: bildTyp };
  },

  core: kärna,

  build({ p, udda, uddaP, bild }) {
    const v = V(p);
    const uv = udda === "brak" ? q(...uddaP.split("/").map(Number)) : V(Number(uddaP));
    const vardeAv = (form) => (form === udda ? uv : v);
    const face = (form) => {
      const x = vardeAv(form);
      if (form === "brak") return br(x.n, x.d);
      if (form === "dec") return dec(x);
      if (form === "pct") return pct(x);
      return bildVy((x.n * 100) / x.d, bild);
    };
    // Kortens ordning följer uppgiften (index ur kärnan), så att avvikaren hamnar på olika platser.
    const ordning = ["brak", "dec", "pct", "bild"];
    const vrid = (p + uddaP.length + udda.length) % 4;
    const former = [...ordning.slice(vrid), ...ordning.slice(0, vrid)];
    const cards = former.map((form, i) => ({ id: kortId(i), face: face(form) }));
    const ratt = cards[former.indexOf(udda)].id;
    const lika = former.filter((f) => f !== udda);
    const texter = {
      brak: () => `${vardeAv("brak").n}/${vardeAv("brak").d}`,
      dec: () => decText(vardeAv("dec")),
      pct: () => pctText(vardeAv("pct")),
      bild: () => bildText((vardeAv("bild").n * 100) / vardeAv("bild").d, bild),
    };
    const uddaText = texter[udda]();
    const hundradelar = (x) => (x.n * 100) / x.d;
    const uH = hundradelar(uv);
    const uHText = Number.isInteger(uH) ? `${uH} hundradelar` : `${uv.n}/${uv.d}, inte ett helt antal hundradelar`;
    return {
      core: kärna({ p, udda, uddaP, bild }),
      prompt: "Tre kort är lika mycket. Vilket kort passar inte?",
      values: { value: nd(v), udda: nd(uv), form: udda },
      view: { component: "kort", cards, stora: true },
      answer: { type: "choice", options: cards.map((c) => c.id) },
      key: {
        type: "choice", correct: ratt,
        display: `${NAMN[udda]} (${uddaText}) passar inte – de andra är ${p} hundradelar`,
        examples: { right: [{ id: ratt }], wrong: cards.filter((c) => c.id !== ratt).map((c) => ({ id: c.id })) },
      },
      help: [
        { step: "orientering", text: "Bilden har sin helhet utskriven: hela rutan eller staven är 1. Alla kort ska jämföras med samma helhet." },
        { step: "princip", text: "Beskriv korten som hundradelar – eller tänk dig dem på samma tallinje från 0 till 1. Procent betyder hundradelar." },
        {
          step: "modellering",
          text: "Ett exempel med andra tal: 3/5 = 60/100, 0,6 = 60 hundradelar och 60 % = 60 hundradelar – lika. Men 0,06 är bara 6 hundradelar.",
          view: { component: "hundraruta", marked: 60 },
        },
        { step: "atergang", text: "Nu provar du själv: hur många hundradelar är varje kort?" },
      ],
      misconceptions: ["tiondel-hundradel-forvaxling", "komplement", "omvant-brak", "procentsiffran-som-decimal"],
      feedback: {
        correct: `Ja! ${lika.map((f) => texter[f]()).join(", ")} är alla ${p} hundradelar. ${uddaText.replace(/^./, (c) => c.toUpperCase())} är ${uHText}.`,
        wrong: `Skriv korten som hundradelar: ${lika.map((f) => texter[f]()).join(", ")} är ${p} hundradelar, men ${NAMN[udda]} (${uddaText}) är ${uHText}.`,
      },
      review: `${lika.map((f) => texter[f]()).join(" = ")} = ${p}/100. ${NAMN[udda].replace(/^./, (c) => c.toUpperCase())} ${uddaText} avviker.`,
    };
  },

  reserve: [
    { slot: "bild", params: { p: 25, udda: "bild", uddaP: "50", bild: "ruta" } },
    { slot: "brak", params: { p: 25, udda: "brak", uddaP: "4/1", bild: "stav" } },
    { slot: "dec", params: { p: 50, udda: "dec", uddaP: "5", bild: "stav" } },
    { slot: "pct", params: { p: 75, udda: "pct", uddaP: "25", bild: "ruta" } },
    { slot: "bild", params: { p: 40, udda: "bild", uddaP: "4", bild: "ruta" } },
    { slot: "brak", params: { p: 20, udda: "brak", uddaP: "4/5", bild: "stav" } },
    { slot: "dec", params: { p: 35, udda: "dec", uddaP: "53", bild: "ruta" } },
    { slot: "pct", params: { p: 60, udda: "pct", uddaP: "6", bild: "stav" } },
    { slot: "bild", params: { p: 70, udda: "bild", uddaP: "30", bild: "stav" } },
    { slot: "brak", params: { p: 12, udda: "brak", uddaP: "25/3", bild: "ruta" } },
  ],
});
