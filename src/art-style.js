// ============================================================================
// Pluggporten – VISUELL STILGUIDE + delade SVG-byggdelar
// ----------------------------------------------------------------------------
// Detta är den gemensamma stilguiden för ALL handritad SVG-konst i portalen:
// karaktärer (art-characters.js), klädsel (art-wearables.js) och kommande
// möbel-/rums-konst. Följ den så känns allt som samma värld.
//
//  Stil: platt vektor, mjuka rundade former, tydliga mörka konturer,
//  glad harmonisk palett, stora uttrycksfulla ögon, korta gulliga proportioner
//  (stort huvud ≈ halva figuren, liten kropp, små armar/ben).
//
//  PALETT (hex):
//    Kontur (alla linjer)     #3B3350   (mörk plommonlila – aldrig ren svart)
//    Kind-rosa                #FFB1B8
//    Vit                      #FFFFFF   Kräm  #FFF3DC
//    Sol-gul   #F7C948   Orange #F49E4C   Röd-orange #F08A3C
//    Bärnsten  #F2A93B   Brun   #B0805A   Mörkbrun    #8A6242
//    Grön      #6FC66F   Mint   #58C6A9   Ljusmint    #C9F0DC
//    Him-blå   #7FC7E8   Stålblå #A9C2DE  Gråblå      #A8BAD1
//    Marin     #46557A   Lila   #B79BE0   Rosa        #F890B7
//    Röd       #EF6F6C   Mörk detalj (panda m.m.)     #4C4661
//
//  KONTUR: stroke #3B3350, stroke-width 3 (tunna detaljer 2.2),
//  alltid stroke-linecap="round" och stroke-linejoin="round".
//
//  VIEWBOX-KONVENTION: alla karaktärer ritas i viewBox "0 0 100 120"
//  (bredd 100 × höjd 120). Figuren står på "golvet" y≈116. Möbler/rumssaker
//  får egen viewBox efter sakens proportioner men samma kontur och palett.
//
//  GEMENSAMT ANKARGRID (så att klädsel passar ALLA figurer):
//    Huvudets mitt      (50, 36), radie ≈ 22  → hjässan vid y ≈ 14
//    Ögon               y = 34, x = 41 och 59, radie 6   (slot "ansikte")
//    Nos/mun            y ≈ 42–48
//    Hals/krage         y ≈ 58                           (slot "hals")
//    Kropp              y ≈ 58–104, mage centrerad (50, 86)
//    Höger tass/hand    (79, 77)                         (slot "hand")
//    Fötter             y ≈ 106–115
// ============================================================================

export const O = "#3B3350"; // konturfärg
export const LINE = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
export const THIN = `stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;

export const STYLE = {
  viewBox: "0 0 100 120",
  outline: O,
  strokeWidth: 3,
  cheek: "#FFB1B8",
  anchors: {
    head: { cx: 50, cy: 36, r: 22 },
    eyes: { y: 34, dx: 9 },
    neckY: 58,
    hand: { x: 79, y: 77 },
    feetY: 109,
  },
};

// --- Delade kroppsdelar (håller alla figurer på samma ankargrid) ------------

/** Ett stort blankt tecknat öga med pupill och glimt. */
export function eye(x, y, r = 6) {
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${THIN}/>` +
    `<circle cx="${x + 0.8}" cy="${y + 0.9}" r="${(r * 0.55).toFixed(1)}" fill="${O}"/>` +
    `<circle cx="${x + 2.1}" cy="${y - 1}" r="${(r * 0.2).toFixed(1)}" fill="#fff"/>`
  );
}

/** Ögonparet på ankarpositionen. */
export const eyes = (y = 34, dx = 9, r = 6) => eye(50 - dx, y, r) + eye(50 + dx, y, r);

