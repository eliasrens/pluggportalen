// 14. Förläng bråket – egna kontroller · #710
// b 2–10 förkortat, faktor 2–5, målnämnare ≤ 40; rätt kräver faktor och nämnaren b·f;
// likvärdigt bråk med annan nämnare avvisas med formförklaring.
import { q } from "../../src/brakresan/math/index.js";

const falt = (x, y) => ({ fields: { n: String(x), d: String(y) } });

export function audit(task, { grade }) {
  const p = [];
  const { a, b, f } = task.params;
  const B = b * f;
  if (b < 2 || b > 10 || q(a, b).d !== b || f < 2 || f > 5 || B > 40) p.push(`${a}/${b}·${f} utanför ramen`);
  if (!grade(task, { parts: { faktor: { text: String(f) }, svar: falt(a * f, B) } }).correct) p.push("rätt svar underkändes");
  const r = grade(task, { parts: { faktor: { text: String(f) }, svar: falt(a, b) } });
  if (r.status !== "graded" || r.correct || r.reason !== "fel-namnare") p.push("förkortat svar ska vara fel med formförklaring");
  for (let g = 2; g <= 5; g++) {
    if (g === f) continue;
    if (grade(task, { parts: { faktor: { text: String(g) }, svar: falt(a * f, B) } }).correct) p.push(`faktor ${g} godkändes`);
  }
  if (grade(task, { parts: { faktor: { text: "" }, svar: falt(a * f, B) } }).status !== "invalid") p.push("tom faktor ska vara inmatningsfel");
  if (grade(task, { parts: { faktor: { text: String(f) }, svar: falt(a * f, 0) } }).status !== "invalid") p.push("nämnare 0 ska vara inmatningsfel");
  if (!task.view.visaStav) p.push("staven ska vara frivillig");
  return p;
}
