// ============================================================================
// Läsresan – värld 7: Månen (src/lasresan/worlds/manen.js)  ·  issue #660
// ----------------------------------------------------------------------------
// Resans FINAL. HELT config-driven värld, låses upp när Vulkanlandet är klar.
// All geometri och dekor är DATA här; konsten ritas av worlds/manen-scen.js.
// Efter Månen finns ingen nästa värld: eleven står kvar vid flaggan och kartan
// visar en lugn "resan klar"-ruta med en knapp för att läsa vidare (ui-map.js).
// Se docs/LASRESAN.md "Så skapar du en ny värld".
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { manenScen } from "./manen-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg: från raketen nere till vänster, österut förbi den
// stora kratern, en sväng i öster, västerut förbi månbilen och upp på kullen
// till flaggan vid månbasen (jorden syns på himlen till höger).
const STEG = [
  { x: 330, y: 900 }, { x: 470, y: 920 }, { x: 610, y: 890 }, { x: 750, y: 905 },
  { x: 890, y: 880 }, { x: 1030, y: 900 }, { x: 1170, y: 875 }, { x: 1310, y: 895 },
  { x: 1435, y: 835 }, { x: 1470, y: 715 }, { x: 1360, y: 640 }, { x: 1220, y: 625 },
  { x: 1080, y: 645 }, { x: 940, y: 610 }, { x: 800, y: 640 }, { x: 660, y: 610 },
  { x: 545, y: 535 }, { x: 590, y: 425 }, { x: 720, y: 370 }, { x: 860, y: 335 },
];

export default {
  id: "manen",
  name: "Månen",
  theme: "mane",
  order: 7,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "vulkanlandet",
  scene: {
    ...SCENE,
    background: "#26305A",
    render: manenScen,
  },
  palette: {
    path: "#E6E3F0",
    pathEdge: "#A9A5BE",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#F4F1FA",
  },
  start: { x: 200, y: 915 },
  stepPositions: STEG,
  // Dekorationslista {type, x, y, s?, flip?} – typerna ägs av manen-scen.js.
  decorations: [
    // Kratrar (platta, bakom allt annat på marken)
    { type: "krater", x: 640, y: 760, s: 1.5 }, { type: "krater", x: 1180, y: 760, s: 1.1 },
    { type: "krater", x: 250, y: 600, s: 1.3 }, { type: "krater", x: 1120, y: 470, s: 0.9 },
    { type: "krater", x: 1480, y: 960, s: 0.9 }, { type: "krater", x: 880, y: 990, s: 0.8 },
    { type: "krater", x: 390, y: 420, s: 0.7 }, { type: "krater", x: 1420, y: 500, s: 0.8 },
    { type: "krater", x: 870, y: 510, s: 0.6 }, { type: "krater", x: 60, y: 450, s: 0.7 },
    // Månstenar
    { type: "mansten", x: 420, y: 990, s: 1 }, { type: "mansten", x: 1100, y: 990, s: 0.9 },
    { type: "mansten", x: 1560, y: 760, s: 1 }, { type: "mansten", x: 980, y: 770, s: 0.8 },
    { type: "mansten", x: 420, y: 700, s: 0.85 }, { type: "mansten", x: 1290, y: 520, s: 0.8 },
    { type: "mansten", x: 120, y: 700, s: 0.9 }, { type: "mansten", x: 760, y: 520, s: 0.7 },
    // Fotspår, raketen, månbilen och en satellit
    { type: "fotspar", x: 1500, y: 610, s: 1 }, { type: "fotspar", x: 360, y: 790, s: 0.9 },
    { type: "raket", x: 85, y: 880, s: 1.05 },
    { type: "manbil", x: 1270, y: 560, s: 1 },
    { type: "satellit", x: 1180, y: 110, s: 0.9 },
  ],
  // Horisonten, jorden, månbasen och stjärnhimlen – läses bara av manen-scen.js.
  horisont: [[0, 360], [300, 330], [560, 300], [800, 268], [1050, 285], [1300, 345], [1600, 370]],
  jorden: { x: 1430, y: 170, r: 78 },
  bas: { x: 1015, y: 300 },
  stjarnor: 90,
  mal: { x: 860, y: 335 },
};
