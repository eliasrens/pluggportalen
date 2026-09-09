// ============================================================================
// Pluggportalen – äventyrsmotorn: question-adapter.js
// ----------------------------------------------------------------------------
// Ett TUNT lager mellan spelvärlden och de befintliga frågekällorna. Gör om
// områdets innehåll (quiz, läsförståelse och fakta-par) till ETT enhetligt
// "en fråga i taget"-API som motorn kan konsumera vid en station:
//
//   askNext(opts) → Promise<{ correct, kind }>   // visar frågemodalen, fryser spelet
//   remaining()  → number                         // osedda frågor kvar i omgången
//   reset()                                        // ny omgång (no-repeat börjar om)
//   hasQuestions() → boolean                       // finns något att fråga alls?
//
// INGEN frågelogik dupliceras: quiz/läsförståelse normaliseras rakt av (de har
// redan options + answerIndex), och par görs om till en vanlig flervalsfråga
// ("vilken förklaring hör ihop med X?" med distraktorer ur andra par). Alla tre
// hamnar i samma normaliserade format { question, options[{text,correct}], ... }
// och renderas av den delade renderQuestionCard() via question-modal.js. En ny
// frågetyp = en ny liten producer nedan; motorn/modalen är helt oberörd.
//
// No-repeat i samma omgång: den normaliserade poolen blandas och serveras i tur
// och ordning; när den tar slut blandas den om (en ny omgång). Tema-agnostiskt.
// ============================================================================

import { shuffle, plainQuizPool, hasPassage } from "../game-shared.js";
import { pickOnePerGroup } from "../pick-group.js";
import { openQuestionModal } from "./question-modal.js";

/** Enkel HTML-escape för lärar-inmatad text i genererade par-frågor. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MAX_PARA_OPTIONS = 4; // 1 rätt + upp till 3 distraktorer

/** Normalisera en quiz-/läsförståelse-fråga till motorns format (options bevaras). */
function normalizeQuiz(q, showPassage) {
  return {
    kind: showPassage ? "lasforstaelse" : "quiz",
    showPassage,
    question: q.question,
    explanation: q.explanation || "",
    passage: q.passage,
    // Bygg option-objekt (text + correct) men BEHÅLL källordningen; modalen/
    // renderQuestionCard blandar inte om – vi blandar en gång vid bygget nedan.
    options: (q.options || []).map((text, i) => ({ text, correct: i === q.answerIndex })),
  };
}

/**
 * Gör en flervalsfråga av ett fakta-par: "Vilken förklaring hör ihop med X?"
 * med rätt definition + distraktorer ur andra pars definitioner. Endast text-par
 * (bild-par utan text hoppas över – de saknar en läsbar frågeställning här).
 */
function normalizePair(pair, allPairs) {
  if (!pair || !pair.term || !pair.definition) return null;
  const distractors = shuffle(
    allPairs.filter((p) => p !== pair && p.definition && p.definition !== pair.definition)
  )
    .slice(0, MAX_PARA_OPTIONS - 1)
    .map((p) => ({ text: esc(p.definition), correct: false }));
  if (distractors.length === 0) return null; // för få par för en vettig fråga
  const options = shuffle([{ text: esc(pair.definition), correct: true }, ...distractors]);
  return {
    kind: "para",
    showPassage: false,
    question: `Vilken förklaring hör ihop med <b>${esc(pair.term)}</b>?`,
    explanation: "",
    passage: undefined,
    options,
  };
}

/**
 * Bygg den normaliserade fråge-poolen ur områdesdatan för de valda frågekällorna.
 * @param {object} areaData  { quiz?, pairs? }
 * @param {string[]} kinds   t.ex. ["quiz","lasforstaelse","para"]
 * @returns {Array} normaliserade frågor (options redan färdigblandade)
 */
function buildPool(areaData, kinds) {
  const out = [];
  const quiz = Array.isArray(areaData?.quiz) ? areaData.quiz : [];
  const pairs = Array.isArray(areaData?.pairs) ? areaData.pairs : [];

  if (kinds.includes("quiz")) {
    for (const q of plainQuizPool(quiz)) {
      const n = normalizeQuiz(q, false);
      n.options = shuffle(n.options);
      out.push(n);
    }
  }
  if (kinds.includes("lasforstaelse")) {
    for (const q of quiz.filter(hasPassage)) {
      const n = normalizeQuiz(q, true);
      n.options = shuffle(n.options);
      out.push(n);
    }
  }
  if (kinds.includes("para")) {
    const chosen = pickOnePerGroup(pairs); // undvik ömsesidigt uteslutande dubbletter
    for (const p of chosen) {
      const n = normalizePair(p, chosen);
      if (n) out.push(n);
    }
  }
  return out;
}

/**
 * Skapa frågeadaptern för ett område.
 * @param {object} o
 * @param {object} o.areaData  områdets innehåll (quiz/pairs)
 * @param {string[]} [o.kinds] frågekällor stationerna drar från (default alla tre)
 * @param {HTMLElement} [o.host]  var modalen läggs (skickas vidare till modalen)
 */
export function makeQuestionAdapter({ areaData, kinds = ["quiz", "lasforstaelse", "para"], host } = {}) {
  const pool = buildPool(areaData, kinds);
  let queue = shuffle(pool); // aktuell omgång, no-repeat tills tom

  function refillIfEmpty() {
    if (queue.length === 0) queue = shuffle(pool); // ny omgång
  }

  return {
    hasQuestions() {
      return pool.length > 0;
    },
    remaining() {
      return queue.length;
    },
    reset() {
      queue = shuffle(pool);
    },
    /**
     * Visa nästa fråga i en modal ovanpå världen och lös svaret.
     * @param {object} [opts]
     * @param {string} [opts.title]  modalrubrik (temats stationPrompt)
     * @param {string} [opts.emoji]  liten ikon i modalhuvudet
     * @returns {Promise<{correct:boolean, kind:string, cancelled?:boolean, empty?:boolean}>}
     */
    async askNext({ title = "Kunskapsstation", emoji = "❓" } = {}) {
      if (pool.length === 0) return { correct: true, kind: "none", empty: true };
      refillIfEmpty();
      const q = queue.shift();
      const res = await openQuestionModal({
        q,
        showPassage: !!q.showPassage,
        title,
        emoji,
        host,
      });
      return { ...res, kind: q.kind };
    },
  };
}
