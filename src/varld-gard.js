// ============================================================================
// Pluggporten – gårds-grenen: Baksida/Gården + Inne i Laggården (issue #328)
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
import { mountGardDjur } from "./gard-djur.js";
import { getFarm } from "./data-farm.js";
import { mountFoder } from "./varld-foder.js";
import { mountLadaSkin } from "./varld-lada-skin.js";
import { mountLadaVerktyg } from "./varld-lada-verktyg.js";

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
 * @param {() => object|null} [o.tradgard]  getter till trädgårds-kontrollern
 *        (mountTradgard, #356): gardRita() ritar gårds-sakerna efter varje
 *        scen-ombyggnad, gardVisa(nivaId) togglar "🧰 Verktyg"-knappen.
 * @param {() => object|null} [o.rum]  getter till rums-kontrollern (rumCtl i
 *        pages-varld.js): laggårdens Verktyg (#359) placerar bondgårdsdjuren
 *        via rummets mekanik (listFarmDjur/placeraFarmDjur/farmBarnCap).
 * @returns {{visa:(nivaId:string)=>Promise<void>, tillbaka:()=>boolean,
 *   nollstall:()=>void, aktivId:string}}
 */
export function createGardVy({ stage, uteLager, gardLager, laggardLager, ensureHus, onNiva, tradgard, rum }) {
  // Samma uteLager som huvudkamerans hus-nivå men EGET fokus: kameran dyker
  // "in i" huset (dörren/fasadmitten) på väg till baksidan.
  const husGardNiva = { id: "hus", el: uteLager, fokus: { x: 50, y: 46 }, zoom: 5 };
  let kamera = null;
  let byggd = null; // "gardenTier:barnLevel:barnSkin" som scenerna senast ritades för
  let odling = null; // odlingsbädden (#329) – monteras när scenen byggts
  let gardDjur = null; // bondgårdsdjuren (#330) – monteras vid första besöket
  let foder = null; // foder-panelen (#332) – klick på djur i hagen/ladan
  let ladaSkin = null; // lada-skin-väljaren "🛖 Ny lada" (#353)
  let ladaVerktyg = null; // laggårdens "🧰 Verktyg" (#359) – välj/mata djur i ladan

  // Scenerna ritas först vid första gårds-besöket (lat – ingen kostnad för
  // elever som aldrig går ut på baksidan) och ritas OM när elevens nivåer
  // (#333: odlingsbädd/laggård) ändrats sedan sist – så en köpt uppgradering
  // syns direkt. getFarm läser den session-cachade studentDatan (invalideras
  // av köpet), så det här väntar i praktiken aldrig på nätet; ett nätverksfel
  // faller tillbaka på nivå 1-scenerna (nästa besök försöker igen).
  async function bygg() {
    const farm = await getFarm().catch(() => null);
    const nyckel = farm ? farm.gardenTier + ":" + farm.barnLevel + ":" + (farm.barnSkin || "") : "1:1:";
    if (byggd === nyckel) return;
    byggd = nyckel;
    gardLager.innerHTML = gardScen(
      farm ? { gardenTier: farm.gardenTier, barnLevel: farm.barnLevel, barnSkin: farm.barnSkin } : {});
    laggardLager.innerHTML = laggardScen(farm ? farm.barnLevel : 1, farm ? farm.barnSkin : null);
    odling ??= mountOdling({ stage, gardLager });
    // Lada-skin-väljaren (#353): "🛖 Ny lada" på gårds-nivåerna. Ett sparat byte
    // ritar om BÅDA scenerna (bygg – nyckeln har ändrats) och ritar sedan om
    // odling/djur ovanpå de färska lagren (innerHTML rensade deras overlays;
    // gardDjur.refresh återskapar sitt lager via ensureOverlay, som vid #333).
    ladaSkin ??= mountLadaSkin({
      stage,
      onChanged: async () => {
        await bygg();
        if (odling) odling.visa();
        gardDjur?.refresh().catch(() => {});
        tradgard?.()?.gardRita(); // innerHTML rensade även trädgårds-lagret (#356)
      },
    });
    // Foder-panelen (#332): klick på ett djur i hagen/ladan → mata/hämta gåva.
    // Mood-min + 🎁-badge uppdateras in-place av panelen själv (ingen refresh –
    // en omritning skulle nollställa djurens pågående promenad-animationer).
    // ??= som odling: bygg() kan köras om vid nivåbyte (#333) och panelen
    // lyssnar via delegering på lagren, så EN montering räcker.
    foder ??= mountFoder({ stage, gardLager, laggardLager });
    // Laggårdens Verktyg (#359): välj vilka djur som bor i ladan + mata dem –
    // placeringen går via RUMMETS kontroller (rum-gettern, samma mekanik som
    // Mina djur inkl. #333-taket); "🧺 Mata" öppnar foder-panelen ovan. När en
    // flytt SPARATS ritas hagen/ladan om (gard-djur läser placeringen färskt).
    ladaVerktyg ??= mountLadaVerktyg({
      stage,
      rum,
      oppnaFoder: (uid, namn) => foder?.oppna(uid, namn),
      onPlaced: () => gardDjur?.refresh().catch(() => {}),
    });
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
        // Foder-panelen (#332) stängs vid varje nivåbyte (djuret lämnas kvar).
        if (foder) foder.stang();
        // "🛖 Ny lada"-knappen (#353) syns bara på gård-/laggård-nivåerna.
        ladaSkin?.visa(nivaId);
        // Laggårdens "🧰 Verktyg" (#359) syns bara inne i laggården.
        ladaVerktyg?.visa(nivaId);
        // "🧰 Verktyg"-knappen (#356) syns bara på gård-nivån.
        tradgard?.()?.gardVisa(nivaId);
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
    await bygg();
    // Rita odlingsbädden med färskt tillstånd vid varje gårds-besök (grödor kan
    // ha vuxit av plugguppgifter sedan sist). Fire-and-forget: kameran ska inte
    // vänta på Firestore.
    if (nivaId === "gard" && odling) odling.visa();
    // Trädgårds-sakerna på gården (#356): säkra lagret (bygg kan ha skrivit om
    // scenens innerHTML) och rita placeringarna innan kameran zoomar in.
    tradgard?.()?.gardRita();
    // Bondgårdsdjuren (#330): läs placeringarna färskt och rita/animera djuren
    // i hagen & ladan. Blockerar inte kamerazoomen (fire-and-forget); ett
    // nätverksfel lämnar bara scenen tom (nästa besök försöker igen).
    (gardDjur ??= mountGardDjur({ gardLager, laggardLager })).refresh().catch(() => {});
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
