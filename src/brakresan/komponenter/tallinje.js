// ============================================================================
// Bråkresan – 6. Tallinje (komponenter/tallinje.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 6: linjär skala x(v) = x0 + (v − min)/(max − min) · bredd
// (geometri.xAv), delsträckor skilda från markeringar (fyra delar = fem streck),
// bråketiketter, punkter, dragning och klickplacering. Snäppning till
// uppgiftens tillåtna värden (multiplar av 1/snap). Skalan zoomas aldrig om.
//
// view = {
//   component: "tallinje",
//   min: 0 | {n,d}, max: 1 | {n,d}, ticks: 4,     markering var 1/ticks
//   labels?: "alla" | "hela" | [{n,d} …],          vilka streck som får etikett (ändarna alltid)
//   points?: [{ id, value: {n,d}, label? }],       punkter att visa / välja bland (choice)
//   snap?: tal,                                    placeringens steg 1/snap (standard ticks)
//   label?: "Från 0 till 1 är en hel",
// }
// Svar: point { value: {n,d} } (klick, drag, piltangenter, Home/End) eller
//       choice { id } (en av punkterna). opts.answer avgör läget.
// ============================================================================

import { h, s, skapaBas, svgBrak, helhetsEtikett } from "./bas.js";
import { xAv, tallinjeMarkeringar, snappa, snappSteg } from "./geometri.js";
import { toQ, eq, cmp, ZERO, speakForm, fractionFormOf } from "../math/index.js";

const X0 = 40;
const BREDD = 560;
const Y = 74;

const talOrd = (v) => speakForm(fractionFormOf(v));

