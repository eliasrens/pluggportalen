// ============================================================================
// Pluggporten – by-layout (klassbyn, den yttre zoomnivån)
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
//      ute-scenen), plus dekoren från `byDekor(layout)` (art-by-dekor.js).
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
 * Hur många tomtplatser Klasscentret (#480, epic #476) tar i byns slinga: 2 i
 * små byar (få hus/rad → breda celler), 3 från 8 elever (realistisk klass).
 * Konsten (art-klasscenter.js) är ritad för ~2,5 minihus bredd.
 */
export function klasscenterSpan(antalHus) {
  return antalHus >= 8 ? 3 : 2;
}

/** Max elevhus på VARJE sida om Klasscentret i översta raden (Elias 2026-10-07). */
export const KC_HUS_PER_SIDA = 2;

/**
 * Översta radens fördelning runt Klasscentret: hus, hus, CENTRET, hus, hus.
 * Färre än 4 elever fördelas så jämnt det går – udda extra hus till vänster
 * (1 → ett hus till vänster, 3 → 2 vänster + 1 höger).
 * @returns {{vanster:number, hoger:number, sida:number}} sida = platser per sida
 */
export function klasscenterRad0(antalHus) {
  const k = Math.min(KC_HUS_PER_SIDA * 2, Math.max(0, antalHus));
  const vanster = Math.ceil(k / 2);
  return { vanster, hoger: k - vanster, sida: vanster };
}

/**
 * "Andra byar"-skyltens hörn (#483) i by-lagrets procent: nere till vänster.
 * CSS (#by-skylt i styles.css) kapar skylten så den alltid ryms här; layouten
 * lägger inga tomter i rutan (fulla rader tappar sina vänsterplatser).
 */
export const BY_SKYLT = Object.freeze({ v: 0, h: 22, o: 78, u: 100 });

/** Extra höjd ovanför första raden (× radHojd) när byn har ett Klasscenter. */
const KC_EXTRA = 0.9;

/**
 * Välj bra byLayout-parametrar för ett givet antal hus. Dimensionerad för
 * upp till ~30 elever (realistisk klass är 23–24) men ska se bra ut även för
 * små byar: radantalet växer ~kvadratiskt-rot med antalet (max 8 hus/rad),
 * och radhöjd/väghöjd krymper så alla rader ryms i lagret. Små byar centreras
 * vertikalt via toppY i stället för att klänga i överkanten.
 *
 * Med `klasscenter: true` (#480) står Klasscentret i MITTEN av översta raden
 * (klasscenterSpan() platser breda) med upp till 2 elevhus på varje sida
 * (klasscenterRad0); resten av eleverna fyller raderna under som vanligt, så
 * ingen elev försvinner. husPerRad höjs vid behov så översta raden ryms, och
 * första raden får extra höjd ovanför (kcExtra) för byggnaden + mätaren.
 *
 * @param {number} antalHus
 * @param {{klasscenter?: boolean}} [o]
 * @returns {{antalHus:number, husPerRad:number, toppY:number, radHojd:number,
 *   vagHojd:number, kcSpan:number, kcExtra:number}}
 */
export function byParams(antalHus, { klasscenter = false, skylt = klasscenter } = {}) {
  const kcSpan = klasscenter ? klasscenterSpan(Math.max(0, antalHus)) : 0;
  const antal = klasscenter ? Math.max(0, antalHus) : Math.max(1, antalHus);
  const platser = antal + kcSpan;
  let husPerRad = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(platser * 1.9))));
  let rader = Math.ceil(platser / husPerRad);
  if (kcSpan) {
    // Översta raden: sida + centret + sida (max 2 + 3 + 2 = 7 ≤ 8).
    const { vanster, hoger, sida } = klasscenterRad0(antal);
    husPerRad = Math.max(husPerRad, sida * 2 + kcSpan);
    rader = 1 + Math.ceil((antal - vanster - hoger) / husPerRad);
  }
  // Vertikalt utrymme 8–92 % delas på raderna; stora hus (radHojd) kapas vid
  // 26 % så en enda rad inte blir jättehus, och resten centreras.
  // Klasscentrets extrahöjd (KC_EXTRA × radHojd ≈ 0,72 cell) räknas in i delningen.
  // storlek = radantalet husen dimensioneras för (≥ rader; större → mindre hus).
  const mat = (rader, storlek = rader) => {
    const cell = 84 / (storlek + (kcSpan ? KC_EXTRA * 0.8 : 0));
    let radHojd = Math.min(26, cell * 0.8);
    const vagHojd = Math.max(3, Math.min(7, cell - radHojd));
    // Många rader + vägens minimibredd får aldrig trycka ut sista raden ur lagret.
    if (kcSpan && KC_EXTRA * radHojd + storlek * (radHojd + vagHojd) > 84) {
      radHojd = (84 - storlek * vagHojd) / (storlek + KC_EXTRA);
    }
    const kcExtra = kcSpan ? KC_EXTRA * radHojd : 0;
    const toppY = Math.max(8, 8 + (84 - kcExtra - rader * (radHojd + vagHojd)) / 2) + kcExtra;
    const p = { antalHus: antal, husPerRad, toppY, radHojd, vagHojd, kcSpan, kcExtra };
    return skylt ? { ...p, skylt: BY_SKYLT } : p;
  };
  // "Andra byar"-skylten (#483) kan tränga undan hus i nedersta raden. Krymp
  // då husen lagom mycket (binärsökning) så raderna lyfts förbi skylten; räcker
  // inte en hel rads krympning läggs en rad till.
  let p = mat(rader);
  const ryms = (q) => byLayout(q).rader <= rader;
  while (skylt && !ryms(p)) {
    if (!ryms(mat(rader, rader + 1))) {
      p = mat(++rader);
      continue;
    }
    let lo = rader;
    let hi = rader + 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (ryms(mat(rader, mid))) hi = mid;
      else lo = mid;
    }
    p = mat(rader, hi);
  }
  return p;
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
 * @param {number} [o.kcSpan]    Klasscentrets bredd i tomtplatser, mitt i översta raden (0 = inget)
 * @param {number} [o.kcExtra]   extra höjd ovanför första raden för centret (i %)
 * @param {{v:number,h:number,o:number,u:number}|null} [o.skylt] ruta (i %) utan tomter
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
 *   klasscenter: null | {x:number, y:number, bredd:number, hojd:number,
 *     topp:number, botten:number, span:number, rad:number},
 * }}
 *   tomter[i] = mittpunkten (i %) där hus nr i ställs; `skala` är den
 *   rekommenderade scale-faktorn för hus + avatar på by-nivån (1/BY_ZOOM).
 *   vagY(rad, x) ger vägens mittlinje-y vid x för radens vägsträcka – samma
 *   slingerkurva som tomternas y följer, så väg och dekor kan räknas exakt.
 *   klasscenter (#480): centrets ruta i % – x = 50 (mitt i översta raden), botten
 *   = samma marklinje som radens hus, hojd = radHojd + kcExtra·0,8 (resten av
 *   extrahöjden är luft för mätaren ovanför). tomter innehåller BARA elevhus,
 *   så tomter[i] ↔ elev i gäller fortfarande.
 */
export function byLayout({
  antalHus = 8, husPerRad = 4, vagHojd = 7, margX = 8, toppY = 20, radHojd = 26, kcSpan = 0, kcExtra = 0, skylt = null,
} = {}) {
  // Med Klasscentret: översta raden = vänster-hus, centret, höger-hus (centrerat);
  // övriga elever fyller raderna under. Utan: antalHus platser rad för rad.
  const antal = Math.max(0, antalHus);
  const rad0 = kcSpan ? klasscenterRad0(antal) : null;
  const iRad0 = rad0 ? rad0.vanster + rad0.hoger : 0;
  // Preliminärt radantal (styr bara slingans amplitud); skylten kan lägga till rader.
  const rader0 = kcSpan
    ? 1 + Math.ceil((antal - iRad0) / husPerRad)
    : Math.max(1, Math.ceil(antal / husPerRad));

  // Slingerkurvan: en mjuk dubbelsinus i y som både husrad och väg följer.
  // Amplituden hålls under halva vägbredds-marginalen mellan raderna så en
  // rads väg aldrig kryper upp i nästa rads hus (fasskiftet 0.8 rad/rad ger
  // max ~0.87·amp relativ förskjutning mellan grannrader). En enda rad har
  // ingen granne att krocka med och får slingra rejält.
  const amp = rader0 === 1 ? 3.2 : Math.max(1, Math.min(1.8, vagHojd * 0.34));
  const sling = (x, rad) =>
    amp * (Math.sin(x * 0.075 + rad * 0.8 + 0.6) + 0.35 * Math.sin(x * 0.033 + rad * 1.3 + 2.1));

  // toppY är radbandets ÖVERKANT – tomtens y (mittpunkt) ligger radHojd/2 ner,
  // så första radens hus aldrig sticker upp ur lagret även i stora byar.
  const basY = (rad) => toppY + radHojd / 2 + rad * (radHojd + vagHojd);
  const vagY = (rad, x) => basY(rad) + radHojd * 0.55 + sling(x, rad);

  const cellW = (100 - margX * 2) / husPerRad;
  const tomter = [];
  const vagar = [];
  let klasscenter = null;
  const tomt = (x, rad, kol) => ({ x, y: basY(rad) + sling(x, rad), skala: 1 / BY_ZOOM, rad, kol });
  if (rad0) {
    // Översta raden: centret mitt i lagret, husen tätt intill på var sida.
    // Slingans ordning (vänster→höger) = vänster-husen, centret, höger-husen.
    const cx = 50;
    const kant = (cellW * kcSpan) / 2;
    for (let j = 0; j < rad0.vanster; j++) {
      tomter.push(tomt(cx - kant - cellW * (rad0.vanster - j - 0.5), 0, j));
    }
    for (let j = 0; j < rad0.hoger; j++) {
      tomter.push(tomt(cx + kant + cellW * (j + 0.5), 0, rad0.vanster + 1 + j));
    }
    const botten = basY(0) + sling(cx, 0) + radHojd / 2;
    const hojd = radHojd + kcExtra * 0.8;
    klasscenter = {
      x: cx, y: botten - hojd / 2, bredd: cellW * kcSpan, hojd,
      topp: botten - hojd, botten, span: kcSpan, rad: 0,
    };
  }
  // Krockar en tomt med skyltens hörn (samma ruta som by-scenen ritar huset i)?
  const iSkylt = (t) => !!skylt && t.x - cellW / 2 < skylt.h && t.x + cellW / 2 > skylt.v
    && t.y - radHojd / 2 < skylt.u && t.y + radHojd / 2 > skylt.o;
  let kvar = antal - iRad0;
  let rad = 0;
  if (rad0) vagar.push({ rad: rad++, y: basY(0) + radHojd * 0.55, hojd: vagHojd });
  for (; kvar > 0 || rad === 0; rad++) {
    // Ofull rad centreras. Krockar den med skylten skjuts den åt höger förbi
    // skylten (får låna halva högermarginalen); ryms den ändå inte flyttas
    // överskottet till nästa rad – byParams räknar då in en rad till.
    let paRad = Math.min(husPerRad, kvar);
    let fran = margX + (cellW * (husPerRad - paRad)) / 2;
    const rad1 = (n, x0) => Array.from({ length: n }, (_, kol) => tomt(x0 + cellW * (kol + 0.5), rad, kol));
    if (rad1(paRad, fran).some(iSkylt)) {
      fran = Math.max(fran, skylt.h);
      while (paRad > 1 && fran + paRad * cellW > 100 - margX / 2 + 1e-9) paRad--;
    }
    tomter.push(...rad1(paRad, fran)); // y följer vägens slinger vid tomtens x
    kvar -= paRad;
    // Vägsträckans bas-y (utan slinger) – mest för felsökning/kompatibilitet.
    vagar.push({ rad, y: basY(rad) + radHojd * 0.55, hojd: vagHojd });
  }
  const rader = rad;

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
    klasscenter,
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
  // Seriens TVÅ öppna ändar (första radens start, sista radens slut) fortsätter
  // RAKT UT horisontellt genom sidokanten – i nivå med sin radsträcka, ingen
  // rundning/klättring/loop, aldrig upp i himlen – så det ser ut som vägen
  // fortsätter bortom skärmen i sidled. Utfarterna dras långt förbi kanten (UT)
  // så de lämnar skärmen även när scen-boxen är smalare än det full-bleed:ade
  // staget (#373). Mellanradernas side-U-svängar är oförändrade.
  const UT = 60;
  const delar = [];
  for (let rad = 0; rad < rader; rad++) {
    const ltr = rad % 2 === 0; // vänster→höger på jämna rader
    const forsta = rad === 0;
    const sista = rad === rader - 1;
    // Radens synliga start/slut (U-sväng-punkter, ±4/96); de öppna ändarna får en
    // rak horisontell utlöpare separat nedan.
    const vFrom = ltr ? (forsta ? -4 : 4) : forsta ? 104 : 96;
    const vTo = ltr ? (sista ? 104 : 96) : sista ? -4 : 4;
    const steg = ltr ? 3 : -3;

    if (forsta) {
      // Rak horisontell öppen ände ut genom sidokanten, i nivå med första sträckan.
      const y = vagY(0, vFrom);
      delar.push(`M${f(ltr ? -UT : 100 + UT)} ${f(y)} L${f(vFrom)} ${f(y)}`);
    }
    for (let x = vFrom; ltr ? x < vTo : x > vTo; x += steg) {
      delar.push(`L${f(x)} ${f(vagY(rad, x))}`);
    }
    delar.push(`L${f(vTo)} ${f(vagY(rad, vTo))}`);
    if (sista) {
      // Rak horisontell öppen ände ut genom sidokanten, i nivå med sista sträckan.
      const y = vagY(rad, vTo);
      delar.push(`L${f(ltr ? 100 + UT : -UT)} ${f(y)}`);
    } else {
      // Synlig U-sväng i kanten ner till nästa rads väg (växlar sida).
      const bukt = ltr ? vTo + 9 : vTo - 9;
      delar.push(`C${f(bukt)} ${f(vagY(rad, vTo))} ${f(bukt)} ${f(vagY(rad + 1, vTo))} ${f(vTo)} ${f(vagY(rad + 1, vTo))}`);
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