/** Rosiga kinder. */
export function cheeks(y = 43, dx = 18) {
  return (
    `<ellipse cx="${50 - dx}" cy="${y}" rx="4.3" ry="2.8" fill="#FFB1B8" opacity="0.85"/>` +
    `<ellipse cx="${50 + dx}" cy="${y}" rx="4.3" ry="2.8" fill="#FFB1B8" opacity="0.85"/>`
  );
}

/** Enkelt glatt leende. */
export function smile(y = 46, w = 6.5) {
  return `<path d="M ${50 - w} ${y} Q 50 ${y + w} ${50 + w} ${y}" fill="none" ${LINE}/>`;
}

/** Stort öppet skratt med tunga. */
export function laugh(y = 44, w = 8) {
  return (
    `<path d="M ${50 - w} ${y} Q 50 ${y + w * 1.5} ${50 + w} ${y} Z" fill="#7C4A57" ${LINE}/>` +
    `<path d="M ${50 - w * 0.45} ${y + w * 0.55} Q 50 ${y + w * 1.05} ${50 + w * 0.45} ${y + w * 0.55} Z" fill="#FF9AA6" stroke="none"/>`
  );
}

/** Arm/ben/svans som rundad "kapsel": konturpass under + färgpass över. */
export function limb(d, color, w = 8) {
  return (
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 4.5}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`
  );
}

/** Två fötter på golvet (ritas före kroppen så kroppskanten går omlott). */
export function feet(color) {
  return (
    `<ellipse cx="40" cy="109" rx="8" ry="5.2" fill="${color}" ${LINE}/>` +
    `<ellipse cx="60" cy="109" rx="8" ry="5.2" fill="${color}" ${LINE}/>`
  );
}

/** Standardkropp: fötter + rund kropp + mage + två armar (höger mot handankaret). */
export function stdBody(fur, belly, feetColor = fur) {
  return (
    feet(feetColor) +
    `<path d="M35 62 C29 82 29 104 50 104 C71 104 71 82 65 62 Q50 55 35 62 Z" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="50" cy="87" rx="12.5" ry="13.5" fill="${belly}"/>` +
    limb("M37 66 Q29 72 28 80", fur) +
    `<circle cx="28" cy="81" r="5.3" fill="${fur}" ${THIN}/>` +
    limb("M63 66 Q75 68 78 75", fur) +
    `<circle cx="79" cy="77" r="5.3" fill="${fur}" ${THIN}/>`
  );
}

/** Standardhuvud (cirkel) på ankarpositionen. */
export function head(fur, r = 22) {
  return `<circle cx="50" cy="36" r="${r}" fill="${fur}" ${LINE}/>`;
}

/** Spetsigt öra (räv/katt) med innerfärg. dir = -1 vänster, 1 höger. */
export function pointyEar(dir, fur, inner) {
  const x = 50 + dir * 14;
  return (
    `<path d="M ${x - dir * 6} 24 L ${x + dir * 4} 3 L ${x + dir * 12} 20 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M ${x - dir * 1.5} 19 L ${x + dir * 4} 8.5 L ${x + dir * 8} 17 Z" fill="${inner}" stroke="none"/>`
  );
}

/** Runt öra (björn/koala/panda) med innerfärg. */
export function roundEar(dir, fur, inner, r = 8.5) {
  const x = 50 + dir * 15;
  return (
    `<circle cx="${x}" cy="17" r="${r}" fill="${fur}" ${LINE}/>` +
    `<circle cx="${x}" cy="17" r="${(r * 0.55).toFixed(1)}" fill="${inner}" stroke="none"/>`
  );
}

/** Liten nos (oval). */
export function nose(y = 41.5, color = O, rx = 3.2, ry = 2.5) {
  return `<ellipse cx="50" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}" stroke="none"/>`;
}

// --- Rums-/möbelhjälpare (designfacit: design/DESIGNBESLUT-husdjur-hem-2.0.md) --

/** Mjuk kontaktskugga under en sak (kontur-lila, låg opacitet). */
export function shadow(cx, cy, rx) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;
}

