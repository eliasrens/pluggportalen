// ============================================================================
// Läsresan – byggskript för nivå 2, del b (issue #662)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-2-b.json från admin/lasresan-g2b-story.mjs
// + -fakta.mjs. Samma upplägg som admin/lasresan-g2-bygg.mjs: RÄTT svar står
// FÖRST i källans `options` och flyttas till en balanserad position (A–D lika
// ofta, seedad blandning). level-2.json rörs inte – dess textId:n finns i
// elevernas historik. Skriver ut A–D, längdledtråd, story/fact, kategorier,
// ordantal och kontrollerar att id/titlar inte krockar med level-2.json.
//
//   node admin/lasresan-g2b-bygg.mjs          # skriv level-2-b.json
//   node admin/lasresan-g2b-bygg.mjs --check  # bara statistik, skriv inget
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-g2b-story.mjs";
import { FAKTA } from "./lasresan-g2b-fakta.mjs";

const BANK = new URL("../src/lasresan/content/bank/", import.meta.url);
const OUT = fileURLToPath(new URL("level-2-b.json", BANK));
const OLD = JSON.parse(readFileSync(new URL("level-2.json", BANK)));

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
const rand = rng(662);
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
  level: 2,
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

// --- Krockar med level-2.json --------------------------------------------------
const clash = [];
const oldIds = new Set(OLD.map((t) => t.id));
const oldTitles = new Set(OLD.map((t) => t.title.toLowerCase()));
for (const t of texts) {
  if (oldIds.has(t.id)) clash.push(`${t.id}: id finns redan i level-2.json`);
  if (oldTitles.has(t.title.toLowerCase())) clash.push(`${t.id}: titeln "${t.title}" finns redan i level-2.json`);
  if (!/^lr-g2-[a-z0-9-]+$/.test(t.id)) clash.push(`${t.id}: id ska vara lr-g2- + a–z/0–9/-`);
}

// --- Statistik ---------------------------------------------------------------
const r = validateBank([...OLD, ...texts]);
const own = validateBank(texts);
const pos = own.stats.answerPositions[2];
const len = own.stats.answerLengths[2];
const words = texts.map((t) => wordCount(t.body));
const sentences = texts.flatMap((t) => t.body.split(/(?<=[.!?”])\s+/).map((s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length).filter(Boolean));
const story = texts.filter((t) => t.textType === "story").length;
const cats = {};
for (const q of texts.flatMap((t) => t.questions)) cats[q.category] = (cats[q.category] || 0) + 1;
console.log(`texter ${texts.length} (story ${story} / fact ${texts.length - story}), frågor ${total}`);
console.log(`kategorier ${Object.entries(cats).map(([c, n]) => `${c} ${n}`).join(", ")}`);
console.log(`A–D ${pos.join("/")}`);
console.log(`rätt svar unikt längst ${len.longest}/${len.total} (${Math.round((100 * len.longest) / len.total)} %)`);
console.log(`ord min ${Math.min(...words)} / medel ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} / max ${Math.max(...words)}`);
console.log(`ord per mening medel ${(sentences.reduce((a, b) => a + b, 0) / sentences.length).toFixed(1)}, max ${Math.max(...sentences)}`);
console.log(`fel ${r.errors.length}, varningar ${r.warnings.length} (level-2 + level-2-b), krockar ${clash.length}`);
for (const m of [...r.errors, ...r.warnings, ...own.warnings.filter((w) => w.startsWith("nivå")), ...clash]) console.log("  " + m);
texts.forEach((t, i) => {
  if (words[i] < 60 || words[i] > 90) console.log(`  ${t.id}: ${words[i]} ord (mål 60–90)`);
});

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}

// --- Detaljer för den som skriver texterna (--verbose) ------------------------
if (process.argv.includes("--verbose")) {
  for (const t of texts) {
    for (const s of t.body.split(/(?<=[.!?”])\s+/)) {
      const n = s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
      if (n > 11) console.log(`  lång mening ${n} ord: ${t.id}: ${s}`);
    }
    for (const q of t.questions) {
      const lens = q.options.map((o) => o.trim().length);
      if (lens.every((l, i) => i === q.answerIndex || l < lens[q.answerIndex])) console.log(`  unikt längst: ${t.id}/${q.id}: ${q.options[q.answerIndex]}`);
    }
  }
}
