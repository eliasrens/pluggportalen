// ============================================================================
// Hitta rätt! – SPIKE (#604): egen SVG-kartmotor (zoom, panorering, nål, val).
// ----------------------------------------------------------------------------
// Bevisar arkitekturbeslutet i docs/HITTA-RATT-ARKITEKTUR.md §1. Sub-issue C
// (#606) gör produktionsversionen i src/hitta-ratt/karta/ med samma API-form.
//
// Principer
//  • Geodatan är FÖRPROJICERAD (admin-skriptet) → webbläsaren parsar bara
//    färdiga path-strängar. Inga etiketter finns i datan, inga namn i DOM:en
//    (områden har ogenomskinliga id "o17").
//  • Kameran = EN transform på EN <g> (matrix k,0,0,k,tx,ty). Paths ritas
//    aldrig om vid zoom/panorering; linjebredder via vector-effect:
//    non-scaling-stroke. Alla skrivningar samlas till en per bildruta (rAF).
//  • Nålar, ringar runt små områden och resultatlinjen ligger i ett
//    skärm-lager OVANFÖR kameran (konstant storlek, få element att flytta).
//  • Klick ≠ drag: rörelse över tröskeln (mus 5 px, touch 10 px) eller två
//    fingrar gör gesten till panorering/zoom – aldrig till en gissning.
//
// API
//   const k = skapaKarta(värd, geo, { lage:"punkt"|"omrade", maxZoom, attribution })
//   k.on("gissning", ({ lon, lat }) => …)   punktläge: nål satt/flyttad
//   k.on("val", ({ id }) => …)              områdesläge: valt område
//   k.on("kamera", ({ zoom }) => …)
//   k.getGuess()  → { lon, lat } | null      k.getVal() → id | null
//   k.lock()                                 inga fler ändringar (zoom ok)
//   k.showResult({ guess, target })          punkt: båda nålar + linje + zoom
//   k.showAreaResult({ valt, ratt })         område: rätt grönt, fel rött+mönster
//   k.reset(), k.zoomIn(), k.zoomOut(), k.hem(), k.destroy()
// ============================================================================

import { tillKarta, tillLatLon } from "./projektion.js";
import { kopplaGester } from "./gester.js";

const NS = "http://www.w3.org/2000/svg";
const LITEN_PX = 16; // område mindre än så (diagonal i skärm-px) får klickring
const RING_R = 12;

function el(namn, attr = {}, foralder) {
  const e = document.createElementNS(NS, namn);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (foralder) foralder.appendChild(e);
  return e;
}

