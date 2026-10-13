// ============================================================================
// Läsresan (#668): textpar som liknar varandra för mycket mellan nivåer.
// ----------------------------------------------------------------------------
// Jämför varje text med alla andra via andelen gemensamma ord-trigram
// (gemensamma / antal i den kortare texten) och listar par över GRANS, samt
// par med samma titel. Utan flagga: bara par där minst en text ligger i en
// -b-fil (epicens nya texter). `--gamla` = bara gamla par (referens).
//   node admin/qa-lasresan-varldar-overlapp.mjs [--gamla]
// Referens 2026-10-13: 0 gamla par över 0,12; 27 par med nya texter.
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";

const GRANS = 0.12;
const gamla = process.argv.includes("--gamla");
const DIR = new URL("../src/lasresan/content/bank/", import.meta.url);
const alla = readdirSync(DIR).filter((f) => f.startsWith("level"))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8")).map((t) => ({ ...t, f, ny: f.endsWith("-b.json") })));
const trigram = (t) => {
  const w = t.body.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 2 < w.length; i++) s.add(w.slice(i, i + 3).join(" "));
  return s;
};
for (const t of alla) t.tri = trigram(t);

const par = [];
for (let i = 0; i < alla.length; i++) {
  for (let j = i + 1; j < alla.length; j++) {
    const a = alla[i], b = alla[j];
    if (gamla ? a.ny || b.ny : !a.ny && !b.ny) continue;
    let n = 0;
    for (const x of a.tri) if (b.tri.has(x)) n++;
    const andel = n / Math.min(a.tri.size, b.tri.size);
    const sammaTitel = a.title.toLowerCase() === b.title.toLowerCase();
    if (andel > GRANS || sammaTitel) par.push({ andel, a, b, sammaTitel });
  }
}
par.sort((x, y) => y.andel - x.andel);
for (const { andel, a, b, sammaTitel } of par) {
  console.log(`${andel.toFixed(2)}  nivå ${a.level} ${a.id} (${a.f})  ↔  nivå ${b.level} ${b.id} (${b.f})${sammaTitel ? `  SAMMA TITEL "${a.title}"` : ""}`);
}
console.log(`${par.length} par (${par.filter((p) => p.andel > GRANS).length} över ${GRANS}, ${par.filter((p) => p.sammaTitel).length} med samma titel)`);
