// ============================================================================
// Läsresan – sammanfattning + "Min läsning" (src/lasresan/ui-summary.js)
// ----------------------------------------------------------------------------
// issue #401, spec §6 steg 4 och §20. Båda vyerna är POSITIVA och visar ALDRIG
// den dolda nivån, nivåändringar ("du gick ner") eller jämförelser med andra.
//
//   renderSummary(container, { correct, total, coins, worldDone, nextWorld, onContinue }) → { destroy() }
//   renderMyReading(container, { stats, onBack }) → { destroy() }
//     stats = stats.summarize(lasresa) (utan nivå)
// ============================================================================

import { coinIcon } from "../icons.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Glad rubrik efter en text. Bara positiva varianter: även 0 rätt är "bra
 * kämpat" – Läsresan belönar att man läser klart (spec §3).
 */
export function cheer(correct, total) {
  if (total > 0 && correct === total) return { emoji: "🌟", text: "Alla rätt!" };
  if (total > 0 && correct * 100 >= 70 * total) return { emoji: "🎉", text: "Superbra läst!" };
  if (correct > 0) return { emoji: "👏", text: "Bra jobbat!" };
  return { emoji: "💪", text: "Bra kämpat!" };
}

function bindOnce(container, selector, fn) {
  const btn = container.querySelector(selector);
  const h = () => fn && fn();
  if (btn) btn.addEventListener("click", h);
  return { destroy: () => btn && btn.removeEventListener("click", h) };
}

export function renderSummary(container, { correct = 0, total = 0, coins = 0, worldDone = null, nextWorld = null, onContinue } = {}) {
  const c = cheer(correct, total);
  const world = worldDone
    ? `<div class="lr-varld-klar">🏆 <b>${esc(worldDone.name)}</b> är klar!${nextWorld ? ` Nu väntar <b>${esc(nextWorld.name)}</b>.` : ""}</div>`
    : "";
  container.innerHTML = `
    <div class="panel lr-summary" role="status">
      <div class="lr-summary-emoji" aria-hidden="true">${c.emoji}</div>
      <h2>${c.text}</h2>
      <div class="lr-summary-rad">
        <span class="lr-chip">✅ ${correct} av ${total} rätt</span>
        <span class="lr-chip lr-chip-coins">${coinIcon(24)} +${coins}</span>
      </div>
      ${world}
      <button class="btn gron lr-vidare" type="button" data-lr-vidare>Gå vidare 👣</button>
    </div>`;
  const view = bindOnce(container, "[data-lr-vidare]", onContinue);
  const btn = container.querySelector("[data-lr-vidare]");
  if (btn) btn.focus({ preventScroll: true });
  return view;
}

export function renderMyReading(container, { stats, onBack } = {}) {
  const s = stats || {};
  const tiles = [
    ["📚", s.texts || 0, s.texts === 1 ? "text läst" : "texter lästa"],
    ["❓", s.questions || 0, s.questions === 1 ? "fråga besvarad" : "frågor besvarade"],
    ["✅", s.correct || 0, "rätt"],
    ["🎯", `${s.pct || 0} %`, "rätt"],
    ["💰", s.money || 0, "pluggcoins tjänade"],
  ];
  container.innerHTML = `
    <div class="panel lr-min">
      <h2>📊 Min läsning</h2>
      ${s.texts ? "" : `<p class="hint">Läs din första text så fylls det på här!</p>`}
      <ul class="lr-min-lista">
        ${tiles
          .map(([ikon, tal, text]) => `<li class="lr-min-ruta">
              <span class="lr-min-ikon" aria-hidden="true">${ikon}</span>
              <span class="lr-min-tal">${esc(tal)}</span>
              <span class="lr-min-text">${esc(text)}</span>
            </li>`)
          .join("")}
      </ul>
      <button class="btn" type="button" data-lr-tillbaka>← Till kartan</button>
    </div>`;
  return bindOnce(container, "[data-lr-tillbaka]", onBack);
}
