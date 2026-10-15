// ============================================================================
// 23. Bråkkompisar – blandade kort (src/brakresan/utmaningar/u23.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 23 + §6 "hitta tre": sex kort i olika representationer – symbol,
// text ("fyra sjättedelar"), mängd ("8 av 12 kulor markerade"), stav, cirkel
// och rutnät. Exakt tre kort har samma värde; eleven väljer dem.
//   • värde p/q med förkortad nämnare 2–8, presentationsnämnare ≤ 24
//   • trippeln: tre OLIKA representationstyper och tre olika indelningar
//     (förlängningsfaktorer m) – alltså minst två av varje som specen kräver
//   • de tre andra korten bygger på missuppfattningar (samma antal markerade
//     av en annan helhet, det omarkerade, täljaren ±1, samma tal adderat …) och
//     har tre OLIKA värden skilda från målvärdet – ingen annan trippel finns
//   • korten blandas; id k1–k6 följer visningsordningen; korttypen avslöjar
//     inget (distraktorerna får också slumpade typer)
//   • ingen decimal eller procent
// Hjälp: jämför andel, inte antal markerade bitar – omgruppera/omdela, med
// andra tal.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, valueKey } from "../math/index.js";
import { fractionWords } from "../math/words.js";
import { basbrak, versal } from "./f-delat.js";

const MAX_D = 24;
const BASER = basbrak(2, 8);
const TYPER = ["symbol", "text", "mangd", "stav", "cirkel", "rutnat"];
const FOREMAL = ["kula", "knapp", "stjarna", "kloss"];
const FOREMAL_PLURAL = { kula: "kulor", knapp: "knappar", stjarna: "stjärnor", kloss: "klossar" };

/** Kan typen visa n/d läsbart? (cirkel ≤ 12 delar, rutnät två rader, mängd ≥ 4 föremål) */
function typOk(typ, n, d) {
  if (typ === "cirkel") return d <= 12;
  if (typ === "rutnat") return d % 2 === 0 && d >= 4;
  if (typ === "mangd") return d >= 4 && d <= 16;
  if (typ === "text") return d <= 12;
  return n >= 1;
}

/** Kortets framsida ur (typ, n, d). */
export function framsida({ typ, n, d, item }) {
  switch (typ) {
    case "symbol": return { kind: "fraction", n, d };
    case "text": return { text: versal(fractionWords(n, d)) };
    case "mangd": return { component: "mangd", count: d, marked: n, item };
    case "stav": return { component: "stav", parts: d, marked: n, label: "Hela staven = 1" };
    case "cirkel": return { component: "cirkel", parts: d, marked: n, label: "Hela cirkeln = 1" };
    default: return { component: "rutnat", rows: 2, cols: d / 2, marked: n, label: "Hela rektangeln = 1" };
  }
}

const kortText = (c) => (c.typ === "symbol" ? `${c.n}/${c.d}` : c.typ === "text" ? fractionWords(c.n, c.d)
  : c.typ === "mangd" ? `${c.n} av ${c.d} ${FOREMAL_PLURAL[c.item]}` : `${c.n} av ${c.d} delar (${c.typ === "stav" ? "stav" : c.typ === "cirkel" ? "cirkel" : "rutnät"})`);

/** Distraktorernas värden (missuppfattningar) för målet p/q med presentationen m. */
function kandidater(p, qq, m, grannar = false) {
  const ut = [];
  const lagg = (n, d, tag) => { if (n >= 1 && n < d && d >= 2 && d <= MAX_D) ut.push({ n, d, tag }); };
  lagg(p * m, qq * m + m, "samma-antal-annan-helhet");
  lagg(p * m, qq * m - m, "samma-antal-annan-helhet");
  lagg(qq * m - p * m, qq * m, "omarkerade");
  lagg(p * m + 1, qq * m, "fel-antal-markerade");
  lagg(p * m - 1, qq * m, "fel-antal-markerade");
  lagg(p + m, qq + m, "additiv-forlangning");
  lagg(p, qq * m, "bara-namnaren-forlangd");
  // Reserv om missuppfattningarna inte räcker till tre olika värden: fler markerade av samma helhet.
  if (grannar) for (let k = 2; k < qq * m; k++) lagg(p * m + k, qq * m, "fel-antal-markerade");
  return ut;
}

