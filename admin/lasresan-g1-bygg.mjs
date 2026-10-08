// ============================================================================
// Läsresan – byggskript för nivå 1 (issue #521, epic #516)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-1.json från admin/lasresan-g1-story.mjs + -fakta.mjs.
// I källan står RÄTT svar alltid FÖRST i `options`; skriptet flyttar det till
// en balanserad position (A–D lika ofta, seedad blandning) så att JSON:en blir
// densamma vid varje körning. Skriver ut A–D-fördelning, längdledtråd,
// story/fact och ordantal.
//
//   node admin/lasresan-g1-bygg.mjs          # skriv level-1.json
//   node admin/lasresan-g1-bygg.mjs --check  # bara statistik, skriv inget
// ============================================================================

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-g1-story.mjs";
import { FAKTA } from "./lasresan-g1-fakta.mjs";

const OUT = fileURLToPath(new URL("../src/lasresan/content/bank/level-1.json", import.meta.url));

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
const rand = rng(521);
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
  level: 1,
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
const r = validateBank(texts);
const pos = r.stats.answerPositions[1];
const len = r.stats.answerLengths[1];
const words = texts.map((t) => wordCount(t.body));
const sentences = texts.flatMap((t) => t.body.split(/(?<=[.!?”])\s+/).map((s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length).filter(Boolean));
const story = texts.filter((t) => t.textType === "story").length;
console.log(`texter ${texts.length} (story ${story} / fact ${texts.length - story}), frågor ${total}`);
console.log(`A–D ${pos.join("/")}`);
console.log(`rätt svar unikt längst ${len.longest}/${len.total} (${Math.round((100 * len.longest) / len.total)} %)`);
console.log(`ord min ${Math.min(...words)} / medel ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} / max ${Math.max(...words)}`);
console.log(`ord per mening medel ${(sentences.reduce((a, b) => a + b, 0) / sentences.length).toFixed(1)}, max ${Math.max(...sentences)}`);
console.log(`fel ${r.errors.length}, varningar ${r.warnings.length}`);
for (const m of [...r.errors, ...r.warnings]) console.log("  " + m);

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}
