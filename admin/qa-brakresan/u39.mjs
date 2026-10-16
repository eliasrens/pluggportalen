// 39. Decimaler på bild – egna kontroller · #712
// 0–2 med högst två decimaler; målning = antal rutor (valfria), över 1 = två
// hundrarutor; läsning godtar komma, punkt och slutnolla; 0,5/0,05-förväxling
// avvisas; jämförelser och byggen räknas om exakt.
import { q, eq, decimalText, relation } from "../../src/brakresan/math/index.js";
import { createRng } from "../../src/brakresan/schema/prng.js";

export function audit(task, { grade }) {
  const p = [];
  const s = task.params;
  if (s.typ === "mala" || s.typ === "las") {
    if (s.h < 1 || s.h > 199) p.push("värdet utanför 0–2");
    const wholes = s.h > 100 ? 2 : 1;
    if ((task.view.wholes ?? 1) !== wholes) p.push("fel antal hundrarutor");
  }
  if (s.typ === "mala") {
    const delar = task.answer.parts;
    const sel = createRng(`u39-${task.core}`).sample(delar, s.h);
    if (!grade(task, { selected: sel }).correct) p.push("valfria rutor underkändes");
    if (s.h < 10 && grade(task, { selected: delar.slice(0, 10 * s.h) }).correct) p.push("0,5 i stället för 0,05 godkändes");
    if (task.view.label.includes(decimalText(q(s.h, 100)))) p.push("etiketten avslöjar målet");
  }
  if (s.typ === "las") {
    const t = decimalText(q(s.h, 100));
    for (const x of [t, t.replace(",", "."), decimalText(q(s.h, 100), 2)]) if (!grade(task, { text: x }).correct) p.push(`${x} underkändes`);
    if (task.view.marked !== s.h) p.push("bilden visar fel antal");
    if (grade(task, { text: String(s.h) }).correct) p.push("antalet rutor som heltal godkändes");
  }
  if (s.typ === "jamfor") {
    const rel = relation(q(s.A.h, 100), q(s.B.h, 100));
    if (task.key.correct !== rel) p.push("jämförelsen stämmer inte");
  }
  if (s.typ === "bygg") {
    const val = q(100 * s.W + 10 * s.t + s.u, 100);
    if (!eq(task.key.value, val)) p.push("bygget räknas fel");
    if (!grade(task, { text: decimalText(val) }).correct) p.push("rätt decimal underkändes");
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const n = (typ) => tasks.filter((t) => t.params.typ === typ).length;
    if (n("mala") !== 3 || n("las") !== 3 || n("jamfor") !== 2 || n("bygg") !== 2) p.push("blandningen 3/3/2/2 stämmer inte");
    // Minst två frågor prövar 0,5 mot 0,05: tiondelar mot hundradelar med samma siffra.
    const noll = tasks.filter((t) => (t.params.typ === "mala" && (t.params.h < 10 || (t.params.h % 10 === 0 && t.params.h < 100))) ||
      (t.params.typ === "jamfor" && t.params.A.h !== t.params.B.h && (t.params.A.h % 100 === 10 * (t.params.B.h % 100) || t.params.B.h % 100 === 10 * (t.params.A.h % 100)))).length;
    if (noll < 2) p.push("färre än två frågor om 0,5 mot 0,05");
  }
  return [...new Set(p)];
}