/** Liten dekorstjärna (fylld, utan kontur). */
export function stjarna(x, y, s, c) {
  return (
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -5 L1.4 -1.5 L5 -1.2 ` +
    `L2.3 1.1 L3.1 4.8 L0 2.8 L-3.1 4.8 L-2.3 1.1 L-5 -1.2 L-1.4 -1.5 Z" fill="${c}" stroke="none"/>`
  );
}

// --- Säsongspalett (#691, epic #689) ----------------------------------------
// Världens färger som kan bytas per säsong UTAN kopior av konsten: konsten
// ritar sz("namn", sommarfärg) = var(--sz-namn, sommarfärg). Sommar = ingen
// variabel satt = exakt dagens färg. season-world.js sätter variablerna (ur
// SEASONS[...].palette i season-config.js) bara på världen och inloggningen.

/** Säsongsstyrd färg – sommarfärgen är fallbacken. */
export const sz = (namn, sommar) => `var(--sz-${namn},${sommar})`;

/** Lövhög på marken – syns bara på hösten (.sz-bara-host, styles/32-sasong.css). */
export function lovhog(x, y, s = 1) {
  return `<g class="sz-bara-host" transform="translate(${x} ${y}) scale(${s})">
    <path d="M-30 0 Q-26 -14 -10 -16 Q0 -24 12 -16 Q28 -14 30 0 Z" fill="#F28A2E" ${THIN}/>
    <path d="M-18 -9 l5 -5 l3 6 Z M2 -15 l6 -2 l-1 7 Z M14 -6 l6 -4 l1 6 Z" fill="#FFD23F" stroke="none"/>
    <path d="M-6 -4 l4 -6 l4 5 Z M20 -2 l3 -5 l3 5 Z" fill="#F2524A" stroke="none"/></g>`;
}

// --- Vinter (#908, epic #906) ------------------------------------------------
// Snön är ALDRIG helt vit (B.2): som ljusast SNO, highlights SNO_HL, alltid med
// mörk kontur. Allt nedan syns bara på vintern (.sz-bara-vinter).
export const SNO = "#EEF3F8";
export const SNO_HL = "#F7FAFD";
const SNO_SKUGGA = "#D3DEEA";

const f1 = (n) => +n.toFixed(1);

/** Snödriva på marken – lövhögens vinterbror, samma position och storlek. */
export function snodriva(x, y, s = 1) {
  return `<g class="sz-bara-vinter" transform="translate(${x} ${y}) scale(${s})">
    <path d="M-32 0 Q-30 -12 -16 -13 Q-8 -22 4 -17 Q14 -24 24 -13 Q33 -10 32 0 Z" fill="${SNO}" ${THIN}/>
    <path d="M-20 -9 Q-12 -15 -4 -12 M8 -14 Q15 -17 20 -11" fill="none" stroke="${SNO_HL}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-26 -2 Q0 -6 26 -2" fill="none" stroke="${SNO_SKUGGA}" stroke-width="3" stroke-linecap="round"/></g>`;
}

/**
 * Snökappa på en rund trädkrona (cx, cy, r): följer kronans överkant och har en
 * rundad, lite droppande underkant (B.3). `a` = hur långt ner (0–1 av radien).
 */
export function snoKrona(cx, cy, r, a = 0.55) {
  const p = (grad, rr) => {
    const v = (grad * Math.PI) / 180;
    return [cx + rr * Math.cos(v), cy + rr * Math.sin(v)];
  };
  const v0 = -90 - 70 * a - 25;
  const v1 = -90 + 70 * a + 25;
  const [x0, y0] = p(v0, r + 1);
  const [x1, y1] = p(v1, r + 1);
  // Underkanten: punkter innanför kanten, omväxlande djupt (droppar).
  const djup = [0.08, 0.3, 0.16, 0.38, 0.14, 0.3, 0.08];
  const pts = djup.map((d, i) => p(v1 - ((v1 - v0) * i) / (djup.length - 1), r * (1 - d) - r * 0.1));
  let botten = "";
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    botten += ` Q${f1(ax)} ${f1(ay + r * 0.12)} ${f1((ax + bx) / 2)} ${f1((ay + by) / 2 + r * 0.06)}`;
  }
  return `<path class="sz-bara-vinter" d="M${f1(x0)} ${f1(y0)} A${f1(r + 1)} ${f1(r + 1)} 0 0 1 ${f1(x1)} ${f1(y1)}${botten} L${f1(x0)} ${f1(y0)} Z" fill="${SNO}" ${THIN}/>`;
}

