// ============================================================================
// Pluggportalen – "Mina djur"-panelen (undanstuvade djur, bredvid Lådan)
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
// ============================================================================

import { el } from "./ui.js";

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
 * @returns {{ render: () => void }}
 */
export function mountRumDjurTray({ tray, hint, listStowed, onReturn }) {
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
  }

  tray.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-return-id]");
    if (!btn) return;
    onReturn(btn.dataset.returnKind, btn.dataset.returnId);
  });

  render();
  return { render };
}
