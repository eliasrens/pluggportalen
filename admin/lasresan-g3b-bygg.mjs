// ============================================================================
// Läsresan – byggskript för nivå 3, del b (issue #663)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-3-b.json från admin/lasresan-g3b-story.mjs
// + -fakta.mjs. level-3.json (#523) rörs inte: dess textId:n finns i elevdatan.
// Som i lasresan-g3-bygg.mjs står RÄTT svar FÖRST i källans `options`; skriptet
// flyttar det till en balanserad position (A–D lika ofta, seedad blandning) så
// att JSON:en blir densamma vid varje körning. Statistiken gäller den nya filen,
// valideringen hela nivå 3 (level-3.json + level-3-b.json).
//
//   node admin/lasresan-g3b-bygg.mjs          # skriv level-3-b.json
//   node admin/lasresan-g3b-bygg.mjs --check  # bara statistik, skriv inget
//   node admin/lasresan-g3b-bygg.mjs --long   # lista frågor där rätt svar är unikt längst
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-g3b-story.mjs";
import { FAKTA } from "./lasresan-g3b-fakta.mjs";

const BANK = new URL("../src/lasresan/content/bank/", import.meta.url);
const OUT = fileURLToPath(new URL("level-3-b.json", BANK));

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
const rand = rng(663);
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
  level: 3,
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
const old = JSON.parse(readFileSync(new URL("level-3.json", BANK)));
const all = validateBank([...old, ...texts]);
const r = validateBank(texts);
const pos = r.stats.answerPositions[3];
const len = r.stats.answerLengths[3];
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
texts.forEach((t, i) => (words[i] < 100 || words[i] > 140) && console.log(`  ${t.id}: ${words[i]} ord (mål 100–140)`));
console.log(`hela nivå 3: ${all.stats.perLevel[3]} texter, fel ${all.errors.length}, varningar ${all.warnings.length}`);
for (const m of [...all.errors, ...all.warnings]) console.log("  " + m);

if (process.argv.includes("--long")) {
  for (const t of texts) {
    for (const q of t.questions) {
      const lens = q.options.map((o) => o.trim().length);
      if (lens.every((l, i) => i === q.answerIndex || l < lens[q.answerIndex])) console.log(`  längst: ${t.id}/${q.id} ${q.options[q.answerIndex]}`);
    }
  }
}

if (!process.argv.includes("--check") && !process.argv.includes("--long")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}
