// ============================================================================
// Guldrushen (#564): elevens LOBBY- och SLUTSKÄRM (studentView-kontraktets
// statiska delar, live-formats.js). Kärnan (page-elev-live.js) ritar dem;
// spelytan (guldrush-student.js createStage) flyttar in elevens avatar i
// [data-gr-av]. Slutskärmen (funktionsspec §7.2.4): pallplats bara för topp 3
// (Elias 2026-10-10, ingen placering som nummer), annars läget mot närmaste
// framför; guld, rätt svar, Pluggmynt ur result.rewards (#557) och klassens
// gemensamma guld.
//
// API
//   joinedText            lobbyraden när eleven är med
//   lobbyHtml(s)          endHtml(st, player)
// ============================================================================

import { escHtml } from "../../../ui.js";
import { myReward, rewardSummary, sessionRewards, placeText } from "../../live-rewards.js";
import { endStanding, standingText, formatGold } from "./gr-elev.js";

export const AV = '<span class="gr-av" data-gr-av aria-hidden="true"></span>';

export const joinedText = "Du är med! Väntar på start …";

export function lobbyHtml() {
  return `<div class="gr-lobby">${AV}<p class="gr-lobby-text">💰 Svara rätt, öppna kistor – samla mest guld!</p></div>`;
}

export function endHtml(st, player) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const r = st.result;
  if (!r) return `<div class="gr-final">${AV}<h2>⏰ Tiden är ute!</h2><p class="hint">Guldet räknas ihop …</p></div>`;
  const uid = player?.uid;
  const { row, podium, rel } = endStanding(r, uid);
  const sum = rewardSummary(myReward(r, uid));
  if (!row && !sum) return `<div class="gr-final"><h2>💰 Guldrushen är slut!</h2><p class="hint">Du var inte med i den här matchen.</p></div>`;
  const title = podium ? `${{ 1: "🥇", 2: "🥈", 3: "🥉" }[podium]} Du kom ${placeText(podium)}!` : "💰 Bra kämpat!";
  const relRad = !podium && standingText(rel) ? `<p class="gr-final-rel">${escHtml(standingText(rel))}</p>` : "";
  const stats = row ? `${relRad}<p class="gr-final-guld"><b>${formatGold(row.gold)}</b> guld · ${row.correct} rätt</p>` : "";
  let coins = "";
  if (sum) {
    coins = `<ul class="gr-mynt">${sum.lines.map((l) => `<li><span>${escHtml(l.label)}</span><b>${l.coins}</b></li>`).join("")}</ul>
      <p class="gr-mynt-tot">Totalt: <b>${sum.total}</b> pluggmynt 🎉</p>`;
  } else if (sessionRewards(st.session)) {
    coins = `<p class="hint">Inga pluggmynt den här gången – svara på frågorna nästa gång!</p>`;
  }
  const klass = r.totalGold ? `<p class="gr-final-klass">Tillsammans samlade ni <b>${formatGold(r.totalGold)}</b> guld! 🤝</p>` : "";
  return `<div class="gr-final">${AV}<h2>${escHtml(title)}</h2>${stats}${coins}${klass}</div>`;
}
