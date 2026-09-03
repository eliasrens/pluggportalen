// ============================================================================
// Pluggportalen – by-layout (klassbyn, den yttre zoomnivån)
// ----------------------------------------------------------------------------
// Klassbyn (varld-by-scen.js) visar ALLA elevers hus i en utzoomad by-nivå ovanpå
// husvärldens kamera (varld-kamera.js). För att byn ska kännas som en riktig
// liten by – inte hus staplade i ett stelt rutnät – slingrar sig EN
// sammanhängande väg genom byn: den vandrar vågigt över varje husrad och
// U-svänger i kanten ner till nästa rad (serpentin). Husen läggs LÄNGS vägen –
// varje tomts y följer samma slingerkurva som vägen vid tomtens x, så en rads
// hus böljar med vägen i stället för att stå på ett snörrätt streck.
//
// Den här modulen är ren layout-matte + vägritning + dekorplacering, helt
// parameterstyrd, så by-scenen bara behöver:
//
//   1. Rita ett by-lager: gräsbotten + `byVagarSvg(layout)` (vägen) och
//      ett nedskalat hus per elev på `layout.tomter[i]` (samma hus-SVG som
//      ute-scenen), plus dekoren från `byDekor(layout)`.
//   2. Lägga lagret FÖRST i kamerans nivålista:
//        { id: "by", el: byLager, fokus: layout.fokusFor(minTomt), zoom: BY_ZOOM }
//
// Alla koordinater är i procent av by-lagret (samma konvention som kamerans
// fokuspunkter), så byn funkar oavsett canvasstorlek. Antalet hus är dynamiskt
// (en tomt per elev) – layout, väg och dekor räknas alltid om från antalet.
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
 * Beräkna by-layouten: tomter längs en slingrande serpentinväg.
 *
 * @param {object} [o]
 * @param {number} o.antalHus    hur många hus (elever) byn ska rymma
 * @param {number} [o.husPerRad] hus per rad (default 4)
 * @param {number} [o.vagHojd]   vägens bredd i % av by-lagret (default 7)
 * @param {number} [o.margX]     marginal vänster/höger i % (default 8)
 * @param {number} [o.toppY]     var första radens tomter börjar i % (default 20)
 * @param {number} [o.radHojd]   tomthöjd per rad i % (default 26)
 * @returns {{
 *   tomter: Array<{x:number, y:number, skala:number, rad:number, kol:number}>,
 *   vagar: Array<{rad:number, y:number, hojd:number}>,
 *   rader: number,
 *   skala: number,
 *   cellW: number,
 *   radHojd: number,
 *   vagHojd: number,
 *   margX: number,
 *   vagY: (rad:number, x:number) => number,
 *   fokusFor: (tomt: {x:number, y:number}) => {x:number, y:number},
 * }}
 *   tomter[i] = mittpunkten (i %) där hus nr i ställs; `skala` är den
 *   rekommenderade scale-faktorn för hus + avatar på by-nivån (1/BY_ZOOM).
 *   vagY(rad, x) ger vägens mittlinje-y vid x för radens vägsträcka – samma
 *   slingerkurva som tomternas y följer, så väg och dekor kan räknas exakt.
 */
export function byLayout({ antalHus = 8, husPerRad = 4, vagHojd = 7, margX = 8, toppY = 20, radHojd = 26 } = {}) {
  const rader = Math.max(1, Math.ceil(antalHus / husPerRad));

  // Slingerkurvan: en mjuk dubbelsinus i y som både husrad och väg följer.
  // Amplituden hålls under halva vägbredds-marginalen mellan raderna så en
  // rads väg aldrig kryper upp i nästa rads hus (fasskiftet 0.8 rad/rad ger
  // max ~0.87·amp relativ förskjutning mellan grannrader). En enda rad har
  // ingen granne att krocka med och får slingra rejält.
  const amp = rader === 1 ? 3.2 : Math.max(1, Math.min(1.8, vagHojd * 0.34));
  const sling = (x, rad) =>
    amp * (Math.sin(x * 0.075 + rad * 0.8 + 0.6) + 0.35 * Math.sin(x * 0.033 + rad * 1.3 + 2.1));

  // toppY är radbandets ÖVERKANT – tomtens y (mittpunkt) ligger radHojd/2 ner,
  // så första radens hus aldrig sticker upp ur lagret även i stora byar.
  const basY = (rad) => toppY + radHojd / 2 + rad * (radHojd + vagHojd);
  const vagY = (rad, x) => basY(rad) + radHojd * 0.55 + sling(x, rad);

  const cellW = (100 - margX * 2) / husPerRad;
  const tomter = [];
  const vagar = [];
  for (let rad = 0; rad < rader; rad++) {
    const paRad = Math.min(husPerRad, antalHus - rad * husPerRad);
    for (let kol = 0; kol < paRad; kol++) {
      // Centrera ev. ofull sista rad; y följer vägens slinger vid tomtens x.
      const x = margX + cellW * (kol + 0.5) + (cellW * (husPerRad - paRad)) / 2;
      tomter.push({ x, y: basY(rad) + sling(x, rad), skala: 1 / BY_ZOOM, rad, kol });
    }
    // Vägsträckans bas-y (utan slinger) – mest för felsökning/kompatibilitet.
    vagar.push({ rad, y: basY(rad) + radHojd * 0.55, hojd: vagHojd });
  }

  return {
    tomter,
    vagar,
    rader,
    skala: 1 / BY_ZOOM,
    // Tomtens cellbredd + radmått i % – by-scenen använder dem som CSS-mått.
    cellW,
    radHojd,
    vagHojd,
    margX,
    vagY,
    // Kamerafokus för en tomt = tomtens mittpunkt (kameran zoomar dit).
    fokusFor: (tomt) => ({ x: tomt.x, y: tomt.y }),
  };
}

