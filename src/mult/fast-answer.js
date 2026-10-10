// ============================================================================
// Snabb svarskomponent (#457) – delas av Mattematchen och Live.
// ----------------------------------------------------------------------------
// Flöde utan mus: fråga visas stort → eleven skriver → ENTER → "✅ RÄTT!" /
// "❌ FEL – rätt svar var 56" visas kort → nästa fråga direkt, fältet är tömt
// och har fortfarande fokus. Ingen knapp, ingen popup, inget omförsök.
// Styling: src/mult/fast-answer.css (ryms utan scroll på 1366×768).
//
// API
//   mountFastAnswer(root, opts) → handle
//     opts.source      { next(): Question }  – t.ex. mode.createSource() eller
//                      createMultGenerator(). Question har minst { key, text }.
//     opts.check       (q, raw) => { valid, correct, correctAnswer } – t.ex.
//                      mode.checkAnswer. valid:false (tomt) ignoreras tyst.
//     opts.onAnswer    (attempt) => void|Promise – anropas EXAKT EN gång per
//                      försök, utan att invänta svaret (skrivningen får aldrig
//                      stoppa tempot). attempt = { attemptId, seq, question,
//                      raw, result, answeredAt }.
//     opts.inputMode   "numeric" (default) | "text"
//     opts.feedbackMs  { correct: 700, wrong: 1600 } – hur länge raden syns
//     opts.suffix      text efter frågan (default " = ?")
//     opts.enabled     false → fältet låst och frågan dold (lobby/slut)
//     opts.idleText    text som visas när komponenten är avstängd
//     opts.feedback    false → ingen RÄTT/FEL-rad (Snilleblixten #558: facit
//                      avslöjas först senare – värden visar "Svar inskickat")
//   handle.setEnabled(bool, idleText?)  – t.ex. lobby → live → slut
//   handle.pauseFocus() / resumeFocus() – släpp/återta autofokus (öppen panel)
//   handle.focus()      handle.current() → aktuell Question|null
//   handle.counts       → { correct, wrong } sedan mount
//   handle.destroy()
//
// DUBBLA SVAR: varje visad fråga får ett unikt attemptId (attempt-id.js). Ett
// försök "konsumeras" synkront vid ENTER innan nästa fråga visas, så en andra
// ENTER träffar nästa (tomma) fråga och ignoreras; auto-repeat (e.repeat)
// ignoreras också. Servern (firestore.rules) nekar dessutom ett andra
// dokument med samma id.
// ============================================================================

import { newAttemptId } from "./attempt-id.js";

const DEFAULT_FEEDBACK_MS = { correct: 700, wrong: 1600 };
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);

function isTextField(a) {
  if (a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable) return true;
  return a.tagName === "INPUT" && !NON_TEXT_INPUTS.has(String(a.type).toLowerCase());
}

/**
 * @param {HTMLElement} root
 * @param {object} opts se API ovan
 */
