// ============================================================================
// Live – inbyggda spellägen (#457)
// ----------------------------------------------------------------------------
// ENDA stället där spellägen kopplas in. Nytt läge = importera + lägg till i
// BUILTIN_MODES. Live-kärnan importerar härifrån (inte från game-modes.js
// direkt) så att registret alltid är fyllt.
//
// API: re-exporterar getGameMode/requireGameMode/listGameModes (fyllt register)
//      DEFAULT_GAME_MODE – id:t lärarens väljare förvaljer.
//
// ⚠️ Bootgraf (#271): importera bara DYNAMISKT från Live-/Mattematchen-sidorna,
// aldrig statiskt från app.js eller en annan kärn-bootfil.
// ============================================================================

import { registerGameMode, getGameMode } from "../game-modes.js";
import MULTIPLICATION_0_10 from "./multiplication-0-10.js";

const BUILTIN_MODES = [MULTIPLICATION_0_10];

for (const m of BUILTIN_MODES) if (!getGameMode(m.id)) registerGameMode(m);

export const DEFAULT_GAME_MODE = MULTIPLICATION_0_10.id;
export { getGameMode, requireGameMode, listGameModes } from "../game-modes.js";