/** Snökappa på en grans topp (spetsen x,y; våningens halvbredd hw och höjd h). */
export function snoGran(x, y, hw, h) {
  const k = 0.5;
  const l = [x - hw * k, y + h * k];
  const r = [x + hw * k, y + h * k];
  return `<path class="sz-bara-vinter" d="M${f1(x)} ${f1(y - 1)} L${f1(r[0] + 1)} ${f1(r[1])}
    Q${f1(x + hw * 0.32)} ${f1(r[1] + h * 0.14)} ${f1(x + hw * 0.18)} ${f1(r[1] - h * 0.02)}
    Q${f1(x)} ${f1(r[1] + h * 0.16)} ${f1(x - hw * 0.2)} ${f1(l[1] - h * 0.02)}
    Q${f1(x - hw * 0.34)} ${f1(l[1] + h * 0.12)} ${f1(l[0] - 1)} ${f1(l[1])} Z" fill="${SNO}" ${THIN}/>`;
}

/**
 * Gullig snögubbe (B.3): tre runda snöbollar, kolögon, morotsnäsa, röd
 * halsduk och en liten kvast-arm. Står på (x, y) – y = marken. ~70 hög vid s=1.
 */
export function snogubbe(x, y, s = 1) {
  return `<g class="sz-bara-vinter" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="0" rx="26" ry="5" fill="${O}" opacity="0.1"/>
    <path d="M-17 -40 L-34 -54 M-30 -50 L-36 -50 M17 -40 L33 -52 M29 -49 L34 -56" fill="none" stroke="#8A6242" stroke-width="3" stroke-linecap="round"/>
    <circle cx="0" cy="-16" r="19" fill="${SNO}" ${LINE}/>
    <circle cx="0" cy="-43" r="14" fill="${SNO}" ${LINE}/>
    <circle cx="0" cy="-65" r="11" fill="${SNO}" ${LINE}/>
    <path d="M-9 -20 Q-4 -30 6 -28" fill="none" stroke="${SNO_HL}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-12 -55 Q0 -50 12 -55 L12 -51 Q0 -46 -12 -51 Z" fill="#C9474F" ${THIN}/>
    <path d="M6 -52 L10 -38 L3 -38 L1 -51 Z" fill="#C9474F" ${THIN}/>
    <circle cx="-4" cy="-68" r="1.9" fill="${O}"/><circle cx="4" cy="-68" r="1.9" fill="${O}"/>
    <path d="M0 -64 L11 -62 L0 -61 Z" fill="#F2A23A" ${THIN}/>
    <path d="M-4 -59 Q0 -57 4 -59" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>
    <ellipse cx="-7" cy="-62" rx="2" ry="1.2" fill="#FFB1B8"/><ellipse cx="7" cy="-62" rx="2" ry="1.2" fill="#FFB1B8"/>
    <circle cx="0" cy="-44" r="1.8" fill="${O}"/><circle cx="0" cy="-36" r="1.8" fill="${O}"/>
    <path d="M-10 -74 L10 -74 L8 -84 L-8 -84 Z M-14 -74 L14 -74" fill="#46557A" ${THIN}/></g>`;
}

