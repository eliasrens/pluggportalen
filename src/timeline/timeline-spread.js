// ============================================================================
// Tidslinje att VISA (#600) – projektorns tidslinjefråga. Samma linje, skala
// och markörer som elevens komponent (./timeline-dom.js, timeline-answer.css)
// men utan interaktion: helt utzoomad över frågans spann, ingen markör förrän
// avslöjandet. Då: rätt år (grön markör) och klassens gissningar som en
// anonym spridning (staplar per årsgrupp – inga namn, ingen rangordning).
// Ladda med dynamisk import (inte i bootkedjan, #271).
//
// API
//   spreadBins(guesses, view, maxBins?) → { size, bins: [{ from, to, n }] }
//                         (ren – gissningar grupperade i "snälla" årssteg)
//   mountTimelineSpread(root, { span }) → handle
//     handle.reveal({ correct, guesses, animate? })  rätt år + spridningen
//     handle.reset()                                 tillbaka till bara linjen
//     handle.destroy()
// ============================================================================

import { formatYear, fullView, niceStep, yearToFrac } from "./timeline-logic.js";
import { elFactory, place, renderScale } from "./timeline-dom.js";

const CSS_HREF = new URL("./timeline-answer.css", import.meta.url).href;
const MAX_BINS = 60;

function ensureCss(doc) {
  if (!doc.head || doc.querySelector?.("link[data-timeline-css]")) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.dataset.timelineCss = "";
  doc.head.appendChild(link);
}

/** Gissningarna grupperade i jämna årssteg (1, 2, 5, 10 …) – högst maxBins grupper över fönstret. */
export function spreadBins(guesses, view, maxBins = MAX_BINS) {
  const size = niceStep((view.max - view.min) / maxBins);
  const by = new Map();
  for (const g of guesses || []) {
    if (!Number.isInteger(g)) continue;
    const from = Math.floor(g / size) * size;
    by.set(from, (by.get(from) || 0) + 1);
  }
  const bins = [...by].sort((a, b) => a[0] - b[0]).map(([from, n]) => ({ from, to: from + size - 1, n }));
  return { size, bins };
}

export function mountTimelineSpread(root, { span } = {}) {
  if (!span) throw new Error("mountTimelineSpread: span krävs");
  const doc = root.ownerDocument || document;
  const win = doc.defaultView || null;
  ensureCss(doc);
  const el = elFactory(doc);
  while (root.firstChild) root.removeChild(root.firstChild);
  root.classList.add("tl-root", "tl-visning");
  const linje = el("div", "tl-linje", root);
  const yta = el("div", "tl-yta", linje);
  el("div", "tl-bana", yta);
  const skala = el("div", "tl-skala", yta);
  skala.setAttribute("aria-hidden", "true");
  const spridning = el("div", "tl-spridning", yta);
  spridning.setAttribute("aria-hidden", "true");
  const ratt = el("div", "tl-markor tl-ratt", yta);
  el("span", "tl-markor-stav", ratt);
  el("span", "tl-markor-knopp", ratt);
  const rattText = el("span", "tl-markor-text", ratt);
  ratt.hidden = true;

  const view = fullView(span);
  const cache = { key: "" };
  let shown = null;
  let dead = false;

  function render() {
    if (dead) return;
    renderScale(el, skala, view, span, yta.getBoundingClientRect?.().width || 900, false, cache);
  }

  function reveal({ correct, guesses = [], animate = true } = {}) {
    const c = Math.round(Number(correct));
    const key = `${c}|${(guesses || []).join(",")}`;
    if (shown === key) return;
    const first = shown === null;
    shown = key;
    root.classList.add("tl-avslojad");
    place(ratt, yearToFrac(c, view));
    rattText.textContent = `Rätt: ${formatYear(c)}`;
    ratt.hidden = false;
    while (spridning.firstChild) spridning.removeChild(spridning.firstChild);
    const { size, bins } = spreadBins(guesses, view);
    const max = Math.max(1, ...bins.map((b) => b.n));
    const w = (size / (view.max - view.min)) * 100;
    const reduced = !!win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    bins.forEach((b, i) => {
      const bar = el("span", `tl-stapel${c >= b.from && c <= b.to ? " tl-stapel-ratt" : ""}`, spridning);
      bar.style.left = `${(yearToFrac(b.from, view) * 100).toFixed(3)}%`;
      bar.style.width = `max(6px, calc(${w.toFixed(3)}% - 2px))`;
      bar.style.height = `${((b.n / max) * 100).toFixed(1)}%`;
      if (b.n > 1) el("b", "", bar, String(b.n));
      if (animate && first && !reduced) {
        bar.animate?.([{ transform: "scaleY(0)" }, { transform: "none" }],
          { duration: 700, delay: 200 + Math.min(i, 20) * 25, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
      }
    });
  }

  let ro = null;
  if (win?.ResizeObserver) {
    ro = new win.ResizeObserver(() => { cache.key = ""; render(); });
    ro.observe(yta);
  }
  render();

  return {
    reveal,
    reset() {
      shown = null;
      ratt.hidden = true;
      root.classList.remove("tl-avslojad");
      while (spridning.firstChild) spridning.removeChild(spridning.firstChild);
    },
    destroy() {
      dead = true;
      ro?.disconnect();
      root.classList.remove("tl-root", "tl-visning", "tl-avslojad");
      while (root.firstChild) root.removeChild(root.firstChild);
    },
  };
}
