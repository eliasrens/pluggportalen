// 30. Kluriga andelar – egna kontroller · #711
// Fyra del-, tre rest- och tre helhetsuppgifter; nämnare 2–6; alla antal heltal;
// bandet har n delar med a markerade och känt/okänt utskrivet.
const tal = (v) => ({ text: String(v) });

export function audit(task, { grade }) {
  const p = [];
  const { typ, n, a, k } = task.params;
  const N = n * k;
  if (n < 2 || n > 6 || a < 1 || a >= n || N > 60) p.push("talen är utanför ramen");
  const svar = typ === "del" ? a * k : typ === "rest" ? N - a * k : N;
  if (!grade(task, tal(svar)).correct) p.push("rätt antal underkändes");
  for (const f of [k, svar + 1, svar - 1]) if (f !== svar && f >= 0 && grade(task, tal(f)).correct) p.push(`${f} godkändes`);
  const band = task.view.stavar[0];
  if (band.parts !== n || band.marked !== a) p.push("bandet visar inte andelen");
  const kand = band.etiketter.map((e) => e.text).join(" ");
  if (typ === "helhet" ? !kand.includes(String(a * k)) || !band.helhet.includes("?") : !band.helhet.includes(String(N))) p.push("bandet märker inte känt och okänt");
  if (!task.view.expr.some((x) => x.text)) p.push("enheten saknas vid svaret");
  return p;
}

export function plan(omgangar) {
  const p = [];
  for (const tasks of omgangar) {
    const c = (t) => tasks.filter((x) => x.params.typ === t).length;
    if (c("del") !== 4 || c("rest") !== 3 || c("helhet") !== 3) p.push("fördelningen 4 del / 3 rest / 3 helhet stämmer inte");
  }
  return [...new Set(p)];
}
