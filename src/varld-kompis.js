// ============================================================================
// Pluggporten – kompis-hus-nivån (läs-vy av en KLASSKAMRATS hus-exteriör)
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
//
// FÖRRENDERING (Pixi-rörelsen #396, S2 #420): när pekaren dröjer på – eller
// tangentbordsfokus landar på – en kamrats tomt ritas kamratens exteriör redan
// i det DOLDA kompis-lagret, kameran skapas (registreras hos rörelse-motorn)
// och fokus pekas mot just den tomten. Motorn hinner då bygga T4:s pyramider
// innan klicket. Datan är den som laddaBy() redan hämtat (ensureBy() är då
// en cachad promise) – ingen ny Firestore-läsning. Utan Pixi är det ofarligt:
// visa() ritar samma markup ändå, nu bara lite tidigare.
// ============================================================================

import { go, flash } from "./ui.js";
import { getPalette } from "./room-palettes.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./avatars.js";
import { husScen } from "./art-hus-ute.js";
import { createKamera } from "./varld-kamera.js";
import { BY_ZOOM } from "./varld-by.js";
import { possessiv } from "./text-format.js";

/** Så länge pekaren ska dröja på en kamrats tomt innan exteriören förrenderas. */
const FORRENDER_MS = 120;

/** Minimal escape för elevnamn som skrivs in i aria-attribut. */
function escAttr(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * En annan elevs exteriör som SVG-sträng (läsläge). Återanvänder husScen med
 * elevens skal/avatar men UTAN skylt; id:n döps om (med `prefix`) så de inte
 * krockar med det egna hus-lagret, och aria får elevens namn. Huset görs
 * klickbart → deras rum av lagrets klickhanterare.
 *
 * Exporteras så grannby-vyn (varld-grannby.js) kan rita en ANNAN klass elevs
 * exteriör på EXAKT samma sätt som kompis-hus-nivån gör inom klassen (#114) –
 * bara med en egen id-prefix så de två lagren aldrig delar element-id:n.
 *
 * @param {{namn?:string, username?:string, id?:string, avatarId?:string,
 *   avatarItems?:string[], husSkalId?:string}} friend
 * @param {string} [prefix]  id-prefix, "kompis" (default) eller t.ex. "grannbyhus"
 * @returns {string} husScen-markup med `${prefix}-husgrupp` / `${prefix}-avatar`
 */
export function kompisHusHtml(friend, prefix = "kompis") {
  const namn = friend.namn || friend.username || friend.id;
  return husScen(
    avatarMarkup(friend.avatarId || DEFAULT_AVATAR, friend.avatarItems || []),
    { skalId: friend.husSkalId || undefined, skylt: null }
  )
    .replace('id="husgrupp"', `id="${prefix}-husgrupp"`)
    .replace('id="ute-avatar"', `id="${prefix}-avatar"`)
    .replace('aria-label="Ditt hus utifrån"', `aria-label="${possessiv(escAttr(namn))} hus utifrån"`)
    .replace('aria-label="Gå in i huset"', `aria-label="Gå in i ${possessiv(escAttr(namn))} rum"`);
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

  // Rita kamratens exteriör i kompis-lagret och färga lagret med DERAS palett
  // (överskuggar scenens egna --hus-*), och peka kamerafokus mot deras tomt.
  // Idempotent: samma kamrat → ingen DOM-skrivning (en skrivning smutsar
  // lagret i Pixi-motorn och tvingar fram en ny spegling vid klick).
  let ritadId = null;
  function ritaKompis(friend, by) {
    byKompisNiva.fokus = by.fokusById[friend.id] || byNiva.fokus;
    if (ritadId === friend.id && kompisLager.childElementCount) return;
    ritadId = friend.id;
    kompisLager.innerHTML = kompisHusHtml(friend);
    const kp = getPalette(friend.paletteId);
    kompisLager.style.setProperty("--hus-house", kp.house);
    kompisLager.style.setProperty("--hus-roof", kp.roof);
    kompisLager.style.setProperty("--hus-wall", kp.wall);
    kompisLager.style.setProperty("--hus-wall2", kp.wall2);
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

    // Rita kamratens exteriör (no-op om hover redan förrenderat just hen –
    // då står den förvärmda pyramiden kvar orörd) + fokus mot deras tomt.
    ritaKompis(friend, by);

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

  // Förrendering vid hover/fokus på en kamrats tomt (se toppen av filen).
  // Pekaren får dröja FORRENDER_MS så att en mus som sveper över 25 hus inte
  // ritar om lagret 25 gånger; tangentbordsfokus förrenderar direkt.
  let forTimer = null;
  function forrendera(tomt) {
    clearTimeout(forTimer);
    forTimer = null;
    const id = tomt?.dataset.id;
    // Bara i byn (kameran står still på by-nivån), bara olåsta kamrattomter,
    // och bara när byn redan är byggd (tomten finns → laddaBy har resolvat →
    // ensureBy() är den cachade promisen, ingen läsning).
    if (!id || tomt.dataset.me || tomt.dataset.locked) return;
    if (stage.dataset.niva !== "by" || !tomt.isConnected || !byLager.contains(tomt)) return;
    ensureBy().then((by) => {
      if (stage.dataset.niva !== "by" || (kamera && kamera.aktivId !== "by")) return;
      const friend = by.students.find((s) => s.id === id);
      if (!friend || friend.id === meId) return;
      ritaKompis(friend, by);
      ensureKamera(); // registrerar kompis-kameran hos rörelse-motorn
      try {
        window.__ppPixi?.motor?.forvarmLager?.(kompisLager); // F4b:s krok, om den finns
      } catch { /* motorn är valfri */ }
    }, () => {});
  }
  byLager.addEventListener("pointerover", (e) => {
    const tomt = e.target.closest?.(".by-tomt");
    if (!tomt || tomt.contains(e.relatedTarget)) return; // rörelse inom samma tomt
    clearTimeout(forTimer);
    forTimer = setTimeout(() => forrendera(tomt), FORRENDER_MS);
  });
  byLager.addEventListener("pointerout", (e) => {
    const tomt = e.target.closest?.(".by-tomt");
    if (tomt && !tomt.contains(e.relatedTarget)) clearTimeout(forTimer);
  });
  byLager.addEventListener("focusin", (e) => forrendera(e.target.closest?.(".by-tomt")));

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
