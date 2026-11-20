// ============================================================================
// Matchdagen (#869): 2D-RESERVEN (spec §4) – planen ovanifrån i SVG, som i
// skissens första version. Används utan WebGL (harWebGL() === false), när
// three inte går att ladda, och med ?2d=1. Samma RITAR-GRÄNSSNITT som
// 3D-ritaren (md-tre-ritare.js) – matchen är identisk, bara ritandet skiljer.
// Ingen three.js, inga importer utöver formationens mått.
// ============================================================================

import { PLAN_B, PLAN_L } from "./md-formation.js";

const NS = "http://www.w3.org/2000/svg";
const NUMMER = [1, 2, 3, 6, 8, 9, 10];
const NUMMER_DEM = [1, 4, 5, 7, 11, 14, 19];

const svgEl = (namn, attr = {}) => {
  const e = document.createElementNS(NS, namn);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  return e;
};
const ljus = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 160;
};

export function skapa2dRitare({ yta, lugnt = false }) {
  const svg = svgEl("svg", { viewBox: `0 0 ${PLAN_L} ${PLAN_B}`, class: "md-plan2d", role: "img", "aria-label": "Fotbollsplanen ovanifrån" });
  svg.innerHTML = `<defs><pattern id="md2-rand" width="21" height="68" patternUnits="userSpaceOnUse"><rect width="10.5" height="68" fill="#2f8f45"/><rect x="10.5" width="10.5" height="68" fill="#2a8240"/></pattern></defs>
    <rect width="105" height="68" fill="url(#md2-rand)"/>
    <g fill="none" stroke="#fff" stroke-width=".45" opacity=".9"><rect x="2" y="2" width="101" height="64"/><line x1="52.5" y1="2" x2="52.5" y2="66"/><circle cx="52.5" cy="34" r="9.15"/>
      <rect x="2" y="16" width="16.5" height="36"/><rect x="86.5" y="16" width="16.5" height="36"/><rect x="2" y="26" width="5.5" height="16"/><rect x="97.5" y="26" width="5.5" height="16"/></g>
    <rect class="md2-mal" data-sida="vi" x="0" y="30.3" width="2" height="7.4" fill="#fff" opacity=".85"/>
    <rect class="md2-mal" data-sida="dem" x="103" y="30.3" width="2" height="7.4" fill="#fff" opacity=".85"/>
    <g class="md2-lag" data-lag="dem"></g><g class="md2-lag" data-lag="vi"></g>
    <g class="md2-boll"><ellipse class="md2-bollskugga" rx="1.1" ry=".7" cy=".9" fill="#000" opacity=".3"/><circle class="md2-bollen" r="1.1" fill="#fff" stroke="#111" stroke-width=".3"/></g>`;
  if (lugnt) svg.classList.add("lugnt");
  yta.appendChild(svg);
  const bollG = svg.querySelector(".md2-boll");
  let bollPos = [PLAN_L / 2, PLAN_B / 2];
  bollG.style.transform = `translate(${bollPos[0]}px,${bollPos[1]}px)`;
  const kapten = { i: -1, bild: null };

  // fps i 2D: räknas med en egen rAF-räknare (bara för rapporten).
  const bilder = [];
  let raf = 0, levande = true;
  const rakna = (nu) => { if (!levande) return; bilder.push(nu); if (bilder.length > 240) bilder.shift(); raf = requestAnimationFrame(rakna); };
  raf = requestAnimationFrame(rakna);

  function lag(sida, { troja, mv, kapten: k = -1 }) {
    const g = svg.querySelector(`[data-lag="${sida}"]`);
    const nr = sida === "vi" ? NUMMER : NUMMER_DEM;
    g.innerHTML = nr.map((n, i) => {
      const f = i ? troja : mv;
      return `<g class="md2-spelare" data-i="${i}"><g class="md2-hopp"><circle r="2.1" fill="${f}" stroke="#0a1220" stroke-width=".45"/>
        ${i === k ? `<circle class="md2-bindel" r="2.75" fill="none" stroke="#ffd23f" stroke-width=".55"/>` : ""}
        <text y=".9" text-anchor="middle" font-size="2.4" font-weight="800" fill="${ljus(f) ? "#1b1500" : "#fff"}" font-family="Nunito, sans-serif">${n}</text></g></g>`;
    }).join("");
    if (sida === "vi") { kapten.i = k; ritaAvatar(); }
  }
  function spelare(sida, pos, { direkt = false } = {}) {
    svg.querySelectorAll(`[data-lag="${sida}"] .md2-spelare`).forEach((g, i) => {
      if (direkt) g.style.transition = "none";
      g.style.transform = `translate(${pos[i][0]}px,${pos[i][1]}px)`;
      if (direkt) { g.getBoundingClientRect(); g.style.transition = ""; }
    });
  }
  function ritaAvatar() {
    const g = svg.querySelector(`[data-lag="vi"] .md2-spelare[data-i="${kapten.i}"] .md2-hopp`);
    if (!g || !kapten.bild) return;
    g.querySelector(".md2-avatar")?.remove();
    const img = svgEl("image", { class: "md2-avatar", x: -2.2, y: -8.4, width: 4.4, height: 5.3, href: kapten.bild });
    g.appendChild(img);
  }
  function avatar(canvas) {
    try { kapten.bild = canvas?.toDataURL("image/png") || null; } catch { kapten.bild = null; }
    ritaAvatar();
  }

  /** Bollen: rullar (hojd 0), går i båge (stor i mitten av flykten) eller flyger mot mål. */
  function boll(x, y, { hojd = 0, ms = 600 } = {}) {
    const fran = bollPos;
    bollPos = [x, y];
    bollG.getAnimations?.().forEach((a) => a.cancel());
    bollG.style.transform = `translate(${x}px,${y}px)`;
    if (lugnt || ms <= 0 || !bollG.animate) return;
    const s = 1 + Math.min(1.2, hojd / 5);
    bollG.animate([
      { transform: `translate(${fran[0]}px,${fran[1]}px) scale(1)` },
      { transform: `translate(${(fran[0] + x) / 2}px,${(fran[1] + y) / 2}px) scale(${s})`, offset: 0.5 },
      { transform: `translate(${x}px,${y}px) scale(1)` },
    ], { duration: ms, easing: hojd > 0 ? "linear" : "cubic-bezier(.3,.1,.3,1)" });
  }
  function firar(sida, pa) {
    svg.querySelector(`[data-lag="${sida}"]`)?.classList.toggle("firar", !!pa && !lugnt);
  }
  function malEffekt(sida) {
    if (lugnt) return;
    const m = svg.querySelector(`.md2-mal[data-sida="${sida}"]`);
    m?.animate?.([{ fill: "#fff" }, { fill: "#ffd23f" }, { fill: "#fff" }], { duration: 900 });
  }

  /**
   * Straffläggningen (§7.4): "kameran" visar straffområdet – en mindre viewBox kring
   * målet, förankrad vid målets kant. Lugnt läge: hela planen (ingen zoom).
   */
  function straffVy(lag) {
    if (lugnt || !lag) {
      svg.setAttribute("viewBox", `0 0 ${PLAN_L} ${PLAN_B}`);
      svg.removeAttribute("preserveAspectRatio");
      return;
    }
    const hoger = lag === "oss";
    svg.setAttribute("viewBox", hoger ? `${PLAN_L - 40} 12 40 44` : "0 12 40 44");
    svg.setAttribute("preserveAspectRatio", hoger ? "xMaxYMid meet" : "xMinYMid meet");
  }

  return {
    typ: "2d",
    lag, spelare, boll, firar, malEffekt, avatar, straffVy,
    zoom() {}, uppdateraAvatar() {},
    fps() {
      if (bilder.length < 10) return { snitt: 0, lagst: 0, bilder: bilder.length };
      const d = [];
      for (let i = 1; i < bilder.length; i++) d.push(bilder[i] - bilder[i - 1]);
      return { snitt: Math.round(10000 / (d.reduce((a, b) => a + b, 0) / d.length)) / 10, lagst: 0, bilder: bilder.length };
    },
    dispose() { levande = false; cancelAnimationFrame(raf); svg.remove(); },
  };
}

