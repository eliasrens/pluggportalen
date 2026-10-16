// 41. Procent i hundrarutan – egna kontroller · #712
// Hela procent 0–100; målning = antal rutor (alla urval); läsning visar exakt p
// rutor och godtar "p" och "p %"; de omarkerade (100 − p) avvisas.
import { createRng } from "../../src/brakresan/schema/prng.js";

const TYNGD = [1, 10, 20, 25, 50, 75, 100];

export function audit(task, { grade }) {
  const p = [];
  const { typ, p: pr } = task.params;
  if (!Number.isInteger(pr) || pr < 0 || pr > 100) p.push("procenten är inte hel 0–100");
  if (typ === "mala") {
    if (pr < 1) p.push("tom målning går inte att lämna in");
    const sel = createRng(`u41-${task.core}`).sample(task.answer.parts, pr);
    if (!grade(task, { selected: sel }).correct) p.push("valfria rutor underkändes");
    if (pr !== 50 && grade(task, { selected: task.answer.parts.slice(0, 100 - pr) }).correct && pr !== 100 - pr) p.push("de omarkerade godkändes");
  } else {
    const m = task.view.marked;
    const antal = Array.isArray(m) ? new Set(m).size : m;
    if (antal !== pr) p.push("bilden visar fel antal rutor");
    for (const x of [String(pr), `${pr} %`]) if (!grade(task, { text: x }).correct) p.push(`${x} underkändes`);
    if (pr !== 50 && grade(task, { text: String(100 - pr) }).correct) p.push("de omarkerade godkändes");
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  let tunga = 0;
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.typ === "mala").length !== 5) p.push("inte fem målningar");
    tunga += tasks.filter((t) => TYNGD.includes(t.params.p)).length;
  }
  if (tunga < omgangar.length * 3) p.push("för lite tyngd på 1, 10, 20, 25, 50, 75, 100");
  return [...new Set(p)];
}
