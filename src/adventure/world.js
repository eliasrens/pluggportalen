// ============================================================================
// Pluggportalen – äventyrsmotorn: world.js  (issue #220)
// ----------------------------------------------------------------------------
// OPT-IN "bild-karta"-värld: modellen bakom scroll-läget. DOM-fri och Firebase-fri
// → enhetstestbar (test/adventure-world.test.js), precis som grid.js. Där grid.js
// tolkar en liten ASCII-ruta till PROCENT-koordinater bygger den här modulen en
// STOR värld i PIXEL-koordinater ovanpå en rasterbild (theme.mapImage): var
// spelaren startar, var stationerna/målet står och ett GROVT kollisionslager –
// allt i världskoordinater så movement.js kan jobba oförändrat i den nya rymden.
//
// Temat anger positioner NORMALISERAT (0..1 av världen) så en bana är oberoende
// av bildens exakta pixelmått. Kollisionen är MEDVETET grov (inte pixelperfekt):
//   • collision.grid  – ett lågupplöst ASCII-rutnät som sträcks över hela världen
//   • collision.rects – normaliserade rektanglar {x,y,w,h} (0..1)
//   • collision.blockedAt(x,y) – en egen predikatfunktion i världskoordinater
// Utanför bildkanten räknas alltid som blockerat (osynliga väggar runt kartan).
// ============================================================================

const DEFAULT_WORLD = { w: 1600, h: 1200 };
const DEFAULT_BLOCK_CHARS = new Set(["#", "1", "x", "X"]);

function num(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

/** Normalisera worldSize (kräver positiva mått, annars default). */
function resolveSize(worldSize) {
  const w = num(worldSize && worldSize.w, DEFAULT_WORLD.w);
  const h = num(worldSize && worldSize.h, DEFAULT_WORLD.h);
  return { w: w > 0 ? w : DEFAULT_WORLD.w, h: h > 0 ? h : DEFAULT_WORLD.h };
}

/**
 * Bygg ett blocked-predikat i VÄRLDSKOORDINATER (pixlar) ur temats kollisionslager.
 * Stödjer (kan kombineras): egen blockedAt(x,y), normaliserade rects och ett
 * ASCII-grid som sträcks över hela världen. Utanför världen = blockerat.
 * @returns {(x:number,y:number)=>boolean}
 */
export function buildCollision(collision, size) {
  const rects = Array.isArray(collision && collision.rects) ? collision.rects : [];
  const gridRows = Array.isArray(collision && collision.grid) ? collision.grid.map(String) : null;
  const gRows = gridRows ? gridRows.length : 0;
  const gCols = gridRows ? gridRows.reduce((m, r) => Math.max(m, r.length), 0) : 0;
  const blockChars = collision && collision.blockChars ? new Set(collision.blockChars) : DEFAULT_BLOCK_CHARS;
  const custom = collision && typeof collision.blockedAt === "function" ? collision.blockedAt : null;

  return (x, y) => {
    if (x < 0 || y < 0 || x > size.w || y > size.h) return true; // utanför bilden
    if (custom && custom(x, y)) return true;
    // Normaliserade rektanglar (0..1 av världen).
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const rx = r.x * size.w, ry = r.y * size.h, rw = r.w * size.w, rh = r.h * size.h;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return true;
    }
    // Lågupplöst ASCII-grid utsträckt över hela världen.
    if (gRows > 0 && gCols > 0) {
      const col = Math.floor((x / size.w) * gCols);
      const row = Math.floor((y / size.h) * gRows);
      const line = gridRows[Math.min(row, gRows - 1)] || "";
      const ch = col < line.length ? line[col] : " ";
      if (blockChars.has(ch)) return true;
    }
    return false;
  };
}

/** Euklidiskt avstånd i världspixlar – isotropt (pixlar är kvadratiska), så en
 *  interaktions-radie når lika långt åt alla håll (uppfyller #218 av sig självt). */
function euclid(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Bygg en bild-karta-värld (space) ur ett scroll-tema. Returnerar samma "space"-
 * gränssnitt som grid-läget (size/start/stations/goal/blockedAt/reach/…) fast i
 * PIXEL-koordinater, plus render-hintarna scroll-scenen behöver (mapImage,
 * viewFraction, avatarSize). Ren data – ingen DOM.
 *
 * Temafält som läses (alla positioner normaliserade 0..1 av världen):
 *   mapImage     string   – bakgrundsbildens URL/data-URI (obligatorisk för läget)
 *   worldSize    {w,h}    – världens pixelmått (default 1600×1200)
 *   startAt      {x,y}    – spelarens start (default mitten)
 *   stationsAt   [{x,y}]  – stationernas positioner (styr även antalet)
 *   goalAt       {x,y}    – slutmålets position (default = startAt)
 *   collision    {...}    – grovt kollisionslager (se buildCollision)
 *   viewFraction number   – ~andel av kartan som syns (default 1/6)
 *   avatarFrac   number   – avatarens storlek som andel av min(världsmått)
 *   speedFrac    number   – gångfart som andel av min(världsmått)/sekund
 *   interactFrac number   – interaktionsradie som andel av min(världsmått)
 */
export function createImageWorld(theme) {
  const size = resolveSize(theme.worldSize);
  const minDim = Math.min(size.w, size.h);
  const toWorld = (p, dflt) => ({
    x: num(p && p.x, dflt.x) * size.w,
    y: num(p && p.y, dflt.y) * size.h,
  });

  const start = toWorld(theme.startAt, { x: 0.5, y: 0.5 });
  const stations = (Array.isArray(theme.stationsAt) ? theme.stationsAt : []).map((p) =>
    toWorld(p, { x: 0.5, y: 0.5 })
  );
  const goal = toWorld(theme.goalAt || theme.startAt, { x: 0.5, y: 0.5 });

  const blockedAt = buildCollision(theme.collision, size);
  const avatarSize = num(theme.avatarFrac, 0.07) * minDim;
  const interactRadius = num(theme.interactFrac, 0.06) * minDim;
  const speed = num(theme.speedFrac, 0.14) * minDim;
  const margin = avatarSize * 0.4;

  return {
    scroll: true,
    size,
    maxX: size.w,
    maxY: size.h,
    start,
    stations,
    goal,
    blockedAt,
    reach: euclid,
    interactRadius,
    speed,
    margin,
    // render-hintar för scroll-scenen
    mapImage: theme.mapImage,
    mapSvg: theme.mapSvg,
    viewFraction: num(theme.viewFraction, 1 / 6),
    avatarSize,
  };
}
