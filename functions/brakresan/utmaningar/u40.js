// ============================================================================
// 40. Bråk till decimal (src/brakresan/utmaningar/u40.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 40: omvandla exakta bråk till decimal och tillbaka. Fast blandning:
//   • fyra MATCHA: sex kort (tre bråk, tre decimaltal) – para ihop lika värden
//   • fyra SKRIV: två bråk → decimaltal, två decimaltal → bråk (alla likvärdiga
//     bråk godtas: 0,6 = 3/5 = 6/10); stav som modell när nämnaren ≤ 10
//   • två VÄLJ: rimlig omvandling bland fyra alternativ byggda på
//     missuppfattningar (3/4 → 0,34, 3,4, 0,3)
// Generering: förkortade nämnare 2, 4, 5, 10, 20, 25, 50, 100, värden 0–2,
// högst två decimaler. Decimalen byggs ur SAMMA exakta värde (decimal.js) –
// aldrig 1/3 eller 1/8. Slutnollor godtas (0,50 = 0,5).
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q, gcd, valueKey } from "../math/index.js";
import { kortId, falt, text, br, dec, decText, nd } from "./delat-g.js";

const NAMNARE = [2, 4, 5, 10, 20, 25, 50, 100];
const SLOTS = ["matcha", "skriv-dec", "matcha", "skriv-brak", "valj", "matcha", "skriv-dec", "matcha", "skriv-brak", "valj"];

/** Alla förkortade a/d med 0 < a/d ≤ 2, inte heltal. */
export const BRAK = [];
for (const d of NAMNARE) for (let a = 1; a <= 2 * d; a++) if (gcd(a, d) === 1 && a % d !== 0) BRAK.push({ a, d });

/** Ett bråk: nämnaren först (jämnt fördelad), oftast under 1. Introduktionen: nämnare ≤ 25, under 1. */
function valjBrak(rng, intro) {
  const d = rng.pick(intro ? NAMNARE.slice(0, 6) : NAMNARE);
  const under = intro || rng.chance(0.75);
  return rng.pick(BRAK.filter((b) => b.d === d && (b.a < b.d) === under));
}

const vtext = (b) => decText(q(b.a, b.d));
/** Nämnaren 10 eller 100 för värdet (hjälpens omdelning). */
const tiotal = (b) => (10 % b.d === 0 ? 10 : 100);

/** Felalternativ för "Vilket decimaltal …": siffrorna ihop, med komma emellan, bara täljaren. */
function felDecimaler(b) {
  const ut = [];
  const v = q(b.a, b.d);
  const lagg = (t) => {
    const m = /^(\d+),(\d{1,2})$/.exec(t);
    if (!m) return;
    const w = q(Number(m[1] + m[2]), 10 ** m[2].length);
    if (valueKey(w) !== valueKey(v) && !ut.some((x) => x === t)) ut.push(t);
  };
  if (b.a < 10 && b.d < 10) lagg(`0,${b.a}${b.d}`);
  if (b.a < 100 && b.d < 100) lagg(`${b.a},${b.d}`);
  if (b.a < 10) lagg(`0,${b.a}`);
  if (b.d < 100) lagg(`0,${b.d}`);
  lagg(decText(q(b.a + 1, b.d)) ?? "");
  lagg(`0,${String(b.a * 10).slice(0, 2)}`);
  return ut;
}
/** Felalternativ för "Vilket bråk …" (decimal → bråk): siffran som nämnare, fel tiotal. */
function felBrak(b) {
  const v = q(b.a, b.d);
  const h = (v.n * 100) / v.d;
  const kand = [[h, 1000], [1, h % 100 || 2], [h, 10], [Math.max(1, h % 10), 100], [b.d, b.a]];
  const ut = [];
  for (const [n, d] of kand) {
    if (!(d > 0) || n === 0) continue;
    if (valueKey(q(n, d)) === valueKey(v) || ut.some((x) => valueKey(q(x.n, x.d)) === valueKey(q(n, d)))) continue;
    ut.push({ n, d });
  }
  return ut;
}

function kärna(p) {
  if (p.typ === "matcha") return `matcha:${p.kort.filter((k) => k.form === "brak").map((k) => `${k.a}/${k.d}`).sort().join("|")}`;
  return `${p.typ}${p.riktning ? `-${p.riktning}` : ""}:${p.a}/${p.d}`;
}

