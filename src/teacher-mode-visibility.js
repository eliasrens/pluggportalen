// ============================================================================
// Pluggportalen – lärarsidan: kryssrutor för synliga lägen (teacher-mode-visibility.js)
// ----------------------------------------------------------------------------
// Utbrutet ur teacher-content.js (issue #207) för att hålla den filen under
// radtaket och samla synlighets-UI:t på ett ställe. En liten fabrik som stänger
// om en DOM-behållare (#mode-visibility) och sköter:
//   • render()      – rita kryssrutorna utifrån ett områdes innehåll.
//   • getHidden()   – läs av vilka lägen som ska DÖLJAS (value.hiddenModes).
//   • autoFromJson()– rita DIREKT ur redigeringsrutans JSON (upptäckbarhet), så
//                     listan inte är tom tills man klickar Kontrollera.
//
// Lägena härleds GENERISKT ur GAMEMODES (availableGamemodes) så nya spellägen
// dyker upp automatiskt – bara lägen området har underlag för visas. Ikryssat =
// synligt för eleven; urbockat hamnar i value.hiddenModes (issue #200).
// ============================================================================

import { availableGamemodes, isModeHidden } from "./game-shared.js";
import { esc } from "./teacher-shared.js";

// Tom-state när inget område laddats och rutan är tom (issue #207): tydlig
// uppmaning i stället för en tom yta.
const EMPTY_NO_CONTENT =
  "Ladda ett befintligt område nedan, eller klicka Kontrollera, för att välja vilka lägen som visas.";
// Innehåll finns men inget läge har underlag än (inga frågor/par).
const EMPTY_NO_MODES =
  "Inga lägen än – lägg till innehåll (frågor eller par) och klicka Kontrollera.";

/**
 * Skapa synlighets-UI:t kring en behållare.
 * @param {HTMLElement} modeBox behållaren (#mode-visibility) att rita i.
 */
export function createModeVisibility(modeBox) {
  /**
   * Rita kryssrutorna utifrån ett områdes innehåll.
   *   • fromArea=true  → utgå från områdets sparade hiddenModes (vid inladdning).
   *   • fromArea=false → behåll lärarens nuvarande i-/urbockningar och lägg bara
   *                       till/ta bort lägen som innehållet ändrat (vid Kontrollera).
   * @param {object} area
   * @param {boolean} fromArea
   * @param {string} [emptyMsg] meddelande när inga lägen finns (default EMPTY_NO_MODES).
   */
  function render(area, fromArea, emptyMsg = EMPTY_NO_MODES) {
    const modes = availableGamemodes(area);
    if (modes.length === 0) {
      modeBox.innerHTML = `<p class="hint">${esc(emptyMsg)}</p>`;
      return;
    }
    const prev = new Map();
    if (!fromArea) {
      modeBox.querySelectorAll('input[type="checkbox"]').forEach((c) => prev.set(c.value, c.checked));
    }
    modeBox.innerHTML = modes
      .map((gm) => {
        const checked = prev.has(gm.id) ? prev.get(gm.id) : !isModeHidden(area, gm.id);
        return `<label class="member-row">
          <input type="checkbox" value="${esc(gm.id)}"${checked ? " checked" : ""} />
          <span class="member-avatar">${esc(gm.emoji)}</span>
          <span class="member-name">${esc(gm.name)}<br><span class="hint">${esc(gm.sub)}</span></span>
        </label>`;
      })
      .join("");
  }

  /**
   * Vilka lägen som ska DÖLJAS: bara lägen som (a) har en renderad kryssruta som
   * är urbockad OCH (b) faktiskt har underlag i det som sparas. Nya lägen utan
   * kryssruta räknas som synliga (default), så nytt innehåll aldrig göms av misstag.
   * @param {object} value området som sparas.
   * @returns {string[]}
   */
  function getHidden(value) {
    const availableIds = new Set(availableGamemodes(value).map((gm) => gm.id));
    return [...modeBox.querySelectorAll('input[type="checkbox"]:not(:checked)')]
      .map((c) => c.value)
      .filter((id) => availableIds.has(id));
  }

  /**
   * Rita kryssrutorna DIREKT ur redigeringsrutans råa JSON, utan att kräva ett
   * klick på Kontrollera (upptäckbarhet, issue #207). Tom ruta → tom-state.
   * Trasig JSON mitt i skrivandet → låt nuvarande kryssrutor stå kvar orörda.
   * @param {string} rawJson textarean-värdet.
   */
  function autoFromJson(rawJson) {
    const raw = String(rawJson || "").trim();
    if (!raw) {
      render({}, true, EMPTY_NO_CONTENT);
      return;
    }
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch {
      return; // ofullständig/trasig JSON – behåll det som redan visas.
    }
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      render(obj, false);
    }
  }

  return { render, getHidden, autoFromJson };
}
