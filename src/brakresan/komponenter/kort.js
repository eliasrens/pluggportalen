// ============================================================================
// Bråkresan – 8. Matchningskort (komponenter/kort.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 8: blandade representationer, tydligt valtillstånd, "välj
// tre", parning och avvikande kort. Värdet får INTE avslöjas av kortets
// bakgrund, filnamn, ordning eller dekor: alla kort ser likadana ut, id:t är
// generatorns neutrala id och ordningen är generatorns (blandad där). Valt
// kort syns med kraftig ram + bock + text för skärmläsare – inte bara färg.
//
// view = { component: "kort", cards: [{ id, face }], stora? } där face är
//   (stora: true = större kort och bilder i storleken "kort" – E #710, när bilden är uppgiften)
//   en form (form.js) · { text } · en mini-modell { component: "stav" | "cirkel" | … }
// Läget följer opts.answer.type:
//   choice  { id }          ett kort (t.ex. "Vilket kort är fel?")
//   select  { ids }         välj answer.count kort, valfri ordning ("Hitta tre som hör ihop")
//   pairs   { pairs:[{a,b}] } klicka två kort = ett par; klicka ett par igen = lös upp
//   annars  visning
// ============================================================================

import { h, skapaBas } from "./bas.js";
import { formNod } from "./notation.js";

// Parmärken: form + nummer, så att paren skiljs åt utan färg.
const PARMARKEN = ["●", "▲", "■", "◆", "★", "✚", "⬟", "⬢"];

/** Kortets framsida. Mini-modeller laddas lat (index.js) och fylls i när de är klara. */
export function kortFramsida(face, vantan = [], storlek = "mini") {
  const yta = h("span", { class: "br-kortyta" });
  if (face?.kind) yta.append(formNod(face, { klass: "br-tal--kort" }));
  else if (face?.component) {
    yta.classList.add("br-kortyta--modell");
    vantan.push(import("./index.js").then(({ createComponent }) =>
      createComponent(yta, face, { interactive: false, size: storlek })));
  } else yta.append(h("span", { class: "br-korttext" }, String(face?.text ?? face ?? "")));
  return yta;
}

export function createKort(host, view, opts = {}) {
  const typ = opts.answer?.type;
  const lage = ["choice", "select", "pairs"].includes(typ) ? typ : "visning";
  const behov = opts.answer?.count || 0;
  const grid = h("div", { class: "br-kortgrid", role: "group" });
  const status = h("div", { class: "br-kortstatus", "aria-live": "polite" });
  const rot = h("div", { class: `br-kortlek br-kortlek--${lage}${view.stora ? " br-kortlek--stora" : ""}` }, grid, status);
  const bas = skapaBas(host, rot, view, opts);
  grid.setAttribute("aria-label", opts.label || (lage === "pairs" ? "Kort att para ihop" : lage === "select" ? `Välj ${behov} kort` : "Kort"));
  const vantan = [];
  const valda = new Set();
  let par = []; // [{ a, b }]
  let vantar = null;

  const kort = view.cards.map((c, i) => {
    const el = h(lage === "visning" ? "div" : "button", {
      class: "br-kort", "data-kort": String(c.id), type: lage === "visning" ? null : "button",
      "aria-label": null,
    }, h("span", { class: "br-kortbock", "aria-hidden": "true" }), kortFramsida(c.face, vantan, view.stora ? "kort" : "mini"),
    h("span", { class: "br-kortnamn" }, `Kort ${i + 1}`));
    grid.append(el);
    return el;
  });

  function visa() {
    for (const el of kort) {
      const id = el.dataset.kort;
      const p = par.findIndex((x) => x.a === id || x.b === id);
      const pa = valda.has(id) || p >= 0 || vantar === id;
      el.classList.toggle("br-vald", pa);
      el.classList.toggle("br-vantar", vantar === id);
      if (lage !== "visning") el.setAttribute("aria-pressed", String(pa));
      const bock = el.querySelector(".br-kortbock");
      bock.textContent = p >= 0 ? `${PARMARKEN[p % PARMARKEN.length]} ${p + 1}` : pa ? "✓" : "";
      el.classList.toggle("br-parad", p >= 0);
      if (p >= 0) el.dataset.par = String(p % PARMARKEN.length); else delete el.dataset.par;
      const namn = el.querySelector(".br-kortnamn");
      namn.textContent = p >= 0 ? `Kort ${kort.indexOf(el) + 1}, par ${p + 1}` : `Kort ${kort.indexOf(el) + 1}${vantar === id ? ", väljer par" : ""}`;
    }
    if (lage === "select") status.textContent = `Valda: ${valda.size} av ${behov}`;
    else if (lage === "pairs") status.textContent = `Par: ${par.length} av ${Math.floor(kort.length / 2)}${vantar ? " – välj kortet som hör ihop" : ""}`;
  }

  grid.addEventListener("click", (e) => {
    const el = e.target.closest(".br-kort");
    if (!el || bas.last || !bas.interaktiv || lage === "visning") return;
    const id = el.dataset.kort;
    if (lage === "choice") {
      const var_ = valda.has(id);
      valda.clear();
      if (!var_) valda.add(id);
    } else if (lage === "select") {
      if (valda.has(id)) valda.delete(id); else valda.add(id);
    } else {
      const p = par.findIndex((x) => x.a === id || x.b === id);
      if (p >= 0) par.splice(p, 1);
      else if (vantar === id) vantar = null;
      else if (vantar) { par.push({ a: vantar, b: id }); vantar = null; }
      else vantar = id;
    }
    visa();
    bas.andrat();
  });

  const setAnswer = (a) => {
    valda.clear();
    par = [];
    vantar = null;
    if (lage === "choice" && a?.id !== undefined && a?.id !== null) valda.add(String(a.id));
    if (lage === "select") for (const id of a?.ids || []) valda.add(String(id));
    if (lage === "pairs") par = (a?.pairs || []).map((p) => ({ a: String(p.a), b: String(p.b) }));
    visa();
  };
  visa();

  Object.assign(bas.api, {
    getAnswer() {
      if (lage === "choice") return valda.size ? { id: [...valda][0] } : null;
      if (lage === "select") return valda.size ? { ids: kort.map((k) => k.dataset.kort).filter((id) => valda.has(id)) } : null;
      if (lage === "pairs") return par.length ? { pairs: par.map((p) => ({ a: p.a, b: p.b })) } : null;
      return null;
    },
    setAnswer,
    reset() { setAnswer(null); bas.andrat(); },
    highlight(target) {
      const ids = new Set((target?.ids || []).map(String));
      for (const el of kort) el.classList.toggle("br-pekad", ids.has(el.dataset.kort));
      rot.classList.toggle("br-pekar-helhet", !!target?.whole);
    },
    /** Löses när kortens mini-modeller är ritade. */
    ready: Promise.all(vantan).then(() => undefined),
  });
  return bas.api;
}