export default defineChallenge({
  id: "40",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot, index }) {
    const intro = index < 3;
    if (slot === "matcha") {
      const tre = [];
      while (tre.length < 3) {
        const b = valjBrak(rng, intro);
        if (!tre.some((x) => x.d === b.d && tre.length < 2) && !tre.some((x) => valueKey(q(x.a, x.d)) === valueKey(q(b.a, b.d)))) tre.push(b);
      }
      // Kortens ordning: blandad, bråk och decimaltal om vartannat i slumpad följd.
      const kort = rng.shuffle([...tre.map((b) => ({ ...b, form: "brak" })), ...tre.map((b) => ({ ...b, form: "dec" }))]);
      return { typ: "matcha", kort };
    }
    let b = valjBrak(rng, intro);
    if (slot === "valj") {
      const riktning = rng.chance(0.6) ? "till-dec" : "till-brak";
      const felAv = riktning === "till-dec" ? felDecimaler : felBrak;
      for (let i = 0; i < 20 && felAv(b).length < 3; i++) b = valjBrak(rng, intro);
      if (felAv(b).length < 3) b = { a: 3, d: 4 };
      const fel = felAv(b);
      const valda = rng.sample(fel, 3);
      const alt = rng.shuffle([{ ratt: true }, ...valda.map((f) => (riktning === "till-dec" ? { t: f } : { n: f.n, d: f.d }))]);
      return { typ: "valj", riktning, a: b.a, d: b.d, alt };
    }
    return { typ: slot, a: b.a, d: b.d };
  },

  core: kärna,

  build(p) {
    const core = kärna(p);
    const ex = p.d === 4 || p.a === 3 ? { a: 2, d: 5 } : { a: 3, d: 4 };
    const exT = tiotal(ex);
    const help = [
      { step: "orientering", text: "Ett bråk och ett decimaltal kan vara samma tal. Decimaltal räknar tiondelar och hundradelar." },
      { step: "princip", text: "Kan bråket skrivas med nämnaren 10 eller 100? Förläng – multiplicera täljare och nämnare med samma tal. Då kan du läsa av decimaltalet." },
      {
        step: "modellering",
        text: `Ett exempel med andra tal: ${ex.a}/${ex.d} = ${(ex.a * exT) / ex.d}/${exT} = ${vtext(ex)}. Och tillbaka: ${vtext(ex)} är ${(ex.a * exT) / ex.d} ${exT === 10 ? "tiondelar" : "hundradelar"}.`,
        view: { component: "hundraruta", marked: (ex.a * 100) / ex.d },
      },
      { step: "atergang", text: "Nu provar du själv: skriv talet som tiondelar eller hundradelar först." },
    ];
    if (p.typ === "matcha") {
      const cards = p.kort.map((k, i) => ({ id: kortId(i), face: k.form === "brak" ? br(k.a, k.d) : dec(q(k.a, k.d)) }));
      const nyckel = Object.fromEntries(cards.map((c, i) => [c.id, valueKey(q(p.kort[i].a, p.kort[i].d))]));
      const grupper = {};
      cards.forEach((c) => (grupper[nyckel[c.id]] ||= []).push(c.id));
      const par = Object.values(grupper).map(([a, b]) => ({ a, b }));
      const brak = p.kort.filter((k) => k.form === "brak");
      const lista = brak.map((b) => `${b.a}/${b.d} = ${vtext(b)}`).join(", ");
      return {
        core,
        prompt: "Para ihop varje bråk med decimaltalet som är lika mycket.",
        values: { cards: Object.fromEntries(cards.map((c, i) => [c.id, { n: p.kort[i].a, d: p.kort[i].d }])) },
        view: { component: "kort", cards },
        answer: { type: "pairs" },
        key: {
          type: "pairs", cards: nyckel,
          display: lista,
          examples: {
            right: [{ pairs: par }, { pairs: par.map((x) => ({ a: x.b, b: x.a })).reverse() }],
            wrong: [{ pairs: [{ a: par[0].a, b: par[1].b }, { a: par[1].a, b: par[2].b }, { a: par[2].a, b: par[0].b }] }],
          },
        },
        help,
        misconceptions: ["siffrorna-ihop", "taljaren-som-decimal"],
        feedback: { correct: `Ja! ${lista}.`, wrong: `Skriv bråken som tiondelar eller hundradelar: ${lista}.` },
        review: `${lista}. Varje bråk förlängs till nämnaren 10 eller 100.`,
      };
    }

    const b = { a: p.a, d: p.d };
    const v = q(b.a, b.d);
    const t = vtext(b);
    const T = tiotal(b);
    const omskr = b.d === T ? `${b.a}/${b.d}` : `${b.a}/${b.d} = ${(b.a * T) / b.d}/${T}`;
    const stav = b.d <= 10 ? { component: "stav", parts: b.d, wholes: b.a > b.d ? 2 : 1, marked: b.a, label: b.a > b.d ? "Varje stav = 1 hel" : "Hela staven = 1" } : null;
    const common = {
      core,
      values: { value: nd(v), decimal: t },
      help,
      misconceptions: ["siffrorna-ihop", "taljaren-som-decimal", "slutnolla"],
      feedback: {
        correct: `Ja! ${omskr} = ${t}.${t.split(",")[1]?.length === 1 ? ` Det kan också skrivas ${t}0 – en slutnolla ändrar inte värdet.` : ""}`,
        wrong: `${omskr}, och det skrivs ${t} som decimaltal.`,
      },
      review: `${omskr} = ${t}.`,
    };

    if (p.typ === "skriv-dec") {
      const fel = felDecimaler(b).slice(0, 3).map(text);
      return {
        ...common,
        prompt: `Skriv ${b.a}/${b.d} som decimaltal.`,
        view: { ...(stav ?? { component: "notation" }), expr: [br(b.a, b.d), { op: "=" }, { input: true }] },
        answer: { type: "number", input: "decimal" },
        key: {
          type: "number", value: nd(v), requirement: { kind: "decimal" },
          display: `${b.a}/${b.d} = ${t}`,
          examples: { right: [text(t), text(t.replace(",", ".")), text(decText(v, 2))], wrong: fel.length ? fel : [text(decText(q(b.a + 1, b.d)))] },
        },
      };
    }
    if (p.typ === "skriv-brak") {
      const h = (v.n * 100) / v.d;
      const fel = felBrak(b).slice(0, 3).map((f) => falt(f.n, f.d));
      return {
        ...common,
        prompt: `Skriv ${t} som ett bråk.`,
        view: { component: "notation", expr: [dec(v), { op: "=" }, { input: true }] },
        answer: { type: "number", input: "fraction" },
        key: {
          type: "number", value: nd(v), requirement: { kind: "fraction" },
          display: `${t} = ${h}/100 = ${b.a}/${b.d}`,
          examples: { right: [falt(b.a, b.d), falt(h, 100), ...(h % 10 === 0 ? [falt(h / 10, 10)] : [])], wrong: fel },
        },
      };
    }
    // valj
    const tillDec = p.riktning === "till-dec";
    const cards = p.alt.map((x, i) => ({
      id: kortId(i),
      face: x.ratt ? (tillDec ? dec(v) : br(b.a, b.d)) : tillDec ? { text: x.t } : br(x.n, x.d),
    }));
    const ratt = cards[p.alt.findIndex((x) => x.ratt)].id;
    return {
      ...common,
      prompt: tillDec ? `Vilket decimaltal är lika mycket som ${b.a}/${b.d}?` : `Vilket bråk är lika mycket som ${t}?`,
      view: {
        component: "sammansatt",
        delar: [
          ...(tillDec && stav ? [{ view: stav }] : []),
          { view: { component: "kort", cards }, svar: true, label: "Välj ett kort" },
        ],
      },
      answer: { type: "choice", options: cards.map((c) => c.id) },
      key: {
        type: "choice", correct: ratt,
        display: tillDec ? `${b.a}/${b.d} = ${t}` : `${t} = ${b.a}/${b.d}`,
        examples: { right: [{ id: ratt }], wrong: cards.filter((c) => c.id !== ratt).map((c) => ({ id: c.id })) },
      },
    };
  },

  reserve: [
    { slot: "matcha", params: { typ: "matcha", kort: [[3, 4, "brak"], [7, 20, "dec"], [3, 5, "dec"], [7, 20, "brak"], [3, 4, "dec"], [3, 5, "brak"]].map(([a, d, form]) => ({ a, d, form })) } },
    { slot: "matcha", params: { typ: "matcha", kort: [[1, 2, "dec"], [1, 4, "brak"], [1, 5, "dec"], [1, 2, "brak"], [1, 5, "brak"], [1, 4, "dec"]].map(([a, d, form]) => ({ a, d, form })) } },
    { slot: "matcha", params: { typ: "matcha", kort: [[3, 2, "brak"], [9, 10, "dec"], [6, 25, "dec"], [9, 10, "brak"], [6, 25, "brak"], [3, 2, "dec"]].map(([a, d, form]) => ({ a, d, form })) } },
    { slot: "skriv-dec", params: { typ: "skriv-dec", a: 3, d: 4 } },
    { slot: "skriv-dec", params: { typ: "skriv-dec", a: 7, d: 20 } },
    { slot: "skriv-dec", params: { typ: "skriv-dec", a: 5, d: 4 } },
    { slot: "skriv-brak", params: { typ: "skriv-brak", a: 3, d: 5 } },
    { slot: "skriv-brak", params: { typ: "skriv-brak", a: 9, d: 25 } },
    { slot: "skriv-brak", params: { typ: "skriv-brak", a: 1, d: 2 } },
    { slot: "valj", params: { typ: "valj", riktning: "till-dec", a: 3, d: 4, alt: [{ t: "0,34" }, { ratt: true }, { t: "3,4" }, { t: "0,3" }] } },
    { slot: "valj", params: { typ: "valj", riktning: "till-brak", a: 3, d: 5, alt: [{ n: 1, d: 6 }, { n: 6, d: 100 }, { ratt: true }, { n: 60, d: 1000 }] } },
  ],
});
