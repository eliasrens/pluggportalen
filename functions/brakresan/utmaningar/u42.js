// ============================================================================
// 42. Tre former – samma värde (src/brakresan/utmaningar/u42.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 42: förbinda bråk, decimal och procent. Sex neutrala kort – två
// bråk, två decimaltal, två procenttal. Välj tre: ett av varje form med samma
// exakta värde (select, valfri ordning). Felkorten bygger på missuppfattningar
// (siffrorna ihop: 3/4 → 0,34 och 34 %; komplementet; 0,5 → 5 %; omvänt
// bråk) och bildar ALDRIG en egen trippel – granskningen kontrollerar att
// exakt en grupp av typen bråk + decimal + procent har samma värde.
// Generering: värden 0–1 med hel procent och högst två decimaler; en uppgift
// per omgång har värdet 0 och en värdet 1; blandar vanliga (1/4) och mindre
// självklara (7/20, 0,35, 35 %). Likhetskedjan visas efter svaret.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, eq } from "../math/index.js";
import { kortId, br, dec, pct, decText, pctText, nd } from "./delat-g.js";

const SLOTS = ["vanlig", "vanlig", "vanlig", "noll", "klurig", "klurig", "ett", "klurig", "vanlig", "klurig"];
const FORMER = ["brak", "dec", "pct"];
const BLANDA = [[3, 0, 4, 1, 5, 2], [0, 4, 5, 1, 3, 2], [4, 1, 0, 5, 2, 3], [5, 3, 1, 0, 2, 4]];

/** p (0–100) → värdet p/100. */
const V = (p) => q(p, 100);
const ok2 = (v) => v.n >= 0 && (v.n * 100) % v.d === 0; // hel procent ⇒ högst två decimaler

/** Felkandidater per form för värdet p %, i prioritetsordning. Alla som { n, d }-värden + skriven form. */
function kandidater(p, f) {
  const v = V(p);
  const ut = { brak: [], dec: [], pct: [] };
  // Bråk: omvänt, komplementet, 1/p ("0,25 → 1/25"), en del för lite.
  if (f.n > 0 && f.n !== f.d) ut.brak.push({ n: f.d, d: f.n });
  if (p > 0 && p < 100) { const c = V(100 - p); ut.brak.push({ n: c.n, d: c.d }); }
  if (p > 1 && p < 100) ut.brak.push({ n: 1, d: p });
  ut.brak.push({ n: Math.max(1, f.n), d: f.d + 1 }, { n: 1, d: 3 > f.d ? 4 : f.d - 1 }, { n: 1, d: 100 });
  // Decimal: siffrorna ihop (3/4 → 0,34), procenttalet som tiondelar (25 % → 2,5 – bara under 100 %),
  // tiondel/hundradel ombytt, komplementet.
  if (f.n < 10 && f.d < 10 && f.n > 0) ut.dec.push(q(Number(`${f.n}${f.d}`), 100));
  if (p < 10 && p > 0) ut.dec.push(q(p, 10));
  if (p % 10 === 0 && p > 0 && p < 100) ut.dec.push(q(p / 10, 100));
  if (p >= 10 && p % 10 !== 0) ut.dec.push(q((p % 10) * 10 + Math.floor(p / 10), 100));
  if (p > 0 && p < 100) ut.dec.push(V(100 - p));
  ut.dec.push(p === 0 ? q(1, 10) : q(p, 10), q(1, 100));
  // Procent: decimalens siffra som procent (0,5 → 5 %), siffrorna ihop, komplementet.
  if (p % 10 === 0 && p > 0 && p < 100) ut.pct.push(q(p / 10, 100));
  if (f.n > 0 && f.d < 100 && Number(`${f.n}${f.d}`) <= 100) ut.pct.push(V(Number(`${f.n}${f.d}`)));
  if (p > 0 && p < 100) ut.pct.push(V(100 - p));
  ut.pct.push(V(p === 100 ? 10 : p + 1), V(p === 0 ? 10 : 1));
  return Object.fromEntries(FORMER.map((k) => [k, ut[k].map((x) => q(x.n, x.d)).filter((x) => !eq(x, v) && (k !== "pct" || ((x.n * 100) % x.d === 0 && x.n * 100 <= 100 * x.d))
    && (k !== "dec" || ok2(x)))]));
}

