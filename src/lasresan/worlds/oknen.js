// ============================================================================
// Läsresan – värld 2: Öknen (src/lasresan/worlds/oknen.js)
// ----------------------------------------------------------------------------
// PLACEHOLDER-config (issue #399). Låses upp när Skogen är klar. Kartvyn
// (issue #400) ritar scenen och handplacerar stegpositioner/dekorationer.
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { serpentinePositions } from "./layout.js";

const SCENE = { width: 1600, height: 1000 };

export default {
  id: "oknen",
  name: "Öknen",
  theme: "okn",
  order: 2,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "skogen",
  scene: { ...SCENE, background: "#f3dfa6", render: null },
  start: { x: 60, y: SCENE.height - 140 },
  stepPositions: serpentinePositions(DEFAULT_STEPS_PER_WORLD, SCENE),
  decorations: [],
};
