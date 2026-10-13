// ============================================================================
// Läsresan – värld 3: Havet (src/lasresan/worlds/havet.js)  ·  issue #659
// ----------------------------------------------------------------------------
// HELT config-driven värld, låses upp när Öknen är klar (unlockAfter).
// All geometri och dekor är DATA här; konsten ritas av worlds/havet-scen.js.
// Se docs/LASRESAN.md "Så skapar du en ny värld".
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { havetScen } from "./havet-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg: stranden nere till vänster, ut på bryggan, över
// fyra öar (bryggor mellan dem) och fram till fyrön uppe till vänster.
// Steg 1–4 strand, 5–6 brygga, 7–8 ö A, 9 brygga, 10–11 ö B, 12 brygga,
// 13–15 ö C, 16–17 brygga, 18–20 fyrön.
const STEG = [
  { x: 200, y: 905 }, { x: 340, y: 880 }, { x: 480, y: 905 }, { x: 620, y: 870 },
  { x: 760, y: 830 }, { x: 895, y: 790 }, { x: 1030, y: 760 }, { x: 1165, y: 720 },
  { x: 1290, y: 640 }, { x: 1395, y: 540 }, { x: 1330, y: 420 }, { x: 1190, y: 380 },
  { x: 1015, y: 405 }, { x: 880, y: 440 }, { x: 745, y: 410 }, { x: 610, y: 360 },
  { x: 480, y: 300 }, { x: 345, y: 245 }, { x: 250, y: 160 }, { x: 390, y: 120 },
];

export default {
  id: "havet",
  name: "Havet",
  theme: "hav",
  order: 3,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: "oknen",
  scene: {
    ...SCENE,
    background: "#6CC3E6",
    render: havetScen,
  },
  palette: {
    path: "#C79A6B",
    pathEdge: "#8A6242",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#E6F4F8",
  },
  start: { x: 70, y: 880 },
  stepPositions: STEG,
  // Dekorationslista {type, x, y, s?, flip?} – typerna ägs av havet-scen.js.
  decorations: [
    // Vågor (små bågar i vattnet, bakom allt)
    { type: "vag", x: 560, y: 560 }, { type: "vag", x: 1060, y: 590 }, { type: "vag", x: 1500, y: 640 },
    { type: "vag", x: 330, y: 470, s: 0.9 }, { type: "vag", x: 1230, y: 860 }, { type: "vag", x: 960, y: 960, s: 0.9 },
    { type: "vag", x: 700, y: 120, s: 0.9 }, { type: "vag", x: 1420, y: 240 }, { type: "vag", x: 1050, y: 160, s: 0.8 },
    { type: "vag", x: 120, y: 640, s: 0.8 }, { type: "vag", x: 650, y: 710, s: 0.8 }, { type: "vag", x: 1540, y: 420, s: 0.8 },
    // Korallrev och sjögräs (i grunt vatten)
    { type: "korall", x: 1450, y: 945, s: 1.1 }, { type: "korall", x: 1110, y: 955, s: 0.9 },
    { type: "korall", x: 300, y: 590, s: 1 }, { type: "korall", x: 1520, y: 760, s: 0.9 },
    { type: "korall", x: 660, y: 250, s: 0.85 }, { type: "korall", x: 1180, y: 590, s: 0.8 },
    { type: "sjogras", x: 150, y: 560 }, { type: "sjogras", x: 1360, y: 960, s: 0.9 },
    { type: "sjogras", x: 560, y: 180, s: 0.9 }, { type: "sjogras", x: 950, y: 580, s: 0.85 },
    // Fiskar
    { type: "fisk", x: 520, y: 680 }, { type: "fisk", x: 1180, y: 520, s: 0.9, flip: true },
    { type: "fisk", x: 240, y: 420, s: 0.9 }, { type: "fisk", x: 720, y: 560, s: 0.85, flip: true },
    { type: "fisk", x: 1500, y: 330, s: 0.9, flip: true }, { type: "fisk", x: 1000, y: 250, s: 0.85 },
    { type: "fisk", x: 1010, y: 880, s: 0.9 }, { type: "fisk", x: 1380, y: 800, s: 0.8, flip: true },
    // Båtar, bojar, stenar och måsar
    { type: "roddbat", x: 850, y: 905 }, { type: "segelbat", x: 1270, y: 880, s: 1.05 },
    { type: "segelbat", x: 560, y: 470, s: 0.85 }, { type: "boj", x: 1010, y: 610 },
    { type: "boj", x: 640, y: 760, s: 0.9 }, { type: "boj", x: 1460, y: 120, s: 0.9 },
    { type: "havssten", x: 1520, y: 170 }, { type: "havssten", x: 1300, y: 250, s: 0.8 },
    { type: "havssten", x: 760, y: 220, s: 0.75 },
    { type: "mas", x: 720, y: 80 }, { type: "mas", x: 1120, y: 110, s: 0.85 }, { type: "mas", x: 560, y: 590, s: 0.8 },
    // Stranden
    { type: "palm", x: 50, y: 770, s: 1.05 }, { type: "parasoll", x: 150, y: 800 },
    { type: "sandslott", x: 560, y: 975, s: 0.85 }, { type: "sjostjarna", x: 310, y: 975 },
    { type: "snacka", x: 120, y: 975, s: 0.9 }, { type: "krabba", x: 690, y: 950 },
    { type: "sjostjarna", x: 420, y: 838, s: 0.75 },
    // Öarna
    { type: "palm", x: 1150, y: 805, s: 0.9 }, { type: "palm", x: 1470, y: 480, s: 0.9 },
    { type: "palm", x: 960, y: 355, s: 0.85 }, { type: "palm", x: 790, y: 495, s: 0.8 },
    { type: "palm", x: 230, y: 285, s: 0.85 }, { type: "sjostjarna", x: 1440, y: 560, s: 0.7 },
    { type: "snacka", x: 960, y: 795, s: 0.75 },
  ],
  // Strand + öar – läses bara av havet-scen.js. Stigen ritas som sandstig på
  // land och som brygga över vattnet (scenen klipper mot de här formerna).
  strand: [[0, 700], [200, 760], [420, 800], [620, 815], [720, 860], [790, 930], [820, 1000]],
  oar: [
    { x: 1080, y: 745, rx: 150, ry: 85 },
    { x: 1385, y: 490, rx: 130, ry: 110 },
    { x: 880, y: 425, rx: 175, ry: 95 },
    { x: 300, y: 185, rx: 210, ry: 125 },
  ],
  fyr: { x: 165, y: 248 },
  mal: { x: 390, y: 120 },
};
