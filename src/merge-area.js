// ============================================================================
// Pluggportalen – lägg till nytt innehåll i ett befintligt område (merge-area.js)
// ----------------------------------------------------------------------------
// Issue #40: i stället för att klistra in/ersätta hela arbetsområdes-JSON:en kan
// läraren klistra in BARA det nya innehållet (fler texts/quiz/pairs). Här mergas
// det in i det som redan finns – befintligt behålls, nytt läggs till, dubbletter
// hoppas över – och allt slutvalideras med validateArea (src/validate.js).
// ============================================================================

import { validateArea } from "./validate.js";
import { normalizeExerciseTypes, deriveExerciseTypes } from "./exercise-types.js";

// Innehålls-nycklar för dubblettkontroll: vi jämför på INNEHÅLL (inte id), så
// att en text/fråga/par som redan finns inte läggs till igen. Fälten fogas ihop
// med osynliga styrtecken som skiljetecken (osannolika i lärarinnehåll).
function contentKeyText(t) {
  return [t.title, t.body].map((s) => String(s || "").trim().toLowerCase()).join("\u0000");
}
function contentKeyQuiz(q) {
  const opts = (Array.isArray(q.options) ? q.options : [])
    .map((o) => String(o || "").trim().toLowerCase())
    .join("\u0001");
  return [String(q.question || "").trim().toLowerCase(), opts].join("\u0000");
}
function contentKeyPair(p) {
  return ["term", "definition", "termImage", "defImage"]
    .map((k) => String(p[k] || "").trim().toLowerCase())
    .join("\u0000");
}

/**
 * Skapar en id-generator som ger unika `${prefix}${n}`-id som inte krockar med
 * de id som redan används av `existingItems` (t.ex. t1, t2 → nästa blir t3).
 */
