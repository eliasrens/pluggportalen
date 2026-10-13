// ============================================================================
// Läsresan – värld 6: Vulkanlandet (src/lasresan/worlds/vulkanlandet.js) · #660
// ----------------------------------------------------------------------------
// HELT config-driven värld, låses upp när Bergen är klar (unlockAfter).
// All geometri och dekor är DATA här; konsten ritas av worlds/vulkanlandet-scen.js.
// Se docs/LASRESAN.md "Så skapar du en ny värld".
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { vulkanlandetScen } from "./vulkanlandet-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg: in nere till höger, västerut över lavafloden
// (stenbro mellan steg 6 och 7), en slinga runt lavapölen i väster, österut
// över floden igen (stenbro 13→14) och uppför vulkanens högra sida till
// utsiktsplatsen (målet ligger till höger om världsknapparna).
const STEG = [
  { x: 1395, y: 895 }, { x: 1255, y: 915 }, { x: 1115, y: 885 }, { x: 975, y: 905 },
  { x: 835, y: 880 }, { x: 715, y: 860 }, { x: 545, y: 880 }, { x: 410, y: 860 },
  { x: 285, y: 800 }, { x: 225, y: 690 }, { x: 305, y: 590 }, { x: 440, y: 550 },
  { x: 650, y: 570 }, { x: 900, y: 548 }, { x: 1025, y: 495 }, { x: 1160, y: 480 },
  { x: 1300, y: 500 }, { x: 1420, y: 440 }, { x: 1400, y: 335 }, { x: 1320, y: 240 },
];

export default {
  id: "vulkanlandet",
  name: "Vulkanlandet",
  theme: "vulkan",
  order: 6,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "bergen",
  scene: {
    ...SCENE,
    background: "#7E6560",
    render: vulkanlandetScen,
  },
  palette: {
    path: "#E2BC8C",
    pathEdge: "#A9805B",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#F3E3D3",
  },
  start: { x: 1530, y: 915 },
  stepPositions: STEG,
  // Dekorationslista {type, x, y, s?, flip?} – typerna ägs av vulkanlandet-scen.js.
  decorations: [
    // Mörka klippor
    { type: "klippa", x: 90, y: 560, s: 1.2 }, { type: "klippa", x: 1560, y: 690, s: 1.1 },
    { type: "klippa", x: 760, y: 990, s: 1 }, { type: "klippa", x: 520, y: 400, s: 0.95 },
    { type: "klippa", x: 1100, y: 640, s: 0.9 }, { type: "klippa", x: 60, y: 900, s: 1.1 },
    { type: "klippa", x: 1460, y: 590, s: 0.8 }, { type: "klippa", x: 820, y: 380, s: 0.8 },
    // Ångande hål i marken
    { type: "anga", x: 160, y: 380 }, { type: "anga", x: 1000, y: 760, s: 0.9 },
    { type: "anga", x: 600, y: 700, s: 0.85 }, { type: "anga", x: 1560, y: 470, s: 0.8 },
    // Varma källor och lavapölar
    { type: "kalla", x: 1250, y: 700 }, { type: "kalla", x: 330, y: 430, s: 0.85 },
    // Kristaller, blommor och ödlor
    { type: "kristall", x: 120, y: 760 }, { type: "kristall", x: 880, y: 680, s: 0.9 },
    { type: "kristall", x: 1480, y: 790, s: 0.85 }, { type: "kristall", x: 680, y: 430, s: 0.8 },
    { type: "blomma", x: 470, y: 980 }, { type: "blomma", x: 1180, y: 990, s: 0.9 },
    { type: "blomma", x: 360, y: 670, s: 0.9 }, { type: "blomma", x: 1380, y: 640, s: 0.85 },
    { type: "blomma", x: 1440, y: 990, s: 0.8 }, { type: "blomma", x: 560, y: 650, s: 0.85 },
    { type: "odla", x: 1170, y: 790 }, { type: "odla", x: 530, y: 770, s: 0.9, flip: true },
    { type: "odla", x: 240, y: 990, s: 0.85, flip: true },
    { type: "sten", x: 1300, y: 990, s: 0.9 }, { type: "sten", x: 940, y: 980, s: 0.8 },
    { type: "sten", x: 140, y: 660, s: 0.8 }, { type: "sten", x: 760, y: 470, s: 0.75 },
  ],
  // Bergen bakom, vulkanen, lavafloden, lavapölen och broarna – läses bara av
  // vulkanlandet-scen.js. Broarna ligger PÅ stigen där den korsar floden.
  fjarran: [[0, 300], [150, 210], [330, 260], [520, 190], [700, 250], [860, 230], [960, 290]],
  vulkan: { x: 1200, y: 150, krater: 85, bas: 420, wl: 420, wr: 420 },
  // Lavan rinner som en smal strimma nerför flanken och blir en flod vid foten.
  lavastrimma: [[1150, 160], [1110, 250], [1050, 330], [990, 395]],
  lava: [[990, 395], [885, 465], [775, 560], [700, 700], [640, 850], [600, 1010]],
  lavapol: { x: 400, y: 715, rx: 70, ry: 34 },
  broar: [{ x: 637, y: 866, rot: -6 }, { x: 778, y: 558, rot: -4 }],
  mal: { x: 1320, y: 240 },
};
