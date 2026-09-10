// ============================================================================
// Pluggportalen – validering av arbetsområdes-JSON (validate.js)
// ----------------------------------------------------------------------------
// Läraren klistrar in / laddar upp en JSON för ett arbetsområde. Här kontrollerar
// vi att den passar datamodellen (se docs/DATAMODELL.md) och ger TYDLIGA
// felmeddelanden på svenska. Målet: en lärare (eller en AI-genererad JSON) ska
// förstå exakt vad som är fel och var.
//
//   validateArea(obj)  ->  { ok, errors: string[], value }
//
// `value` är en normaliserad, sparklar variant (ids ifyllda, standardvärden
// satta, trimmade strängar) som är redo att spara till Firestore.
// ============================================================================

import { isKnownPairImage, listPairImageKeys } from "./pair-images.js";
import { normalizeExerciseTypes, deriveExerciseTypes, normalizeGenerator } from "./exercise-types.js";
import { listTopics, listVariants } from "./matte-generator.js";
import { validateReadingTexts } from "./validate-reading.js";
import { normalizeReadingPrereq } from "./reading-prereq.js";
import { normalizeGrade } from "./grades.js";
import { normalizeHiddenModes } from "./gamemode-visibility.js";

/** Gör en läsbar sträng till ett slug-id: gemener, bindestreck, a–z0–9. */
export function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[éè]/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Kommaseparerad lista över giltiga bildnycklar, för felmeddelanden. */
function validImageKeys() {
  return listPairImageKeys()
    .map((x) => `"${x.key}"`)
    .join(", ");
}

/**
 * Validera och normalisera ett arbetsområde.
 * @param {*} obj Redan JSON-parsat objekt (inte en sträng).
 * @returns {{ ok: boolean, errors: string[], value: object|null }}
 */
