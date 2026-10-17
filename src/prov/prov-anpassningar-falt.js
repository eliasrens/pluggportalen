// ============================================================================
// Prov (#748, spec §14): lärarens fält för anpassningarna – rena DOM-delar
// som rutorna bygger in (prov-tillfalle-rutor.js: Kör i klass och Öppna;
// prov-anpassningar-rutor.js: omprovet och extra tid under provet).
//   extraTidFalt({ hamta, extraTid, onAndrat })  utfällbar lista "Extra tid för
//       enskilda elever" – namnen läses först när läraren fäller ut den
//   elevLista({ elever, valda, extraTid, valbar })  en rad per elev:
//       (kryssruta) namn, extra tid
// Ingen Firebase här; CSS i prov-tillfalle.css (.provl-ap-).
// ============================================================================

import { EXTRA_TID_VAL, rensaExtraTid } from "./prov-anpassningar.js";
import { h } from "./prov-vy.js";

const minText = (m) => `+${m} min`;

function extraSelect(namn, varde, onAndrat) {
  const val = [...EXTRA_TID_VAL];
  if (varde && !val.includes(varde)) val.push(varde), val.sort((a, b) => a - b);
  const s = h("select", { class: "select provl-ap-extra", "aria-label": `Extra tid för ${namn}` },
    h("option", { value: "", text: "–" }),
    val.map((m) => h("option", { value: String(m), text: minText(m), selected: m === varde })));
  s.addEventListener("change", () => onAndrat(s.value ? Number(s.value) : 0));
  return s;
}

/**
 * En rad per elev. valbar: kryssruta (omprovets elever); extra tid per rad.
 * @param {object} o
 * @param {{ id: string, namn: string }[]} o.elever
 * @param {Record<string, number>} [o.extraTid]
 * @param {string[]} [o.valda]
 * @param {boolean} [o.valbar]
 * @param {() => void} [o.onAndrat]
 * @returns {{ el: HTMLElement, valda: () => string[], varde: () => Record<string, number> }}
 */
export function elevLista({ elever, extraTid = {}, valda = [], valbar = false, onAndrat = () => {} }) {
  const val = { ...extraTid };
  const valt = new Set(valda);
  const rader = elever.map((e) => {
    const kryss = valbar ? h("input", { type: "checkbox", checked: valt.has(e.id) }) : null;
    kryss?.addEventListener("change", () => { kryss.checked ? valt.add(e.id) : valt.delete(e.id); onAndrat(); });
    return h("li", { class: "provl-ap-rad" },
      valbar ? h("label", { class: "provl-kryss provl-ap-namn" }, kryss, ` ${e.namn}`) : h("span", { class: "provl-ap-namn", text: e.namn }),
      extraSelect(e.namn, val[e.id] || 0, (m) => { m ? (val[e.id] = m) : delete val[e.id]; onAndrat(); }));
  });
  const el = h("ul", { class: "provl-ap-lista" }, rader.length ? rader : h("li", { class: "hint", text: "Klassen har inga elever." }));
  return { el, valda: () => elever.map((e) => e.id).filter((id) => valt.has(id)), varde: () => rensaExtraTid(val) };
}

/**
 * "Extra tid för enskilda elever" (§14): utfälld läses elevernas namn (hamta),
 * sedan väljer läraren +5 … +60 minuter per elev.
 * @param {object} o
 * @param {() => Promise<{ id, namn }[]>} o.hamta
 * @param {Record<string, number>} [o.extraTid]  det som redan är sparat
 * @param {() => void} [o.onAndrat]  efter varje ändring (fokuslåsets förval, #749 F1)
 * @returns {{ el, varde: () => Record<string, number>, andrat: () => boolean, laddaOm: (giltiga: string[]) => void }}
 */
export function extraTidFalt({ hamta, extraTid = {}, onAndrat = () => {} }) {
  const fore = rensaExtraTid(extraTid);
  let val = { ...fore };
  let lista = null;
  let laddning = 0;
  const antal = h("span", { class: "hint provl-ap-antal" });
  const kropp = h("div", { class: "provl-ap-kropp" });
  const el = h("details", { class: "provl-tf-grupp provl-ap" },
    h("summary", {}, h("b", { text: "Extra tid för enskilda elever" }), antal),
    h("p", { class: "hint", text: "Läggs till tidsgränsen för just de eleverna, till exempel +15 minuter. Eleven ser bara sin egen tid." }),
    kropp);
  const raknaUt = () => {
    const n = Object.keys(lista ? lista.varde() : val).length;
    antal.textContent = n ? ` · ${n} ${n === 1 ? "elev" : "elever"}` : "";
    onAndrat();
  };
  async function ladda() {
    const nr = ++laddning;
    if (lista) val = lista.varde();
    lista = null;
    kropp.replaceChildren(h("p", { class: "hint", text: "Laddar eleverna…" }));
    try {
      const elever = await hamta();
      if (nr !== laddning) return;
      lista = elevLista({ elever, extraTid: val, onAndrat: raknaUt });
      kropp.replaceChildren(lista.el);
    } catch (err) {
      if (nr === laddning) kropp.replaceChildren(h("p", { class: "msg error", text: "Kunde inte läsa eleverna." }));
    }
    raknaUt();
  }
  el.addEventListener("toggle", () => { if (el.open && !lista) ladda(); });
  raknaUt();
  const varde = () => (lista ? lista.varde() : rensaExtraTid(val));
  return {
    el,
    varde,
    andrat: () => {
      const v = varde();
      return Object.keys(v).length !== Object.keys(fore).length || Object.keys(v).some((uid) => v[uid] !== fore[uid]);
    },
    /** Klassen byttes: bara den nya klassens elever behåller sin tid; läs om namnen (om listan är utfälld). */
    laddaOm(giltiga) {
      val = rensaExtraTid(lista ? lista.varde() : val, giltiga);
      lista = null;
      if (el.open) ladda();
      else raknaUt();
    },
  };
}
