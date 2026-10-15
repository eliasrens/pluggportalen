// 05. Hitta helheten – egna kontroller · #710
// 1/n med n 2–6, samlingar högst 36 föremål, byggområdet utan platser (samma max
// för alla), rätt = n bitar / n·k föremål, "antal fler" (n − 1) avvisas.
export function audit(task, { grade }) {
  const p = [];
  const { form, n, k = 1 } = task.params;
  if (n < 2 || n > 6) p.push(`n = ${n} utanför 2–6`);
  if (form === "mangd" && (k < 1 || k > 6 || n * k > 36)) p.push(`samlingen ${n}·${k} utanför ramen`);
  if (task.view.max !== 8 || task.view.bit !== `1/${n}`) p.push("byggområdet avslöjar antalet eller biten är fel");
  const total = form === "mangd" ? n * k : n;
  for (let b = 1; b <= 8; b++) {
    const r = grade(task, { text: String(b * k) });
    if (r.status !== "graded" || r.correct !== (b === n)) p.push(`${b} bitar bedömdes ${r.status}/${r.correct}`);
  }
  if (!grade(task, { text: String(total) }).correct) p.push("totalen underkändes");
  if (grade(task, { text: "" }).status !== "invalid") p.push("tomt ska vara inmatningsfel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const s = tasks.filter((t) => t.params.form === "mangd").length;
    if (s < 2 || s > 6) p.push(`samlingar i ${s} rundor`);
  }
  return [...new Set(p)];
}
