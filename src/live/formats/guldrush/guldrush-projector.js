// ============================================================================
// Guldrushen – projektorns delar (#565). Laddas LATT av projektorskalet
// (src/live/projector.js) via GULDRUSH.projectorViews() = import(). Bara
// Guldrushens egna vyer – Raketrace/Trollkarlsduellen hör till Klassmatchen.
// Vyvalet är lokalt per webbläsare (skalet, pp:live:vy); elevskärmsfönstret
// (#533) följer vyvalet och ljudet via skalets kanal som vanligt.
//   views        💰 Skattkammaren (grottan: timer + klassens guld, topp 10
//                vid guldhögar, händelseflöde, banderoller, pallplats –
//                finale) · 📊 Statistik (anonym, exakt – finale)
//   createLobby  grottans ingång (skattjägarna studsar in, STARTA)
//   createWinner Skattkammaren (pallplats/resultat) – skalet visar den bara
//                om vyvalet saknar egen final
//   ownTimer     vyerna visar själva matchens klocka (stor, i grottans
//                stil) – skalets timer göms
// Lärarkontrollerna (Avsluta med bekräftelse, ljud, fullskärm) är skalets.
// ============================================================================

import { createSkattkammare } from "./gr-skattkammare.js";
import { createStatsView } from "./gr-statistik.js";
import { createLobby } from "./gr-lobby.js";

export const ownTimer = true;

export const views = [
  { id: "skattkammaren", label: "💰 Skattkammaren", create: createSkattkammare, finale: true },
  { id: "gr-statistik", label: "📊 Statistik", create: createStatsView, finale: true },
];

export { createLobby };

export function createWinner(host, opts) {
  return createSkattkammare(host, opts);
}
