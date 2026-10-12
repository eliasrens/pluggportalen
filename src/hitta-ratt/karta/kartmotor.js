// ============================================================================
// Hitta rätt! – egen SVG-kartmotor (src/hitta-ratt/karta/kartmotor.js) · #606
// ----------------------------------------------------------------------------
// Beslut och mätningar: docs/HITTA-RATT-ARKITEKTUR.md §1 (spike #604).
// Laddas BARA dynamiskt (import() från Hitta rätt!-sidan) – aldrig från en
// bootfil (#271). Ingen extern request: geodatan är förprojicerad JSON i repot.
//
//  • Inga etiketter i datan, inga namn i DOM:en (ogenomskinliga id "o17",
//    inga <title>, ingen områdesspecifik aria-label). Rätt svar kommer in i
//    motorn först i showResult/showAreaResult (efter lås).
//  • Kameran = EN transform på EN <g>, skriven högst en gång per bildruta
//    (rAF). Paths ritas aldrig om vid zoom/panorering; linjebredder via
//    vector-effect: non-scaling-stroke. (kamerastyrning.js, kamera.js)
//  • Nålar, ringar, linje och etiketter ligger i skärmlagret. (skarmlager.js)
//  • Klick ≠ drag: rörelse över tröskeln eller två fingrar gör gesten till
//    panorering/zoom – aldrig till en gissning. (gester.js)
//
// API
//   const k = skapaKarta(värd, geo, {
//     lage: "punkt" | "omrade",
//     maxZoom: 10, minZoom: 0.85,  gånger helvyn (packen)
//     startvy: [v, s, ö, n],       lon/lat-ruta som fyller kartan (annars hela geon)
//     panGrans: [v, s, ö, n],      vyns mittpunkt stannar här (annars hela geon)
//     visaGranser: true | "svag" | false,   inre gränser (landskap/län)
//     attribution: "Kartdata: …",
//     laddaDetalj: () => Promise<geo>,      valfri: finare paths vid inzoomning
//     detaljVid: 3,                ladda detaljen när zoomen > 3 × helvyn
//   })
//   k.on("gissning", ({ lon, lat }) => …)   punktläge: nål satt/flyttad
//   k.on("val", ({ id }) => …)              områdesläge: valt område
//   k.on("kamera", ({ zoom }) => …)         zoom relativt helvyn
//   k.getGuess() → { lon, lat } | null      k.getVal() → id | null
//   k.lock()                                inga fler ändringar (zoom ok)
//   k.showResult({ guess, target, km, label })   båda nålar + linje + zoom
//   k.showAreaResult({ valt, ratt, label })      rätt grönt, fel rött mönster
//   k.setLage(lage), k.reset({ hem = true }), k.zoomIn(), k.zoomOut(), k.hem(), k.destroy()
//     reset() = ny fråga: tömmer svar/resultat och glider tillbaka till startvyn
//   k.matning() → senaste gestens bildrutor (preview/QA)
// ============================================================================

import { tillKarta, tillLatLon, rutaTillKarta } from "./projektion.js";
import { kopplaGester } from "./gester.js";
import { vagRuta } from "./kamera.js";
import { skapaKamerastyrning, VISA_LUFT } from "./kamerastyrning.js";
import { skapaSkarmlager, svgEl as el } from "./skarmlager.js";
import { ensureKartaCss } from "./karta-stil.js";

const KNAPP_ZOOM = 1.8;
const TANGENT_STEG = 80; // px per piltryck
const HJALP = {
  punkt: "Karta. Dra för att flytta, scrolla eller nyp för att zooma, klicka för att sätta din nål. Tangentbord: pilar flyttar, plus och minus zoomar, Enter sätter nålen i mitten.",
  omrade: "Karta. Dra för att flytta, scrolla eller nyp för att zooma, klicka på ett område för att välja det. Tangentbord: pilar flyttar, plus och minus zoomar, Enter väljer området i mitten.",
};

let instans = 0;

