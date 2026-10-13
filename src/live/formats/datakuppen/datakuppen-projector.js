// ============================================================================
// Datakuppen – projektorns delar (#654). Laddas LATT av projektorskalet
// (src/live/projector.js) via DATAKUPPEN.projectorViews() = import().
// Vyvalet är lokalt per webbläsare (skalet, pp:live:vy); elevskärmsfönstret
// (#533) följer vyvalet, ljudet och musiken via skalets kanal som vanligt.
//   views        💾 Nätverket (timer + klassens data, topp 10 vid servrar,
//                terminalen, hack-linjen, milstolpar, pallplats – finale) ·
//                📊 Statistik (exakt ställning + klassens siffror med
//                hackförsök och andel lyckade – finale)
//   createLobby  inloggningen i nätverket (noder, säkerhetstips, STARTA)
//   createWinner Nätverket (pallplats/resultat) – skalet visar den bara om
//                vyvalet saknar egen final
//   ownTimer     vyerna visar själva matchens klocka – skalets timer göms
// Lärarkontrollerna (Avsluta, ljud, 🎵 Musik, fullskärm) är skalets.
// ============================================================================

import { createNatverket } from "./dk-natverket.js";
import { createStatsView } from "./dk-statistik.js";
import { createLobby } from "./dk-lobby.js";

export const ownTimer = true;

export const views = [
  { id: "natverket", label: "💾 Nätverket", create: createNatverket, finale: true },
  { id: "dk-statistik", label: "📊 Statistik", create: createStatsView, finale: true },
];

export { createLobby };

export function createWinner(host, opts) {
  return createNatverket(host, opts);
}
