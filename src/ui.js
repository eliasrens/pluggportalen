// ============================================================================
// Pluggportalen – gemensamma UI-hjälpare
// Delas av app.js (router) och sidmodulerna: DOM-referenser, navigering,
// en liten mall-hjälpare och sidhuvudet (topbar) med avatar, coins och utloggning.
// ============================================================================

import * as data from "./data.js";
import { avatarEmoji, DEFAULT_AVATAR } from "./avatars.js";

export const app = document.getElementById("app");
export const topbarRight = document.getElementById("topbar-right");

/** Navigera till en hash-route. */
export function go(hash) {
  window.location.hash = hash;
}

/** Bygg ett element från en HTML-sträng (första elementet returneras). */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Visa en enkel laddningsindikator i huvudytan. */
export function loading(msg = "Laddar…") {
  app.innerHTML = `<div class="spinner">${msg}</div>`;
}

/**
 * Rita sidhuvudets högra del. När eleven är inloggad visas avatar + namn
 * (klick → profil), pluggcoins-saldo och en utloggningsknapp – överallt.
 */
export async function renderTopbar() {
  const session = data.getSession();
  if (!session) {
    topbarRight.innerHTML = "";
    return;
  }
  // Hämta coins + avatar i ett svep.
  let coins = 0;
  let avatarId = DEFAULT_AVATAR;
  try {
    const sd = await data.getStudentData();
    coins = sd.coins || 0;
    avatarId = sd.avatarId || DEFAULT_AVATAR;
  } catch {}

  const wrap = el(`<div class="topbar-user">
    <button class="avatar-chip" id="profil-btn" title="Min profil">
      <span class="avatar-emoji">${avatarEmoji(avatarId)}</span>
      <span class="avatar-namn">${session.namn || "Elev"}</span>
    </button>
    <span class="coins">🪙 ${coins}</span>
    <button class="btn ghost liten" id="logout-btn">Logga ut</button>
  </div>`);
  wrap.querySelector("#profil-btn").addEventListener("click", () => go("#/elev/profil"));
  wrap.querySelector("#logout-btn").addEventListener("click", () => {
    data.logout();
    go("#/");
  });
  topbarRight.replaceChildren(wrap);
}