/** Kortets framsida för formen. */
function framsida(k) {
  const v = q(k.n, k.d);
  if (k.form === "brak") return br(k.fn ?? v.n, k.fd ?? v.d);
  if (k.form === "dec") return dec(v, k.places ?? 0);
  return pct(v);
}
const kortText = (k) => {
  const v = q(k.n, k.d);
  return k.form === "brak" ? `${k.fn ?? v.n}/${k.fd ?? v.d}` : k.form === "dec" ? decText(v, k.places ?? 0) : pctText(v);
};

function kärna({ kort }) {
  return kort.map((k) => `${k.form}:${kortText(k)}${k.ratt ? "*" : ""}`).sort().join("|");
}

export default defineChallenge({
  id: "42",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    let p;
    if (slot === "noll") p = 0;
    else if (slot === "ett") p = 100;
    else if (slot === "vanlig") p = rng.pick([50, 25, 75, 20, 40, 60, 80, 10, 30, 70, 90, 5]);
    else p = rng.pick([35, 15, 45, 65, 85, 95, 12, 24, 36, 44, 48, 52, 56, 64, 68, 76, 84, 88, 92, 96, 2, 4, 6, 8, 14, 16, 18, 22, 26, 28, 32, 34, 38, 42, 46, 54, 58, 62, 66, 72, 74, 78, 82, 86, 94, 98, 1, 3, 7, 11, 13, 17, 37, 63]);
    const v = V(p);
    // Bråkets form: förkortat, ibland förlängt (×2) – eller för 0 och 1 en nämnare 2–10.
    let fn = v.n;
    let fd = v.d;
    if (p === 0 || p === 100) { fd = rng.pick([2, 4, 5, 8, 10]); fn = p === 0 ? 0 : fd; }
    else if (fd <= 10 && rng.chance(0.3)) { fn *= 2; fd *= 2; }
    const places = p === 0 || p === 100 ? rng.pick([1, 2]) : p % 10 === 0 && rng.chance(0.3) ? 2 : 0;
    const kand = kandidater(p, { n: fn, d: fd });
    // Ett felkort per form – och de tre felkorten får inte vara lika (då fanns en trippel till).
    let fel;
    for (let i = 0; i < 20; i++) {
      fel = FORMER.map((form) => ({ form, v: rng.pick(kand[form].slice(0, Math.max(2, Math.min(3, kand[form].length)))) }));
      if (!(eq(fel[0].v, fel[1].v) && eq(fel[1].v, fel[2].v))) break;
    }
    const kort = rng.shuffle([
      { form: "brak", n: v.n, d: v.d, fn, fd, ratt: true },
      { form: "dec", n: v.n, d: v.d, places, ratt: true },
      { form: "pct", n: v.n, d: v.d, ratt: true },
      ...fel.map((f) => ({ form: f.form, n: f.v.n, d: f.v.d })),
    ]);
    return { p, kort };
  },

  core: kärna,

  build({ p, kort }) {
    const v = V(p);
    const cards = kort.map((k, i) => ({ id: kortId(i), face: framsida(k) }));
    const ratt = cards.filter((_, i) => kort[i].ratt).map((c) => c.id);
    const fel = cards.filter((_, i) => !kort[i].ratt);
    const formAv = (id) => kort[cards.findIndex((c) => c.id === id)].form;
    const rattBrak = kort.find((k) => k.ratt && k.form === "brak");
    const kedja = `${rattBrak.fn}/${rattBrak.fd}${rattBrak.fd !== 100 && p > 0 ? ` = ${p}/100` : ""} = ${decText(v, kort.find((k) => k.ratt && k.form === "dec").places ?? 0)} = ${pctText(v)}`;
    const byt = (form) => ratt.map((id) => (formAv(id) === form ? fel.find((c) => formAv(c.id) === form).id : id));
    const ex = p === 25 || p === 75 ? { b: "2/5", h: 40, d: "0,4", pr: "40 %" } : { b: "3/4", h: 75, d: "0,75", pr: "75 %" };
    return {
      core: kärna({ kort }),
      prompt: "Välj tre kort som är lika mycket: ett bråk, ett decimaltal och ett procenttal.",
      values: { procent: p, value: nd(v) },
      view: { component: "kort", cards },
      answer: { type: "select", count: 3, options: cards.map((c) => c.id) },
      key: {
        type: "select",
        groups: [{ ids: ratt }],
        display: kedja,
        examples: {
          right: [{ ids: ratt }, { ids: [...ratt].reverse() }],
          wrong: [{ ids: byt("brak") }, { ids: byt("dec") }, { ids: byt("pct") }],
        },
      },
      help: [
        { step: "orientering", text: "Hela = 1 = 100 %. Du ska hitta tre kort i olika former som är exakt lika mycket." },
        { step: "princip", text: "Hur många hundradelar visar varje kort? Skriv bråket med nämnaren 100, läs decimaltalet som hundradelar – procent betyder hundradelar." },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.b} = ${ex.h}/100. ${ex.d} är ${ex.h} hundradelar och ${ex.pr} är också ${ex.h} hundradelar.`,
          view: { component: "hundraruta", marked: ex.h },
        },
        { step: "atergang", text: "Nu provar du själv: skriv vartannat kort som hundradelar och leta efter tre som blir lika." },
      ],
      misconceptions: ["siffrorna-ihop", "procentsiffran-som-decimal", "komplement", "omvant-brak"],
      feedback: {
        correct: `Ja! ${kedja}. Samma tal i tre former.`,
        wrong: `Skriv korten som hundradelar: ${kedja}.`,
      },
      review: `${kedja}. ${p} hundradelar – ${p === 0 ? "inget alls" : p === 100 ? "hela" : `${p} av 100`} – i tre former.`,
    };
  },

  reserve: [
    [75, [[3, 4, "brak"], [34, 100, "dec"], [75, 100, "pct"], [1, 4, "brak"], [75, 100, "dec"], [34, 100, "pct"]]],
    [35, [[7, 20, "brak"], [35, 100, "dec"], [35, 100, "pct"], [20, 7, "brak"], [72, 100, "dec"], [65, 100, "pct"]]],
    [50, [[1, 2, "brak"], [5, 100, "dec"], [50, 100, "pct"], [5, 100, "brak"], [50, 100, "dec"], [5, 100, "pct"]]],
    [0, [[0, 1, "brak", 0, 4], [0, 1, "dec"], [0, 1, "pct"], [1, 4, "brak"], [1, 10, "dec"], [10, 100, "pct"]]],
    [100, [[1, 1, "brak", 5, 5], [1, 1, "dec"], [1, 1, "pct"], [1, 5, "brak"], [1, 10, "dec"], [10, 100, "pct"]]],
    [20, [[1, 5, "brak"], [2, 10, "dec"], [20, 100, "pct"], [5, 1, "brak"], [2, 100, "dec"], [80, 100, "pct"]]],
    [12, [[3, 25, "brak"], [12, 100, "dec"], [12, 100, "pct"], [1, 12, "brak"], [21, 100, "dec"], [88, 100, "pct"]]],
    [40, [[2, 5, "brak"], [4, 10, "dec"], [40, 100, "pct"], [5, 2, "brak"], [25, 100, "dec"], [4, 100, "pct"]]],
    [64, [[16, 25, "brak"], [64, 100, "dec"], [64, 100, "pct"], [25, 16, "brak"], [46, 100, "dec"], [36, 100, "pct"]]],
    [5, [[1, 20, "brak"], [5, 100, "dec"], [5, 100, "pct"], [1, 5, "brak"], [5, 10, "dec"], [50, 100, "pct"]]],
  ].map(([p, l], i) => ({ // ordningen blandas: de rätta korten hamnar aldrig först i följd
    slot: p === 0 ? "noll" : p === 100 ? "ett" : i % 2 ? "klurig" : "vanlig",
    params: {
      p,
      kort: l.map(([n, d, form, fn, fd], j) => {
        const v = q(n, d);
        const k = { form, n: v.n, d: v.d, ...(j < 3 ? { ratt: true } : {}) };
        if (form === "brak" && j < 3) Object.assign(k, { fn: fn ?? (form === "brak" ? n : v.n), fd: fd ?? d });
        if (form === "dec" && j < 3 && (p === 0 || p === 100)) k.places = 1;
        return k;
      }).map((_, j, alla) => alla[BLANDA[i % 4][j]]),
    },
  })),
});

export { kandidater };
