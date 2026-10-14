// ============================================================================
// Bråkresan – 4. Rektangel/rutnät (komponenter/rutnat.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 4: lika stora celler, grupperingskonturer, olika
// indelningar av samma area och tvåfärgad överlappning. Rutnätet ritas alltid
// i SAMMA yttre storlek oavsett rader/kolumner – två rutnät bredvid varandra
// (eller i två kort) är alltså lika stora helheter.
//
// view = {
//   component: "rutnat", rows, cols,
//   regions?: [{ cells: [cellindex …] }],  delar med OLIKA FORM men lika area (spec §4,
//                                          utmaning 01). Då är delarna regionerna (p0 … i
//                                          regionernas ordning); utan regions är delarna cellerna.
//   marked?: antal | [id],                 förmarkerade delar
//   second?: [cellindex …],                andra färgen/mönstret (överlappning visas korsrandig)
//   label?: "Hela rektangeln = 1",
// }
// Svar: paint { selected }.
// ============================================================================

import { h, s, skapaBas, malning, pekaPaDelar, helhetsEtikett } from "./bas.js";
import { rutnatCeller, regionKontur, markeradeIds, delId } from "./geometri.js";

const BREDD = 480;
const HOJD = 300;

export function createRutnat(host, view, opts = {}) {
  const { rows, cols } = view;
  const regions = view.regions?.length ? view.regions : null;
  const cw = BREDD / cols;
  const ch = HOJD / rows;
  const svg = s("svg", {
    class: "br-rutnat-svg", viewBox: `-6 -6 ${BREDD + 12} ${HOJD + 12}`, role: "group",
    "aria-label": opts.label || (regions ? `Rektangel delad i ${regions.length} delar` : `Rutnät med ${rows} rader och ${cols} kolumner`),
  });
  const rot = h("div", { class: "br-rutnat" }, helhetsEtikett(view.label || "Hela rektangeln = 1"), svg);
  const bas = skapaBas(host, rot, view, opts);
  const celler = rutnatCeller(rows, cols, BREDD, HOJD);
  const andra = new Set(view.second || []);

  svg.append(s("rect", { class: "br-helhetsram", x: -5, y: -5, width: BREDD + 10, height: HOJD + 10, rx: 8 }));
  const delar = [];
  const mitter = [];
  if (regions) {
    // Varje region är EN del: cellerna ritas som en grupp med kontur runt.
    regions.forEach((reg, i) => {
      const g = s("g", { class: "br-yta br-region", "data-del": delId(i) });
      for (const ci of reg.cells) {
        const c = celler[ci];
        g.append(s("rect", { x: c.x, y: c.y, width: c.w, height: c.h, class: "br-regioncell" }));
      }
      delar.push(g);
      const mx = reg.cells.reduce((a, ci) => a + celler[ci].x + cw / 2, 0) / reg.cells.length;
      const my = reg.cells.reduce((a, ci) => a + celler[ci].y + ch / 2, 0) / reg.cells.length;
      mitter.push([mx, my]);
      svg.append(g);
    });
    // Tunna cellinjer (lika stora rutor = lika area) och kraftiga regionkonturer.
    for (const c of celler) svg.append(s("rect", { class: "br-cellinje", x: c.x, y: c.y, width: c.w, height: c.h }));
    for (const reg of regions) {
      for (const k of regionKontur(reg.cells, rows, cols)) {
        svg.append(s("line", { class: "br-grans br-grans--gammal", x1: k.x1 * cw, y1: k.y1 * ch, x2: k.x2 * cw, y2: k.y2 * ch }));
      }
    }
  } else {
    for (const c of celler) {
      const r = s("rect", { x: c.x, y: c.y, width: c.w, height: c.h, class: "br-yta br-cell", "data-del": delId(c.i) });
      if (andra.has(c.i)) r.classList.add("br-andra");
      delar.push(r);
      mitter.push([c.x + c.w / 2, c.y + c.h / 2]);
      svg.append(r);
    }
    for (const c of celler) {
      if (andra.has(c.i)) svg.append(s("rect", { class: "br-monster-andra", x: c.x, y: c.y, width: c.w, height: c.h, "pointer-events": "none" }));
    }
  }
  svg.append(s("rect", { class: "br-kontur", x: 0, y: 0, width: BREDD, height: HOJD, rx: 3, "pointer-events": "none" }));

  const mal = malning(bas, delar, {
    namn: regions ? `Rektangel delad i ${regions.length} lika stora delar med olika form` : `Rutnät med ${rows * cols} lika stora rutor`,
    kolumner: regions ? 0 : cols,
    etikett: (i, n) => (regions ? `Del ${i + 1} av ${n}` : `Ruta rad ${Math.floor(i / cols) + 1}, kolumn ${(i % cols) + 1}`),
  });
  const start = markeradeIds(view.marked, delar.length);
  mal.satt(start);

  Object.assign(bas.api, {
    getAnswer: () => mal.svar(),
    setAnswer(a) { mal.satt(a?.selected); },
    reset() { mal.satt(start); bas.andrat(); },
    highlight(target) {
      pekaPaDelar(bas, delar, target, (d, i) => {
        const [x, y] = mitter[i];
        svg.append(s("text", { class: "br-nummer", x, y: y + 7, "text-anchor": "middle", text: String(i + 1) }));
      });
    },
  });
  return bas.api;
}
