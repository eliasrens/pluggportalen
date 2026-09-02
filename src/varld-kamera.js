// ============================================================================
// Pluggportalen – världskameran (zoom-nivåer för den spelifierade husvärlden)
// ----------------------------------------------------------------------------
// En liten, återanvändbar "kamera" som zoomar mellan lager i en scen utan
// sidladdning. Varje NIVÅ är ett fullstort lager (position:absolute; inset:0)
// i samma stage, ordnat YTTERST → INNERST, t.ex. [by, hus, rum].
//
//   { id: "hus", el: <lager>, fokus: { x: 48.5, y: 52 }, zoom: 6 }
//
//   fokus = punkten (i % av lagret) som kameran zoomar MOT när man går ett
//           steg inåt (för hus-lagret: husets fönster).
//   zoom  = hur mycket lagret förstoras när kameran passerar in genom det
//           (och hur mycket nästa inre lager krymps när man står kvar utanför).
//
// Övergången är en korszoom: det yttre lagret skalas 1 → zoom kring sitt
// fokus och tonas ut, medan det inre lagret skalas 1/zoom → 1 kring SAMMA
// punkt och tonas in – båda rör sig ihop, så det känns som en enda kamera.
// Viktigt origo-trick: transform-origin byts bara på lager som står i
// scale(1) (då origo saknar visuell effekt), så det aldrig hoppar.
//
// SÅ LÄGGER DU TILL EN YTTRE "BY"-NIVÅ (nästa uppgift, klassbyn):
//   1. Rita ett by-lager (alla elevers hus i liten skala) och lägg det FÖRST
//      i nivalistan: { id: "by", el: byLager, fokus: {x,y där elevens eget hus
//      står i byn}, zoom: ~5 }.
//   2. Skala ner innehållet i by-lagret med en parameter (t.ex. samma
//      CSS-variabel som styr avatarens storlek, --varld-avatar-font) så
//      proportionerna stämmer i utzoomat läge.
//   3. Klart – kameran hanterar by ↔ hus ↔ rum automatiskt. Djuplänka genom
//      att skicka rätt start-id till createKamera / gaTill.
// Övergångarnas timing/easing ligger i CSS (.varld-lager i styles.css) och
// stängs av under prefers-reduced-motion (kameran väntar då inte heller).
// ============================================================================

/** Total övergångstid i ms – matchar transition-regeln i styles.css. */
export const KAMERA_MS = 900;

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Skapa kameran.
 * @param {object} o
 * @param {Array<{id:string, el:HTMLElement, fokus:{x:number,y:number}, zoom:number}>} o.nivaer
 *        Lagren ordnade YTTERST → INNERST.
 * @param {string} o.startId  Nivån kameran börjar på (utan animation).
 * @param {(id:string) => void} [o.onNiva]  Körs när en ny nivå blivit aktiv.
 */
export function createKamera({ nivaer, startId, onNiva }) {
  let aktiv = Math.max(0, nivaer.findIndex((n) => n.id === startId));
  let doldTimer = null;

  const origin = (n, fokus) => {
    n.el.style.transformOrigin = `${fokus.x}% ${fokus.y}%`;
  };

  /**
   * Sätt alla lagers transform/opacity för den aktiva nivån `k`.
   * `origoNiva` = nivån vars fokus styr origo för det inre lagret i den
   * pågående övergången (min av gammal/ny nivå); vid stillastående = k.
   */
  function apply(k, origoNiva = k) {
    for (let j = 0; j < nivaer.length; j++) {
      const n = nivaer[j];
      const s = n.el.style;
      if (j === k) {
        // Aktivt lager: fullskala. Origo = övergångens fokuspunkt – kommer vi
        // inifrån ett yttre lager (zoom in, origoNiva = k-1) måste origot stå
        // kvar på DET lagrets fokus, annars hoppar startbilden (lagret står
        // då i nedkrympt läge kring just den punkten).
        origin(n, nivaer[origoNiva].fokus);
        s.transform = "scale(1)";
        s.opacity = "1";
        n.el.classList.remove("varld-dold");
        n.el.inert = false;
      } else if (j === k - 1) {
        // Lagret vi klivit in igenom: uppförstorat kring sitt eget fokus.
        origin(n, n.fokus);
        s.transform = `scale(${n.zoom})`;
        s.opacity = "0";
        n.el.classList.remove("varld-dold"); // ska synas medan det tonar ut
        n.el.inert = true;
      } else if (j === k + 1) {
        // Nästa inre lager: nedkrympt kring det yttre lagrets fokus.
        origin(n, nivaer[origoNiva].fokus);
        s.transform = `scale(${1 / nivaer[j - 1].zoom})`;
        s.opacity = "0";
        n.el.classList.remove("varld-dold");
        n.el.inert = true;
      } else {
        // Lager längre bort deltar inte i övergången – göm helt.
        s.opacity = "0";
        n.el.classList.add("varld-dold");
        n.el.inert = true;
      }
    }
    // Grannlager göms (visibility) först när övergången är klar, så de inte
    // fångar fokus/pekare men fortfarande kan tona ut mjukt.
    clearTimeout(doldTimer);
    doldTimer = setTimeout(() => {
      nivaer.forEach((n, j) => {
        if (j !== k) n.el.classList.add("varld-dold");
      });
    }, reduceMotion() ? 30 : KAMERA_MS + 60);
  }

  /** Hoppa direkt (utan animation) till en nivå. */
  function hoppaTill(id) {
    const mal = nivaer.findIndex((n) => n.id === id);
    if (mal === -1) return;
    for (const n of nivaer) n.el.classList.add("varld-utan-anim");
    aktiv = mal;
    apply(aktiv);
    // Tvinga fram layout så nollställningen inte animeras, släpp sedan på.
    void nivaer[mal].el.offsetWidth;
    for (const n of nivaer) n.el.classList.remove("varld-utan-anim");
    onNiva?.(id);
  }

  /**
   * Gå (mjukt) till en nivå. Angränsande nivåer korszoomas; hopp längre än
   * ett steg (t.ex. djuplänk by → rum) tas direkt utan animation.
   * @returns {Promise<void>} löser när övergången är klar.
   */
  function gaTill(id) {
    const mal = nivaer.findIndex((n) => n.id === id);
    if (mal === -1 || mal === aktiv) return Promise.resolve();
    if (Math.abs(mal - aktiv) > 1 || reduceMotion()) {
      hoppaTill(id);
      return Promise.resolve();
    }
    const origoNiva = Math.min(mal, aktiv);
    aktiv = mal;
    apply(aktiv, origoNiva);
    return new Promise((res) =>
      setTimeout(() => {
        onNiva?.(id);
        res();
      }, KAMERA_MS)
    );
  }

  apply(aktiv);
  // Startläget ska inte animeras in.
  for (const n of nivaer) n.el.classList.add("varld-utan-anim");
  requestAnimationFrame(() => {
    for (const n of nivaer) n.el.classList.remove("varld-utan-anim");
  });

  return {
    gaTill,
    hoppaTill,
    get aktivId() {
      return nivaer[aktiv].id;
    },
  };
}
