// ============================================================================
// Trollkarlsduellen (#537): ritdelar för de två trollkarlarna.
// Kropp/mantel/hatt/armar/stav/ben ritas i kod; ANSIKTET är ett friskuret
// WebP-lager från referensbilderna (ref/<who>-<uttryck>.webp) – identiteten
// (Elias guldglasögon+mustasch, Rasmus svarta glasögon+stubb+rufs) kommer
// därifrån och får ALDRIG blandas ihop.
// Figurens koordinatsystem: viewBox 0 0 400 560, fötter vid y≈540, vänd höger.
// Allt här är rena stränghjälpare – ingen DOM.
// ============================================================================

export const VIEW = { w: 400, h: 560 };

// Pivotpunkter (viewBox-koordinater) – används för transform-origin.
export const PIVOT = {
  head: [200, 268],
  armL: [152, 292],
  armR: [248, 292],
  elbowR: [300, 330],
  body: [200, 520],
  cape: [200, 280],
  hat: [200, 70],
  wand: [318, 300],
};

// Effekt-ankare i viewBox-koordinater (vänd höger; spegling hanteras i figur).
export const ANCHOR = {
  wandTip: [352, 182],
  head: [200, 150],
  hat: [200, -90],
  body: [200, 380],
  feet: [200, 540],
};

// Färgtema per trollkarl (§3: Rasmus blå/turkos, Elias lila/guld).
export const THEME = {
  rasmus: {
    robe: "#1d3b7a", robe2: "#15295a", trim: "#2dd4bf", star: "#7ae7d8",
    hat: "#1d3b7a", hatBand: "#2dd4bf", glow: "#4de3ff", wand: "#6b4226",
    skin: "#f2c091", boot: "#2b2b33",
  },
  elias: {
    robe: "#5b21b6", robe2: "#471c8f", trim: "#f0b429", star: "#ffd56b",
    hat: "#5b21b6", hatBand: "#f0b429", glow: "#d9a7ff", wand: "#8a5a26",
    skin: "#f2c091", boot: "#3a2a1c",
  },
};

// Ansiktslagrens placering: bilderna är normaliserade till höjd 380 men
// huvudena sitter lite olika i rutorna – offset per uttryck så ögonlinjen
// hamnar stilla vid uttrycksbyten. [dx, dy, skala]
export const FACE = {
  rasmus: {
    w: 267, happy: [0, 2, 1], angry: [1, 0, 1], sad: [0, 0, 1],
  },
  elias: {
    w: 265, happy: [-5, 6, 1], angry: [2, 0, 1.0], sad: [0, -6, 1],
  },
};

function stars(t, pts) {
  return pts
    .map(([x, y, s]) => `<path class="tkf-star" transform="translate(${x} ${y}) scale(${s})" fill="${t.star}" d="M0 -7 1.8 -1.8 7 0 1.8 1.8 0 7 -1.8 1.8 -7 0 -1.8 -1.8Z"/>`)
    .join("");
}

// Manteln/kroppen: trapetsformad robe med fåll, bälte och detaljer.
export function bodySvg(t, who) {
  const deco = who === "rasmus"
    ? stars(t, [[160, 390, 1.2], [238, 430, 0.9], [185, 470, 1], [228, 350, 0.7]])
    : `<path d="M200 336 v150" stroke="${t.trim}" stroke-width="3" opacity=".7"/>
       <path d="M171 362 h22 M207 362 h22" stroke="${t.trim}" stroke-width="3" stroke-linecap="round"/>
       ${stars(t, [[160, 420, 0.8], [240, 420, 0.8]])}`;
  return `
    <path d="M150 282 Q200 258 250 282 L292 520 Q200 548 108 520 Z" fill="${t.robe}"/>
    <path d="M150 282 Q200 258 250 282 L258 330 Q200 310 142 330 Z" fill="${t.robe2}"/>
    <path d="M108 520 Q200 548 292 520 L288 498 Q200 526 112 498 Z" fill="${t.trim}" opacity=".9"/>
    <path d="M142 332 Q200 314 258 332 l3 16 Q200 330 139 348 Z" fill="${t.trim}" opacity=".55"/>
    ${deco}
    <path d="M150 282 Q200 258 250 282 L247 300 Q200 278 153 300 Z" fill="${t.robe2}"/>`;
}

// Fladdrande mantelkappa bakom kroppen.
export function capeSvg(t) {
  return `<path d="M156 280 Q92 380 104 512 Q150 492 160 500 L186 320 Z" fill="${t.robe2}" opacity=".85"/>
    <path d="M244 280 Q308 380 296 512 Q250 492 240 500 L214 320 Z" fill="${t.robe2}" opacity=".85"/>`;
}

export function legsSvg(t) {
  return `
    <ellipse class="tkf-shadow" cx="200" cy="542" rx="104" ry="14" fill="#000" opacity=".18"/>
    <path d="M168 506 l-4 28 q14 10 34 2 l0 -26 Z" fill="${t.boot}"/>
    <path d="M232 506 l4 28 q-14 10 -34 2 l0 -26 Z" fill="${t.boot}"/>
    <path d="M160 532 q20 12 42 3 M240 532 q-20 12 -42 3" stroke="${t.boot}" stroke-width="8" stroke-linecap="round" fill="none"/>`;
}

