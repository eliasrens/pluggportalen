// ============================================================================
// Meteorstormen – projektorns delar (#822). Laddas LATT av projektorskalet
// (src/live/projector.js) via METEORSTORM.projectorViews() = import().
//   views        ☄️ Rymden (stationerna, stormen, banderollerna, flödet och
//                slutrutan – finale)
//   createLobby  rymden med stationerna i vila, "N elever redo", STARTA
//   createWinner Rymden (slutrutan) – skalet visar den bara om vyvalet saknar
//                egen final
//   ownTimer     vyn visar matchens klocka själv – skalets timer göms
//   ownControls  vyn har egen Avsluta-knapp: den anropar msAvsluta (servern
//                avslutar och räknar result), inte kärnans finishLiveSession.
// Ljud, 🎵 Musik (format.music, E #824) och fullskärm är skalets. Paus finns
// inte: stormen följer serverns klocka (samma för alla elever och projektorer).
// ============================================================================

import { createRymden } from "./msp-rymd.js";
import { createLobby } from "./msp-lobby.js";

export const ownTimer = true;
export const ownControls = true;

export const views = [
  { id: "ms-rymden", label: "☄️ Rymden", create: createRymden, finale: true },
];

export { createLobby };

export function createWinner(host, opts) {
  return createRymden(host, opts);
}
