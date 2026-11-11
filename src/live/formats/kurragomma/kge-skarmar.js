// ============================================================================
// Kurragömma 🙈 – elevens LOBBY- och SLUTSKÄRM (#839, studentView-kontraktets
// statiska delar). Kärnan (page-elev-live.js) ritar dem; spelytan
// (kge-elev-vy.js) laddar CSS:en.
//
// Lobbyn: ön + hur man spelar (specens förklaring). Slutet: ingen visas som
// sist (§1.8) – "Du klarade dig gömd hela matchen!" / "Du blev hittad vid ladan
// och letade sedan" / "Du var sökare från start", poängen, och pluggmynten ur
// result.rewards (serverns kgAvsluta): medalj och placering bara för 1–3.
//
// API
//   joinedText · lobbyHtml(s) · endHtml(st, player, classId)
//   slutRad(row, gomstalle) → text (ren, testad)
// ============================================================================

import { coinIcon } from "../../../icons.js";
import { myReward, sessionRewards, placeText } from "../../live-rewards.js";
import { normInstallningar } from "./delat/kg-regler.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };

export const joinedText = "Du är med! Väntar på start …";

export function lobbyHtml(s) {
  const inst = normInstallningar(s?.kgInstallningar);
  return `<div class="kge-lobby">
      <p class="kge-lobby-text">🙈 Göm dig var du vill på ön och lås platsen. Svara rätt – annars visslar det! Den som hittas blir sökare.</p>
      <ul class="kge-lobby-steg">
        <li><b>Gömfasen</b> (${inst.gomtid} s): gå med W/S eller pilarna, sväng med A/D, tryck på marken för att gå dit. Lås med 🔒.</li>
        <li><b>Letfasen:</b> svara på frågor. Rätt svar ger poäng – fel svar visslar där du är gömd.</li>
        <li><b>Sökare:</b> rätt svar laddar ficklampan. 🔦 Leta (mellanslag) där du tror att någon gömmer sig.</li>
      </ul>
    </div>`;
}

/** Elevens egen rad på slutskärmen – aldrig en placering som nummer utanför pallen. */
export function slutRad(row, gomstalle = null) {
  if (!row) return "Du var inte med i den här matchen.";
  if (row.klaradeSig) return "Du klarade dig gömd hela matchen!";
  if (gomstalle && gomstalle.hittad) return `Du blev hittad ${gomstalle.namn || "på ön"} och letade sedan.`;
  if (row.hittade > 0) return `Du var sökare och hittade ${row.hittade} ${row.hittade === 1 ? "gömd" : "gömda"}!`;
  return "Du var sökare hela matchen.";
}

export function endHtml(st, player, _classId) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const r = st.result || null;
  const s = st.session || null;
  const uid = player?.uid;
  if (!r) return `<div class="kge-final"><div class="big-emoji">🙈</div><h2>Matchen är slut!</h2><p class="hint">Resultatet räknas ihop …</p></div>`;
  const row = (r.ranking || []).find((p) => p.uid === uid) || null;
  const gom = (r.gomstallen || []).find((g) => g.uid === uid) || null;
  const entry = myReward(r, uid);
  const rubrik = r.klaradeSig > 0 ? `${r.klaradeSig} av ${(r.ranking || []).length} klarade sig gömda` : "Sökarna hittade alla!";
  let mynt = "";
  if (entry) {
    const rader = [];
    if (entry.prize) rader.push({ label: entry.rank <= 3 ? `${MEDALJ[entry.rank]} Du kom ${placeText(entry.rank)}!` : "Placeringspris", coins: entry.prize });
    if (entry.correctCoins) rader.push({ label: `${entry.correct} rätt svar`, coins: entry.correctCoins });
    mynt = `<ul class="kge-mynt">${rader.map((l) => `<li><span>${esc(l.label)}</span><b>${l.coins} ${coinIcon("1em")}</b></li>`).join("")}</ul>
      <p class="kge-mynt-tot">Totalt: <b>${entry.total}</b> pluggmynt 🎉</p>`;
  } else if (row && sessionRewards(s)) {
    mynt = `<p class="hint">Inga pluggmynt den här gången – svara på frågorna nästa gång!</p>`;
  }
  return `<div class="kge-final"><div class="big-emoji">🙈</div><h2>${esc(rubrik)}</h2>
    <p class="kge-final-rad">${esc(slutRad(row, gom))}</p>
    ${row ? `<p class="kge-final-poang"><b>${row.poang | 0} p</b> · ${row.ratt | 0} rätt av ${row.besvarade | 0}</p>` : ""}
    ${mynt}</div>`;
}
