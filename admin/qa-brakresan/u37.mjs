// 37. Multiplicera med heltal – egna kontroller · #712
// k 2–5, a/n med n 2–8, produkt ≤ 4; k · a delar på stavarna; likvärdiga svar
// godtas (bråk, blandad form, förlängt), "multiplicerar nämnaren" avvisas.
import { q, mul, cmp, eq } from "../../src/brakresan/math/index.js";

const falt = (n, d, whole = "") => ({ fields: { whole, n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { k, a, n } = task.params;
  const P = mul(q(k), q(a, n));
  if (k < 2 || k > 5 || n < 2 || n > 8 || a >= n || cmp(P, q(4)) > 0) p.push(`${k}·${a}/${n} utanför ramen`);
  if (!eq(task.key.parts.svar.value, P)) p.push("facit stämmer inte");
  const delar = task.answer.parts.stav.parts;
  if (delar.length !== k * n) p.push("en stavram per kopia saknas");
  const sel = delar.filter((_, i) => i % n < a); // en portion i varje ram
  const W = Math.floor(P.n / P.d);
  const ratt = [falt(k * a, n), falt(2 * k * a, 2 * n), P.d === 1 ? falt("", "", String(W)) : falt(P.n - W * P.d, P.d, W ? String(W) : "")];
  for (const s of ratt) if (!grade(task, { parts: { stav: { selected: sel }, svar: s } }).correct) p.push(`likvärdigt svar ${JSON.stringify(s)} underkändes`);
  if (grade(task, { parts: { stav: { selected: sel }, svar: falt(k * a, k * n) } }).correct) p.push("multiplicerad nämnare godkändes");
  if (grade(task, { parts: { stav: { selected: sel.slice(1) }, svar: falt(k * a, n) } }).correct) p.push("för få byggda delar godkändes");
  if (task.params.situation && !/meter|liter/.test(task.prompt)) p.push("vardagsproblemet saknar längd eller volym");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (tasks.filter((t) => /meter|liter/.test(t.prompt)).length < 2) p.push("färre än två vardagsproblem med längd eller volym");
  return [...new Set(p)];
}
