// ============================================================================
// Pluggporten – spegling: hovrade/fokuserade OBJEKT i vila-läge (#396, F4b #428)
// ----------------------------------------------------------------------------
// Bas-speglingen (pyramiden) ska visa lagret som det ser ut UTAN pekare/fokus:
// annars bakas t.ex. `.by-tomt:hover > svg { scale(1.06) }` och fokusringen in
// i texturen, och en senare övergång (T4-ut) slutar med tomten i 1.06 på
// canvasen men 1.0 i DOM (pop). Hovern ritas i stället av motorns
// fokus-överlägg (speglaNod på originalnoden, ovanpå basen).
//
// CSS kan inte frågas om "stilen utan :hover", och hover-skalan syns även i
// getBoundingClientRect. Därför: en djup KLON av det hovrade objektet läggs
// SYNKRONT direkt efter originalet (klonen är varken hovrad eller fokuserad),
// klonens CSS-animationer ställs i originalets pose (currentTime + paus), och
// speglingen ritar klonen i originalets ställe. Klonen tas bort i samma task –
// den målas aldrig. Bara absolut/fixed-positionerade HTML-objekt och SVG-noder
// klonas (en klon i flödet skulle flytta syskonen); övriga ritas som de står.
// Klonerna bär data-pp-klon så att motorns MutationObserver kan ignorera dem.
// Laddas bara via import() (varld-spegel.js) – aldrig i bootgrafen.
// ============================================================================

export const KLON_ATTR = "data-pp-klon";

const hovrad = (n) => {
  try { return n.matches(":hover") || n.matches(":focus-visible"); } catch { return false; }
};
const klonbar = (n) => n instanceof SVGElement || /^(absolute|fixed)$/.test(getComputedStyle(n).position);

/** Ställ klonens CSS-animationer i originalets pose (samma nod-index + namn). */
function kopieraPose(orig, klon) {
  const index = (rot) => new Map([rot, ...rot.querySelectorAll("*")].map((e, i) => [e, i]));
  const nyckel = (a, idx) => `${idx.get(a.effect?.target)}|${a.animationName}|${a.effect?.pseudoElement || ""}`;
  const oIdx = index(orig), kIdx = index(klon);
  const oAnim = new Map();
  for (const a of orig.getAnimations({ subtree: true })) {
    if (globalThis.CSSAnimation && a instanceof CSSAnimation) oAnim.set(nyckel(a, oIdx), a);
  }
  for (const a of klon.getAnimations({ subtree: true })) {
    if (!(globalThis.CSSAnimation && a instanceof CSSAnimation)) continue;
    const o = oAnim.get(nyckel(a, kIdx));
    try {
      if (o && o.currentTime != null) a.currentTime = o.currentTime;
      a.pause();
    } catch { /* animationen kan ha försvunnit */ }
  }
}

/**
 * Lägg vila-kloner för lagrets hovrade/fokuserade objekt.
 * @param {HTMLElement} lagerEl
 * @param {string} selektor  profilens `objekt`
 * @returns {{hoppa:Set<Element>, stad:() => void} | null}
 *   hoppa = originalnoder som speglingen ska hoppa över (klonen ritas i deras
 *   ställe); stad() tar bort klonerna (anropas synkront efter genomgången).
 */
export function neutraliseraObjekt(lagerEl, selektor) {
  if (!selektor) return null;
  let noder;
  try { noder = [...lagerEl.querySelectorAll(selektor)].filter(hovrad); } catch { return null; }
  noder = noder.filter((n) => !noder.some((m) => m !== n && m.contains(n)) && klonbar(n));
  if (!noder.length) return null;
  const kloner = [];
  for (const n of noder) {
    const k = n.cloneNode(true);
    k.setAttribute(KLON_ATTR, "");
    n.after(k);
    kloner.push(k);
  }
  noder.forEach((n, i) => {
    try { kopieraPose(n, kloner[i]); } catch { /* äldre motor: klonens pose = start */ }
  });
  return { hoppa: new Set(noder), stad: () => kloner.forEach((k) => k.remove()) };
}
