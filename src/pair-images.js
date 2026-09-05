// ============================================================================
// Pluggportalen – pair-images.js
// ----------------------------------------------------------------------------
// Inbyggt BILDPAKET för fakta-paren. Ett par kan valfritt ha en bild på term-
// och/eller definition-sidan (fälten termImage / defImage i datamodellen), och
// bilden anges som en NYCKEL in i det här paketet. Bilderna renderas i
// Para ihop och Memory.
//
// Första paketet: RIKSDAGENS 8 PARTIER (för DEMOKRATI-momentet, SO åk 4).
// Varje "bricka" är en egentecknad SVG – partibokstaven/-erna centrerat på
// partiets färg. Detta är INTE riktiga logotyper, utan tydliga, läsvänliga
// symboler med hög kontrast, gjorda för åk 4.
//
//   resolvePairImage(key) -> { markup, alt }  |  null (okänd nyckel)
//   listPairImageKeys()   -> [{ key, name }]  (för lärardokumentation/seed)
//   isKnownPairImage(key) -> boolean
//
// NYCKELFORMAT: "partier/<bokstav>"  (t.ex. "partier/s", "partier/sd", "partier/kd")
// ============================================================================

/**
 * Partidefinitioner. Färgerna är TYDLIGA, rimliga val – inte de officiella
 * logotyperna. Blå-partierna (M, KD, L) hålls isär med olika blå-nyanser,
 * de röda (S, V) och gröna (C, MP) likaså.
 *   letters : texten på brickan (1–2 bokstäver)
 *   name    : partinamnet (används som alt-text: "<name>s partisymbol")
 *   bg      : brickans färg
 *   fg      : bokstävernas färg (hög kontrast mot bg – WCAG AA för stor text)
 *   ring    : valfri kantfärg (SD: gul ram runt mörkblå botten för sin look)
 */
const PARTIER = [
  { id: "s", letters: "S", name: "Socialdemokraterna", bg: "#D72638", fg: "#FFFFFF" },
  { id: "m", letters: "M", name: "Moderaterna", bg: "#0A2A66", fg: "#FFFFFF" },
  { id: "sd", letters: "SD", name: "Sverigedemokraterna", bg: "#003876", fg: "#F3C700", ring: "#F3C700" },
  { id: "c", letters: "C", name: "Centerpartiet", bg: "#009933", fg: "#FFFFFF" },
  { id: "v", letters: "V", name: "Vänsterpartiet", bg: "#A11526", fg: "#FFFFFF" },
  { id: "kd", letters: "KD", name: "Kristdemokraterna", bg: "#2C5FA8", fg: "#FFFFFF" },
  { id: "l", letters: "L", name: "Liberalerna", bg: "#38B6E8", fg: "#0A2A66" },
  { id: "mp", letters: "MP", name: "Miljöpartiet", bg: "#6DAE2C", fg: "#123A15" },
];

const PREFIX = "partier";

// Snabb uppslagning: normaliserad nyckel -> partidefinition.
const BY_KEY = new Map(PARTIER.map((p) => [`${PREFIX}/${p.id}`, p]));

/** Normalisera en nyckel: gemener + trimma. Tål t.ex. "Partier/S". */
function normKey(key) {
  return String(key == null ? "" : key).trim().toLowerCase();
}

/**
 * Bygg SVG-brickan för ett parti. All indata kommer HÄRIFRÅN (egen kod) –
 * ingen lärar-inmatning stoppas in i SVG:n, så den är betrodd markup.
 */
function buildTile(p) {
  // Mindre text när det är två bokstäver, så allt får plats i brickan.
  const fontSize = p.letters.length >= 2 ? 42 : 60;
  const ring = p.ring
    ? `<rect x="6" y="6" width="88" height="88" rx="22" ry="22" fill="none" stroke="${p.ring}" stroke-width="6"/>`
    : "";
  return (
    `<svg class="pair-img-svg" viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">` +
    `<rect x="3" y="3" width="94" height="94" rx="24" ry="24" fill="${p.bg}"/>` +
    ring +
    `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Baloo 2', 'Segoe UI', system-ui, sans-serif" ` +
    `font-size="${fontSize}" font-weight="800" fill="${p.fg}">${p.letters}</text>` +
    `</svg>`
  );
}

/**
 * Slå upp en bildnyckel.
 * @param {string} key T.ex. "partier/s".
 * @returns {{ markup: string, alt: string } | null} null om nyckeln är okänd.
 */
export function resolvePairImage(key) {
  const p = BY_KEY.get(normKey(key));
  if (!p) return null;
  return { markup: buildTile(p), alt: `${p.name}s partisymbol` };
}

/** True om nyckeln finns i paketet (för validering). */
export function isKnownPairImage(key) {
  return BY_KEY.has(normKey(key));
}

/**
 * Alla tillgängliga nycklar med partinamn – så nästa sub-issue (lärarinmatning
 * + seed) kan dokumentera dem för läraren.
 * @returns {{ key: string, name: string }[]}
 */
export function listPairImageKeys() {
  return PARTIER.map((p) => ({ key: `${PREFIX}/${p.id}`, name: p.name }));
}
