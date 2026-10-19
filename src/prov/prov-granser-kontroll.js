// ============================================================================
// Prov (#796): kontrollen "Färggränser: gul från X %, grön från Y %" – EN
// kontroll för rättningsvyn (alla lägen, även Översikten). Två heltalsfält i
// procent; ett giltigt värde (0 < gul < grön ≤ 100, som granserOk och reglernas
// provGranserOk) visas direkt i vyerna (onForhandsvisa) och sparas när fältet
// lämnas / Enter (onSpara). Ogiltigt värde ger en text och rör ingenting.
// Utan Firebase – vyn skickar in sparfunktionen.
// ============================================================================

import { granserOk, granserText } from "./prov-validera.js";
import { h } from "./prov-vy.js";

/**
 * @param {object} o
 * @param {{ gul: number, gron: number }} o.granser   startvärde (tillfällets)
 * @param {(g: {gul:number,gron:number}) => void} o.onForhandsvisa  ritar om vyerna direkt
 * @param {(g: {gul:number,gron:number}) => Promise<void>} o.onSpara  sparar (kastar vid fel)
 * @returns {{ el: HTMLElement, satt: (g) => void }}
 */
export function granserKontroll({ granser, onForhandsvisa, onSpara }) {
  let sparad = { gul: granser.gul, gron: granser.gron };
  const faltEl = (id, namn, varde) => h("input", {
    type: "number", inputmode: "numeric", min: "1", max: "100", step: "1", value: String(varde),
    class: "input provl-granser-tal", "data-g": id, "aria-label": namn,
  });
  const gul = faltEl("gul", "Gul från (procent)", sparad.gul);
  const gron = faltEl("gron", "Grön från (procent)", sparad.gron);
  const text = h("span", { class: "hint provl-granser-text", role: "status", "aria-live": "polite" });
  const lasVarde = () => ({ gul: gul.value.trim() === "" ? NaN : Number(gul.value), gron: gron.value.trim() === "" ? NaN : Number(gron.value) });
  const visa = (g) => { text.dataset.lage = "ok"; text.textContent = granserText(g); };

  function ogiltig() {
    text.dataset.lage = "fel";
    text.textContent = "Gränserna måste vara hela procent: gul över 0, grön högre än gul och högst 100.";
  }

  function vidInmatning() {
    const g = lasVarde();
    if (!granserOk(g)) return ogiltig();
    visa(g);
    onForhandsvisa(g);
  }

  async function vidAndring() {
    const g = lasVarde();
    if (!granserOk(g)) return ogiltig();
    if (g.gul === sparad.gul && g.gron === sparad.gron) return visa(g);
    text.dataset.lage = "sparar";
    text.textContent = "Sparar…";
    try {
      await onSpara(g);
      sparad = g;
      visa(g);
      text.textContent = `Sparat. ${text.textContent}`;
    } catch (err) {
      text.dataset.lage = "fel";
      text.textContent = `Kunde inte spara färggränserna: ${err?.message || err}`;
    }
  }

  for (const f of [gul, gron]) {
    f.addEventListener("input", vidInmatning);
    f.addEventListener("change", vidAndring);
    f.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); vidAndring(); } });
  }
  visa(sparad);

  const el = h("div", { class: "provl-granser-kontroll" },
    h("label", { class: "provl-granser-rad" }, h("span", { text: "Färggränser: gul från" }), gul, h("span", { text: "%, grön från" }), gron, h("span", { text: "%" })),
    text,
    h("p", { class: "hint provl-granser-hint", text: "Gäller det här provet i klassen och slår igenom direkt i rättning, översikt, statistik, CSV och utskrift. Ändra provets egna gränser i Mina prov." }));
  return { el, satt(g) { sparad = { gul: g.gul, gron: g.gron }; gul.value = String(g.gul); gron.value = String(g.gron); visa(g); } };
}
