// ============================================================================
// Pluggporten – spegelns utdata: bilder, font, hash, granskning (#416, F2/#396)
// ----------------------------------------------------------------------------
// Sista steget i varld-spegel.js: den synkrona DOM-genomgången lämnar
// platshållare för bilder; här hämtas de som data-URL:er (en gång per URL),
// XML-kommentarer rensas, Baloo 2 bäddas in om spegeln har text och
// rot-<svg>:en sätts ihop. <img> skalas ned till visad storlek (#422). Plus innehållshashen (`nyckel`) och en granskning
// (foreignObject/externa URL:er) för tester och preview.
// Laddas bara via import() (aldrig i bootgrafen).
// ============================================================================

import { esc } from "./varld-spegel-html.js";
import { inbaddadFontCss } from "./varld-spegel-font.js";

const SVGNS = "http://www.w3.org/2000/svg";

const bildCache = new Map();
/** Nedskalade bredder avrundas UPPÅT till en √2-trappa (16, 23, 32, 45, 64 …) →
 *  cache-träffar trots djurens andning/gupp (några % skala) och få varianter. */
export const trappsteg = (px) => Math.ceil(2 ** (Math.ceil(Math.log2(Math.max(px, 16)) * 2) / 2));

const lasData = (blob) => new Promise((ok, fel) => {
  const fr = new FileReader();
  fr.onload = () => ok(fr.result);
  fr.onerror = () => fel(fr.error);
  fr.readAsDataURL(blob);
});

/** URL → data-URL i full upplösning (en gång per URL). Fel → "" (utelämnas hellre än extern URL). */
function dataUrl(url) {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let p = bildCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(lasData)
      .catch((e) => { bildCache.delete(url); console.warn("[spegel] bild utelämnad", url, e); return ""; });
    bildCache.set(url, p);
  }
  return p;
}

/**
 * Bilden som data-URL i (högst) `bredd` px bredd (#422): spritedjurens PNG-delar
 * (300–900 px, 150–700 kB) visas i ~20–45 px men bäddades in i full upplösning
 * → 4,6 MB rum-spegel, ~200 ms (varm) – 1,3 s (kall) att avkoda. Nedskalat:
 * ~0,3 MB, ~30 ms. Avkodningen av originalet sker UTANFÖR main-tråden
 * (createImageBitmap(blob)); drawImage direkt från <img> avkodade synkront på
 * main (60–200 ms per bild i desk), och resizeQuality "high" i
 * createImageBitmap var långsammare. Skalas aldrig upp; cache per URL + trappsteg.
 * @param {{url:string, bredd?:number, img?:HTMLImageElement}} b
 */
export function bildData({ url, bredd, img }) {
  const nw = img?.naturalWidth || 0, nh = img?.naturalHeight || 0;
  const w = bredd ? trappsteg(bredd) : 0;
  if (!w || !nw || !nh || w >= nw || url.startsWith("data:") || typeof createImageBitmap === "undefined") return dataUrl(url);
  const nyckel = `${url}|${w}`;
  let p = bildCache.get(nyckel);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => createImageBitmap(blob))
      .then((bmp) => {
        const duk = document.createElement("canvas");
        duk.width = w;
        duk.height = Math.max(1, Math.round((w * nh) / nw));
        const ctx = duk.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, duk.width, duk.height);
        bmp.close();
        return duk.toDataURL("image/png");
      })
      .catch(() => { bildCache.delete(nyckel); return dataUrl(url); });
    bildCache.set(nyckel, p);
  }
  return p;
}

/**
 * Sätt ihop den färdiga spegeln.
 * @param {string} kropp  markup från genomgången (med __pps_bild_N__-platshållare)
 * @param {{bilder:{url:string,bredd?:number,img?:HTMLImageElement}[], defsMarkup:() => string}} ktx
 * @param {string} rotAttr  width/height/viewBox för rot-<svg>:en
 */
export async function slutfor(kropp, ktx, rotAttr) {
  const urls = await Promise.all(ktx.bilder.map(bildData));
  kropp = kropp
    .replace(/__pps_bild_(\d+)__/g, (_, i) => esc(urls[+i]))
    .replace(/<!--[\s\S]*?-->/g, ""); // regel 7: "--" i kommentarer = ogiltig XML (#389)
  const font = kropp.includes("<text") ? await inbaddadFontCss() : "";
  return `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" ${rotAttr}>` +
    `<defs>${font ? `<style>${font}</style>` : ""}${ktx.defsMarkup()}</defs>${kropp}</svg>`;
}

/** cyrb53 – snabb 53-bitars innehållshash (hex) för cache-nyckeln. */
export function hash(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** Kontroll för tester/preview: antal foreignObject och externa URL:er i en spegel. */
export function granska(svg) {
  return {
    fo: (svg.match(/<foreignObject/gi) || []).length,
    externa: (svg.match(/(?:href\s*=\s*["']|url\(\s*["']?)(?:https?:|\/\/|blob:)/gi) || []).length,
  };
}
