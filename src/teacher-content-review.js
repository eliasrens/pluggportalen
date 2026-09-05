// ============================================================================
// Pluggportalen – lärarsidan: "granska" innehållet i ett befintligt område
// (teacher-content-review.js, issue #66)
// ----------------------------------------------------------------------------
// Read-only utfällbar vy som öppnas under en områdesrad i #/larare/innehall.
// Visar det faktiska innehållet (quiz med rätt svar markerat, begreppspar och
// texter) så läraren snabbt kan se över området utan att gå in i elevvyn eller
// öppna JSON:en. Rör INTE spara/ersätt/ta bort-flödena. UI-delen är utbruten hit
// för att hålla teacher-content.js liten (samma mönster som merge-formuläret).
// ============================================================================

import { el, esc } from "./teacher-shared.js";

/** En sektion med rubrik + antal; body byggs av respektive render-funktion. */
function section(emoji, title, count, bodyHtml) {
  return `<section class="rv-section">
    <h4 class="rv-h">${emoji} ${esc(title)} <span class="badge">${count}</span></h4>
    ${bodyHtml}
  </section>`;
}

function renderQuiz(quiz) {
  const items = quiz
    .map((q) => {
      const opts = (q.options || [])
        .map((o, i) => {
          const correct = i === q.answerIndex;
          return `<li class="rv-opt${correct ? " correct" : ""}">
            <span class="rv-mark">${correct ? "✅" : "◻️"}</span> ${esc(String(o))}
          </li>`;
        })
        .join("");
      const passage = q.passage
        ? `<div class="rv-passage"><span class="rv-tag">📖 Källtext</span> ${esc(q.passage)}</div>`
        : "";
      const explanation = q.explanation
        ? `<div class="rv-expl"><span class="rv-tag">💡 Förklaring</span> ${esc(q.explanation)}</div>`
        : "";
      return `<li class="rv-q">
        ${passage}
        <div class="rv-q-text">${esc(q.question)}</div>
        <ul class="rv-opts">${opts}</ul>
        ${explanation}
      </li>`;
    })
    .join("");
  return `<ol class="rv-list">${items}</ol>`;
}

function renderPairs(pairs) {
  const rows = pairs
    .map((p) => {
      const term = p.termImage
        ? `<span class="rv-imgflag">🖼️ ${esc(p.termImage)}</span>${p.term ? " " + esc(p.term) : ""}`
        : esc(p.term || "");
      const def = p.defImage
        ? `<span class="rv-imgflag">🖼️ ${esc(p.defImage)}</span>${p.definition ? " " + esc(p.definition) : ""}`
        : esc(p.definition || "");
      return `<li class="rv-pair">
        <span class="rv-term">${term}</span>
        <span class="rv-arrow">↔</span>
        <span class="rv-def">${def}</span>
      </li>`;
    })
    .join("");
  return `<ul class="rv-list rv-pairs">${rows}</ul>`;
}

function renderTexts(texts) {
  const items = texts
    .map(
      (t) => `<li class="rv-text">
        <div class="rv-text-title">${esc(t.title || "")}</div>
        <div class="rv-passage">${esc(t.body || t.passage || "")}</div>
      </li>`
    )
    .join("");
  return `<ul class="rv-list">${items}</ul>`;
}

/**
 * Bygg den read-only granska-vyn för ett arbetsområde `a`.
 * Läser bara från `a` (quiz/pairs/texts) och renderar; ändrar inget.
 */
export function buildReviewPanel(a) {
  const quiz = Array.isArray(a.quiz) ? a.quiz : [];
  const pairs = Array.isArray(a.pairs) ? a.pairs : [];
  const texts = Array.isArray(a.texts) ? a.texts : [];

  const sections = [];
  if (quiz.length) sections.push(section("📝", "Quiz", quiz.length, renderQuiz(quiz)));
  if (pairs.length) sections.push(section("🔗", "Begreppspar", pairs.length, renderPairs(pairs)));
  if (texts.length) sections.push(section("📄", "Texter", texts.length, renderTexts(texts)));

  const body = sections.length
    ? sections.join("")
    : `<p class="hint">Området har inget innehåll att granska ännu.</p>`;

  return el(`<div class="subpanel rv-panel">${body}</div>`);
}
