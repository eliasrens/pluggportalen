// ============================================================================
// Läsresan – värld 1: Skogen (src/lasresan/worlds/skogen.js)
// ----------------------------------------------------------------------------
// PLACEHOLDER-config (issue #399). Kartvyn (issue #400) ritar scenen och
// handplacerar stegpositioner/dekorationer; schemat beskrivs i worlds/index.js
// och docs/LASRESAN.md. Ren data – ingen DOM, ingen konst importeras här.
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { serpentinePositions } from "./layout.js";

const SCENE = { width: 1600, height: 1000 };

export default {
  id: "skogen",
  name: "Skogen",
  theme: "skog",
  order: 1,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: null, // första världen – alltid öppen
  // Scen-beskrivning för kartvyn. `render` fylls av issue #400 (lat laddad
  // SVG-scen, samma stil som Skattjaktens skattjakten-scen-svg.js).
  scene: { ...SCENE, background: "#cfe8b8", render: null },
  start: { x: 60, y: SCENE.height - 140 },
  stepPositions: serpentinePositions(DEFAULT_STEPS_PER_WORLD, SCENE),
  decorations: [],
};
