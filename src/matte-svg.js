// ============================================================================
// Pluggporten – SVG-primitiver för mattegeneratorns bildstöd (issue #321)
// ----------------------------------------------------------------------------
// Ett litet, REN & IMPORT-FRITT byggblock som matte-bildstod.js (array/rutnät)
// och matte-visuals.js (klocka/kulpåse/diagram/koordinat) delar. Ett virtuellt
// SVG-träd byggs med el()/txt() och serialiseras EN gång antingen till riktig
// SVG-DOM (mot en injicerbar `document`, testbart mot fejk-DOM utan jsdom) eller
// till markup-sträng – samma struktur båda vägar, deterministiskt.
//
// Ett nod-barn är antingen ett element ({tag,attrs,children}) eller en sträng
// (textinnehåll, t.ex. siffror i diagram/koordinatsystem).
//
// BOOT-SÄKERHET (jfr #271/#290): filen har MEDVETET inga importer och nås BARA
// dynamiskt (via matte-bildstod.js/matte-visuals.js, som i sin tur bara laddas
// via `await import(...)` i räkna-/generator-vägen). Den får ALDRIG statiskt
// importeras från en bootnådd fil.
// ============================================================================

export const SVG_NS = "http://www.w3.org/2000/svg";

/** Virtuellt element. `children` är element-noder och/eller textsträngar. */
export function el(tag, attrs, children) {
  return { tag, attrs: attrs || {}, children: children || [] };
}

/** Textbärande element: <tag …>content</tag> (content escapeas vid serialisering). */
export function txt(tag, attrs, content) {
  return el(tag, attrs, [String(content)]);
}

/** Bygg riktig SVG-DOM ur ett virtuellt träd mot en injicerbar `document`. */
export function toDom(document, node) {
  if (typeof node === "string") return document.createTextNode(node);
  const node2 = document.createElementNS(SVG_NS, node.tag);
  for (const k in node.attrs) node2.setAttribute(k, String(node.attrs[k]));
  for (const child of node.children) node2.appendChild(toDom(document, child));
  return node2;
}

/** Serialisera ett virtuellt träd till markup-sträng (samma struktur som DOM-vägen). */
export function toMarkup(node) {
  if (typeof node === "string") return escText(node);
  const attrs = Object.keys(node.attrs)
    .map((k) => ` ${k}="${escAttr(node.attrs[k])}"`)
    .join("");
  if (!node.children.length) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${node.children.map(toMarkup).join("")}</${node.tag}>`;
}

/** Gemensam utgång: SVGElement mot opts.document, annars markup-sträng. */
export function finish(tree, opts) {
  if (opts && opts.document) return toDom(opts.document, tree);
  return toMarkup(tree);
}

/** Positivt heltal eller 0 (0 = "ogiltigt/saknas"). */
export function posInt(v) {
  return Number.isInteger(v) && v > 0 ? v : 0;
}

/** Runda av till 2 decimaler (kompakt, deterministisk markup). */
export function r2(n) {
  return Math.round(n * 100) / 100;
}

export function escAttr(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escText(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
