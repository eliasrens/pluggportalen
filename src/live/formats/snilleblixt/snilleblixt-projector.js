// ============================================================================
// Snilleblixten – projektorns delar (#559). Laddas LATT av projektorskalet
// (src/live/projector.js) via SNILLEBLIXT.projectorViews() = import(). Bara
// Snilleblixtens egna vyer – Raketrace/Trollkarlsduellen hör till
// Klassmatchen och visas inte här. Elevskärmsfönstret (#533) följer vyvalet
// och ljudet via skalets kanal som vanligt.
//   views        ⚡ Studion (TV-studion: fråga, avslöjande, topplista, pall-
//                plats – finale) · 📊 Statistik (exakt tabell, finale)
//   createLobby  studions lobby (publik, STARTA)
//   createWinner studion (pallplats/resultat) – skalet visar den bara om
//                vyvalet saknar egen final
//   ownControls  vyerna har egna lärarkontroller (skalets "Avsluta" göms)
// ============================================================================

import { createStudioView } from "./sb-studio.js";
import { createStatsView } from "./sb-statistik.js";
import { createLobby } from "./sb-lobby.js";

export const ownControls = true;

export const views = [
  { id: "studio", label: "⚡ Studion", create: createStudioView, finale: true },
  { id: "sb-statistik", label: "📊 Statistik", create: createStatsView, finale: true },
];

export { createLobby };

export function createWinner(host, opts) {
  return createStudioView(host, opts);
}
