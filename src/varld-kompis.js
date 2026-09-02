// ============================================================================
// Pluggportalen – kompis-hus-nivån (läs-vy av en KLASSKAMRATS hus-exteriör)
// ----------------------------------------------------------------------------
// Klick på en kamrats tomt i klassbyn ska först ZOOMA IN till deras hus utifrån
// (samma sorts vy som man ser sitt EGET hus i) – inte hoppa direkt in i rummet.
// Först därifrån går klick på huset in i kamratens rum (pages-klasskamrat.js).
//
// Det här är en egen liten kamera som korszoomar det DELADE byLagret ↔ ett
// kompis-lager mot den klickade tomten, i exakt samma anda som huvudkamerans
// by↔hus-nivå (varld-kamera.js). Den skapas först vid första kompisbesöket –
// då står spelaren alltid i byn, så det delade byLagret är i scale(1) och inget
// hoppar. `byKompisNiva` pekar på samma byLager men har EGET fokus, så den egna
// by↔hus-zoomen aldrig störs.
//
// Kamratens exteriör ritas med husScen() (art-hus-ute.js) i LÄSLÄGE: kamratens
// husskal + palett + avatar (utan evo), men UTAN skylt och utan scen-kontroller
// (de göms via [data-niva="kompishus"] i styles.css). Huset görs klickbart →
// deras rum. prefers-reduced-motion ärvs från kameran (instant i stället för
// zoom).
// ============================================================================

import { go, flash } from "./ui.js";
import { getPalette } from "./room-palettes.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { husScen } from "./art-hus-ute.js";
import { createKamera } from "./varld-kamera.js";
import { BY_ZOOM } from "./varld-by.js";

/** Minimal escape för elevnamn som skrivs in i aria-attribut. */
function escAttr(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * Kamratens exteriör som SVG-sträng (läsläge). Återanvänder husScen med
 * kamratens skal/avatar men UTAN skylt; id:n döps om så de inte krockar med
 * det egna hus-lagret, och aria får kamratens namn. Huset görs klickbart →
 * deras rum av kompis-lagrets klickhanterare.
 */
function kompisHusHtml(friend) {
  const namn = friend.namn || friend.username || friend.id;
  return husScen(
    avatarMarkup(friend.avatarId || DEFAULT_AVATAR, friend.avatarItems || []),
    { skalId: friend.husSkalId || undefined, skylt: null }
  )
    .replace('id="husgrupp"', 'id="kompis-husgrupp"')
    .replace('id="ute-avatar"', 'id="kompis-avatar"')
    .replace('aria-label="Ditt hus utifrån"', `aria-label="${escAttr(namn)}s hus utifrån"`)
    .replace('aria-label="Gå in i huset"', `aria-label="Gå in i ${escAttr(namn)}s rum"`);
}

/**
 * Skapa kompis-hus-vyn.
 *
 * @param {object} o
 * @param {HTMLElement} o.stage        scenen (.varld-stage; läser data-niva)
 * @param {HTMLElement} o.byLager      det delade by-lagret (yttre lagret)
 * @param {HTMLElement} o.kompisLager  lagret kamratens exteriör ritas i
 * @param {{fokus:{x:number,y:number}}} o.byNiva  huvudkamerans by-nivå (fokus-fallback)
 * @param {string} o.meId              inloggade elevens id (egen tomt → eget hus)
 * @param {() => Promise<{students:Array, fokusById:Record<string,{x:number,y:number}>}>} o.ensureBy
 *        bygger byn vid behov och resolvar dess elever + tomtfokus per id.
 * @param {(nivaId:string) => void} o.onNiva  körs när kompis-kameran bytt nivå.
 * @returns {{visa:(id:string)=>Promise<void>, tillbaka:()=>boolean,
 *   nollstall:()=>void, aktivId:string, kompis:(object|null)}}
 */
export function createKompisVy({ stage, byLager, kompisLager, byNiva, meId, ensureBy, onNiva }) {
  // byKompisNiva pekar på samma byLager men har EGET fokus (den klickade tomten).
  const byKompisNiva = { id: "by", el: byLager, fokus: { x: 50, y: 40 }, zoom: BY_ZOOM };
  let kamera = null;
  let kompisNu = null;

  function ensureKamera() {
    return (kamera ??= createKamera({
      nivaer: [
        byKompisNiva,
        { id: "kompishus", el: kompisLager, fokus: { x: 48.5, y: 52 }, zoom: 6 },
      ],
      startId: "by",
      onNiva,
    }));
  }

  // Zooma in till en kamrats hus-exteriör. Kräver att byn är byggd (fokus +
  // kompisdata). Egen tomt/okänt id → snäll fallback.
  async function visa(id) {
    if (!id) return go("#/elev/by");
    let by;
    try {
      by = await ensureBy();
    } catch (err) {
      flash("Kunde inte hämta byn: " + err.message, true);
      return;
    }
    const friend = by.students.find((s) => s.id === id);
    if (!friend) return go("#/elev/by");
    if (friend.id === meId) return go("#/elev/hus"); // egen tomt → eget hus
    kompisNu = friend;

    // Rita kamratens exteriör och färga lagret med DERAS palett (överskuggar
    // scenens egna --hus-*). Namnet visas i titeln av anroparens onNiva.
    kompisLager.innerHTML = kompisHusHtml(friend);
    const kp = getPalette(friend.paletteId);
    kompisLager.style.setProperty("--hus-house", kp.house);
    kompisLager.style.setProperty("--hus-roof", kp.roof);
    kompisLager.style.setProperty("--hus-wall", kp.wall);
    kompisLager.style.setProperty("--hus-wall2", kp.wall2);

    // Kamerafokus = kamratens tomt → mjuk zoom just dit.
    byKompisNiva.fokus = by.fokusById[friend.id] || byNiva.fokus;

    const forsta = !kamera;
    const cam = ensureKamera();
    if (forsta) {
      // Nyskapad kamera bär varld-utan-anim tills nästa frame; vänta ett par
      // frames så den ALLRA första zoomen faktiskt animeras (inte hoppar).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => cam.gaTill("kompishus"))
      );
    } else {
      cam.gaTill("kompishus");
    }
  }

  /** Zooma UT till byn (om vi står på kompishus). @returns hanterat? */
  function tillbaka() {
    if (kamera && kamera.aktivId === "kompishus") {
      kamera.gaTill("by");
      return true;
    }
    return false;
  }

  /** Hård nollställning till byn (ovanliga hopp kompishus → hus/rum). */
  function nollstall() {
    if (kamera && kamera.aktivId === "kompishus") kamera.hoppaTill("by");
  }

  // Klick/knappar på kamratens hus → in i deras rum (läsläge).
  kompisLager.addEventListener("click", (e) => {
    if (stage.dataset.niva !== "kompishus" || !kompisNu) return;
    if (e.target.closest("#kompis-husgrupp")) {
      go(`#/elev/klasskamrat?id=${encodeURIComponent(kompisNu.id)}`);
    }
  });
  kompisLager.addEventListener("keydown", (e) => {
    const hus = e.target.closest("#kompis-husgrupp");
    if ((e.key === "Enter" || e.key === " ") && hus) {
      e.preventDefault();
      hus.click();
    }
  });

  return {
    visa,
    tillbaka,
    nollstall,
    get aktivId() {
      return kamera ? kamera.aktivId : "by";
    },
    get kompis() {
      return kompisNu;
    },
  };
}
