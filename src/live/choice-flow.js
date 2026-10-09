// ============================================================================
// Live – flervalsflödet (#551): spelläge + B:s knappar (#552) bakom SAMMA
// handle som skriv själv (src/mult/fast-answer.js), så elevsidan är generisk.
// ----------------------------------------------------------------------------
// Fråga ur source.next() → alternativ ur modens choices(q) → fyra knappar
// (src/live/choice-answer.js, mountChoiceAnswer) → eleven väljer → svaret
// rättas med SAMMA check som skriv själv, på det valda alternativets värde
// (check(q, String(options[i]))) → rätt/fel visas kort (rätt knapp ✓) → nästa
// fråga. Ett val per fråga (knapparna låser synkront).
// Laddas latt via src/live/answer-kinds.js (dynamisk import, #271).
//
// API
//   mountChoiceFlow(root, opts, mountGrid = mountChoiceAnswer) → handle
//     opts: { source, check, choices, onAnswer, enabled?, idleText?,
//             feedbackMs?, suffix? } – som mountFastAnswer + choices(q) →
//             { options: 4 alternativ, answerIndex }
//     onAnswer(attempt) EXAKT en gång per fråga, utan att invänta svaret:
//       { attemptId, seq, question, raw, choiceIndex, result, answeredAt }
//       raw = valt alternativ som text, choiceIndex = knappens index 0–3
//     mountGrid: bara för tester (byt ut knapparna)
//   handle: setEnabled(bool, idleText?), focus(), pauseFocus(),
//           resumeFocus(), current(), counts, destroy()
// ============================================================================

import { newAttemptId } from "../mult/attempt-id.js";
import { mountChoiceAnswer } from "./choice-answer.js";

const DEFAULT_FEEDBACK_MS = { correct: 700, wrong: 1600 };

export function mountChoiceFlow(root, opts, mountGrid = mountChoiceAnswer) {
  const { source, check, choices, onAnswer = () => {} } = opts;
  if (!source || typeof source.next !== "function") throw new Error("mountChoiceFlow: source.next saknas");
  if (typeof check !== "function") throw new Error("mountChoiceFlow: check saknas");
  if (typeof choices !== "function") throw new Error("mountChoiceFlow: choices saknas");
  const feedbackMs = { ...DEFAULT_FEEDBACK_MS, ...(opts.feedbackMs || {}) };
  const suffix = opts.suffix ?? " = ?";

  root.classList.add("fa-root");
  root.innerHTML = `<div class="live-cf-grid"></div>
    <div class="fa-feedback" role="status" aria-live="assertive"></div>`;
  const fbEl = root.querySelector(".fa-feedback");
  const grid = mountGrid(root.querySelector(".live-cf-grid"), { onChoose, sentText: "", enabled: false });

  let enabled = opts.enabled !== false;
  let idleText = opts.idleText || "Väntar…";
  let destroyed = false;
  let current = null; // { question, attemptId, options, answerIndex }
  let seq = 0;
  let nextTimer = 0;
  const counts = { correct: 0, wrong: 0 };

  function showNext() {
    const question = source.next();
    const { options, answerIndex } = choices(question);
    current = { question, attemptId: newAttemptId(), options, answerIndex };
    fbEl.textContent = "";
    fbEl.classList.remove("ok", "fel", "fa-pop");
    grid.setQuestion({ options, question: `${question.text}${suffix}` });
  }

  function render() {
    clearTimeout(nextTimer);
    if (enabled) {
      if (!current) showNext();
      else grid.setEnabled(true);
    } else {
      current = null;
      grid.setQuestion({ options: [], question: idleText });
      grid.setEnabled(false);
    }
  }

  function onChoose(i, option) {
    if (destroyed || !enabled || !current) return;
    const raw = String(option);
    const result = check(current.question, raw);
    if (!result || !result.valid) return;
    // Konsumera försöket SYNKRONT – ett andra val träffar aldrig samma fråga.
    const attempt = {
      attemptId: current.attemptId, seq: ++seq, question: current.question,
      raw, choiceIndex: i, result, answeredAt: Date.now(),
    };
    grid.reveal(current.answerIndex);
    current = null;
    if (result.correct) counts.correct++;
    else counts.wrong++;
    fbEl.textContent = result.correct ? "✅ RÄTT!" : `❌ FEL – rätt svar var ${result.correctAnswer}`;
    fbEl.classList.add(result.correct ? "ok" : "fel", "fa-pop");
    nextTimer = setTimeout(() => {
      if (!destroyed && enabled) showNext();
    }, result.correct ? feedbackMs.correct : feedbackMs.wrong);
    try {
      const p = onAnswer(attempt);
      if (p && typeof p.catch === "function") p.catch((e) => console.warn("[choice-flow] onAnswer", e));
    } catch (e) {
      console.warn("[choice-flow] onAnswer", e);
    }
  }

  render();

  return {
    setEnabled(on, text) {
      if (text != null) idleText = text;
      if (enabled === !!on && on) return;
      enabled = !!on;
      render();
    },
    // Knapparna tar inte fokus (tangenterna 1–4 lyssnar på dokumentet).
    focus() {},
    pauseFocus() {},
    resumeFocus() {},
    current: () => (current ? current.question : null),
    get counts() { return { ...counts }; },
    destroy() {
      destroyed = true;
      clearTimeout(nextTimer);
      grid.destroy();
      root.innerHTML = "";
      root.classList.remove("fa-root");
    },
  };
}
