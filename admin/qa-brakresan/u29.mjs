// 29. Tre fjärdedelar av ett antal – egna kontroller · #711
// n = 3–8, 1 < a < n, N = n·k ≤ 80; alla föremål ritas bara när N ≤ 36 (annars ett
// band med n delar); markering + antal krävs båda; svaret är färre än helheten.
const tal = (v) => ({ text: String(v) });

export function audit(task, { grade }) {
  const p = [];
  const { n, a, k } = task.params;
  const N = n * k;
  if (n < 3 || n > 8 || a <= 1 || a >= n || k < 2 || k > 10 || N > 80) p.push("talen är utanför ramen");
  const x = a * k;
  if (x >= N) p.push("delen är inte färre än helheten");
  const bild = !!task.view.mangd;
  if (bild !== N <= 36) p.push("bild med alla föremål ska användas precis när N ≤ 36");
  if (bild && task.view.mangd.count !== N) p.push("mängden har fel antal föremål");
  if (!bild && task.view.stavar[0].parts !== n) p.push("bandet har inte n delar");
  const ids = task.answer.parts.grupper.parts;
  const m = bild ? x : a;
  const svar = (sel, antal) => ({ parts: { grupper: { selected: ids.slice(0, sel) }, antal: tal(antal) } });
  if (!grade(task, svar(m, x)).correct) p.push("rätt svar underkändes");
  if (grade(task, svar(m, k)).correct) p.push("en grupp godkändes som svar");
  if (grade(task, svar(bild ? k : 1, x)).correct) p.push("fel antal markerade godkändes");
  if (grade(task, { parts: { grupper: { selected: ids.slice(0, m) } } }).status !== "invalid") p.push("saknat antal ska vara inmatningsfel");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) if (!tasks.some((t) => !t.view.mangd)) p.push("ingen uppgift med band (N > 36)");
  return [...new Set(p)];
}
