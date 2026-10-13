// ============================================================================
// Läsresan – byggskript för nivå 7, fil b (issue #667)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-7-b.json från admin/lasresan-n4b-story.mjs + -fakta.mjs.
// level-7.json (de 40 första texterna) rörs ALDRIG – textId:n i elevernas
// historik pekar dit. I källan står RÄTT svar alltid FÖRST i `options`;
// skriptet flyttar det till en balanserad position (A–D lika ofta, seedad
// blandning) så att JSON:en blir densamma vid varje körning. Skriver ut A–D-
// fördelning, längdledtråd, kategorier, story/fact och ordantal, både för
// den nya filen och för hela nivå 7.
//
//   node admin/lasresan-n4b-bygg.mjs          # skriv level-7-b.json
//   node admin/lasresan-n4b-bygg.mjs --check  # bara statistik, skriv inget
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-n4b-story.mjs";
import { FAKTA } from "./lasresan-n4b-fakta.mjs";

const BANK = new URL("../src/lasresan/content/bank/", import.meta.url);
const OUT = fileURLToPath(new URL("level-7-b.json", BANK));
const OLD = JSON.parse(readFileSync(new URL("level-7.json", BANK)));

const T = [...STORY, ...FAKTA];

// --- Seedad blandning (mulberry32) så att utdatan är deterministisk ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(667);
const total = T.reduce((n, t) => n + t.q.length, 0);
const bag = Array.from({ length: total }, (_, i) => i % 4);
for (let i = bag.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [bag[i], bag[j]] = [bag[j], bag[i]];
}

let k = 0;
const texts = T.map((t) => ({
  id: t.id,
  title: t.title,
  level: 7,
  textType: t.textType,
  topic: t.topic,
  body: t.body.join("\n\n"),
  questions: t.q.map(([question, [right, ...wrong], category], i) => {
    const answerIndex = bag[k++];
    const options = [...wrong];
    options.splice(answerIndex, 0, right);
    return { id: `q${i + 1}`, question, options, answerIndex, category };
  }),
}));

// --- Statistik ---------------------------------------------------------------
function report(label, list) {
  const r = validateBank(list);
  const pos = r.stats.answerPositions[7];
  const len = r.stats.answerLengths[7];
  const words = list.map((t) => wordCount(t.body));
  const cats = {};
  for (const t of list) for (const q of t.questions) cats[q.category] = (cats[q.category] || 0) + 1;
  const story = list.filter((t) => t.textType === "story").length;
  console.log(`--- ${label}`);
  console.log(`texter ${list.length} (story ${story} / fact ${list.length - story}), frågor ${len.total}`);
  console.log(`A–D ${pos.join("/")}`);
  console.log(`rätt svar unikt längst ${len.longest}/${len.total} (${Math.round((100 * len.longest) / len.total)} %)`);
  console.log(`kategorier ${Object.entries(cats).map(([c, n]) => `${c} ${n}`).join(", ")}`);
  console.log(`ord min ${Math.min(...words)} / medel ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} / max ${Math.max(...words)}`);
  console.log(`fel ${r.errors.length}, varningar ${r.warnings.length}`);
  for (const m of [...r.errors, ...r.warnings]) console.log("  " + m);
}
report("level-7-b.json", texts);
report("hela nivå 7", [...OLD, ...texts]);

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}
