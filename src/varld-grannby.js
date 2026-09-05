// ============================================================================
// Pluggportalen – grannby-nivån (läs-vy av en ANNAN klass by, integritetssäker)
// ----------------------------------------------------------------------------
// Klick på en annan klass i skolan (varld-omrade.js) ska ZOOMA IN till DERAS by-
// översikt – inte hoppa någonstans in i enskilda elevers rum. Det här är en egen
// liten kamera som korszoomar det DELADE skol-lagret ↔ ett grannby-lager mot den
// klickade klassens plats, i exakt samma anda som kompis-hus-nivån
// (varld-kompis.js) korszoomar byn ↔ en kamrats hus.
//
// INTEGRITET (issue #37): översikten ritas HELT ur klass-dokumentet (namn, ev.
// by-fält, antal hus = studentIds.length) – allt sådant alla inloggade redan får
// läsa. Inga andra klassers elever, avatarer, paletter eller studentData läses.
// Husen är generiska silhuetter; det finns inget att klicka sig in i här. Man kan
// bara titta och zooma tillbaka till skolan.
// ============================================================================

import { go, flash } from "./ui.js";
import { createKamera } from "./varld-kamera.js";
import { OMRADE_ZOOM, byMiniSvg, hueForKlass } from "./varld-omrade.js";

/** Minimal HTML-escape för klassnamn/by-namn som skrivs in i markup. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** En annan klass by som läs-vy: en större generisk by + en skylt med klassens
 *  namn/by/antal hus och en tydlig "titta men gå inte in"-not. */
function grannbyMarkup(klass) {
  const namn = esc(klass.name || klass.id);
  const by = esc(klass.by || "");
  const antal = Array.isArray(klass.studentIds) ? klass.studentIds.length : 0;
  const hue = hueForKlass(klass);
  return `<div class="grannby-scen">
    <div class="grannby-skylt">
      <span class="grannby-skylt-titel">Klass ${namn}</span>
      ${by ? `<span class="grannby-skylt-by">– ${by} –</span>` : ""}
      <span class="grannby-skylt-antal">${antal} hus 🏠</span>
    </div>
    <div class="grannby-by">${byMiniSvg(antal, hue, 8)}</div>
    <div class="grannby-not">👀 En annan klass by – du kan titta, men inte gå in.</div>
  </div>`;
}

/**
 * Skapa grannby-vyn.
 *
 * @param {object} o
 * @param {HTMLElement} o.stage         scenen (.varld-stage; läser data-niva)
 * @param {HTMLElement} o.skolaLager    det delade skol-lagret (yttre lagret)
 * @param {HTMLElement} o.grannbyLager  lagret grannbyns översikt ritas i
 * @param {{fokus:{x:number,y:number}}} o.skolaNiva  huvudkamerans skol-nivå (fokus-fallback)
 * @param {string|null} o.meClassId     egna klassens id (egen by → egen klassby)
 * @param {() => Promise<{classes:Array, fokusById:Record<string,{x:number,y:number}>}>} o.ensureSkola
 *        bygger skolan vid behov och resolvar dess klasser + byfokus per id.
 * @param {(nivaId:string) => void} o.onNiva  körs när grannby-kameran bytt nivå.
 * @returns {{visa:(id:string)=>Promise<void>, tillbaka:()=>boolean,
 *   nollstall:()=>void, aktivId:string, klass:(object|null)}}
 */
export function createGrannbyVy({ stage, skolaLager, grannbyLager, skolaNiva, meClassId, ensureSkola, onNiva }) {
  // Pekar på samma skol-lager men har EGET fokus (den klickade klassens plats),
  // så den egna skola↔by-zoomen aldrig störs.
  const skolaGrannbyNiva = { id: "skola", el: skolaLager, fokus: { x: 50, y: 50 }, zoom: OMRADE_ZOOM };
  let kamera = null;
  let klassNu = null;

  function ensureKamera() {
    return (kamera ??= createKamera({
      nivaer: [
        skolaGrannbyNiva,
        { id: "grannby", el: grannbyLager, fokus: { x: 50, y: 50 }, zoom: OMRADE_ZOOM },
      ],
      startId: "skola",
      onNiva,
    }));
  }

  // Zooma in till en annan klass by-översikt. Egen klass/okänt id → snäll fallback.
  async function visa(id) {
    if (!id) return go("#/elev/skolan");
    let skola;
    try {
      skola = await ensureSkola();
    } catch (err) {
      flash("Kunde inte hämta skolan: " + err.message, true);
      return;
    }
    const klass = skola.classes.find((c) => c.id === id);
    if (!klass) return go("#/elev/skolan");
    if (klass.id === meClassId) return go("#/elev/by"); // egen by → klassbyn
    klassNu = klass;

    grannbyLager.innerHTML = grannbyMarkup(klass);

    // Kamerafokus = den klickade klassens plats → mjuk zoom just dit.
    skolaGrannbyNiva.fokus = skola.fokusById[klass.id] || skolaNiva.fokus;

    const forsta = !kamera;
    const cam = ensureKamera();
    if (forsta) {
      // Nyskapad kamera bär varld-utan-anim tills nästa frame; vänta ett par
      // frames så den ALLRA första zoomen faktiskt animeras (inte hoppar).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => cam.gaTill("grannby"))
      );
    } else {
      cam.gaTill("grannby");
    }
  }

  /** Zooma UT till skolan (om vi står på en grannby). @returns hanterat? */
  function tillbaka() {
    if (kamera && kamera.aktivId === "grannby") {
      kamera.gaTill("skola");
      return true;
    }
    return false;
  }

  /** Hård nollställning till skolan (ovanliga hopp grannby → by/hus/rum). */
  function nollstall() {
    if (kamera && kamera.aktivId === "grannby") kamera.hoppaTill("skola");
  }

  return {
    visa,
    tillbaka,
    nollstall,
    get aktivId() {
      return kamera ? kamera.aktivId : "skola";
    },
    get klass() {
      return klassNu;
    },
  };
}
