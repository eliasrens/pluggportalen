// ============================================================================
// Klassmatchen – historiken (#547). Laddas LATT av teacher-live-history.js via
// KLASSMATCH.historyRenderer() = import(). Ritar det som är klass mot klass:
// vinnaren, mynt-priset och klasstabellen (rätt / nämnare / poäng), samt
// klassens rad i Statistik → Live. Elevtabellen ritar kärnan.
//
// API
//   winnerText(s, result)        → "🏆 4B" | "Oavgjort" | "–"  (historiklistan)
//   detailHtml(s, result)        → vinnarrad + pris + klasstabell (en match)
//   settle(s)                    → betala ett ej utbetalt mynt-pris (#526) –
//                                  idempotent, kastar aldrig
//   classStats.head / .cols      → kolumnrubrikerna (antal) i Statistik → Live
//   classStats.cells(s, result, classId) → klassens celler för en match
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { formatScore } from "../../live-core.js";
import { prizeText, sessionPrize } from "./klassmatch-core.js";

const className = (s, id) => s.classNames?.[id] || id;

export function winnerText(s, result) {
  if (!result) return "–";
  return result.winner === "draw" ? "Oavgjort" : `🏆 ${esc(className(s, result.winner))}`;
}

export function detailHtml(s, result) {
  const perClass = result?.perClass || {};
  const classRows = s.participatingClassIds.map((id) => {
    const c = perClass[id] || { correct: 0, divisor: s.classDivisors?.[id] || 1, score: 0 };
    const win = result && (result.winner === id || result.winner === "draw");
    return `<tr class="${win ? "live-win" : ""}"><th scope="row">${esc(className(s, id))}</th>
      <td class="num">${c.correct}</td><td class="num">${c.divisor}</td><td class="num"><b>${formatScore(c.score)}</b></td></tr>`;
  }).join("");
  return `<p class="live-history-winner">${result ? (result.winner === "draw" ? "🤝 OAVGJORT" : `🏆 VINNARE – ${esc(className(s, result.winner))}`) : ""}
      ${result ? `<small class="hint">Totalt ${result.totalCorrect} rätt</small>` : ""}</p>
    ${sessionPrize(s) ? `<p class="live-prize">🪙 ${esc(prizeText(s, result))}</p>` : ""}
    <table class="live-table"><thead><tr><th>Klass</th><th class="num">Rätt</th><th class="num">Nämnare</th><th class="num">Poäng</th></tr></thead>
      <tbody>${classRows}</tbody></table>`;
}

/** Mynt-priset (#526) om projektorn stängdes innan det betalades – idempotent. */
export function settle(s) {
  if (s.result && sessionPrize(s)) {
    import("../../../klasscenter/kc-koppling.js").then((m) => m.livePrisEfterAvslut(s.id, s)).catch(() => {});
  }
}

export const classStats = {
  cols: 4,
  head: `<th class="num">Rätt</th><th class="num">Nämnare</th>
      <th class="num">Poäng</th><th>Utfall</th>`,
  cells(s, res, classId) {
    const r = res?.perClass?.[classId];
    const outcome = !res ? "–" : res.winner === "draw" ? "Oavgjort" : res.winner === classId ? "🏆 Vinst" : "Förlust";
    return `<td class="num">${r ? r.correct : "–"}</td><td class="num">${r ? r.divisor : "–"}</td><td class="num">${r ? formatScore(r.score) : "–"}</td>
      <td>${outcome}</td>`;
  },
};
