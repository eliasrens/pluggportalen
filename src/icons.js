// ============================================================================
// Pluggportalen – små återanvändbara inline-SVG-ikoner
// Just nu: pluggcoin-myntet (variant B "Blixt") som ersätter emojin 🪙 överallt
// coins visas. Varje instans får ett unikt gradient-id så flera mynt på samma
// sida inte krockar.
// ============================================================================

let coinSeq = 0;

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