// nyckel → { nr, svg (data-URL), ruta, bild?: {url, x, y, w, h} } – en post per konst + ruta.
const snoBilder = new Map();
const snoPoster = []; // nr - 1 → post
/** Bitmappens upplösning (px per konstenhet) – skarp även när kameran zoomar in. */
const SNO_UPPL = 1.25;

/**
 * Snötäcke på ALLT som vänder sig uppåt i `markup` (tak, skorstenar, krön …) –
 * generiskt, så varje husskal (även Halloween-husen, de legendariska och
 * framtida hus) och laggården får ett täcke utan egen ritning per takform.
 * En stillastående kopia av konsten (utan rök) går genom ett SVG-filter:
 *   band    = silhuetten minus silhuetten flyttad `t` nedåt (överkanterna)
 *   droppar = bandet lite längre ner i "pelare" ur brus → droppande underkant
 *   rundas (blur + tröskel), mörk kontur (dilate), ljusare highlight upptill.
 * Filtret körs INTE i scenen: det ligger i en egen liten SVG (data-URL) som på
 * vintern rastreras EN gång per husskal till en beskuren PNG (snoBitmap) och
 * ritas som <image>. Ett levande filter kördes om varje bildruta så fort något
 * i samma SVG rörde sig (byn ~14 fps), och en SVG-bild rastrerades om vid
 * varje kamerazoom (~1 s frys) – en bitmapp skalas gratis.
 * Ritas ovanpå konsten; `ruta` = ytan i konstens koordinater.
 */
export function snoTak(markup, { x = 0, y = 0, w = 960, h = 600, t = 22 } = {}) {
  const nyckel = `${x},${y},${w},${h},${t}|${markup}`;
  let post = snoBilder.get(nyckel);
  if (!post) {
    // Bilden är ett eget dokument: inga klasser/roller behövs, id:n (clipPath
    // i konsten) får vara kvar. var(--hus-*) saknas där → svart fyllning,
    // men filtret läser bara silhuetten (alfa).
    const kopia = markup
      .replace(/<g class="hus-rok[^"]*">[\s\S]*?<\/g>/g, "")
      .replace(/\s(?:class|role|tabindex|aria-[a-z]+)="[^"]*"/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">
    <filter id="f" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB">
      <feOffset in="SourceAlpha" dy="${t}" result="ned"/>
      <feComposite in="SourceAlpha" in2="ned" operator="out" result="band"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.0001" numOctaves="1" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 12 0 0 0 -6.4" result="pelare"/>
      <feOffset in="band" dy="${t * 0.55}" result="bandNed"/>
      <feComposite in="bandNed" in2="pelare" operator="in"/>
      <feComposite in2="SourceAlpha" operator="in" result="droppar"/>
      <feMerge><feMergeNode in="band"/><feMergeNode in="droppar"/></feMerge>
      <feGaussianBlur stdDeviation="${(t * 0.16).toFixed(1)}"/>
      <feComponentTransfer result="sno"><feFuncA type="linear" slope="5" intercept="-2"/></feComponentTransfer>
      <feMorphology in="sno" operator="dilate" radius="3" result="kantA"/>
      <feFlood flood-color="${O}"/><feComposite in2="kantA" operator="in" result="kant"/>
      <feFlood flood-color="${SNO}"/><feComposite in2="sno" operator="in" result="vit"/>
      <feMorphology in="sno" operator="erode" radius="4" result="inre"/>
      <feOffset in="inre" dy="${(t * 0.3).toFixed(1)}" result="inreNed"/>
      <feComposite in="inre" in2="inreNed" operator="out" result="hlA"/>
      <feFlood flood-color="${SNO_HL}"/><feComposite in2="hlA" operator="in" result="hl"/>
      <feMerge><feMergeNode in="kant"/><feMergeNode in="vit"/><feMergeNode in="hl"/></feMerge>
    </filter>
    <g filter="url(#f)">${kopia}</g></svg>`;
    post = {
      nr: snoBilder.size + 1,
      svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, " "))}`,
      ruta: { x, y, w, h },
      bild: null,
    };
    snoBilder.set(nyckel, post);
    snoPoster.push(post);
  }
  // Bitmappen görs bara när vintern faktiskt syns (resten av året ritas
  // <image> aldrig – .sz-bara-vinter är display:none). Slås vintern på efteråt
  // gör season-world.js det via rastreraSnoTak().
  if (typeof document !== "undefined" && document.documentElement.dataset.sasong === "vinter") starta(post);
  const b = post.bild || { url: post.svg, ...post.ruta };
  return `<image class="sz-bara-vinter" data-sno="${post.nr}" href="${b.url}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"
    preserveAspectRatio="none" aria-hidden="true" pointer-events="none"/>`;
}

