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
//
// DJUR I ALLA RUM (#698): i hus med flera rum får varje djur i huset (mystery-
// djur, vanliga djur och bondgårdsdjur) rumsval "Rum 1", "Rum 2" … – valet
// sparas som "room:N" i farm.placedAnimals. Enrums-hus ser panelen som förut.
// ============================================================================

import { el } from "./ui.js";
import { roomLocation } from "./farm-core.js";

/** Gårds-platserna för ett bondgårdsdjur (efter rumsvalet i knappraden). */
const FARM_PLACES = [
  { id: "paddock", label: "🌾 Hagen" },
  { id: "barn", label: "🏠 Ladan" },
];

/** En platsknapp (aktivt val ifyllt/disabled, samma utseende som förut). */
function platsKnapp(id, loc, label, aktiv) {
  return `<button class="btn liten${aktiv ? "" : " ghost"}"
    data-place-id="${id}" data-place-loc="${loc}" type="button"
    ${aktiv ? 'aria-pressed="true" disabled' : 'aria-pressed="false"'}>${label}</button>`;
}

/**
 * Rumsknapparna för ett djur: "🛏️ Rummet" i enrums-hus (som förut), annars
 * "Rum 1" … "Rum N". `room` = rummet djuret bor i nu (null = ute på gården).
 */
function rumKnappar(id, room, roomCount) {
  if (roomCount <= 1) return platsKnapp(id, "room", "🛏️ Rummet", room !== null);
  let html = "";
  for (let i = 0; i < roomCount; i++) html += platsKnapp(id, roomLocation(i), `🛏️ Rum ${i + 1}`, room === i);
  return html;
}

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
 * @param {() => Array<{id: string, name: string, artHtml: string, location: string, room: number|null}>} [o.listFarm]
 *        elevens bondgårdsdjur med aktuell plats (rum/hage/lada) + rum-index
 *        (null = ute på gården)
 * @param {() => Array<{id: string, name: string, artHtml: string, room: number}>} [o.listHouse]
 *        djuren som bor i huset (mystery + vanliga, ej undanstuvade) med rum
 * @param {number} [o.roomCount=1]  antal rum i huset (rumsvalen visas bara om > 1)
 * @param {(id: string, location: string) => void} [o.onPlace]
 *        flytta ett djur: "room"/"room:N" (alla djur) eller "paddock"/"barn"
 *        (bondgårdsdjur) – rummet uppdaterar data + ritar om
 * @returns {{ render: () => void }}
 */
export function mountRumDjurTray({ tray, hint, listStowed, onReturn, listFarm, listHouse, roomCount = 1, onPlace }) {
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
    // Djuren i huset (#698): bara i flerrums-hus – en rad per djur med rumsval.
    const hus = roomCount > 1 && listHouse ? listHouse() : [];
    if (hus.length > 0) {
      tray.appendChild(el(`<p class="hint djurtray-farm-hint">Dina djur – välj vilket rum de ska bo i:</p>`));
      for (const d of hus) tray.appendChild(rad(d, rumKnappar(d.id, d.room, roomCount)));
    }
    // Bondgårdsdjuren: en rad per djur med rum + hage + lada (aktivt val markerat).
    const farm = listFarm ? listFarm() : [];
    if (farm.length > 0) {
      tray.appendChild(el(`<p class="hint djurtray-farm-hint">Dina bondgårdsdjur – välj var de ska bo:</p>`));
      for (const d of farm) {
        const knappar = rumKnappar(d.id, d.room, roomCount) +
          FARM_PLACES.map((p) => platsKnapp(d.id, p.id, p.label, p.id === d.location)).join("");
        tray.appendChild(rad(d, knappar));
      }
    }
  }

  /** En placerings-rad: konst + namn + knappar. */
  function rad(d, knappar) {
    return el(`<div class="djurtray-farm-rad" title="${d.name}">
      <span class="tray-emoji">${d.artHtml}</span>
      <span class="tray-namn">${d.name}</span>
      <span class="djurtray-farm-val">${knappar}</span>
    </div>`);
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
