// 13. Dela bråkstaven – egna kontroller · #710
// n 2–6, k 2–4, n·k ≤ 24; rätt kräver både delningen k och a·k/n·k; odelad stav
// är ofullständig (inte fel); samma värde i annan form avvisas; omdelningen
// bevarar markerad längd (geometri.omdela).
import { omdela } from "../../src/brakresan/komponenter/geometri.js";

const falt = (x, y) => ({ fields: { n: String(x), d: String(y) } });

export function audit(task, { grade }) {
  const p = [];
  const { a, n, k } = task.params;
  if (n < 2 || n > 6 || a < 1 || a >= n || k < 2 || k > 4 || n * k > 24) p.push(`${a}/${n}, k=${k} utanför ramen`);
  const bar = task.view.bars[0];
  if (bar.parts !== n || bar.marked !== a || bar.svar !== "k" || bar.maxDela < k) p.push("stavens data stämmer inte");
  for (let kk = 2; kk <= 4; kk++) {
    const r = grade(task, { parts: { k: { text: String(kk) }, ny: falt(a * k, n * k) } });
    if (r.status !== "graded" || r.correct !== (kk === k)) p.push(`delning ${kk} bedömdes ${r.status}/${r.correct}`);
  }
  if (grade(task, { parts: { k: { text: "1" }, ny: falt(a * k, n * k) } }).status !== "invalid") p.push("odelad stav ska vara ofullständig");
  for (const [x, y] of [[a, n], [a * k * 2, n * k * 2], [a, n * k]]) {
    if (x === a * k && y === n * k) continue;
    const r = grade(task, { parts: { k: { text: String(k) }, ny: falt(x, y) } });
    if (r.status !== "graded" || r.correct) p.push(`${x}/${y} godkändes`);
  }
  // Omdelningen: markerad längd oförändrad (a/n = a·k/n·k), nya delar = n·k.
  const o = omdela(n, Array.from({ length: a }, (_, i) => `p${i}`), k);
  if (o.parts !== n * k || o.markerade.length !== a * k) p.push("omdelningen ändrar den markerade längden");
  return p;
}
