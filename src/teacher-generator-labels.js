// ============================================================================
// Pluggporten – lärarsidan: visningsnamn för räknegeneratorn (teacher-generator-labels.js)
// ----------------------------------------------------------------------------
// Issue #470. Små, rena hjälpare som gör generator-katalogens ASCII-nycklar
// ("negativa-tal", "matt-langd", "stora-tal") läsbara, plus en kort sammanfattning
// av ett områdes räknesätt ("Addition + Subtraktion · 5 varianter"). Delas av
// räknegenerator-kontrollen, wizardens sammanfattning och område-listorna så alla
// visar samma namn. Bara lärarsidan (dynamiskt laddad) – aldrig i elevens bootgraf.
// ============================================================================

import { normalizeGenerator } from "./exercise-types.js";

// Topics vars nyckel inte blir snygg av "bindestreck → blanksteg + versal".
const TOPIC_LABELS = {
  talfoljd: "Talföljd",
  "oppna-utsaga": "Öppna utsagor",
  "matt-langd": "Mätning: längd",
  "matt-vikt": "Mätning: vikt",
  "matt-tid": "Mätning: tid",
  "matt-area": "Mätning: area",
  "matt-volym": "Mätning: volym",
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Visningsnamn för ett topic ("negativa-tal" → "Negativa tal"). */
export function topicLabel(name) {
  const s = String(name || "");
  return TOPIC_LABELS[s] || cap(s.replace(/-/g, " "));
}

/** Visningsnamn för en variant ("stora-tal" → "Stora tal"). */
export function variantLabel(name) {
  return cap(String(name || "").replace(/-/g, " "));
}

/**
 * Kort sammanfattning av ett områdes räknegenerator, eller null om den saknas.
 * @param {*} generator – rå eller normaliserad area.generator (nytt/gammalt format)
 * @returns {{topics:string, variants:number, count:number}|null}
 *   topics = "Addition + Subtraktion", variants = totalt antal valda varianter.
 */
export function generatorSummary(generator) {
  const gen = normalizeGenerator(generator);
  if (!gen) return null;
  return {
    topics: gen.topics.map((t) => topicLabel(t.topic)).join(" + "),
    variants: gen.topics.reduce((n, t) => n + t.variants.length, 0),
    count: gen.topics.length,
  };
}
