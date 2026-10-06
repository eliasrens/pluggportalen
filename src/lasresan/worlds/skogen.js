// ============================================================================
// Läsresan – värld 1: Skogen (src/lasresan/worlds/skogen.js)  ·  issue #400
// ----------------------------------------------------------------------------
// HELT config-driven värld (spec §5/§22): all geometri (stegpositioner, start,
// dekorationer) och paletten är DATA här; konsten ritas av worlds/skogen-scen.js
// (ren strängbyggare, DOM-fri) och kopplas in via scene.render. Kartvyn
// (ui-map.js) innehåller INGET världsspecifikt – en ny värld är en ny fil som
// den här + en rad i worlds/index.js (se docs/LASRESAN.md "Så skapar du en ny
// värld").
// ============================================================================

import { DEFAULT_STEPS_PER_WORLD } from "../config.js";
import { skogenScen } from "./skogen-scen.js";

const SCENE = { width: 1600, height: 1000 };

// 20 handplacerade steg längs en slingrande skogsstig: in nere till vänster,
// österut genom gläntorna, över bäcken (bro mellan steg 7 och 8), upp längs
// östra kanten, västerut genom höga skogen och fram till målgläntan upptill.
const STEG = [
  { x: 185, y: 868 }, { x: 330, y: 902 }, { x: 475, y: 862 }, { x: 615, y: 898 },
  { x: 762, y: 868 }, { x: 905, y: 818 }, { x: 1032, y: 748 }, { x: 1180, y: 692 },
  { x: 1318, y: 622 }, { x: 1378, y: 506 }, { x: 1272, y: 408 }, { x: 1122, y: 368 },
  { x: 962, y: 398 }, { x: 812, y: 432 }, { x: 655, y: 400 }, { x: 505, y: 345 },
  { x: 388, y: 262 }, { x: 520, y: 185 }, { x: 692, y: 150 }, { x: 868, y: 128 },
];

export default {
  id: "skogen",
  name: "Skogen",
  theme: "skog",
  order: 1,
  steps: DEFAULT_STEPS_PER_WORLD,
  unlockAfter: null, // första världen – alltid öppen
  scene: {
    ...SCENE,
    background: "#B7DC9A",
    render: skogenScen, // (world) => inline-SVG-sträng för hela bakgrundsscenen
  },
  // Färger som kartvyn får använda för generiska element (stegmarkörer m.m.).
  palette: {
    path: "#D8B98A",
    pathEdge: "#B99463",
    stepDone: "#6FC66F",
    stepNext: "#F7C948",
    stepLocked: "#E9DFC8",
  },
  start: { x: 72, y: 826 },
  stepPositions: STEG,
  // Dekorationslista: ren data {type, x, y, s?, rot?} som skogen-scen.js ritar.
  // Typerna (trad, gran, sten, svamp, stubbe, blomma, tuva, glanta, mal) är
  // världens egna – kartvyn läser aldrig listan själv.
  decorations: [
    // Gläntor (ljusa fläckar i gräset, bakom allt annat)
    { type: "glanta", x: 420, y: 760, s: 1.3 }, { type: "glanta", x: 1060, y: 560, s: 1.1 },
    { type: "glanta", x: 700, y: 280, s: 1.2 }, { type: "glanta", x: 880, y: 120, s: 1.4 },
    { type: "glanta", x: 250, y: 420, s: 1 },
    // Lövträd
    { type: "trad", x: 110, y: 640, s: 1.1 }, { type: "trad", x: 350, y: 700, s: 0.9 },
    { type: "trad", x: 700, y: 740, s: 1 }, { type: "trad", x: 1230, y: 870, s: 1.15 },
    { type: "trad", x: 1460, y: 700, s: 0.95 }, { type: "trad", x: 150, y: 180, s: 1.05 },
    { type: "trad", x: 980, y: 240, s: 0.9 }, { type: "trad", x: 1320, y: 180, s: 1.1 },
    { type: "trad", x: 560, y: 560, s: 0.85 },
    // Granar (mörkare, blandskog)
    { type: "gran", x: 240, y: 560, s: 1 }, { type: "gran", x: 1420, y: 330, s: 1.1 },
    { type: "gran", x: 60, y: 380, s: 0.9 }, { type: "gran", x: 820, y: 600, s: 0.95 },
    { type: "gran", x: 1110, y: 140, s: 1 }, { type: "gran", x: 400, y: 100, s: 0.85 },
    { type: "gran", x: 620, y: 70, s: 0.9 }, { type: "gran", x: 1510, y: 880, s: 1 },
    // Stenar, stubbar, svampar, tuvor, blommor
    { type: "sten", x: 540, y: 770, s: 1 }, { type: "sten", x: 1240, y: 520, s: 0.8 },
    { type: "sten", x: 300, y: 310, s: 0.9 }, { type: "sten", x: 1030, y: 450, s: 0.7 },
    { type: "stubbe", x: 860, y: 700, s: 1 }, { type: "stubbe", x: 460, y: 460, s: 0.9 },
    { type: "svamp", x: 250, y: 820, s: 1 }, { type: "svamp", x: 740, y: 490, s: 0.9 },
    { type: "svamp", x: 1180, y: 300, s: 1 }, { type: "svamp", x: 590, y: 240, s: 0.85 },
    { type: "tuva", x: 660, y: 820, s: 1 }, { type: "tuva", x: 1100, y: 640, s: 0.9 },
    { type: "tuva", x: 350, y: 520, s: 0.9 }, { type: "tuva", x: 900, y: 330, s: 0.85 },
    { type: "blomma", x: 480, y: 690, s: 1 }, { type: "blomma", x: 1340, y: 740, s: 1 },
    { type: "blomma", x: 200, y: 260, s: 1 }, { type: "blomma", x: 780, y: 200, s: 1 },
    // Fjäril/mal som liten detalj
    { type: "mal", x: 1010, y: 200, s: 1 }, { type: "mal", x: 330, y: 640, s: 0.9 },
  ],
  // Världens egna extra-geometri (bäck + broar) – läses bara av skogen-scen.js.
  vatten: {
    backar: [
      // Stora bäcken: uppifrån höger ned mot nederkanten, korsar stigen 7→8.
      [[1480, 40], [1390, 220], [1290, 420], [1195, 600], [1112, 758], [1035, 900], [990, 1000]],
      // Lilla bäcken: från västra kanten ned mot nederkanten, korsar stigen 2→3.
      [[0, 560], [130, 600], [250, 650], [340, 710], [385, 800], [398, 900], [392, 1000]],
    ],
    // Broarna ligger PÅ stigen där den korsar bäckarna (rot = stigens riktning).
    broar: [{ x: 1106, y: 720, rot: -21 }, { x: 396, y: 897, rot: -12 }],
  },
  mal: { x: 868, y: 128 }, // målgläntan (flaggan ritas vid sista steget)
};
