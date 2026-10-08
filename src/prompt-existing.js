// ============================================================================
// Pluggporten – "BEFINTLIGT INNEHÅLL"-block till AI-prompterna (prompt-existing.js)
// ----------------------------------------------------------------------------
// Issue #471. När läraren ber AI:n om MER innehåll till ett befintligt område
// (buildMorePrompt) skickas ALLT som redan finns med – fråga + alternativ + rätt
// svar + kategori + passage, par med term + definition och texter – så AI:n ser
// hela bilden och inte
// upprepar något. Formatet är kompakt JSON (ett objekt per rad) i samma format
// som AI:n själv ska svara i, så det är både maskinläsbart och lätt att härma.
//
// Taket är generöst (tecken, inte rader) och slår bara in för extrema områden;
// då kortas listorna rättvist (turvis per typ) och blocket får en tydlig notering
// om hur mycket som utelämnades. Bara lärarsidan – aldrig i elevens bootgraf.
// ============================================================================

import { normalizeGenerator } from "./exercise-types.js";
import { topicLabel, variantLabel } from "./teacher-generator-labels.js";

// Tak för JSON-blocket i tecken. ~70k tecken ≈ 20k tokens – ryms i alla vanliga
// AI-chattar och räcker för hundratals frågor; bara jätteområden kortas.
export const EXISTING_MAX_CHARS = 70000;

/** Svenska ord per lista, för avkortnings-noteringen. */
const WORDS = {
  texts: ["text", "texter"],
  quiz: ["quizfråga", "quizfrågor"],
  pairs: ["par", "par"],
};

const str = (v) => (typeof v === "string" ? v.trim() : "");

/** Plocka de fält som bär innehåll; tomma strängar/listor utelämnas. */
function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string") {
      if (v.trim()) out[k] = v.trim();
    } else if (Array.isArray(v)) {
      if (v.length) out[k] = v.map((x) => (typeof x === "string" ? x.trim() : x));
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

const QUIZ_KEYS = ["question", "options", "answerIndex", "category", "passage", "explanation"];
const PAIR_KEYS = ["term", "definition", "termImage", "defImage", "group"];
const TEXT_KEYS = ["title", "body"];

const COMPACT = {
  texts: (t) => pick(t, TEXT_KEYS),
  quiz: (q) => pick(q, QUIZ_KEYS),
  pairs: (p) => pick(p, PAIR_KEYS),
};

/**
 * Bygg JSON-blocket med befintligt innehåll.
 *
 * @param {object} source – objekt med listorna (t.ex. området).
 * @param {string[]} kinds – vilka listor som tas med, i ordning
 *   ("texts" | "quiz" | "pairs").
 * @param {number} [maxChars] – tak för blocket i tecken.
 * @returns {{ json: string, count: number, omitted: Record<string, number> }}
 *   json = giltig JSON (tom sträng om inget finns), count = antal poster som
 *   kom med, omitted = antal utelämnade poster per lista (bara vid avkortning).
 */
export function existingContentJson(source, kinds, maxChars = EXISTING_MAX_CHARS) {
  const rows = {};
  for (const k of kinds) {
    rows[k] = (Array.isArray(source?.[k]) ? source[k] : [])
      .map((x) => COMPACT[k](x))
      .filter((x) => Object.keys(x).length)
      .map((x) => JSON.stringify(x));
  }
  const present = kinds.filter((k) => rows[k].length);
  if (!present.length) return { json: "", count: 0, omitted: {} };

  // Fyll turvis (en post per lista och varv) så att alla typer får plats även när
  // taket slår in. En lista som inte får plats med nästa post stängs.
  const taken = Object.fromEntries(present.map((k) => [k, 0]));
  const open = new Set(present);
  let used = 4 + present.reduce((n, k) => n + k.length + 12, 0); // skal + nycklar
  while (open.size) {
    for (const k of present) {
      if (!open.has(k)) continue;
      const row = rows[k][taken[k]];
      if (row === undefined || used + row.length + 6 > maxChars) {
        open.delete(k);
        continue;
      }
      used += row.length + 6;
      taken[k] += 1;
    }
  }

  const omitted = {};
  for (const k of present) if (taken[k] < rows[k].length) omitted[k] = rows[k].length - taken[k];
  const json = `{\n${present
    .map((k) => `  "${k}": [${taken[k] ? `\n${rows[k].slice(0, taken[k]).map((r) => `    ${r}`).join(",\n")}\n  ` : ""}]`)
    .join(",\n")}\n}`;
  const count = present.reduce((n, k) => n + taken[k], 0);
  return { json, count, omitted };
}

/** "120 quizfrågor och 4 texter" ur omitted-räknarna. */
function omittedText(omitted) {
  const parts = Object.entries(omitted).map(([k, n]) => `${n} ${WORDS[k][n === 1 ? 0 : 1]}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} och ${parts.at(-1)}` : parts[0];
}

/**
 * Hela prompt-blocket: rubrik + JSON + ev. avkortnings-notering. Tom sträng om
 * inget finns.
 * @param {object} source – se existingContentJson.
 * @param {string[]} kinds – se existingContentJson.
 * @param {string} rubrik – rubrikrad ovanför JSON:en.
 * @param {number} [maxChars]
 * @returns {string}
 */
export function existingContentBlock(source, kinds, rubrik, maxChars = EXISTING_MAX_CHARS) {
  const { json, omitted } = existingContentJson(source, kinds, maxChars);
  if (!json) return "";
  const kortat = Object.keys(omitted).length
    ? `\n\nOBS: Området är mycket stort, så av utrymmesskäl visas inte allt ovan – ${omittedText(
        omitted
      )} utelämnades. Även det innehållet finns redan: håll dig därför extra långt från de ämnen och begrepp som syns ovan.`
    : "";
  return `BEFINTLIGT INNEHÅLL – ${rubrik}\n${json}${kortat}`;
}

/**
 * Kontextrad om områdets räknegenerator (#470), eller tom sträng. Generatorn
 * skapar matteuppgifter automatiskt – AI:n ska känna till räknesätten men inte
 * skriva egna räkneuppgifter som bara dubblerar dem.
 * @param {object} area
 * @returns {string}
 */
export function generatorContext(area) {
  const gen = normalizeGenerator(area?.generator);
  if (!gen) return "";
  const lista = gen.topics
    .map((t) => `${topicLabel(t.topic)} (${t.variants.map(variantLabel).join(", ")})`)
    .join("; ");
  return `Området har också en räknegenerator som skapar matteuppgifter automatiskt, med räknesätten: ${lista}. Skriv inte egna räkneuppgifter som bara dubblerar dem – frågor och par får gärna knyta an till samma matteinnehåll (begrepp, strategier, vardagsexempel).`;
}
