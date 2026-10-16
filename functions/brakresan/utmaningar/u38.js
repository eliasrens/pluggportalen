// ============================================================================
// 38. En del av en del – EXTRA UTMANING (src/brakresan/utmaningar/u38.js) · #712 G
// ----------------------------------------------------------------------------
// Spec §8 38: bråk · bråk som andel av en andel. Areal modell (komponent 10):
// kvadraten = 1, den första andelen a/n är lodrätt randig (kolumner), raderna
// delar kvadraten i m lika delar. Eleven målar b/m AV DEN RANDIGA DELEN
// (vågrätt indelning) och skriver hur stor del av HELA kvadraten det är.
// EN uppgift, två delsvar (multi):
//   • målningen: a · b rutor, alla inuti den randiga delen (vilka som helst –
//     varje ruta har samma area). Rutor utanför = fel överlappning.
//   • andelen av hela kvadraten: ab/nm, likvärdigt bråk godtas
// Generering: två äkta bråk med nämnare 2–5, produktnämnare n · m ≤ 20.
// Återkopplingen visar varför produkten är mindre än båda faktorerna.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { q, mul, eq, fractionWords } from "../math/index.js";
import { ids, falt, nd, br } from "./delat-g.js";

/** Alla par: b/m av a/n, äkta bråk, nämnare 2–5, n · m ≤ 20. */
export const PAR = [];
for (let n = 2; n <= 5; n++) {
  for (let m = 2; m <= 5; m++) {
    if (n * m > 20) continue;
    for (let a = 1; a < n; a++) for (let b = 1; b < m; b++) PAR.push({ a, n, b, m });
  }
}

const SITUATIONER = {
  tradgard: { hel: "trädgården", forsta: "är gräsmatta", andra: "av gräsmattan klipps", fraga: "Hur stor del av hela trädgården klipps?" },
  choklad: { hel: "chokladkakan", forsta: "är mörk choklad", andra: "av den mörka delen har nötter", fraga: "Hur stor del av hela kakan är mörk choklad med nötter?" },
  aker: { hel: "åkern", forsta: "är sådd med vete", andra: "av vetet skördas i dag", fraga: "Hur stor del av hela åkern skördas i dag?" },
  vagg: { hel: "väggen", forsta: "målas blå", andra: "av den blå delen får prickar", fraga: "Hur stor del av hela väggen får blå prickar?" },
};
const SLOTS = ["intro", "intro", "intro", "normal", "normal", "normal", "normal", "overforing", "overforing", "overforing"];

const kärna = ({ a, n, b, m }) => `${b}/${m} av ${a}/${n}`;
const kol = (id, n) => Number(id.slice(1)) % n;

const MEDDELANDE = {
  utanfor: "Måla bara inuti den randiga delen – det är den du ska ta en del av.",
  "fel-antal": "Räkna rutorna i den randiga delen. Hur många av dem är andelen du ska måla?",
  "fel-andel": "Jämför med HELA kvadraten: hur många lika stora rutor har den, och hur många har du målat?",
};

/** Egen bedömning: målningen ska ligga i den randiga delen och ha rätt antal rutor. */
function validate(task, answer) {
  const { a, n } = task.params;
  const sel = answer?.parts?.mala?.selected;
  const delar = task.answer.parts.mala.parts;
  if (!Array.isArray(sel) || new Set(sel).size !== sel.length || sel.some((id) => !delar.includes(String(id)))) {
    return { status: "invalid", error: "ogiltig", message: "Måla rutor i kvadraten.", part: "mala" };
  }
  if (sel.length === 0) return { status: "invalid", error: "tom", message: "Måla rutor i den randiga delen först.", part: "mala" };
  const svar = gradeWith(task.answer.parts.svar, task.key.parts.svar, answer?.parts?.svar);
  if (svar.status === "invalid") return { ...svar, part: "svar", message: svar.error === "tom" ? "Skriv hur stor del av hela kvadraten du har målat." : svar.message };
  const inuti = sel.every((id) => kol(String(id), n) < a);
  const antal = sel.length === task.key.parts.mala.count;
  const parts = { mala: inuti && antal, svar: svar.correct };
  const reason = !inuti ? "utanfor" : !antal ? "fel-antal" : !svar.correct ? "fel-andel" : null;
  return { status: "graded", correct: !reason, reason, message: reason ? MEDDELANDE[reason] : null, parts };
}

