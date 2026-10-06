// ============================================================================
// Pluggporten – förfädernas klippning för nod-sprites (#416, F2/#396)
// ----------------------------------------------------------------------------
// speglaNod ritar en nod (ambient-sprite, fokus-överlägg) LÖSRYCKT ur sitt
// sammanhang. I DOM:en klipps den ofta av en förfader: molnen i rummets fönster
// av fönstrets <clipPath>, saker i rummet av lagret (overflow:hidden), allt i
// en inline-<svg> av dess viewport. Utan den klippningen skulle molnet synas
// UTANFÖR fönstret i texturen. Här samlas förfädernas klipp och uttrycks i
// nodens egna lokala koordinater (spriten är frusen i sin pose, så klippet
// följer med rätt).
// Laddas bara via import() (aldrig i bootgrafen).
// ============================================================================

import { kedjaLinjar, elementRam } from "./varld-spegel-html.js";

const f = (n) => (Math.round(n * 1000) / 1000).toString();
const synligt = (cs) => cs.overflowX === "visible" && cs.overflowY === "visible";

/** Fyra hörn (lokala koordinater) → polygon-punkter i nodens koordinater. */
function polygon(M, nodInv, x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    .map(([a, b]) => nodInv.transformPoint(M.transformPoint(new DOMPoint(a, b))))
    .map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
}

/** Referensen i clip-path: url("#id") → elementet (helst i samma svg, som DOM:en). */
function klippElement(e, varde) {
  const id = /url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(varde)?.[1];
  if (!id) return null;
  const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
  return e.ownerSVGElement?.querySelector(`#${esc}`) || document.getElementById(id);
}

/**
 * Klipp från alla förfäder till `nod` upp till och med `lagerEl`.
 * @param {Element} nod
 * @param {HTMLElement} lagerEl
 * @param {DOMMatrix} nodInv  viewport → nodens lokala koordinater
 * @param {{def:(nyckel:string, bygg:(id:string)=>string)=>string}} ktx
 * @returns {{oppna:string, stang:string}} omslag runt spritens innehåll
 */
export function forfaderKlipp(nod, lagerEl, nodInv, ktx) {
  let oppna = "", stang = "";
  const lagg = (markupFor) => {
    const id = ktx.def(`klipp:${ktx.klippN = (ktx.klippN || 0) + 1}`, markupFor);
    oppna += `<g clip-path="url(#${id})">`;
    stang += "</g>";
  };
  for (let e = nod.parentElement; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (e instanceof SVGElement) {
      // clip-path="url(#…)" på en svg-förfader (t.ex. fönstrets rum-fclip).
      const ref = cs.clipPath && cs.clipPath !== "none" ? klippElement(e, cs.clipPath) : null;
      if (ref && ref.getAttribute("clipPathUnits") !== "objectBoundingBox") {
        const rel = nodInv.multiply(DOMMatrix.fromMatrix(e.getScreenCTM()));
        const barn = [...ref.children].map((c) => new XMLSerializer().serializeToString(c)).join("");
        lagg((id) => `<clipPath id="${id}" transform="matrix(${f(rel.a)} ${f(rel.b)} ${f(rel.c)} ${f(rel.d)} ${f(rel.e)} ${f(rel.f)})">${barn}</clipPath>`);
      }
      // En svg:s viewport (overflow hidden) – yttre svg mäts som HTML-box nedan.
      if (e instanceof SVGSVGElement && e.parentElement instanceof SVGElement && !synligt(cs)) {
        const M = DOMMatrix.fromMatrix(e.parentElement.getScreenCTM());
        const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => e[a].baseVal.value);
        lagg((id) => `<clipPath id="${id}"><polygon points="${polygon(M, nodInv, x, y, w, h)}"/></clipPath>`);
        continue;
      }
      if (e.localName === "foreignObject" && !synligt(cs)) {
        const M = DOMMatrix.fromMatrix(e.getScreenCTM());
        const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => e[a].baseVal.value);
        lagg((id) => `<clipPath id="${id}"><polygon points="${polygon(M, nodInv, x, y, w, h)}"/></clipPath>`);
      }
      if (!(e instanceof SVGSVGElement) || e.parentElement instanceof SVGElement) continue;
    }
    // HTML-box (eller yttre svg) med overflow ≠ visible.
    if (!synligt(cs)) {
      const r = elementRam(e, cs, kedjaLinjar(e.parentElement));
      lagg((id) => `<clipPath id="${id}"><polygon points="${polygon(r.M, nodInv, 0, 0, r.w, r.h)}"/></clipPath>`);
    }
    if (e === lagerEl) break;
  }
  return { oppna, stang };
}