// Hals + krage – kodritad övergång mellan rasteransiktet och manteln.
export function neckSvg(t) {
  return `<path d="M178 230 h44 v46 q-22 12 -44 0 Z" fill="${t.skin}"/>
    <path d="M178 252 q22 12 44 0 v10 q-22 12 -44 0 Z" fill="#00000022"/>
    <path d="M146 286 Q200 254 254 286 L246 306 Q200 282 154 306 Z" fill="${t.trim}"/>`;
}

// Mantelkrage/halsduk FRAMFÖR ansiktslagret: hög vid sidorna (döljer tröj-
// rester ur beskärningen), dippar under hakan i mitten så käklinjen syns.
export function collarSvg(t, who) {
  if (who === "elias") {
    // Slätrakad haka + svart skjorta i urklippet: kragen tuckas tätt under hakan.
    return `<g aria-hidden="true">
      <path d="M106 304 L115 243 Q200 257 285 243 L294 304 Q200 338 106 304Z" fill="${t.trim}"/>
      <path d="M115 243 Q200 257 285 243 L282 254 Q200 270 118 254Z" fill="#00000026"/>
    </g>`;
  }
  // Rasmus: skägget flödar ner – kragen får sitta lägre och dippa i mitten.
  return `<g aria-hidden="true">
    <path d="M106 304 L117 248 Q200 290 283 248 L294 304 Q200 338 106 304Z" fill="${t.trim}"/>
    <path d="M117 248 Q200 290 283 248 L280 260 Q200 300 120 260Z" fill="#00000026"/>
  </g>`;
}

// Hatt – i skala med de fotobaserade huvudena (huvudet spänner x≈88–312):
// brättet är BREDARE än huvudet och ligger över hårets ovansida; kullen täcker
// hjässan. Rasmus: sned floppig hatt med knäckt topp så rufset sticker fram
// runtom; Elias: ståtligare, högre och rakare med guldband.
export function hatSvg(t, who) {
  if (who === "rasmus") {
    return `<g transform="translate(200 84) scale(1.3) translate(-200 -84) rotate(-9 200 60)">
      <path d="M124 64 Q146 -20 204 -48 Q218 -54 212 -36 Q202 -6 258 48 Q196 28 124 64Z" fill="${t.hat}"/>
      <path d="M124 64 Q180 36 258 48 Q220 44 186 58 Q150 70 124 64Z" fill="${t.robe2}" opacity=".6"/>
      <circle cx="211" cy="-44" r="9" fill="${t.hatBand}"/>
      <path d="M60 62 Q200 14 340 66 Q346 88 322 90 Q200 44 78 88 Q54 84 60 62Z" fill="${t.hat}"/>
      <path d="M78 88 Q200 44 322 90 Q200 56 78 88Z" fill="${t.robe2}" opacity=".55"/>
      <path d="M130 52 Q200 26 272 46 l-6 16 Q200 44 136 68 Z" fill="${t.hatBand}" opacity=".95"/>
      ${stars(t, [[176, 2, 1.1], [232, 20, 0.7]])}
    </g>`;
  }
  return `<g transform="translate(200 84) scale(1.3) translate(-200 -84) rotate(3 200 60)">
    <path d="M126 66 Q158 -26 200 -52 Q242 -26 274 66 Q200 38 126 66Z" fill="${t.hat}"/>
    <path d="M200 -52 q12 12 7 26 l-14 0 q-5 -14 7 -26Z" fill="${t.hatBand}"/>
    <path d="M52 68 Q200 20 348 70 Q354 94 328 96 Q200 48 72 96 Q46 90 52 68Z" fill="${t.hat}"/>
    <path d="M72 96 Q200 48 328 96 Q200 60 72 96Z" fill="${t.robe2}" opacity=".5"/>
    <path d="M132 56 Q200 32 270 54 l5 16 Q200 50 128 72 Z" fill="${t.hatBand}"/>
    ${stars(t, [[200, -6, 1.2], [166, 24, 0.7], [236, 24, 0.7]])}
  </g>`;
}

// Bakre arm (vänster när figuren är vänd åt höger).
export function armLSvg(t) {
  return `
    <path d="M152 292 Q110 330 104 376" stroke="${t.robe}" stroke-width="34" stroke-linecap="round" fill="none"/>
    <circle cx="103" cy="388" r="17" fill="${t.skin}"/>
    <path d="M86 380 q-6 -16 8 -22" stroke="${t.trim}" stroke-width="5" fill="none" opacity=".8"/>`;
}

// Främre arm med hand + trollstav; underarmen är egen grupp (armbågs-pivot).
export function armRSvg(t) {
  return `
    <path d="M248 292 Q286 304 300 330" stroke="${t.robe}" stroke-width="36" stroke-linecap="round" fill="none"/>
    <g data-part="forearmR">
      <path d="M300 330 Q318 318 322 300" stroke="${t.robe}" stroke-width="32" stroke-linecap="round" fill="none"/>
      <path d="M306 316 q14 -6 18 -18" stroke="${t.trim}" stroke-width="5" fill="none" opacity=".8"/>
      <circle cx="324" cy="294" r="18" fill="${t.skin}"/>
      <g data-part="wand">
        <path d="M312 312 L350 190" stroke="${t.wand}" stroke-width="9" stroke-linecap="round"/>
        <path d="M352 182 l6 10 10 2 -8 8 2 11 -10 -6 -10 6 2 -11 -8 -8 10 -2Z" fill="${t.hatBand}"/>
        <circle class="tkf-glow" cx="352" cy="186" r="24" fill="${t.glow}" opacity="0"/>
        <circle class="tkf-glow2" cx="352" cy="186" r="11" fill="#fff" opacity="0"/>
      </g>
    </g>`;
}
