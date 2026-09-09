// ============================================================================
// Pluggportalen – äventyrsmotorn: grid.js
// ----------------------------------------------------------------------------
// Tolkar en tema-karta (rader av tecken, en ASCII-grid) till tiles och räknar om
// grid-koordinater till PROCENT av scenen – exakt samma procent-konvention som
// resten av spelvärlden (art-room.js, husdjuren) så motorn kan placera saker med
// left/top i %. Modulen är MEDVETET DOM-fri och Firebase-fri: bara matematik och
// datastrukturer, så koordinat-/kollisionsmatten kan enhetstestas fristående med
// `node --test` (se test/adventure-grid.test.js), precis som rum-promenad-golv.js.
//
// Kart-legend (default, kan skrivas över per tema via theme.legend):
//   '#'  vägg/hinder  – blockerar (ritas som hinder)
//   '.'  golv         – gångbart
//   'S'  start        – golv + spelarens startruta
//   '?'  station      – golv + en frågestation
//   'M'  mål          – golv + platsen där slutmålet dyker upp när banan klaras
//   ' '  tomrum       – utanför banan (blockerar, ritas inte)
// Okända tecken behandlas som tomrum (blockerar, ritas inte).
// ============================================================================

/** Standard-legend: tecken → tiletyp. Teman kan skicka en egen (partiell) legend. */
export const DEFAULT_LEGEND = {
  "#": "wall",
  ".": "floor",
  S: "start",
  "?": "station",
  M: "goal",
  " ": "void",
};

/** Tiletyper som går att gå på (allt annat blockerar). */
const WALKABLE = new Set(["floor", "start", "station", "goal"]);

/**
 * Tolka en karta (array av lika-, eller olika-långa strängar) till ett rutnät.
 * Rader stoppas ut till samma bredd (kortare rader fylls med tomrum) så en
 * lite ojämnt inskriven karta ändå blir ett rektangulärt grid.
 *
 * @param {string[]} map  rader av tecken
 * @param {object} [legend]  tecken→tiletyp (default DEFAULT_LEGEND)
 * @returns {{
 *   cols:number, rows:number,
 *   tiles: Array<{col:number,row:number,type:string,char:string}>,
 *   blocked: Set<string>,          // "col,row" för rutor som INTE går att gå på
 *   start: {col:number,row:number}|null,
 *   stations: Array<{col:number,row:number}>,
 *   goal: {col:number,row:number}|null,
 * }}
 */
export function parseMap(map, legend = DEFAULT_LEGEND) {
  const rowsArr = Array.isArray(map) ? map : [];
  const rows = rowsArr.length;
  const cols = rowsArr.reduce((m, r) => Math.max(m, String(r).length), 0);

  const tiles = [];
  const blocked = new Set();
  const stations = [];
  let start = null;
  let goal = null;

  for (let row = 0; row < rows; row++) {
    const line = String(rowsArr[row] || "");
    for (let col = 0; col < cols; col++) {
      const char = col < line.length ? line[col] : " ";
      const type = legend[char] || "void";
      tiles.push({ col, row, type, char });
      if (!WALKABLE.has(type)) blocked.add(`${col},${row}`);
      if (type === "start") start = { col, row };
      if (type === "station") stations.push({ col, row });
      if (type === "goal") goal = { col, row };
    }
  }
  return { cols, rows, tiles, blocked, start, stations, goal };
}

/**
 * Mittpunkten (i procent av scenen) för en ruta – motorn placerar spelaren och
 * objekt med left/top i %. Rutnätet fyller hela scenen (0–100 % i båda led) så
 * layouten är upplösningsoberoende och funkar responsivt.
 * @returns {{x:number,y:number}} center i procent
 */
export function cellCenter(col, row, cols, rows) {
  return {
    x: cols > 0 ? ((col + 0.5) / cols) * 100 : 50,
    y: rows > 0 ? ((row + 0.5) / rows) * 100 : 50,
  };
}

/** En rutas storlek i procent av scenen (bredd × höjd). */
export function tileSizePct(cols, rows) {
  return { w: cols > 0 ? 100 / cols : 100, h: rows > 0 ? 100 / rows : 100 };
}

/** Vilken ruta (col,row) en procent-koordinat hamnar i (utanför → clampas in). */
export function percentToCell(x, y, cols, rows) {
  const col = clampInt(Math.floor((x / 100) * cols), 0, cols - 1);
  const row = clampInt(Math.floor((y / 100) * rows), 0, rows - 1);
  return { col, row };
}

function clampInt(v, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, v));
}

/**
 * Är rutan som punkten (x,y i procent) hamnar i blockerad? Utanför gridet räknas
 * som blockerat (osynliga väggar runt banan). Bygger en snabb predikatfunktion
 * som movement.js får slå mot i sin hot path (inga DOM-rects, ren mängd-lookup).
 * @param {{cols:number,rows:number,blocked:Set<string>}} grid
 * @returns {(x:number,y:number)=>boolean}
 */
export function makeBlockedAt(grid) {
  const { cols, rows, blocked } = grid;
  return (x, y) => {
    if (x < 0 || y < 0 || x > 100 || y > 100) return true;
    const col = Math.floor((x / 100) * cols);
    const row = Math.floor((y / 100) * rows);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return true;
    return blocked.has(`${col},${row}`);
  };
}
