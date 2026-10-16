// ============================================================================
// Prov (#741): DOM-hjälpare för typernas svarsvisning efter provet –
// renderRattning (lärarens rättningsvy) och renderResultat (elevens
// resultatvy). Samma bild för båda: elevens svar, rätt/fel per del när facit
// finns och facit på en rad. Bara anropade när en vy ritas (registret går
// att ladda i Node). CSS: prov-resultat.css (.provv-sv-).
//
//   typ.renderRattning(elevFraga, svar, { facit, facitRad? })  → HTMLElement
//   typ.renderResultat(elevFraga, svar, { facit })              → HTMLElement
//     facit     typens facit (privat/facit.facit[id]) – null = markera inget
//     facitRad  false = visa inte facit-raden (per fråga står facit överst)
// Typfilerna skriver EN funktion visa(f, svar, o) och sprider svarsVyer(visa).
// ============================================================================

import { h } from "./prov-vy.js";

/** renderRattning + renderResultat ur en visningsfunktion (o.du = elevens ord). */
export function svarsVyer(visa) {
  return {
    renderRattning: (f, svar, o = {}) => visa(f, svar, { facitRad: true, ...o, du: false }),
    renderResultat: (f, svar, o = {}) => visa(f, svar, { facitRad: true, ...o, du: true }),
  };
}

const TECKEN = { true: ["✓", "rätt"], delvis: ["½", "delvis rätt"], false: ["✗", "fel"] };

/** En liten markering ✓ / ½ / ✗ med text för skärmläsare (aldrig bara färg). */
export function mark(ratt) {
  const [ikon, text] = TECKEN[String(ratt)] || TECKEN.false;
  return h("span", { class: `provv-sv-mark provv-sv-mark-${ratt === "delvis" ? "delvis" : ratt ? "ratt" : "fel"}`, "aria-label": text, title: text, text: ikon });
}

/** "Inget svar" (lugnt, utan skam). */
export const ingetSvar = (o) => h("span", { class: "provv-sv-inget", text: o?.du ? "Du svarade inte på frågan." : "Inget svar" });

/** Facit-raden: "Rätt svar: Birka" (bara när facit finns och raden ska synas). */
export function facitRad(o, etikett, text) {
  if (!o?.facit || o.facitRad === false || !text) return null;
  return h("p", { class: "provv-sv-facit" }, h("b", { text: `${etikett}: ` }), text);
}

/**
 * Alternativen (flerval, flera rätt, sant/falskt): elevens val markerat, och
 * med facit även vilka som är rätt.
 * @param {string[]} texter
 * @param {Set<number>} valda
 * @param {Set<number>|null} ratta  null = inget facit
 */
export function alternativ(texter, valda, ratta, o) {
  const vem = o?.du ? "Ditt val" : "Elevens val";
  return h("ul", { class: "provv-sv-alt" }, texter.map((t, i) => {
    const vald = valda.has(i);
    const ratt = ratta?.has(i);
    const cls = ["provv-sv-alt-rad", vald && "provv-sv-vald", ratta && vald && (ratt ? "provv-sv-ok" : "provv-sv-nej"), ratta && !vald && ratt && "provv-sv-missad"].filter(Boolean).join(" ");
    return h("li", { class: cls },
      h("span", { class: "provv-sv-ruta", "aria-hidden": "true", text: vald ? "●" : "○" }),
      h("span", { class: "provv-sv-alt-text", text: t }),
      vald ? h("span", { class: "provv-sv-tagg", text: vem }) : null,
      ratta && ratt ? h("span", { class: "provv-sv-tagg provv-sv-tagg-ratt", text: "✓ Rätt svar" }) : null);
  }));
}

/** Ett skrivet svar (kortsvar, fritext) eller "Inget svar". */
export function textSvar(text, o, { lang = false } = {}) {
  const t = typeof text === "string" ? text.trim() : "";
  if (!t) return h("div", { class: "provv-sv-text" }, ingetSvar(o));
  return h("div", { class: `provv-sv-text${lang ? " provv-sv-lang" : ""}`, text: lang ? text : t });
}
