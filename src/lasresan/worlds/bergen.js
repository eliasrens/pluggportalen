// ============================================================================
// Läsresan – värld 5: Bergen (src/lasresan/worlds/bergen.js)  ·  issue #660
// ----------------------------------------------------------------------------
// HELT config-driven värld, låses upp när Djungeln är klar (unlockAfter).
// All geometri och dekor är DATA här; konsten ritas av worlds/bergen-scen.js.
// Se docs/LASRESAN.md "Så skapar du en ny värld".
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { bergenScen } from "./bergen-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg: en serpentinstig som klättrar uppför berget. In nere
// till vänster, österut över ravinen (hängbro mellan steg 4 och 5), hårnålskurva
// i öster, västerut över ängen, ny kurva i väster, österut igen och sista
// biten upp i snön till toppen (målet ligger till höger om världsknapparna).
const STEG = [
  { x: 230, y: 905 }, { x: 370, y: 880 }, { x: 510, y: 900 }, { x: 640, y: 878 },
  { x: 815, y: 862 }, { x: 955, y: 885 }, { x: 1095, y: 860 }, { x: 1235, y: 880 },
  { x: 1375, y: 820 }, { x: 1410, y: 700 }, { x: 1280, y: 650 }, { x: 1140, y: 625 },
  { x: 1000, y: 648 }, { x: 860, y: 620 }, { x: 735, y: 560 }, { x: 790, y: 450 },
  { x: 925, y: 420 }, { x: 1060, y: 385 }, { x: 1170, y: 315 }, { x: 1255, y: 220 },
];

export default {
  id: "bergen",
  name: "Bergen",
  theme: "berg",
  order: 5,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "djungeln",
  scene: {
    ...SCENE,
    background: "#8FCB72",
    render: bergenScen,
  },
  palette: {
    path: "#D9C29A",
    pathEdge: "#AE9670",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#F1ECE0",
  },
  start: { x: 95, y: 920 },
  stepPositions: STEG,
  // Dekorationslista {type, x, y, s?, flip?} – typerna ägs av bergen-scen.js.
  decorations: [
    // Moln på himlen (bakom bergen)
    { type: "moln", x: 180, y: 120, s: 1 }, { type: "moln", x: 1500, y: 90, s: 0.85 },
    { type: "moln", x: 760, y: 150, s: 0.75 },
    // Granar
    { type: "gran", x: 70, y: 760, s: 1.05 }, { type: "gran", x: 150, y: 700, s: 0.85 },
    { type: "gran", x: 1530, y: 960, s: 1.05 }, { type: "gran", x: 1580, y: 870, s: 0.85 },
    { type: "gran", x: 1050, y: 990, s: 0.9 }, { type: "gran", x: 560, y: 760, s: 0.9 },
    { type: "gran", x: 1520, y: 720, s: 0.95 }, { type: "gran", x: 620, y: 430, s: 0.8 },
    { type: "gran", x: 330, y: 400, s: 0.75 }, { type: "gran", x: 1180, y: 760, s: 0.85 },
    { type: "gran", x: 70, y: 470, s: 0.8 }, { type: "gran", x: 440, y: 990, s: 0.85 },
    // Stugor
    { type: "stuga", x: 300, y: 660, s: 1.05 }, { type: "stuga", x: 520, y: 470, s: 0.85, flip: true },
    { type: "stuga", x: 1460, y: 590, s: 0.9 },
    // Getter
    { type: "get", x: 440, y: 640 }, { type: "get", x: 940, y: 740, s: 0.9, flip: true },
    { type: "get", x: 1300, y: 420, s: 0.85 }, { type: "get", x: 210, y: 520, s: 0.85, flip: true },
    { type: "get", x: 1460, y: 330, s: 0.75, flip: true },
    // Stenar och blommor
    { type: "sten", x: 1340, y: 960, s: 1 }, { type: "sten", x: 160, y: 960, s: 0.85 },
    { type: "sten", x: 1070, y: 520, s: 0.8 }, { type: "sten", x: 700, y: 660, s: 0.8 },
    { type: "sten", x: 1390, y: 250, s: 0.8 },
    { type: "blomma", x: 300, y: 820 }, { type: "blomma", x: 1130, y: 950, s: 0.9 },
    { type: "blomma", x: 470, y: 560, s: 0.9 }, { type: "blomma", x: 1080, y: 720, s: 0.9 },
    { type: "blomma", x: 870, y: 520, s: 0.85 }, { type: "blomma", x: 640, y: 980, s: 0.85 },
    { type: "blomma", x: 1250, y: 540, s: 0.85 }, { type: "blomma", x: 120, y: 600, s: 0.85 },
  ],
  // Bergen, sjön, ravinen, hängbron och toppen – läses bara av bergen-scen.js.
  // Fjärran = bergskedjan på himlen; topp = toppen stigen klättrar upp på.
  fjarran: [
    { x: 120, y: 70, wl: 260, wr: 230 }, { x: 420, y: 130, wl: 230, wr: 220 },
    { x: 700, y: 50, wl: 260, wr: 300 }, { x: 1000, y: 110, wl: 220, wr: 220 },
    { x: 1520, y: 120, wl: 220, wr: 220 },
  ],
  topp: { x: 1265, y: 150, wl: 360, wr: 440, bas: 520 },
  sjo: { x: 210, y: 400, rx: 150, ry: 50 },
  ravin: { x: 728, topp: 740 },
  bro: { x: 728, y: 870, rot: -5 },
  mal: { x: 1255, y: 220 },
};