export function skapaKarta(yttre, geo, opts = {}) {
  const vard = yttre.appendChild(document.createElement("div"));
  const lyss = {};
  const emit = (typ, data) => (lyss[typ] || []).forEach((fn) => fn(data));
  const p = geo.proj;
  const W0 = p.bredd, H0 = p.hojd;
  let lage = opts.lage || "punkt";
  let last = false;

  // --- DOM ------------------------------------------------------------------
  vard.classList.add("hr-karta");
  vard.tabIndex = 0;
  vard.setAttribute("role", "application");
  vard.setAttribute("aria-label", "Karta. Dra för att flytta, scrolla eller nyp för att zooma, klicka för att svara.");
  const svg = el("svg", { class: "hr-svg" }, vard);
  const defs = el("defs", {}, svg);
  const monster = el("pattern", { id: "hr-rand", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 8, height: 8, fill: "var(--hr-fel)" }, monster);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#fff", "stroke-width": 3, "stroke-opacity": 0.55 }, monster);
  el("rect", { class: "hr-hav", x: 0, y: 0, width: "100%", height: "100%" }, svg);
  const kamera = el("g", { class: "hr-kamera" }, svg);
  el("path", { class: "hr-bakgrund", d: geo.lager.bakgrund }, kamera);
  const omradeG = el("g", { class: "hr-omraden" }, kamera);
  const omraden = new Map();
  for (const o of geo.omraden) {
    const path = el("path", { class: "hr-omrade", d: o.d, "data-id": o.id }, omradeG);
    omraden.set(o.id, { path, c: o.c, diag: 0 });
  }
  el("path", { class: "hr-sjoar", d: geo.lager.sjoar }, kamera);
  el("path", { class: "hr-vattendrag", d: geo.lager.vattendrag }, kamera);
  const valOverlay = el("path", { class: "hr-val-kontur" }, kamera);
  const rattOverlay = el("path", { class: "hr-ratt-kontur" }, kamera);
  const skarm = el("g", { class: "hr-skarm" }, svg);
  const ringG = el("g", { class: "hr-ringar" }, skarm);
  const linje = el("line", { class: "hr-linje" }, skarm);
  const nalRatt = nal("hr-nal-ratt");
  const nalGiss = nal("hr-nal-giss");

  function nal(cls) {
    const g = el("g", { class: `hr-nal ${cls}` }, skarm);
    el("path", { d: "M0 0C-3-9-12-13-12-22a12 12 0 1 1 24 0C12-13 3-9 0 0z" }, g);
    el("circle", { cy: -22, r: 4.5, class: "hr-nal-prick" }, g);
    g.style.display = "none";
    return g;
  }

  // Kontroller (+/–/hem) och diskret attribution.
  const ui = document.createElement("div");
  ui.className = "hr-kontroller";
  ui.innerHTML = `<button type="button" data-k="in" aria-label="Zooma in">+</button>
    <button type="button" data-k="ut" aria-label="Zooma ut">−</button>
    <button type="button" data-k="hem" aria-label="Visa hela kartan">⤢</button>`;
  vard.appendChild(ui);
  const attrib = document.createElement("div");
  attrib.className = "hr-attribution";
  attrib.textContent = opts.attribution || "";
  vard.appendChild(attrib);

  // Bbox per område (kartenheter) → vilka som är "små" och får en klickring.
  for (const o of omraden.values()) {
    const b = o.path.getBBox();
    o.diag = Math.hypot(b.width, b.height);
  }

  // --- Kamera ---------------------------------------------------------------
  let W = 1, H = 1;
  let k = 1, tx = 0, ty = 0, kMin = 1, kMax = 10, kHem = 1;
  let ritaBegard = false;

  function storlek() {
    const r = vard.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    kHem = Math.min(W / W0, H / H0);
    kMin = kHem * 0.85;
    kMax = kHem * (opts.maxZoom || 12);
  }

  function hem(anim) {
    const mal = { k: kHem * 0.97, cx: W0 / 2, cy: H0 / 2 };
    anim ? animera(mal) : satt(mal);
  }

  // Kamera uttryckt som (k, kartpunkt i vyns mitt) – lätt att begränsa/animera.
  function mitt() { return { k, cx: (W / 2 - tx) / k, cy: (H / 2 - ty) / k }; }
  function satt({ k: nk, cx, cy }) {
    k = Math.min(kMax, Math.max(kMin, nk));
    // Panoreringsgräns: vyns mittpunkt stannar inom kartrutan.
    cx = Math.min(W0, Math.max(0, cx));
    cy = Math.min(H0, Math.max(0, cy));
    tx = W / 2 - cx * k;
    ty = H / 2 - cy * k;
    rita();
  }

  function rita() {
    if (ritaBegard) return;
    ritaBegard = true;
    requestAnimationFrame(() => {
      ritaBegard = false;
      kamera.setAttribute("transform", `matrix(${k} 0 0 ${k} ${tx} ${ty})`);
      ritaSkarm();
      emit("kamera", { zoom: k / kHem });
      matFps();
    });
  }

  const tillSkarm = ([x, y]) => [x * k + tx, y * k + ty];

  function ritaSkarm() {
    for (const [id, o] of omraden) {
      const visa = lage === "omrade" && o.diag * k < LITEN_PX * 1.6;
      if (visa && !o.ring) {
        o.ring = el("circle", { class: "hr-ring", r: RING_R, "data-id": id }, ringG);
      }
      if (o.ring) {
        o.ring.style.display = visa ? "" : "none";
        if (visa) {
          const [sx, sy] = tillSkarm(o.c);
          o.ring.setAttribute("cx", sx.toFixed(1));
          o.ring.setAttribute("cy", sy.toFixed(1));
          o.ring.classList.toggle("vald", o.path.classList.contains("vald"));
        }
      }
    }
    for (const n of [nalGiss, nalRatt]) {
      if (!n.pos) continue;
      const [sx, sy] = tillSkarm(n.pos);
      n.setAttribute("transform", `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
    }
    if (nalGiss.pos && nalRatt.pos && linje.style.display !== "none") {
      const [x1, y1] = tillSkarm(nalGiss.pos), [x2, y2] = tillSkarm(nalRatt.pos);
      linje.setAttribute("x1", x1); linje.setAttribute("y1", y1);
      linje.setAttribute("x2", x2); linje.setAttribute("y2", y2);
    }
  }

  function zoomaVid(sx, sy, faktor) {
    const nk = Math.min(kMax, Math.max(kMin, k * faktor));
    const dx = (sx - tx) / k, dy = (sy - ty) / k; // kartpunkten under pekaren står still
    tx = sx - dx * nk;
    ty = sy - dy * nk;
    k = nk;
    satt(mitt());
  }

  let animId = 0;
  function animera(mal, ms = 380) {
    const fran = mitt();
    const id = ++animId;
    const t0 = performance.now();
    const steg = (nu) => {
      if (id !== animId) return;
      const t = Math.min(1, (nu - t0) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      satt({
        k: fran.k * (mal.k / fran.k) ** e, // geometrisk interpolation = jämn zoomkänsla
        cx: fran.cx + (mal.cx - fran.cx) * e,
        cy: fran.cy + (mal.cy - fran.cy) * e,
      });
      if (t < 1) requestAnimationFrame(steg);
    };
    requestAnimationFrame(steg);
  }
  const stoppaAnim = () => { animId++; };

  // --- Mätning (spike): bildrutetid under gester ------------------------------
  const fps = { senast: 0, ramar: [], aktiv: false };
  function matFps() {
    const nu = performance.now();
    if (fps.aktiv && fps.senast) fps.ramar.push(nu - fps.senast);
    fps.senast = nu;
  }

  // --- Gester (gester.js) → kamera/nål/val ---------------------------------
  const lossGester = kopplaGester(vard, {
    start() { stoppaAnim(); fps.ramar = []; fps.aktiv = true; fps.senast = 0; },
    slut() { fps.aktiv = false; },
    pan(dx, dy) { tx += dx; ty += dy; satt(mitt()); },
    zoom: zoomaVid,
    klick,
    arNal: (mal) => !last && lage === "punkt" && !!mal.closest?.(".hr-nal-giss"),
    nalFlytt(x, y) { nalGiss.pos = [(x - tx) / k, (y - ty) / k]; rita(); },
    nalSlapp: nalKlar,
  });

  vard.addEventListener("keydown", (e) => {
    const steg = 70;
    const m = mitt();
    const tangent = {
      ArrowLeft: () => animera({ ...m, cx: m.cx - steg / k }, 160),
      ArrowRight: () => animera({ ...m, cx: m.cx + steg / k }, 160),
      ArrowUp: () => animera({ ...m, cy: m.cy - steg / k }, 160),
      ArrowDown: () => animera({ ...m, cy: m.cy + steg / k }, 160),
      "+": () => api.zoomIn(), "=": () => api.zoomIn(), "-": () => api.zoomOut(),
    }[e.key];
    if (tangent) { e.preventDefault(); tangent(); }
  });

  ui.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.k === "in") api.zoomIn();
    if (b.dataset.k === "ut") api.zoomOut();
    if (b.dataset.k === "hem") hem(true);
  });

  // --- Svar --------------------------------------------------------------------
  let valtId = null;

  function klick(x, y, mal) {
    if (last) return;
    if (lage === "punkt") {
      nalGiss.pos = [(x - tx) / k, (y - ty) / k];
      nalGiss.style.display = "";
      nalKlar();
      rita();
      return;
    }
    // Område: ringen (små områden) eller själva pathen. Sjöar/älvar har
    // pointer-events:none, så klick i Vänern når landskapet under.
    const traff = (mal && mal.closest && mal.closest("[data-id]")) ||
      document.elementFromPoint(x + vard.getBoundingClientRect().left, y + vard.getBoundingClientRect().top)?.closest("[data-id]");
    if (!traff) return;
    valj(traff.getAttribute("data-id"));
  }

  function nalKlar() {
    const [lon, lat] = tillLatLon(p, nalGiss.pos[0], nalGiss.pos[1]);
    emit("gissning", { lon, lat });
  }

  function valj(id) {
    if (valtId) omraden.get(valtId)?.path.classList.remove("vald");
    valtId = id;
    const o = omraden.get(id);
    o.path.classList.add("vald");
    valOverlay.setAttribute("d", o.path.getAttribute("d"));
    rita();
    emit("val", { id });
  }

  const api = {
    on(typ, fn) { (lyss[typ] ||= []).push(fn); return api; },
    getGuess() {
      if (!nalGiss.pos) return null;
      const [lon, lat] = tillLatLon(p, nalGiss.pos[0], nalGiss.pos[1]);
      return { lon, lat };
    },
    getVal: () => valtId,
    lock() { last = true; vard.classList.add("last"); },
    showResult({ guess, target }) {
      api.lock();
      nalGiss.pos = tillKarta(p, guess.lon, guess.lat);
      nalRatt.pos = tillKarta(p, target.lon, target.lat);
      nalRatt.style.display = "";
      linje.style.display = "";
      // Zooma så båda syns (marginal 25 %), aldrig närmare än 6× hem.
      const [a, b] = [nalGiss.pos, nalRatt.pos];
      const bredd = Math.abs(a[0] - b[0]), hojd = Math.abs(a[1] - b[1]);
      const nk = Math.min(kHem * 6, (W * 0.6) / Math.max(bredd, 1), (H * 0.6) / Math.max(hojd + 40 / k, 1));
      animera({ k: Math.max(kHem, nk), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 - 12 / Math.max(kHem, nk) }, 650);
    },
    showAreaResult({ valt, ratt }) {
      api.lock();
      const r = omraden.get(ratt);
      r.path.classList.add("ratt");
      rattOverlay.setAttribute("d", r.path.getAttribute("d"));
      if (valt && valt !== ratt) omraden.get(valt)?.path.classList.add("fel");
      rita();
    },
    setLage(ny) { lage = ny; api.reset(); },
    reset() {
      last = false;
      vard.classList.remove("last");
      vard.classList.toggle("lage-punkt", lage === "punkt");
      for (const o of omraden.values()) o.path.classList.remove("vald", "ratt", "fel");
      valtId = null;
      valOverlay.removeAttribute("d");
      rattOverlay.removeAttribute("d");
      for (const n of [nalGiss, nalRatt]) { n.pos = null; n.style.display = "none"; }
      linje.style.display = "none";
      rita();
    },
    zoomIn() { const m = mitt(); animera({ ...m, k: m.k * 1.8 }, 220); },
    zoomOut() { const m = mitt(); animera({ ...m, k: m.k / 1.8 }, 220); },
    hem: () => hem(true),
    matning() {
      const r = fps.ramar.slice(1);
      if (!r.length) return null;
      const snitt = r.reduce((s, v) => s + v, 0) / r.length;
      return { ramar: r.length, snittMs: snitt, fps: 1000 / snitt, varstaMs: Math.max(...r) };
    },
    noder: () => svg.querySelectorAll("*").length,
    destroy() { ro.disconnect(); lossGester(); vard.remove(); },
  };

  const ro = new ResizeObserver(() => { const m = mitt(); const forst = W === 1; storlek(); forst ? hem(false) : satt(m); });
  ro.observe(vard);
  storlek();
  hem(false);
  api.reset();
  return api;
}
