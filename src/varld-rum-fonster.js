// ============================================================================
// Pluggportalen – fönstret i rummet (flyttbart/raderbart VÄGG-objekt)
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear/mat/djur): äger fönstrets
// tillstånd för ETT rum. Fönstret är ingen shop-sak – läget sparas separat som
// rummets window-fält { x, y, removed }: saknas data → default vid väggskarven;
// removed:true → borttaget (kvarstår efter reload, kan läggas tillbaka via
// lådan). Positionen clampas till väggzonen av draglogiken i varld-rum.js
// (fönstrets centrum korsar aldrig golvlinjen). Varje rum har SITT eget fönster
// (flerrums-stödet, issue #34): den som monterar skickar in rummets sparade
// window-data + en save-callback som skriver till RÄTT rum (data.saveRoomAt).
// ============================================================================

import { el, clamp } from "./ui.js";
import { FLOOR_TOP, WINDOW_ID, WINDOW_DEFAULT, windowItemHtml } from "./art-room.js";

/**
 * Montera fönster-tillståndet för ETT rum i rumsscenen.
 * @param {object} o
 * @param {object|null} o.saved  rummets sparade window-data ({ x, y, removed }) eller null
 * @param {(win: {x:number,y:number,removed:boolean}) => Promise|void} o.save
 *        sparar fönstrets läge till rätt rum (debounce sköts här)
 * @returns {{ isRemoved: () => boolean, stageNode: (selected: boolean) => HTMLElement|null,
 *   trayNode: () => HTMLElement|null, restore: () => void, remove: () => void,
 *   setPos: (x: number, y: number) => void, scheduleSave: () => void }}
 */
export function mountRumFonster({ saved, save }) {
  let removed = !!(saved && saved.removed);
  let pos = {
    x: saved && Number.isFinite(saved.x) ? clamp(saved.x, 3, 97) : WINDOW_DEFAULT.x,
    y: saved && Number.isFinite(saved.y) ? clamp(saved.y, 4, FLOOR_TOP) : WINDOW_DEFAULT.y,
  };

  // Spara läge/borttagning (debounce). Skrivningen delegeras till save-callbacken
  // så rätt rum träffas (grundrummet → room.window, extra rum → extraRooms.*).
  let timer = null;
  function scheduleSave() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      Promise.resolve(save({ x: pos.x, y: pos.y, removed })).catch(() => {});
    }, 250);
  }

  return {
    isRemoved: () => removed,
    /** Fönstret i scenen (ritas direkt ovanpå bakgrunden), null om borttaget. */
    stageNode(selected) {
      if (removed) return null;
      return el(windowItemHtml({ x: pos.x, y: pos.y, selected }));
    },
    /** Lådans "lägg tillbaka fönstret"-knapp, null när fönstret sitter uppe. */
    trayNode() {
      if (!removed) return null;
      return el(`<button class="tray-item" data-restore="${WINDOW_ID}" title="Fönster">
        <span class="tray-emoji">🪟</span>
        <span class="tray-namn">Fönster</span>
      </button>`);
    },
    /** Lägg tillbaka fönstret (åter vid väggskarven). */
    restore() {
      removed = false;
      pos = { ...WINDOW_DEFAULT };
      scheduleSave();
    },
    /** Ta bort fönstret (kvarstår borta efter reload). */
    remove() {
      removed = true;
      scheduleSave();
    },
    setPos(x, y) {
      pos = { x, y };
    },
    scheduleSave,
  };
}
