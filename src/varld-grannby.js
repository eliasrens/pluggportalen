// ============================================================================
// Pluggportalen – grannby-nivån (läs-vy av en ANNAN klass by)
// ----------------------------------------------------------------------------
// Klick på en annan klass i skolan (varld-omrade.js) ZOOMAR IN till DERAS by –
// numera renderad EXAKT som den egna klassbyn (#114): varje elevs RIKTIGA hus
// med avatar + palett + husskal, plus den klassens stjärn-skylt. Man kan dessutom
// gå IN i en annan klass elevers hus/rum som LÄS-VY, precis som kompis-hus-flödet
// fungerar inom den egna klassen – bara över klassgränser.
//
// Tre zoomnivåer i en egen liten kamera (samma anda som huvudkameran och
// kompis-vyn):
//   skola      – det delade skol-lagret, men med EGET fokus (klickad klass plats)
//   grannby    – den klickade klassens by (mountByScen: riktiga hus + avatarer)
//   grannbyhus – EN elevs hus-exteriör (läs-vy); klick på huset → deras rum
//
// INTEGRITET (#114, medvetet produktägar-beslut som river #37 för looks):
//   * Översikten (grannby) läser grannklassens students/studentData DIREKT –
//     exakt som egna byn (laddaBy) gör – sedan cross-class-läsning öppnades. Byn
//     fylls därmed direkt ur befintlig data (ingen elev behöver ha loggat in
//     först). Huslåset hanteras per elev: en låst elev (nekad studentData) faller
//     till default-utseende, precis som i egna byn.
//   * Klassens stjärnor räknas fram LIVE (aggregateKlassStats ur samma elever) –
//     samma siffror klassen själv ser – och visas via den egna byns stjärn-UI
//     (✨-toggle + skylt). Ingen denormaliserad classStats behövs.
//   * Att gå IN i ett rum (grannbyhus → #/elev/klasskamrat) läser full studentData
//     för DEN eleven – men huslåset (#33, husLast) spärrar låsta rum precis som
//     inom klassen, och man kan aldrig ändra något (läs-vy).
//   * Prestanda: EN klass ritas i taget (bara den man zoomat in på) – dess ~20-24
//     studentData-dok, identiskt med egna byn. Skol-översikten förblir lätta
//     silhuetter (varld-omrade.js) – oförändrad.
// ============================================================================

import { go, flash } from "./ui.js";
import { createKamera } from "./varld-kamera.js";
import { OMRADE_ZOOM } from "./varld-omrade.js";
import { mountByScen } from "./varld-by-scen.js";
import { getPalette } from "./room-palettes.js";
import { kompisHusHtml } from "./varld-kompis.js";

/**
 * Skapa grannby-vyn.
 *
 * @param {object} o
 * @param {HTMLElement} o.stage            scenen (.varld-stage; läser data-niva)
 * @param {HTMLElement} o.skolaLager       det delade skol-lagret (yttersta lagret)
 * @param {HTMLElement} o.grannbyLager      lagret grannbyns by ritas i
 * @param {HTMLElement} o.grannbyhusLager   lagret en elevs hus-exteriör ritas i
 * @param {{fokus:{x:number,y:number}}} o.skolaNiva  huvudkamerans skol-nivå (fokus-fallback)
 * @param {string|null} o.meId        egna elevens id (egen tomt → eget hus, edge-fall)
 * @param {string|null} o.meClassId   egna klassens id (egen by → egen klassby)
 * @param {() => Promise<{classes:Array, fokusById:Record<string,{x:number,y:number}>}>} o.ensureSkola
 *        bygger skolan vid behov och resolvar dess klasser + byfokus per id.
 * @param {(klass:object) => Promise<{students:Array, stats:object|null}>} o.laddaData
 *        hämtar den klickade klassens elever (studentData → students för mountByScen)
 *        + LIVE-beräknat stjärn-aggregat. Best-effort; en tom lista tål vyn.
 * @param {(stats:object|null, klassNamn:string) => void} o.onStats  fyll grannby-stjärn-UI:t.
 * @param {(nivaId:string) => void} o.onNiva  körs när grannby-kameran bytt nivå.
 * @returns {object}
 */
