// ============================================================================
// Pluggporten – inloggnings-övergången: porten öppnas + zoom in (issue #339)
// ----------------------------------------------------------------------------
// När elev-inloggningen lyckas spelas en kort "gå in genom porten"-sekvens:
// grindhalvorna från port-scenen (art-port-majestic.js, #338/#344) svänger upp och kameran
// zoomar in genom öppningen, medan appen SAMTIDIGT navigerar till hus-scenen
// under övergången. Känslan blir en sömlös inzoomning från porten in i
// spelvärlden.
//
// Så funkar det (och varför det aldrig kan blockera inloggningen):
//   1. startaPortOvergang() FLYTTAR port-scenens <svg> till ett fixerat
//      overlay exakt över scenens nuvarande ruta (position:fixed, hög
//      z-index). Overlayt överlever alltså sidbytet.
//   2. Anroparen (pages-elev.js) navigerar DIREKT efter att funktionen
//      returnerat – världen laddar och ritas UNDER overlayt. Inloggning och
//      navigering är alltså helt oberoende av animationen: returnerar
//      funktionen false (reduced motion, fallback-panel, fel) sker samma
//      navigering, bara utan dekor.
//   3. Overlayt spelar: grindhalvorna öppnas (CSS-transition på .port-halva,
//      gångjärns-origin sattes redan i #338) → svg:n korszoomas in mot
//      portöppningen med SAMMA duration/easing som världskameran
//      (varld-kamera.js / .varld-lager i styles.css) och tonar ut → overlayt
//      tas bort och världen står framme.
//   4. Ett säkerhets-timeout städar bort overlayt även om transitions aldrig
//      skulle köra (t.ex. gömd flik) – overlayt är dessutom pointer-events:
//      none, så det kan aldrig fånga klick.
//
// Modulen laddas DYNAMISKT från pages-elev.js (aldrig statiskt!) så att
// bootgrafen inte växer med en ny fil (#271).
// ============================================================================

// Samma totala zoomtid som världskameran – övergången ska kännas som samma
// kamera som sedan flyger by ↔ hus ↔ rum. (varld-kamera.js ligger redan i
// bootgrafen via pages-varld.js, så importen drar inte in något nytt.)
import { KAMERA_MS } from "./varld-kamera.js";

/** Grindhalvornas öppningstid (ms) – matchar .port-overgang .port-halva i
    styles.css. Zoomen startar strax innan halvorna är helt öppna. */
const OPPNA_MS = 500;

/** Zoomen börjar när grinden är ~halvöppen – känns som ett enda svep. */
const ZOOM_START_MS = 260;

/** Portöppningens mittpunkt i scenens viewBox (960×600): mellan stolparna,
    mitt i öppningen (spjältopp 316 → botten 506 i art-port.js). Kameran
    zoomar MOT den punkten – samma fokus-idé som varld-kamera.js. */
const FOKUS = { x: 480, y: 428 };

/** Sätt tillbaka CSS-animationernas tider efter flytten (ren kosmetik). */
function aterstallTider(noder, tider) {
  try {
    const nya = noder.flatMap((n) => (n.getAnimations ? n.getAnimations({ subtree: true }) : []));
    for (const [mal, namn, tid] of tider) {
      if (tid == null) continue;
      const a = nya.find((x) => x.effect?.target === mal && x.animationName === namn);
      if (a) a.currentTime = tid;
    }
  } catch {}
}

/**
 * Starta port-övergången ovanpå den nuvarande port-scenen.
 *
 * @param {HTMLElement|null} scenEl  .port-scen-elementet (med grind-SVG:n).
 * @returns {boolean} true om övergången startades (overlayt städar sig
 *          självt), false om den hoppas över – anroparen navigerar likadant
 *          i båda fallen.
 */
export function startaPortOvergang(scenEl) {
  try {
    if (!scenEl || !scenEl.isConnected) return false;
    // Tillgänglighet: reduced motion → ingen animation alls, hoppa direkt in.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    const svg = scenEl.querySelector("svg");
    const vanster = svg?.querySelector("#port-halva-vanster");
    const hoger = svg?.querySelector("#port-halva-hoger");
    if (!svg || !vanster || !hoger) return false;

    const rect = scenEl.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return false;

    // Overlay exakt över scenens nuvarande ruta – bytet syns inte.
    const overlay = document.createElement("div");
    overlay.className = "port-overgang";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    // Zoom-origo = portöppningen i ELEMENT-koordinater. SVG:n ritas med
    // preserveAspectRatio "meet": skala = min(w/960, h/600) och viewBox-
    // mitten (480,300) ligger i elementmitten – samma formel som
    // .port-login-toppen i styles.css.
    const skala = Math.min(rect.width / 960, rect.height / 600);
    const ox = rect.width / 2 + (FOKUS.x - 480) * skala;
    const oy = rect.height / 2 + (FOKUS.y - 300) * skala;
    svg.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;

    // Säsongens löv/fladdermöss (season-world.js, ligger direkt efter SVG:n)
    // följer med, så zoomen har samma säsong hela vägen (#727). Paletten
    // (--sz-*) når overlayt via .port-overgang i season-world.js.
    const sasong = scenEl.querySelector(":scope > .sz-lager-wrap");
    const flytta = [svg, sasong].filter(Boolean);
    // En flyttad nod startar om sina CSS-animationer – spara tiderna så att
    // löv, moln och fåglar fortsätter där de var i stället för att hoppa.
    const tider = flytta.flatMap((n) =>
      n.getAnimations ? n.getAnimations({ subtree: true }).map((a) => [a.effect?.target, a.animationName, a.currentTime]) : []
    );
    overlay.append(...flytta);
    document.body.appendChild(overlay);
    aterstallTider(flytta, tider);

    // Två rAF: låt overlayt få sin startlayout innan transition-klasserna
    // sätts, annars hoppar animationen direkt till slutläget.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        overlay.classList.add("port-oppnad"); // grindhalvorna svänger upp
        setTimeout(() => overlay.classList.add("port-zoom"), ZOOM_START_MS);
      })
    );

    // Städa när zoomen är klar; säkerhets-timeout täcker även fallet där
    // transitions aldrig kör (gömd flik o.dyl.). Overlayt är pointer-events:
    // none, så även i värsta fall stör det aldrig världen under.
    setTimeout(() => overlay.remove(), ZOOM_START_MS + KAMERA_MS + 250);
    return true;
  } catch (err) {
    // Ren dekor – ett fel här får aldrig påverka inloggningen.
    console.warn("Port-övergången kunde inte spelas:", err);
    return false;
  }
}
