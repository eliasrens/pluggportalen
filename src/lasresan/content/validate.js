// ============================================================================
// Läsresan – innehållsvalidator (src/lasresan/content/validate.js)
// ----------------------------------------------------------------------------
// Kontrollerar texter mot Innehållskontraktet (epic #398/#404):
//   ReadingText = { id, title, level (1-7), textType ("story"|"fact"), topic,
//                   body ("stycke\n\nstycke"), questions: Question[] (5-9) }
//   Question    = { id, question, options: [4 strängar], answerIndex (0-3),
//                   category ("fakta"|"ordforstaelse"|"mellan_raderna"|"helhet_slutsats") }
//
// FEL (texten är oanvändbar, loadern hoppar över den):
//   saknade fält, fel antal frågor/alternativ, answerIndex utanför 0–3, okänd
//   kategori/textType, nivå utanför 1–7, dubblett-id (text i banken / fråga i text).
// VARNINGAR (texten används ändå): ordantal utanför nivåns riktintervall,
//   saknat topic, dubbletter bland alternativen, skev fördelning av rätt svars
//   position (A–D) per nivå.
//
// Ren logik – körs av testerna (dev-seed + ev. bank) och av loadern i webbläsaren.
// ============================================================================

import {
  LEVEL_MIN,
  LEVEL_MAX,
  QUESTIONS_MIN,
  QUESTIONS_MAX,
  OPTIONS_PER_QUESTION,
  TEXT_TYPES,
  CATEGORIES,
  LEVEL_WORD_RANGES,
  ANSWER_SKEW_MAX_SHARE,
  ANSWER_SKEW_MIN_QUESTIONS,
} from "../config.js";

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

/** Antal ord i en brödtext (tokens som innehåller en bokstav eller siffra). */
export function wordCount(body) {
  if (typeof body !== "string") return 0;
  return body.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Validera EN text.
 * @returns {{errors:string[], warnings:string[]}}
 */
export function validateText(text) {
  const errors = [];
  const warnings = [];
  if (!text || typeof text !== "object") return { errors: ["texten är inte ett objekt"], warnings };
  const tag = isStr(text.id) ? text.id : "(utan id)";

  if (!isStr(text.id)) errors.push(`${tag}: id saknas`);
  if (!isStr(text.title)) errors.push(`${tag}: title saknas`);
  if (!Number.isInteger(text.level) || text.level < LEVEL_MIN || text.level > LEVEL_MAX) {
    errors.push(`${tag}: level måste vara ett heltal ${LEVEL_MIN}–${LEVEL_MAX}`);
  }
  if (!TEXT_TYPES.includes(text.textType)) errors.push(`${tag}: textType måste vara ${TEXT_TYPES.join("/")}`);
  if (!isStr(text.topic)) warnings.push(`${tag}: topic saknas`);
  if (!isStr(text.body)) errors.push(`${tag}: body saknas`);

  const range = LEVEL_WORD_RANGES[text.level];
  if (range && isStr(text.body)) {
    const n = wordCount(text.body);
    if (n < range[0] || n > range[1]) {
      warnings.push(`${tag}: ${n} ord (riktintervall nivå ${text.level}: ${range[0]}–${range[1]})`);
    }
  }

  const qs = text.questions;
  if (!Array.isArray(qs)) {
    errors.push(`${tag}: questions saknas`);
    return { errors, warnings };
  }
  if (qs.length < QUESTIONS_MIN || qs.length > QUESTIONS_MAX) {
    errors.push(`${tag}: ${qs.length} frågor (ska vara ${QUESTIONS_MIN}–${QUESTIONS_MAX})`);
  }
  const qids = new Set();
  qs.forEach((q, i) => {
    const qtag = `${tag} fråga ${q && isStr(q.id) ? q.id : i + 1}`;
    if (!q || typeof q !== "object") {
      errors.push(`${qtag}: inte ett objekt`);
      return;
    }
    if (!isStr(q.id)) errors.push(`${qtag}: id saknas`);
    else if (qids.has(q.id)) errors.push(`${qtag}: dubblett-id`);
    else qids.add(q.id);
    if (!isStr(q.question)) errors.push(`${qtag}: question saknas`);
    if (!Array.isArray(q.options) || q.options.length !== OPTIONS_PER_QUESTION || !q.options.every(isStr)) {
      errors.push(`${qtag}: måste ha exakt ${OPTIONS_PER_QUESTION} icke-tomma alternativ`);
    } else {
      const norm = q.options.map((o) => o.trim().toLowerCase());
      if (new Set(norm).size !== norm.length) warnings.push(`${qtag}: två alternativ är likadana`);
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= OPTIONS_PER_QUESTION) {
      errors.push(`${qtag}: answerIndex måste vara 0–${OPTIONS_PER_QUESTION - 1}`);
    }
    if (!CATEGORIES.includes(q.category)) errors.push(`${qtag}: okänd kategori "${q.category}"`);
  });
  return { errors, warnings };
}

/**
 * Fördelning av rätt svars position per nivå: { [level]: [antalA, antalB, antalC, antalD] }.
 */
export function answerPositionStats(texts) {
  const out = {};
  for (const t of texts || []) {
    if (!t || !Array.isArray(t.questions)) continue;
    const row = (out[t.level] = out[t.level] || new Array(OPTIONS_PER_QUESTION).fill(0));
    for (const q of t.questions) {
      if (q && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < OPTIONS_PER_QUESTION) {
        row[q.answerIndex] += 1;
      }
    }
  }
  return out;
}

/**
 * Validera en hel bank (lista med texter): varje text + unika text-id +
 * fördelning av rätt svars position per nivå.
 * @returns {{ok:boolean, errors:string[], warnings:string[], validTexts:object[], stats:object}}
 *   `validTexts` = texterna UTAN fel (det loadern använder).
 */
export function validateBank(texts) {
  const list = Array.isArray(texts) ? texts : [];
  const errors = [];
  const warnings = [];
  const validTexts = [];
  const ids = new Set();
  for (const t of list) {
    const r = validateText(t);
    const dup = t && isStr(t.id) && ids.has(t.id);
    if (dup) r.errors.push(`${t.id}: dubblett-id i banken`);
    if (t && isStr(t.id)) ids.add(t.id);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    if (r.errors.length === 0) validTexts.push(t);
  }
  const positions = answerPositionStats(validTexts);
  for (const [level, row] of Object.entries(positions)) {
    const n = row.reduce((a, b) => a + b, 0);
    if (n < ANSWER_SKEW_MIN_QUESTIONS) continue;
    const letters = "ABCD";
    row.forEach((c, i) => {
      if (c / n > ANSWER_SKEW_MAX_SHARE) {
        warnings.push(`nivå ${level}: rätt svar är ${letters[i]} i ${c} av ${n} frågor (skev fördelning)`);
      }
    });
  }
  const perLevel = {};
  for (const t of validTexts) perLevel[t.level] = (perLevel[t.level] || 0) + 1;
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    validTexts,
    stats: { texts: validTexts.length, perLevel, answerPositions: positions },
  };
}
