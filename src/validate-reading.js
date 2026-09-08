// ============================================================================
// Pluggportalen – validering av läsförståelse-texter i 3 nivåer (validate-reading.js)
// ----------------------------------------------------------------------------
// Läsförståelse 2.0 (issue #152): ett arbetsområde kan ha en lista "readingTexts"
// – läs-texter där SAMMA tema finns i tre språkliga svårighetsnivåer (1 lättast,
// 3 svårast). Varje nivå har en egen brödtext (flera stycken) OCH egna kryssfrågor
// (nivå 1:s frågor ≠ nivå 3:s). Kryssfråga = flerval med exakt ett rätt svar.
//
// Datamodell (per läs-text):
//   { id, title, levels: { "1": Level, "2": Level, "3": Level } }
//   Level    = { body: string, questions: Question[] }   (3–5 frågor)
//   Question = { id, question, options: string[], answerIndex, explanation? }
//
// Bruten ut ur validate.js så att filerna hålls under radtaket och regeln för
// läs-texter kan testas för sig. validate.js anropar validateReadingTexts().
// ============================================================================

// Nivåerna är obligatoriska och alltid dessa tre (samma tema, olika svårighet).
export const READING_LEVELS = ["1", "2", "3"];
// Antal kryssfrågor per nivå-text (håll det lagom kort och likvärdigt per nivå).
export const READING_MIN_Q = 3;
export const READING_MAX_Q = 5;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validera + normalisera frågorna för EN nivå. Fel skjuts in i `errors` med en
 * tydlig prefix (vilken läs-text, vilken nivå, vilken fråga). Returnerar en
 * normaliserad frågelista (ifyllda id, trimmade strängar).
 */
function validateLevelQuestions(input, prefix, errors) {
  const built = [];
  if (!Array.isArray(input)) {
    errors.push(`${prefix}: "questions" måste vara en lista med kryssfrågor.`);
    return built;
  }
  if (input.length < READING_MIN_Q || input.length > READING_MAX_Q) {
    errors.push(
      `${prefix}: håll ${READING_MIN_Q}–${READING_MAX_Q} frågor per nivå (har ${input.length}).`
    );
  }
  input.forEach((q, i) => {
    const qp = `${prefix}, fråga ${i + 1}`;
    if (q === null || typeof q !== "object" || Array.isArray(q)) {
      errors.push(`${qp}: måste vara ett objekt med "question", "options" och "answerIndex".`);
      return;
    }
    if (!isNonEmptyString(q.question))
      errors.push(`${qp}: "question" (frågetexten) saknas eller är tom.`);

    let options = [];
    if (!Array.isArray(q.options)) {
      errors.push(`${qp}: "options" måste vara en lista med svarsalternativ.`);
    } else {
      options = q.options.map((o) => String(o == null ? "" : o).trim());
      if (options.length < 2)
        errors.push(`${qp}: minst 2 svarsalternativ krävs (har ${options.length}).`);
      if (options.some((o) => o.length === 0))
        errors.push(`${qp}: något svarsalternativ är tomt.`);
    }

    const ai = q.answerIndex;
    if (typeof ai !== "number" || !Number.isInteger(ai)) {
      errors.push(`${qp}: "answerIndex" måste vara ett heltal (0 för första alternativet).`);
    } else if (Array.isArray(q.options) && (ai < 0 || ai >= q.options.length)) {
      errors.push(
        `${qp}: "answerIndex" är ${ai} men det finns bara ${q.options.length} alternativ ` +
          `(giltigt: 0–${Math.max(0, q.options.length - 1)}).`
      );
    }

    const b = {
      id: isNonEmptyString(q.id) ? q.id.trim() : `q${i + 1}`,
      question: String(q.question || "").trim(),
      options,
      answerIndex: typeof ai === "number" ? ai : 0,
    };
    if (isNonEmptyString(q.explanation)) b.explanation = q.explanation.trim();
    built.push(b);
  });
  return built;
}

/**
 * Validera + normalisera fältet `readingTexts` på ett arbetsområde.
 *
 * Bakåtkompatibelt: fältet är VALFRITt – saknas det returneras en tom lista och
 * inga fel läggs till (gamla områden utan läs-texter påverkas inte).
 *
 * @param {*} input     obj.readingTexts (rå indata)
 * @param {string[]} errors  fel-lista som fylls på (svenska meddelanden)
 * @param {(s:string)=>string} slugify  slug-hjälparen från validate.js
 * @returns {Array} normaliserad readingTexts-lista
 */
export function validateReadingTexts(input, errors, slugify) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) {
    errors.push('Fältet "readingTexts" måste vara en lista [ ... ] (eller utelämnas).');
    return [];
  }

  const out = [];
  const usedIds = new Set();
  input.forEach((rt, i) => {
    const nr = i + 1;
    if (rt === null || typeof rt !== "object" || Array.isArray(rt)) {
      errors.push(`Läs-text ${nr}: måste vara ett objekt med "title" och "levels".`);
      return;
    }
    if (!isNonEmptyString(rt.title))
      errors.push(`Läs-text ${nr}: "title" (tema/rubrik) saknas eller är tom.`);

    const builtLevels = {};
    const levels = rt.levels;
    if (levels === null || typeof levels !== "object" || Array.isArray(levels)) {
      errors.push(
        `Läs-text ${nr}: "levels" måste vara ett objekt med de tre nivåerna "1", "2" och "3".`
      );
    } else {
      READING_LEVELS.forEach((lvl) => {
        const L = levels[lvl];
        if (L === undefined || L === null) {
          errors.push(
            `Läs-text ${nr}: nivå ${lvl} saknas – alla tre nivåerna (1, 2 och 3) krävs på samma tema.`
          );
          return;
        }
        if (typeof L !== "object" || Array.isArray(L)) {
          errors.push(`Läs-text ${nr}, nivå ${lvl}: måste vara ett objekt med "body" och "questions".`);
          return;
        }
        if (!isNonEmptyString(L.body))
          errors.push(`Läs-text ${nr}, nivå ${lvl}: "body" (texten, gärna flera stycken) saknas eller är tom.`);
        const questions = validateLevelQuestions(L.questions, `Läs-text ${nr}, nivå ${lvl}`, errors);
        builtLevels[lvl] = { body: String(L.body || "").trim(), questions };
      });
    }

    // Unikt id per läs-text (från angivet id, annars temat, annars löpnummer).
    let id = isNonEmptyString(rt.id) ? slugify(rt.id) : slugify(rt.title);
    if (!id) id = `las${nr}`;
    if (usedIds.has(id)) id = `${id}-${nr}`;
    usedIds.add(id);

    out.push({ id, title: String(rt.title || "").trim(), levels: builtLevels });
  });
  return out;
}
