// ============================================================================
// Pluggportalen – games-lastext.js
// Läsuppdrag (issue #153): ett HELT SEPARAT läsförståelse-läge ovanpå innehålls-
// modellen från #152 (readingTexts, 3 nivåer). Det gamla "lasforstaelse"-läget
// (kort passage per fråga, games-quiz.js) är oförändrat – båda syns för eleven.
// Mode-id: "lastext". Namn i UI: "Läsuppdrag".
//
// FLÖDE
//   1. Eleven väljer svårighetsnivå (1 lättast … 3 svårast) för sessionen.
//   2. En läs-text visas i arbetsbok-layout (flera stycken) med sina 3–5
//      kryssfrågor direkt under. Texten står kvar medan man svarar.
//   3. Text KLARAD (godkänt) → nästa text. Rotationen (question-rotation.js via
//      pickSessionTexts) serverar nya texter, inte samma om igen.
//   4. Alla sessionens texter klara → belöning/firande (game-shared showResult).
//
// CHANS-SKYDD
//   Godkänt kräver nästan allt rätt på FÖRSÖKET (PASS: alla, eller alla-utom-en
//   från 4 frågor och uppåt). Svarsalternativen blandas om. Vid underkänt visas
//   texten igen för omläsning och HELA frågeuppsättningen görs om, omblandad –
//   ingen instant per-fråga-retry, så man kan inte brute-force:a sig igenom.
//   Vilka svar som var fel avslöjas INTE vid underkänt (bara antal rätt).
//
// BELÖNING
//   Läsförståelse är FULL_REWARD (ingen grind-trappa) – se game-shared.js.
//   Potten skalas per klarad text + bonus för texter klarade på första försöket.
// ============================================================================

import { app, el } from "./ui.js";
import * as data from "./data.js";
import {
  gameFrame,
  showResult,
  shuffle,
  esc,
  starsFromRatio,
  pickSessionTexts,
} from "./game-shared.js";

// --- Tune:bara reglage -------------------------------------------------------

// Coins per klarad text + extra pott för texter klarade på FÖRSTA försöket.
// 3 texter, alla på första försöket → 3·12 + 3·4 = 48 (i nivå med quiz ~50).
const COINS_PER_TEXT = 12;
const FIRST_TRY_BONUS = 4;

// Nivåerna i innehållsmodellen (samma som validate-reading.js READING_LEVELS).
const LEVELS = [
  { id: "1", name: "Nivå 1", sub: "Kortare text, enklare språk", emoji: "🌱" },
  { id: "2", name: "Nivå 2", sub: "Mellannivå", emoji: "🌿" },
  { id: "3", name: "Nivå 3", sub: "Längre text, mer avancerat", emoji: "🌳" },
];

/**
 * Hur många FEL som får förekomma och ändå ge godkänt (chans-skydd).
 * Kort uppsättning (≤3 frågor): alla måste vara rätt. 4–5 frågor: alla utom en.
 * Justera fritt här för att tuna tröskeln.
 */
function maxWrongAllowed(numQuestions) {
  return numQuestions <= 3 ? 0 : 1;
}

/** Välj en nivå ur en läs-text, med fallback till närmaste befintliga nivå. */
function pickLevel(readingText, levelId) {
  const levels = readingText?.levels || {};
  if (levels[levelId] && Array.isArray(levels[levelId].questions)) return levels[levelId];
  for (const l of LEVELS) {
    if (levels[l.id] && Array.isArray(levels[l.id].questions)) return levels[l.id];
  }
  return null;
}

