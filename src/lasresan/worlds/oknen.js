// ============================================================================
// Läsresan – värld 2: Öknen (src/lasresan/worlds/oknen.js)  ·  issue #400
// ----------------------------------------------------------------------------
// HELT config-driven värld, låses upp när Skogen är klar (unlockAfter).
// All geometri och dekor är DATA här; konsten ritas av worlds/oknen-scen.js.
// Se docs/LASRESAN.md "Så skapar du en ny värld".
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { oknenScen } from "./oknen-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg: karavanen kommer in nere till höger, vandrar västerut
// genom dynerna, upp längs klipporna i väster, österut över högplatån och
// fram till oasen uppe till höger om mitten.
const STEG = [
  { x: 1392, y: 878 }, { x: 1245, y: 902 }, { x: 1098, y: 868 }, { x: 955, y: 905 },
  { x: 808, y: 872 }, { x: 665, y: 825 }, { x: 540, y: 748 }, { x: 422, y: 655 },
  { x: 332, y: 545 }, { x: 302, y: 425 }, { x: 390, y: 330 }, { x: 540, y: 298 },
  { x: 695, y: 328 }, { x: 845, y: 368 }, { x: 1000, y: 390 }, { x: 1150, y: 358 },
  { x: 1292, y: 298 }, { x: 1378, y: 202 }, { x: 1258, y: 122 }, { x: 1092, y: 98 },
];

export default {
  id: "oknen",
  name: "Öknen",
  theme: "okn",
  order: 2,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "skogen",
  scene: {
    ...SCENE,
    background: "#F0DCA8",
    render: oknenScen,
  },
  palette: {
    path: "#E8C684",
    pathEdge: "#C9A05C",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#F2E6C4",
  },
  start: { x: 1528, y: 846 },
  stepPositions: STEG,
  // Dekorationslista {type, x, y, s?} – typerna ägs av oknen-scen.js.
  decorations: [
    // Sanddyner (mjuka vågor i sanden, bakom allt)
    { type: "dyn", x: 400, y: 840, s: 1.3 }, { type: "dyn", x: 1100, y: 740, s: 1.1 },
    { type: "dyn", x: 750, y: 560, s: 1.2 }, { type: "dyn", x: 300, y: 240, s: 1 },
    { type: "dyn", x: 1350, y: 520, s: 1.2 }, { type: "dyn", x: 900, y: 200, s: 1 },
    { type: "dyn", x: 150, y: 700, s: 0.9 },
    // Kaktusar
    { type: "kaktus", x: 180, y: 880, s: 1.1 }, { type: "kaktus", x: 620, y: 650, s: 0.9 },
    { type: "kaktus", x: 1210, y: 790, s: 1 }, { type: "kaktus", x: 250, y: 330, s: 1 },
    { type: "kaktus", x: 760, y: 240, s: 0.85 }, { type: "kaktus", x: 1460, y: 420, s: 1.05 },
    { type: "kaktus", x: 905, y: 480, s: 0.8 }, { type: "kaktus", x: 90, y: 480, s: 0.9 },
    // Klippor (röda sandstensklippor)
    { type: "klippa", x: 150, y: 150, s: 1.2 }, { type: "klippa", x: 560, y: 120, s: 1 },
    { type: "klippa", x: 1480, y: 180, s: 0.9 }, { type: "klippa", x: 460, y: 480, s: 0.85 },
    { type: "klippa", x: 1380, y: 700, s: 0.9 }, { type: "klippa", x: 60, y: 300, s: 0.8 },
    // Små ruiner
    { type: "ruin", x: 680, y: 120, s: 1 }, { type: "ruin", x: 1020, y: 620, s: 0.9 },
    { type: "ruin", x: 220, y: 580, s: 0.85 },
    // Palmer (utanför oasen, enstaka)
    { type: "palm", x: 870, y: 100, s: 0.9 }, { type: "palm", x: 1320, y: 420, s: 0.85 },
    // Små detaljer: stenar, benknotor, buskar
    { type: "oksten", x: 520, y: 880, s: 0.9 }, { type: "oksten", x: 1040, y: 300, s: 0.8 },
    { type: "oksten", x: 350, y: 720, s: 0.7 }, { type: "oksten", x: 1180, y: 480, s: 0.8 },
    { type: "benknota", x: 820, y: 700, s: 1 }, { type: "benknota", x: 480, y: 220, s: 0.9 },
    { type: "okenbuske", x: 940, y: 790, s: 1 }, { type: "okenbuske", x: 640, y: 410, s: 0.9 },
    { type: "okenbuske", x: 1430, y: 290, s: 0.9 }, { type: "okenbuske", x: 170, y: 420, s: 0.85 },
  ],
  // Oasen vid målet – läses bara av oknen-scen.js (ritas bakom flaggan).
  oas: { x: 985, y: 135 },
  mal: { x: 1092, y: 98 },
};
