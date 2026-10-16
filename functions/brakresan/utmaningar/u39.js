// ============================================================================
// 39. Decimaler på bild (src/brakresan/utmaningar/u39.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 39: tiondelar, hundradelar och positionsvärde i hundrarutan
// (1 rad = 0,1, 1 ruta = 0,01). Fast blandning per omgång:
//   • tre MÅLA: måla decimalen (antal rutor, vilka som helst; över 1 = två
//     hundrarutor). En av dem är "mala-noll" (0,0x eller 0,x) – 0,5 mot 0,05.
//   • tre LÄSA: hundrarutan visar talet, eleven skriver decimalen
//     (komma eller punkt, slutnolla godtas).
//   • två JÄMFÖR: 0,3 och 0,30 (lika) eller "längre är inte större" (0,3 och
//     0,25); och 0,5 mot 0,05 (tiondelar mot hundradelar).
//   • två BYGG: hela + tiondelar + hundradelar → decimalen (ibland i annan
//     ordning, utan hela, eller med fler än nio hundradelar).
// Generering: 0–2, högst två decimaler. Ingen etikett avslöjar målet.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { q } from "../math/index.js";
import { ids, text, dec, decText, nd } from "./delat-g.js";

const SLOTS = ["mala", "las", "bygg", "jamfor-lika", "mala-noll", "las", "jamfor-noll", "bygg", "mala", "las"];

const dtext = (h, places = 0) => decText(q(h, 100), places);
const delarAv = (h) => ({ W: Math.floor(h / 100), t: Math.floor(h / 10) % 10, u: h % 10 });
/** "3 rader och 7 rutor" – hur talet syns i hundrarutan. */
function bild(h) {
  const { W, t, u } = delarAv(h);
  const del = [W ? `${W} ${W === 1 ? "hel hundraruta" : "hela hundrarutor"}` : null, t ? `${t} ${t === 1 ? "rad" : "rader"}` : null,
    u ? `${u} ${u === 1 ? "ruta" : "rutor"}` : null].filter(Boolean);
  return del.length > 1 ? `${del.slice(0, -1).join(", ")} och ${del.at(-1)}` : del[0];
}

/** Exempel i hjälpen med ett annat tal. */
const exempel = (h) => [46, 28, 73].find((x) => x !== h && x !== (h % 100));

function kärna(p) {
  if (p.typ === "jamfor") return `jamfor:${dtext(p.A.h, p.A.places)}|${dtext(p.B.h, p.B.places)}`;
  if (p.typ === "bygg") return `bygg:${p.W}|${p.t}|${p.u}|${p.ordning}`;
  return `${p.typ}:${p.h}`;
}

