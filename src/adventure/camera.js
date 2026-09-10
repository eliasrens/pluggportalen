// ============================================================================
// Pluggportalen – äventyrsmotorn: camera.js  (issue #220)
// ----------------------------------------------------------------------------
// OPT-IN scroll-kamera för bild-karta-teman. DOM-fri och Firebase-fri matte +
// en liten stateful följare → enhetstestbar (test/adventure-camera.test.js), i
// samma anda som movement.js. Motorn (engine.js) matar in scenens pixelstorlek,
// världens storlek och spelarens världsposition och får tillbaka en CSS-transform
// som scrollar map-/objekt-lagren under en (nära) centrerad avatar.
//
// Två garantier temat ber om:
//   • ~1/6 av kartan syns åt gången  → fitZoom() sätter zoom utifrån viewFraction
//     (tune:bar per tema), men aldrig så lågt att man ser UTANFÖR bildkanten.
//   • Ingen hoppighet                → focus lerpas mjukt mot spelaren (bildruts-
//     oberoende via tau) och clampas så viewporten alltid ligger inom världen.
// ============================================================================

/** Klampa v till [lo,hi]; om hi<lo (viewporten större än världen på den axeln)
 *  centreras i stället (mittpunkten mellan gränserna = världens mitt). */
export function clampRange(v, lo, hi) {
  if (hi < lo) return (lo + hi) / 2;
  return Math.max(lo, Math.min(hi, v));
}

/** Linjär interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Zoom (skala världsenhet→skärmpixel) så att ~viewFraction av kartan syns, men
 * ALDRIG mindre än "cover" (då skulle man se utanför bildkanten). Med en stor
 * värld och viewFraction = 1/6 vinner det önskade zoomet; med en liten värld
 * vinner cover så bilden fyller scenen.
 * @param {{w:number,h:number}} screen  scenens pixelstorlek
 * @param {{w:number,h:number}} world   världens storlek (bildens pixlar)
 * @param {number} viewFraction         ~andel av världsBREDDEN som ska rymmas
 */
export function fitZoom(screen, world, viewFraction) {
  if (!(world.w > 0) || !(world.h > 0)) return 1;
  const cover = Math.max(screen.w / world.w, screen.h / world.h);
  const vf = viewFraction > 0 ? viewFraction : 1 / 6;
  const desired = screen.w / (world.w * vf);
  return Math.max(cover, desired);
}

/**
 * Clampa fokuspunkten (world) så att viewporten aldrig sträcker sig utanför
 * världen. halvViewporten i världsenheter = skärm/zoom/2.
 */
export function clampFocus(focus, screen, world, zoom) {
  const halfW = screen.w / zoom / 2;
  const halfH = screen.h / zoom / 2;
  return {
    x: clampRange(focus.x, halfW, world.w - halfW),
    y: clampRange(focus.y, halfH, world.h - halfH),
  };
}

/**
 * CSS-transform som placerar världslagret så att `focus` hamnar i scenens mitt,
 * skalat med `zoom`. transform-origin måste vara 0 0 på världslagret. Ett barn
 * på världskoordinat (x,y) hamnar då på skärmpixel (x−focus)·zoom + skärm/2.
 */
export function cameraTransform(focus, screen, zoom) {
  const tx = screen.w / 2 - focus.x * zoom;
  const ty = screen.h / 2 - focus.y * zoom;
  return `translate(${tx}px, ${ty}px) scale(${zoom})`;
}

/**
 * Bildruts-oberoende följnings-faktor: hur långt vi lerpar mot målet på tiden dt
 * givet en tidskonstant tau (mindre tau = snabbare, stramare följning). Vid
 * dt→0 ger den 0 (ingen rörelse), vid stort dt närmar den sig 1.
 */
export function followFactor(dt, tau) {
  if (!(tau > 0)) return 1;
  return 1 - Math.exp(-dt / tau);
}

/**
 * Skapa en stateful kamera-följare. Håller aktuellt fokus + zoom och exponerar
 * update() som motorns loop anropar varje bildruta.
 * @param {object} o
 * @param {{w:number,h:number}} o.world        världens storlek
 * @param {number} [o.viewFraction=1/6]         ~andel av kartan som ska synas
 * @param {number} [o.tau=0.12]                 följnings-tidskonstant (sekunder)
 */
export function createCamera({ world, viewFraction = 1 / 6, tau = 0.12 } = {}) {
  let focus = { x: world.w / 2, y: world.h / 2 };
  let zoom = 1;
  let screen = { w: 1, h: 1 };
  let primed = false; // första update:en snäpper fokus (ingen inledande glidning)

  function setScreen(s) {
    screen = { w: Math.max(1, s.w), h: Math.max(1, s.h) };
    zoom = fitZoom(screen, world, viewFraction);
  }

  return {
    setScreen,
    getZoom: () => zoom,
    getFocus: () => ({ ...focus }),
    /** Synlig världsruta {x,y,w,h} (världspixlar) utifrån aktuellt fokus + zoom.
     *  Används av flee-logiken (#276) för att respawna spöken UTANFÖR synhåll. */
    getViewport() {
      const w = screen.w / zoom;
      const h = screen.h / zoom;
      return { x: focus.x - w / 2, y: focus.y - h / 2, w, h };
    },
    /**
     * Följ spelaren ett steg och returnera CSS-transformen för världslagret.
     * @param {{x:number,y:number}} target  spelarens världsposition
     * @param {number} dt                    sekunder sedan förra bildrutan
     */
    update(target, dt) {
      const goal = clampFocus(target, screen, world, zoom);
      if (!primed) {
        focus = goal; // snäpp första gången → ingen hoppig start
        primed = true;
      } else {
        const t = followFactor(dt, tau);
        focus = clampFocus({ x: lerp(focus.x, goal.x, t), y: lerp(focus.y, goal.y, t) }, screen, world, zoom);
      }
      return cameraTransform(focus, screen, zoom);
    },
  };
}
