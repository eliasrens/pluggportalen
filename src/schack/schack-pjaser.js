// ============================================================================
// Schackpjäserna (#775, spec §2.1) – egna SVG-bilder i Pluggportens stil
// (src/art-style.js): platt vektor, mjuka rundade former, mörklila kontur
// #3B3350 med runda ändar och hörn, inga gradienter. Vita pjäser är krämvita,
// svarta mörkt skiffergrå med ljusa detaljlinjer. Alla ritas i viewBox
// "0 0 100 100" och står på samma fot (y 76–88), så att de radar upp sig.
//
// Igenkänning i 40 px: varje pjäs har EN tydlig siluett – bonden ett runt
// huvud, tornet tre tinnar, springaren ett hästhuvud åt vänster, löparen en
// mitra med skåra, damen en krona med fem kulor och kungen ett kors.
// Inga unicode-schacktecken i text – de ser olika ut på olika datorer.
// ============================================================================

export const PJAS_TYPER = ["k", "q", "r", "b", "n", "p"];

const KONTUR = "#3B3350";
export const PJAS_FARGER = {
  w: { fyll: "#FFF3DC", skugga: "#EBD9B6", detalj: KONTUR, oga: KONTUR },
  b: { fyll: "#555C6E", skugga: "#454B5B", detalj: "#C9D2E3", oga: "#FFF3DC" },
};

// Foten är gemensam: en bred, rundad platta.
const FOT = `<rect x="22" y="76" width="56" height="12" rx="6"/>`;

// Varje pjäs: kropp (fylld, kontur), "skugga" (platt halvton på ena sidan,
// som i appens övriga konst) och detaljer (linjer i detaljfärgen).
const FORMER = {
  p: {
    kropp: `<path d="M39 52 C39 63 31 69 29 77 L71 77 C69 69 61 63 61 52 Z"/>
      <rect x="35" y="45" width="30" height="8" rx="4"/>
      <circle cx="50" cy="31" r="14"/>${FOT}`,
    skugga: `<path d="M57 54 C58 63 64 69 66 75 L60 75 C58 68 55 62 55 54 Z"/>`,
    detalj: "",
  },
  r: {
    kropp: `<path d="M35 42 L65 42 L63 77 L37 77 Z"/>
      <path d="M27 20 H38 V28 H45 V20 H55 V28 H62 V20 H73 V39 Q73 44 68 44 H32 Q27 44 27 39 Z"/>${FOT}`,
    skugga: `<path d="M58 46 L62 46 L60.5 74 L56.5 74 Z"/>`,
    detalj: `<path d="M38 58 H62"/>`,
  },
  n: {
    // Hästhuvud i profil åt vänster: öra uppe, mule nere till vänster, man längs nacken.
    kropp: `<path d="M34 77 C33 66 38 60 45 55 C39 56 33 59 27 61 C20 63 15 57 18 50
        C22 42 30 35 37 29 L38 16 L46 23 C59 22 70 31 73 45 C76 58 72 69 70 77 Z"/>${FOT}`,
    skugga: `<path d="M63 33 C68 41 70 52 68 62 C67 68 66 72 65 75 L70 75 C72 66 74 56 71 45 C69 39 66 35 63 33 Z"/>`,
    detalj: `<path d="M50 26 C58 30 64 40 63 52 C62 60 59 66 58 72"/>
      <path d="M24 55 L27 53"/>`,
    oga: `<circle cx="41" cy="36" r="3.6"/>`,
  },
  b: {
    kropp: `<path d="M39 70 C39 73 34 75 30 77 L70 77 C66 75 61 73 61 70 Z"/>
      <rect x="34" y="62" width="32" height="8" rx="4"/>
      <path d="M50 21 C63 30 68 43 63 56 Q50 63 37 56 C32 43 37 30 50 21 Z"/>
      <circle cx="50" cy="16" r="5.5"/>${FOT}`,
    skugga: `<path d="M57 30 C62 38 64 46 61 54 L57 56 C59 47 59 38 55 31 Z"/>`,
    detalj: `<path d="M55 33 L45 46"/>`,
  },
  q: {
    kropp: `<path d="M35 77 L29 41 L40 55 L44 35 L50 53 L56 35 L60 55 L71 41 L65 77 Z"/>
      <rect x="32" y="62" width="36" height="8" rx="4"/>
      <circle cx="26" cy="37" r="5"/><circle cx="42" cy="29" r="5"/><circle cx="50" cy="24" r="5.5"/>
      <circle cx="58" cy="29" r="5"/><circle cx="74" cy="37" r="5"/>${FOT}`,
    skugga: `<path d="M61 58 L66 52 L64 60 Z"/>`,
    detalj: `<path d="M38 72 H62"/>`,
  },
  k: {
    kropp: `<path d="M35 77 C33 66 29 57 29 50 C29 41 40 39 50 46 C60 39 71 41 71 50 C71 57 67 66 65 77 Z"/>
      <rect x="32" y="62" width="36" height="8" rx="4"/>
      <path d="M46 11 H54 V19 H61 V27 H54 V41 H46 V27 H39 V19 H46 Z"/>${FOT}`,
    skugga: `<path d="M60 47 C65 46 68 48 68 51 C68 55 66 58 65 60 L61 60 C62 56 63 51 60 47 Z"/>`,
    detalj: `<path d="M50 48 V58"/>`,
  },
};

/**
 * En pjäs som SVG-sträng.
 * @param {"w"|"b"} farg
 * @param {"k"|"q"|"r"|"b"|"n"|"p"} typ
 * @param {{ storlek?: number|string, klass?: string, titel?: string }} [opt]
 *   storlek: px-tal eller CSS-längd (utan = fyller föräldern), titel: tillgänglig text
 *   (utan titel är bilden dekorativ, aria-hidden – rutans aria-label bär texten).
 */
export function pjasSvg(farg, typ, opt = {}) {
  const f = FORMER[typ];
  const c = PJAS_FARGER[farg];
  if (!f || !c) return "";
  const s = opt.storlek == null ? "" : typeof opt.storlek === "number" ? `${opt.storlek}px` : String(opt.storlek);
  const mått = s ? ` width="${s}" height="${s}"` : "";
  const a11y = opt.titel ? ` role="img" aria-label="${opt.titel}"` : ` aria-hidden="true" focusable="false"`;
  const klass = `schack-pjas schack-pjas-${farg}${typ}${opt.klass ? ` ${opt.klass}` : ""}`;
  return (
    `<svg class="${klass}" viewBox="6 6 88 88"${mått}${a11y} xmlns="http://www.w3.org/2000/svg">` +
    `<g fill="${c.fyll}" stroke="${KONTUR}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">${f.kropp}</g>` +
    `<g fill="${c.skugga}" stroke="none">${f.skugga}</g>` +
    (f.detalj ? `<g fill="none" stroke="${c.detalj}" stroke-width="3" stroke-linecap="round">${f.detalj}</g>` : "") +
    (f.oga ? `<g fill="${c.oga}">${f.oga}</g>` : "") +
    `</svg>`
  );
}