function starta(post) {
  if (!post.bild && !post.jobb) post.jobb = snoBitmap(post).catch(() => null);
}

/** Vintern slogs på: gör bitmappar av alla snötäcken som redan är ritade. */
export function rastreraSnoTak() {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll("image[data-sno]")) {
    const post = snoPoster[Number(el.dataset.sno) - 1];
    if (post) starta(post);
  }
}

/**
 * Rastrera snöbilden en gång: SVG:n (med filtret) → canvas → beskuren till
 * snöns yta → PNG (blob-URL). Alla redan ritade <image data-sno> med samma
 * nummer byter till bitmappen. Misslyckas något står SVG-bilden kvar.
 */
async function snoBitmap(post) {
  const { x, y, w, h } = post.ruta;
  const bild = new Image();
  bild.src = post.svg;
  await bild.decode();
  const cw = Math.round(w * SNO_UPPL);
  const ch = Math.round(h * SNO_UPPL);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d");
  ctx.drawImage(bild, 0, 0, cw, ch);
  const { data } = ctx.getImageData(0, 0, cw, ch);
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let py = 0; py < ch; py++) {
    for (let px = 0; px < cw; px++) {
      if (data[(py * cw + px) * 4 + 3]) {
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        y1 = py;
      }
    }
  }
  if (x1 < 0) return null; // ingen snö alls (inget vänder sig uppåt)
  const ut = document.createElement("canvas");
  ut.width = x1 - x0 + 1;
  ut.height = y1 - y0 + 1;
  ut.getContext("2d").drawImage(c, x0, y0, ut.width, ut.height, 0, 0, ut.width, ut.height);
  const blob = await new Promise((r) => ut.toBlob(r, "image/png"));
  if (!blob) return null;
  const f = (n) => +n.toFixed(2);
  post.bild = {
    url: URL.createObjectURL(blob),
    x: f(x + x0 / SNO_UPPL), y: f(y + y0 / SNO_UPPL), w: f(ut.width / SNO_UPPL), h: f(ut.height / SNO_UPPL),
  };
  for (const el of document.querySelectorAll(`image[data-sno="${post.nr}"]`)) {
    el.setAttribute("href", post.bild.url);
    for (const k of ["x", "y"]) el.setAttribute(k, post.bild[k]);
    el.setAttribute("width", post.bild.w);
    el.setAttribute("height", post.bild.h);
  }
  return post.bild;
}

/** Liten glad pumpa – syns bara under Halloween (.sz-bara-halloween). */
export function pumpaDekor(x, y, s = 1) {
  return `<g class="sz-bara-halloween" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="-13" rx="18" ry="13" fill="#F49E4C" ${LINE}/>
    <path d="M-6 -25 Q0 -13 -6 -1 M6 -25 Q0 -13 6 -1" fill="none" ${THIN}/>
    <path d="M0 -25 q1 -7 6 -8" fill="none" stroke="#6FA85B" stroke-width="4" stroke-linecap="round"/>
    <path d="M-9 -16 l3 -4 l3 4 Z M3 -16 l3 -4 l3 4 Z" fill="${O}"/>
    <path d="M-7 -9 Q0 -4 7 -9" fill="none" ${THIN}/></g>`;
}
