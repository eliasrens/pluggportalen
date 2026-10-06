// ============================================================================
// Pluggporten – lärarsidan: rena ops för enskilda frågor/par/texter i ett område
// (teacher-area-items-ops.js, issue #454)
// ----------------------------------------------------------------------------
// Innehållsstudions utfällda underrader låter läraren lägga till, redigera och ta
// bort ENSKILDA quizfrågor, par och lästexter. Här bor logiken – DOM-fri och
// enhetstestad (test/teacher-area-items-ops.test.js):
//
//   addItem / updateItem / removeItem(area, kind, …) → NYTT area-objekt
//   applyItemOp(area, op) → { ok, errors, area } (kör befintliga validateArea)
//   itemCounts(area), sectionsFor(area), hasPassageMode(area), lastItemWarning(…)
//
// KONTRAKT (saveArea = setDoc = full överskrivning): anroparen hämtar en FÄRSK
// kopia (data.getArea) direkt före skrivning, applicerar ENBART ändringen här och
// skriver hela dokumentet. Alla andra fält (hiddenModes, grade, generator,
// coverEmoji, order, exerciseTypes, readingTexts, readingPrereq …) följer med
// OFÖRÄNDRADE – vi skriver den råa färska kopian + ändringen, inte validateArea:s
// normaliserade värde (som skulle härleda exerciseTypes m.m.). validateArea är
// grinden: går den inte igenom sparas inget. quiz[].passage (läsförståelse #151)
// bevaras på alla poster som inte ändras, och på den ändrade om formuläret har den.
// ============================================================================

import { validateArea } from "./validate.js";
import { areaExerciseTypes, hasGeneratorContent } from "./exercise-types.js";

/** Innehållslistorna som underraderna hanterar. */
export const ITEM_KINDS = ["quiz", "pairs", "texts"];
const ID_PREFIX = { quiz: "q", pairs: "p", texts: "t" };

const str = (v) => (v == null ? "" : String(v));
const trimmed = (v) => str(v).trim();

function assertKind(kind) {
  if (!ITEM_KINDS.includes(kind)) throw new Error(`Okänd innehållstyp: ${kind}`);
}

/** Listan för en typ (alltid en array, aldrig områdets egen referens). */
export function itemsOf(area, kind) {
  assertKind(kind);
  return Array.isArray(area?.[kind]) ? [...area[kind]] : [];
}

/** Antal per typ, t.ex. { quiz: 5, pairs: 6, texts: 0 }. */
export function itemCounts(area) {
  const out = {};
  for (const k of ITEM_KINDS) out[k] = Array.isArray(area?.[k]) ? area[k].length : 0;
  return out;
}

/** Läsförståelse (befintliga läget, #151) = minst en quizfråga har passage. */
export function hasPassageMode(area) {
  return itemsOf(area, "quiz").some((q) => trimmed(q?.passage).length > 0);
}

/**
 * Vilka sektioner underraden visar: bara typer området HAR (areaExerciseTypes)
 * eller har innehåll i. Lästexter är ingen övningstyp – visas när de finns.
 */
export function sectionsFor(area) {
  const types = areaExerciseTypes(area);
  const n = itemCounts(area);
  const out = [];
  if (types.includes("quiz") || n.quiz) out.push("quiz");
  if (types.includes("pairs") || types.includes("bildpar") || n.pairs) out.push("pairs");
  if (n.texts) out.push("texts");
  return out;
}

/** Är området ett rent generatorområde (Räkna)? */
export const isGeneratorArea = (area) => hasGeneratorContent(area);

