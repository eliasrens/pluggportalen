// ============================================================================
// Bråkresan – figur med valfria delar (komponenter/figur.js) · #710 E
// ----------------------------------------------------------------------------
// Utmaning 01 "Lika stora delar": cirklar, stavar och rektanglar där delarna
// kan vara OLIKA stora (de andra komponenterna ritar alltid exakt lika stora
// delar). Delarnas storlek kommer ur datan – aldrig handritad skevhet:
//
// view = { component: "figur", form: "cirkel" | "stav" | "rektangel",
//   sizes?: [vikt …],               cirkel/stav: delarnas relativa storlek (vinkel/längd)
//   rows?, cols?, regions?: [{ cells }]  rektangel: delar = cellgrupper i ett rutnät
//                                         (lika många celler = lika stor area, även
//                                         med olika form – spec §4)
//   rutor?: true,                   visa rutnätets celler (tunna linjer) i rektangeln
//   marked?: [index …],             markerade delar (exempel i hjälpen)
//   jamfor?: true,                  hjälpens jämförelse: delarna läggs isär och jämförs
//                                   (stav: under varandra från samma startlinje, cirkel:
//                                   alla sektorer vridna till klockan 12 och överlagda,
//                                   rektangel: delarna bredvid varandra med sina rutor)
//   label? }
// Bara visning (kort, hjälp). Skärmläsartexten säger hur många delar figuren
// har – inte om de är lika stora, eftersom det är det eleven ska avgöra.
// ============================================================================

import { h, s, skapaBas, helhetsEtikett } from "./bas.js";
import { regionKontur } from "./geometri.js";

const R = 110;
const SIDA = 2 * R + 20;
const B = 600;
const H = 96;
const RB = 480;
const RH = 300;

const NAMN = { cirkel: "Cirkel", stav: "Stav", rektangel: "Rektangel" };
const f = (v) => Math.round(v * 1000) / 1000;

/** Sektorernas start- och slutvinkel (grader, medurs från klockan 12) ur vikterna. */
export function figurVinklar(sizes) {
  const tot = sizes.reduce((a, b) => a + b, 0);
  let acc = 0;
  return sizes.map((w) => {
    const a0 = (acc / tot) * 360;
    acc += w;
    return { a0, a1: (acc / tot) * 360 };
  });
}

