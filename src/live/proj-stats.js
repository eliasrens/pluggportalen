// ============================================================================
// Live-projektorn: VY 2 STATISTIK (#461) – EXAKT, ingen komprimering. Stora
// staplar (linjärt från noll, ledaren = full höjd), poäng/elev, totalt rätt,
// klasserna och individuell topplista. Tid kvar = skalets stora timer.
//
// API: createStatsView(host, { st, colors }) → { update(st), destroy() }
// ============================================================================

import { esc } from "../teacher-shared.js";
import { formatScore } from "./live-core.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export function createStatsView(host, { st, colors }) {
  const root = document.createElement("div");
  root.className = "lps";
  root.innerHTML = `
    <div class="lps-tiles">
      <div class="lps-tile"><span>✅ Totalt rätt</span><b data-total>0</b></div>
      <div class="lps-tile"><span>👥 Elever med</span><b data-joined>0</b></div>
      <div class="lps-tile"><span>🏆 Leder</span><b data-leader>–</b></div>
    </div>
    <div class="lps-main">
      <div class="lps-chart">
        <div class="lps-bars" style="--n:${st.classes.length}">${st.classes.map((c) => `
          <div class="lps-col" style="--c:${colors[c.classId]};--h:0" data-cid="${esc(c.classId)}">
            <div class="lps-track">
              <i class="lps-bar"></i>
              <div class="lps-valwrap"><div class="lps-val"><b data-score>0,0</b><small>poäng/elev</small></div></div>
            </div>
            <div class="lps-name">${esc(c.name)}</div>
            <div class="lps-sub"><span data-correct>0</span> rätt ÷ <span data-div>${c.divisor}</span></div>
          </div>`).join("")}
        </div>
      </div>
      <div class="lps-top">
        <h2>🏅 Topplista</h2>
        <ol data-top></ol>
        <p class="lps-empty" data-empty>Första rätta svaret tar plats här!</p>
      </div>
    </div>`;
  host.replaceChildren(root);
  const $ = (s) => root.querySelector(s);

  const cols = st.classes.map((c) => {
    const col = root.querySelector(`[data-cid="${CSS.escape(c.classId)}"]`);
    return {
      id: c.classId,
      col,
      score: col.querySelector("[data-score]"),
      correct: col.querySelector("[data-correct]"),
      div: col.querySelector("[data-div]"),
    };
  });
  let topKey = "";

  function update(next) {
    const byId = new Map(next.classes.map((c) => [c.classId, c]));
    const best = Math.max(0, ...next.classes.map((c) => c.score));
    for (const ui of cols) {
      const c = byId.get(ui.id);
      if (!c) continue;
      ui.col.style.setProperty("--h", best > 0 ? (c.score / best).toFixed(4) : "0");
      ui.col.classList.toggle("leder", next.leaderIds.length === 1 && next.leaderIds[0] === ui.id && best > 0);
      ui.score.textContent = formatScore(c.score);
      ui.correct.textContent = c.correct;
      ui.div.textContent = c.divisor;
    }
    $("[data-total]").textContent = next.totalCorrect;
    $("[data-joined]").textContent = next.classes.reduce((n, c) => n + c.joined, 0);
    const lead = next.draw || best <= 0 ? null : byId.get(next.winnerId);
    $("[data-leader]").textContent = lead ? lead.name : best > 0 ? "Lika!" : "–";
    $("[data-leader]").style.color = lead ? colors[lead.classId] : "";

    const key = JSON.stringify(next.top);
    if (key === topKey) return;
    topKey = key;
    $("[data-empty]").hidden = next.top.length > 0;
    $("[data-top]").innerHTML = next.top.map((p, i) => `<li style="--c:${colors[p.classId] || "#888"}">
        <span class="lps-rank">${MEDALS[i] || i + 1}</span>
        <span class="lps-pname">${esc(p.name || "Elev")}</span>
        <span class="lps-pclass">${esc(next.session?.classNames?.[p.classId] || "")}</span>
        <b>${p.correct}</b></li>`).join("");
  }

  update(st);
  return { update, destroy() {} };
}
