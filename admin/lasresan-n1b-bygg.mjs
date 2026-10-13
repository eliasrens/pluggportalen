// ============================================================================
// Läsresan – byggskript för nivå 4, fil b (issue #664)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-4-b.json från admin/lasresan-n1b-story.mjs + -fakta.mjs.
// Rör INTE level-4.json (textId:n i elevernas historik pekar dit). Nya id:n
// följer nivå 4-konventionen lr-n1-<slug> (levelFromId → 4).
// I källan står RÄTT svar alltid FÖRST i `options`; skriptet flyttar det till
// en balanserad position (A–D lika ofta, seedad blandning) så att JSON:en blir
// densamma vid varje körning. Skriver ut A–D-fördelning, längdledtråd,
// story/fact, kategorier och ordantal.
//
//   node admin/lasresan-n1b-bygg.mjs          # skriv level-4-b.json
//   node admin/lasresan-n1b-bygg.mjs --check  # bara statistik, skriv inget
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-n1b-story.mjs";
import { FAKTA } from "./lasresan-n1b-fakta.mjs";

const OUT = fileURLToPath(new URL("../src/lasresan/content/bank/level-4-b.json", import.meta.url));
const OLD = fileURLToPath(new URL("../src/lasresan/content/bank/level-4.json", import.meta.url));

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
const rand = rng(664);
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
  level: 4,
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
const old = JSON.parse(readFileSync(OLD, "utf8"));
const oldIds = new Set(old.map((t) => t.id));
const oldTitles = new Set(old.map((t) => t.title.toLowerCase()));
for (const t of texts) {
  if (oldIds.has(t.id)) console.log(`  KROCK id ${t.id} finns i level-4.json`);
  if (oldTitles.has(t.title.toLowerCase())) console.log(`  KROCK titel "${t.title}" finns i level-4.json`);
  if (!/^lr-n1-[a-z0-9-]+$/.test(t.id)) console.log(`  OGILTIGT id ${t.id}`);
}
const r = validateBank(texts);
const all = validateBank([...old, ...texts]);
const pos = r.stats.answerPositions[4];
const len = r.stats.answerLengths[4];
const words = texts.map((t) => wordCount(t.body));
const sentences = texts.flatMap((t) => t.body.split(/(?<=[.!?”])\s+/).map((s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length).filter(Boolean));
const story = texts.filter((t) => t.textType === "story").length;
const cats = {};
for (const t of texts) for (const q of t.questions) cats[q.category] = (cats[q.category] || 0) + 1;
console.log(`texter ${texts.length} (story ${story} / fact ${texts.length - story}), frågor ${total}`);
console.log(`kategorier ${Object.entries(cats).map(([c, n]) => `${c} ${n}`).join(", ")}`);
console.log(`A–D ${pos.join("/")}`);
console.log(`rätt svar unikt längst ${len.longest}/${len.total} (${Math.round((100 * len.longest) / len.total)} %)`);
console.log(`ord min ${Math.min(...words)} / medel ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} / max ${Math.max(...words)}`);
console.log(`ord per mening medel ${(sentences.reduce((a, b) => a + b, 0) / sentences.length).toFixed(1)}, max ${Math.max(...sentences)}`);
console.log(`fel ${r.errors.length}, varningar ${r.warnings.length} (hela nivå 4: fel ${all.errors.length}, varningar ${all.warnings.length})`);
for (const m of [...r.errors, ...r.warnings, ...all.errors, ...all.warnings]) console.log("  " + m);

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}
