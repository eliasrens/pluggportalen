// 03. Måla bråket – egna kontroller (admin/qa-brakresan-generatorer.mjs) · #709
// Tillåtna tal, modellens andel, VILKA delar som helst godtas, fel antal avvisas.
import { createRng } from "../../src/brakresan/schema/prng.js";

const KOMPONENT = { cirkel: "cirkel", rektangel: "rutnat", rader: "rutnat", stav: "stav" };

export function audit(task, { grade }) {
  const p = [];
  const { shape, n, a } = task.params;
  if (!Number.isSafeInteger(n) || n < 2 || n > 10) p.push(`nämnare ${n} utanför 2–10`);
  if (!Number.isSafeInteger(a) || a < 1 || a > n) p.push(`täljare ${a} utanför 1–n`);
  if (task.view.component !== KOMPONENT[shape]) p.push(`fel modell ${task.view.component} för ${shape}`);
  const delar = task.view.component === "rutnat" ? task.view.rows * task.view.cols : task.view.parts;
  if (delar !== n || task.answer.parts.length !== n) p.push(`modellen har ${delar} delar, inte ${n}`);
  if (task.view.marked) p.push("modellen får inte vara förmarkerad");
  if (/\bmarkerat\b/.test(JSON.stringify(task.view))) p.push("vyn avslöjar svaret");
  if (task.key.count !== a) p.push("facit är inte täljaren");
  // 30 slumpade markeringar per uppgift: exakt a delar = rätt, annat antal = fel.
  const rng = createRng(`u03-${task.core}`);
  for (let i = 0; i < 30; i++) {
    const k = rng.int(1, n);
    const r = grade(task, { selected: rng.sample(task.answer.parts, k) });
    if (r.status !== "graded" || r.correct !== (k === a)) p.push(`${k} markerade delar bedömdes ${r.status}/${r.correct}`);
  }
  if (grade(task, { selected: [] }).status !== "invalid") p.push("tom markering ska vara inmatningsfel");
  const ex = task.help.find((h) => h.step === "modellering")?.view;
  if (ex && ex.marked * n === a * (ex.parts ?? ex.cols * ex.rows)) p.push("hjälpens exempel har samma värde som uppgiften");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const antal = (s) => tasks.filter((t) => t.params.shape === s).length;
    if (antal("cirkel") < 4) p.push("färre än fyra cirklar i en omgång");
    if (antal("rektangel") < 4) p.push("färre än fyra rektanglar i en omgång");
    if (tasks.filter((t) => t.role === "fri").length !== 2) p.push("inte två fria variationer");
  }
  return [...new Set(p)];
}
