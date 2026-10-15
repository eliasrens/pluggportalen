// 21. Förkorta bråket – egna kontroller · #711
// Talgränserna, enklaste form, ofärdig förkortning = fel med egen förklaring,
// verktygets gruppstorlekar (delare av n) och stavens färgade andel.
import { q, eq, gcd } from "../../src/brakresan/math/index.js";
import { gruppstorlekar } from "../../src/brakresan/utmaningar/u21.js";

const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { p: tp, q: tq, k } = task.params;
  const n = tq * k;
  const a = tp * k;
  if (tq < 2 || tq > 10 || gcd(tp, tq) !== 1 || tp >= tq) p.push(`basbråket ${tp}/${tq} är inte förkortat och äkta med nämnare 2–10`);
  if (k < 2 || k > 5 || n > 40) p.push(`faktorn ${k} eller nämnaren ${n} är utanför ramen`);
  const s = task.view.stavar[0];
  if (s.parts !== n || s.marked !== a) p.push("staven visar inte uppgiftens bråk");
  if (!eq(q(s.marked, s.parts), q(tp, tq))) p.push("stavens färgade andel ≠ svaret");
  const g = gruppstorlekar(n);
  if (!g.includes(k) || g.some((x) => n % x !== 0 || x < 2 || x >= n)) p.push("verktygets gruppstorlekar är fel");
  const r = grade(task, falt(tp, tq));
  if (!r.correct) p.push("enklaste formen underkändes");
  const start = grade(task, falt(a, n));
  if (start.correct || start.reason !== "ej-enklaste") p.push("ursprungsbråket ska vara fel med förklaringen ej-enklaste");
  for (let d = 2; d < k; d++) {
    if (k % d) continue;
    const halv = grade(task, falt(a / d, n / d));
    if (halv.correct || halv.reason !== "ej-enklaste") p.push(`ofärdig förkortning ${a / d}/${n / d} ska vara ej-enklaste`);
  }
  if (grade(task, falt(tp, 0)).status !== "invalid") p.push("nämnaren 0 ska vara inmatningsfel");
  return p;
}
