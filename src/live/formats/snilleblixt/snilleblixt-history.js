// ============================================================================
// Snilleblixten – historiken, ENKEL version (#556). Laddas LATT av
// teacher-live-history.js via SNILLEBLIXT.historyRenderer(). Visar etta(or)
// och topplistan ur result.ranking (delad placering). Den riktiga historiken
// (pallplats, andel rätt per fråga, statistik) byggs i #560.
//
// API: winnerText(s, result) · detailHtml(s, result) · classStats
// ============================================================================

import { esc } from "../../../teacher-shared.js";

const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");

export function winnerText(_s, result) {
  const ettor = (result?.ranking || []).filter((p) => p.rank === 1 && p.points > 0);
  if (!ettor.length) return "–";
  return `⚡ ${ettor.map((p) => esc(p.name || "?")).join(" & ")}`;
}

export function detailHtml(_s, result) {
  const rows = (result?.ranking || []).slice(0, 10).map((p) =>
    `<tr><td class="num">${p.rank}</td><th scope="row">${esc(p.name || "?")}</th><td class="num">${p.correct}</td><td class="num"><b>${tal(p.points)}</b></td></tr>`).join("");
  return `<p class="live-history-winner">${winnerText(_s, result)}
      ${result ? `<small class="hint">${result.questionsPlayed} frågor · totalt ${result.totalCorrect} rätt</small>` : ""}</p>
    <table class="live-table"><thead><tr><th class="num">Plats</th><th>Elev</th><th class="num">Rätt</th><th class="num">Poäng</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
}

export const classStats = {
  cols: 2,
  head: `<th class="num">Rätt</th><th class="num">Poäng</th>`,
  cells(_s, res, classId) {
    const mine = (res?.ranking || []).filter((p) => p.classId === classId);
    if (!res) return `<td class="num">–</td><td class="num">–</td>`;
    return `<td class="num">${mine.reduce((n, p) => n + p.correct, 0)}</td><td class="num">${tal(mine.reduce((n, p) => n + p.points, 0))}</td>`;
  },
};
