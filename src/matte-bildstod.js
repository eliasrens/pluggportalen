// ============================================================================
// Pluggporten – Bildstöds-renderingsmodul för mattegeneratorn (issue #319)
// ----------------------------------------------------------------------------
// Gör VISUELLT bildstöd (array-/gruppmodell) av ett problem-objekt från
// mattegeneratorn. Klassrummattes original hette buildBildstod men var rå DOM
// och portades aldrig; det här är den rena, testbara efterföljaren.
//
// REN & IMPORT-FRI: filen har MEDVETET inga importer. Den drar därför aldrig in
// firebase-/CDN-/data.js-kedjan och kan enhetstestas direkt mot en minimal
// fejk-DOM (ingen jsdom i projektet). Den bygger ett litet virtuellt SVG-träd
// EN gång och serialiserar det antingen till ett riktigt SVGElement (mot en
// injicerbar `document`) eller till markup-sträng – samma struktur båda vägar,
// deterministiskt ur rows/cols.
//
// BOOT-SÄKERHET (jfr #271/#290): modulen får BARA nås dynamiskt i följd-issues
// (2/3). Den ska ALDRIG statiskt importeras från en bootnådd fil – annars
// hamnar den i den statiska bootgrafen från src/app.js. Håll den beroendefri
// uppåt och importera den bara via `await import(...)` i räkna-/generator-vägen.
//
// DATAKONTRAKT: generatorn (src/matte-generator/plugins.js) sätter redan på
// problem-objekten: `type` ('multiplikation'|'division'|…), `bildstodEligible`
// (bool), `rows`, `cols`, `a`, `b`, `answer`, `operator`. Vi läser dem – vi
// ÄNDRAR ingen matematik här (det är issue 2/3).
// ============================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

// Layout-konstanter (SVG-användarenheter; kortet skalar via width="100%").
const CELL = 26;   // avstånd mellan prick-centrum
const DOT_R = 8;   // prickradie
const PAD = 16;    // ram runt rutnätet
const GROUP_INSET = 5; // hur långt gruppramen (division) sticker ut runt en rad

// Gränser som håller bildstödet LITET och skalbart. Verkliga behöriga fall
// ligger långt under (bild-mult ≤ 7×7, division kräver dividend ≤ 50), men vi
// vägrar rita orimligt stora rutnät hellre än att spränga kortet.
const MAX_DIM = 12;
const MAX_DOTS = 120;

// ---------------------------------------------------------------------------
//  Behörighet
// ---------------------------------------------------------------------------
// Rita bildstöd BARA för de numeriska array/rutnäts-fallen (multiplikation &
// division) med giltiga, små rows/cols. `bildstodEligible === false` vetar
// alltid (generatorn markerar t.ex. tiopotens-division så). Notera att
// bild-mult saknar fältet (undefined) – det är MED flit ett bildläge, så
// "inte uttryckligen false" är rätt regel, inte "måste vara true".
export function isBildstodEligible(problem) {
  if (!problem || problem.bildstodEligible === false) return false;
  if (problem.type !== "multiplikation" && problem.type !== "division") return false;
  const rows = posInt(problem.rows);
  const cols = posInt(problem.cols);
  if (!rows || !cols) return false;
  if (rows > MAX_DIM || cols > MAX_DIM) return false;
  if (rows * cols > MAX_DOTS) return false;
  return true;
}

// ---------------------------------------------------------------------------
//  Publikt API
// ---------------------------------------------------------------------------
// renderBildstod(problem, opts?) → SVGElement | string | null
//   • Returnerar null när problemet inte är behörigt (rendera inget).
//   • opts.document satt  → bygger och returnerar ett riktigt <svg>-element mot
//     den injicerbara documenten (testbart mot fejk-DOM).
//   • annars               → returnerar SVG-markup som sträng.
//   • opts.dotColor / opts.groupColor → valfri färg-override (annars klass +
//     inbyggd fallback-fill så det syns även utan CSS).
export function renderBildstod(problem, opts = {}) {
  if (!isBildstodEligible(problem)) return null;
  const tree = buildTree(problem, opts);
  if (opts.document) return toDom(opts.document, tree);
  return toMarkup(tree);
}

// ---------------------------------------------------------------------------
//  Trädbygge (array-/gruppmodell)
// ---------------------------------------------------------------------------
function buildTree(problem, opts) {
  const rows = posInt(problem.rows);
  const cols = posInt(problem.cols);
  const grouped = problem.type === "division"; // gruppera radvis (a delat i rows grupper)
  const dotColor = opts.dotColor || "#4c6ef5";
  const groupColor = opts.groupColor || "#c7d2fe";

  const width = PAD * 2 + cols * CELL;
  const height = PAD * 2 + rows * CELL;

  const children = [];

  // Gruppramar för division: en mjuk ruta bakom varje rad så "rows grupper om
  // cols" blir avläsbart. Läggs FÖRST (bakom prickarna).
  if (grouped) {
    for (let r = 0; r < rows; r++) {
      children.push(el("rect", {
        class: "bildstod-group",
        x: PAD - GROUP_INSET,
        y: PAD + r * CELL + (CELL - (DOT_R * 2 + GROUP_INSET * 2)) / 2,
        width: cols * CELL + GROUP_INSET * 2,
        height: DOT_R * 2 + GROUP_INSET * 2,
        rx: DOT_R + GROUP_INSET,
        fill: "none",
        stroke: groupColor,
        "stroke-width": 2,
      }));
    }
  }

  // Prickar: rows × cols, jämnt utlagda.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      children.push(el("circle", {
        class: "bildstod-dot",
        cx: PAD + c * CELL + CELL / 2,
        cy: PAD + r * CELL + CELL / 2,
        r: DOT_R,
        fill: dotColor,
      }));
    }
  }

  return el("svg", {
    xmlns: SVG_NS,
    class: "bildstod",
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    role: "img",
    "aria-label": ariaLabel(problem, rows, cols, grouped),
    "data-rows": rows,
    "data-cols": cols,
  }, children);
}

function ariaLabel(problem, rows, cols, grouped) {
  if (grouped) {
    return `Bildstöd: ${problem.a} uppdelat i ${rows} lika grupper med ${cols} i varje`;
  }
  return `Bildstöd: ${rows} rader med ${cols} prickar, totalt ${rows * cols}`;
}

// ---------------------------------------------------------------------------
//  Virtuellt element + serialiserare (en källa, två utgångar)
// ---------------------------------------------------------------------------
function el(tag, attrs, children) {
  return { tag, attrs: attrs || {}, children: children || [] };
}

function toDom(document, node) {
  const node2 = document.createElementNS(SVG_NS, node.tag);
  for (const k in node.attrs) node2.setAttribute(k, String(node.attrs[k]));
  for (const child of node.children) node2.appendChild(toDom(document, child));
  return node2;
}

function toMarkup(node) {
  const attrs = Object.keys(node.attrs)
    .map((k) => ` ${k}="${escAttr(node.attrs[k])}"`)
    .join("");
  if (!node.children.length) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${node.children.map(toMarkup).join("")}</${node.tag}>`;
}

// ---------------------------------------------------------------------------
//  Småhjälpare
// ---------------------------------------------------------------------------
function posInt(v) {
  return Number.isInteger(v) && v > 0 ? v : 0;
}

function escAttr(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
