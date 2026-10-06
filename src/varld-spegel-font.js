// ============================================================================
// Pluggporten – inbäddad webbfont för världsspeglingen (#416, F2 i epic #396)
// ----------------------------------------------------------------------------
// En spegel (varld-spegel.js) rastreras som SVG-som-bild, och en sådan bild får
// INTE ladda externa resurser (ingen font, ingen bild). För att skyltarnas och
// namnpillrens Baloo 2-text ska se EXAKT ut som DOM:en bäddas fonten in som
// data-URL-@font-face, EN gång per sidladdning (cache i minnet).
//
// Baloo 2 är en variabel font: Google serverar samma woff2 för vikterna 400–800
// inom ett subset. Vi tar subseten latin + latin-ext (å/ä/ö ligger i latin),
// dedupar per fil och slår ihop vikterna till ett intervall "400 800".
//
// Laddas bara via import() (aldrig i bootgrafen). Fel (offline, blockerat
// skolnät) → tom sträng: texten ritas då med systemfonten i stället för att
// speglingen misslyckas.
// ============================================================================

/** Samma CSS-URL som index.html länkar → webbläsarens HTTP-cache träffar. */
export const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&display=swap";

const SUBSET = ["latin", "latin-ext"];
let cache = null;

/** ArrayBuffer → base64 (i bitar så String.fromCharCode inte spränger stacken). */
function base64(buf) {
  const u8 = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * Plocka ut @font-face-blocken för våra subset ur Googles CSS.
 * @param {string} css
 * @returns {Array<{url:string, vikt:number, range:string}>}
 */
export function tolkaFontCss(css) {
  const ut = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!SUBSET.includes(m[1])) continue;
    const kropp = m[2];
    const url = /url\((['"]?)([^)'"]+)\1\)/.exec(kropp)?.[2];
    const vikt = Number(/font-weight:\s*(\d+)/.exec(kropp)?.[1] || 400);
    const range = /unicode-range:\s*([^;]+);/.exec(kropp)?.[1]?.trim() || "";
    if (url) ut.push({ url, vikt, range });
  }
  return ut;
}

async function hamta() {
  const css = await (await fetch(FONT_CSS_URL)).text();
  const block = tolkaFontCss(css);
  // En fil per subset (variabel font) – samla vikterna per URL.
  const perUrl = new Map();
  for (const b of block) {
    const f = perUrl.get(b.url) || { url: b.url, min: b.vikt, max: b.vikt, range: b.range };
    f.min = Math.min(f.min, b.vikt);
    f.max = Math.max(f.max, b.vikt);
    perUrl.set(b.url, f);
  }
  const delar = await Promise.all(
    [...perUrl.values()].map(async (f) => {
      const svar = await fetch(f.url);
      if (!svar.ok) throw new Error(`font ${svar.status}`);
      const data = base64(await svar.arrayBuffer());
      const vikt = f.min === f.max ? `${f.min}` : `${f.min} ${f.max}`;
      return `@font-face{font-family:'Baloo 2';font-style:normal;font-weight:${vikt};` +
        `src:url(data:font/woff2;base64,${data}) format('woff2');` +
        (f.range ? `unicode-range:${f.range};` : "") + "}";
    })
  );
  return delar.join("");
}

/**
 * @font-face-CSS med Baloo 2 som data-URL (latin + latin-ext, 400–800).
 * Hämtas en gång; tom sträng om det inte gick.
 * @returns {Promise<string>}
 */
export function inbaddadFontCss() {
  if (!cache) {
    cache = hamta().catch((e) => {
      console.warn("[spegel] Baloo 2 kunde inte bäddas in – systemfont används", e);
      cache = null; // försök igen nästa gång (t.ex. när nätet är tillbaka)
      return "";
    });
  }
  return cache;
}
