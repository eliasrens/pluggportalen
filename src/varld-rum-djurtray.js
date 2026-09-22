// ============================================================================
// Pluggporten – "Mina djur"-panelen (undanstuvade djur, bredvid Lådan)
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear.js/varld-rum-mat.js): äger
// "Mina djur"-lådan – elevens UNDANSTUVADE djur (både vanliga roomAnimals och
// mystery-pets som just nu inte är i rummet). Speglar Lådans mönster
// (renderTray): varje undanstuvat djur listas som en <button class="tray-item">
// och ett klick LÄGGER TILLBAKA djuret i rummet (det promenerar igen).
//
// Rummet (varld-rum.js) äger djur-datan; den här modulen får in listStowed()
// (aktuella undanstuvade djur som { kind, id, name, artHtml }) och onReturn()
// (lägg tillbaka ett djur) och sköter bara rendering + klick.
//
// BONDGÅRDSDJUREN (#330): panelen visar dessutom en placerings-sektion – varje
// ägt bondgårdsdjur (häst/ko/gris, farm.animals) listas med tre platsval
// (🛏️ Rummet / 🌾 Hagen / 🏠 Ladan). Rummet ger listFarm() + onPlace(); valet
// sparas i farm.placedAnimals (data-farm.js) och gårds-grenen ritar djuren i
// hagen/ladan vid nästa besök.
// ============================================================================

import { el } from "./ui.js";

/** Platsvalen för ett bondgårdsdjur (ordning = knappordning i panelen). */
const FARM_PLACES = [
  { id: "room", label: "🛏️ Rummet" },
  { id: "paddock", label: "🌾 Hagen" },
  { id: "barn", label: "🏠 Ladan" },
];

/**
 * Montera "Mina djur"-lådan.
 *
 * @param {object} o
 * @param {HTMLElement} o.tray  behållaren för djur-korten (#djurtray)
 * @param {HTMLElement} o.hint  hint-raden ovanför lådan (#djur-hint)
 * @param {() => Array<{kind: "animal"|"pet", id: string, name: string, artHtml: string}>} o.listStowed
 *        aktuella undanstuvade djur (rummet räknar fram dem vid varje render)
 * @param {(kind: "animal"|"pet", id: string) => void} o.onReturn
 *        lägg tillbaka djuret i rummet (rummet uppdaterar data + ritar om)
 * @param {() => Array<{id: string, name: string, artHtml: string, location: string}>} [o.listFarm]
 *        elevens bondgårdsdjur med aktuell plats (rum/hage/lada)
 * @param {(id: string, location: string) => void} [o.onPlace]
 *        flytta ett bondgårdsdjur (rummet uppdaterar data + ritar om)
 * @returns {{ render: () => void }}
 */
export function mountRumDjurTray({ tray, hint, listStowed, onReturn, listFarm, onPlace }) {
  function render() {
    tray.replaceChildren();
    const stowed = listStowed();
    if (stowed.length === 0) {
      hint.textContent =
        "Inga undanstuvade djur än. Klicka på ett djur, tryck ✏️ och sedan 📦 Stuva undan – då hamnar det här.";
    } else {
      hint.textContent = "Klicka på ett djur för att släppa ut det i rummet igen. 🐾";
    }
    for (const d of stowed) {
      tray.appendChild(el(`<button class="tray-item" data-return-id="${d.id}" data-return-kind="${d.kind}" title="${d.name}">
        <span class="tray-emoji">${d.artHtml}</span>
        <span class="tray-namn">${d.name}</span>
      </button>`));
    }
    // Bondgårdsdjuren: en rad per djur med tre platsval (aktivt val markerat).
    const farm = listFarm ? listFarm() : [];
    if (farm.length > 0) {
      tray.appendChild(el(`<p class="hint djurtray-farm-hint">Dina bondgårdsdjur – välj var de ska bo:</p>`));
      for (const d of farm) {
        const knappar = FARM_PLACES.map((p) => `<button class="btn liten${p.id === d.location ? "" : " ghost"}"
            data-place-id="${d.id}" data-place-loc="${p.id}" type="button"
            ${p.id === d.location ? 'aria-pressed="true" disabled' : 'aria-pressed="false"'}>${p.label}</button>`)
          .join("");
        tray.appendChild(el(`<div class="djurtray-farm-rad" title="${d.name}">
          <span class="tray-emoji">${d.artHtml}</span>
          <span class="tray-namn">${d.name}</span>
          <span class="djurtray-farm-val">${knappar}</span>
        </div>`));
      }
    }
  }

  tray.addEventListener("click", (e) => {
    const place = e.target.closest("[data-place-id]");
    if (place) {
      onPlace?.(place.dataset.placeId, place.dataset.placeLoc);
      return;
    }
    const btn = e.target.closest("[data-return-id]");
    if (!btn) return;
    onReturn(btn.dataset.returnKind, btn.dataset.returnId);
  });

  render();
  return { render };
}