export function mountFastAnswer(root, opts) {
  const { source, check, onAnswer = () => {} } = opts;
  if (!source || typeof source.next !== "function") throw new Error("mountFastAnswer: source.next saknas");
  if (typeof check !== "function") throw new Error("mountFastAnswer: check saknas");
  const feedbackMs = { ...DEFAULT_FEEDBACK_MS, ...(opts.feedbackMs || {}) };
  const suffix = opts.suffix ?? " = ?";
  const numeric = (opts.inputMode || "numeric") === "numeric";
  const feedback = opts.feedback !== false;

  root.classList.add("fa-root");
  root.innerHTML = `
    <form class="fa-form" autocomplete="off" novalidate>
      <div class="fa-question" aria-live="polite"></div>
      <input class="fa-input" type="text" ${numeric ? 'inputmode="numeric" pattern="[0-9]*" maxlength="4"' : 'maxlength="40"'}
        enterkeyhint="send" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        aria-label="Ditt svar" />
      <div class="fa-feedback" role="status" aria-live="assertive"></div>
    </form>`;
  const form = root.querySelector(".fa-form");
  const qEl = root.querySelector(".fa-question");
  const input = root.querySelector(".fa-input");
  const fbEl = root.querySelector(".fa-feedback");

  let enabled = opts.enabled !== false;
  let idleText = opts.idleText || "Väntar…";
  let focusPaused = false;
  let destroyed = false;
  let current = null; // { question, attemptId }
  let seq = 0;
  let fbTimer = 0;
  const counts = { correct: 0, wrong: 0 };

  function showNext() {
    const question = source.next();
    current = { question, attemptId: newAttemptId() };
    qEl.textContent = `${question.text}${suffix}`;
    input.value = "";
  }

  function render() {
    input.disabled = !enabled;
    root.classList.toggle("fa-off", !enabled);
    if (enabled) {
      if (!current) showNext();
      focus();
    } else {
      current = null;
      qEl.textContent = idleText;
      input.value = "";
    }
  }

  function showFeedback(result) {
    clearTimeout(fbTimer);
    fbEl.classList.remove("ok", "fel", "fa-pop");
    // Tvinga om pop-animationen även när två svar i rad har samma klass.
    void fbEl.offsetWidth;
    if (result.correct) {
      fbEl.textContent = "✅ RÄTT!";
      fbEl.classList.add("ok", "fa-pop");
    } else {
      fbEl.textContent = `❌ FEL – rätt svar var ${result.correctAnswer}`;
      fbEl.classList.add("fel", "fa-pop");
    }
    fbTimer = setTimeout(() => {
      fbEl.textContent = "";
      fbEl.classList.remove("ok", "fel", "fa-pop");
    }, result.correct ? feedbackMs.correct : feedbackMs.wrong);
  }

  function submit() {
    if (!enabled || !current || destroyed) return;
    const raw = input.value;
    const result = check(current.question, raw);
    if (!result || !result.valid) return; // tomt/skräp = inget försök
    // Konsumera försöket SYNKRONT innan något annat händer.
    const attempt = {
      attemptId: current.attemptId,
      seq: ++seq,
      question: current.question,
      raw,
      result,
      answeredAt: Date.now(),
    };
    current = null;
    if (result.correct) counts.correct++;
    else counts.wrong++;
    if (feedback) showFeedback(result);
    showNext();
    try {
      const p = onAnswer(attempt);
      if (p && typeof p.catch === "function") p.catch((e) => console.warn("[fast-answer] onAnswer", e));
    } catch (e) {
      console.warn("[fast-answer] onAnswer", e);
    }
  }

  function onKeydown(e) {
    if (e.key === "Enter" && e.repeat) e.preventDefault();
  }
  function onSubmit(e) {
    e.preventDefault();
    submit();
  }
  function onInput() {
    if (!numeric) return;
    const clean = input.value.replace(/\D+/g, "").slice(0, 4);
    if (clean !== input.value) input.value = clean;
  }
  // PERMANENT AUTOFOKUS: tappar fältet fokus (klick bredvid, tab) tas det
  // tillbaka direkt – utom när värden pausat fokus (egen panel/dialog öppen).
  function onBlur() {
    if (destroyed || focusPaused || !enabled) return;
    setTimeout(() => {
      if (destroyed || focusPaused || !enabled) return;
      const a = document.activeElement;
      // Släpp inte till ett annat textfält (t.ex. en sökruta som värden visat).
      if (a && a !== input && isTextField(a)) return;
      focus();
    }, 0);
  }
  function onVisible() {
    if (document.visibilityState === "visible") focus();
  }

  function focus() {
    if (destroyed || !enabled || focusPaused) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }

  form.addEventListener("submit", onSubmit);
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisible);
  render();

  return {
    setEnabled(on, text) {
      if (text != null) idleText = text;
      if (enabled === !!on && on) return;
      enabled = !!on;
      render();
    },
    pauseFocus() { focusPaused = true; },
    resumeFocus() { focusPaused = false; focus(); },
    focus,
    current: () => (current ? current.question : null),
    get counts() { return { ...counts }; },
    destroy() {
      destroyed = true;
      clearTimeout(fbTimer);
      form.removeEventListener("submit", onSubmit);
      input.removeEventListener("keydown", onKeydown);
      input.removeEventListener("input", onInput);
      input.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisible);
      root.innerHTML = "";
      root.classList.remove("fa-root", "fa-off");
    },
  };
}
