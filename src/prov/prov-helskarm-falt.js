// ============================================================================
// Prov (#810, spec §5.6): lärarens fält för helskärmsläget – en ren DOM-del
// som rutorna bygger in ("Kör i klass" och "Öppna" i prov-tillfalle-rutor.js,
// "Helskärm" i översikten, prov-helskarm-larare.js).
//   helskarmFalt({ hamta, helskarm })  kryssrutan "Helskärmsläge" + hjälptexten
//       + utfällbar lista "Undantag" (namnen läses först när den fälls ut)
// Ingen Firebase här; CSS i prov-tillfalle.css (.provl-hs-, .provl-ap-).
// ============================================================================

import { HJALPTEXT, rensaUndantag } from "./prov-helskarm.js";
import { h } from "./prov-vy.js";

/**
 * @param {object} o
 * @param {() => Promise<{ id, namn }[]>} o.hamta  elevernas namn
 * @param {{ pa?: boolean, undantag?: string[] }} [o.helskarm]  det som redan är sparat (standard: på)
 * @returns {{ el, varde: () => { pa: boolean, undantag: string[] }, andrat: () => boolean, laddaOm: (giltiga: string[]) => void }}
 */
export function helskarmFalt({ hamta, helskarm = {} }) {
  const fore = { pa: helskarm.pa !== false, undantag: rensaUndantag(helskarm.undantag) };
  let valda = new Set(fore.undantag);
  let lista = null;
  let laddning = 0;
  const pa = h("input", { type: "checkbox", checked: fore.pa, "data-f": "helskarm" });
  const antal = h("span", { class: "hint provl-ap-antal" });
  const kropp = h("div", { class: "provl-ap-kropp" });
  const undantag = h("details", { class: "provl-ap provl-hs-undantag" },
    h("summary", {}, h("b", { text: "Undantag" }), antal),
    h("p", { class: "hint", text: "De här eleverna skriver utan helskärm, till exempel en elev som behöver ett uppläsningsprogram." }),
    kropp);
  const el = h("fieldset", { class: "provl-tf-grupp provl-hs" },
    h("legend", { text: "Helskärmsläge" }),
    h("label", { class: "provl-kryss" }, pa, " Provet visas i helskärm. Lämnar eleven provet pausas det tills du släpper in hen."),
    h("p", { class: "hint", text: HJALPTEXT }),
    undantag);
  const raknaUt = () => {
    antal.textContent = valda.size ? ` · ${valda.size} ${valda.size === 1 ? "elev" : "elever"}` : "";
    undantag.classList.toggle("provl-av", !pa.checked);
  };
  async function ladda() {
    const nr = ++laddning;
    lista = null;
    kropp.replaceChildren(h("p", { class: "hint", text: "Laddar eleverna…" }));
    try {
      const elever = await hamta();
      if (nr !== laddning) return;
      lista = elever;
      kropp.replaceChildren(h("ul", { class: "provl-ap-lista" }, elever.length ? elever.map((e) => {
        const kryss = h("input", { type: "checkbox", checked: valda.has(e.id) });
        kryss.addEventListener("change", () => { kryss.checked ? valda.add(e.id) : valda.delete(e.id); raknaUt(); });
        return h("li", { class: "provl-ap-rad" }, h("label", { class: "provl-kryss provl-ap-namn" }, kryss, ` ${e.namn}`));
      }) : h("li", { class: "hint", text: "Klassen har inga elever." })));
    } catch {
      if (nr === laddning) kropp.replaceChildren(h("p", { class: "msg error", text: "Kunde inte läsa eleverna." }));
    }
  }
  undantag.addEventListener("toggle", () => { if (undantag.open && !lista) ladda(); });
  pa.addEventListener("change", raknaUt);
  raknaUt();
  const varde = () => ({ pa: pa.checked, undantag: rensaUndantag([...valda], lista ? lista.map((e) => e.id) : null) });
  return {
    el,
    varde,
    andrat: () => {
      const v = varde();
      return v.pa !== fore.pa || v.undantag.length !== fore.undantag.length || v.undantag.some((u) => !fore.undantag.includes(u));
    },
    /** Klassen byttes: bara den nya klassens elever behåller sitt undantag. */
    laddaOm(giltiga) {
      valda = new Set(rensaUndantag([...valda], giltiga));
      lista = null;
      if (undantag.open) ladda();
      raknaUt();
    },
  };
}
