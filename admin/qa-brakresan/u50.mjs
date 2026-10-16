// 50. Mästarkluringarna – egna kontroller · #712
// Tio OLIKA familjer per omgång, varje familj ≥ 6 validerade varianter, högst ett
// val utöver tal-/bråksvaret, och svaren räknade om oberoende av generatorn.
import { q, add, sub, mul, eq, toQ } from "../../src/brakresan/math/index.js";
import { FAMILJER } from "../../src/brakresan/utmaningar/u50.js";

/** Svaret räknat på nytt ur params (en poäng för hela uppgiften). */
function facit(f, s) {
  switch (f) {
    case "aterstaende": return sub(q(1), add(q(s.a, s.n), q(s.b, s.m)));
    case "delavdel": return q(s.N - ((s.N * s.a) / s.n) * (s.b / s.m));
    case "helhet": return q(s.N);
    case "jamfor": return q(Math.abs((s.X * s.a) / s.n - (s.Y * s.b) / s.m));
    case "procentkvar": return q(s.N - (s.N * s.p) / 100);
    case "budget": return q(Math.abs(s.B - (s.P - (s.P * s.p) / 100)));
    case "langd": { const a = add(q(s.A.W), q(s.A.x, s.A.n)); const b = add(q(s.B.W), q(s.B.x, s.B.n)); return s.op === "+" ? add(a, b) : sub(a, b); }
    case "matt": return q(s.c);
    case "proportion": return s.typ === "pris" ? q((s.pris / s.st) * s.ny) : mul(q(s.a, s.n), q(s.ny, s.pers));
    default: return null;
  }
}

export function audit(task) {
  const p = [];
  const { familj, ...s } = task.params;
  if (!FAMILJER.includes(familj)) p.push("okänd familj");
  const parts = Object.keys(task.answer.parts);
  if (!parts.includes("svar") || parts.length > 2) p.push("uppgiften ska ha ett svar och högst ett val");
  const f = facit(familj, s);
  if (f && !eq(toQ(task.key.parts.svar.value), f)) p.push(`${familj}: facit ${JSON.stringify(task.key.parts.svar.value)} ≠ ${f.n}/${f.d}`);
  if (f && (f.n <= 0 && familj !== "jamfor")) p.push(`${familj}: svaret är inte positivt`);
  if (familj === "delavdel" && task.params.N === 24 && s.a === 3 && s.n === 4 && s.b === 1 && s.m === 2 && !eq(f, q(15))) p.push("specens exempel ger inte 15");
  if (task.prompt.length > 260) p.push("för lång text");
  return p;
}

export function plan(omgangar) {
  const p = [];
  const karnor = Object.fromEntries(FAMILJER.map((f) => [f, new Set()]));
  for (const tasks of omgangar) {
    if (new Set(tasks.map((t) => t.params.familj)).size !== 10) p.push("inte tio olika familjer i omgången");
    for (const t of tasks) karnor[t.params.familj].add(t.core);
  }
  for (const [f, set] of Object.entries(karnor)) if (set.size < 6) p.push(`${f}: bara ${set.size} varianter`);
  return [...new Set(p)];
}
