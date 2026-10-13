// ============================================================================
// Ämnesläsning – lärarens innehåll (src/amneslasning/content.js)  ·  #673
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/amneslasning-content.test.js.
// Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §6–7.
//
// Ämnestexterna ligger i area.readingTexts (INTE area.texts, som är faktatexter
// utan frågor). Formatet är Läsresans innehållskontrakt med ämnesnivå 1–3:
//   { id, title, level (1–3), textType ("fact"|"story"), body,
//     questions: [{ id, question, options: [4], answerIndex, category }] }
// så att renderReader visar en ämnestext utan omvandling.
//
// Valideringen ÅTERANVÄNDER Läsresans validateText/bankWarnings
// (src/lasresan/content/validate.js) med ämnesläsningens regler ur config.js:
//   FEL (texten sparas inte): fel antal alternativ, answerIndex utanför,
//     nivå utanför 1–3, okänd kategori/textType, tomma fält, dubblett-id på
//     en fråga, text utan frågor.
//   VARNINGAR (texten kan sparas): ordantal, antal frågor, svarsposition,
//     längdledtråd, för få texter på en nivå, samma titel som en befintlig text.
// Text-id som saknas skapas ur titeln, och id som krockar (med områdets
// befintliga texter eller inom det inklistrade) görs om automatiskt.
//
// GAMLA NIVÅTEXTER: fältnamnet readingTexts användes förr (#152, borttaget i
// #531) för { id, title, levels: { 1: {body, questions}, … } }. Äldre dokument
// kan ha kvar sådana poster. De känns igen (isLegacyReadingText), räknas aldrig
// som ämnestexter och valideras inte (validateArea släpper dem som förut).
//
// Sparandet följer samma kontrakt som underraderna (teacher-area-items-ops.js):
// färsk kopia av området → ENBART ändringen här → validateArea som grind →
// hela dokumentet skrivs. Befintliga texter skrivs aldrig över.
// ============================================================================

import {
  AMNES_ANSWER_SKEW_MIN_QUESTIONS,
  AMNES_FIELD_ON_AREA,
  AMNES_LEVELS,
  AMNES_MIN_TEXTS_PER_LEVEL,
  AMNES_QUESTIONS_BY_LEVEL,
  AMNES_TEXTS_PER_LEVEL_DEFAULT,
  AMNES_TEXTS_PER_LEVEL_RANGE,
  AMNES_WORD_RANGES,
  CATEGORIES,
  OPTIONS_PER_QUESTION,
  TEXT_TYPES,
} from "../lasresan/config.js";
import { bankWarnings, validateText, wordCount } from "../lasresan/content/validate.js";
import { normalizeExerciseTypes } from "../exercise-types.js";
import { parseAmnesLevel } from "./level.js";

export { wordCount };

/** Övningstypens id (src/exercise-types.js). */
export const AMNES_TYPE_ID = "amneslasning";

const str = (v) => (v == null ? "" : String(v));
const trim = (v) => str(v).trim();

/** Gammal nivåtext (#152): `levels`-objekt och inga egna frågor. */
export function isLegacyReadingText(t) {
  return !!t && typeof t === "object" && !!t.levels && typeof t.levels === "object" && !Array.isArray(t.questions);
}

/** En sparad ämnestext (har egna frågor) – inte en gammal nivåtext. */
export function isAmnesText(t) {
  return !!t && typeof t === "object" && Array.isArray(t.questions) && !isLegacyReadingText(t);
}

/**
 * Spelbar ämnestext (elevens textval, src/amneslasning/picker.js): en ämnestext
 * med id, ämnesnivå 1–3 och minst en fråga. Sparade texter är validerade så.
 * gamemode-visibility.js (bootgrafen, får inte importera hit, #271) har samma
 * regel inline – test/amneslasning-content.test.js jämför dem.
 */
export function isPlayableAmnesText(t) {
  return isAmnesText(t) && typeof t.id === "string" && !!t.id && parseAmnesLevel(t.level) !== null && t.questions.length > 0;
}

/** Hela fältet som det ligger i dokumentet (även gamla nivåtexter), som ny array. */
function rawReadingTexts(area) {
  const list = area?.[AMNES_FIELD_ON_AREA];
  return Array.isArray(list) ? [...list] : [];
}

