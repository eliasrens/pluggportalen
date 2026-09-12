// ============================================================================
// Pluggportalen – delad kladdyta (scratchpad.js, issue #296)
// ----------------------------------------------------------------------------
// Den FLYKTIGA ritytan (canvas) med penna/sudd/rensa + en FÖRSTORA-knapp som
// fäller ut kortet till fullskärm för mer ritutrymme. Delas nu av två ställen:
//   • Räkna-läget (games-rakna.js) – A4-kort per uppgift.
//   • Äventyrens generator-utmaning (adventure/generator-modal.js) – samma kort
//     i en modal ovanpå spelvärlden när stationen kör genererade tal (#296 del A).
//
// Kladdytan är HELT FLYKTIG: bara i canvasens pixelbuffert, sparas ALDRIG (noll
// DB-kostnad). Ritningen bevaras dock ÖVER en storleksändring (förstora/förminska)
// genom att den gamla bufferten ritas tillbaka skalad – annars skulle eleven tappa
// sin uträkning mitt i. Pointer Events → mus OCH touch (touch-action: none i CSS så
// sidan inte skrollar under ritandet, samma princip som äventyrsmotorns pekstyrning
// #248/#250).
//
// BOOT-SÄKERHET: den här filen laddas BARA via dynamiskt importerade vägar
// (games-rakna.js och adventure/generator-modal.js, som i sin tur ligger utanför
// den statiska bootgrafen). Den får ALDRIG statiskt importeras av en bootfil –
// då dras canvas-runtime in i boot (jfr #271/#290). Enda beroendet uppåt är `el`
// ur ui.js, som redan ligger i boot.
// ============================================================================

import { el } from "./ui.js";
// wireEnlarge bor i en egen, import-fri modul så förstora-logiken kan enhetstestas
// utan ui.js/firebase-kedjan (#312). Importeras för lokalt bruk i createScratchCard
// OCH re-exporteras (nedan) så befintliga importvägar fortsätter fungera oförändrat.
import { wireEnlarge } from "./scratch-enlarge.js";

const PEN_COLOR = "#2a2a35";
const PEN_WIDTH = 3.2;
const ERASER_WIDTH = 26;

const DEFAULT_HINT = "✏️ Kladda din uträkning här – den sparas inte";

/**
 * Koppla rit-interaktion på ett <canvas>. Returnerar { setTool, clear, resize, destroy }.
 * Skalar ritbufferten efter elementets faktiska storlek × devicePixelRatio så
 * strecket blir skarpt på mobil/retina. resize() ritar om efter en layout-ändring
 * (t.ex. förstora) och BEVARAR den befintliga ritningen (skalad).
 */