/** Stabil JSON (sorterade nycklar) – för att jämföra en post med sin ögonblicksbild. */
export function stableKey(v) {
  if (Array.isArray(v)) return `[${v.map(stableKey).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableKey(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

/**
 * Hitta en post i (den färska) listan. ref = { index, id?, snapshot? }:
 * med id → sök på id; annars index, och om snapshot finns måste posten vara
 * oförändrad sedan listan laddades. -1 = posten finns inte längre / har ändrats.
 */
export function locateItem(list, ref) {
  if (!ref) return -1;
  if (trimmed(ref.id)) return list.findIndex((it) => trimmed(it?.id) === trimmed(ref.id));
  const i = ref.index;
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return -1;
  if (ref.snapshot !== undefined && stableKey(list[i]) !== stableKey(ref.snapshot)) return -1;
  return i;
}

/** Nästa lediga `${prefix}${n}`-id (samma form som merge-area.js använder). */
export function nextItemId(list, kind) {
  const prefix = ID_PREFIX[kind];
  const used = new Set(list.map((it) => trimmed(it?.id)).filter(Boolean));
  let n = list.length + 1;
  for (const id of used) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Sätt/ta bort ett valfritt strängfält (tomt → fältet försvinner, aldrig undefined). */
function setOptional(obj, key, value) {
  const v = trimmed(value);
  if (v) obj[key] = v;
  else delete obj[key];
}

/**
 * Normalisera formulärdata för en post. Quiz: tomma alternativ tas bort och
 * answerIndex följer med till rätt position (tomt RÄTT svar behålls så att
 * validateArea säger ifrån). Bara kända fält läses – övriga fält på en befintlig
 * post bevaras av updateItem.
 */
export function normalizeItemFields(kind, raw = {}) {
  assertKind(kind);
  if (kind === "quiz") {
    const opts = Array.isArray(raw.options) ? raw.options.map(trimmed) : [];
    const ai = Number.isInteger(raw.answerIndex) ? raw.answerIndex : -1;
    const options = [];
    let answerIndex = -1;
    opts.forEach((o, i) => {
      if (!o && i !== ai) return;
      if (i === ai) answerIndex = options.length;
      options.push(o);
    });
    const out = { question: trimmed(raw.question), options, answerIndex, explanation: trimmed(raw.explanation) };
    setOptional(out, "passage", raw.passage);
    return out;
  }
  if (kind === "pairs") {
    const out = { term: trimmed(raw.term), definition: trimmed(raw.definition) };
    setOptional(out, "termImage", raw.termImage);
    setOptional(out, "defImage", raw.defImage);
    setOptional(out, "group", raw.group);
    return out;
  }
  return { title: trimmed(raw.title), body: trimmed(raw.body) };
}

/** Valfria fält som formuläret äger – tomt i formuläret = ta bort från posten. */
const OPTIONAL_FIELDS = { quiz: ["passage"], pairs: ["termImage", "defImage", "group"], texts: [] };

/** Lägg till en post sist i listan (med unikt id). Returnerar ett NYTT område. */
export function addItem(area, kind, fields) {
  const list = itemsOf(area, kind);
  const item = { id: nextItemId(list, kind), ...normalizeItemFields(kind, fields) };
  return { ...area, [kind]: [...list, item] };
}

/**
 * Uppdatera en post (hittad via ref, se locateItem). Okända fält på posten (och
 * id) bevaras; formulärets fält skrivs över. Kastar om posten inte hittas.
 */
export function updateItem(area, kind, ref, fields) {
  const list = itemsOf(area, kind);
  const i = locateItem(list, ref);
  if (i < 0) throw new ItemGoneError();
  const next = { ...list[i], ...normalizeItemFields(kind, fields) };
  for (const key of OPTIONAL_FIELDS[kind]) if (!trimmed(fields?.[key])) delete next[key];
  list[i] = next;
  return { ...area, [kind]: list };
}

/** Ta bort en post (hittad via ref). Kastar om posten inte hittas. */
export function removeItem(area, kind, ref) {
  const list = itemsOf(area, kind);
  const i = locateItem(list, ref);
  if (i < 0) throw new ItemGoneError();
  list.splice(i, 1);
  return { ...area, [kind]: list };
}

export class ItemGoneError extends Error {
  constructor() {
    super("Posten har ändrats eller tagits bort sedan listan laddades. Ladda om och försök igen.");
    this.name = "ItemGoneError";
  }
}

/**
 * Applicera EN ändring och kör befintliga validateArea på resultatet.
 * op = { type: "add"|"update"|"remove", kind, ref?, fields? }
 * @returns {{ ok:boolean, errors:string[], area:object|null }} area = det råa
 *   dokumentet att spara (färsk kopia + ändringen), aldrig validateArea:s value.
 */
export function applyItemOp(area, op) {
  let next;
  try {
    if (op.type === "add") next = addItem(area, op.kind, op.fields);
    else if (op.type === "update") next = updateItem(area, op.kind, op.ref, op.fields);
    else if (op.type === "remove") next = removeItem(area, op.kind, op.ref);
    else throw new Error(`Okänd ändring: ${op.type}`);
  } catch (err) {
    return { ok: false, errors: [err.message], area: null };
  }
  const res = validateArea(next);
  return res.ok ? { ok: true, errors: [], area: next } : { ok: false, errors: res.errors, area: null };
}

const KIND_WORDS = {
  quiz: { none: "inga quizfrågor", mode: "quiz-läget" },
  pairs: { none: "inga par", mode: "Para ihop och Memory" },
  texts: { none: "inga lästexter", mode: "lästexterna" },
};

/** Varning när SISTA posten av en typ tas bort (annars null). */
export function lastItemWarning(area, kind) {
  if (itemsOf(area, kind).length !== 1) return null;
  const w = KIND_WORDS[kind];
  return `Området har då ${w.none} kvar – eleverna ser inte ${w.mode}.`;
}
