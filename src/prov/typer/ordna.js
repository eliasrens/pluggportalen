// ============================================================================
// Prov (#738) – frågetypen "ordna": eleven sätter 3–10 saker i rätt ordning
// (händelser i tid, steg i en process). Läraren skriver `saker` i RÄTT
// ordning; eleven får dem blandade (stabilt per fråge-id, aldrig i facit-
// ordning). Svar = elevens ordning som lista med texterna, [] = inte rörd.
// Delpoäng per sak på rätt plats.
// ============================================================================

import { forslagAv } from "../prov-rattning.js";
import { blanda, elevFalt, textLista, valideraGemensamt } from "./delat.js";
import { elevKontext, h } from "../prov-vy.js";

export default {
  id: "ordna",
  namn: "Sätt i ordning",
  ikon: "🔢",
  beskrivning: "Eleven sätter saker i rätt ordning.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const saker = textLista(f.saker, { namn: "saker", min: 3, max: 10, unika: true });
    fel.push(...saker.fel.map((x) => x.replace(/^saker (\d+)/, "sak $1")));
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "ordna", saker: saker.value } };
  },

  facit: (f) => ({ ordning: [...f.saker] }),
  utanFacit: (f) => ({ ...elevFalt(f), saker: blanda(f.saker, `ordna:${f.id}`) }),
  tomtSvar: () => [],
  arBesvarad: (svar) => Array.isArray(svar) && svar.length > 0,
  /** Bara en hel omflyttning av provets saker godtas, annars "inte rörd". */
  rensaSvar(svar, f) {
    if (!Array.isArray(svar) || svar.length !== f.saker.length) return [];
    const kvar = new Set(f.saker);
    return svar.every((s) => kvar.delete(s)) ? [...svar] : [];
  },

  forslag(svar, facit, f) {
    const lista = Array.isArray(svar) ? svar : [];
    const ratt = facit.ordning.filter((s, i) => lista[i] === s).length;
    return forslagAv(ratt / facit.ordning.length, f.poang);
  },

  /**
   * Elevens svarsruta (#740): flytta upp/ner med knappar (tangentbord och
   * pekskärm). Orörd ([]) = obesvarad – är ordningen redan rätt trycker
   * eleven "Behåll den här ordningen".
   */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    let ordning = Array.isArray(k.svar) && k.svar.length ? [...k.svar] : [...f.saker];
    let rord = Array.isArray(k.svar) && k.svar.length > 0;
    const lista = h("ol", { class: "provv-ordna" });
    const behall = h("button", { type: "button", class: "provv-knapp-liten", text: "Behåll den här ordningen", disabled: !!k.las });
    const status = h("span", { class: "provv-ordna-status", "aria-live": "polite" });
    const valj = (ny, fokus) => {
      ordning = ny;
      rord = true;
      k.andra([...ordning]);
      k.lamna();
      rita(fokus);
    };
    const rita = (fokus) => {
      lista.replaceChildren(...ordning.map((s, i) => h("li", { class: "provv-ordna-sak" },
        h("span", { class: "provv-ordna-nr", text: `${i + 1}.` }),
        h("span", { class: "provv-ordna-text", text: s }),
        h("span", { class: "provv-ordna-knappar" },
          h("button", { type: "button", class: "provv-pil", "data-pil": `upp-${i}`, "aria-label": `Flytta upp: ${s}`, text: "▲", disabled: !!k.las || i === 0,
            on: { click: () => { const n = [...ordning]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; valj(n, `upp-${i - 1}`); } } }),
          h("button", { type: "button", class: "provv-pil", "data-pil": `ner-${i}`, "aria-label": `Flytta ner: ${s}`, text: "▼", disabled: !!k.las || i === ordning.length - 1,
            on: { click: () => { const n = [...ordning]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; valj(n, `ner-${i + 1}`); } } })))));
      behall.hidden = rord;
      status.textContent = rord ? "" : "Inte ordnad än";
      if (fokus) (lista.querySelector(`[data-pil="${fokus}"]:not(:disabled)`) || lista.querySelector(`[data-pil]:not(:disabled)`))?.focus();
    };
    behall.addEventListener("click", () => valj([...ordning], null));
    rita();
    return h("div", {}, lista, h("div", { class: "provv-ordna-fot" }, behall, status));
  },
};