export function attachScratchpad(canvas) {
  const ctx = canvas.getContext("2d");
  let tool = "pen"; // "pen" | "eraser"
  let drawing = false;
  let last = null;
  let activePointer = null;

  // Kopiera canvasens nuvarande pixlar till en offscreen-buffert (för att bevara
  // ritningen över en storleksändring). Blank canvas → blank kopia (ofarligt).
  function snapshot() {
    if (canvas.width < 1 || canvas.height < 1) return null;
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    off.getContext("2d").drawImage(canvas, 0, 0);
    return off;
  }

  // Sätt canvasens pixelupplösning efter dess CSS-box (× dpr) så linjerna blir
  // skarpa och koordinaterna stämmer. Görs efter layout (rAF), vid resize OCH när
  // kortet fälls ut/in (via resize() nedan). Bevarar ritningen över en ändring.
  function fit() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      const prev = snapshot(); // gamla ritningen (kan vara blank)
      canvas.width = w; // sätter om storleken (nollställer bufferten)
      canvas.height = h;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (prev && prev.width > 0 && prev.height > 0) {
        ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, w, h); // skala tillbaka
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  requestAnimationFrame(fit);

  function pointOf(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function stroke(a, b) {
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = tool === "eraser" ? ERASER_WIDTH : PEN_WIDTH;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function onDown(e) {
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    drawing = true;
    last = pointOf(e);
    stroke(last, { x: last.x + 0.01, y: last.y + 0.01 }); // en tap ger en prick
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }
  function onMove(e) {
    if (!drawing || e.pointerId !== activePointer) return;
    const p = pointOf(e);
    stroke(last, p);
    last = p;
    e.preventDefault();
  }
  function onUp(e) {
    if (e.pointerId !== activePointer) return;
    drawing = false;
    last = null;
    activePointer = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", fit);

  return {
    setTool(t) { tool = t; },
    /** Rita om efter en layout-ändring (bevarar ritningen). Kör efter rAF. */
    resize() { requestAnimationFrame(fit); },
    clear() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
    destroy() {
      window.removeEventListener("resize", fit);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    },
  };
}

// Re-export så äldre importvägar (import { wireEnlarge } from "./scratchpad.js")
// fortsätter fungera trots att implementationen flyttat till scratch-enlarge.js.
export { wireEnlarge };

/**
 * Bygg ett komplett kladd-KORT: en A4-yta med en task-rubrik överst, själva ritytan
 * och en flytande verktygsrad (penna/sudd/rensa + förstora) inuti kortet. Kortet är
 * det som fälls ut till fullskärm, så verktygen följer med. Delas av räkna-läget och
 * äventyrens generator-modal så kladdytan ser och beter sig likadant på båda ställena.
 *
 * @param {object} o
 * @param {string} o.taskHtml   färdig (redan escapead) HTML för uppgiftsrubriken
 * @param {string} [o.hint]     liten hjälptext under ritytan
 * @param {boolean} [o.handleEscape=true]  vidarebefordras till wireEnlarge
 * @param {()=>void} [o.onAction]  valfri callback vid knapptryck (t.ex. ljud)
 * @returns {{card:HTMLElement, canvas:HTMLElement, pad:object, enlarge:object, destroy:()=>void}}
 */
export function createScratchCard({ taskHtml, hint = DEFAULT_HINT, handleEscape = true, onAction } = {}) {
  // Verktygsraden ligger som en egen rad LÄNGST NER i kortet (in-flow, inte
  // ovanpå ritytan) så den aldrig skymmer talet/ritningen och ändå följer med när
  // kortet fälls ut till fullskärm (den är ju en del av kortet).
  const card = el(`<div class="a4-card scratch-card">
    <div class="a4-task">${taskHtml}</div>
    <div class="scratch-surface">
      <canvas class="a4-scratch" aria-label="Kladdyta – rita din uträkning för hand"></canvas>
    </div>
    <div class="a4-scratch-hint">${hint}</div>
    <div class="scratch-tools" role="toolbar" aria-label="Ritverktyg">
      <button type="button" class="tool-btn is-active" data-tool="pen" title="Penna">✏️ Penna</button>
      <button type="button" class="tool-btn" data-tool="eraser" title="Sudd">🧽 Sudd</button>
      <button type="button" class="tool-btn" data-clear title="Rensa kladdytan">🗑️ Rensa</button>
      <button type="button" class="tool-btn scratch-enlarge" data-enlarge aria-pressed="false" title="Förstora kladdytan">🔍 Förstora</button>
    </div>
  </div>`);

  const canvas = card.querySelector(".a4-scratch");
  const pad = attachScratchpad(canvas);

  const toolBtns = card.querySelectorAll(".tool-btn[data-tool]");
  toolBtns.forEach((b) => {
    b.addEventListener("click", () => {
      pad.setTool(b.dataset.tool);
      toolBtns.forEach((x) => x.classList.toggle("is-active", x === b));
      onAction && onAction();
    });
  });
  card.querySelector("[data-clear]").addEventListener("click", () => {
    pad.clear();
    onAction && onAction();
  });

  const enlarge = wireEnlarge({
    button: card.querySelector("[data-enlarge]"),
    target: card,
    pad,
    handleEscape,
  });

  return {
    card,
    canvas,
    pad,
    enlarge,
    destroy() {
      enlarge.destroy();
      pad.destroy();
    },
  };
}
