// ============================================================================
// Läsresan – byggskript för nivå 5, del b (issue #665)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-5-b.json från admin/lasresan-n2b-story.mjs
// + -fakta.mjs. level-5.json rörs inte (textId:n i elevernas historik pekar dit).
// I källan står RÄTT svar alltid FÖRST i `options`; skriptet flyttar det till
// en balanserad position (A–D lika ofta, seedad blandning) så att JSON:en blir
// densamma vid varje körning. Skriver ut A–D-fördelning, längdledtråd,
// story/fact, kategorier, ordantal och namn som redan används på nivå 5.
//
//   node admin/lasresan-n2b-bygg.mjs          # skriv level-5-b.json
//   node admin/lasresan-n2b-bygg.mjs --check  # bara statistik, skriv inget
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-n2b-story.mjs";
import { FAKTA } from "./lasresan-n2b-fakta.mjs";

const BANK = new URL("../src/lasresan/content/bank/", import.meta.url);
const OUT = fileURLToPath(new URL("level-5-b.json", BANK));
const OLD = JSON.parse(readFileSync(new URL("level-5.json", BANK)));

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
const rand = rng(665);
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
  level: 5,
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
const r = validateBank([...OLD, ...texts]);
const own = validateBank(texts);
const pos = own.stats.answerPositions[5];
const len = own.stats.answerLengths[5];
const all = r.stats.answerLengths[5];
const words = texts.map((t) => wordCount(t.body));
const sentences = texts.flatMap((t) => t.body.split(/(?<=[.!?”])\s+/).map((s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length).filter(Boolean));
const story = texts.filter((t) => t.textType === "story").length;
const cats = {};
for (const t of texts) for (const q of t.questions) cats[q.category] = (cats[q.category] || 0) + 1;
const topics = {};
for (const t of texts) topics[t.topic] = (topics[t.topic] || 0) + 1;
console.log(`texter ${texts.length} (story ${story} / fact ${texts.length - story}), frågor ${total}`);
console.log(`kategorier ${JSON.stringify(cats)}`);
console.log(`ämnen ${JSON.stringify(topics)}`);
console.log(`A–D ${pos.join("/")} (hela nivå 5: ${r.stats.answerPositions[5].join("/")})`);
console.log(`rätt svar unikt längst ${len.longest}/${len.total} (${Math.round((100 * len.longest) / len.total)} %), hela nivå 5 ${all.longest}/${all.total}`);
console.log(`ord min ${Math.min(...words)} / medel ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} / max ${Math.max(...words)}`);
console.log(`ord per mening medel ${(sentences.reduce((a, b) => a + b, 0) / sentences.length).toFixed(1)}, max ${Math.max(...sentences)}`);

// Namn (versalord mitt i en mening) som redan finns i level-5.json eller i en annan ny text.
const names = (body) => new Set([...body.matchAll(/(?<![.!?”:]\s|^|\n|”)\b([A-ZÅÄÖ][a-zåäö]+)/g)].map((m) => m[1]));
const seen = new Map();
for (const t of OLD) for (const n of names(t.body)) seen.set(n, t.id);
for (const t of texts) {
  for (const n of names(t.body)) {
    if (seen.has(n) && seen.get(n) !== t.id) console.log(`  namn ${n} i ${t.id} finns redan i ${seen.get(n)}`);
    else seen.set(n, t.id);
  }
}
const titles = new Set(OLD.map((t) => t.title));
for (const t of texts) if (titles.has(t.title)) console.log(`  rubrik "${t.title}" finns redan`);

console.log(`fel ${r.errors.length}, varningar ${r.warnings.length}`);
for (const m of [...r.errors, ...r.warnings]) console.log("  " + m);
for (const t of texts) {
  const n = wordCount(t.body);
  if (n < 95 || n > 135) console.log(`  ${t.id}: ${n} ord`);
}

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}