export function validateArea(obj) {
  const errors = [];

  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      ok: false,
      errors: [
        "JSON måste vara ett objekt med ett arbetsområde ({ ... }), inte en lista eller ett ensamt värde.",
      ],
      value: null,
    };
  }

  // --- Namn (obligatoriskt) -------------------------------------------------
  if (!isNonEmptyString(obj.name)) {
    errors.push('Fältet "name" saknas eller är tomt – ange arbetsområdets namn, t.ex. "Vikingatiden".');
  }

  // --- Id (härleds från namnet om det saknas) ------------------------------
  let id = isNonEmptyString(obj.id) ? slugify(obj.id) : slugify(obj.name);
  if (!id) {
    errors.push('Kunde inte skapa ett id. Lägg till ett "id" (t.ex. "vikingatiden") eller ett giltigt "name".');
  }

  // --- Enkla fält -----------------------------------------------------------
  let order = obj.order;
  if (order !== undefined && order !== null && typeof order !== "number") {
    const n = Number(order);
    if (Number.isFinite(n)) order = n;
    else errors.push('Fältet "order" måste vara ett tal (eller utelämnas).');
  }

  const coverEmoji = isNonEmptyString(obj.coverEmoji) ? obj.coverEmoji.trim() : "📖";
  const description = typeof obj.description === "string" ? obj.description.trim() : "";

  // --- Årskurs (valfri, bakåtkompatibel) ------------------------------------
  // Saknas fältet, eller är det okänt/tomt, räknas området som "ospecificerad"
  // (null). Inget fel rapporteras – fältet är en valfri styrning (issue #145).
  const grade = normalizeGrade(obj.grade);

  // --- Synliga lägen (valfri, bakåtkompatibel) ------------------------------
  // Läraren kan bocka UR spellägen per område (issue #200). "hiddenModes" är en
  // lista med mode-id som ska döljas i elevvyn. Saknas fältet (eller är listan
  // tom) visas alla tillgängliga lägen som förr. Okända/tomma id rensas bort;
  // inget fel rapporteras (valfri styrning, jfr grade ovan).
  const hiddenModes = normalizeHiddenModes(obj.hiddenModes);

  // --- texts[] --------------------------------------------------------------
  const texts = [];
  if (obj.texts !== undefined) {
    if (!Array.isArray(obj.texts)) {
      errors.push('Fältet "texts" måste vara en lista [ ... ].');
    } else {
      obj.texts.forEach((t, i) => {
        const nr = i + 1;
        if (t === null || typeof t !== "object" || Array.isArray(t)) {
          errors.push(`Text ${nr}: måste vara ett objekt med "title" och "body".`);
          return;
        }
        if (!isNonEmptyString(t.title))
          errors.push(`Text ${nr}: "title" (rubrik) saknas eller är tom.`);
        if (!isNonEmptyString(t.body))
          errors.push(`Text ${nr}: "body" (brödtext) saknas eller är tom.`);
        texts.push({
          id: isNonEmptyString(t.id) ? slugify(t.id) : `t${nr}`,
          title: String(t.title || "").trim(),
          body: String(t.body || "").trim(),
        });
      });
    }
  }

  // --- quiz[] ---------------------------------------------------------------
  const quiz = [];
  if (obj.quiz !== undefined) {
    if (!Array.isArray(obj.quiz)) {
      errors.push('Fältet "quiz" måste vara en lista [ ... ].');
    } else {
      obj.quiz.forEach((q, i) => {
        const nr = i + 1;
        if (q === null || typeof q !== "object" || Array.isArray(q)) {
          errors.push(`Fråga ${nr}: måste vara ett objekt med "question", "options" och "answerIndex".`);
          return;
        }
        if (!isNonEmptyString(q.question))
          errors.push(`Fråga ${nr}: "question" (frågetexten) saknas eller är tom.`);

        let options = [];
        if (!Array.isArray(q.options)) {
          errors.push(`Fråga ${nr}: "options" måste vara en lista med svarsalternativ.`);
        } else {
          options = q.options.map((o) => String(o == null ? "" : o).trim());
          if (options.length < 2)
            errors.push(`Fråga ${nr}: minst 2 svarsalternativ krävs (har ${options.length}).`);
          if (options.some((o) => o.length === 0))
            errors.push(`Fråga ${nr}: något svarsalternativ är tomt.`);
        }

        const ai = q.answerIndex;
        if (typeof ai !== "number" || !Number.isInteger(ai)) {
          errors.push(`Fråga ${nr}: "answerIndex" måste vara ett heltal (0 för första alternativet).`);
        } else if (Array.isArray(q.options) && (ai < 0 || ai >= q.options.length)) {
          errors.push(
            `Fråga ${nr}: "answerIndex" är ${ai} men det finns bara ${q.options.length} alternativ (giltigt: 0–${Math.max(0, q.options.length - 1)}).`
          );
        }

        const built = {
          id: isNonEmptyString(q.id) ? slugify(q.id) : `q${nr}`,
          question: String(q.question || "").trim(),
          options,
          answerIndex: typeof ai === "number" ? ai : 0,
          explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
        };
        // "passage" är källtexten som just denna fråga bygger på, visad ovanför
        // frågan i läsförståelse-läget. Tas bara med när den finns; obligatoriskheten
        // (för läsförståelse) kontrolleras samlat nedan.
        if (isNonEmptyString(q.passage)) built.passage = q.passage.trim();
        quiz.push(built);
      });

      // --- Passage = läsförståelse-fråga, ingen passage = räkne-/vanlig fråga
      // En och samma quiz-lista används av alla frågelägen, men de HÅLLS ISÄR på
      // "passage"-fältet: frågor MED passage kör bara i Läsförståelse (källtexten
      // visas ovanför frågan), frågor UTAN passage kör i Quiz/Kunskapsjakt/Fånga
      // sanningar (ingen text att läsa). Se plainQuizPool i src/game-shared.js och
      // startLasforstaelse i src/games-quiz.js. Därför är det HELT OK att blanda
      // frågor med och utan passage i samma område – lägena serverar rätt delmängd
      // och en läsförståelse-fråga kan aldrig hamna i Quiz utan sin synliga text.
      // (Tidigare krävdes passage på ALLA eller INGEN fråga; den regeln är borta nu
      // när uppdelningen sker per läge i stället.)
    }
  }

  // --- pairs[] --------------------------------------------------------------
  const pairs = [];
  if (obj.pairs !== undefined) {
    if (!Array.isArray(obj.pairs)) {
      errors.push('Fältet "pairs" måste vara en lista [ ... ].');
    } else {
      obj.pairs.forEach((p, i) => {
        const nr = i + 1;
        if (p === null || typeof p !== "object" || Array.isArray(p)) {
          errors.push(`Par ${nr}: måste vara ett objekt med "term" och "definition".`);
          return;
        }

        // Valfria bildfält: en nyckel in i bildpaketet (pair-images.js). Ett par
        // kan ha en bild på term- och/eller definition-sidan. Varje sida måste ha
        // ANTINGEN text ELLER bild (eller båda) – annars är sidan tom.
        const hasTermImage = isNonEmptyString(p.termImage);
        const hasDefImage = isNonEmptyString(p.defImage);
        const termKey = hasTermImage ? p.termImage.trim() : "";
        const defKey = hasDefImage ? p.defImage.trim() : "";

        if (hasTermImage && !isKnownPairImage(termKey)) {
          errors.push(
            `Par ${nr}: okänd bildnyckel "${termKey}" i "termImage". Giltiga nycklar: ${validImageKeys()}.`
          );
        }
        if (hasDefImage && !isKnownPairImage(defKey)) {
          errors.push(
            `Par ${nr}: okänd bildnyckel "${defKey}" i "defImage". Giltiga nycklar: ${validImageKeys()}.`
          );
        }

        // Regel: term får vara tom OM termImage finns (samma för definition/defImage).
        if (!isNonEmptyString(p.term) && !hasTermImage)
          errors.push(`Par ${nr}: term-sidan är tom – ange "term" (begreppet) eller en bild i "termImage".`);
        if (!isNonEmptyString(p.definition) && !hasDefImage)
          errors.push(
            `Par ${nr}: definition-sidan är tom – ange "definition" (förklaringen) eller en bild i "defImage".`
          );

        const built = {
          id: isNonEmptyString(p.id) ? slugify(p.id) : `p${nr}`,
          term: String(p.term || "").trim(),
          definition: String(p.definition || "").trim(),
        };
        // Bildfälten tas bara med när de finns (bakåtkompatibelt).
        if (hasTermImage) built.termImage = termKey;
        if (hasDefImage) built.defImage = defKey;
        // Valfritt: "group" markerar ömsesidigt uteslutande par. Par med samma
        // group visas aldrig samtidigt i en och samma spelomgång (Para ihop/Memory
        // plockar högst ett par per group). Tas bara med när den finns
        // (bakåtkompatibelt, precis som termImage/defImage).
        if (isNonEmptyString(p.group)) built.group = p.group.trim();
        pairs.push(built);
      });
    }
  }

  // --- readingTexts[] (läsförståelse 2.0, 3 nivåer) -------------------------
  // Valfritt fält: läs-texter där samma tema finns i tre svårighetsnivåer, var
  // och en med egen brödtext + egna kryssfrågor. Bakåtkompatibelt (saknas fältet
  // → tom lista). Regeln bor i src/validate-reading.js.
  const readingTexts = validateReadingTexts(obj.readingTexts, errors, slugify);

  // --- generator (issue #279) -----------------------------------------------
  // Ett generator-område lagrar area.generator = { topic, variants, grade? } och
  // sparar INGET färdigt innehåll (inga quiz/pairs). Valfritt och bakåtkompatibelt
  // (saknas fältet → inget generator-innehåll). Vi ger tydliga fel på svenska när
  // topic/varianter är okända, mot adapterns publika lista (matte-generator.js).
  let generator = null;
  if (obj.generator !== undefined && obj.generator !== null) {
    const g = obj.generator;
    if (typeof g !== "object" || Array.isArray(g)) {
      errors.push('Fältet "generator" måste vara ett objekt, t.ex. { "topic": "addition", "variants": ["enkel"] }.');
    } else {
      const topics = listTopics();
      const topic = String(g.topic || "").trim();
      if (!topic) {
        errors.push(`Generator: "topic" saknas. Välj en tal-typ: ${topics.map((t) => `"${t}"`).join(", ")}.`);
      } else if (!topics.includes(topic)) {
        errors.push(`Generator: okänt "topic" "${topic}". Giltiga: ${topics.map((t) => `"${t}"`).join(", ")}.`);
      } else {
        const valid = listVariants(topic);
        const chosen = Array.isArray(g.variants)
          ? g.variants.map((v) => String(v || "").trim()).filter((v) => v.length > 0)
          : [];
        if (!Array.isArray(g.variants)) {
          errors.push('Generator: "variants" måste vara en lista med variantnamn, t.ex. ["enkel", "uppstallning"].');
        } else if (chosen.length === 0) {
          errors.push(`Generator: kryssa i minst en variant för "${topic}". Giltiga: ${valid.map((v) => `"${v}"`).join(", ")}.`);
        } else {
          const unknown = chosen.filter((v) => !valid.includes(v));
          if (unknown.length > 0) {
            errors.push(
              `Generator: okänd(a) variant(er) ${unknown.map((v) => `"${v}"`).join(", ")} för "${topic}". Giltiga: ${valid.map((v) => `"${v}"`).join(", ")}.`
            );
          }
        }
      }
    }
    // Normaliserad, sparklar variant (null om något ovan var fel – då finns redan
    // ett tydligt felmeddelande i errors, så området ändå inte sparas).
    generator = normalizeGenerator(g);
  }

  // --- Minst något innehåll -------------------------------------------------
  if (
    texts.length === 0 &&
    quiz.length === 0 &&
    pairs.length === 0 &&
    readingTexts.length === 0 &&
    !generator
  ) {
    errors.push(
      "Arbetsområdet har inget innehåll. Lägg till minst en text, en quizfråga, ett fakta-par, en läs-text eller en räknegenerator."
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, value: null };
  }

  // --- Övningstyper ---------------------------------------------------------
  // Läraren väljer vilka övningstyper området har (se src/exercise-types.js).
  // Anges de uttryckligen normaliseras de; saknas de (äldre områden) härleds de
  // ur innehållet, så fältet alltid finns på det sparade dokumentet.
  let exerciseTypes = normalizeExerciseTypes(obj.exerciseTypes);
  if (exerciseTypes.length === 0) {
    exerciseTypes = deriveExerciseTypes({ quiz, pairs, generator });
  }

  // --- Läsförståelse-förkrav (issue #155) -----------------------------------
  // Valfritt: läraren kan kräva att eleven klarar läsförståelsen först. Lagras
  // som { required: N } eller utelämnas helt (bakåtkompatibelt → allt öppet).
  const readingPrereq = normalizeReadingPrereq(obj.readingPrereq);

  const value = {
    id,
    name: obj.name.trim(),
    order: typeof order === "number" ? order : 1,
    coverEmoji,
    description,
    grade,
    texts,
    quiz,
    pairs,
    readingTexts,
    exerciseTypes,
    hiddenModes,
  };
  // Ta bara med förkravsfältet när det är PÅ, så gamla områden inte får ett
  // tomt fält och Firestore-dokumenten hålls rena.
  if (readingPrereq) value.readingPrereq = readingPrereq;
  // Generator-fältet (issue #279) tas bara med när det är giltigt satt, så vanliga
  // (quiz/par-)områden inte får ett tomt generator-fält.
  if (generator) value.generator = generator;
  return { ok: true, errors: [], value };
}

/**
 * Tolka en textsträng som JSON och validera som arbetsområde.
 * Ger ett vänligt felmeddelande om själva JSON-syntaxen är trasig.
 */
export function parseAndValidateArea(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { ok: false, errors: ["Klistra in eller ladda upp en JSON först."], value: null };
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
  return validateArea(obj);
}
