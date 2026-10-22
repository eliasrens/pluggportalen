// ============================================================================
// Meteorstormen ☄️ (#823, spec §5): elevens LOBBY- och SLUTSKÄRM
// (studentView-kontraktets statiska delar, live-formats.js). Kärnan
// (page-elev-live.js) ritar dem; spelytan (ms-elev-vy.js) laddar CSS:en.
//
// Lobbyn: stationen + hur man spelar (tre knappar, genvägarna).
// Slutet: "Ni vann! 🚀" / "Bra kämpat – 4D vann den här gången" / stjärnorna
// i En klass – ALDRIG placering som nummer – elevens eget bidrag ("Du sköt
// ner 7 meteorer och laddade skölden 5 gånger.") och pluggmynten ur
// result.rewards (serverns msAvsluta).
//
// API
//   joinedText · lobbyHtml(s) · endHtml(st, player, classId)
// ============================================================================

import { coinIcon } from "../../../icons.js";
import { myReward, sessionRewards } from "../../live-rewards.js";
import { slutet, bidragText, myntRader, dragFinns } from "./ms-elev.js";
import { stationSvg } from "./ms-station-mini.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const joinedText = "Du är ombord på rymdstationen! Väntar på start …";

export function lobbyHtml(s) {
  const drag = dragFinns(s);
  return `<div class="mse-lobby">
      <div class="mse-lobby-station">${stationSvg({ skrov: 100, skold: 30 })}</div>
      <p class="mse-lobby-text">☄️ En meteorstorm är på väg! Svara rätt och få ⚡ energi.</p>
      <ul class="mse-lobby-knappar">
        <li><b>🛡️ Sköld</b> skyddar stationen</li>
        <li><b>🔫 Laser</b> skjuter sönder meteorer</li>
        ${drag ? "<li><b>🌀 Dragstråle</b> slungar en meteor mot den andra stationen</li>" : ""}
      </ul>
      <p class="mse-lobby-tips hint">Genvägar: 1 · 2${drag ? " · 3" : ""} · mellanslag = spara energin</p>
    </div>`;
}

export function endHtml(st, player, classId) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const r = st.result || null;
  const s = st.session || null;
  const uid = player?.uid;
  const mine = classId ?? player?.classId ?? null;
  const t = slutet(r, mine, s);
  const row = (r?.ranking || []).find((p) => p.uid === uid) || null;
  const egen = r && mine ? (r.placering || []).find((p) => p.classId === mine) : null;
  const station = `<div class="mse-final-station${t.vann ? " mse-final-vann" : ""}">${stationSvg({ skrov: egen ? egen.skrov : 100, skold: 0, flyter: egen ? egen.skrov <= 0 : false })}</div>`;
  if (!r) return `<div class="mse-final">${station}<h2>${esc(t.titel)}</h2><p class="hint">${esc(t.rad)}</p></div>`;
  const rad = t.stjarnor != null
    ? `<p class="mse-final-stjarnor" aria-label="${t.stjarnor} av 3 stjärnor">${esc(t.rad)}</p>`
    : `<p class="mse-final-rad">${esc(t.rad)}</p>`;
  const bidrag = row ? `<p class="mse-final-bidrag">${esc(bidragText(row))}</p>` : `<p class="hint">Du var inte med i den här matchen.</p>`;
  const entry = myReward(r, uid);
  let coins = "";
  const rader = myntRader(entry, r.lage);
  if (rader.length) {
    coins = `<ul class="mse-mynt">${rader.map((l) => `<li><span>${esc(l.label)}</span><b>${l.coins} ${coinIcon("1em")}</b></li>`).join("")}</ul>
      <p class="mse-mynt-tot">Totalt: <b>${entry.total}</b> pluggmynt 🎉</p>`;
  } else if (row && sessionRewards(s)) {
    coins = `<p class="hint">Inga pluggmynt den här gången – svara på frågorna nästa gång!</p>`;
  }
  return `<div class="mse-final">${station}<h2>${esc(t.titel)}</h2>${rad}${bidrag}${coins}</div>`;
}
