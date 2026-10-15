// ============================================================================
// 25. Olika nämnare (src/brakresan/utmaningar/u25.js) · #711 F
// ----------------------------------------------------------------------------
// Spec §8 25: jämför a/n och b/m med olika delstorlek. Eleven väljer <, = eller
// >; i tre uppgifter (slots "…-r") väljer eleven dessutom det korrekta
// resonemanget – båda delarna krävs (multi, en poäng, inga dolda delpoäng).
//   • äkta bråk med nämnare 2–10, n ≠ m, gemensam nämnare ≤ 24
//   • sorterna: via en halv (ena < 1/2 < andra), en nämnare multipel av den
//     andra, allmän omdelning, likvärdiga (2/6 = 3/9 – lika med)
//   • felresonemangen fångar "störst nämnare", "störst täljare", additiv
//     omskrivning och "det går inte att jämföra olika stora delar"
// Bilden (två lika långa stavar med verktyget "Dela varje bit i k") syns bara
// medan hjälpen är öppen (view.stavar[].iHjalp): lika långa stavar avslöjar
// annars svaret direkt (Elias, #709). Ingen korsmultiplikation som förklaring.
// ============================================================================

import { defineChallenge } from "../schema/kontrakt.js";
import { gradeWith } from "../schema/bedomning.js";
import { q, gcd, lcm, relation, RELATION_WORDS } from "../math/index.js";
import { brak, versal } from "./f-delat.js";

const MAX_L = 24;
const SLOTS = ["halv", "multipel", "likvardig", "omdelning", "multipel", "halv-r", "omdelning-r", "omdelning", "likvardig-r", "halv"];

const ALLA = [];
for (let n = 2; n <= 10; n++) {
  for (let m = 2; m <= 10; m++) {
    if (n === m || lcm(n, m) > MAX_L) continue;
    for (let a = 1; a < n; a++) {
      for (let b = 1; b < m; b++) {
        const A = q(a, n);
        const B = q(b, m);
        const rel = relation(A, B);
        const red = gcd(a, n) === 1 && gcd(b, m) === 1;
        const halv = relation(A, q(1, 2)) !== "=" && relation(B, q(1, 2)) !== "=" && relation(A, q(1, 2)) !== relation(B, q(1, 2));
        const multipel = n % m === 0 || m % n === 0;
        let sort = null;
        if (rel === "=") sort = a !== b ? "likvardig" : null;
        else if (!red) sort = null;
        else if (halv) sort = "halv";
        else if (multipel) sort = "multipel";
        else sort = "omdelning";
        if (sort) ALLA.push({ a, n, b, m, sort });
      }
    }
  }
}
export { ALLA as PAR25 };

const OP = { "<": "<", "=": "=", ">": ">" };

/** Resonemangen: ett korrekt och tre felaktiga, i en ordning som generatorn blandar. */
function resonemang({ a, n, b, m, sort }) {
  const L = lcm(n, m);
  const x = (a * L) / n;
  const y = (b * L) / m;
  const rel = relation(q(a, n), q(b, m));
  const ratt = sort === "halv"
    ? `${a}/${n} är ${rel === "<" ? "mindre" : "mer"} än en halv och ${b}/${m} är ${rel === "<" ? "mer" : "mindre"} än en halv.`
    : sort === "likvardig"
      ? `Med lika stora bitar blir båda lika: ${a}/${n} = ${x}/${L} och ${b}/${m} = ${y}/${L}.`
      : `Med lika stora bitar: ${a}/${n} = ${x}/${L} och ${b}/${m} = ${y}/${L}.`;
  const storstNamnare = n > m ? `${a}/${n}` : `${b}/${m}`;
  const storstTaljare = a > b ? `${a}/${n}` : `${b}/${m}`;
  const fel = [
    { id: "namnare", text: `${storstNamnare} är störst, eftersom nämnaren är störst.`, tag: "storst-namnare" },
    a !== b
      ? { id: "taljare", text: `${storstTaljare} är störst, eftersom täljaren är störst.`, tag: "storst-taljare" }
      : { id: "taljare", text: "De är lika stora, eftersom täljarna är lika.", tag: "storst-taljare" },
    // Additiv omskrivning till samma nämnare: lägger till samma tal uppe och nere.
    { id: "additiv", text: `Med samma nämnare: ${a}/${n} = ${a + L - n}/${L} och ${b}/${m} = ${b + L - m}/${L}.`, tag: "additiv-omskrivning" },
    { id: "olika", text: "Det går inte att jämföra, eftersom bitarna är olika stora.", tag: "olika-helheter" },
  ];
  // Lika bråk: "går inte att jämföra" är den vanliga missen; annars additiv omskrivning.
  const prio = sort === "likvardig" ? ["namnare", "taljare", "olika", "additiv"] : ["namnare", "taljare", "additiv", "olika"];
  const valda = prio.map((id) => fel.find((f) => f.id === id)).filter((f) => f.text !== ratt);
  return { ratt: { id: "ratt", text: ratt }, fel: valda.slice(0, 3) };
}

