// ============================================================================
// Pluggportalen – game-questions.js
// Frågemotorn som Quiz och Läsförståelse delar: en enskild fråge-rendering
// (renderQuestionCard) + hel-rundan med repetition (runQuestions). Utbruten ur
// game-shared.js dels för att hålla den under radgränsen, dels för att den
// enskilda fråge-renderingen (renderQuestionCard) ska kunna ÅTERANVÄNDAS av
// äventyrsmotorns frågeadapter (src/adventure/question-adapter.js) utan att
// duplicera någon rendering-logik. game-shared.js re-exporterar båda så
// befintliga importvägar (games-quiz.js m.fl.) är oförändrade.
// ============================================================================

import { el } from "./dom.js";
import { sound } from "./fx.js";

/** Enkel HTML-escape (samma som i game-shared/games-match). */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Blanda en array (kopia, Fisher–Yates). Lokal för att hålla modulen fristående. */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Hur många gånger en felsvarad fråga får komma tillbaka innan vi släpper den.
// Taket gör att en fråga eleven kämpar med inte loopar i all oändlighet.
const MAX_RETURNS = 2;

/**
 * Rendera EN flervalsfråga med direkt feedback och en "gå vidare"-knapp – den
 * delade byggstenen som BÅDE runQuestions (nedan) och äventyrsmotorns frågeadapter
 * (src/adventure/question-adapter.js) använder, så fråge-renderingen bara finns på
 * ETT ställe. Ren DOM, inget eget kö-/urvals-beslut: allt sådant (repetition,
 * progress, no-repeat) ägs av anroparen via callbacks.
 *
 * @param {object} o
 * @param {{question:string, explanation?:string, passage?:string,
 *          options: Array<{text:string, correct:boolean}>}} o.q  frågan, med
 *          alternativen redan byggda (text + correct) och i den ordning de ska visas.
 * @param {boolean} [o.showPassage]  visa frågans korta källtext (q.passage) ovanför.
 * @param {string} [o.progressHtml]  valfri progress-markup (t.ex. "Fråga X av Y")
 *          som läggs överst – tom för lägen utan progressrad.
 * @param {() => Node} [o.reviewButton]  valfri knapp som läggs allra överst.
 * @param {(correct:boolean) => string} o.onAnswer  kallas när eleven valt ett
 *          alternativ; returnerar etiketten som "gå vidare"-knappen ska ha
 *          (t.ex. "Nästa fråga →" / "Se resultat" / "Fortsätt →").
 * @param {() => void} o.onNext  kallas när eleven klickar "gå vidare".
 * @returns {HTMLElement} kort-elementet (.quiz-wrap) – anroparen monterar det.
 */
export function renderQuestionCard({ q, showPassage = false, progressHtml = "", reviewButton, onAnswer, onNext }) {
  const wrap = el(`<div class="quiz-wrap">
      ${progressHtml || ""}
      ${showPassage && q.passage ? `<div class="lasf-passage"><span class="lasf-passage-emoji">📖</span><p>${esc(q.passage)}</p></div>` : ""}
      <div class="quiz-question">${q.question}</div>
      <div class="quiz-options">
        ${q.options
          .map((o, idx) => `<button class="quiz-opt" data-idx="${idx}">${o.text}</button>`)
          .join("")}
      </div>
      <div class="quiz-feedback" id="fb"></div>
      <div class="quiz-next" id="nextwrap"></div>
    </div>`);

  if (reviewButton) wrap.prepend(reviewButton());

  const fb = wrap.querySelector("#fb");
  const nextWrap = wrap.querySelector("#nextwrap");
  const optButtons = [...wrap.querySelectorAll(".quiz-opt")];

  optButtons.forEach((btn) => {
    // Ghost-click-skydd (#262): på mobil skickar webbläsaren ~300 ms efter
    // ÖPPNINGS-trycket en SYNTETISK `click` på samma skärmkoordinat. Låg en
    // svarsknapp under fingret väljs annars ett svar automatiskt innan eleven
    // hunnit läsa frågan. En sådan ghost-click har INGET föregående
    // `pointerdown` PÅ knappen (pekhändelsen skedde på stationen/menyn INNAN
    // kortet ens fanns). Vi armerar knappen vid ett äkta pointerdown och hedrar
    // bara click om den (a) armerades av ett pointerdown, ELLER (b) är en
    // tangentbords-aktivering (Enter/mellanslag ⇒ `event.detail === 0` och
    // inget pointerdown). Övriga klick är ghost-clicks och ignoreras tyst.
    // pointer events täcker touch + mus + penna på ett ställe.
    let armed = false;
    btn.addEventListener("pointerdown", () => {
      armed = true;
    });

    btn.addEventListener("click", (event) => {
      const keyboard = !!event && event.detail === 0;
      if (!armed && !keyboard) return; // syntetisk ghost-click – ignorera tyst
      armed = false;
      const chosen = q.options[Number(btn.dataset.idx)];
      optButtons.forEach((b, idx) => {
        b.disabled = true;
        if (q.options[idx].correct) b.classList.add("correct");
      });
      if (chosen.correct) {
        btn.classList.add("chosen-correct");
        sound.correct();
        fb.innerHTML = `<div class="msg ok">Rätt! ✅ ${q.explanation || ""}</div>`;
      } else {
        btn.classList.add("chosen-wrong");
        sound.wrong();
        fb.innerHTML = `<div class="msg soft">Inte riktigt – men bra försök! 💡 ${q.explanation || ""}</div>`;
      }
      const label = onAnswer(chosen.correct);
      const next = el(`<button class="btn gron">${label}</button>`);
      next.addEventListener("click", () => onNext());
      nextWrap.replaceChildren(next);
      // Efter svar dyker "Nästa"-knappen upp under feedbacken – på lägre skärmar
      // hamnade den under vikningen så eleven tvingades scrolla för att gå vidare.
      // Scrolla in den direkt (minimalt, "nearest" funkar även i äventyrs-modalen)
      // och fokusera den så Enter/mellanslag går vidare utan mus.
      next.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      next.focus?.({ preventScroll: true });
    });
  });

  return wrap;
}

