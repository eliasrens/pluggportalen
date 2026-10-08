// ============================================================================
// Läsresan – läsvyn (src/lasresan/ui-reader.js)  ·  issue #401, spec §7
// ----------------------------------------------------------------------------
// KONTRAKT (docs/LASRESAN.md §4 – behåll signaturen):
//
//   renderReader(container, {
//     text,            // ReadingText enligt Innehållskontraktet
//     onDone,          // ({ answers }) => void, anropas EN gång efter sista frågan
//     initialAnswers,  // valfri: redan låsta svar (påbörjad text återupptas)
//     onAnswer,        // valfri: (answers) => void efter varje låst svar
//   }) → { destroy() }
//
//   answers = [{ qid, chosen }], chosen = index i textens ORIGINALordning av
//   `options`. Vyn blandar visningsordningen stabilt per fråga (reader-logic.js).
//   Rättning, procent, pengar och nivå räknas av kärnan, inte här.
//
// Spec §7: texten står kvar hela tiden (bred skärm: text och fråga sida vid
// sida, smal skärm: texten i en egen scrollruta ovanför frågan). EN fråga i
// taget, 4 stora knappar, svaret låses direkt, ✅ Rätt / ❌ Fel, sedan nästa
// fråga automatiskt. Nivån visas ALDRIG. Stilarna ligger i lasresan.css.
// ============================================================================

import { displayOrder, validAnswers } from "./reader-logic.js";

/** Hur länge ✅/❌ syns innan nästa fråga (ms). Fel får lite längre tid. */
export const FEEDBACK_MS_RIGHT = 1100;
export const FEEDBACK_MS_WRONG = 1600;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function paragraphs(body) {
  return String(body || "")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
}

export function renderReader(container, { text, onDone, initialAnswers, onAnswer } = {}) {
  const questions = (text && Array.isArray(text.questions)) ? text.questions : [];
  const answers = validAnswers(text, initialAnswers);
  let i = answers.length;
  let timer = null;
  let done = false;
  let destroyed = false;

  container.innerHTML = `
    <div class="lr-reader">
      <article class="lr-text" tabindex="0" aria-label="Texten att läsa">
        <h2 class="lr-titel">${esc(text.title)}</h2>
        <div class="lr-brodtext">${paragraphs(text.body)}</div>
      </article>
      <section class="lr-fragor" aria-label="Frågor">
        <ol class="lr-prickar" aria-hidden="true">
          ${questions.map(() => `<li class="lr-prick"></li>`).join("")}
        </ol>
        <div class="lr-fraga" data-lr-fraga></div>
      </section>
    </div>`;
  const root = container.querySelector(".lr-reader");
  const qHost = container.querySelector("[data-lr-fraga]");
  const dots = [...container.querySelectorAll(".lr-prick")];

  function paintDots() {
    dots.forEach((d, k) => {
      const a = answers[k];
      const right = a && a.chosen === questions[k].answerIndex;
      d.className = "lr-prick" + (a ? (right ? " ratt" : " fel") : k === i ? " nu" : "");
    });
  }

  function finish() {
    if (done || destroyed) return;
    done = true;
    root.classList.add("klar");
    if (onDone) onDone({ answers: answers.map((a) => ({ ...a })) });
  }

  function show() {
    paintDots();
    if (i >= questions.length) return finish();
    const q = questions[i];
    const order = displayOrder(`${text.id}/${q.id}`, q.options.length);
    qHost.innerHTML = `
      <p class="lr-fraga-nr">Fråga ${i + 1} av ${questions.length}</p>
      <p class="lr-fraga-text">${esc(q.question)}</p>
      <div class="lr-alternativ">
        ${order
          .map((k, pos) => `<button class="quiz-opt lr-alt" type="button" data-k="${k}">
              <span class="lr-bokstav" aria-hidden="true">${LETTERS[pos]}</span>
              <span class="lr-alt-text">${esc(q.options[k])}</span>
            </button>`)
          .join("")}
      </div>
      <div class="lr-feedback" role="status" aria-live="polite"></div>`;
    qHost.classList.remove("lr-in");
    void qHost.offsetWidth; // starta om in-animationen
    qHost.classList.add("lr-in");
  }

  function onClick(e) {
    const b = e.target.closest("button[data-k]");
    if (!b || qHost.dataset.locked || done || i >= questions.length) return;
    // Lås direkt: inget kan ändras efter första klicket.
    qHost.dataset.locked = "1";
    qHost.querySelectorAll("button[data-k]").forEach((btn) => (btn.disabled = true));
    const q = questions[i];
    const chosen = Number(b.dataset.k);
    const right = chosen === q.answerIndex;
    answers.push({ qid: q.id, chosen });
    b.classList.add(right ? "chosen-correct" : "chosen-wrong");
    // Fel → visa rätt svar (spec 10 nivåer §4): rätt alternativ blir grönt.
    if (!right) qHost.querySelector(`button[data-k="${q.answerIndex}"]`)?.classList.add("chosen-correct");
    const fb = qHost.querySelector(".lr-feedback");
    fb.className = `lr-feedback ${right ? "ratt" : "fel"}`;
    fb.textContent = right ? "✅ Rätt!" : "❌ Fel";
    paintDots();
    if (onAnswer) {
      try { onAnswer(answers.map((a) => ({ ...a }))); } catch (err) { console.warn("[Läsresan] onAnswer", err); }
    }
    timer = setTimeout(() => {
      timer = null;
      delete qHost.dataset.locked;
      i += 1;
      show();
    }, right ? FEEDBACK_MS_RIGHT : FEEDBACK_MS_WRONG);
  }

  qHost.addEventListener("click", onClick);
  if (i >= questions.length) {
    // Alla svar fanns redan (t.ex. sparandet misslyckades förra gången).
    paintDots();
    queueMicrotask(finish);
  } else {
    show();
  }

  return {
    destroy() {
      destroyed = true;
      if (timer) clearTimeout(timer);
      qHost.removeEventListener("click", onClick);
    },
  };
}