function makeNextId(existingItems, prefix) {
  const used = new Set();
  let max = 0;
  for (const it of existingItems) {
    const id = String(it?.id || "");
    if (id) used.add(id);
    const m = /^([a-z]+)(\d+)$/.exec(id);
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  return () => {
    let n = max + 1;
    while (used.has(`${prefix}${n}`)) n++;
    used.add(`${prefix}${n}`);
    max = n;
    return `${prefix}${n}`;
  };
}

/**
 * Merga in nytt innehåll i ett befintligt arbetsområde.
 *
 * @param {object} existing  redan sparat område (från getArea): { name, id, texts?, quiz?, pairs?, ... }
 * @param {object} incoming  det nya innehållet – ett objekt med "texts", "quiz"
 *                           och/eller "pairs" (får gärna vara ett helt område –
 *                           bara innehållslistorna används).
 * @returns {{ ok:boolean, errors:string[], value:object|null,
 *             added?:{texts:number,quiz:number,pairs:number},
 *             skipped?:{texts:number,quiz:number,pairs:number} }}
 */
export function mergeAreaContent(existing, incoming) {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return { ok: false, errors: ["Internt fel: kunde inte läsa det befintliga området."], value: null };
  }
  if (incoming === null || typeof incoming !== "object" || Array.isArray(incoming)) {
    return {
      ok: false,
      errors: ['Det nya innehållet måste vara ett objekt, t.ex. { "quiz": [ ... ] }.'],
      value: null,
    };
  }

  const inTexts = Array.isArray(incoming.texts) ? incoming.texts : [];
  const inQuiz = Array.isArray(incoming.quiz) ? incoming.quiz : [];
  const inPairs = Array.isArray(incoming.pairs) ? incoming.pairs : [];
  if (inTexts.length === 0 && inQuiz.length === 0 && inPairs.length === 0) {
    return {
      ok: false,
      errors: [
        'Klistra in det NYA innehållet att lägga till – minst en "texts", "quiz" eller "pairs".',
      ],
      value: null,
    };
  }

  // 1) Validera/normalisera det nya innehållet med samma per-post-regler som ett
  //    helt område (lånar namnet så name-kravet inte stör). Fel på det nya
  //    innehållet rapporteras direkt.
  const probe = validateArea({
    name: existing.name || "Arbetsområde",
    texts: inTexts.length ? inTexts : undefined,
    quiz: inQuiz.length ? inQuiz : undefined,
    pairs: inPairs.length ? inPairs : undefined,
  });
  if (!probe.ok) return { ok: false, errors: probe.errors, value: null };

  const exTexts = Array.isArray(existing.texts) ? existing.texts : [];
  const exQuiz = Array.isArray(existing.quiz) ? existing.quiz : [];
  const exPairs = Array.isArray(existing.pairs) ? existing.pairs : [];

  const seenText = new Set(exTexts.map(contentKeyText));
  const seenQuiz = new Set(exQuiz.map(contentKeyQuiz));
  const seenPair = new Set(exPairs.map(contentKeyPair));

  const nextText = makeNextId(exTexts, "t");
  const nextQuiz = makeNextId(exQuiz, "q");
  const nextPair = makeNextId(exPairs, "p");

  const addedTexts = [];
  const addedQuiz = [];
  const addedPairs = [];
  const skipped = { texts: 0, quiz: 0, pairs: 0 };

  for (const t of probe.value.texts) {
    const k = contentKeyText(t);
    if (seenText.has(k)) { skipped.texts++; continue; }
    seenText.add(k);
    addedTexts.push({ ...t, id: nextText() });
  }
  for (const q of probe.value.quiz) {
    const k = contentKeyQuiz(q);
    if (seenQuiz.has(k)) { skipped.quiz++; continue; }
    seenQuiz.add(k);
    addedQuiz.push({ ...q, id: nextQuiz() });
  }
  for (const p of probe.value.pairs) {
    const k = contentKeyPair(p);
    if (seenPair.has(k)) { skipped.pairs++; continue; }
    seenPair.add(k);
    addedPairs.push({ ...p, id: nextPair() });
  }

  const mergedTexts = [...exTexts, ...addedTexts];
  const mergedQuiz = [...exQuiz, ...addedQuiz];
  const mergedPairs = [...exPairs, ...addedPairs];

  // Övningstyper: behåll lärarens uttryckliga val och slå på nya typer som det
  // tillagda innehållet faktiskt kräver (t.ex. "pairs" när man lägger till par i
  // ett tidigare rent quiz-område), så det nya innehållet blir spelbart.
  const exerciseTypes = [
    ...new Set([
      ...normalizeExerciseTypes(existing.exerciseTypes),
      ...deriveExerciseTypes({ quiz: mergedQuiz, pairs: mergedPairs }),
    ]),
  ];

  // 2) Slutvalidera hela det sammanslagna området (bl.a. läsförståelse-regeln
  //    över helheten) och normalisera för sparning. Alla poster har id, så inget
  //    renumreras eller krockar.
  const merged = validateArea({
    name: existing.name,
    id: existing.id,
    order: existing.order,
    coverEmoji: existing.coverEmoji,
    description: existing.description,
    exerciseTypes,
    texts: mergedTexts,
    quiz: mergedQuiz,
    pairs: mergedPairs,
  });
  if (!merged.ok) return { ok: false, errors: merged.errors, value: null };

  return {
    ok: true,
    errors: [],
    value: merged.value,
    added: { texts: addedTexts.length, quiz: addedQuiz.length, pairs: addedPairs.length },
    skipped,
  };
}

/**
 * Tolka en textsträng som JSON och merga in i ett befintligt område. Ger ett
 * vänligt felmeddelande om JSON-syntaxen är trasig (samma stil som
 * parseAndValidateArea).
 */
export function parseAndMergeArea(text, existing) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { ok: false, errors: ["Klistra in eller ladda upp det nya innehållet först."], value: null };
  }
  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch (e) {
    return {
      ok: false,
      errors: [
        "Texten är inte giltig JSON: " +
          e.message +
          ". Tips: kontrollera att alla { } och [ ] hör ihop och att det inte finns extra kommatecken.",
      ],
      value: null,
    };
  }
  return mergeAreaContent(existing, obj);
}