export default defineChallenge({
  id: "23",
  version: 1,

  generate(rng, { slot }) {
    const [p, qq] = rng.pick(slot === "intro" ? BASER.filter(([, d]) => d <= 4) : BASER);
    const max = Math.floor(MAX_D / qq);
    const faktorer = rng.sample(Array.from({ length: max }, (_, i) => i + 1), 3).sort((a, b) => a - b);
    // Tre olika typer som kan visa sina tal; intro har alltid ett symbolkort.
    const ratt = [];
    const typer = rng.shuffle(TYPER);
    if (slot === "intro") typer.unshift("symbol");
    // Den mest begränsade indelningen väljer typ först (symbol och stav går alltid).
    const antalTyper = (m) => TYPER.filter((t) => typOk(t, p * m, qq * m)).length;
    for (const m of [...faktorer].sort((a, b) => antalTyper(a) - antalTyper(b) || b - a)) {
      const typ = typer.find((t) => !ratt.some((r) => r.typ === t) && typOk(t, p * m, qq * m));
      ratt.push({ typ, n: p * m, d: qq * m, ratt: true });
    }
    const sett = new Set([valueKey(q(p, qq))]);
    const dis = [];
    const fm = rng.shuffle(faktorer);
    const lista = [...fm.flatMap((m) => rng.shuffle(kandidater(p, qq, m))), ...fm.flatMap((m) => kandidater(p, qq, m, true))];
    for (const c of lista) {
      const k = valueKey(q(c.n, c.d));
      if (sett.has(k) || dis.length >= 3) continue;
      sett.add(k);
      dis.push({ typ: rng.pick(TYPER.filter((t) => typOk(t, c.n, c.d))), n: c.n, d: c.d, tag: c.tag });
    }
    const kort = rng.shuffle([...ratt, ...dis]).map((c) => (c.typ === "mangd" ? { ...c, item: rng.pick(FOREMAL) } : c));
    return { p, q: qq, kort };
  },

  core: ({ p, q: qq, kort }) => `${p}/${qq}:${kort.filter((c) => c.ratt).map((c) => `${c.typ}${c.d}`).sort().join(",")}`,

  build({ p, q: qq, kort }) {
    const cards = kort.map((c, i) => ({ id: `k${i + 1}`, face: framsida(c) }));
    const ratt = cards.filter((_, i) => kort[i].ratt).map((c) => c.id);
    const fel = cards.filter((_, i) => !kort[i].ratt).map((c) => c.id);
    const rattText = kort.filter((c) => c.ratt).map(kortText);
    const ord = fractionWords(p, qq);
    // Exemplet i hjälpen: en annan andel, som mängd i grupper.
    const ex = p === 1 && qq === 2 ? { n: 2, d: 6, g: 3 } : { n: 3, d: 6, g: 2 };
    return {
      core: `${p}/${qq}:${kort.filter((c) => c.ratt).map((c) => `${c.typ}${c.d}`).sort().join(",")}`,
      prompt: "Välj de tre korten som visar lika mycket.",
      values: { target: { n: p, d: qq }, cards: Object.fromEntries(cards.map((c, i) => [c.id, q(kort[i].n, kort[i].d)])) },
      view: { component: "kort", cards },
      answer: { type: "select", count: 3, options: cards.map((c) => c.id) },
      key: {
        type: "select",
        groups: [{ ids: ratt }],
        display: rattText.join(" = "),
        examples: {
          right: [{ ids: ratt }, { ids: [...ratt].reverse() }],
          wrong: [{ ids: [ratt[0], ratt[1], fel[0]] }, { ids: fel }, { ids: [ratt[2], fel[1], fel[2]] }],
        },
      },
      help: [
        { step: "orientering", text: "Varje kort visar en andel av sin egen helhet: hela staven, hela cirkeln, hela samlingen. Du letar efter tre kort med samma andel.", highlight: { whole: true } },
        { step: "princip", text: "Jämför andelen, inte antalet markerade. Fler markerade bitar kan vara lika mycket om helheten är delad i fler bitar." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.n} av ${ex.d} kulor. Lägg kulorna i grupper om ${ex.d / ex.g}: då är ${ex.n / (ex.d / ex.g)} av ${ex.g} grupper markerade – ` +
            `${fractionWords(ex.n, ex.d)} är lika mycket som ${fractionWords(ex.n / (ex.d / ex.g), ex.g)}.`,
          view: { component: "mangd", count: ex.d, marked: ex.n, groups: ex.g },
        },
        { step: "atergang", text: "Nu provar du själv: ta ett kort i taget. Går det att gruppera eller dela om bitarna så att det blir samma andel som ett annat kort?" },
      ],
      misconceptions: [...new Set(kort.filter((c) => c.tag).map((c) => c.tag))],
      feedback: {
        correct: `Ja! Alla tre är ${ord}: ${rattText.join(", ")}.`,
        wrong: `De tre som hör ihop är alla ${ord}. Jämför andelen av helheten, inte bara hur många som är markerade.`,
      },
      review: `${rattText.join(" = ")} = ${p}/${qq}. Helheterna är delade olika, men andelen är densamma. De andra korten har andra värden.`,
    };
  },

  reserve: [
    [1, 2, [1, 2, 4], ["symbol", "stav", "mangd"]],
    [1, 3, [1, 2, 4], ["text", "cirkel", "mangd"]],
    [2, 3, [1, 2, 4], ["symbol", "rutnat", "mangd"]],
    [1, 4, [1, 2, 3], ["cirkel", "text", "stav"]],
    [3, 4, [1, 2, 3], ["symbol", "mangd", "stav"]],
    [2, 5, [1, 2, 4], ["stav", "text", "mangd"]],
    [3, 5, [1, 2, 3], ["cirkel", "symbol", "rutnat"]],
    [1, 6, [1, 2, 3], ["symbol", "cirkel", "mangd"]],
    [5, 6, [1, 2, 4], ["text", "stav", "mangd"]],
    [3, 8, [1, 2, 3], ["symbol", "mangd", "stav"]],
    [2, 7, [1, 2, 3], ["text", "stav", "symbol"]],
  ].map(([p, qq, ms, typer]) => ({ params: reservParams(p, qq, ms, typer) })),
});

/** Reservbankens uppgifter: samma regler utan slump (fast ordning). */
function reservParams(p, qq, ms, typer) {
  const ratt = ms.map((m, i) => ({ typ: typer[i], n: p * m, d: qq * m, ratt: true, ...(typer[i] === "mangd" ? { item: "kula" } : {}) }));
  const sett = new Set([valueKey(q(p, qq))]);
  const dis = [];
  for (const c of [...kandidater(p, qq, ms[1]), ...kandidater(p, qq, ms[1], true)]) {
    const k = valueKey(q(c.n, c.d));
    if (sett.has(k) || dis.length >= 3) continue;
    sett.add(k);
    dis.push({ typ: ["symbol", "stav", "text"][dis.length], n: c.n, d: c.d, tag: c.tag });
  }
  return { p, q: qq, kort: [dis[0], ratt[0], dis[1], ratt[1], ratt[2], dis[2]] };
}
