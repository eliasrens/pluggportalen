// ============================================================================
// Läsresan – värld 4: Djungeln (src/lasresan/worlds/djungeln.js)  ·  issue #659
// ----------------------------------------------------------------------------
// HELT config-driven värld, låses upp när Havet är klar (unlockAfter).
// All geometri och dekor är DATA här; konsten ritas av worlds/djungeln-scen.js.
// Se docs/LASRESAN.md "Så skapar du en ny värld".
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { djungelnScen } from "./djungeln-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg: in nere till höger, västerut genom grönskan och över
// floden (hängbro mellan steg 5 och 6), upp längs västra sidan, österut över
// floden igen (hängbro 12→13), upp på höjden i öster och fram till templet.
const STEG = [
  { x: 1400, y: 900 }, { x: 1260, y: 870 }, { x: 1120, y: 905 }, { x: 980, y: 870 },
  { x: 840, y: 900 }, { x: 700, y: 860 }, { x: 575, y: 800 }, { x: 450, y: 740 },
  { x: 330, y: 660 }, { x: 285, y: 545 }, { x: 370, y: 450 }, { x: 510, y: 420 },
  { x: 655, y: 455 }, { x: 800, y: 480 }, { x: 945, y: 455 }, { x: 1085, y: 400 },
  { x: 1210, y: 330 }, { x: 1240, y: 210 }, { x: 1110, y: 140 }, { x: 950, y: 120 },
];

export default {
  id: "djungeln",
  name: "Djungeln",
  theme: "djungel",
  order: 4,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "havet",
  scene: {
    ...SCENE,
    background: "#6DBB64",
    render: djungelnScen,
  },
  palette: {
    path: "#C9A273",
    pathEdge: "#9C7A50",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#E9DFC8",
  },
  start: { x: 1530, y: 880 },
  stepPositions: STEG,
  // Dekorationslista {type, x, y, s?, rot?, l?} – typerna ägs av djungeln-scen.js.
  decorations: [
    // Mörka fläckar i undervegetationen (bakom allt)
    { type: "skugga", x: 1420, y: 620, s: 1.3 }, { type: "skugga", x: 130, y: 330, s: 1.1 },
    { type: "skugga", x: 900, y: 690, s: 1.2 }, { type: "skugga", x: 420, y: 250, s: 1 },
    { type: "skugga", x: 1060, y: 250, s: 0.9 }, { type: "skugga", x: 200, y: 880, s: 1.1 },
    // Djungelträd
    { type: "trad", x: 1430, y: 720, s: 1.1 }, { type: "trad", x: 1300, y: 580, s: 0.9 },
    { type: "trad", x: 1500, y: 470, s: 0.95 }, { type: "trad", x: 120, y: 610, s: 1 },
    { type: "trad", x: 150, y: 400, s: 0.9 }, { type: "trad", x: 960, y: 730, s: 1 },
    { type: "trad", x: 1130, y: 640, s: 0.85 }, { type: "trad", x: 430, y: 330, s: 0.85 },
    { type: "trad", x: 1490, y: 300, s: 0.85 },
    // Stora blad och ormbunkar
    { type: "bladruska", x: 70, y: 1000, s: 1.3 }, { type: "bladruska", x: 290, y: 1005, s: 1.1 },
    { type: "bladruska", x: 1590, y: 1005, s: 0.9 }, { type: "bladruska", x: 820, y: 640, s: 0.9 },
    { type: "bladruska", x: 230, y: 790, s: 0.85 }, { type: "bladruska", x: 1250, y: 760, s: 0.9 },
    { type: "bladruska", x: 1580, y: 640, s: 0.9 }, { type: "bladruska", x: 20, y: 470, s: 1 },
    { type: "ormbunke", x: 470, y: 600, s: 1 }, { type: "ormbunke", x: 1040, y: 560, s: 0.9 },
    { type: "ormbunke", x: 1350, y: 430, s: 0.9 }, { type: "ormbunke", x: 270, y: 330, s: 0.85 },
    { type: "ormbunke", x: 1010, y: 980, s: 1 }, { type: "ormbunke", x: 640, y: 980, s: 0.9 },
    { type: "ormbunke", x: 1180, y: 990, s: 0.85 },
    // Papegojor, fjärilar, blommor
    { type: "papegoja", x: 700, y: 270 }, { type: "papegoja", x: 270, y: 200, s: 0.9 },
    { type: "papegoja", x: 1010, y: 300, s: 0.85 }, { type: "papegoja", x: 620, y: 650, s: 0.85 },
    { type: "fjaril", x: 760, y: 590 }, { type: "fjaril", x: 1360, y: 300, s: 0.9 },
    { type: "fjaril", x: 380, y: 590, s: 0.85 },
    { type: "blomma", x: 520, y: 540 }, { type: "blomma", x: 900, y: 590, s: 0.9 },
    { type: "blomma", x: 1330, y: 800, s: 0.9 }, { type: "blomma", x: 170, y: 730, s: 0.9 },
    { type: "blomma", x: 1100, y: 260, s: 0.85 }, { type: "blomma", x: 840, y: 990, s: 0.85 },
    // Stenar och flodens invånare
    { type: "sten", x: 1290, y: 470, s: 0.9 }, { type: "sten", x: 380, y: 880, s: 0.9 },
    { type: "sten", x: 1040, y: 215, s: 0.8 },
    { type: "groda", x: 634, y: 640 }, { type: "nackros", x: 597, y: 530, s: 0.9 },
    { type: "nackros", x: 742, y: 795, s: 0.8 },
  ],
  // Floden, vattenfallet, broarna, templet, lövtaket och lianerna – läses bara
  // av djungeln-scen.js. Broarna ligger PÅ stigen där den korsar floden.
  flod: [[560, 0], [600, 150], [590, 300], [582, 437], [620, 600], [700, 720], [770, 880], [790, 1000]],
  vattenfall: { x: 600, y: 150 },
  broar: [{ x: 770, y: 880, rot: 16 }, { x: 582, y: 437, rot: 14 }],
  tempel: { x: 790, y: 165 },
  lovtak: [[0, 470], [1180, 1600]],
  lianer: [
    { x: 70, l: 230 }, { x: 190, l: 170 }, { x: 330, l: 250 }, { x: 430, l: 140 },
    { x: 1300, l: 160 }, { x: 1420, l: 240 }, { x: 1540, l: 200 },
  ],
  mal: { x: 950, y: 120 },
};