export default defineChallenge({
  id: "39",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    if (slot === "mala" || slot === "las") {
      const over = rng.chance(0.3);
      return { typ: slot, h: over ? rng.int(101, 199) : rng.int(1, 99) };
    }
    if (slot === "mala-noll") {
      const d = rng.int(1, 9);
      return { typ: "mala", h: rng.chance(0.5) ? d : 10 * d };
    }
    if (slot === "jamfor-lika") {
      const t = rng.int(1, 9);
      const W = rng.chance(0.3) ? 1 : 0;
      if (rng.chance(0.5)) return { typ: "jamfor", A: { h: 100 * W + 10 * t, places: 1 }, B: { h: 100 * W + 10 * t, places: 2 } };
      // "Fler siffror är inte större": 0,3 mot 0,25 (eller 0,28 …).
      const u = rng.int(1, 9);
      const A = { h: 100 * W + 10 * t, places: 1 };
      const B = { h: 100 * W + 10 * rng.int(0, t - 1) + u, places: 2 };
      return { typ: "jamfor", ...(rng.chance(0.5) ? { A, B } : { A: B, B: A }) };
    }
    if (slot === "jamfor-noll") {
      const d = rng.int(1, 9);
      const W = rng.chance(0.3) ? 1 : 0;
      const A = { h: 100 * W + 10 * d, places: 1 };
      const B = { h: 100 * W + d, places: 2 };
      return { typ: "jamfor", ...(rng.chance(0.5) ? { A, B } : { A: B, B: A }) };
    }
    // bygg
    const W = rng.pick([0, 1, 1]);
    const t = rng.int(0, 9);
    const u = rng.chance(0.25) && t < 9 ? rng.int(10, 19) : rng.int(1, 9);
    const ordning = rng.chance(0.3) ? "baklanges" : "vanlig";
    return { typ: "bygg", W, t, u, ordning };
  },

  core: kärna,

  build(p) {
    const core = kärna(p);
    const rad = { component: "hundraruta" };
    if (p.typ === "jamfor") {
      const a = q(p.A.h, 100);
      const b = q(p.B.h, 100);
      const rel = p.A.h === p.B.h ? "=" : p.A.h < p.B.h ? "<" : ">";
      const ta = dtext(p.A.h, p.A.places);
      const tb = dtext(p.B.h, p.B.places);
      const ovriga = ["<", "=", ">"].filter((r) => r !== rel);
      const ex = [[7, 70], [4, 40], [6, 60]].find(([x]) => x !== p.A.h % 10 && x * 10 !== p.A.h % 100 && x !== p.B.h % 10 && x * 10 !== p.B.h % 100);
      return {
        core,
        prompt: "Jämför talen. Välj <, = eller >.",
        values: { A: nd(a), B: nd(b) },
        view: { component: "notation", expr: [dec(a, p.A.places), { relation: true }, dec(b, p.B.places)] },
        answer: { type: "relation" },
        key: {
          type: "relation", correct: rel,
          display: `${ta} ${rel} ${tb}`,
          examples: { right: [{ value: rel }], wrong: ovriga.map((value) => ({ value })) },
        },
        help: [
          { step: "orientering", text: "Tänk dig båda talen i hundrarutan, där hela rutan är 1." },
          { step: "princip", text: "Första siffran efter kommat räknar tiondelar (hela rader), andra siffran hundradelar (enstaka rutor). En tiondel är tio hundradelar. Fler siffror betyder inte ett större tal." },
          {
            step: "modellering",
            text: `Ett exempel med andra tal: 0,${ex[0]} är ${ex[0]} rader = ${ex[1]} rutor. 0,0${ex[0]} är bara ${ex[0]} rutor.`,
            view: { ...rad, marked: ex[1] },
          },
          { step: "atergang", text: "Nu provar du själv: hur många hundradelar (rutor) är varje tal?" },
        ],
        misconceptions: ["fler-siffror-ar-storre", "slutnolla-okar-vardet", "tiondel-hundradel-forvaxling"],
        feedback: {
          correct: `Ja! ${ta} är ${p.A.h} hundradelar och ${tb} är ${p.B.h} hundradelar: ${ta} ${rel} ${tb}.`,
          wrong: `Skriv båda som hundradelar: ${ta} = ${p.A.h} rutor och ${tb} = ${p.B.h} rutor i hundrarutan. Alltså ${ta} ${rel} ${tb}.`,
        },
        review: `${ta} ${rel} ${tb}: ${ta} är ${bild(p.A.h)} och ${tb} är ${bild(p.B.h)}.${p.A.h === p.B.h ? " En slutnolla ändrar inte värdet." : ""}`,
      };
    }

    if (p.typ === "bygg") {
      const h = 100 * p.W + 10 * p.t + p.u;
      const v = q(h, 100);
      const delar = [
        p.W ? { text: `${p.W} ${p.W === 1 ? "hel" : "hela"}` } : null,
        p.t ? { text: `${p.t} ${p.t === 1 ? "tiondel" : "tiondelar"}` } : null,
        { text: `${p.u} ${p.u === 1 ? "hundradel" : "hundradelar"}` },
      ].filter(Boolean);
      const ordnade = p.ordning === "baklanges" ? [...delar].reverse() : delar;
      const expr = ordnade.flatMap((d, i) => (i ? [{ op: "+" }, d] : [d]));
      const svar = dtext(h);
      // Felsvar: siffrorna i följd utan växling (3 tiondelar + 12 hundradelar → 0,312),
      // siffrorna i visningsordning (baklänges), tiondelar och hundradelar ombytta, en tiondel fel.
      const felH = [];
      if (p.u < 10 && p.u !== p.t) felH.push(100 * p.W + 10 * p.u + p.t);
      felH.push(h + 10 <= 200 ? h + 10 : h - 10);
      const felUnika = [...new Set(felH)].filter((x) => x !== h).map((x) => text(dtext(x)));
      if (p.u >= 10) felUnika.push(text(`${p.W},${p.t}${p.u}`));
      return {
        core,
        prompt: "Vilket decimaltal är det? Skriv talet.",
        values: { value: nd(v), W: p.W, t: p.t, u: p.u },
        view: { component: "notation", expr: [...expr, { op: "=" }, { input: true }] },
        answer: { type: "number", input: "decimal" },
        key: {
          type: "number", value: nd(v), requirement: { kind: "decimal" },
          display: `${delar.map((d) => d.text).join(" + ")} = ${svar}`,
          examples: { right: [text(svar), text(svar.replace(",", ".")), ...(svar.includes(",") && svar.split(",")[1].length === 1 ? [text(`${svar}0`)] : [])], wrong: felUnika },
        },
        help: [
          { step: "orientering", text: "Hela står före kommat. Första platsen efter kommat är tiondelar, andra platsen hundradelar." },
          { step: "princip", text: "En tiondel är tio hundradelar. Har du tio hundradelar eller fler kan du växla dem till tiondelar." },
          {
            step: "modellering",
            text: "Ett exempel med andra tal: 1 hel + 2 tiondelar + 15 hundradelar. 15 hundradelar = 1 tiondel och 5 hundradelar, så talet är 1,35.",
            view: { ...rad, wholes: 2, marked: 135 },
          },
          { step: "atergang", text: "Nu provar du själv: ställ delarna på rätt plats – hela, tiondelar, hundradelar." },
        ],
        misconceptions: ["siffror-i-foljd", "positionsvarde", "vaxlar-inte"],
        feedback: {
          correct: `Ja! ${delar.map((d) => d.text).join(" + ")} = ${svar}.`,
          wrong: `Lägg varje del på sin plats: ${bild(h)} i hundrarutan. Det är ${h} hundradelar = ${svar}.`,
        },
        review: `${delar.map((d) => d.text).join(" + ")} = ${svar}${p.u >= 10 ? ` (${p.u} hundradelar = ${Math.floor(p.u / 10)} tiondel och ${p.u % 10} hundradelar)` : ""}.`,
      };
    }

    // mala / las
    const h = p.h;
    const v = q(h, 100);
    const wholes = h > 100 ? 2 : 1;
    const t = dtext(h);
    const ex = exempel(h);
    const help = [
      { step: "orientering", text: `${wholes > 1 ? "Varje hundraruta är en hel" : "Hela hundrarutan är 1"} och har 100 lika rutor. En rad är en tiondel, 0,1. En ruta är en hundradel, 0,01.`, highlight: { whole: true } },
      { step: "princip", text: "En tiondel är tio hundradelar. Siffran direkt efter kommat räknar hela rader, nästa siffra enstaka rutor.", highlight: { count: true } },
      {
        step: "modellering",
        text: `Ett exempel med ett annat tal: 0,${ex} är ${Math.floor(ex / 10)} rader och ${ex % 10} rutor – ${ex} hundradelar, alltså ${ex}/100.`,
        view: { ...rad, marked: ex },
      },
      { step: "atergang", text: p.typ === "mala" ? "Nu provar du själv: måla hela rader för tiondelarna och rutor för hundradelarna." : "Nu provar du själv: räkna hela rutor, rader och enstaka rutor." },
    ];
    const common = {
      core,
      values: { value: nd(v), hundradelar: h },
      help,
      misconceptions: ["tiondel-hundradel-forvaxling", "positionsvarde"],
      review: `${t} = ${h} hundradelar = ${h}/100: ${bild(h)}.`,
    };
    if (p.typ === "mala") {
      const delar = ids(100 * wholes);
      const fel = [h < 10 ? 10 * h : h >= 10 && h % 10 === 0 && h < 100 ? h / 10 : h + 10 <= 100 * wholes ? h + 10 : h - 10, h + 1 <= 100 * wholes ? h + 1 : h - 1]
        .filter((x, i, l) => x !== h && x > 0 && l.indexOf(x) === i);
      return {
        ...common,
        prompt: wholes > 1 ? `Måla ${t}. Varje hundraruta är en hel.` : `Måla ${t} av hundrarutan.`,
        view: { ...rad, wholes, label: wholes > 1 ? "Varje hundraruta = 1 hel = 100 rutor" : "Hela hundrarutan = 1 = 100 rutor" },
        answer: { type: "paint", parts: delar },
        key: {
          type: "paint", count: h,
          display: `${t} = ${h} rutor (${bild(h)})`,
          examples: {
            right: [{ selected: delar.slice(0, h) }, { selected: delar.slice(100 * wholes - h) }],
            wrong: fel.map((x) => ({ selected: delar.slice(0, x) })),
          },
        },
        feedback: {
          correct: `Ja! ${t} är ${bild(h)}: ${h} hundradelar.`,
          wrong: `${t} är ${h} hundradelar: ${bild(h)}. Varje hel rad är 0,1, varje ruta 0,01.`,
        },
      };
    }
    // las
    // Felsvar: tiondelar och hundradelar ombytta, antalet rutor som heltal,
    // 0,5 i stället för 0,05, de omarkerade rutorna.
    const { W, t: tio, u } = delarAv(h);
    const felH = [];
    if (u !== tio) felH.push(100 * W + 10 * u + tio);
    if (h < 10) felH.push(10 * h);
    if (h < 100) felH.push(100 - h);
    const felUnika = [...new Set(felH)].filter((x) => x !== h && x > 0).map((x) => text(dtext(x)));
    felUnika.push(text(String(h)));
    return {
      ...common,
      prompt: "Vilket decimaltal visar bilden? Skriv talet.",
      view: { ...rad, wholes, marked: h, label: wholes > 1 ? "Varje hundraruta = 1 hel = 100 rutor" : "Hela hundrarutan = 1 = 100 rutor", expr: [{ text: "Talet är" }, { input: true }] },
      answer: { type: "number", input: "decimal" },
      key: {
        type: "number", value: nd(v), requirement: { kind: "decimal" },
        display: `${t} (${h} hundradelar)`,
        examples: { right: [text(t), text(t.replace(",", ".")), text(dtext(h, 2))], wrong: felUnika },
      },
      feedback: {
        correct: `Ja! ${bild(h)} är ${h} hundradelar: ${t}.`,
        wrong: `Bilden visar ${bild(h)} – ${h} hundradelar. Det skrivs ${t}.`,
      },
    };
  },

  reserve: [
    { slot: "mala", params: { typ: "mala", h: 37 } },
    { slot: "mala", params: { typ: "mala", h: 125 } },
    { slot: "mala-noll", params: { typ: "mala", h: 5 } },
    { slot: "las", params: { typ: "las", h: 62 } },
    { slot: "las", params: { typ: "las", h: 108 } },
    { slot: "las", params: { typ: "las", h: 9 } },
    { slot: "jamfor-lika", params: { typ: "jamfor", A: { h: 30, places: 1 }, B: { h: 30, places: 2 } } },
    { slot: "jamfor-lika", params: { typ: "jamfor", A: { h: 30, places: 1 }, B: { h: 25, places: 2 } } },
    { slot: "jamfor-noll", params: { typ: "jamfor", A: { h: 50, places: 1 }, B: { h: 5, places: 2 } } },
    { slot: "bygg", params: { typ: "bygg", W: 0, t: 3, u: 7, ordning: "vanlig" } },
    { slot: "bygg", params: { typ: "bygg", W: 1, t: 4, u: 12, ordning: "baklanges" } },
  ],
});
