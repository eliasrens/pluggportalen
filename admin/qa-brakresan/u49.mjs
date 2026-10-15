// 49. Rabatter och procentproblem – egna kontroller · #712
// Priser 40–800 kr, 10/20/25/50 %, hela kronor; svaret är det som efterfrågas
// (rabatten, nya priset, priset efter höjning) – förväxlingen avvisas.
import { discount, increase } from "../../src/brakresan/math/index.js";

export function audit(task, { grade }) {
  const p = [];
  const { typ, pris, p: pr } = task.params;
  if (pris < 40 || pris > 800 || ![10, 20, 25, 50].includes(pr)) p.push("utanför ramen");
  const d = discount(pris, pr);
  const o = increase(pris, pr);
  if (d.discount.d !== 1) p.push("rabatten är inte hela kronor");
  const ratt = typ === "rabatt" ? d.discount.n : typ === "nytt" ? d.newPrice.n : o.newPrice.n;
  const fel = typ === "rabatt" ? d.newPrice.n : d.discount.n;
  if (!grade(task, { text: String(ratt) }).correct) p.push("rätt belopp underkändes");
  if (fel !== ratt && grade(task, { text: String(fel) }).correct) p.push("förväxlat belopp godkändes");
  if (/moms|ränta/.test(task.prompt)) p.push("utanför standardläget");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const n = (typ) => tasks.filter((t) => t.params.typ === typ).length;
    if (n("rabatt") !== 4 || n("nytt") !== 4 || n("okning") !== 2) p.push("blandningen 4/4/2 stämmer inte");
  }
  return [...new Set(p)];
}
