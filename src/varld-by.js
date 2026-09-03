// ============================================================================
// Pluggportalen – by-layout (klassbyn, den yttre zoomnivån)
// ----------------------------------------------------------------------------
// Klassbyn (varld-by-scen.js) visar ALLA elevers hus i en utzoomad by-nivå ovanpå
// husvärldens kamera (varld-kamera.js). För att byn ska kännas som ett riktigt
// litet kvarter – inte hus staplade bredvid varandra – ligger husen i RADER
// med VÄGAR/stigar mellan raderna. Den här modulen är ren layout-matte +
// vägritning, helt parameterstyrd, så klassby-agenten bara behöver:
//
//   1. Rita ett by-lager: gräsbotten + `byVagarSvg(layout)` (vägarna) och
//      ett nedskalat hus per elev på `layout.tomter[i]` (samma hus-SVG som
//      ute-scenen, i en <g transform="translate(x y) scale(s)">, med elevens
//      egen palett som CSS-vars och elevens avatar framför – avatarens storlek
//      skalas med samma faktor via --varld-avatar-font).
//   2. Lägga lagret FÖRST i kamerans nivålista:
//        { id: "by", el: byLager, fokus: layout.fokusFor(minTomt), zoom: BY_ZOOM }
//      där fokus = mitten av elevens EGEN tomt → "gå ut ur huset" från
//      hus-nivån zoomar ut till byn med elevens hus i centrum.
//
// Alla koordinater är i procent av by-lagret (samma konvention som kamerans
// fokuspunkter), så byn funkar oavsett canvasstorlek.
// ============================================================================

/** Rimlig kamerazoom by → hus (huset fyller ~1/5 av byn → zoom ≈ 5). */
export const BY_ZOOM = 5;

/**
 * Välj bra byLayout-parametrar för ett givet antal hus. Dimensionerad för
 * upp till ~30 elever (realistisk klass är 23–24) men ska se bra ut även för
 * små byar: radantalet växer ~kvadratiskt-rot med antalet (max 8 hus/rad),
 * och radhöjd/väghöjd krymper så alla rader ryms i lagret. Små byar centreras
 * vertikalt via toppY i stället för att klänga i överkanten.
 *
 * @param {number} antalHus
 * @returns {{antalHus:number, husPerRad:number, toppY:number, radHojd:number, vagHojd:number}}
 */
export function byParams(antalHus) {
  const antal = Math.max(1, antalHus);
  const husPerRad = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(antal * 1.9))));
  const rader = Math.ceil(antal / husPerRad);
  // Vertikalt utrymme 8–92 % delas på raderna; stora hus (radHojd) kapas vid
  // 26 % så en enda rad inte blir jättehus, och resten centreras.
  const cell = 84 / rader;
  const radHojd = Math.min(26, cell * 0.8);
  const vagHojd = Math.max(3, Math.min(7, cell - radHojd));
  const toppY = Math.max(8, 8 + (84 - rader * (radHojd + vagHojd)) / 2);
  return { antalHus: antal, husPerRad, toppY, radHojd, vagHojd };
}

/**
 * Beräkna by-layouten: tomter i rader med vägar mellan raderna.
 *
 * @param {object} [o]
 * @param {number} o.antalHus    hur många hus (elever) byn ska rymma
 * @param {number} [o.husPerRad] hus per rad (default 4)
 * @param {number} [o.vagHojd]   vägens höjd i % av by-lagret (default 7)
 * @param {number} [o.margX]     marginal vänster/höger i % (default 8)
 * @param {number} [o.toppY]     var första radens tomter börjar i % (default 20)
 * @param {number} [o.radHojd]   tomthöjd per rad i % (default 26)
 * @returns {{
 *   tomter: Array<{x:number, y:number, skala:number, rad:number, kol:number}>,
 *   vagar: Array<{y:number, hojd:number}>,
 *   skala: number,
 *   cellW: number,
 *   radHojd: number,
 *   vagHojd: number,
 *   fokusFor: (tomt: {x:number, y:number}) => {x:number, y:number},
 * }}
 *   tomter[i] = mittpunkten (i %) där hus nr i ställs; `skala` är den
 *   rekommenderade scale-faktorn för hus + avatar på by-nivån (1/BY_ZOOM).
 *   vagar = horisontella vägband (y = överkant i %) att rita mellan raderna.
 */
export function byLayout({ antalHus = 8, husPerRad = 4, vagHojd = 7, margX = 8, toppY = 20, radHojd = 26 } = {}) {
  const rader = Math.max(1, Math.ceil(antalHus / husPerRad));
  const tomter = [];
  const vagar = [];
  for (let rad = 0; rad < rader; rad++) {
    const paRad = Math.min(husPerRad, antalHus - rad * husPerRad);
    const cellW = (100 - margX * 2) / husPerRad;
    for (let kol = 0; kol < paRad; kol++) {
      tomter.push({
        // Centrera ev. ofull sista rad.
        x: margX + cellW * (kol + 0.5) + (cellW * (husPerRad - paRad)) / 2,
        y: toppY + rad * (radHojd + vagHojd),
        skala: 1 / BY_ZOOM,
        rad, kol,
      });
    }
    // Väg/stig direkt nedanför varje rad tomter (framför husen).
    vagar.push({ y: toppY + rad * (radHojd + vagHojd) + radHojd * 0.55, hojd: vagHojd });
  }
  return {
    tomter,
    vagar,
    skala: 1 / BY_ZOOM,
    // Tomtens cellbredd + radmått i % – by-scenen använder dem som CSS-mått.
    cellW: (100 - margX * 2) / husPerRad,
    radHojd,
    vagHojd,
    // Kamerafokus för en tomt = tomtens mittpunkt (kameran zoomar dit).
    fokusFor: (tomt) => ({ x: tomt.x, y: tomt.y }),
  };
}

/**
 * Placeholder-ritning av byns vägar (grusfärgade band med kantlinjer och
 * små stenar) som SVG-innehåll för ett by-lager med viewBox 0 0 100 100 och
 * preserveAspectRatio="none" – procentkoordinaterna blir då 1:1.
 * Klassby-agenten kan använda den rakt av eller rita finare vägar ovanpå.
 */
export function byVagarSvg(layout) {
  return layout.vagar
    .map(({ y, hojd }) => {
      const stenar = [12, 30, 47, 66, 84]
        .map((x) => `<ellipse cx="${x}" cy="${(y + hojd * 0.5).toFixed(1)}" rx="1.6" ry="0.5" fill="#D8C4A4"/>`)
        .join("");
      return `<rect x="-2" y="${y.toFixed(1)}" width="104" height="${hojd.toFixed(1)}" fill="#EAD9C0"/>
        <rect x="-2" y="${y.toFixed(1)}" width="104" height="0.7" fill="#B0805A" opacity="0.5"/>
        <rect x="-2" y="${(y + hojd - 0.7).toFixed(1)}" width="104" height="0.7" fill="#B0805A" opacity="0.5"/>
        ${stenar}`;
    })
    .join("");
}
