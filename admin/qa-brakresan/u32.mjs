// 32. Subtrahera lika nämnare – egna kontroller · #711
// n = 3–12, 1 ≤ b ≤ a ≤ n, minst en uppgift ger 0, borttagningen bara bland
// de färgade delarna, ändrad nämnare avvisas.
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

export function audit(task, { grade }) {
  const p = [];
  const { n, a, b } = task.params;
  if (n < 3 || n > 12 || b < 1 || b > a || a > n) p.push("talen är utanför ramen");
  const ids = task.answer.parts.bort.parts;
  if (ids.length !== a) p.push("bara de färgade delarna får tas bort");
  const svar = (sel, kvar) => ({ parts: { bort: { selected: ids.slice(0, sel) }, kvar } });
  if (!grade(task, svar(b, falt(a - b, n))).correct) p.push("rätt rest underkändes");
  if (a - b > 0 && n - b >= 2 && grade(task, svar(b, falt(a - b, n - b))).correct) p.push("ändrad nämnare godkändes");
  if (grade(task, svar(b, falt(a + b, n))).correct) p.push("addition godkändes");
  if (b > 1 && grade(task, svar(b - 1, falt(a - b, n))).correct) p.push("för få borttagna godkändes");
  if (grade(task, { parts: { bort: { selected: [] }, kvar: falt(a - b, n) } }).status !== "invalid") p.push("ingen borttagning ska vara inmatningsfel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (!tasks.some((t) => t.params.a === t.params.b)) p.push("ingen uppgift som ger 0");
  return [...new Set(p)];
}