export function createGrannbyVy({
  stage, skolaLager, grannbyLager, grannbyhusLager, skolaNiva,
  meId, meClassId, ensureSkola, laddaData, onStats, onNiva,
}) {
  // Pekar på samma skol-lager men har EGET fokus (den klickade klassens plats),
  // så den egna skola↔by-zoomen aldrig störs.
  const skolaGrannbyNiva = { id: "skola", el: skolaLager, fokus: { x: 50, y: 50 }, zoom: OMRADE_ZOOM };
  // grannby-nivåns fokus används BARA för grannby↔grannbyhus-övergången (den
  // klickade tomten). skola↔grannby styrs av skolaGrannbyNiva.fokus.
  const grannbyNiva = { id: "grannby", el: grannbyLager, fokus: { x: 50, y: 50 }, zoom: OMRADE_ZOOM };
  const grannbyhusNiva = { id: "grannbyhus", el: grannbyhusLager, fokus: { x: 48.5, y: 52 }, zoom: 6 };

  let kamera = null;
  let klassNu = null;        // den klass grannbyn just nu visar
  let elevNu = null;         // den elev grannbyhus-nivån just nu visar
  let byggd = null;          // memo: { klassId, students, fokusById, stats }

  function ensureKamera() {
    return (kamera ??= createKamera({
      nivaer: [skolaGrannbyNiva, grannbyNiva, grannbyhusNiva],
      startId: "skola",
      onNiva,
    }));
  }

  // Bygg (eller återanvänd) grannbyns by för en klass: rita mountByScen i grann-
  // by-lagret, fyll stjärn-UI:t och sätt skol-fokus mot klassens plats. Memoiseras
  // per klass-id så ett hus-in/ut-hopp inte bygger om byn i onödan.
  async function ensureGrannby(klass) {
    if (byggd && byggd.klassId === klass.id) return byggd;

    let students = [];
    let stats = null;
    try {
      const res = await laddaData(klass);
      students = Array.isArray(res?.students) ? res.students : [];
      stats = res?.stats ?? null;
    } catch (err) {
      flash("Kunde inte hämta klassens by: " + err.message, true);
      students = [];
    }

    const klassNamn = String(klass.name || klass.id || "");
    // Rita byn IDENTISKT med den egna klassbyn (samma mountByScen). meId matchar
    // normalt ingen elev i en ANNAN klass → ingen "Du!"-tomt. Husen blir samma
    // klickbara .by-tomt som i egna byn; klickhanteringen (in i rum / låst-bubbla)
    // sitter i pages-varld på grannbyLager.
    const { fokusById } = mountByScen({ lager: grannbyLager, meId, students });

    // Klassens stjärnor: samma ✨-toggle + skylt som egna byn (fyll via onStats).
    onStats?.(stats, klassNamn);

    byggd = { klassId: klass.id, students, fokusById, stats };
    return byggd;
  }

  // Zooma in till en annan klass by-översikt. Egen klass/okänt id → snäll fallback.
  async function visa(id) {
    if (!id) return go("#/elev/skolan");

    // Redan inzoomad på ETT hus i samma klass? Zooma bara UT till översikten
    // (bygg inte om byn).
    if (kamera && kamera.aktivId === "grannbyhus" && klassNu && klassNu.id === id) {
      elevNu = null;
      kamera.gaTill("grannby");
      return;
    }

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
    elevNu = null;

    await ensureGrannby(klass);

    // Kamerafokus (skol-lagret) = den klickade klassens plats → mjuk zoom dit.
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

  // Gå IN i en elevs hus-exteriör (läs-vy) i den klickade klassens by. Kräver att
  // byn är byggd; bygger den vid behov (djuplänk). Låst/egen/okänd elev → fallback.
  async function visaHus(studentId, klassId) {
    if (!studentId) return go("#/elev/skolan");

    // Bygg/hämta rätt klass by först (djuplänk kan sakna klassNu).
    let klass = klassNu;
    if (!klass || (klassId && klass.id !== klassId)) {
      let skola;
      try {
        skola = await ensureSkola();
      } catch (err) {
        flash("Kunde inte hämta skolan: " + err.message, true);
        return;
      }
      klass = skola.classes.find((c) => c.id === klassId) || null;
      if (!klass) return go("#/elev/skolan");
      if (klass.id === meClassId) return go("#/elev/hus");
      klassNu = klass;
      skolaGrannbyNiva.fokus = skola.fokusById[klass.id] || skolaNiva.fokus;
    }

    const byggnad = await ensureGrannby(klass);
    const elev = byggnad.students.find((s) => s.id === studentId);
    // Elev saknas (looks ej speglat) eller är egen → tillbaka till översikten.
    if (!elev || elev.id === meId) return go(`#/elev/grannby?id=${encodeURIComponent(klass.id)}`);
    // Låst hus: gå inte in – tillbaka till översikten (pages-varld visar bubblan
    // vid klick; detta är säkerhetsnätet för direktlänk).
    if (elev.locked) return go(`#/elev/grannby?id=${encodeURIComponent(klass.id)}`);
    elevNu = elev;

    // Rita elevens exteriör (samma väg som kompis-hus-nivån) och färga lagret med
    // DERAS palett. Egen id-prefix så grannbyhus-lagret aldrig delar element-id:n
    // med kompis-lagret.
    grannbyhusLager.innerHTML = kompisHusHtml(elev, "grannbyhus");
    const kp = getPalette(elev.paletteId);
    grannbyhusLager.style.setProperty("--hus-house", kp.house);
    grannbyhusLager.style.setProperty("--hus-roof", kp.roof);
    grannbyhusLager.style.setProperty("--hus-wall", kp.wall);
    grannbyhusLager.style.setProperty("--hus-wall2", kp.wall2);

    // grannby-fokus = elevens tomt → mjuk zoom just dit (grannby→grannbyhus).
    grannbyNiva.fokus = byggnad.fokusById[elev.id] || grannbyNiva.fokus;

    const forsta = !kamera;
    const cam = ensureKamera();
    // Står vi redan i grannbyn? Ett steg in. Annars (djuplänk från skola) tar
    // kameran hoppet direkt (mer än ett steg) utan animation.
    if (forsta) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => cam.gaTill("grannbyhus"))
      );
    } else {
      cam.gaTill("grannbyhus");
    }
  }

  // Klick/knappar på elevens hus → in i deras rum (läs-vy, cross-class). Klass-id
  // följer med så rummets "tillbaka" landar rätt (grannbyn, inte egna byn).
  grannbyhusLager.addEventListener("click", (e) => {
    if (stage.dataset.niva !== "grannbyhus" || !elevNu) return;
    if (e.target.closest("#grannbyhus-husgrupp")) {
      const klassDel = klassNu ? `&klass=${encodeURIComponent(klassNu.id)}` : "";
      go(`#/elev/klasskamrat?id=${encodeURIComponent(elevNu.id)}${klassDel}`);
    }
  });
  grannbyhusLager.addEventListener("keydown", (e) => {
    const hus = e.target.closest("#grannbyhus-husgrupp");
    if ((e.key === "Enter" || e.key === " ") && hus) {
      e.preventDefault();
      hus.click();
    }
  });

  /** Zooma UT ett steg (grannbyhus → grannby, eller grannby → skola). */
  function tillbaka() {
    if (!kamera) return false;
    if (kamera.aktivId === "grannbyhus") {
      elevNu = null;
      kamera.gaTill("grannby");
      return true;
    }
    if (kamera.aktivId === "grannby") {
      kamera.gaTill("skola");
      return true;
    }
    return false;
  }

  /** Hård nollställning till skolan (ovanliga hopp grannby/grannbyhus → by/hus/rum). */
  function nollstall() {
    if (kamera && kamera.aktivId !== "skola") kamera.hoppaTill("skola");
    elevNu = null;
  }

  return {
    visa,
    visaHus,
    tillbaka,
    nollstall,
    get aktivId() {
      return kamera ? kamera.aktivId : "skola";
    },
    get klass() {
      return klassNu;
    },
    get elev() {
      return elevNu;
    },
  };
}
