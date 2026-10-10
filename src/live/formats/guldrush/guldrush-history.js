// ============================================================================
// Guldrushen – historiken, ENKEL version (#563). Laddas LATT av
// teacher-live-history.js via GULDRUSH.historyRenderer(). Visar etta(or),
// topplistan (delad placering) och klassens totala guld ur result.
//
// API: winnerText(s, result) · detailHtml(s, result) · classStats
// ============================================================================

import { esc } from "../../../teacher-shared.js";

const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");

export function winnerText(_s, result) {
  const ettor = (result?.ranking || []).filter((p) => p.rank === 1 && p.gold > 0);
  if (!ettor.length) return "–";
  return `💰 ${ettor.map((p) => esc(p.name || "?")).join(" & ")}`;
}

export function detailHtml(s, result) {
  const rows = (result?.ranking || []).slice(0, 10).map((p) =>
    `<tr><td class="num">${p.rank}</td><th scope="row">${esc(p.name || "?")}</th><td class="num">${p.correct}</td><td class="num"><b>${tal(p.gold)}</b></td></tr>`).join("");
  const klasser = (s?.participatingClassIds || []).map((id) =>
    `${esc(s.classNames?.[id] || id)} ${tal(result?.classGold?.[id])}`).join(" · ");
  return `<p class="live-history-winner">${winnerText(s, result)}
      ${result ? `<small class="hint">Tillsammans ${tal(result.totalGold)} guld (${klasser}) · totalt ${result.totalCorrect} rätt</small>` : ""}</p>
    <table class="live-table"><thead><tr><th class="num">Plats</th><th>Elev</th><th class="num">Rätt</th><th class="num">Guld</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
}

export const classStats = {
  cols: 2,
  head: `<th class="num">Rätt</th><th class="num">Guld</th>`,
  cells(_s, res, classId) {
    if (!res) return `<td class="num">–</td><td class="num">–</td>`;
    const mine = (res.ranking || []).filter((p) => p.classId === classId);
    return `<td class="num">${mine.reduce((n, p) => n + p.correct, 0)}</td><td class="num">${tal(res.classGold?.[classId])}</td>`;
  },
};