export function skapaKarta(yttre, geo, opts = {}) {
  ensureKartaCss();
  const nr = ++instans;
  const lyss = {};
  const emit = (typ, data) => (lyss[typ] || []).forEach((fn) => fn(data));
  const p = geo.proj;
  const hela = [0, 0, p.bredd, p.hojd];
  let lage = opts.lage || "punkt";
  let last = false;
  let valtId = null;
  let harFel = false;

  // --- DOM: kartans lager i ritordning -------------------------------------
  const vard = yttre.appendChild(document.createElement("div"));
  vard.className = "hr-karta";
  const granser = opts.visaGranser ?? true;
  if (granser === "svag") vard.classList.add("granser-svag");
  if (granser === false) vard.classList.add("granser-av");
  vard.tabIndex = 0;
  vard.setAttribute("role", "application");
  vard.setAttribute("aria-roledescription", "karta");
  const svg = el("svg", { class: "hr-svg", "aria-hidden": "true" }, vard);
  const defs = el("defs", {}, svg);
  const randId = `hr-rand-${nr}`;
  const monster = el("pattern", { id: randId, width: 10, height: 10, patternUnits: "userSpaceOnUse" }, defs);
  el("rect", { width: 10, height: 10, fill: "var(--hr-fel)" }, monster);
  el("rect", { width: 4, height: 10, fill: "#fff", "fill-opacity": 0.6 }, monster);
  el("rect", { class: "hr-hav", x: 0, y: 0, width: "100%", height: "100%" }, svg);
  const kamera = el("g", { class: "hr-kamera" }, svg);
  const lager = { bakgrund: el("path", { class: "hr-bakgrund", d: geo.lager?.bakgrund || "" }, kamera) };
  const omradeG = el("g", { class: "hr-omraden" }, kamera);
  const omraden = new Map();
  for (const o of geo.omraden || []) {
    const path = el("path", { class: "hr-omrade", d: o.d, "data-id": o.id }, omradeG);
    const [x0, y0, x1, y1] = vagRuta(o.d);
    omraden.set(o.id, { path, c: o.c || [(x0 + x1) / 2, (y0 + y1) / 2], diag: Math.hypot(x1 - x0, y1 - y0) });
  }
  lager.sjoar = el("path", { class: "hr-sjoar", d: geo.lager?.sjoar || "" }, kamera);
  lager.vattendrag = el("path", { class: "hr-vattendrag", d: geo.lager?.vattendrag || "" }, kamera);
  // Kopior av valt/fel/rätt område ovanpå, så konturen inte döljs av grannarna.
  const kontur = {
    fel: el("path", { class: "hr-fel-kontur" }, kamera),
    vald: el("path", { class: "hr-val-kontur" }, kamera),
    ratt: el("path", { class: "hr-ratt-kontur" }, kamera),
  };
  const skarm = skapaSkarmlager(svg, omraden);

  const ui = document.createElement("div");
  ui.className = "hr-kontroller";
  ui.innerHTML = `<button type="button" data-k="in" aria-label="Zooma in" title="Zooma in">+</button>
    <button type="button" data-k="ut" aria-label="Zooma ut" title="Zooma ut">−</button>
    <button type="button" data-k="hem" aria-label="Visa hela kartan" title="Visa hela kartan">⤢</button>`;
  vard.appendChild(ui);
  const knapp = (k) => ui.querySelector(`[data-k="${k}"]`);
  const attrib = document.createElement("div");
  attrib.className = "hr-attribution";
  attrib.textContent = opts.attribution || "";
  vard.appendChild(attrib);

  // --- Kamera: EN skrivning per bildruta -------------------------------------
  let ritaBegard = false;
  let rafId = 0;
  const kam = skapaKamerastyrning({
    startRuta: opts.startvy ? rutaTillKarta(p, opts.startvy) : hela,
    panRuta: opts.panGrans ? rutaTillKarta(p, opts.panGrans) : hela,
    minZoom: opts.minZoom ?? 0.85,
    maxZoom: opts.maxZoom ?? 10,
    rita,
    klar: efterRorelse,
  });

  function rita() {
    if (ritaBegard) return;
    ritaBegard = true;
    rafId = requestAnimationFrame(() => {
      ritaBegard = false;
      const { k, tx, ty } = kam.transform();
      kamera.setAttribute("transform", `matrix(${k} 0 0 ${k} ${tx} ${ty})`);
      // Felmönstrets ränder ska ha konstant bredd på skärmen.
      if (harFel) monster.setAttribute("patternTransform", `rotate(45) scale(${1 / k})`);
      skarm.rita({ tillSkarm: kam.tillSkarm, k, W: kam.W, H: kam.H, ringar: lage === "omrade" });
      knapp("in").disabled = k >= kam.grans.kMax * 0.999;
      knapp("ut").disabled = k <= kam.grans.kMin * 1.001;
      emit("kamera", { zoom: k / kam.kHem });
      matFps();
    });
  }

  // Bildrutetid under gester (preview/QA).
  const fps = { senast: 0, ramar: [], aktiv: false };
  function matFps() {
    const nu = performance.now();
    if (fps.aktiv && fps.senast) fps.ramar.push(nu - fps.senast);
    fps.senast = nu;
  }

  // --- Gester → kamera/nål/val -------------------------------------------------
  let gestPagar = false;
  const lossGester = kopplaGester(vard, {
    start() {
      kam.stoppa();
      gestPagar = true;
      vard.classList.add("drar");
      fps.ramar = []; fps.aktiv = true; fps.senast = 0;
    },
    slut() {
      gestPagar = false;
      vard.classList.remove("drar");
      fps.aktiv = false;
      efterRorelse();
    },
    pan: (dx, dy) => kam.pan(dx, dy),
    zoom(x, y, faktor, mjuk) {
      if (mjuk) { kam.hjulZoom(x, y, faktor); return; }
      if (!gestPagar) kam.stoppa();
      kam.zoomVid(x, y, faktor);
      if (!gestPagar) efterRorelse();
    },
    klick,
    arNal: (mal) => !last && lage === "punkt" && skarm.arNal(mal),
    nalFlytt(x, y) { skarm.satGiss(kam.tillKarta(x, y), false); rita(); },
    nalSlapp: nalKlar,
  });

  function tangent(e) {
    if (e.target !== vard) return; // knapparna sköter sig själva
    const s = TANGENT_STEG / kam.kam.k;
    const pil = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
    const gor = pil ? () => kam.animera({ ...kam.kam, cx: kam.kam.cx + pil[0], cy: kam.kam.cy + pil[1] }, 160)
      : e.key === "+" || e.key === "=" ? api.zoomIn
      : e.key === "-" || e.key === "_" ? api.zoomOut
      : e.key === "0" || e.key === "Home" ? api.hem
      // Svara där siktet (vyns mitt) står – ett aktivt tryck, ingen gratis gissning.
      : (e.key === "Enter" || e.key === " ") && !last ? () => klick(kam.W / 2, kam.H / 2, null)
      : null;
    if (!gor) return;
    e.preventDefault();
    gor();
  }
  vard.addEventListener("keydown", tangent);

  ui.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b?.dataset.k === "in") api.zoomIn();
    if (b?.dataset.k === "ut") api.zoomOut();
    if (b?.dataset.k === "hem") api.hem();
  });

  // --- Detaljnivå (valfri, arkitekturen §1.5) --------------------------------
  // Laddas en gång när zoomen passerar detaljVid × helvyn. Bytet görs bara när
  // ingen gest eller animation pågår, och bara `d` byts – klasser och val består.
  let detalj = opts.laddaDetalj ? null : "klar"; // null | "laddar" | geo | "klar"
  function efterRorelse() {
    if (detalj === "klar" || detalj === "laddar") return;
    if (detalj) { if (!gestPagar && !kam.animerar) bytDetalj(detalj); return; }
    if (kam.kam.k <= kam.kHem * (opts.detaljVid ?? 3)) return;
    detalj = "laddar";
    Promise.resolve().then(() => opts.laddaDetalj())
      .then((g) => { detalj = g?.omraden ? g : "klar"; efterRorelse(); })
      .catch(() => { detalj = "klar"; });
  }
  function bytDetalj(g) {
    detalj = "klar";
    for (const o of g.omraden) {
      const m = omraden.get(o.id);
      if (!m) continue;
      m.path.setAttribute("d", o.d);
      for (const c of ["vald", "ratt", "fel"]) if (m.path.classList.contains(c)) kontur[c].setAttribute("d", o.d);
    }
    for (const [namn, path] of Object.entries(lager)) if (g.lager?.[namn]) path.setAttribute("d", g.lager[namn]);
  }

  // --- Svar --------------------------------------------------------------------
  function klick(x, y, mal) {
    if (last) return;
    if (lage === "punkt") {
      skarm.satGiss(kam.tillKarta(x, y));
      nalKlar();
      rita();
      return;
    }
    // Område: ringen (små områden) eller själva pathen. Sjöar/älvar har
    // pointer-events:none, så klick i Vänern når landskapet under.
    let traff = mal?.closest?.("[data-id]");
    if (!traff) {
      const r = vard.getBoundingClientRect();
      traff = document.elementFromPoint(x + r.left, y + r.top)?.closest?.("[data-id]");
    }
    const id = traff?.getAttribute("data-id");
    if (id && omraden.has(id)) valj(id);
  }

  function nalKlar() {
    const g = api.getGuess();
    if (g) emit("gissning", g);
  }

  function valj(id) {
    if (valtId) omraden.get(valtId)?.path.classList.remove("vald");
    valtId = id;
    const o = omraden.get(id);
    o.path.classList.add("vald");
    kontur.vald.setAttribute("d", o.path.getAttribute("d"));
    rita();
    emit("val", { id });
  }

  // Animera bara om något av områdena (ytterkanter) ligger utanför vyns inre
  // del (samma luft som visaRuta ger, så etiketten och ringen får plats).
  function visaOmraden(ids) {
    const horn = ids.flatMap((id) => {
      const [a, b, c, d] = vagRuta(omraden.get(id).path.getAttribute("d"));
      return [[a, b], [c, d]];
    });
    const syns = horn.every((pt) => {
      const [sx, sy] = kam.tillSkarm(pt);
      return sx >= VISA_LUFT.v && sy >= VISA_LUFT.t && sx <= kam.W - VISA_LUFT.h && sy <= kam.H - VISA_LUFT.b;
    });
    if (!syns) kam.visaRuta(ruta(horn), 8);
  }

  const api = {
    on(typ, fn) { (lyss[typ] ||= []).push(fn); return api; },
    off(typ, fn) { lyss[typ] = (lyss[typ] || []).filter((f) => f !== fn); return api; },
    getGuess() {
      const g = skarm.giss;
      if (!g) return null;
      const [lon, lat] = tillLatLon(p, g[0], g[1]);
      return { lon, lat };
    },
    getVal: () => valtId,
    get lage() { return lage; },
    get last() { return last; },
    lock() { last = true; vard.classList.add("last"); rita(); },

    showResult({ guess, target, km, label } = {}) {
      api.lock();
      if (!target) return;
      const g = guess || api.getGuess();
      if (g) skarm.satGiss(tillKarta(p, g.lon, g.lat), false);
      const ratt = tillKarta(p, target.lon, target.lat);
      skarm.satRatt(ratt, Number.isFinite(km) ? `${Math.round(km).toLocaleString("sv-SE")} km` : "");
      skarm.satEtikett(label || "", ratt, "nal");
      kam.visaRuta(ruta(g ? [skarm.giss, ratt] : [ratt]), 6);
      rita();
    },

    showAreaResult({ valt, ratt, label } = {}) {
      api.lock();
      const r = omraden.get(ratt);
      if (!r) return;
      if (valt === undefined) valt = valtId;
      r.path.classList.remove("vald");
      r.path.classList.add("ratt");
      kontur.ratt.setAttribute("d", r.path.getAttribute("d"));
      kontur.vald.removeAttribute("d");
      const ids = [ratt];
      if (valt && valt !== ratt && omraden.has(valt)) {
        const f = omraden.get(valt);
        f.path.classList.remove("vald");
        f.path.classList.add("fel");
        f.path.style.fill = `url(#${randId})`;
        kontur.fel.setAttribute("d", f.path.getAttribute("d"));
        harFel = true;
        ids.push(valt);
      }
      skarm.satEtikett(label || "", r.c, "mitt");
      visaOmraden(ids);
      rita();
    },

    setLage(ny) { lage = ny; api.reset(); },
    reset({ hem = true } = {}) {
      last = false;
      harFel = false;
      valtId = null;
      vard.classList.remove("last");
      vard.classList.toggle("lage-punkt", lage === "punkt");
      vard.classList.toggle("lage-omrade", lage === "omrade");
      vard.setAttribute("aria-label", HJALP[lage] || HJALP.punkt);
      for (const o of omraden.values()) {
        o.path.classList.remove("vald", "ratt", "fel");
        o.path.style.fill = "";
      }
      for (const k of Object.values(kontur)) k.removeAttribute("d");
      skarm.rensa();
      if (hem) kam.hem();
      rita();
    },
    zoomIn() { kam.animera({ ...kam.kam, k: kam.kam.k * KNAPP_ZOOM }, 220); },
    zoomOut() { kam.animera({ ...kam.kam, k: kam.kam.k / KNAPP_ZOOM }, 220); },
    hem() { kam.hem(); },
    /** Zoom relativt helvyn (1 = helvy). */
    zoom: () => kam.kam.k / kam.kHem,
    matning() {
      const r = fps.ramar.slice(1);
      if (!r.length) return null;
      const snitt = r.reduce((s, v) => s + v, 0) / r.length;
      return { ramar: r.length, snittMs: snitt, fps: 1000 / snitt, varstaMs: Math.max(...r) };
    },
    noder: () => svg.querySelectorAll("*").length,
    destroy() {
      kam.stoppa();
      cancelAnimationFrame(rafId);
      ro.disconnect();
      lossGester();
      vard.removeEventListener("keydown", tangent);
      vard.remove();
      for (const k of Object.keys(lyss)) delete lyss[k];
    },
  };

  const storlek = () => {
    const r = vard.getBoundingClientRect();
    kam.storlek(r.width, r.height);
  };
  const ro = new ResizeObserver(storlek);
  ro.observe(vard);
  storlek();
  api.reset({ hem: false });
  return api;
}

function ruta(punkter) {
  const xs = punkter.map((q) => q[0]), ys = punkter.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
