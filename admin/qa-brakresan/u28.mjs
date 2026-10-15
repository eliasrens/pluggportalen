// 28. Blandad form – egna kontroller · #711
// Fem åt varje håll, minst två förkortningsbara rester, nämnare 2–10, heltal 1–3,
// rätt inmatningsfält, formkraven (blandad med förkortad bråkdel / bråkform).
import { gcd } from "../../src/brakresan/math/index.js";

const falt = (n, d, w) => ({ fields: { n: String(n), d: String(d), ...(w !== undefined ? { whole: String(w) } : {}) } });

export function audit(task, { grade }) {
  const p = [];
  const { riktning, n, w, r } = task.params;
  if (n < 2 || n > 10 || w < 1 || w > 3 || r < 1 || r >= n) p.push("talen är utanför ramen");
  const a = w * n + r;
  const g = gcd(r, n);
  if (riktning === "blandad") {
    if (task.answer.input !== "mixed") p.push("fel inmatningsfält");
    if (!grade(task, falt(r / g, n / g, w)).correct) p.push("rätt blandad form underkändes");
    const brak = grade(task, falt(a, n));
    if (brak.correct || brak.reason !== "ej-blandad") p.push("bråkform ska vara ej-blandad");
    if (g > 1) {
      const ofork = grade(task, falt(r, n, w));
      if (ofork.correct || ofork.reason !== "ej-forkortad-del") p.push("oförkortad rest ska vara ej-forkortad-del");
    }
  } else {
    if (task.answer.input !== "fraction") p.push("fel inmatningsfält");
    if (!grade(task, falt(a, n)).correct) p.push("rätt bråk underkändes");
    if (grade(task, falt(w + r, n)).correct) p.push("heltal + täljare godkändes");
  }
  if (!task.view.modellIHjalp) p.push("byggmodellen ska synas i hjälpen");
  const m = task.view.modell;
  if (m.parts !== n || m.marked !== a || m.wholes !== w + 1) p.push("byggmodellen visar inte talet");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    if (tasks.filter((t) => t.params.riktning === "blandad").length !== 5) p.push("inte fem uppgifter åt varje håll");
    if (tasks.filter((t) => t.params.riktning === "blandad" && gcd(t.params.r, t.params.n) > 1).length < 2) p.push("färre än två förkortningsbara rester");
  }
  return [...new Set(p)];
}