export function createTallinje(host, view, opts = {}) {
  const min = toQ(view.min ?? 0);
  const max = toQ(view.max ?? 1);
  const ticks = view.ticks || 1;
  const snap = view.snap || opts.answer?.snap || ticks;
  const lage = opts.answer?.type === "point" ? "punkt" : opts.answer?.type === "choice" ? "val" : "visning";
  const markeringar = tallinjeMarkeringar(min, max, ticks);
  const x = (v) => xAv(v, min, max, X0, BREDD);
  const avstand = BREDD / (markeringar.length - 1);
  const svg = s("svg", { class: "br-tallinje-svg", viewBox: `0 0 ${X0 * 2 + BREDD} 180` });
  const rot = h("div", { class: "br-tallinje" }, helhetsEtikett(view.label || "Från 0 till 1 är en hel"), svg);
  const bas = skapaBas(host, rot, view, opts);
  let varde = null;
  let valt = null;

  // Linjen, helhetsramen 0–1 och markeringarna.
  if (cmp(min, ZERO) <= 0 && cmp(max, { n: 1, d: 1 }) >= 0) {
    svg.append(s("rect", { class: "br-helhetsram", x: x(0) - 6, y: Y - 26, width: x(1) - x(0) + 12, height: 52, rx: 8 }));
  }
  const linje = s("g", { class: "br-linje" });
  linje.append(s("line", { class: "br-kontur", x1: X0, x2: X0 + BREDD, y1: Y, y2: Y }));
  const sistaIndex = markeringar.length - 1;
  const etikett = (m) => {
    if (m.k === 0 || m.k === sistaIndex) return true;
    if (Array.isArray(view.labels)) return view.labels.some((l) => eq(toQ(l), m.value));
    if (view.labels === "hela") return m.hel;
    return view.labels === "alla" || (view.labels === undefined && avstand >= 34) || m.hel;
  };
  for (const m of markeringar) {
    const xm = x(m.value);
    linje.append(s("line", { class: m.hel ? "br-streck br-streck--hel" : "br-streck", x1: xm, x2: xm, y1: Y - (m.hel ? 16 : 10), y2: Y + (m.hel ? 16 : 10) }));
    if (!etikett(m)) continue;
    if (m.hel) linje.append(s("text", { class: "br-etikett", x: xm, y: Y + 60, "text-anchor": "middle", text: String(m.value.n) }));
    else {
      // Etiketten skrivs i linjens indelning (2/4 på en fjärdedelslinje), inte förkortad.
      const k = (m.value.n * ticks) / m.value.d;
      linje.append(svgBrak(xm, Y + 56, k, ticks, 30, { class: "br-svgbrak br-etikett" }));
    }
  }
  svg.append(linje);
  const delstrackor = s("g", { class: "br-delstrackor" });
  svg.append(delstrackor);

  // Punkter (visning eller val).
  const punktKnappar = [];
  for (const [i, p] of (view.points || []).entries()) {
    const xp = x(p.value);
    const namn = p.label || String.fromCharCode(65 + i);
    const g = s("g", { class: "br-punkt", "data-punkt": p.id });
    g.append(s("circle", { cx: xp, cy: Y, r: 11 }), s("text", { class: "br-punktnamn", x: xp, y: Y - 24, "text-anchor": "middle", text: namn }));
    if (lage === "val") {
      g.setAttribute("role", "radio");
      g.setAttribute("tabindex", i === 0 ? "0" : "-1");
      g.setAttribute("aria-checked", "false");
      g.setAttribute("aria-label", `Punkt ${namn}`);
      g.prepend(s("rect", { class: "br-traffyta", x: xp - 36, y: Y - 54, width: 72, height: 78, rx: 10 }));
      punktKnappar.push(g);
    }
    svg.append(g);
  }
  if (lage === "val") svg.setAttribute("role", "radiogroup");
  svg.setAttribute("aria-label", opts.label || `Tallinje från ${talOrd(min)} till ${talOrd(max)}`);

  // Elevens punkt (point-läget).
  const markor = s("g", { class: "br-markor", visibility: "hidden" },
    s("line", { x1: 0, x2: 0, y1: Y - 40, y2: Y + 20 }), s("circle", { cx: 0, cy: Y - 42, r: 15 }));
  if (lage === "punkt") {
    svg.append(s("rect", { class: "br-traffyta", x: X0 - 20, y: Y - 62, width: BREDD + 40, height: 96 }), markor);
    svg.setAttribute("role", "slider");
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("aria-valuemin", String(min.n / min.d));
    svg.setAttribute("aria-valuemax", String(max.n / max.d));
    svg.setAttribute("aria-valuetext", "Ingen punkt placerad");
  }

  const visaPunkt = () => {
    if (varde === null) {
      markor.setAttribute("visibility", "hidden");
      svg.setAttribute("aria-valuetext", "Ingen punkt placerad");
      svg.removeAttribute("aria-valuenow");
      return;
    }
    markor.setAttribute("visibility", "visible");
    markor.setAttribute("transform", `translate(${x(varde)} 0)`);
    svg.setAttribute("aria-valuenow", String(varde.n / varde.d));
    svg.setAttribute("aria-valuetext", talOrd(varde));
  };
  const visaVal = () => punktKnappar.forEach((g) => {
    const pa = g.dataset.punkt === valt;
    g.setAttribute("aria-checked", String(pa));
    g.classList.toggle("br-vald", pa);
  });
  const satt = (v) => {
    if (bas.last || !bas.interaktiv) return;
    if (varde && v && eq(v, varde)) return;
    varde = v;
    visaPunkt();
    bas.andrat();
  };
  const xUrHandelse = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse()).x;
  };

  if (lage === "punkt" && bas.interaktiv) {
    let drar = null;
    svg.addEventListener("pointerdown", (e) => {
      if (bas.last) return;
      e.preventDefault();
      drar = e.pointerId;
      svg.setPointerCapture?.(e.pointerId);
      svg.focus({ preventScroll: true });
      satt(snappa(xUrHandelse(e), min, max, X0, BREDD, snap));
    });
    svg.addEventListener("pointermove", (e) => {
      if (drar === e.pointerId) satt(snappa(xUrHandelse(e), min, max, X0, BREDD, snap));
    });
    const slapp = () => { drar = null; };
    svg.addEventListener("pointerup", slapp);
    svg.addEventListener("pointercancel", slapp);
    svg.addEventListener("keydown", (e) => {
      const steg = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (steg) { e.preventDefault(); satt(varde ? snappSteg(varde, steg, min, max, snap) : min); }
      else if (e.key === "Home") { e.preventDefault(); satt(min); }
      else if (e.key === "End") { e.preventDefault(); satt(max); }
    });
  }
  if (lage === "val" && bas.interaktiv) {
    const valj = (g) => {
      if (bas.last || !g) return;
      valt = valt === g.dataset.punkt ? null : g.dataset.punkt;
      visaVal();
      bas.andrat();
    };
    svg.addEventListener("click", (e) => valj(e.target.closest?.(".br-punkt")));
    svg.addEventListener("keydown", (e) => {
      const g = e.target.closest?.(".br-punkt");
      const i = punktKnappar.indexOf(g);
      if (i < 0) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); valj(g); return; }
      const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      const n = punktKnappar[(j + punktKnappar.length) % punktKnappar.length];
      punktKnappar.forEach((p) => p.setAttribute("tabindex", p === n ? "0" : "-1"));
      n.focus();
    });
  }

  Object.assign(bas.api, {
    getAnswer: () => (lage === "punkt" ? (varde ? { value: { n: varde.n, d: varde.d } } : null) : lage === "val" && valt ? { id: valt } : null),
    setAnswer(a) {
      if (lage === "punkt") { varde = a?.value ? toQ(a.value) : null; visaPunkt(); }
      if (lage === "val") { valt = a?.id ?? null; visaVal(); }
    },
    reset() { varde = null; valt = null; visaPunkt(); visaVal(); bas.andrat(); },
    highlight(target) {
      rot.classList.toggle("br-pekar-helhet", !!target?.whole);
      delstrackor.replaceChildren();
      if (!target?.count) return;
      // Delsträckorna numreras (inte strecken): fyra delar = fem streck.
      for (let i = 0; i < markeringar.length - 1; i++) {
        const a = x(markeringar[i].value);
        const b = x(markeringar[i + 1].value);
        delstrackor.append(
          s("path", { class: "br-bage", d: `M ${a + 2} ${Y - 4} Q ${(a + b) / 2} ${Y - 30} ${b - 2} ${Y - 4}` }),
          s("text", { class: "br-nummer", x: (a + b) / 2, y: Y - 22, "text-anchor": "middle", text: String(i + 1) }));
      }
    },
  });
  return bas.api;
}
