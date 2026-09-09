// ============================================================================
// Pluggportalen – äventyrsmotorn: hand-tool.js  (issue #225)
// ----------------------------------------------------------------------------
// ÅTERANVÄNDBART "tema-verktyg i handen". Ett tema kan ange ett verktyg (t.ex.
// Gruvans pickhacka) som ritas i elevens avatar-hand som ett EXTRA lager ovanpå
// den vanliga avatar-renderingen (avatarMarkup) – klädsel, spegling och gå-studs
// rörs inte. Framtida teman (yxa, håv, spade …) sätter bara sitt eget
// `handTool` i tema-configen; motorn/scenen är oförändrad.
//
// Verktyget läggs i .adv-avatar tillsammans med figuren i en .adv-fig-wrapper
// (samma 1em×1.2em-box som .avatar-figure). Spegling (vänd vänster) flippas på
// wrappern så figur + verktyg vänder ihop; hack-animationen (playHack) svingar
// verktyget en kort stund när en station "bryts" (se games.css).
// ============================================================================

/**
 * Plocka ut verktygs-SVG:n ur ett tema. Tolerant kontrakt så teman kan skriva
 * antingen en färdig sträng, en fabrik, eller ett objekt med metadata:
 *   handTool: "<svg…>"            – rå markup
 *   handTool: () => "<svg…>"      – fabrik (körs en gång vid rendering)
 *   handTool: { svg }             – svg får vara sträng ELLER fabrik
 * @returns {string|null} verktygets HTML, eller null om temat saknar verktyg.
 */
export function resolveHandTool(theme) {
  const t = theme && theme.handTool;
  if (!t) return null;
  if (typeof t === "function") return t();
  if (typeof t === "string") return t;
  const svg = t.svg;
  if (typeof svg === "function") return svg();
  if (typeof svg === "string") return svg;
  return null;
}

/**
 * Bygg innehållet i .adventure-player (dvs. .adv-avatar-blocket). Med ett
 * tema-verktyg wrappas figuren + verktyget i .adv-fig så de speglas ihop; utan
 * verktyg återges EXAKT samma markup som förr (byte-identisk för tema utan
 * verktyg → inga regressioner i Spökjakten/Skattjakten m.fl.).
 * @param {string} avatarHtml  avatarMarkup(...) (redan med klädsel)
 * @param {object} theme       tema-config (läser bara theme.handTool)
 * @returns {string} HTML för .adventure-player-innehållet
 */
export function playerAvatarHtml(avatarHtml, theme) {
  const tool = resolveHandTool(theme);
  if (!tool) return `<div class="adv-avatar">${avatarHtml}</div>`;
  return (
    `<div class="adv-avatar adv-has-tool">` +
    `<span class="adv-fig">${avatarHtml}` +
    `<span class="adv-hand-tool" aria-hidden="true">${tool}</span>` +
    `</span></div>`
  );
}

/**
 * Spela en kort hack/hugg-rörelse på spelaren (svingar verktyget + liten
 * kroppsansträngning). Självstädande: klassen tas bort när animationen är klar,
 * och en snabb reflow ser till att rörelsen kan spelas om direkt vid nästa
 * station. No-op för teman utan verktyg (då finns inget .adv-hand-tool att
 * svinga, men kroppsstöten skadar inte). Respektera reduced-motion sker i CSS.
 * @param {HTMLElement} playerEl  .adventure-player-elementet
 */
export function playHack(playerEl) {
  if (!playerEl) return;
  playerEl.classList.remove("adv-hacking");
  void playerEl.offsetWidth; // tvinga reflow → animationen kan starta om direkt
  playerEl.classList.add("adv-hacking");
  window.setTimeout(() => playerEl.classList.remove("adv-hacking"), 560);
}
