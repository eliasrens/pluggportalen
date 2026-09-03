// ============================================================================
// Read-only innehållsgranskning (Node) för Pluggportalen.
//
//   node seed/audit-areas.mjs
//
// Läser ALLA subjects/*/areas/* från Firestore via REST-API:t (samma öppna väg
// som webbklienten och seedern använder), konverterar till vanlig JS och kör
// varje arbetsområde genom src/validate.js – exakt samma kontrakt som läraren
// valideras mot när hen klistrar in JSON. Utöver validate.js flaggas frågor vars
// text förutsätter en synlig källtext ("enligt texten", "i stycket ovan" …) men
// som saknar per-fråga-passage, samt tomma/dubblerade svarsalternativ.
//
// Skriver INGENTING – enbart granskning/rapport. Använd för att verifiera att
// redan inmatad övningsdata följer läsförståelse-kontraktet (passage per fråga,
// självbärande) innan/efter städning.
// ============================================================================

import { validateArea } from "../src/validate.js";

const PROJECT = "pluggportalen-so-2026";
const KEY = "AIzaSyB34GPjLkIuJNbgTGOrm6sRMIAisx9aJ3w";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// --- Firestore REST Value -> vanligt JS-värde (motsats till seederns toValue) --
function fromValue(v) {
  if (v == null || "nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(fields) {
  const o = {};
  for (const [k, val] of Object.entries(fields)) o[k] = fromValue(val);
  return o;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

// Alla ämnen -> alla arbetsområden under varje ämne.
async function collectAreas() {
  const subjectsDoc = await getJson(`${BASE}/subjects?pageSize=300&key=${KEY}`);
  const out = [];
  for (const s of subjectsDoc.documents || []) {
    const subjectId = s.name.split("/documents/subjects/")[1];
    const areasDoc = await getJson(
      `${BASE}/subjects/${subjectId}/areas?pageSize=300&key=${KEY}`
    );
    for (const d of areasDoc.documents || []) {
      out.push({ path: d.name.split("/documents/")[1], obj: fromFields(d.fields || {}) });
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
