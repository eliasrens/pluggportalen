// ============================================================================
// Guldrushen (#591): KISTORNAS IKONER som SVG där emojin inte går att lita på.
// "✖️2" (Dubbla) blir ett ensamt "X 2" på många datorer (✖️ ritas som text-
// tecken i stället för emoji) – här ritas det som en egen guldbricka med ×2.
// Mynt-markören ({mynt}, #590) byts samtidigt mot coinIcon() (src/icons.js).
// Kistkonfigen (delat/chests-config.js) behåller "✖️2" som text – servern
// läser den aldrig, och UI:t går alltid via withGrIcons.
//
// API
//   X2_MARK                "✖️2" – texten som byts (även utan FE0F: "✖2")
//   x2Icon(size? = "1em")  → inline-SVG (guldbricka med ×2)
//   withGrIcons(html, size?) → (redan escapad) HTML med {mynt} och ✖️2 som SVG
// ============================================================================

import { withCoinIcon } from "../../../icons.js";

export const X2_MARK = "✖️2";
const X2_RE = /✖️?2/g;

export function x2Icon(size = "1em") {
  return `<svg class="gr-x2" width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="gånger 2" focusable="false" style="vertical-align:-0.14em">
  <rect x="1" y="3" width="22" height="18" rx="5" fill="#ffcf3a" stroke="#a86f00" stroke-width="1.6"/>
  <path d="M4.6 8.2l5.2 7.6M9.8 8.2l-5.2 7.6" stroke="#5a3200" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M13.2 9.6c.3-1.5 1.6-2.3 3-2.3 1.7 0 3 1.1 3 2.6 0 1.2-.7 2-1.8 3l-4.2 3.6h6.2" fill="none" stroke="#5a3200" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

export function withGrIcons(html, size = "1em") {
  return withCoinIcon(String(html ?? "").replace(X2_RE, () => x2Icon(size)), size);
}
