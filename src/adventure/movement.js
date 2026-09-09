// ============================================================================
// Pluggportalen – äventyrsmotorn: movement.js
// ----------------------------------------------------------------------------
// Ren rörelse- och kollisionsmatte för den spelarstyrda avataren. DOM-fri och
// Firebase-fri → enhetstestbar (se test/adventure-movement.test.js), i samma anda
// som rum-promenad-golv.js. Motorn (engine.js) matar in aktuell position, en
// riktningsvektor (från input.js) och ett blocked-predikat (från grid.js) och får
// tillbaka nästa position + om figuren rör sig / vänder vänster.
//
// Kollisionen är grid-baserad och axel-separerad: x och y prövas var för sig, så
// avataren KAN glida längs en vägg i stället för att nita fast i ett hörn (samma
// idé som hitsObstacle/clampRange i husdjurens promenad-AI, men styrd av spelaren
// i stället för av en väg-väljande AI). Kliver aldrig in i en blockerad ruta.
// ============================================================================

/** Klampa ett tal till [min,max] (min vinner om intervallet är inverterat). */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Normalisera en rå riktning ({x,y}, valfri längd) till en enhetsvektor. Noll in
 * → noll ut (figuren står still). Diagonaler blir alltså inte snabbare än raka.
 */
export function normalizeDir(dir) {
  const dx = (dir && dir.x) || 0;
  const dy = (dir && dir.y) || 0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Ett rörelsesteg. Räknar hur långt avataren hinner (speed × dt), prövar x- och
 * y-förflyttningen var för sig mot blockedAt och clampar till spelplanens marginal
 * så figuren aldrig kan skjutas utanför scenen eller in i en vägg.
 *
 * @param {{x:number,y:number}} pos   nuvarande position i procent
 * @param {{x:number,y:number}} dir   riktning (behöver inte vara normaliserad)
 * @param {object} o
 * @param {number} o.speed            fart i världsenheter/sekund
 * @param {number} o.dt               tidssteg i sekunder (clampas av anroparen)
 * @param {(x:number,y:number)=>boolean} o.blockedAt  true = rutan går inte att gå i
 * @param {number} [o.margin=0]       minsta avstånd till världskant (samma enhet)
 * @param {number} [o.maxX=100]       världens bredd (default 100 = procent-gridet)
 * @param {number} [o.maxY=100]       världens höjd (default 100 = procent-gridet)
 * @returns {{x:number,y:number,moving:boolean,facingLeft:boolean|null}}
 *   facingLeft: true/false vid horisontell rörelse, annars null (behåll förra).
 *
 * Generaliserad över koordinatsystem (issue #220): default-gränserna 0–100 ger
 * exakt samma beteende som förr för procent-gridet (Spökjakten/Gruvan), men ett
 * bild-karta-tema kan skicka maxX/maxY = världens pixelstorlek så rörelsen och
 * kant-clampen jobbar i VÄRLDSKOORDINATER i stället.
 */
export function moveStep(pos, dir, { speed, dt, blockedAt, margin = 0, maxX = 100, maxY = 100 }) {
  const unit = normalizeDir(dir);
  if (unit.x === 0 && unit.y === 0) {
    return { x: pos.x, y: pos.y, moving: false, facingLeft: null };
  }
  const dist = speed * dt;
  const lo = margin;

  let nx = clamp(pos.x + unit.x * dist, lo, maxX - margin);
  let ny = clamp(pos.y + unit.y * dist, lo, maxY - margin);

  // Axel-separerad kollision: pröva X först (mot nuvarande Y), sedan Y (mot den
  // ev. redan flyttade X) → glid längs väggar utan att fastna i hörn.
  if (blockedAt(nx, pos.y)) nx = pos.x;
  if (blockedAt(nx, ny)) ny = pos.y;

  const moved = nx !== pos.x || ny !== pos.y;
  let facingLeft = null;
  if (unit.x < -1e-6) facingLeft = true;
  else if (unit.x > 1e-6) facingLeft = false;

  return { x: nx, y: ny, moving: moved, facingLeft };
}

/**
 * Avstånd i procent mellan två punkter (motorn använder det för att avgöra om
 * avataren står tillräckligt nära en station för att interagera).
 */
export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Närmaste punkt i en lista inom ett tröskelavstånd, annars null. Motorn matar in
 * stationernas center-koordinater och avatarens position för interaktions-detektion.
 * @param {{x:number,y:number}} from
 * @param {Array<{x:number,y:number}>} points
 * @param {number} radius  max avstånd i procent
 * @returns {{point:object,index:number,d:number}|null}
 */
export function nearestWithin(from, points, radius) {
  let best = null;
  for (let i = 0; i < points.length; i++) {
    const d = dist(from, points[i]);
    if (d <= radius && (!best || d < best.d)) best = { point: points[i], index: i, d };
  }
  return best;
}
