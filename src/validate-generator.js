// ============================================================================
// Pluggporten – validering av räknegenerator-konfigen (validate-generator.js)
// ----------------------------------------------------------------------------
// Issue #279 / #470. Ett generator-område lagrar
//   area.generator = { topics: [{ topic, variants, talstorlek?, bildstod? }, …], grade? }
// – ett eller flera räknesätt som blandas – och sparar INGET färdigt innehåll.
// Det gamla formatet { topic, variants, … } (ett räknesätt) godtas fortfarande.
// Här ges tydliga fel på svenska mot generator-katalogen (listTopics/listVariants
// i exercise-types.js – boot-säker, drar inte in adaptern i bootgrafen, #290);
// själva normaliseringen gör normalizeGenerator.
//
// Bruten ut ur validate.js så att filen hålls under radtaket. validate.js anropar
// validateGenerator().
// ============================================================================

import { normalizeGenerator, listTopics, listVariants } from "./exercise-types.js";

const quoted = (list) => list.map((v) => `"${v}"`).join(", ");

/** Validera ETT räknesätt; fel skjuts in i `errors` med prefixet `where`. */
function checkTopic(t, where, errors, seen) {
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    errors.push(`${where}: varje räknesätt måste vara ett objekt, t.ex. { "topic": "addition", "variants": ["enkel"] }.`);
    return;
  }
  const topics = listTopics();
  const topic = String(t.topic || "").trim();
  if (!topic) {
    errors.push(`${where}: "topic" saknas. Välj en tal-typ: ${quoted(topics)}.`);
    return;
  }
  if (!topics.includes(topic)) {
    errors.push(`${where}: okänt "topic" "${topic}". Giltiga: ${quoted(topics)}.`);
    return;
  }
  if (seen.has(topic)) {
    errors.push(`${where}: räknesättet "${topic}" finns redan – ta med varje räknesätt en gång.`);
    return;
  }
  seen.add(topic);
  const valid = listVariants(topic);
  if (!Array.isArray(t.variants)) {
    errors.push(`${where}: "variants" måste vara en lista med variantnamn, t.ex. ["enkel", "uppstallning"].`);
    return;
  }
  const chosen = t.variants.map((v) => String(v || "").trim()).filter((v) => v.length > 0);
  if (chosen.length === 0) {
    errors.push(`${where}: kryssa i minst en variant för "${topic}". Giltiga: ${quoted(valid)}.`);
    return;
  }
  const unknown = chosen.filter((v) => !valid.includes(v));
  if (unknown.length > 0) {
    errors.push(`${where}: okänd(a) variant(er) ${quoted(unknown)} för "${topic}". Giltiga: ${quoted(valid)}.`);
  }
}

/**
 * Validera + normalisera area.generator. Saknas fältet → null utan fel.
 * @param {*} g – rå area.generator (nytt eller gammalt format)
 * @param {string[]} errors – fel skjuts in här
 * @returns {object|null} normaliserad generator (null om fel/saknas – då finns
 *   redan ett tydligt felmeddelande i errors, så området ändå inte sparas)
 */
export function validateGenerator(g, errors) {
  if (g === undefined || g === null) return null;
  if (typeof g !== "object" || Array.isArray(g)) {
    errors.push('Fältet "generator" måste vara ett objekt, t.ex. { "topics": [{ "topic": "addition", "variants": ["enkel"] }] }.');
    return null;
  }
  const seen = new Set();
  if ("topics" in g) {
    if (!Array.isArray(g.topics) || g.topics.length === 0) {
      errors.push('Generator: "topics" måste vara en lista med minst ett räknesätt, t.ex. [{ "topic": "addition", "variants": ["enkel"] }].');
      return null;
    }
    g.topics.forEach((t, i) => checkTopic(t, `Generator (räknesätt ${i + 1})`, errors, seen));
  } else {
    checkTopic(g, "Generator", errors, seen); // gammalt format: ett räknesätt
  }
  return normalizeGenerator(g);
}