/**
 * Kör en omgång flervalsfrågor med direkt feedback och repetition inom rundan:
 * en fråga man svarar FEL på köas upp igen ett par frågor senare (med omblandade
 * svarsalternativ) tills den besvaras rätt, dock högst MAX_RETURNS gånger.
 *
 * Anropar onFinish(correct, total) när kön är tom. Både correct och total räknas
 * per UNIK fråga – repetitioner dubbelräknas alltså inte, så stjärnor/coins blir
 * rätt. total = antal unika frågor; correct = antal unika frågor eleven till slut
 * svarade rätt på.
 *
 * Progress-visningen är ärlig trots att kön kan växa: vi räknar unika frågor
 * eleven är klar med (rätt-svarade) av det totala antalet unika frågor, i stället
 * för att räkna varje kö-plats. Det gör att "Fråga X av Y" och progressbaren inte
 * hoppar bakåt eller överstiger Y när en fråga återkommer.
 *
 * reviewButton (valfri) läggs överst på varje fråga – används av Läsförståelse.
 *
 * showPassage (valfri): när sant visas frågans egna korta text (q.passage) i ett
 * lugnt block OVANFÖR just den frågan. Passage följer med i frågeobjektet, så den
 * visas korrekt även när en felsvarad fråga återkommer. Saknar frågan passage
 * visas inget extra block (aldrig hela texten på en gång) – se startLasforstaelse.
 * Quiz-läget skickar inte flaggan och är därför helt oförändrat.
 */
export function runQuestions({ body, questions, onFinish, reviewButton, showPassage }) {
  // Bygg ett frågeobjekt per unik fråga (med stabilt id för unik-räkningen).
  const built = shuffle(questions).map((q, id) => {
    const opts = q.options.map((text, i) => ({ text, correct: i === q.answerIndex }));
    return { id, question: q.question, explanation: q.explanation, passage: q.passage, options: shuffle(opts), returns: 0 };
  });

  const totalUnique = built.length;
  const resolved = new Set(); // id:n på frågor som till slut besvarats rätt

  // Kön av frågor att visa. Kan växa när fel-svarade frågor köas om.
  const queue = built.slice();
  let pos = 0;

  function renderQ() {
    const q = queue[pos];
    // Ärlig progress: hur många unika frågor är klara (rätt) av totalen.
    const doneUnique = resolved.size;
    const progressHtml =
      `<div class="quiz-progress">` +
      `<div class="quiz-progress-bar" style="width:${(doneUnique / totalUnique) * 100}%"></div>` +
      `</div>` +
      `<p class="quiz-count">Fråga ${Math.min(doneUnique + 1, totalUnique)} av ${totalUnique}</p>`;

    const wrap = renderQuestionCard({
      q,
      showPassage,
      progressHtml,
      reviewButton,
      onAnswer: (correct) => {
        if (correct) {
          resolved.add(q.id); // unik fråga klar (räknas bara en gång)
        } else if (q.returns < MAX_RETURNS) {
          // Köa om frågan ett par frågor senare (om vi inte nått taket).
          q.returns++;
          q.options = shuffle(q.options); // blanda om alternativen till återkomsten
          const gap = 2 + Math.floor(Math.random() * 2); // 2–3 frågor senare
          const insertAt = Math.min(pos + gap, queue.length); // sist om vi är nära slutet
          queue.splice(insertAt, 0, q);
        }
        const last = pos >= queue.length - 1;
        return last ? "Se resultat" : "Nästa fråga →";
      },
      onNext: () => {
        pos++;
        if (pos >= queue.length) onFinish(resolved.size, totalUnique);
        else renderQ();
      },
    });

    body.replaceChildren(wrap);
  }

  renderQ();
}
