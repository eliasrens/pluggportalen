// ============================================================================
// Pluggportalen – klädlådan i rummet (varld-rum-wear.js)
// ----------------------------------------------------------------------------
// Utbruten systermodul till varld-rum.js: allt som rör elevens PÅKLÄDNAD i
// rumsvyn – klädlådans rendering, sätt-på/ta-av (en sak per slot) och
// sparningen till Firestore. Rör inte rummets placeringar/drag & drop, så det
// lever fint som en egen liten enhet med ett smalt gränssnitt.
// ============================================================================

import * as data from "./data.js";
import { el, flash, renderTopbar } from "./ui.js";
import { getItem, isWearable } from "./shop-items.js";
import { wearableSvg } from "./art-wearables.js";

/**
 * Montera klädlådan i `wearTray`.
 *
 * @param {object} o
 * @param {HTMLElement} o.wearTray behållare för klädlådan
 * @param {object} o.sd            studentData (ownedItems, avatarItems)
 * @param {(equipped: string[]) => void} [o.onEquippedChange]
 *        körs när klädseln ändrats (så ute-avataren kan ritas om)
 */
export function mountWearTray({ wearTray, sd, onEquippedChange }) {
  const owned = sd.ownedItems || [];
  const wearItemsOwned = owned.filter((id) => isWearable(id) && getItem(id));
  // Burna klädsaker (delmängd av ownedItems).
  const equipped = new Set(sd.avatarItems || []);

  function renderWearTray() {
    wearTray.replaceChildren();
    if (wearItemsOwned.length === 0) {
      wearTray.appendChild(el(`<p class="hint">Du har inga kläder än – köp kläder & accessoarer i shoppen! 🧢</p>`));
      return;
    }
    for (const id of wearItemsOwned) {
      const item = getItem(id);
      const on = equipped.has(id);
      wearTray.appendChild(el(`<button class="wear-item${on ? " on" : ""}" data-wear="${id}" title="${item.name}">
        <span class="tray-emoji">${wearableSvg(id) || item.emoji}</span>
        <span class="tray-namn">${item.name}</span>
        <span class="wear-state">${on ? "På ✓" : "Sätt på"}</span>
      </button>`));
    }
  }

  // Klädsaker: sätt på / ta av (en per slot).
  wearTray.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-wear]");
    if (!btn) return;
    const id = btn.dataset.wear;
    const item = getItem(id);
    if (!item) return;
    if (equipped.has(id)) {
      equipped.delete(id);
    } else {
      // Bara en sak per slot – ta av ev. annan i samma slot.
      for (const otherId of [...equipped]) {
        const other = getItem(otherId);
        if (other && other.slot === item.slot) equipped.delete(otherId);
      }
      equipped.add(id);
    }
    renderWearTray();
    onEquippedChange?.([...equipped]);
    try {
      await data.saveAvatarItems([...equipped]);
      await renderTopbar(); // figuren i sidomenyn uppdateras direkt
    } catch (err) {
      flash("Kunde inte spara påklädnaden: " + err.message, true);
    }
  });

  renderWearTray();
}