/** Områdets ämnestexter (alltid en ny array, utan gamla nivåtexter). */
export function readingTextsOf(area) {
  return rawReadingTexts(area).filter(isAmnesText);
}

/** Antal texter per nivå i panelen, inom [min, max] (förval 3). */
export function normalizeTextsPerLevel(n) {
  const [min, max] = AMNES_TEXTS_PER_LEVEL_RANGE;
  const v = n == null || trim(n) === "" ? NaN : Number(n);
  if (!Number.isInteger(v)) return AMNES_TEXTS_PER_LEVEL_DEFAULT;
  return Math.min(max, Math.max(min, v));
}

/** Slug för id: gemener, bindestreck, a–z0–9 (samma form som validate.slugify). */
export function slugId(s) {
  return trim(s)
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[éè]/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Vanliga stavningar (AI eller lärare) → Läsresans kategorinyckel.
const CATEGORY_ALIASES = {
  ordförståelse: "ordforstaelse",
  "mellan raderna": "mellan_raderna",
  "helhet/slutsats": "helhet_slutsats",
  helhet: "helhet_slutsats",
  slutsats: "helhet_slutsats",
};

/** Tolka en kategori till Läsresans nyckel; okänt värde lämnas (→ fel i valideringen). */
export function normalizeCategory(raw) {
  const k = trim(raw).toLowerCase();
  if (CATEGORIES.includes(k)) return k;
  if (CATEGORY_ALIASES[k]) return CATEGORY_ALIASES[k];
  const underscored = k.replace(/[\s-]+/g, "_");
  return CATEGORIES.includes(underscored) ? underscored : trim(raw);
}

/** answerIndex som heltal ("2" → 2); annat lämnas så valideringen säger ifrån. */
function toIndex(v) {
  if (typeof v === "string" && /^\s*\d+\s*$/.test(v)) return Number(v);
  return v;
}

/**
 * Normalisera EN text (trimma, nivå "2" → 2, saknad textType → "fact",
 * saknade fråge-id → q1, q2 …). Ogiltiga värden lämnas så valideringen ser dem.
 */
export function normalizeReadingText(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const level = parseAmnesLevel(raw.level) ?? raw.level;
  const textType = trim(raw.textType) || "fact";
  const qs = raw.questions;
  const questions = Array.isArray(qs)
    ? qs.map((q, i) =>
        q && typeof q === "object" && !Array.isArray(q)
          ? {
              id: trim(q.id) || `q${i + 1}`,
              question: trim(q.question),
              options: Array.isArray(q.options) ? q.options.map((o) => trim(o)) : q.options,
              answerIndex: toIndex(q.answerIndex),
              category: normalizeCategory(q.category),
            }
          : q
      )
    : qs;
  return {
    id: slugId(raw.id) || slugId(raw.title),
    title: trim(raw.title),
    level,
    textType,
    body: str(raw.body).replace(/\r\n/g, "\n").trim(),
    questions,
  };
}

/** Ämnesläsningens regler till Läsresans validateText. */
function rulesFor(tag) {
  return {
    levels: AMNES_LEVELS,
    wordRanges: AMNES_WORD_RANGES,
    questionRange: (level) => AMNES_QUESTIONS_BY_LEVEL[level] || AMNES_QUESTIONS_BY_LEVEL[AMNES_LEVELS[0]],
    questionCountIsWarning: true,
    requireTopic: false,
    tag,
  };
}

/** Gör meddelandena begripliga för läraren (giltiga värden, svenska ord). */
function explain(msg) {
  if (/okänd kategori/.test(msg)) return `${msg} – giltiga: ${CATEGORIES.join(", ")}`;
  return msg
    .replace(/: title saknas$/, ": rubriken (title) saknas")
    .replace(/: body saknas$/, ": texten (body) saknas")
    .replace(/: question saknas$/, ": frågetexten saknas")
    .replace(/: questions saknas$/, ": frågorna (questions) saknas");
}

/** Ett id som inte finns i `used` (vikingar → vikingar-2 → vikingar-3 …). Lägger till det. */
function uniqueId(base, used) {
  const root = base || "amnestext";
  let id = root;
  for (let n = 2; used.has(id); n++) id = `${root}-${n}`;
  used.add(id);
  return id;
}

/** Antal texter per ämnesnivå: { 1: n, 2: n, 3: n }. */
export function levelCounts(texts) {
  const out = Object.fromEntries(AMNES_LEVELS.map((l) => [l, 0]));
  for (const t of texts || []) if (t && out[t.level] !== undefined) out[t.level] += 1;
  return out;
}

/**
 * Varningar för nivåer med för få texter (spec §6.3/§7.2): "saknar texter" vid
 * 0, annars "bara N" under AMNES_MIN_TEXTS_PER_LEVEL.
 * @returns {{level:number, count:number, message:string}[]}
 */
export function levelGaps(texts, min = AMNES_MIN_TEXTS_PER_LEVEL) {
  const counts = levelCounts(texts);
  const out = [];
  for (const level of AMNES_LEVELS) {
    const n = counts[level];
    if (n === 0) out.push({ level, count: n, message: `Nivå ${level} saknar texter – elever på den nivån får texter från en annan nivå.` });
    else if (n < min) out.push({ level, count: n, message: `Nivå ${level} har bara ${n} text${n === 1 ? "" : "er"} (minst ${min} rekommenderas).` });
  }
  return out;
}

/**
 * Validera ämnestexter – inklistrade från AI:n, eller hela områdets lista.
 *
 * @param {*} list – texterna (rå JSON).
 * @param {object} [opts]
 * @param {object[]} [opts.existing] – områdets befintliga texter: id krockar görs
 *   om, och nivåvarningarna räknas på befintliga + nya.
 * @param {number|null} [opts.expectedPerLevel] – lärarens antal per nivå (varna
 *   om AI:n gav färre).
 * @param {string} [opts.label] – ord för texten i meddelandena ("Text", "Ämnestext").
 * @returns {{ ok:boolean, errors:string[], warnings:string[],
 *   items:{index:number, text:object, errors:string[], warnings:string[], renamedFrom:string|null}[],
 *   valid:object[], perLevel:object }}
 *   ok = inga fel alls; valid = texterna utan fel (normaliserade, unika id).
 */
export function validateReadingTexts(list, { existing: existingRaw = [], expectedPerLevel = null, label = "Text" } = {}) {
  if (!Array.isArray(list)) {
    return {
      ok: false,
      errors: [`"${AMNES_FIELD_ON_AREA}" måste vara en lista [ ... ] med texter.`],
      warnings: [],
      items: [],
      valid: [],
      perLevel: levelCounts([]),
    };
  }
  const raw = Array.isArray(existingRaw) ? existingRaw : [];
  const used = new Set(raw.map((t) => trim(t?.id)).filter(Boolean));
  const existing = raw.filter(isAmnesText);
  const existingTitles = new Set(existing.map((t) => trim(t?.title).toLowerCase()).filter(Boolean));
  const items = list.map((raw, index) => {
    const text = normalizeReadingText(raw);
    const title = text && typeof text === "object" ? text.title : "";
    const tag = `${label} ${index + 1}${title ? ` ("${title}")` : ""}`;
    let renamedFrom = null;
    if (text && typeof text === "object" && !Array.isArray(text)) {
      const base = text.id;
      text.id = uniqueId(base, used);
      if (base && text.id !== base) renamedFrom = base;
    }
    const res = validateText(text, rulesFor(tag));
    const errors = res.errors.map(explain);
    const warnings = [...res.warnings];
    if (text && typeof text === "object" && Array.isArray(text.questions)) {
      text.questions.forEach((q, i) => {
        if (q && Array.isArray(q.options) && q.options.length !== OPTIONS_PER_QUESTION) {
          // validateText säger "exakt 4" – lägg till hur många det var.
          const at = errors.findIndex((e) => e.includes(`fråga ${q.id || i + 1}:`) && e.includes("alternativ"));
          if (at >= 0) errors[at] += ` (har ${q.options.length})`;
        }
      });
    }
    if (title && existingTitles.has(title.toLowerCase())) {
      warnings.push(`${tag}: området har redan en text med samma rubrik`);
    }
    return { index, text, errors, warnings, renamedFrom };
  });

  const valid = items.filter((it) => it.errors.length === 0).map((it) => it.text);
  const errors = items.flatMap((it) => it.errors);
  const warnings = items.flatMap((it) => it.warnings);
  // Svarsposition + längdledtråd per nivå, på allt som området får efter sparning.
  const all = [...existing, ...valid];
  warnings.push(...bankWarnings(all, { minQuestions: AMNES_ANSWER_SKEW_MIN_QUESTIONS }).warnings);
  const perLevel = levelCounts(valid);
  if (expectedPerLevel) {
    for (const level of AMNES_LEVELS) {
      if (perLevel[level] < expectedPerLevel) {
        warnings.push(`nivå ${level}: ${perLevel[level]} giltiga texter av ${expectedPerLevel} begärda`);
      }
    }
  }
  if (valid.length) warnings.push(...levelGaps(all).map((g) => g.message));
  return { ok: errors.length === 0, errors, warnings, items, valid, perLevel };
}

/**
 * Tolka lärarens inklistrade AI-svar. Tål ```-kodstaket och text runt JSON:en,
 * och accepterar både { "readingTexts": [...] } och en ensam lista [...].
 * @returns {{ok:boolean, errors:string[], list:object[]|null}}
 */
export function parseReadingTextsPaste(input) {
  let s = trim(input);
  if (!s) return { ok: false, errors: ["Klistra in AI:ns svar först."], list: null };
  s = s.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  const first = s.search(/[[{]/);
  const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (first < 0 || last < first) {
    return { ok: false, errors: ["Hittar ingen JSON i texten. Klistra in hela AI-svaret, från { till }."], list: null };
  }
  let obj;
  try {
    obj = JSON.parse(s.slice(first, last + 1));
  } catch (e) {
    return {
      ok: false,
      errors: [
        `Texten är inte giltig JSON: ${e.message}. Tips: kontrollera att alla { } och [ ] hör ihop och att det inte finns extra kommatecken.`,
      ],
      list: null,
    };
  }
  const list = Array.isArray(obj) ? obj : obj?.[AMNES_FIELD_ON_AREA];
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, errors: [`Svaret saknar texter – det ska ha formen { "${AMNES_FIELD_ON_AREA}": [ ... ] }.`], list: null };
  }
  return { ok: true, errors: [], list };
}

/** Övningstyperna efter att området fått ämnestexter: lägg till typen om läraren valt typer. */
function withAmnesType(area) {
  const stored = normalizeExerciseTypes(area?.exerciseTypes);
  if (!stored.length || stored.includes(AMNES_TYPE_ID)) return area?.exerciseTypes;
  return normalizeExerciseTypes([...stored, AMNES_TYPE_ID]);
}

/**
 * Lägg till texter sist i områdets lista. Befintliga texter rörs aldrig; id som
 * krockar görs om (igen, mot den FÄRSKA listan). Returnerar ett NYTT område.
 */
export function addReadingTexts(area, texts) {
  const existing = rawReadingTexts(area);
  const used = new Set(existing.map((t) => trim(t?.id)).filter(Boolean));
  const added = (texts || []).map((t) => ({ ...t, id: uniqueId(slugId(t.id) || slugId(t.title), used) }));
  const next = { ...area, [AMNES_FIELD_ON_AREA]: [...existing, ...added] };
  const types = withAmnesType(area);
  if (types !== undefined) next.exerciseTypes = types;
  return next;
}

/**
 * Ersätt EN text (hittad på id) med redigerade fält. Id:t behålls. Kastar om
 * texten inte längre finns.
 */
export function updateReadingText(area, id, fields) {
  const list = rawReadingTexts(area);
  const i = list.findIndex((t) => trim(t?.id) === trim(id));
  if (i < 0) throw new Error("Texten har tagits bort sedan listan laddades. Ladda om och försök igen.");
  list[i] = { ...normalizeReadingText({ ...list[i], ...fields }), id: list[i].id };
  return { ...area, [AMNES_FIELD_ON_AREA]: list };
}

/** Ta bort EN text (på id). Kastar om den inte finns. */
export function removeReadingText(area, id) {
  const list = rawReadingTexts(area);
  const i = list.findIndex((t) => trim(t?.id) === trim(id));
  if (i < 0) throw new Error("Texten har redan tagits bort. Ladda om sidan.");
  list.splice(i, 1);
  return { ...area, [AMNES_FIELD_ON_AREA]: list };
}

/** Tom fråga till redigeringsformuläret. */
export function blankQuestion(n = 1) {
  return { id: `q${n}`, question: "", options: Array(OPTIONS_PER_QUESTION).fill(""), answerIndex: 0, category: CATEGORIES[0] };
}

export { AMNES_LEVELS, CATEGORIES, TEXT_TYPES, OPTIONS_PER_QUESTION };
