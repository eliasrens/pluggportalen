// ============================================================================
// Pluggportalen – gårds-grenen: Baksida/Gården + Inne i Laggården (issue #328)
// ----------------------------------------------------------------------------
// Två nya zoomnivåer BAKOM huset: "gard" (baksidan med odlingsbädd, hage och
// laggårds-byggnaden) och "laggard" (laggårdens interiör). Båda är tomma,
// navigerbara skal – ingen odlings-/djur-logik här (den kommer i senare issues).
//
// Precis som kompis-hus-nivån (varld-kompis.js) är detta en egen liten kamera-
// GREN som korszoomar det DELADE ute-lagret ↔ gård-lagret ↔ laggård-lagret,
// medan huvudkameran står kvar på "hus". `husGardNiva` pekar på samma uteLager
// men har EGET fokus (bakom huset), så den egna hus↔rum-zoomen aldrig störs.
//
//   hus → gard:     skylten "Till gården" på framsidan (varld-navskylt.js) –
//                   kameran zoomar in "genom" huset mot baksidan.
//   gard → laggard: klick på laggårdens dörr (#laggard-dorr i art-gard.js).
//   tillbaka:       ut-knappen (pages-varld.js updateUi) → #/elev/hus resp.
//                   #/elev/gard; rummets "Gå ut"-val kan också gå hit direkt.
//
// Kommer man från RUMMET (valet "Gå till gården" under Gå ut) reser huvud-
// kameran först rum → hus (ensureHus) och gårds-kameran tar sedan vid – en
// sammanhängande kameraresa ut genom huset och runt till baksidan.
//
// OBS BOOTGRAFEN (incident #271): denna modul + art-gard.js ligger MEDVETET
// utanför den statiska bootkedjan – pages-varld.js importerar den DYNAMISKT
// först när gården faktiskt besöks. Importera den aldrig statiskt därifrån.
// ============================================================================

import { go } from "./ui.js";
import { createKamera } from "./varld-kamera.js";
import { gardScen, laggardScen } from "./art-gard.js";
import { mountOdling } from "./varld-odling.js";

/**
 * Skapa gårds-grenen.
 *
 * @param {object} o
 * @param {HTMLElement} o.stage         scenen (.varld-stage; läser data-niva)
 * @param {HTMLElement} o.uteLager      det delade hus-lagret (grenens yttersta nivå)
 * @param {HTMLElement} o.gardLager     lagret gårds-scenen ritas i
 * @param {HTMLElement} o.laggardLager  lagret laggårds-interiören ritas i
 * @param {() => Promise<void>} o.ensureHus  ta huvudkameran till "hus" om den
 *        står någon annanstans (t.ex. rummet) innan grenen zoomar vidare.
 * @param {(nivaId:string) => void} o.onNiva  körs när gårds-kameran bytt nivå.
 * @returns {{visa:(nivaId:string)=>Promise<void>, tillbaka:()=>boolean,
 *   nollstall:()=>void, aktivId:string}}
 */
export function createGardVy({ stage, uteLager, gardLager, laggardLager, ensureHus, onNiva }) {
  // Samma uteLager som huvudkamerans hus-nivå men EGET fokus: kameran dyker
  // "in i" huset (dörren/fasadmitten) på väg till baksidan.
  const husGardNiva = { id: "hus", el: uteLager, fokus: { x: 50, y: 46 }, zoom: 5 };
  let kamera = null;
  let byggd = false;
  let odling = null; // odlingsbädden (#329) – monteras när scenen byggts

  // Scenerna ritas först vid första gårds-besöket (lat – ingen kostnad för
  // elever som aldrig går ut på baksidan).
  function bygg() {
    if (byggd) return;
    byggd = true;
    gardLager.innerHTML = gardScen();
    laggardLager.innerHTML = laggardScen();
    odling = mountOdling({ stage, gardLager });
  }

  function ensureKamera() {
    return (kamera ??= createKamera({
      nivaer: [
        husGardNiva,
        // Fokus = laggårdens dörr (i % av lagret) → gard→laggard zoomar dit.
        { id: "gard", el: gardLager, fokus: { x: 82, y: 74 }, zoom: 5 },
        { id: "laggard", el: laggardLager, fokus: { x: 50, y: 50 }, zoom: 5 },
      ],
      startId: "hus",
      onNiva: (nivaId) => {
        // Frö-panelen (#329) hör bara hemma på gård-nivån.
        if (nivaId !== "gard" && odling) odling.stang();
        onNiva(nivaId);
      },
    }));
  }

  /**
   * Gå (mjukt) till "gard" eller "laggard". Tar först huvudkameran till hus-
   * nivån om vi t.ex. står i rummet, så gren-zoomen alltid utgår från huset.
   */
  async function visa(nivaId) {
    if (nivaId !== "gard" && nivaId !== "laggard") return;
    bygg();
    // Rita odlingsbädden med färskt tillstånd vid varje gårds-besök (grödor kan
    // ha vuxit av plugguppgifter sedan sist). Fire-and-forget: kameran ska inte
    // vänta på Firestore.
    if (nivaId === "gard" && odling) odling.visa();
    await ensureHus();
    const forsta = !kamera;
    const cam = ensureKamera();
    if (forsta) {
      // Nyskapad kamera bär varld-utan-anim tills nästa frame; vänta ett par
      // frames så den ALLRA första zoomen faktiskt animeras (inte hoppar).
      requestAnimationFrame(() => requestAnimationFrame(() => cam.gaTill(nivaId)));
    } else {
      cam.gaTill(nivaId);
    }
  }

  /** Zooma UT ett steg mot huset (laggard → gard → hus). @returns hanterat? */
  function tillbaka() {
    if (!kamera || kamera.aktivId === "hus") return false;
    // gaTill hanterar själv att laggard → hus är två steg (hoppar då direkt).
    kamera.gaTill("hus");
    return true;
  }

  /** Hård nollställning till hus-nivån (hopp ut ur grenen, t.ex. gård → rum). */
  function nollstall() {
    if (kamera && kamera.aktivId !== "hus") kamera.hoppaTill("hus");
  }

  // Klick/tangentbord på laggårdens dörr → in i laggården (egen route så
  // bakåt-knappen fungerar precis som mellan övriga nivåer).
  gardLager.addEventListener("click", (e) => {
    if (stage.dataset.niva !== "gard") return;
    if (e.target.closest("#laggard-dorr")) go("#/elev/laggard");
  });
  gardLager.addEventListener("keydown", (e) => {
    const dorr = e.target.closest("#laggard-dorr");
    if ((e.key === "Enter" || e.key === " ") && dorr) {
      e.preventDefault();
      dorr.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  return {
    visa,
    tillbaka,
    nollstall,
    get aktivId() {
      return kamera ? kamera.aktivId : "hus";
    },
  };
}
