// ============================================================================
// Pluggportalen – mysterybox: köp/öppna-flöde med reveal-animation
// ----------------------------------------------------------------------------
// UI-lagret ovanpå openMysteryBox() (data-mystery.js). Visar en liten
// öppnings-animation (boxen skakar → öppnas) och ett tydligt reveal-kort med
// "Du fick X!" (eller "Dubblett! +N coins" om saken redan ägdes). Konsten för
// den vunna saken hämtas ur samma register som resten av sajten (wearableSvg/
// itemSvg/husSkalPreview) så den ser exakt ut som i garderob/rum/husväljare.
// Bruten ut ur pages-shop.js för att hålla filen liten och fokuserad.
// ============================================================================

import { el } from "./ui.js";
import { confetti } from "./fx.js";
import { coinIcon } from "./icons.js";
import { openMysteryBox } from "./data-mystery.js";
import { rarityInfo } from "./mystery-items.js";
import { wearableSvg } from "./art-wearables.js";
import { itemSvg } from "./art-items.js";
import { husSkalPreview } from "./art-hus-ute.js";

// Standardpalett för husskal-förhandsvisningen i reveal-kortet (samma --hus-*
// som ute-scenen sätter live; här räcker en trevlig defaultpalett).
const HUS_PREVIEW_STYLE =
  "--hus-house:#F4C57B;--hus-roof:#E8927C;--hus-wall:#9AD3F0;--hus-wall2:#6FB7DE";

/** Konst-SVG (eller emoji-fallback) för en vunnen sak, utifrån kategori. */
function itemArt(item) {
  if (item.category === "klader") return wearableSvg(item.id) || item.emoji;
  if (item.category === "hus") {
    return `<div class="mb-hus" style="${HUS_PREVIEW_STYLE}">${husSkalPreview(item.skalId || item.id)}</div>`;
  }
  return itemSvg(item.id) || item.emoji;
}

/** Var saken används (liten hjälptext under namnet). */
function usageHint(item) {
  if (item.category === "klader") return "Sätt på den i Mitt rum (klädlådan). 👕";
  if (item.category === "hus") return "Välj den via 🏠 Nytt hus i din husvärld. 🏠";
  if (item.category === "tradgard") return "Ställ ut den i din trädgård, ute runt huset. 🌳";
  return "Ställ ut den i Mitt rum. 🪴";
}

/**
 * Kör hela mysterybox-flödet: drar priset + lottar (openMysteryBox), och om det
 * lyckas visar reveal-modalen. Returnerar transaktionsresultatet så anroparen
 * kan uppdatera saldo/state direkt (modalen sköter sig själv efter det).
 *
 * @param {object} o
 * @param {number} o.price boxens pris
 * @param {() => void} [o.onClose] körs när modalen stängs (t.ex. rerender)
 * @returns {Promise<object>} openMysteryBox-resultatet ({ok, coins, item, ...})
 */
export async function runMysteryBox({ price, onClose }) {
  const res = await openMysteryBox(price);
  if (!res.ok) return res; // hade inte råd – anroparen visar meddelande
  showRevealModal(res, onClose);
  return res;
}

/** Bygg och visa reveal-modalen för ett lyckat box-resultat. */
function showRevealModal(res, onClose) {
  const item = res.item;
  const rar = rarityInfo(item.rarity);
  const overlay = el(`<div class="mb-overlay" role="dialog" aria-modal="true" aria-label="Mysterybox">
    <div class="mb-modal">
      <button class="cx-modal-close mb-close" aria-label="Stäng">✕</button>
      <div class="mb-stage">
        <div class="mb-box" aria-hidden="true">${giftSvg()}</div>
        <div class="mb-reveal" hidden>
          <p class="mb-rarity" style="--rar:${rar.farg}">${rar.label}</p>
          <div class="mb-card" style="--rar:${rar.farg}">
            <div class="mb-art">${itemArt(item)}</div>
          </div>
          <p class="mb-name">${item.name}</p>
          <p class="mb-got">${
            res.duplicate
              ? `Dubblett! Du hade redan den – så du får <b>${coinIcon(16)} ${res.refund}</b> i stället. 🎉`
              : `Du fick <b>${item.name}</b>! ${usageHint(item)}`
          }</p>
          <button class="btn mb-ok">Toppen!</button>
        </div>
      </div>
    </div>
  </div>`);

  const stage = overlay.querySelector(".mb-stage");
  const box = overlay.querySelector(".mb-box");
  const reveal = overlay.querySelector(".mb-reveal");

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    onClose?.();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(); // klick på bakgrunden stänger
  });
  overlay.querySelector(".mb-close").addEventListener("click", close);
  overlay.querySelector(".mb-ok").addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);

  // Animation: boxen skakar ~0,9 s → poppar bort → saken avslöjas.
  box.classList.add("shake");
  setTimeout(() => {
    box.classList.add("burst");
    stage.classList.add("done");
    reveal.hidden = false;
    // Extra festligt för de finaste dropparna (legendary får störst svall).
    if (item.rarity === "legendary") confetti(140);
    else if (item.rarity === "sallsynt") confetti(70);
  }, 900);
}

/** Liten present-SVG (box + rosett) för öppnings-animationen. */
function giftSvg() {
  return `<svg viewBox="0 0 100 100" role="img" aria-label="Mysterybox"
      xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="42" width="64" height="46" rx="8" fill="#EF6F6C"
      stroke="#3B3350" stroke-width="3"/>
    <rect x="14" y="32" width="72" height="18" rx="6" fill="#F08A3C"
      stroke="#3B3350" stroke-width="3"/>
    <rect x="44" y="32" width="12" height="56" fill="#F7C948" stroke="#3B3350" stroke-width="2.4"/>
    <path d="M50 32 Q34 12 26 24 Q22 32 50 34 Q78 32 74 24 Q66 12 50 32 Z"
      fill="#F7C948" stroke="#3B3350" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="30" r="5" fill="#FDE9A8" stroke="#3B3350" stroke-width="2.4"/>
    <text x="50" y="72" font-size="20" text-anchor="middle" fill="#fff"
      font-weight="800" font-family="system-ui">?</text>
  </svg>`;
}