export default defineChallenge({
  id: "38",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const pool = slot === "intro" ? PAR.filter((p) => p.b === 1 && p.n * p.m <= 12) : PAR;
    const p = rng.pick(pool);
    return { ...p, ...(slot === "overforing" ? { situation: rng.pick(Object.keys(SITUATIONER)) } : {}) };
  },

  core: kärna,
  validate,

  build({ a, n, b, m, situation = null }) {
    const P = mul(q(a, n), q(b, m));
    const ab = a * b;
    const nm = n * m;
    const delar = ids(nm);
    const randiga = delar.filter((id) => kol(id, n) < a);
    const sit = SITUATIONER[situation];
    const forsta = `${a}/${n}`;
    const andra = `${b}/${m}`;
    const kort = P.d !== nm ? ` = ${P.n}/${P.d}` : "";
    const kedja = `${andra} av ${forsta} = ${ab}/${nm}${kort}`;
    // Målningen: b rader i varje randig kolumn, eller b · a valfria randiga rutor.
    const iRader = delar.filter((id) => kol(id, n) < a && Math.floor(Number(id.slice(1)) / n) < b);
    const spridd = randiga.slice(randiga.length - ab);
    const utanfor = delar.filter((id) => kol(id, n) >= a);
    const ex = n === 2 && m === 3 ? { a: 2, n: 3, b: 1, m: 2 } : { a: 1, n: 2, b: 2, m: 3 };
    const fel = [
      { parts: { mala: { selected: iRader }, svar: falt(b, m) } }, //                       andel av den randiga delen
      { parts: { mala: { selected: iRader }, svar: falt(a + b, n + m) } }, //               adderar
      { parts: { mala: { selected: [...iRader.slice(1), utanfor[0]] }, svar: falt(ab, nm) } }, // målar utanför
      { parts: { mala: { selected: randiga.slice(0, ab === randiga.length ? ab - 1 : ab + 1) }, svar: falt(ab, nm) } },
    ].filter((x) => !(eq(q(Number(x.parts.svar.fields.n), Number(x.parts.svar.fields.d)), P) && x.parts.mala.selected.length === ab &&
      x.parts.mala.selected.every((id) => kol(id, n) < a)));
    return {
      core: kärna({ a, n, b, m }),
      prompt: sit
        ? `${forsta} av ${sit.hel} ${sit.forsta} (randigt). ${andra} ${sit.andra}. Måla den delen. ${sit.fraga}`
        : `Den randiga delen är ${forsta} av kvadraten. Måla ${andra} av den randiga delen. Hur stor del av hela kvadraten har du målat?`,
      values: { forsta: { n: a, d: n }, andra: { n: b, d: m }, produkt: nd(P) },
      view: {
        component: "sammansatt",
        delar: [
          {
            view: { component: "areamodell", vertical: { n: a, d: n }, horizontal: { n: 0, d: m }, label: sit ? `Hela ${sit.hel} = 1` : "Hela kvadraten = 1" },
            svar: "mala",
            label: `Måla ${andra} av den randiga delen`,
          },
          { view: { component: "notation", expr: [br(b, m), { text: "av" }, br(a, n), { op: "=" }, { input: "svar" }, { text: "av hela" }] }, svar: "svar" },
        ],
      },
      answer: { type: "multi", parts: { mala: { type: "paint", parts: delar }, svar: { type: "number", input: "fraction" } } },
      key: {
        type: "multi",
        parts: { mala: { type: "paint", count: ab }, svar: { type: "number", value: nd(P), requirement: { kind: "value" } } },
        display: `${kedja} (${ab} av ${nm} rutor)`,
        examples: {
          right: [
            { parts: { mala: { selected: iRader }, svar: falt(ab, nm) } },
            { parts: { mala: { selected: spridd }, svar: falt(P.n, P.d) } },
          ],
          wrong: fel,
        },
      },
      help: [
        { step: "orientering", text: `Hela kvadraten är 1. Den randiga delen är ${forsta} av den. Du ska ta en del av den randiga delen – inte av hela kvadraten.`, highlight: { whole: true, del: 0 } },
        { step: "princip", text: `Av vilken helhet tar du ${andra}? Av den randiga delen. Raderna delar den i ${m} lika delar – måla ${b} av dem i den randiga delen.` },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.b}/${ex.m} av ${ex.a}/${ex.n}. Det korsrandiga är ${ex.a * ex.b} av ${ex.n * ex.m} lika rutor av HELA kvadraten.`,
          view: { component: "areamodell", vertical: { n: ex.a, d: ex.n }, horizontal: { n: ex.b, d: ex.m } },
        },
        { step: "atergang", text: "Nu provar du själv: måla inuti den randiga delen och räkna sedan hur många lika rutor hela kvadraten har." },
      ],
      misconceptions: ["andel-av-delen-inte-helheten", "adderar-brak", "fel-helhet"],
      feedback: {
        correct: `Ja! ${kedja}. Det är mindre än både ${forsta} och ${andra}: du tog en del av en del.`,
        wrong: `${andra} av ${forsta}: måla ${b} av ${m} rader i den randiga delen. Det blir ${ab} rutor av ${nm} lika rutor i hela kvadraten = ${ab}/${nm}${kort}.`,
      },
      review: `${kedja}. Kvadraten delas i ${n} · ${m} = ${nm} lika rutor; den målade delen är ${ab} av dem. ${fractionWords(P.n, P.d).replace(/^./, (c) => c.toUpperCase())} är mindre än båda bråken, eftersom du tar en del av en del.`,
    };
  },

  reserve: [
    [1, 2, 3, 4], [1, 2, 1, 3], [1, 3, 1, 2], [3, 4, 1, 2], [2, 3, 3, 4], [2, 5, 1, 2], [3, 5, 2, 3], [1, 4, 2, 5], [4, 5, 3, 4], [2, 3, 2, 5], [3, 4, 2, 3],
  ].map(([b, m, a, n], i) => ({ slot: i < 3 ? "intro" : i >= 8 ? "overforing" : "normal", params: { a, n, b, m, ...(i >= 8 ? { situation: Object.keys(SITUATIONER)[i - 8] } : {}) } })),
});
