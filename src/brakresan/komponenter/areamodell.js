// ============================================================================
// Bråkresan – 10. Areal modell för produkt (komponenter/areamodell.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 10: lodrät och vågrät uppdelning, separata färger OCH
// mönster för de två andelarna (lodräta ränder / vågräta ränder) och tydlig
// överlappning (korsrandig), alltid relaterad till den ursprungliga helheten:
// kvadraten är hela tiden 1 och delas i vertical.d · horizontal.d lika rutor
// (geometri.areaModell). 1/2 · 3/4 = 3/8: 3 av 8 rutor ligger i båda.
//
// view = { component: "areamodell", vertical: {n,d}, horizontal: {n,d},
//          show?: "lodratt" | "bada" (standard), marked?: antal | [id], label? }
// Svar: paint { selected } (rutorna p0 … rad för rad) när eleven ska måla.
// Extra API: steg("lodratt" | "bada") – förklaringen byggs upp stegvis.
// ============================================================================

import { h, s, skapaBas, malning, pekaPaDelar, helhetsEtikett, uid } from "./bas.js";
import { areaModell, markeradeIds } from "./geometri.js";
import { formNod } from "./notation.js";
import { fraction } from "../math/index.js";

const SIDA = 360;

export function createAreamodell(host, view, opts = {}) {
  const v = view.vertical;
  const hz = view.horizontal;
  const m = areaModell(v, hz);
  const cw = SIDA / m.cols;
  const ch = SIDA / m.rows;
  const id = uid("area");
  const svg = s("svg", { class: "br-area-svg", viewBox: `-8 -8 ${SIDA + 16} ${SIDA + 16}`, role: "group", "aria-label": opts.label || "Kvadrat för produkt av två bråk" });
  const legend = h("div", { class: "br-area-legend" },
    h("span", { class: "br-legend br-legend--lodratt" }, h("span", { class: "br-legend-ruta", "aria-hidden": "true" }), "Lodräta ränder: ", formNod(fraction(v.n, v.d))),
    h("span", { class: "br-legend br-legend--vagratt" }, h("span", { class: "br-legend-ruta", "aria-hidden": "true" }), "Vågräta ränder: ", formNod(fraction(hz.n, hz.d))),
    h("span", { class: "br-legend br-legend--bada" }, h("span", { class: "br-legend-ruta", "aria-hidden": "true" }), "Korsrandigt: i båda"));
  const rot = h("div", { class: "br-areamodell" }, helhetsEtikett(view.label || "Hela kvadraten = 1"), svg, legend);
  const bas = skapaBas(host, rot, view, opts);

  const defs = s("defs");
  defs.append(
    s("pattern", { id: `${id}-l`, width: 12, height: 12, patternUnits: "userSpaceOnUse" },
      s("rect", { width: 12, height: 12, class: "br-area-fyll-l" }), s("line", { x1: 3, y1: 0, x2: 3, y2: 12, class: "br-area-rand-l" })),
    s("pattern", { id: `${id}-v`, width: 12, height: 12, patternUnits: "userSpaceOnUse" },
      s("rect", { width: 12, height: 12, class: "br-area-fyll-v" }), s("line", { x1: 0, y1: 9, x2: 12, y2: 9, class: "br-area-rand-v" })));
  svg.append(defs, s("rect", { class: "br-helhetsram", x: -6, y: -6, width: SIDA + 12, height: SIDA + 12, rx: 8 }),
    s("rect", { class: "br-area-bakgrund", x: 0, y: 0, width: SIDA, height: SIDA }));
  const lodratt = s("rect", { class: "br-area-lodratt", x: 0, y: 0, width: v.n * cw, height: SIDA, fill: `url(#${id}-l)` });
  const vagratt = s("rect", { class: "br-area-vagratt", x: 0, y: 0, width: SIDA, height: hz.n * ch, fill: `url(#${id}-v)` });
  const vLinjer = s("g", { class: "br-area-linjer" });
  const hLinjer = s("g", { class: "br-area-linjer" });
  for (let c = 1; c < m.cols; c++) vLinjer.append(s("line", { class: "br-grans", x1: c * cw, x2: c * cw, y1: 0, y2: SIDA }));
  for (let r = 1; r < m.rows; r++) hLinjer.append(s("line", { class: "br-grans", x1: 0, x2: SIDA, y1: r * ch, y2: r * ch }));
  const overlapp = s("rect", { class: "br-area-overlapp", x: 0, y: 0, width: v.n * cw, height: hz.n * ch });
  svg.append(lodratt, vagratt, vLinjer, hLinjer, overlapp);

  const delar = m.celler.map((c) => {
    const r = s("rect", { class: "br-yta br-areacell", x: c.c * cw, y: c.r * ch, width: cw, height: ch, "data-del": c.id });
    svg.append(r);
    return r;
  });
  svg.append(s("rect", { class: "br-kontur", x: 0, y: 0, width: SIDA, height: SIDA, "pointer-events": "none" }));
  const mal = malning(bas, delar, { kolumner: m.cols, namn: `Kvadrat med ${v.n} av ${v.d} kolumner lodrätt randiga och ${hz.n} av ${hz.d} rader vågrätt randiga, ${m.rows * m.cols} lika rutor`, etikett: (i) => `Ruta rad ${Math.floor(i / m.cols) + 1}, kolumn ${(i % m.cols) + 1}` });
  const start = markeradeIds(view.marked, delar.length);
  mal.satt(start);

  function steg(lage) {
    const bada = lage !== "lodratt";
    vagratt.setAttribute("visibility", bada ? "visible" : "hidden");
    hLinjer.setAttribute("visibility", bada ? "visible" : "hidden");
    overlapp.setAttribute("visibility", bada ? "visible" : "hidden");
    legend.querySelector(".br-legend--vagratt").hidden = !bada;
    legend.querySelector(".br-legend--bada").hidden = !bada;
    rot.classList.toggle("br-area--steg", !bada);
    if (bada) rot.classList.add("br-tona-in-area");
  }
  steg(view.show || "bada");
  rot.classList.remove("br-tona-in-area");

  Object.assign(bas.api, {
    getAnswer: () => mal.svar(),
    setAnswer(a) { mal.satt(a?.selected); },
    reset() { mal.satt(start); steg(view.show || "bada"); bas.andrat(); },
    highlight(target) {
      pekaPaDelar(bas, delar, target, null);
      rot.classList.toggle("br-pekar-overlapp", !!target?.overlap);
    },
    steg,
  });
  return bas.api;
}
