// ============================================================================
// Prov (#738) – frågetypen "para": eleven parar ihop begrepp och förklaringar
// (3–10 par). Läraren skriver `par: [{ vanster, hoger }]`. Eleven får
// vänsterleden i lärarens ordning och högerleden BLANDADE (stabilt per
// fråge-id, aldrig i facit-ordning). Svar = lista med valt högerled per
// vänsterled ("" = inte parat). Delpoäng per rätt par.
// ============================================================================

import { forslagAv } from "../prov-rattning.js";
import { GRANS, blanda, elevFalt, strangLista, textLista, trimmad, valideraGemensamt } from "./delat.js";
import { elevKontext, h } from "../prov-vy.js";
import { ingetSvar, mark, svarsVyer } from "../prov-svar-vy.js";

// Svaret efter provet (#741): elevens par, ✓/✗ per par och det rätta vid fel.
function visa(f, svar, o) {
  const lista = Array.isArray(svar) ? svar : [];
  if (!lista.some((s) => s)) return ingetSvar(o);
  return h("ul", { class: "provv-sv-par" }, f.vanster.map((v, i) => {
    const valt = lista[i] || "";
    const ratt = o.facit?.par?.[i]?.hoger;
    const ok = o.facit ? valt === ratt : null;
    return h("li", { class: `provv-sv-par-rad${o.facit ? (ok ? " provv-sv-ok" : " provv-sv-nej") : ""}` },
      h("span", { class: "provv-sv-par-v", text: v }),
      h("span", { class: "provv-sv-pil", "aria-hidden": "true", text: "→" }),
      valt ? h("span", { text: valt }) : h("span", { class: "provv-sv-inget", text: "inget valt" }),
      o.facit ? mark(ok) : null,
      o.facit && !ok && o.facitRad !== false ? h("span", { class: "provv-sv-luckfacit", text: `(${ratt})` }) : null);
  }));
}

export default {
  id: "para",
  namn: "Para ihop",
  ikon: "🔗",
  beskrivning: "Eleven parar ihop begrepp och förklaringar.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    let par = [];
    if (!Array.isArray(f.par)) fel.push('"par" måste vara en lista med { "vanster": "…", "hoger": "…" }');
    else {
      par = f.par.map((p) => ({ vanster: trimmad(p?.vanster), hoger: trimmad(p?.hoger) }));
      const v = textLista(par.map((p) => p.vanster), { namn: "par", min: 3, max: 10, unika: true });
      const h = textLista(par.map((p) => p.hoger), { namn: "par", min: 3, max: 10, unika: true });
      fel.push(...v.fel.map((x) => x.replace(/^par (\d+)/, "par $1, vänster led,")));
      fel.push(...h.fel.filter((x) => !/krävs/.test(x)).map((x) => x.replace(/^par (\d+)/, "par $1, höger led,")));
    }
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "para", par } };
  },

  facit: (f) => ({ par: f.par.map((p) => ({ ...p })) }),
  utanFacit: (f) => ({
    ...elevFalt(f),
    vanster: f.par.map((p) => p.vanster),
    hoger: blanda(f.par.map((p) => p.hoger), `para:${f.id}`),
  }),
  tomtSvar: (f) => Array(f.vanster.length).fill(""),
  arBesvarad: (svar) => Array.isArray(svar) && svar.some((s) => typeof s === "string" && s !== ""),
  rensaSvar(svar, f) {
    const giltiga = new Set(f.hoger);
    return strangLista(svar, f.vanster.length, GRANS.alternativ).map((s) => (giltiga.has(s) ? s : ""));
  },

  forslag(svar, facit, f) {
    const lista = Array.isArray(svar) ? svar : [];
    const ratt = facit.par.filter((p, i) => lista[i] === p.hoger).length;
    return forslagAv(ratt / facit.par.length, f.poang);
  },

  facitText: (f, facit) => (facit?.par || []).map((p) => `${p.vanster} → ${p.hoger}`).join(" · "),
  ...svarsVyer(visa),

  /** Elevens svarsruta (#740): välj det som hör ihop med varje begrepp. */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    const lista = Array.isArray(k.svar) ? [...k.svar] : Array(f.vanster.length).fill("");
    return h("div", { class: "provv-para" }, f.vanster.map((v, i) => {
      const id = `${k.uid}-${f.id}-${i}`;
      const val = h("select", { id, class: "provv-para-val", disabled: !!k.las },
        h("option", { value: "", text: "Välj …" }),
        f.hoger.map((x) => h("option", { value: x, text: x })));
      val.value = lista[i] || "";
      val.addEventListener("change", () => { lista[i] = val.value; k.andra([...lista]); k.lamna(); });
      return h("div", { class: "provv-para-rad" }, h("label", { for: id, class: "provv-para-vanster", text: v }), val);
    }));
  },
};
