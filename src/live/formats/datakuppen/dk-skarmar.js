// ============================================================================
// Datakuppen 💾 (#653): elevens LOBBY- och SLUTSKÄRM (studentView-kontraktets
// statiska delar, live-formats.js). Kärnan (page-elev-live.js) ritar dem;
// spelytan (dk-elev-vy.js) flyttar in elevens avatar i [data-dk-av], ritar
// kodvalet i [data-dk-kod] och roterar säkerhetstipset i [data-dk-tips].
// Slutskärmen: pallplats bara för topp 3 (samma regel som Guldrushen, ingen
// placering som nummer), annars läget mot närmaste framför; data, rätt svar,
// Pluggmynt ur result.rewards, klassens gemensamma data och ett säkerhetstips.
//
// API
//   joinedText          lobbyraden när eleven är med
//   lobbyHtml(s)        endHtml(st, player)
//   tipHtml(text)       säkerhetstipsets innehåll
//   createTipRotator(find, { reduced?, ms? }) → { run(on), destroy() }
//                       byter tipset i find() var 8:e s (tonar, ingen rörelse)
// ============================================================================

import { coinIcon } from "../../../icons.js";
import { myReward, rewardSummary, sessionRewards, placeText } from "../../live-rewards.js";
import { endStanding, standingText, formatMb, tipAt } from "./dk-elev.js";
import { DK_TIPS } from "./delat/files-config.js";
import { dataIcon } from "./dk-ikoner.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const AV = '<span class="dk-av" data-dk-av aria-hidden="true"></span>';

export const joinedText = "Du är inloggad i nätverket! Väntar på start …";

export function tipHtml(text) {
  return `<span class="dk-tips-rubrik">🔐 Säkerhetstips</span><span class="dk-tips-text">${esc(text)}</span>`;
}

const hash = (s) => [...String(s || "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function lobbyHtml(s) {
  return `<div class="dk-lobby">
      <div class="dk-lobby-nod">${AV}</div>
      <p class="dk-lobby-text">${dataIcon("1.1em")} Svara rätt, öppna filer – samla mest data!</p>
      <div class="dk-lobby-kod" data-dk-kod></div>
      <p class="dk-tips" data-dk-tips>${tipHtml(tipAt(hash(s?.id)))}</p>
    </div>`;
}

export function endHtml(st, player) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const r = st.result;
  const tip = `<p class="dk-tips dk-final-tips">${tipHtml(tipAt(hash(st.session?.id || r?.sessionId)))}</p>`;
  if (!r) return `<div class="dk-final">${AV}<h2>⏰ Tiden är ute!</h2><p class="hint">Datan räknas ihop …</p>${tip}</div>`;
  const uid = player?.uid;
  const { row, podium, rel } = endStanding(r, uid);
  const sum = rewardSummary(myReward(r, uid));
  if (!row && !sum) return `<div class="dk-final"><h2>💾 Datakuppen är slut!</h2><p class="hint">Du var inte med i den här matchen.</p>${tip}</div>`;
  const title = podium ? `${{ 1: "🥇", 2: "🥈", 3: "🥉" }[podium]} Du kom ${placeText(podium)}!` : "💾 Bra kämpat!";
  const relRad = !podium && standingText(rel) ? `<p class="dk-final-rel">${esc(standingText(rel))}</p>` : "";
  const stats = row ? `${relRad}<p class="dk-final-data">${dataIcon("1em")} <b>${formatMb(row.gold)}</b> MB · ${row.correct} rätt</p>` : "";
  let coins = "";
  if (sum) {
    coins = `<ul class="dk-mynt">${sum.lines.map((l) => `<li><span>${esc(l.label)}</span><b>${l.coins} ${coinIcon("1em")}</b></li>`).join("")}</ul>
      <p class="dk-mynt-tot">Totalt: <b>${sum.total}</b> pluggmynt 🎉</p>`;
  } else if (sessionRewards(st.session)) {
    coins = `<p class="hint">Inga pluggmynt den här gången – svara på frågorna nästa gång!</p>`;
  }
  const klass = r.totalGold ? `<p class="dk-final-klass">Tillsammans: <b>${formatMb(r.totalGold)}</b> MB 🤝</p>` : "";
  return `<div class="dk-final">${AV}<h2>${esc(title)}</h2>${stats}${coins}${klass}${tip}</div>`;
}

export function createTipRotator(find, { reduced = false, ms = 8000 } = {}) {
  let iv = 0;
  let n = Math.floor(Math.random() * DK_TIPS.length);
  function next() {
    const el = find();
    if (!el) return;
    n++;
    if (reduced || !el.animate) { el.innerHTML = tipHtml(tipAt(n)); return; }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished.then(() => {
      el.innerHTML = tipHtml(tipAt(n));
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" });
    }).catch(() => {});
  }
  return {
    run(on) {
      if (!on) { clearInterval(iv); iv = 0; return; }
      if (!iv) iv = setInterval(next, ms);
    },
    destroy() { clearInterval(iv); },
  };
}
