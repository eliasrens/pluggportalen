// ============================================================================
// Trollkarlsduellen (#538): FÖRVANDLINGSFIGURER – groda, höna och potatis som
// SVG-strängar för wizard.transform() (figurens viewBox 400 × 560, fötter vid
// y≈540). Identiteten följer med (§8): Rasmus = svarta glasögon + skäggstubb,
// Elias = guldglasögon + mustasch, och båda behåller sin lilla trollkarlshatt
// i klassens färger (THEME). Rena stränghjälpare – ingen DOM.
// ============================================================================

import { THEME } from "../trollkarl-delar.js";

// Kännetecken centrerade kring ögonlinjen (0,0); skala via transform utifrån.
function drag(who) {
  if (who === "elias") {
    return `
      <g stroke="#b8860b" stroke-width="5" fill="none">
        <circle cx="-26" cy="0" r="20"/><circle cx="26" cy="0" r="20"/><path d="M-6 0 H6"/>
      </g>
      <path d="M-26 34 Q0 22 26 34 Q14 40 0 37 Q-14 40 -26 34Z" fill="#4a3320"/>`;
  }
  return `
    <g stroke="#1c1c22" stroke-width="6" fill="none">
      <circle cx="-26" cy="0" r="21"/><circle cx="26" cy="0" r="21"/><path d="M-5 0 H5"/>
    </g>
    <g fill="#6b4f33" opacity=".85">
      <circle cx="-30" cy="34" r="3"/><circle cx="-16" cy="40" r="3"/><circle cx="0" cy="43" r="3"/>
      <circle cx="16" cy="40" r="3"/><circle cx="30" cy="34" r="3"/>
    </g>`;
}

function hatt(who, x, y, k = 1) {
  const t = THEME[who] || THEME.rasmus;
  return `<g transform="translate(${x} ${y}) scale(${k}) rotate(-12)">
    <path d="M-52 30 Q0 18 52 30 L58 40 Q0 54 -58 40Z" fill="${t.hat}"/>
    <path d="M-30 32 Q0 -58 30 32 Q0 40 -30 32Z" fill="${t.hat}"/>
    <path d="M-30 32 Q0 22 30 32 L30 20 Q0 12 -30 20Z" fill="${t.hatBand}"/>
  </g>`;
}

const oga = (x, y, r = 12) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x}" cy="${y + 2}" r="${r * 0.45}" fill="#1c1c22"/>`;

/** Groda med trollkarlens kännetecken (GRODIFIX!). data-del="kropp" kan animeras. */
export function grodaSvg(who) {
  return `<g data-del="kropp">
    <ellipse cx="200" cy="528" rx="96" ry="14" fill="rgba(0,0,0,.18)"/>
    <path d="M118 530 Q96 530 100 514 Q110 500 132 512Z" fill="#3f9b3f"/>
    <path d="M282 530 Q304 530 300 514 Q290 500 268 512Z" fill="#3f9b3f"/>
    <path d="M200 380 Q296 384 300 470 Q300 528 200 530 Q100 528 100 470 Q104 384 200 380Z" fill="#53b853"/>
    <path d="M200 448 Q262 450 264 500 Q262 526 200 528 Q138 526 136 500 Q138 450 200 448Z" fill="#b6e8a4"/>
    <circle cx="156" cy="384" r="30" fill="#53b853"/>
    <circle cx="244" cy="384" r="30" fill="#53b853"/>
    ${oga(156, 380)}${oga(244, 380)}
    <path d="M150 436 Q200 462 250 436" stroke="#246b24" stroke-width="7" fill="none" stroke-linecap="round"/>
    <g transform="translate(200 408) scale(1.05)">${drag(who)}</g>
    ${hatt(who, 200, 344, 0.9)}
  </g>`;
}

/** Panikhöna (HÖNUS PANIKUS!). data-del="vingar" flaxas separat. */
export function honaSvg(who) {
  return `<g data-del="kropp">
    <ellipse cx="200" cy="532" rx="80" ry="12" fill="rgba(0,0,0,.18)"/>
    <g stroke="#e8a93c" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M180 500 L176 532 M176 532 L164 540 M176 532 L188 540"/>
      <path d="M222 500 L226 532 M226 532 L214 540 M226 532 L238 540"/>
    </g>
    <path d="M200 356 Q288 372 286 452 Q284 512 200 514 Q116 512 114 452 Q112 372 200 356Z" fill="#f6efe2"/>
    <path d="M118 430 Q84 436 92 470 Q118 486 140 466Z" fill="#efe3cc"/>
    <g data-del="vingar">
      <path d="M136 430 Q96 420 92 456 Q116 478 148 460Z" fill="#e7d9bd"/>
      <path d="M264 430 Q304 420 308 456 Q284 478 252 460Z" fill="#e7d9bd"/>
    </g>
    <path d="M186 348 Q200 326 214 348 Q208 340 200 342 Q192 340 186 348Z" fill="#d94f4f"/>
    <path d="M196 352 Q174 344 178 330 Q192 330 200 344Z" fill="#d94f4f"/>
    ${oga(172, 392, 13)}${oga(228, 392, 13)}
    <path d="M186 418 L214 426 L186 434Z" fill="#f0a830"/>
    <path d="M214 426 Q226 430 214 436" stroke="#c77f1b" stroke-width="4" fill="none"/>
    <g transform="translate(200 396) scale(.95)">${drag(who)}</g>
    ${hatt(who, 200, 330, 0.75)}
  </g>`;
}

/** Stor uppgiven potatis med ansikte (POTATUS TOTALUS!). data-del="tar" = tår. */
export function potatisSvg(who) {
  return `<g data-del="kropp">
    <ellipse cx="200" cy="534" rx="118" ry="14" fill="rgba(0,0,0,.18)"/>
    <path d="M200 300 Q320 306 326 430 Q330 530 200 536 Q70 530 74 430 Q80 306 200 300Z" fill="#c69a5f"/>
    <path d="M200 316 Q302 322 308 428 Q310 514 206 522 Q150 518 128 488 Q180 470 186 408 Q190 352 200 316Z" fill="#d7ad72" opacity=".8"/>
    <g fill="#8a6437" opacity=".55">
      <ellipse cx="136" cy="366" rx="9" ry="6"/><ellipse cx="282" cy="386" rx="10" ry="7"/>
      <ellipse cx="118" cy="470" rx="8" ry="6"/><ellipse cx="268" cy="492" rx="9" ry="6"/>
    </g>
    ${oga(164, 398, 14)}${oga(236, 398, 14)}
    <path d="M160 382 Q170 374 182 380 M218 380 Q230 374 240 382" stroke="#6b4b26" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M170 468 Q200 452 230 468" stroke="#6b4b26" stroke-width="7" fill="none" stroke-linecap="round"/>
    <g data-del="tar"><path d="M172 420 Q168 436 176 448" stroke="#7fb6e8" stroke-width="6" fill="none" stroke-linecap="round" opacity="0"/></g>
    <g transform="translate(200 414) scale(1.1)">${drag(who)}</g>
    ${hatt(who, 200, 284, 1)}
  </g>`;
}
