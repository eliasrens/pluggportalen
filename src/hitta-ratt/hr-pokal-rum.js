// ============================================================================
// Hitta rätt! – Kartmästare-pokalerna i huset (src/hitta-ratt/hr-pokal-rum.js) · #610
// ----------------------------------------------------------------------------
// Bron mellan hittaRattMeta/ledare och rummen. Laddas bara DYNAMISKT av
// varld-rum.js (eget hus) och pages-klasskamrat.js (kompisens hus, läsläge).
// EN läsning per hus (#231): ledardokumentet, cachat LEDARE_TTL_MS per
// session och delat av alla hus (även kompisars). hr-data.js nollar cachen
// när eleven själv skickat en omgång, så en ny etta ser pokalen direkt.
//
// API
//   hamtaLedare({ farsk })                   → meta-dokumentet eller null (läsfel)
//   invalideraLedare()
//   laddaHusPokaler({ uid, rum, schack })   → null (läsfel – rör inget) eller
//       { pokaler: Map<nyckel, pokal>, rensade: number[] }
//       schack = husägarens studentData.schack: schackets pokaler (#798, t.ex.
//       "Damens besegrare") ritas med samma väg – ingen extra läsning, konsten
//       laddas dynamiskt bara när eleven har en.
//       rum = lista med varje rums placements (muteras: pokaler eleven inte
//       längre har tas bort; rensade = rum-index som ändrats och ska sparas)
//   pokalSakHtml(pokal, { key, x, y, vald })  dragbar rum-sak (eget rum)
//   pokalLasHtml(pokal, { x, y })            läsläge (kompisens rum)
//   pokalLadaHtml(pokal)                     knapp i Möbler-lådan (data-place)
//   POKAL_STORLEK
// ============================================================================

import { db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { rumSakHtml } from "../rum-promenad-golv.js";
import { kartmastareSvg, POKAL_STORLEK } from "./hr-pokal-art.js";
import { minaPokaler, rensaPokaler, schackPokaler } from "./hr-pokal.js";

export { POKAL_STORLEK };

const LEDARE_TTL_MS = 60_000;
let cache = null; // { at, p: Promise<meta|null> }

/** hittaRattMeta/ledare (alla inloggade läser). Läsfel → null, cachas inte. */
export function hamtaLedare({ farsk = false } = {}) {
  const nu = Date.now();
  if (!farsk && cache && nu - cache.at < LEDARE_TTL_MS) return cache.p;
  const p = getDoc(doc(db, "hittaRattMeta", "ledare"))
    .then((s) => (s.exists() ? s.data() : {}))
    .catch(() => {
      if (cache?.p === p) cache = null;
      return null;
    });
  cache = { at: nu, p };
  return p;
}

export function invalideraLedare() {
  cache = null;
}

function ensureStyles() {
  if (typeof document === "undefined" || document.querySelector("link[data-hr-pokal-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./hr-pokal.css", import.meta.url).href;
  link.dataset.hrPokalCss = "1";
  document.head.appendChild(link);
}

/**
 * Elevens pokaler + städning av placeringar som inte längre gäller.
 * @param {{ uid: string, rum?: Array<Record<string, object>> }} o
 */
export async function laddaHusPokaler({ uid, rum = [], schack = null }) {
  ensureStyles();
  const [meta, schackLista] = await Promise.all([hamtaLedare(), laddaSchackPokaler(schack)]);
  if (meta === null) return null; // läsfel: rita inga pokaler men städa inget
  const lista = [...minaPokaler(meta, uid), ...(schackLista || [])];
  const pokaler = new Map(lista.map((p) => [p.nyckel, p]));
  const giltiga = new Set(pokaler.keys());
  // Schackkonsten kunde inte laddas: rita inte schackpokalen nu, men städa inte bort dess plats.
  if (schackLista === null) for (const pl of rum) for (const k of Object.keys(pl || {})) if (k.startsWith("hrpokal-schack-")) giltiga.add(k);
  const rensade = [];
  rum.forEach((pl, i) => {
    if (rensaPokaler(pl, giltiga) > 0) rensade.push(i);
  });
  return { pokaler, rensade };
}

/** Schackets pokaler (#798) med sin ritning – modulerna laddas bara när eleven har en. null = laddningsfel. */
async function laddaSchackPokaler(schack) {
  if (!schack?.pokaler || typeof schack.pokaler !== "object" || !Object.keys(schack.pokaler).length) return [];
  try {
    const [{ SCHACK_POKALER }, { schackPokalSvg }] = await Promise.all([
      import("../schack/schack-mynt-delat.js"), import("../schack/schack-pokal-art.js"),
    ]);
    return schackPokaler(schack, SCHACK_POKALER).map((p) => ({ ...p, ritning: (o) => schackPokalSvg(o) }));
  } catch {
    return null; // laddningsfel – placeringen får stå kvar (se laddaHusPokaler)
  }
}

const ritaPokal = (p, opts) => (p.ritning ? p.ritning(opts) : kartmastareSvg(p, opts));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Skylten under pokalen: syns vid hover och när pokalen är vald (tryck).
const skylt = (p) => `<span class="hr-pokal-skylt" aria-hidden="true">🏆 ${esc(p.namn)}</span>`;

/** Dragbar pokal i elevens eget rum (samma pipeline som möblerna). */
export function pokalSakHtml(p, { key, x, y, vald = false }) {
  const html = rumSakHtml({
    key, x, y, titel: esc(p.namn), w: POKAL_STORLEK.w, h: POKAL_STORLEK.h, vald,
    art: ritaPokal(p, { aria: p.namn }),
  });
  return html.replace('class="room-item', 'class="room-item hr-pokal').replace(/<\/div>\s*$/, `${skylt(p)}</div>`);
}

/** Pokal i kompisens rum (läsläge: inga knappar, samma rem-mått som vyns möbler). */
export function pokalLasHtml(p, { x, y }) {
  return `<div class="room-item readonly hr-pokal" style="left:${x}%;top:${y}%" title="${esc(p.namn)}">
    <span class="ri-emoji" style="width:${POKAL_STORLEK.w}rem;height:${POKAL_STORLEK.h}rem">${ritaPokal(p, { aria: p.namn })}</span>
    ${skylt(p)}
  </div>`;
}

/** Knapp i Möbler-lådan – data-place = pokal-nyckeln (samma klick som möbler). */
export function pokalLadaHtml(p) {
  return `<button class="tray-item hr-pokal-lada" data-place="${esc(p.nyckel)}" title="${esc(p.namn)}">
    <span class="tray-emoji">${ritaPokal(p, { animera: false })}</span>
    <span class="tray-namn">${esc(p.namn)}</span>
  </button>`;
}
