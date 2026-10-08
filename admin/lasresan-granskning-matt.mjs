// ============================================================================
// Läsresan – mätvärden för stegringen nivå 1–4 (issue #524, epic #516)
// ----------------------------------------------------------------------------
// Skriver ut per nivå: ord per text, ord per mening, andel meningar över 6 ord,
// andel långa ord (> 6 bokstäver), LIX, frågor per text, ord per fråga,
// kategorifördelning, A–D och längdledtråd. Listar också egennamn (versal mitt
// i en mening) som förekommer i mer än en text någonstans i banken, där minst
// en av texterna ligger på nivå 1–3.
//
//   node admin/lasresan-granskning-matt.mjs          # nivå 1–4
//   node admin/lasresan-granskning-matt.mjs 1 2 3 4 5
// ============================================================================

import { readFileSync } from "node:fs";
import { wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (n) => JSON.parse(readFileSync(new URL(`level-${n}.json`, dir)));
const levels = process.argv.slice(2).map(Number).filter(Boolean);
const LEVELS = levels.length ? levels : [1, 2, 3, 4];

const sentencesOf = (body) =>
  body
    .split(/(?<=[.!?”])\s+/)
    .map((s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w)))
    .filter((s) => s.length);
const lettersOf = (w) => w.replace(/[^\p{L}]/gu, "");
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const f1 = (x) => x.toFixed(1).replace(".", ",");
const pct = (a, b) => `${Math.round((100 * a) / b)} %`;

const rows = [];
for (const n of LEVELS) {
  const texts = read(n);
  const words = texts.map((t) => wordCount(t.body));
  const sents = texts.flatMap((t) => sentencesOf(t.body));
  const allWords = sents.flat();
  const long = allWords.filter((w) => lettersOf(w).length > 6).length;
  const qs = texts.flatMap((t) => t.questions);
  const cats = {};
  for (const q of qs) cats[q.category] = (cats[q.category] || 0) + 1;
  const len = answerLengthStats(texts)[n];
  rows.push({
    nivå: n,
    texter: texts.length,
    "ord (min/medel/max)": `${Math.min(...words)}/${f1(mean(words))}/${Math.max(...words)}`,
    "ord/mening": f1(allWords.length / sents.length),
    "meningar > 6 ord": pct(sents.filter((s) => s.length > 6).length, sents.length),
    "långa ord": pct(long, allWords.length),
    LIX: Math.round(allWords.length / sents.length + (100 * long) / allWords.length),
    "frågor/text": f1(qs.length / texts.length),
    "ord/fråga": f1(mean(qs.map((q) => q.question.split(/\s+/).length))),
    kategorier: Object.entries(cats).map(([k, v]) => `${k} ${pct(v, qs.length)}`).join(", "),
    "A–D": answerPositionStats(texts)[n].join("/"),
    "unikt längst": `${len.longest}/${len.total} (${pct(len.longest, len.total)})`,
  });
}
for (const r of rows) {
  console.log(`--- nivå ${r.nivå}`);
  for (const [k, v] of Object.entries(r)) if (k !== "nivå") console.log(`  ${k}: ${v}`);
}

// --- Egennamn i flera texter -------------------------------------------------
const names = new Map();
for (let n = 1; n <= 10; n++) {
  for (const t of read(n)) {
    for (const s of t.body.split(/(?<=[.!?:”])\s+|\n+/)) {
      for (const w of s.split(/\s+/).slice(1)) {
        const name = lettersOf(w);
        if (/^\p{Lu}\p{Ll}+$/u.test(name)) {
          if (!names.has(name)) names.set(name, new Set());
          names.get(name).add(`${n}:${t.id}`);
        }
      }
    }
  }
}
const shared = [...names].filter(([, ids]) => ids.size > 1 && [...ids].some((id) => /^[123]:/.test(id)));
console.log(`--- egennamn i mer än en text (minst en på nivå 1–3): ${shared.length}`);
for (const [name, ids] of shared) console.log(`  ${name}: ${[...ids].join(", ")}`);
