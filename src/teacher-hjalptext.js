// ============================================================================
// Pluggporten – lärarsidan: hopfällbara hjälptexter (teacher-hjalptext.js, #808)
// ----------------------------------------------------------------------------
// Epic #802 DEL 8. Varje flik i Mina klasser och varje underflik i Material har en
// kort hjälptext (1–2 meningar) överst. hjalpRuta(nyckel, html, ctx) ritar den som en
// ruta man kan fälla ihop; valet ("hopfälld") sparas per ruta i localStorage
// (`pp:larare:hjalp:<nyckel>`). Sidan fungerar utan lagring (privat läge, blockerad
// lagring): allt ligger i try/catch och rutan är då öppen som standard.
// Länkarna i texten är vanliga `<a data-hash>` och kopplas med wireHashLinks. Texterna
// ligger bredvid sina flikar (MINA_FLIKAR, MATERIAL_FLIKAR) så att test/lararsida-hjalp.test.js
// kan kontrollera att varje länk pekar på en riktig route och flik.
// Laddas med import() ur de lata sidorna – aldrig i bootgrafen (#271).
// ============================================================================

import { el, icon, wireHashLinks } from "./teacher-shared.js";

export const HJALP_PREFIX = "pp:larare:hjalp:";

/** Lagringen om den går att använda, annars null. */
function lager() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

/** Är rutan hopfälld? Standard: öppen (och öppen när lagringen saknas). */
export function arHopfalld(nyckel, store = lager()) {
  try {
    return store?.getItem(HJALP_PREFIX + nyckel) === "1";
  } catch {
    return false;
  }
}

/** Spara valet; öppen tar bort nyckeln. Tyst om lagringen inte går att skriva. */
export function sparaHopfalld(nyckel, hopfalld, store = lager()) {
  try {
    if (hopfalld) store?.setItem(HJALP_PREFIX + nyckel, "1");
    else store?.removeItem(HJALP_PREFIX + nyckel);
  } catch {
    /* privat läge eller full lagring – valet gäller bara den här visningen */
  }
}

/** En länk i en hjälptext (adressen står både i href och data-hash, som övriga lärarlänkar). */
export const hjalpLank = (hash, text) => `<a href="${hash}" data-hash="${hash}">${text}</a>`;

/**
 * Hjälpruta överst på en flik. `nyckel` = vilken ruta (t.ex. "mina-hur", "material-plugga"),
 * `html` = texten (egen markup med hjalpLank, aldrig användartext).
 */
export function hjalpRuta(nyckel, html, ctx) {
  const ruta = el(`<details class="hj-ruta" data-hjalp="${nyckel}">
    <summary>${icon("book", 16)}<span class="hj-rubrik">Hjälp</span><span class="hj-visa" aria-hidden="true"></span></summary>
    <p class="hj-text" role="note">${html}</p>
  </details>`);
  ruta.open = !arHopfalld(nyckel);
  ruta.addEventListener("toggle", () => sparaHopfalld(nyckel, !ruta.open));
  if (ctx) wireHashLinks(ctx, ruta);
  return ruta;
}