/** Rendera en brödtext (flera stycken) som säkra <p>, tom rad = nytt stycke. */
function paragraphsHtml(body) {
  return String(body || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// --- Ingång ------------------------------------------------------------------

export async function startLastext(ctx) {
  const { subj, area, areaData } = ctx;
  const texts = Array.isArray(areaData.readingTexts) ? areaData.readingTexts : [];

  const view = gameFrame({ subj, area, title: "Läsuppdrag", emoji: "📚" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  if (texts.length === 0) {
    body.replaceChildren(
      el(`<div class="panel center"><p class="hint">Det finns inga läs-texter i det här området än. 📖</p></div>`)
    );
    return;
  }

  // Steg 1: låt eleven välja svårighetsnivå för hela sessionen.
  const picker = el(`<div class="panel center lasf-levelpick">
    <div class="big-emoji">📚</div>
    <h1>Välj din nivå</h1>
    <p class="hint">Samma texter finns på tre nivåer. Välj den som passar dig bäst.</p>
    <div class="lasf-level-grid">
      ${LEVELS.map(
        (l) => `<button class="big-card bla lasf-level-card" data-level="${l.id}">
        <span class="emoji">${l.emoji}</span>
        <span class="title">${l.name}</span>
        <span class="sub">${l.sub}</span>
      </button>`
      ).join("")}
    </div>
  </div>`);
  body.replaceChildren(picker);
  picker.querySelectorAll(".lasf-level-card").forEach((btn) => {
    btn.addEventListener("click", () => runSession(ctx, body, texts, btn.dataset.level));
  });
}

// --- Session (kör igenom sessionens texter) ---------------------------------

async function runSession(ctx, body, texts, levelId) {
  const { subj, area } = ctx;

  // Roterande urval: nya texter tills områdets alla körts igenom, sedan om.
  const seen = await data.getQuestionRotation(area, "lastext");
  const { questions: sessionTexts, seen: nextSeen } = pickSessionTexts(texts, seen);
  data.saveQuestionRotation(area, "lastext", nextSeen);

  const total = sessionTexts.length;
  let idx = 0;
  let firstTryPasses = 0;

  function finish() {
    const stars = starsFromRatio(total ? firstTryPasses / total : 0);
    const baseCoins = total * COINS_PER_TEXT + firstTryPasses * FIRST_TRY_BONUS;
    const textWord = total === 1 ? "text" : "texter";
    showResult({
      container: body,
      subj,
      area,
      mode: "lastext",
      stars,
      scoreLine: `Du klarade ${total} ${textWord} – ${firstTryPasses} på första försöket.`,
      baseCoins,
      bestScore: firstTryPasses,
      replay: () => startLastext(ctx),
    });
  }

  // Kör EN text tills den är godkänd, sedan gå vidare.
  function runText() {
    const rt = sessionTexts[idx];
    const level = pickLevel(rt, levelId);
    if (!level || !level.questions.length) {
      // Trasig/tom text – hoppa vidare hellre än att fastna.
      idx++;
      return idx >= total ? finish() : runText();
    }

    let attempt = 0; // antal försök på DENNA text (0 = första)

    function renderAttempt(retryMsg) {
      // Blanda om frågeordning OCH alternativen för varje nytt försök.
      const qset = shuffle(level.questions).map((q) => ({
        question: q.question,
        options: shuffle(
          q.options.map((text, i) => ({ text, correct: i === q.answerIndex }))
        ),
      }));
      const chosen = new Array(qset.length).fill(-1); // valt alternativ per fråga

      const wrap = el(`<div class="lasf-worksheet">
        <p class="quiz-count">Text ${idx + 1} av ${total}</p>
        <article class="lasf-text lasf-reader">
          <h3>${esc(rt.title || "Läs-text")}</h3>
          ${paragraphsHtml(level.body)}
        </article>
        ${retryMsg ? `<div class="msg soft lasf-retry">${retryMsg}</div>` : ""}
        <div class="lasf-questions"></div>
        <div class="lasf-submit-row">
          <button class="btn gron" id="submit" disabled>Lämna in svar</button>
        </div>
      </div>`);

      const qBox = wrap.querySelector(".lasf-questions");
      qset.forEach((q, qi) => {
        const card = el(`<div class="lasf-q" data-q="${qi}">
          <div class="quiz-question">${esc(q.question)}</div>
          <div class="quiz-options">
            ${q.options
              .map((o, oi) => `<button class="quiz-opt" data-opt="${oi}">${esc(o.text)}</button>`)
              .join("")}
          </div>
        </div>`);
        card.querySelectorAll(".quiz-opt").forEach((optBtn) => {
          optBtn.addEventListener("click", () => {
            chosen[qi] = Number(optBtn.dataset.opt);
            card.querySelectorAll(".quiz-opt").forEach((b) => b.classList.remove("selected"));
            optBtn.classList.add("selected");
            // Aktivera knappen först när alla frågor har ett svar.
            submitBtn.disabled = chosen.some((c) => c < 0);
          });
        });
        qBox.append(card);
      });

      const submitBtn = wrap.querySelector("#submit");
      submitBtn.addEventListener("click", () => {
        if (chosen.some((c) => c < 0)) return; // säkerhetsnät
        let correct = 0;
        qset.forEach((q, qi) => {
          if (q.options[chosen[qi]]?.correct) correct++;
        });
        const wrong = qset.length - correct;
        const passed = wrong <= maxWrongAllowed(qset.length);

        if (passed) {
          if (attempt === 0) firstTryPasses++;
          idx++;
          if (idx >= total) finish();
          else runText();
        } else {
          // Underkänt: läs texten igen, gör om HELA uppsättningen omblandad.
          // Avslöja INTE vilka som var fel (annars kan man brute-force:a).
          attempt++;
          renderAttempt(
            `Inte riktigt – du hade ${correct} av ${qset.length} rätt. ` +
              `Läs texten en gång till och svara på alla frågor igen. 📖`
          );
        }
      });

      body.replaceChildren(wrap);
      wrap.scrollIntoView?.({ block: "start" });
    }

    renderAttempt(null);
  }

  runText();
}
