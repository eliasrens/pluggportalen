// ============================================================================
// Pluggporten – port → hem (T10) som tidslinje-data (#424, S6 i epic #396)
// ----------------------------------------------------------------------------
// Dagens CSS-övergång (styles.css .port-overgang + port-overgang.js) som
// siffror, och som en tidslinje (varld-render-tidslinje.js) som Pixi-workern
// spelar. REN matte (ingen DOM) → node --test. Laddas bara av
// varld-profil-port.js via import() – aldrig i bootgrafen.
// ============================================================================

/** EXAKT dagens tider (styles.css .port-overgang, port-overgang.js). */
export const PORT_TIDER = Object.freeze({
  // .port-overgang .port-halva: transform 0.5s cubic-bezier(0.6,0.05,0.55,0.4) → scaleX(0.07)
  oppnaMs: 500,
  oppnaEase: Object.freeze([0.6, 0.05, 0.55, 0.4]),
  halvaSkalaX: 0.07,
  // port-overgang.js ZOOM_START_MS → .port-zoom
  zoomStartMs: 260,
  // .port-overgang > svg: transform 0.9s cubic-bezier(0.55,0,0.2,1) → scale(6.5)
  zoomMs: 900,
  zoomEase: Object.freeze([0.55, 0, 0.2, 1]),
  zoom: 6.5,
  // opacity 0.4s ease 0.6s (räknat från .port-zoom)
  fadeDelayMs: 600,
  fadeMs: 400,
  fadeEase: "ease",
  // Portöppningens mitt i viewBoxen (960×600) – port-overgang.js FOKUS
  fokus: Object.freeze({ x: 480, y: 428 }),
});

/**
 * Zoom-origo i ELEMENT-px för en svg med "meet" (samma formel som
 * port-overgang.js / .port-login-toppen).
 */
export function portOrigo(w, h) {
  const s = Math.min(w / 960, h / 600);
  return { x: w / 2 + (PORT_TIDER.fokus.x - 480) * s, y: h / 2 + (PORT_TIDER.fokus.y - 300) * s };
}

/**
 * Största zoomen (≤ zMax) där rutan `r` fortfarande syns när ytan `vy`
 * skalas kring `o` (synliga området krymper mot o när z växer). Minst 1.
 */
export function synligTill(r, o, vy, zMax) {
  let z = zMax;
  const axel = (lo, hi, oo, vlo, vhi) => {
    if (lo > oo) z = Math.min(z, (vhi - oo) / (lo - oo));
    else if (hi < oo) z = Math.min(z, (oo - vlo) / (oo - hi));
  };
  axel(r.x, r.x + r.w, o.x, vy.x, vy.x + vy.w);
  axel(r.y, r.y + r.h, o.y, vy.y, vy.y + vy.h);
  return Math.max(1, Math.min(zMax, z));
}

/**
 * Tidslinjen för port → hem. Ordningen = ritordningen (underst först).
 * @param {{ origo:{x:number,y:number},
 *   nivaer: {id:string, z:number}[],                    pyramidnivåer (lokala px = ytans px)
 *   sprites: {id:string, bas:number[], alpha?:number, gangjarn?:{x:number,y:number}}[] }} o
 *   sprites/nivaer får blandas fritt i `ordning` (annars nivåer först, sedan sprites)
 * @param {string[]} [ordning]  id:n i ritordning
 */
export function portTidslinje({ origo, nivaer = [], sprites = [] }, ordning) {
  const T = PORT_TIDER;
  const zoom = { typ: "skala", origo, fran: 1, till: T.zoom, delay: T.zoomStartMs, ms: T.zoomMs, ease: [...T.zoomEase] };
  const lager = new Map();
  for (const n of nivaer) lager.set(n.id, { id: n.id, zFran: n.z, yttre: [zoom] });
  for (const s of sprites) {
    const l = { id: s.id, bas: s.bas, yttre: [zoom] };
    if (s.alpha != null && s.alpha !== 1) l.alpha = s.alpha;
    if (s.gangjarn) {
      l.inre = [{ typ: "skalaX", origo: s.gangjarn, fran: 1, till: T.halvaSkalaX, ms: T.oppnaMs, ease: [...T.oppnaEase] }];
    }
    lager.set(s.id, l);
  }
  return (ordning || [...lager.keys()]).map((id) => lager.get(id)).filter(Boolean);
}

/** Hela tidslinjens längd i workern (zoomens slut; tonen sköts av canvasens WAAPI). */
export const PORT_SPEL_MS = PORT_TIDER.zoomStartMs + PORT_TIDER.zoomMs;
