// ============================================================================
// Pluggporten – klädlådan i rummet (varld-rum-wear.js)
// ----------------------------------------------------------------------------
// Utbruten systermodul till varld-rum.js: allt som rör elevens PÅKLÄDNAD i
// rumsvyn – klädlådans rendering, sätt-på/ta-av (en sak per slot) och
// sparningen till Firestore. Rör inte rummets placeringar/drag & drop, så det
// lever fint som en egen liten enhet med ett smalt gränssnitt.
//
// Säsongskostymer (#693): när säsongen är av visas de gråade med "Kan bäras
// igen nästa Halloween" – kan tas av men inte på (wearableActive, avatars.js).
// Lådan ritas om när säsongen slår om (<html data-halloween> ändras).
// ============================================================================

import * as data from "./data.js";
import { el, flash, renderTopbar } from "./ui.js";
import { getItem, isWearable } from "./shop-items.js";
import { wearableSvg } from "./art-wearables.js";
import { wearableActive } from "./avatars.js";

/** Pumpa-ikonen för vilande kostymer (SVG – ingen Emoji 13+-risk, #590). */
const PUMPA_IKON =
  `<svg class="wear-vilar-ikon" viewBox="0 0 20 20" aria-hidden="true">` +
  `<path d="M10 6 Q9.6 3 12 1.6" fill="none" stroke="#4E9B5E" stroke-width="1.8" stroke-linecap="round"/>` +
  `<ellipse cx="6.6" cy="12" rx="5" ry="6" fill="#F08A3C"/><ellipse cx="13.4" cy="12" rx="5" ry="6" fill="#F08A3C"/>` +
  `<ellipse cx="10" cy="12" rx="5" ry="6.6" fill="#F49E4C"/></svg>`;

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
      const vilar = !wearableActive(item);
      const state = vilar ? `${PUMPA_IKON}${on ? "Ta av" : "Kan bäras igen nästa Halloween"}` : on ? "På ✓" : "Sätt på";
      wearTray.appendChild(el(`<button class="wear-item${on ? " on" : ""}${vilar ? " vilar" : ""}" data-wear="${id}" title="${item.name}"${vilar && !on ? ` aria-disabled="true"` : ""}>
        <span class="tray-emoji">${wearableSvg(id) || item.emoji}</span>
        <span class="tray-namn">${item.name}</span>
        <span class="wear-state">${state}</span>
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
    } else if (!wearableActive(item)) {
      flash("🎃 Kan bäras igen nästa Halloween!");
      return;
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

  // Säsongen slår om (t.ex. slutdatumet passerar) → rita om. Lyssnar direkt på
  // attributet som också styr synligheten, så lådan och figuren alltid är överens.
  const sasong = new MutationObserver(() => {
    if (!wearTray.isConnected) sasong.disconnect();
    else renderWearTray();
  });
  sasong.observe(document.documentElement, { attributes: true, attributeFilter: ["data-halloween"] });

  renderWearTray();
}