function sektor(cx, cy, r, g0, g1) {
  const p = (g) => {
    const rad = ((g - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  if (g1 - g0 >= 359.999) {
    return `M ${f(cx)} ${f(cy - r)} A ${r} ${r} 0 1 1 ${f(cx)} ${f(cy + r)} A ${r} ${r} 0 1 1 ${f(cx)} ${f(cy - r)} Z`;
  }
  const [x0, y0] = p(g0);
  const [x1, y1] = p(g1);
  return `M ${f(cx)} ${f(cy)} L ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${g1 - g0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z`;
}

function ritaCirkel(svg, view, markerad) {
  const cx = SIDA / 2;
  const cy = SIDA / 2;
  svg.setAttribute("viewBox", `0 0 ${SIDA} ${SIDA}`);
  const v = figurVinklar(view.sizes);
  if (view.jamfor) {
    // Alla sektorer vridna till samma start och överlagda: skillnaden syns i kanten.
    svg.append(s("circle", { class: "br-figur-skugga", cx, cy, r: R }));
    v.forEach((x, i) => svg.append(s("path", { class: "br-figur-overlagg", d: sektor(cx, cy, R, 0, x.a1 - x.a0), "data-i": i })));
    svg.append(s("circle", { class: "br-mittpunkt", cx, cy, r: 3 }));
    return;
  }
  v.forEach((x, i) => svg.append(s("path", { class: `br-yta br-figur-del${markerad(i) ? " br-vald" : ""}`, d: sektor(cx, cy, R, x.a0, x.a1) })));
  svg.append(s("circle", { class: "br-kontur", cx, cy, r: R }));
  if (view.sizes.length > 1) svg.append(s("circle", { class: "br-mittpunkt", cx, cy, r: 3 }));
}

function ritaStav(svg, view, markerad) {
  const tot = view.sizes.reduce((a, b) => a + b, 0);
  if (view.jamfor) {
    // Delarna under varandra från samma startlinje: olika längd syns direkt.
    const hh = 40;
    const gap = 12;
    const hojd = view.sizes.length * (hh + gap);
    svg.setAttribute("viewBox", `0 0 ${B + 8} ${hojd}`);
    svg.append(s("line", { class: "br-figur-startlinje", x1: 4, x2: 4, y1: 0, y2: hojd }));
    view.sizes.forEach((w, i) => {
      const y = i * (hh + gap) + gap / 2;
      svg.append(s("rect", { class: "br-yta br-figur-del br-vald", x: 4, y, width: (w / tot) * B, height: hh, rx: 3 }),
        s("rect", { class: "br-kontur", x: 4, y, width: (w / tot) * B, height: hh, rx: 3 }));
    });
    return;
  }
  svg.setAttribute("viewBox", `0 0 ${B + 8} ${H + 8}`);
  let x = 4;
  view.sizes.forEach((w, i) => {
    const b = (w / tot) * B;
    svg.append(s("rect", { class: `br-yta br-figur-del${markerad(i) ? " br-vald" : ""}`, x, y: 4, width: b, height: H }));
    if (i > 0) svg.append(s("line", { class: "br-grans", x1: x, x2: x, y1: 4, y2: 4 + H }));
    x += b;
  });
  svg.append(s("rect", { class: "br-kontur", x: 4, y: 4, width: B, height: H, rx: 4 }));
}

function ritaRektangel(svg, view, markerad) {
  const { rows, cols, regions } = view;
  const cw = RB / cols;
  const ch = RH / rows;
  if (view.jamfor) {
    // Delarna bredvid varandra, var och en med sina rutor: räkna rutorna.
    const boxar = regions.map((reg) => {
      const r = reg.cells.map((c) => Math.floor(c / cols));
      const k = reg.cells.map((c) => c % cols);
      return { reg, r0: Math.min(...r), c0: Math.min(...k), hr: Math.max(...r) - Math.min(...r) + 1, wc: Math.max(...k) - Math.min(...k) + 1 };
    });
    const skala = 0.5;
    let x = 0;
    const hojd = Math.max(...boxar.map((b) => b.hr)) * ch * skala;
    for (const b of boxar) {
      const g = s("g", { transform: `translate(${f(x)} 0) scale(${skala})` });
      for (const c of b.reg.cells) {
        const cx = (c % cols) - b.c0;
        const cy = Math.floor(c / cols) - b.r0;
        g.append(s("rect", { class: "br-yta br-figur-del br-vald", x: cx * cw, y: cy * ch, width: cw, height: ch }),
          s("rect", { class: "br-cellinje br-figur-ruta", x: cx * cw, y: cy * ch, width: cw, height: ch }));
      }
      const lokal = b.reg.cells.map((c) => (Math.floor(c / cols) - b.r0) * b.wc + ((c % cols) - b.c0));
      for (const k of regionKontur(lokal, b.hr, b.wc)) {
        g.append(s("line", { class: "br-grans br-grans--gammal", x1: k.x1 * cw, y1: k.y1 * ch, x2: k.x2 * cw, y2: k.y2 * ch }));
      }
      svg.append(g);
      x += b.wc * cw * skala + 24;
    }
    svg.setAttribute("viewBox", `-6 -6 ${f(x - 24 + 12)} ${f(hojd + 12)}`);
    return;
  }
  svg.setAttribute("viewBox", `-6 -6 ${RB + 12} ${RH + 12}`);
  regions.forEach((reg, i) => {
    const g = s("g", { class: `br-yta br-region br-figur-del${markerad(i) ? " br-vald" : ""}` });
    for (const c of reg.cells) {
      g.append(s("rect", { class: "br-regioncell", x: (c % cols) * cw, y: Math.floor(c / cols) * ch, width: cw, height: ch }));
    }
    svg.append(g);
  });
  if (view.rutor) {
    for (let c = 0; c < rows * cols; c++) {
      svg.append(s("rect", { class: "br-cellinje br-figur-ruta", x: (c % cols) * cw, y: Math.floor(c / cols) * ch, width: cw, height: ch }));
    }
  }
  for (const reg of regions) {
    for (const k of regionKontur(reg.cells, rows, cols)) {
      svg.append(s("line", { class: "br-grans br-grans--gammal", x1: k.x1 * cw, y1: k.y1 * ch, x2: k.x2 * cw, y2: k.y2 * ch }));
    }
  }
  svg.append(s("rect", { class: "br-kontur", x: 0, y: 0, width: RB, height: RH, rx: 3 }));
}

/** Antal delar i figuren. */
export const figurDelar = (view) => (view.form === "rektangel" ? view.regions.length : view.sizes.length);

export function createFigur(host, view, opts = {}) {
  const form = NAMN[view.form] ? view.form : "stav";
  const svg = s("svg", { class: `br-figur-svg br-figur-svg--${form}${view.jamfor ? " br-figur-svg--jamfor" : ""}`, preserveAspectRatio: "xMidYMid meet" });
  const helhet = view.label || (form === "cirkel" ? "Hela cirkeln = 1" : form === "stav" ? "Hela staven = 1" : "Hela rektangeln = 1");
  const rot = h("div", { class: "br-figur" }, view.jamfor ? null : helhetsEtikett(helhet), svg);
  const bas = skapaBas(host, rot, view, { ...opts, interactive: false });
  const markerade = new Set((view.marked || []).map(Number));
  const markerad = (i) => markerade.has(i);
  if (form === "cirkel") ritaCirkel(svg, view, markerad);
  else if (form === "stav") ritaStav(svg, view, markerad);
  else ritaRektangel(svg, view, markerad);
  const n = figurDelar({ ...view, form });
  rot.setAttribute("role", "img");
  rot.setAttribute("aria-label", opts.label || (view.jamfor
    ? `Delarna lagda bredvid varandra för att jämföra storleken`
    : `${NAMN[form]} delad i ${n} delar${markerade.size ? `, ${markerade.size} markerade` : ""}`));
  Object.assign(bas.api, {
    highlight(target) { rot.classList.toggle("br-pekar-helhet", !!target?.whole); },
  });
  return bas.api;
}