/** Egen bedömning: relationen (och resonemanget i -r-uppgifter) – multi utan dolda delpoäng. */
function validate(task, answer) {
  if (task.answer.type !== "multi") return gradeWith(task.answer, task.key, answer);
  const rel = gradeWith(task.answer.parts.rel, task.key.parts.rel, answer?.parts?.rel);
  if (rel.status === "invalid") return { ...rel, part: "rel" };
  const varfor = gradeWith(task.answer.parts.varfor, task.key.parts.varfor, answer?.parts?.varfor);
  if (varfor.status === "invalid") return { ...varfor, part: "varfor", message: "Välj också varför." };
  const correct = rel.correct && varfor.correct;
  return {
    status: "graded", correct, reason: correct ? null : !rel.correct ? "fel-relation" : "fel-resonemang",
    message: correct ? null : !rel.correct ? null : "Tecknet stämmer, men resonemanget gör det inte. Vilket påstående är sant?",
    parts: { rel: rel.correct, varfor: varfor.correct },
  };
}

export default defineChallenge({
  id: "25",
  version: 1,
  slots: SLOTS,

  generate(rng, { slot }) {
    const [sort, r] = slot.split("-");
    const par = rng.pick(ALLA.filter((p) => p.sort === sort));
    const vand = rng.chance(0.5); // vilket bråk står först
    const p = vand ? { a: par.b, n: par.m, b: par.a, m: par.n, sort } : { a: par.a, n: par.n, b: par.b, m: par.m, sort };
    if (!r) return p;
    const { fel } = resonemang(p);
    return { ...p, ordning: rng.shuffle(["ratt", ...fel.map((f) => f.id)]) };
  },

  core: ({ a, n, b, m, ordning }) => `${a}/${n}?${b}/${m}${ordning ? "+r" : ""}`,

  build(params) {
    const { a, n, b, m, ordning = null } = params;
    const L = lcm(n, m);
    const x = (a * L) / n;
    const y = (b * L) / m;
    const rel = relation(q(a, n), q(b, m));
    const relText = `${a}/${n} ${OP[rel]} ${b}/${m}`;
    const rs = ordning ? resonemang(params) : null;
    const alt = rs ? Object.fromEntries([rs.ratt, ...rs.fel].map((o) => [o.id, o])) : null;
    const options = rs ? ordning.map((id, i) => ({ id: `r${i + 1}`, text: alt[id].text, kalla: id })) : null;
    const rattId = options?.find((o) => o.kalla === "ratt").id;
    const relSpec = { type: "relation" };
    const relKey = { type: "relation", correct: rel };
    const andra = ["<", "=", ">"].filter((r) => r !== rel);
    const view = {
      component: "verkstad",
      stavar: [
        { id: "s1", parts: n, marked: a, namn: brak(a, n), helhet: "Hela staven = 1", verktyg: ["dela"], maxDela: Math.floor(MAX_L / n), iHjalp: true },
        { id: "s2", parts: m, marked: b, namn: brak(b, m), helhet: "Hela staven = 1", verktyg: ["dela"], maxDela: Math.floor(MAX_L / m), iHjalp: true },
      ],
      expr: [brak(a, n), { relation: "rel" }, brak(b, m)],
      ...(options ? { fragor: [{ id: "varfor", text: "Varför? Välj det som stämmer.", options: options.map(({ id, text }) => ({ id, text })) }] } : {}),
    };
    const answer = options
      ? { type: "multi", parts: { rel: relSpec, varfor: { type: "choice", options: options.map((o) => o.id) } } }
      : relSpec;
    const key = options
      ? { type: "multi", parts: { rel: relKey, varfor: { type: "choice", correct: rattId } } }
      : relKey;
    const felId = options?.find((o) => o.kalla !== "ratt").id;
    const examples = options
      ? {
        right: [{ parts: { rel: { value: rel }, varfor: { id: rattId } } }],
        wrong: [
          { parts: { rel: { value: andra[0] }, varfor: { id: rattId } } },
          { parts: { rel: { value: rel }, varfor: { id: felId } } },
          { parts: { rel: { value: andra[1] }, varfor: { id: felId } } },
        ],
      }
      : { right: [{ value: rel }], wrong: andra.map((v) => ({ value: v })) };
    const ex = [n, m].includes(3) && [n, m].includes(4) ? { a: 1, n: 2, b: 3, m: 5 } : { a: 2, n: 3, b: 3, m: 4 };
    const exL = lcm(ex.n, ex.m);
    const forklaring = rel === "="
      ? `${a}/${n} = ${x}/${L} och ${b}/${m} = ${y}/${L}: lika många lika stora bitar.`
      : `${a}/${n} = ${x}/${L} och ${b}/${m} = ${y}/${L}. ${Math.max(x, y)} ${L}-delar är mer än ${Math.min(x, y)}.`;
    return {
      core: `${a}/${n}?${b}/${m}${ordning ? "+r" : ""}`,
      prompt: options ? `Jämför ${a}/${n} och ${b}/${m}. Välj tecken och varför.` : `Jämför ${a}/${n} och ${b}/${m}. Välj <, = eller >.`,
      values: { A: q(a, n), B: q(b, m), lcd: L },
      view,
      answer,
      key: {
        ...key,
        display: options ? `${relText}. ${alt.ratt.text}` : relText,
        examples,
      },
      help: [
        { step: "orientering", text: "Båda stavarna är lika långa: hela staven = 1. Bitarna är olika stora, så antalet bitar säger inte allt.", highlight: { whole: true, stavar: true } },
        { step: "princip", text: "Kan vi beskriva båda med lika stora bitar? Dela varje bit i lika många nya bitar – då ändras inte hur mycket som är färgat. Du kan också jämföra med en halv.", highlight: { stavar: true } },
        {
          step: "modellering",
          text: `Ett exempel med andra tal: ${ex.a}/${ex.n} och ${ex.b}/${ex.m}. Med ${exL}-delar blir det ${(ex.a * exL) / ex.n}/${exL} och ${(ex.b * exL) / ex.m}/${exL}. ` +
            "Nu är bitarna lika stora, och det går att räkna vilket som har flest.",
          view: { component: "stav", bars: [{ parts: exL, marked: (ex.a * exL) / ex.n }, { parts: exL, marked: (ex.b * exL) / ex.m }] },
          highlight: { stavar: true },
        },
        { step: "atergang", text: "Nu provar du själv: dela stavarna tills bitarna är lika stora, och jämför.", highlight: { stavar: true } },
      ],
      misconceptions: ["storst-namnare", "storst-taljare", "additiv-omskrivning", "olika-helheter"],
      feedback: {
        correct: `Ja! ${versal(`${a}/${n} ${RELATION_WORDS[rel]} ${b}/${m}`)}. ${forklaring}`,
        wrong: `Gör bitarna lika stora först: ${forklaring}`,
      },
      review: `${relText}. ${forklaring}`,
    };
  },

  validate,

  reserve: [
    { slot: "halv", params: { a: 1, n: 3, b: 3, m: 4, sort: "halv" } },
    { slot: "halv", params: { a: 5, n: 8, b: 2, m: 6, sort: "halv" } },
    { slot: "multipel", params: { a: 3, n: 4, b: 5, m: 8, sort: "multipel" } },
    { slot: "multipel", params: { a: 2, n: 3, b: 5, m: 6, sort: "multipel" } },
    { slot: "likvardig", params: { a: 2, n: 6, b: 3, m: 9, sort: "likvardig" } },
    { slot: "likvardig", params: { a: 2, n: 4, b: 3, m: 6, sort: "likvardig" } },
    { slot: "omdelning", params: { a: 2, n: 3, b: 3, m: 5, sort: "omdelning" } },
    { slot: "omdelning", params: { a: 3, n: 4, b: 5, m: 6, sort: "omdelning" } },
    { slot: "halv-r", params: { a: 2, n: 5, b: 4, m: 6, sort: "halv", ordning: ["namnare", "ratt", "additiv", "taljare"] } },
    { slot: "omdelning-r", params: { a: 3, n: 4, b: 2, m: 3, sort: "omdelning", ordning: ["taljare", "additiv", "namnare", "ratt"] } },
    { slot: "likvardig-r", params: { a: 4, n: 6, b: 6, m: 9, sort: "likvardig", ordning: ["ratt", "olika", "taljare", "namnare"] } },
  ],
});
