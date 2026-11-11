// ============================================================================
// Kurragömma – projektorns delar (#839). Laddas LATT av projektorskalet
// (src/live/projector.js) via KURRAGOMMA.projectorViews() = import().
//   views        🙈 Ön (3D-scenen snett ovanifrån, toppraden, händelseflödet,
//                effekterna, ljudet och finalen – finale)
//   createLobby  ön med figurer på stranden, förklaringen, "N elever redo", STARTA
//   createWinner Ön (finalen) – skalet visar den bara om vyvalet saknar egen final
//   ownTimer     vyn visar matchens klocka själv (toppraden) – skalets timer göms
// Avsluta (med bekräftelse), ljud av/på, 🎵 Musik (format.music) och fullskärm
// är skalets – Avsluta går genom kärnans flöde (status finished →
// format.resultInputs → kgAvsluta, serverns result gäller).
// ============================================================================

import { createOn } from "./kgp-on.js";
import { createLobby } from "./kgp-lobby.js";

export const ownTimer = true;

export const views = [
  { id: "kg-on", label: "🙈 Ön", create: createOn, finale: true },
];

export { createLobby };

export function createWinner(host, opts) {
  return createOn(host, opts);
}