/**
 * Byns slingrande väg som SVG-innehåll för ett by-lager med viewBox 0 0 100 100
 * och preserveAspectRatio="none" – procentkoordinaterna blir då 1:1.
 *
 * EN sammanhängande grusväg: kommer in utifrån (utanför vänsterkanten), vandrar
 * vågigt över första husraden, U-svänger synligt i kanten ner till nästa rad,
 * tillbaka åt andra hållet … och lämnar byn utåt efter sista raden. Ritad som
 * en path med rundade fogar: en bredare mörk kantlinje under, grusfyllning
 * ovanpå, och små stenar utspridda längs sträckorna.
 */
export function byVagarSvg(layout) {
  const { vagY, vagHojd, rader } = layout;
  const f = (n) => Number(n.toFixed(2));

  // Mittlinjen: vågiga radsträckor (samplade var 3:e %-enhet) + U-svängar.
  const delar = [];
  for (let rad = 0; rad < rader; rad++) {
    const ltr = rad % 2 === 0; // vänster→höger på jämna rader
    const xIn = rad === 0 ? (ltr ? -4 : 104) : ltr ? 4 : 96;
    const xUt = rad === rader - 1 ? (ltr ? 104 : -4) : ltr ? 96 : 4;
    const steg = ltr ? 3 : -3;
    for (let x = xIn; ltr ? x < xUt : x > xUt; x += steg) {
      delar.push(`${rad === 0 && x === xIn ? "M" : "L"}${f(x)} ${f(vagY(rad, x))}`);
    }
    delar.push(`L${f(xUt)} ${f(vagY(rad, xUt))}`);
    if (rad < rader - 1) {
      // Synlig U-sväng i kanten ner till nästa rads väg (växlar sida).
      const bukt = ltr ? xUt + 9 : xUt - 9;
      delar.push(`C${f(bukt)} ${f(vagY(rad, xUt))} ${f(bukt)} ${f(vagY(rad + 1, xUt))} ${f(xUt)} ${f(vagY(rad + 1, xUt))}`);
    }
  }
  const d = delar.join(" ");

  // Små stenar längs radsträckorna (lite olika x per rad så det inte blir mönster).
  const stenar = [];
  for (let rad = 0; rad < rader; rad++) {
    for (const bas of [12, 30, 47, 66, 84]) {
      const x = 6 + ((bas + rad * 11) % 88);
      stenar.push(
        `<ellipse cx="${f(x)}" cy="${f(vagY(rad, x) + vagHojd * 0.18)}" rx="1.5" ry="0.45" fill="#D8C4A4"/>`
      );
    }
  }

  const kant = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  return `<path d="${d}" ${kant} stroke="#B0805A" stroke-width="${f(vagHojd + 1.3)}" opacity="0.5"/>
    <path d="${d}" ${kant} stroke="#EAD9C0" stroke-width="${f(vagHojd)}"/>
    ${stenar.join("")}`;
}

/**
 * Placera stämningsdekor i byn: träd/granar/buskar/lyktstolpar (uppstående,
 * ritas som egna element av by-scenen) + platt markdekor (damm, blomrabatter,
 * grästuvor – ritas direkt i markens SVG). Allt är deterministiskt (samma by →
 * samma dekor) och kollisionstestat mot tomter, vägsträckor och U-svängar,
 * så det funkar för få som många hus utan att något hamnar i vägen.
 *
 * @returns {{
 *   uppst: Array<{typ:"trad"|"gran"|"buske"|"lykta", x:number, y:number, s:number}>,
 *   platta: Array<{typ:"blommor"|"tuva", x:number, y:number, s:number}>,
 *   damm: {x:number, y:number, rx:number, ry:number} | null,
 * }}
 *   `x,y` är dekorens markpunkt (bottenmitt) i %, `s` en skalfaktor som följer
 *   husens storlek (mindre by-celler → mindre dekor).
 */
