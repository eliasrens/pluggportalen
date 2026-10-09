// ============================================================================
// Klassmatchen – elevens skärm (#547). Laddas LATT av page-elev-live.js via
// KLASSMATCH.studentView() = import(). Kärnan äger flödet (lobby → 3-2-1-KÖR!
// → snabbsvar → slut, närvaro, sen anslutning, återanslutning); formatet
// bidrar med det som är klass mot klass:
//   lobbyHtml(s)                 → mynt-prisraden i lobbyn ("" = ingen)
//   endHtml(st, player, classId) → slutskärmen: vinnarklass, pris, klassernas
//                                  poäng/elev (egen klass markerad), egna rätt
// ============================================================================

import { escHtml } from "../../../ui.js";
import { formatScore } from "../../live-core.js";
import { prizeText } from "./klassmatch-core.js";

export function lobbyHtml(s) {
  return prizeText(s) ? `<p class="live-elev-prize">🪙 ${escHtml(prizeText(s))}</p>` : "";
}

export function endHtml(st, player, classId) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const mine = player ? `<p class="live-elev-mine">Du fick <b>${player.correct || 0}</b> rätt! 🎉</p>` : "";
  const r = st.result;
  if (!r) return `<div class="big-emoji">⏱️</div><h2>Matchen är slut!</h2>${mine}<p class="hint">Resultatet räknas ihop…</p>`;
  const names = st.session.classNames || {};
  const rows = Object.entries(r.perClass || {})
    .sort((a, b) => b[1].score - a[1].score)
    .map(([id, c]) => `<li class="${id === classId ? "mig" : ""}"><b>${escHtml(names[id] || id)}</b> ${formatScore(c.score)} poäng/elev</li>`)
    .join("");
  const head = r.winner === "draw"
    ? `<h2>🤝 OAVGJORT!</h2>`
    : `<h2>🏆 VINNARE – ${escHtml(names[r.winner] || r.winner)}!</h2>`;
  const pris = prizeText(st.session, r);
  return `${head}${pris ? `<p class="live-elev-prize">🪙 ${escHtml(pris)}</p>` : ""}<ul class="live-elev-result">${rows}</ul>${mine}`;
}
