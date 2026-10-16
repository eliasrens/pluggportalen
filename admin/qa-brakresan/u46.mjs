// 46. Blandad storleksordning – egna kontroller · #712
// Fyra OLIKA värden 0–1, minst ett bråk, ett decimaltal och ett procenttal;
// bara stigande ordning godtas; tallinjens punkter ligger på korten värden.
import { q, eq, valueOf, sortAscending, fitsDecimals } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const kort = task.params.kort;
  const ps = kort.map((k) => k.p);
  if (new Set(ps).size !== 4 || ps.some((x) => x <= 0 || x >= 100)) p.push("värdena är inte fyra olika mellan 0 och 1");
  for (const f of ["brak", "dec", "pct"]) if (!kort.some((k) => k.form === f)) p.push(`ingen ${f}`);
  const cards = task.view.component === "sortering" ? task.view.cards : task.view.delar[0].view.cards;
  if (cards.some((c) => !fitsDecimals(valueOf(c.face), 2))) p.push("ett kort har fler än två decimaler");
  const stig = sortAscending(cards.map((c) => ({ id: c.id, v: valueOf(c.face) })), (x) => x.v).map((x) => x.id);
  const ord = (ids) => (task.answer.type === "multi" ? { parts: { ordning: { ids }, placering: { bins: task.key.examples.right[0].parts.placering.bins } } } : { ids });
  if (!grade(task, ord(stig)).correct) p.push("stigande ordning underkändes");
  if (grade(task, ord([...stig].reverse())).correct) p.push("fallande ordning godkändes");
  if (task.answer.type === "multi") {
    const tl = task.view.delar[1].view;
    for (const k of kort) {
      const pt = tl.points.find((x) => x.id === k.punkt);
      if (!pt || !eq(pt.value, q(k.p, 100)) || (k.p % 5) !== 0) p.push("en punkt ligger inte på kortets värde/ett streck");
    }
  }
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (tasks.filter((t) => t.answer.type === "multi").length !== 2) p.push("inte två tallinjeuppgifter");
  return [...new Set(p)];
}
