// ============================================================================
// Pluggporten – små återanvändbara inline-SVG-ikoner
// Just nu: pluggcoin-myntet (variant B "Blixt") som ersätter emojin 🪙 överallt
// coins visas, och stjärn-ikonen (samma femuddiga guldstjärna som sitter på
// grind-bågen i inloggningen) som ersätter emojin ⭐ i sidomenyns valuta-rad.
// Varje instans får ett unikt gradient-id så flera ikoner på samma sida inte
// krockar.
// ============================================================================

let coinSeq = 0;
let starSeq = 0;

/**
 * Inline-SVG för ett pluggcoin (guldmynt med blixt). Skalar med angiven storlek.
 *
 * @param {number} size  Kant i px (t.ex. 22 i sidomenyfoten, 24 i shoppen).
 * @returns {string}     HTML-sträng med en fristående <svg>.
 */
export function coinIcon(size = 20) {
  const id = `pc-guld-${++coinSeq}`;
  return `<svg class="coin-svg" width="${size}" height="${size}" viewBox="0 0 24 24"
       role="img" aria-label="Pluggcoin" focusable="false">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe083"/>
      <stop offset="1" stop-color="#f2b93b"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="10.4" fill="url(#${id})" stroke="#c98a12" stroke-width="1.6"/>
  <circle cx="12" cy="12" r="7.7" fill="none" stroke="#e8a92a" stroke-width="1.1"/>
  <path d="M13.5 5.4 L8.4 12.9 L11.3 12.9 L10.5 18.6 L15.6 10.9 L12.5 10.9 Z"
        fill="#fffbe8" stroke="#d9931c" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M6.3 8.2 A7 7 0 0 1 9.6 5.5" fill="none" stroke="#ffffff" stroke-width="1.5"
        stroke-linecap="round" opacity="0.55"/>
</svg>`;
}

/**
 * Inline-SVG för en femuddig guldstjärna – SAMMA form som stjärnan på grind-
 * bågens slutsten i inloggningen (art-port-majestic.js `stjarna(...)`), så
 * varumärkets stjärn-uttryck är enhetligt. Ersätter emojin ⭐ i sidomenyns
 * valuta-rad. Fylld guldgradient + mjuk amber-kontur, matchar coinIcon-stilen.
 *
 * @param {number} size  Kant i px (t.ex. 22 i sidomenyfoten, i par med coinIcon).
 * @returns {string}     HTML-sträng med en fristående <svg>.
 */
export function starIcon(size = 20) {
  const id = `pp-stjarna-${++starSeq}`;
  // Grind-stjärnans path (centrerad kring origo, ~10 enheter bred) skalas ×2.1
  // och centreras i 24×24-rutan så den fyller ikonen som myntet gör.
  return `<svg class="star-svg" width="${size}" height="${size}" viewBox="0 0 24 24"
       role="img" aria-label="Stjärna" focusable="false">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffdf7e"/>
      <stop offset="1" stop-color="#f2a93b"/>
    </linearGradient>
  </defs>
  <path transform="translate(12 12.4) scale(2.15)"
        d="M0 -5 L1.4 -1.5 L5 -1.2 L2.3 1.1 L3.1 4.8 L0 2.8 L-3.1 4.8 L-2.3 1.1 L-5 -1.2 L-1.4 -1.5 Z"
        fill="url(#${id})" stroke="#d9931c" stroke-width="0.7" stroke-linejoin="round"/>
</svg>`;
}