export function byDekor(layout) {
  const { tomter, cellW, radHojd, vagHojd, rader, vagY } = layout;
  const s = Math.max(0.55, Math.min(1, radHojd / 26));
  const placerade = []; // markpunkter som tagit plats: {x, y, rx}

  // Är en dekor med MARKPUNKT (x,y), halvbredd rx och höjd h (uppåt från
  // marken) fri? Husen är bottentunga i sina tomtboxar, så en dekor vars
  // markpunkt ligger klart OVANFÖR husets mitt får stå "bakom" huset (kronan
  // tittar upp över taket – målarordningen via z-index gör resten). Blockerat
  // är: att stå PÅ ett hus, PÅ vägen/U-svängarna, eller ovanpå annan dekor.
  const fri = (x, y, rx, h) => {
    if (x < 2 || x > 98 || y > 96.5 || y - h < 2.5) return false;
    for (const t of tomter) {
      if (
        Math.abs(x - t.x) < cellW * 0.42 + rx * 0.6 &&
        y > t.y - radHojd * 0.35 &&
        y - h < t.y + radHojd * 0.5
      )
        return false;
    }
    for (let rad = 0; rad < rader; rad++) {
      if (Math.abs(y - vagY(rad, x)) < vagHojd * 0.5 + 1.2) return false;
    }
    for (let rad = 0; rad < rader - 1; rad++) {
      // U-svängens kantzon mellan rad och rad+1 (höger på jämna rader).
      const hoger = rad % 2 === 0;
      const kantX = hoger ? 96 : 4;
      if (
        y > vagY(rad, kantX) - 1.5 &&
        y < vagY(rad + 1, kantX) + vagHojd * 0.5 + 1.5 &&
        (hoger ? x > 91 - rx : x < 9 + rx)
      )
        return false;
    }
    for (const p of placerade) {
      if (Math.abs(x - p.x) < (p.rx + rx) * 0.8 + 1 && Math.abs(y - p.y) < 3.5) return false;
    }
    return true;
  };
  const ta = (x, y, rx) => placerade.push({ x, y, rx });

  // --- Damm: en liten spegeldamm nedanför sista vägsträckan om det får plats.
  let damm = null;
  {
    const rx = 8.5 * s + 1.5;
    const ry = 3.4 * s + 0.6;
    for (const x of [78, 22, 60, 38]) {
      const y = vagY(rader - 1, x) + vagHojd * 0.5 + ry + 2.4;
      if (fri(x, y + ry, rx + 1, ry * 2 + 1)) {
        damm = { x, y, rx, ry };
        ta(x, y + ry, rx + 1);
        break;
      }
    }
  }

  const uppst = [];

  // --- Lyktstolpar: vid vägkanten i gluggen mellan två grannhus (husen fyller
  // inte hela sin cell, så mittemellan är visuellt fritt). Max 4, glesare i
  // stora byar. Ingen fri()-koll mot hus här – gluggen ÄR mellan husen.
  let lyktor = 0;
  for (let rad = 0; rad < rader && lyktor < 4; rad++) {
    if (rader > 2 && rad % 2 === 1) continue;
    const iRad = tomter.filter((t) => t.rad === rad);
    if (!iRad.length) continue;
    let x;
    if (iRad.length > 1) {
      const k = (rad * 2) % (iRad.length - 1);
      x = (iRad[k].x + iRad[k + 1].x) / 2;
    } else {
      x = Math.min(94, iRad[0].x + cellW * 0.8);
    }
    const lyktY = vagY(rad, x) - vagHojd * 0.42;
    uppst.push({ typ: "lykta", x, y: lyktY, s });
    ta(x, lyktY, 2.3 * s);
    lyktor++;
  }

  // --- Träd, granar, buskar + platt dekor: deterministisk gyllene-snittspridning
  // över hela lagret, filtrerad genom fri(). Mängden följer byns storlek.
  const platta = [];
  const typer = ["trad", "buske", "tuva", "gran", "blommor", "buske", "trad", "blommor"];
  // Halvbredd + höjd (i %, före s) för kollisionstestet – matchar DEKOR_MATT
  // i art-by-dekor.js (platta typer har små fasta mått).
  const matt = { trad: [4.5, 15], gran: [4, 16], buske: [4, 5.6], blommor: [2, 1.6], tuva: [1.6, 2.2] };
  const maxUppst = Math.min(12, 4 + Math.ceil(tomter.length * 0.6)) + lyktor;
  const maxPlatta = Math.min(8, 3 + Math.ceil(tomter.length * 0.4));
  for (let i = 0; i < 70 && (uppst.length < maxUppst || platta.length < maxPlatta); i++) {
    const typ = typer[i % typer.length];
    const star = typ === "trad" || typ === "gran" || typ === "buske";
    if (star ? uppst.length >= maxUppst : platta.length >= maxPlatta) continue;
    const x = 2 + ((i * 61.8 + 13) % 96);
    const y = 10 + ((i * 35.1 + 29) % 86);
    const rx = matt[typ][0] * (star ? s : 1);
    const h = matt[typ][1] * (star ? s : 1);
    if (!fri(x, y, rx, h)) continue;
    ta(x, y, rx);
    (star ? uppst : platta).push({ typ, x, y, s });
  }

  return { uppst, platta, damm };
}
