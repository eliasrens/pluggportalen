// ============================================================================
// Läsresan – byggskript för nivå 1, del B (issue #661)
// ----------------------------------------------------------------------------
// Skriver src/lasresan/content/bank/level-1-b.json från admin/lasresan-g1b-story.mjs
// + -fakta.mjs. level-1.json rörs inte (textId:n i elevernas historik pekar dit).
// I källan står RÄTT svar alltid FÖRST i `options`; skriptet flyttar det till
// en balanserad position (A–D lika ofta, seedad blandning) så att JSON:en blir
// densamma vid varje körning. Skriver ut statistik för del B och för hela
// nivå 1, validerar hela banken via manifestet och listar egennamn i del B
// som redan finns i någon annan text i banken.
//
//   node admin/lasresan-g1b-bygg.mjs          # skriv level-1-b.json
//   node admin/lasresan-g1b-bygg.mjs --check  # bara statistik, skriv inget
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wordCount, validateBank } from "../src/lasresan/content/validate.js";
import { STORY } from "./lasresan-g1b-story.mjs";
import { FAKTA } from "./lasresan-g1b-fakta.mjs";

const DIR = new URL("../src/lasresan/content/bank/", import.meta.url);
const FILE = "level-1-b.json";
const OUT = fileURLToPath(new URL(FILE, DIR));
const read = (f) => JSON.parse(readFileSync(new URL(f, DIR)));

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
const rand = rng(661);
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
const lettersOf = (w) => w.replace(/[^\p{L}]/gu, "");
const sentencesOf = (body) =>
  body
    .split(/(?<=[.!?”])\s+/)
    .map((s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length)
    .filter(Boolean);

function report(label, list) {
  const r = validateBank(list);
  const pos = r.stats.answerPositions[1];
  const len = r.stats.answerLengths[1];
  const words = list.map((t) => wordCount(t.body));
  const sentences = list.flatMap((t) => sentencesOf(t.body));
  const story = list.filter((t) => t.textType === "story").length;
  const cats = {};
  for (const q of list.flatMap((t) => t.questions)) cats[q.category] = (cats[q.category] || 0) + 1;
  console.log(`--- ${label}`);
  console.log(`texter ${list.length} (story ${story} / fact ${list.length - story}), frågor ${len.total}`);
  console.log(`kategorier ${Object.entries(cats).map(([c, n]) => `${c} ${n}`).join(", ")}`);
  console.log(`A–D ${pos.join("/")}`);
  console.log(`rätt svar unikt längst ${len.longest}/${len.total} (${Math.round((100 * len.longest) / len.total)} %)`);
  console.log(`ord min ${Math.min(...words)} / medel ${(words.reduce((a, b) => a + b, 0) / words.length).toFixed(1)} / max ${Math.max(...words)}`);
  console.log(`ord per mening medel ${(sentences.reduce((a, b) => a + b, 0) / sentences.length).toFixed(1)}, max ${Math.max(...sentences)}`);
  return r;
}

report("del B (level-1-b.json)", texts);
const old = read("level-1.json");
report("hela nivå 1", [...old, ...texts]);

for (const t of texts) {
  const n = wordCount(t.body);
  if (n < 30 || n > 50) console.log(`  ${t.id}: ${n} ord (ska vara 30–50)`);
  for (const s of t.body.split(/(?<=[.!?”])\s+/)) {
    if (s.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length > 7) console.log(`  ${t.id}: lång mening: ${s}`);
  }
  for (const q of t.questions) {
    if (q.options.some((o) => o.trim().split(/\s+/).length > 4)) console.log(`  ${t.id}/${q.id}: alternativ över 4 ord`);
  }
}
const titles = new Set(old.map((t) => t.title.toLowerCase()));
for (const t of texts) if (titles.has(t.title.toLowerCase())) console.log(`  ${t.id}: titeln finns redan på nivå 1`);

// Hela banken via manifestet, med den nya filen i stället för en ev. gammal version.
const manifest = read("manifest.json");
const files = [...new Set(Object.values(manifest.levels).flat())].filter((f) => f !== FILE);
const rest = files.flatMap(read);
const r = validateBank([...rest, ...texts]);
console.log(`--- hela banken: fel ${r.errors.length}, varningar ${r.warnings.length}`);
for (const m of [...r.errors, ...r.warnings]) console.log("  " + m);
if (!manifest.levels[1].includes(FILE)) console.log(`  OBS: ${FILE} saknas i manifest.json under nivå 1`);

// --- Egennamn i del B som finns i en annan text --------------------------------
// Namn = ord med versal som aldrig förekommer med gemen begynnelsebokstav i banken.
const all = [...rest, ...texts];
const tokens = (t) => `${t.title} ${t.body}`.split(/\s+/).map(lettersOf).filter(Boolean);
const lower = new Set(all.flatMap(tokens).filter((w) => /^\p{Ll}/u.test(w)).map((w) => w.toLowerCase()));
const capsIn = (t) => new Set(tokens(t).filter((w) => /^\p{Lu}\p{Ll}+$/u.test(w) && !lower.has(w.toLowerCase())));
const elsewhere = new Map();
for (const t of texts) {
  for (const n of capsIn(t)) {
    const ids = all.filter((u) => u.id !== t.id && capsIn(u).has(n)).map((u) => u.id);
    if (ids.length) elsewhere.set(n, `${t.id} ↔ ${ids.join(", ")}`);
  }
}
console.log(`--- egennamn i del B som finns i andra texter: ${elsewhere.size}`);
for (const [n, where] of elsewhere) console.log(`  ${n}: ${where}`);

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, JSON.stringify(texts, null, 2) + "\n");
  console.log(`skrev ${OUT}`);
}
