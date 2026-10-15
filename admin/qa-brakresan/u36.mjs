// 36. Räkna över en hel – egna kontroller · #712
// Nämnare 2–8, gemensam nämnare ≤ 12, värden 0–3, additionerna går över en hel,
// subtraktionerna bryter en hel; blandad form krävs (oförkortad bråkdel godtas),
// bråkform avvisas med egen förklaring, stavens markering i valfri konfiguration.
import { q, add, sub, lcm, cmp, eq } from "../../src/brakresan/math/index.js";
import { createRng } from "../../src/brakresan/schema/prng.js";

const v = (t) => add(q(t.W), q(t.x, t.n));
const svar = (sel, fields) => ({ parts: { stav: { selected: sel }, svar: { fields } } });

export function audit(task, { grade }) {
  const p = [];
  const { op, A, B } = task.params;
  const L = lcm(A.n, B.n);
  if ([A.n, B.n].some((n) => n < 2 || n > 8) || L > 12) p.push(`nämnarna ${A.n}, ${B.n} utanför ramen`);
  const R = op === "+" ? add(v(A), v(B)) : sub(v(A), v(B));
  if (cmp(v(A), q(3)) > 0 || cmp(v(B), q(3)) > 0 || cmp(R, q(3)) > 0 || R.n <= 0 || R.d === 1) p.push("värden utanför 0–3 eller heltalsresultat");
  if (op === "+" && cmp(R, q(1)) <= 0) p.push("additionen går inte över en hel");
  if (op === "−" && cmp(q(B.x, B.n), q(A.x, A.n)) <= 0) p.push("subtraktionen kräver ingen uppbrytning");
  if (!eq(task.key.parts.svar.value, R)) p.push("facit stämmer inte");
  const RL = (R.n * L) / R.d;
  const delar = task.answer.parts.stav.parts;
  if (delar.length !== 3 * L) p.push("stavarna har fel antal delar");
  const sel = createRng(`u36-${task.core}`).sample(delar, RL);
  const W = Math.floor(R.n / R.d);
  const rest = R.n - W * R.d;
  const ok = [[W ? String(W) : "", rest, R.d], [W ? String(W) : "", (rest * L) / R.d, L]];
  for (const [w, n, d] of ok) {
    const r = grade(task, svar(sel, { whole: w, n: String(n), d: String(d) }));
    if (!r.correct) p.push(`${w} ${n}/${d} underkändes`);
  }
  if (W >= 1) {
    const r = grade(task, svar(sel, { whole: "", n: String(RL), d: String(L) }));
    if (r.correct || r.reason !== "ej-blandad") p.push("bråkform ska avvisas med formförklaring");
  }
  if (grade(task, svar(sel.slice(1), { whole: W ? String(W) : "", n: String(rest), d: String(R.d) })).correct) p.push("fel antal delar godkändes");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const plus = tasks.filter((t) => t.params.op === "+").length;
    const over = tasks.filter((t) => cmp(t.key.parts.svar.value, q(1)) > 0).length;
    const bryt = tasks.filter((t) => t.params.op === "−").length;
    if (plus !== 5) p.push("inte fem additioner");
    if (over < 4) p.push("färre än fyra resultat större än 1");
    if (bryt < 3) p.push("färre än tre subtraktioner som bryter en hel");
  }
  return [...new Set(p)];
}
