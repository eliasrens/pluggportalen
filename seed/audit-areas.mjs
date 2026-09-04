// ============================================================================
// Read-only innehållsgranskning (Node, Admin SDK) för Pluggportalen.
//
//   node seed/audit-areas.mjs
//
// Läser ALLA subjects/*/areas/* från Firestore via Admin SDK (service-account,
// kringgår de härdade reglerna legitimt – den gamla REST + webb-nyckel-vägen
// funkar inte längre mot stängda regler) och kör varje arbetsområde genom
// src/validate.js – samma kontrakt som läraren valideras mot. Utöver validate.js
// flaggas frågor vars text förutsätter en synlig källtext ("enligt texten" …)
// men som saknar per-fråga-passage, samt tomma/dubblerade svarsalternativ.
//
// Skriver INGENTING – enbart granskning/rapport. Mot emulatorn: sätt
// FIRESTORE_EMULATOR_HOST (se docs/ADMIN.md).
// ============================================================================

import { db, isEmulator } from "../admin/_shared.mjs";
import { validateArea } from "../src/validate.js";

// Alla ämnen -> alla arbetsområden under varje ämne.
async function collectAreas() {
  const out = [];
  const subjectsSnap = await db.collection("subjects").get();
  for (const s of subjectsSnap.docs) {
    const areasSnap = await db.collection(`subjects/${s.id}/areas`).get();
    for (const d of areasSnap.docs) {
      out.push({ path: `subjects/${s.id}/areas/${d.id}`, obj: { id: d.id, ...d.data() } });
    }
  }
  return out;
}

// Frågetext som bara går att besvara utifrån en visad källtext.
const SOURCE_PHRASES = [
  /enligt texten/i, /i texten/i, /i stycket/i, /texten ovan/i, /texten nedan/i,
  /enligt materialet/i, /i materialet/i, /enligt källan/i, /i faktarutan/i,
  /raden ovan/i, /i berättelsen/i, /i artikeln/i, /vad handlar texten/i,
  /enligt stycket/i,
];

function heuristics(obj) {
  const notes = [];
  const quiz = Array.isArray(obj.quiz) ? obj.quiz : [];
  const anyPassage = quiz.some((q) => q && typeof q.passage === "string" && q.passage.trim());
  quiz.forEach((q, i) => {
    if (!q || typeof q !== "object") return;
    const nr = i + 1;
    const hasPassage = typeof q.passage === "string" && q.passage.trim().length > 0;
    const qtext = String(q.question || "");
    if (SOURCE_PHRASES.some((re) => re.test(qtext)) && !hasPassage)
      notes.push(`Fråga ${nr} hänvisar till källtext men saknar passage: "${qtext}"`);
    if (Array.isArray(q.options)) {
      if (q.options.some((o) => String(o == null ? "" : o).trim() === ""))
        notes.push(`Fråga ${nr} har ett tomt svarsalternativ.`);
      const seen = new Set();
      for (const o of q.options) {
        const key = String(o).trim().toLowerCase();
        if (seen.has(key)) notes.push(`Fråga ${nr} har dubblett-alternativ: "${o}"`);
        seen.add(key);
      }
    }
  });
  return { anyPassage, notes };
}

const areas = await collectAreas();
console.log(`Källa: ${isEmulator ? "EMULATOR" : "LIVE"}`);
console.log(`Hittade ${areas.length} arbetsområde(n).\n`);
let problems = 0;
for (const { path, obj } of areas) {
  const quizN = Array.isArray(obj.quiz) ? obj.quiz.length : 0;
  const textsN = Array.isArray(obj.texts) ? obj.texts.length : 0;
  const pairsN = Array.isArray(obj.pairs) ? obj.pairs.length : 0;
  console.log(`=== ${path}  ("${obj.name}") ===`);
  console.log(`   ${textsN} texter, ${quizN} frågor, ${pairsN} par`);

  const { ok, errors } = validateArea(obj);
  if (ok) {
    console.log("   validate.js: ✅ OK");
  } else {
    problems++;
    console.log("   validate.js: ❌ FEL:");
    errors.forEach((e) => console.log(`      - ${e}`));
  }
  const { anyPassage, notes } = heuristics(obj);
  console.log(`   läsförståelse (någon passage): ${anyPassage ? "JA" : "nej (rent quiz)"}`);
  if (notes.length) {
    problems++;
    console.log("   Flaggor:");
    notes.forEach((n) => console.log(`      ⚠ ${n}`));
  } else {
    console.log("   Flaggor: inga");
  }
  console.log("");
}
console.log(
  problems === 0
    ? "SLUTSATS: all data validerar rent – inga läsförståelsefrågor med dold källtext, inga tomma/dubbla alternativ."
    : `SLUTSATS: ${problems} problem hittades – se ovan (flagga till läraren, gissa inte fram text).`
);
process.exit(problems === 0 ? 0 : 1);
