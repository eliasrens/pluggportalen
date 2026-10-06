// ============================================================================
// Pluggporten – lagrets HOVER-/FOKUS-TILLSTÅND i pyramidnyckeln (#396, F6 #432)
// ----------------------------------------------------------------------------
// Hus-profilen bakar med flit in hover-skalan (#husgrupp, #klasskylt) i basen
// (objekt: [] – S1: ett hover-överlägg täckte avataren). Då måste en pyramid
// bära vilket tillstånd den speglades i, och bara spelas när SAMMA tillstånd
// råder: annars visar canvasen huset i scale(1.02) när DOM:en visar 1.0 (F5 §8).
//
//   • tillstand(el, selektor): signatur för lagrets hovrade/fokuserade noder
//     bland profilens `neutralisera` ("" = neutralt). "i:h" = hover, "i:f" =
//     :focus-visible, "~" = en transition pågår (eller är pausad av vilan) i
//     noden → ingen speglad bild kan matcha exakt.
//   • Nyckeln: roll.nyckel + "#<signatur>" (neutralt = roll.nyckel, som förr),
//     så en hover-spegel och den neutrala idle-pyramiden lever sida vid sida.
//   • klarAttSpegla(): vänta tills hover-transitionen landat innan lagret
//     speglas om i sitt hover-tillstånd (annars bakas en mellanskala in).
// Inga importer – laddas via varld-motor-textur.js (import(), ej bootgrafen).
// ============================================================================

const lage = (n) => {
  try { return (n.matches(":hover") ? "h" : "") + (n.matches(":focus-visible") ? "f" : ""); } catch { return ""; }
};

/** Pågående (eller av vilan pausade) CSS-transitioner i noden. */
function transitioner(n) {
  let anims;
  try { anims = n.getAnimations({ subtree: true }); } catch { return []; }
  return anims.filter((a) => globalThis.CSSTransition && a instanceof CSSTransition && (a.playState === "running" || a.playState === "paused"));
}

function noder(el, selektor) {
  if (!selektor || !el?.querySelectorAll) return [];
  try { return [...el.querySelectorAll(selektor)]; } catch { return []; }
}

/**
 * Lagrets tillståndssignatur ("" = neutralt).
 * @param {HTMLElement} el  lagret
 * @param {string} selektor  profilens `neutralisera`
 */
export function tillstand(el, selektor) {
  const delar = [];
  noder(el, selektor).forEach((n, i) => {
    const s = lage(n) + (transitioner(n).length ? "~" : "");
    if (s) delar.push(`${i}:${s}`);
  });
  return delar.join(",");
}

/** Roll-nyckel med tillstånd (neutralt → oförändrad nyckel). */
export const tillstandsNyckel = (nyckel, sig) => (sig ? `${nyckel}#${sig}` : nyckel);

/**
 * Löser när `neutralisera`-nodernas transitioner landat (eller efter maxMs).
 * @returns {Promise<void>}
 */
export function klarAttSpegla(el, selektor, maxMs = 400) {
  const pagaende = noder(el, selektor).flatMap(transitioner).filter((a) => a.playState === "running");
  if (!pagaende.length) return Promise.resolve();
  return Promise.race([
    Promise.all(pagaende.map((a) => a.finished.catch(() => {}))).then(() => {}),
    new Promise((r) => setTimeout(r, maxMs)),
  ]);
}
