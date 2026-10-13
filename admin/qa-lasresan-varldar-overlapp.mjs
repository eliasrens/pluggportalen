// ============================================================================
// Läsresan (#668): textpar som liknar varandra för mycket mellan nivåer.
// ----------------------------------------------------------------------------
// Jämför varje text med alla andra via andelen gemensamma ord-trigram
// (gemensamma / antal i den kortare texten) och listar par över GRANS, samt
// par med samma titel. Utan flagga: bara par där minst en text ligger i en
// -b-fil (epicens nya texter). `--gamla` = bara gamla par (referens).
//   node admin/qa-lasresan-varldar-overlapp.mjs [--gamla]
// Referens 2026-10-13: 0 gamla par över 0,12; 27 par med nya texter.
// Efter #684 (26 nya texter bytta): 0 par. test/lasresan-bank-overlapp.test.js
// kör samma logik (laddaBank + hittaPar) på hela banken.
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const GRANS = 0.12;
const DIR = new URL("../src/lasresan/content/bank/", import.meta.url);

/** Alla texter i banken, med filnamn (`f`) och `ny` = ligger i en -b-fil. */
export function laddaBank() {
  return readdirSync(DIR).filter((f) => f.startsWith("level"))
    .flatMap((f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8")).map((t) => ({ ...t, f, ny: f.endsWith("-b.json") })));
}

const trigram = (t) => {
  const w = t.body.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 2 < w.length; i++) s.add(w.slice(i, i + 3).join(" "));
  return s;
};

/**
 * Par över GRANS eller med samma titel, sorterade med störst andel först.
 * `med(a, b)` väljer vilka par som jämförs (standard: alla).
 */
export function hittaPar(alla, med = () => true) {
  const tri = alla.map(trigram);
  const par = [];
  for (let i = 0; i < alla.length; i++) {
    for (let j = i + 1; j < alla.length; j++) {
      const a = alla[i], b = alla[j];
      if (!med(a, b)) continue;
      let n = 0;
      for (const x of tri[i]) if (tri[j].has(x)) n++;
      const andel = n / Math.min(tri[i].size, tri[j].size);
      const sammaTitel = a.title.toLowerCase() === b.title.toLowerCase();
      if (andel > GRANS || sammaTitel) par.push({ andel, a, b, sammaTitel });
    }
  }
  return par.sort((x, y) => y.andel - x.andel);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gamla = process.argv.includes("--gamla");
  const par = hittaPar(laddaBank(), (a, b) => (gamla ? !a.ny && !b.ny : a.ny || b.ny));
  for (const { andel, a, b, sammaTitel } of par) {
    console.log(`${andel.toFixed(2)}  nivå ${a.level} ${a.id} (${a.f})  ↔  nivå ${b.level} ${b.id} (${b.f})${sammaTitel ? `  SAMMA TITEL "${a.title}"` : ""}`);
  }
  console.log(`${par.length} par (${par.filter((p) => p.andel > GRANS).length} över ${GRANS}, ${par.filter((p) => p.sammaTitel).length} med samma titel)`);
}
