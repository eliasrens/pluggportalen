// ============================================================================
// Pluggporten – Shoppens köpbekräftelse (bruten ur pages-shop.js, #692)
// ----------------------------------------------------------------------------
// Texten i flash-rutan efter ett lyckat köp, per sorts sak: var den hamnar och
// hur eleven använder den. Laddas med import() efter köpet (#271).
// ============================================================================

import { EGG_ITEM_ID, LAMP_ITEM_ID } from "./data-pet.js";
import { APPLE_ITEM_ID } from "./data-pet-mat.js";
import { isAnimalItem, isFarmAnimalItem } from "./shop-items.js";

/** Bekräftelsetexten för ett köp. `state.appleCount` = äpplen efter köpet. */
export function kopMeddelande(item, state) {
  if (item.id === EGG_ITEM_ID) return `Du köpte ett mystiskt ägg! 🥚 Det ruvar nu i Mitt rum.`;
  if (item.id === LAMP_ITEM_ID) return `Du köpte en värmelampa! 🔦 Nu kläcks ägget dubbelt så snabbt.`;
  if (item.id === APPLE_ITEM_ID) {
    return `Du köpte ett äpple! 🍎 Du har nu ${state.appleCount} st – lägg ut dem i Mitt rum så äter husdjuren.`;
  }
  if (isAnimalItem(item.id)) return `Du köpte ${item.name}! ${item.emoji} Den promenerar nu omkring i Mitt rum.`;
  if (isFarmAnimalItem(item.id)) {
    return `Du köpte ${item.name}! ${item.emoji} Den bor i Mitt rum – välj rum, hage eller lada under 🐾 Mina djur.`;
  }
  if (item.farmUpgrade === "garden") {
    return `Du köpte ${item.name}! ${item.emoji} Odlingsbädden på gården är nu större – så fler grödor där.`;
  }
  if (item.farmUpgrade === "barn") {
    return `Du köpte ${item.name}! ${item.emoji} Laggården är uppgraderad – fler djur får plats i ladan.`;
  }
  if (item.roomUpgrade) {
    return `Du köpte ${item.name}! 🚪 Ett nytt rum finns nu i ditt hus – gå in och byt rum via dörren eller rumslistan.`;
  }
  // Lada-skins (#353): väljs på gården (🛖 Ny lada), inte i 🏠 Nytt hus.
  if (item.barnSkin) return `Du köpte ${item.name}! ${item.emoji} Byt till den via 🛖 Ny lada på gården bakom ditt hus.`;
  if (item.category === "hus") return `Du köpte ${item.name}! ${item.emoji} Byt till det via 🏠 Nytt hus i din husvärld.`;
  if (item.seed) return `Du köpte ${item.name}! ${item.emoji} Så dem i odlingsbädden på gården bakom ditt hus.`;
  if (item.category === "tradgard") {
    return `Du köpte ${item.name}! ${item.emoji} Ställ ut den via 🌳 Trädgård i din husvärld.`;
  }
  return item.category === "klader"
    ? `Du köpte ${item.name}! Sätt på den i Mitt rum.`
    : `Du köpte ${item.name}! Placera den i Mitt rum.`;
}
