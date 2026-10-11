// ============================================================================
// Tidslinjekomponent (#597) – elevens svar på en tidslinjefråga. EN komponent
// för alla fyra lägena (Tidsjakten, Quiz, Guldrushen, Snilleblixten); layouten
// styrs med optioner. Ladda med dynamisk import (inte i bootkedjan, #271).
// Syskon till src/live/choice-answer.js.
//   ./timeline-logic.js     ren logik (spann, år↔läge, steg, zoom, tillstånd)
//   ./timeline-dom.js       skelett, skalstreck, fest
//   ./timeline-gestures.js  pekare/nyp/hjul/översikt + håll-in-knappar
//   ./timeline-answer.css   stil (laddas här) + appens .btn
// ----------------------------------------------------------------------------
// Interaktion (samma överallt)
//   Linjen     klick/tryck flyttar markören dit, dra = markören följer.
//   Knappar    −10 −1 +1 +10 (håll inne = upprepa), 🔍− / 🔍+ zoomar kring
//              markören. Översiktsremsan (syns när inzoomat) panorerar.
//   Tangenter  ←/→ ±1, Shift ±10, +/− zoom, Enter låser.
// Svarsskydd: komponenten får aldrig veta rätt år före reveal(); startläget är
// helt utzoomat utan valt år – identiskt för varje fråga i området.
//
// API
//   mountTimelineAnswer(root, opts) → handle
//     opts.span       { min, max } – från resolveSpan() (OBLIGATORISK)
//     opts.question   frågetext (valfri; "" = ingen rad)
//     opts.context    kort beskrivning ovanför (valfri)
//     opts.onLock     (year) => void – EXAKT en gång per fråga, med det år som visas
//     opts.onChange   (year) => void – när valt år ändras (valfri)
//     opts.compact    true → kompakt layout (Live)
//     opts.lockText   knapptext (default "Lås mitt årtal")
//     opts.keyboard   false → ingen dokument-tangentlyssnare
//     opts.celebrate  false → ingen extra glädje vid exakt rätt
//     opts.enabled    false → avstängd från start (lobby)
//   handle.lock()        lås valt år nu (anropar onLock) → år | null om inget valt
//   handle.disable()     stäng av (tid ute) – inget kan väljas eller låsas
//   handle.enable()      slå på igen (om inte låst/avslöjad)
//   handle.reveal(correct, { text }) → { guess, correct, diff }
//                        två markörer + avvikelsen; stänger av
//   handle.showLocked(year)  visa ett REDAN inskickat år (omladdning), utan onLock
//   handle.setQuestion({ span?, question?, context? })  ny fråga, nollställd
//   handle.value() → valt år | null     handle.locked() → låst år | null
//   handle.destroy()
// ============================================================================

import {
  createTimelineState,
  diffText,
  formatYear,
  isZoomed,
  VIEW_MIN_WIDTH,
  viewShowing,
  yearDiff,
  yearToFrac,
  ZOOM_STEP,
} from "./timeline-logic.js";
import { buildTimelineDom, celebrate, place, renderScale } from "./timeline-dom.js";
import { attachGestures, attachRepeatButtons } from "./timeline-gestures.js";

const CSS_HREF = new URL("./timeline-answer.css", import.meta.url).href;

function ensureCss(doc) {
  if (!doc.head || doc.querySelector?.("link[data-timeline-css]")) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.dataset.timelineCss = "";
  doc.head.appendChild(link);
}

function isTextField(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return true;
  return el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "reset", "range"].includes(String(el.type).toLowerCase());
}

function reducedMotion(win) {
  try {
    return !!win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const pct = (f) => `${(f * 100).toFixed(3)}%`;

/**
 * @param {HTMLElement} root
 * @param {object} opts se API ovan
 */
export function mountTimelineAnswer(root, opts = {}) {
  if (!opts.span) throw new Error("mountTimelineAnswer: opts.span krävs");
  const doc = root.ownerDocument || document;
  const win = doc.defaultView || null;
  ensureCss(doc);
  const onLock = opts.onLock || (() => {});
  const onChange = opts.onChange || (() => {});
  const lockText = opts.lockText || "Lås mitt årtal";

  root.classList.add("tl-root");
  root.classList.toggle("tl-kompakt", !!opts.compact);
  const d = buildTimelineDom(doc, root, { lockText });

  let state = createTimelineState(opts.span);
  let revealed = null;
  let destroyed = false;
  const scaleCache = { key: "" };
  if (opts.enabled === false) state.disable();

  function setText(q, c) {
    d.qEl.textContent = q || "";
    d.qEl.hidden = !q;
    d.ctxEl.textContent = c || "";
    d.ctxEl.hidden = !c;
  }
  setText(opts.question, opts.context);

  function render() {
    if (destroyed) return;
    const { span, view, year, locked, enabled } = state.get();
    const full = span.max - span.min;
    const zoomed = isZoomed(view, span);
    const shown = year ?? state.pivot();
    const editable = enabled && locked === null && !revealed;

    d.yearEl.textContent = year === null ? "?" : formatYear(year);
    d.valt.classList.toggle("tl-valt-tom", year === null);
    renderScale(d.el, d.skala, view, span, d.yta.getBoundingClientRect().width || 600, opts.compact, scaleCache);

    const g = d.giss.node;
    const f = yearToFrac(shown, view);
    place(g, f);
    g.hidden = (!!revealed && year === null) || f < -0.08 || f > 1.08;
    g.classList.toggle("tl-tom", year === null);
    g.setAttribute("aria-valuemin", String(span.min));
    g.setAttribute("aria-valuemax", String(span.max));
    g.setAttribute("aria-valuenow", String(shown));
    g.setAttribute("aria-valuetext", year === null ? "Inget år valt" : formatYear(year));
    g.setAttribute("aria-disabled", String(!editable));
    d.giss.text.textContent = revealed && year !== null ? `Du: ${formatYear(year)}` : "";
    d.hint.hidden = year !== null || !editable;

    d.oversikt.hidden = !zoomed;
    d.fonster.style.left = pct((view.min - span.min) / full);
    d.fonster.style.width = pct((view.max - view.min) / full);
    d.ovPrick.hidden = year === null;
    if (year !== null) d.ovPrick.style.left = pct((year - span.min) / full);
    d.ovStart.textContent = formatYear(span.min);
    d.ovSlut.textContent = formatYear(span.max);

    for (const b of d.stepBtns) b.disabled = !editable;
    d.zoomIn.disabled = view.max - view.min <= Math.min(VIEW_MIN_WIDTH, full) + 1e-6;
    d.zoomUt.disabled = !zoomed;

    d.lasBtn.disabled = !state.canLock() || !!revealed;
    d.lasBtn.textContent =
      locked !== null ? `✓ Låst: ${formatYear(locked)}`
      : year === null ? lockText
      : `🔒 ${lockText}: ${formatYear(year)}`;
    root.classList.toggle("tl-last", locked !== null);
    root.classList.toggle("tl-av", !enabled && locked === null);

    d.ratt.node.hidden = !revealed;
    d.band.hidden = true;
    if (revealed) {
      const fr = yearToFrac(revealed.correct, view);
      place(d.ratt.node, fr);
      d.ratt.text.textContent = `Rätt: ${formatYear(revealed.correct)}`;
      if (year !== null && revealed.diff > 0) {
        const a = Math.max(0, Math.min(f, fr));
        const b = Math.min(1, Math.max(f, fr));
        d.band.hidden = false;
        d.band.style.left = pct(a);
        d.band.style.width = pct(b - a);
      }
    }
  }

  // Varje ändring av valt år går genom tillståndet → render → onChange.
  function changed(before) {
    render();
    const now = state.get().year;
    if (now !== before) onChange(now);
  }
  function choose(y) {
    const before = state.get().year;
    if (state.choose(y)) changed(before);
  }
  function step(delta) {
    const before = state.get().year;
    if (state.step(delta)) changed(before);
  }
  function zoom(factor) {
    state.zoom(factor);
    render();
  }
  function doLock() {
    if (revealed) return null;
    const y = state.lock();
    if (y === null) return null;
    render();
    onLock(y);
    return y;
  }

  const gestures = attachGestures(
    { linje: d.linje, yta: d.yta, oversikt: d.oversikt, ovBana: d.ovBana, focusEl: d.giss.node, win },
    { state: () => state, choose, render }
  );
  const repeat = attachRepeatButtons(d.stepBtns, step);

  function onKey(e) {
    if (destroyed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (root.isConnected === false) return;
    if (isTextField(doc.activeElement) || isTextField(e.target)) return;
    // En knapp/länk UTANFÖR komponenten har fokus → dess egen Enter gäller.
    const t = e.target;
    if (t?.closest && !t.closest(".tl-root") && (t.tagName === "BUTTON" || t.tagName === "A")) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      step((k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1));
    } else if (k === "Enter") {
      // Även när en stegknapp har fokus: Enter låser (Space trycker knappen).
      if (!state.canLock() || revealed) return;
      e.preventDefault();
      doLock();
    } else if (k === "+" || k === "=") {
      e.preventDefault();
      zoom(ZOOM_STEP);
    } else if (k === "-" || k === "_") {
      e.preventDefault();
      zoom(1 / ZOOM_STEP);
    }
  }

  const offs = [];
  const on = (node, type, fn) => {
    node.addEventListener?.(type, fn);
    offs.push(() => node.removeEventListener?.(type, fn));
  };
  on(d.zoomIn, "click", () => zoom(ZOOM_STEP));
  on(d.zoomUt, "click", () => zoom(1 / ZOOM_STEP));
  on(d.lasBtn, "click", () => doLock());
  if (opts.keyboard !== false) on(doc, "keydown", onKey);
  let ro = null;
  if (win?.ResizeObserver) {
    ro = new win.ResizeObserver(() => {
      scaleCache.key = "";
      render();
    });
    ro.observe(d.yta);
  }

  render();

  return {
    lock: doLock,
    disable() {
      state.disable();
      repeat.stop();
      gestures.cancel();
      render();
    },
    enable() {
      if (revealed) return;
      state.enable();
      render();
    },
    reveal(correct, { text } = {}) {
      const c = Math.round(Number(correct));
      const st = state.get();
      state.disable();
      repeat.stop();
      gestures.cancel();
      const guess = st.year;
      const diff = guess === null ? null : yearDiff(guess, c);
      revealed = { correct: c, diff };
      state.setView(viewShowing(st.view, st.span, guess ?? c, c));
      const exact = diff === 0;
      root.classList.add("tl-avslojad");
      root.classList.toggle("tl-exakt", exact);
      const r = d.resultat;
      while (r.firstChild) r.removeChild(r.firstChild);
      d.el("strong", "tl-resultat-rubrik", r,
        guess === null ? `Rätt år: ${formatYear(c)}` : exact ? "🎉 Exakt rätt!" : diffText(guess, c));
      if (guess !== null && !exact) d.el("span", "tl-resultat-rad", r, `Du valde ${formatYear(guess)} – rätt år är ${formatYear(c)}.`);
      if (text) d.el("span", "tl-resultat-fakta", r, text);
      r.hidden = false;
      if (exact && opts.celebrate !== false && !reducedMotion(win)) celebrate(d.el, d.ratt.node);
      render();
      return { guess, correct: c, diff };
    },
    showLocked(year) {
      state.showLocked(year);
      render();
    },
    setQuestion({ span, question, context } = {}) {
      gestures.cancel();
      repeat.stop();
      state = createTimelineState(span || state.get().span);
      revealed = null;
      scaleCache.key = "";
      root.classList.remove("tl-avslojad", "tl-exakt");
      d.resultat.hidden = true;
      setText(question, context);
      render();
    },
    value: () => state.get().year,
    locked: () => state.get().locked,
    destroy() {
      destroyed = true;
      gestures.destroy();
      repeat.destroy();
      ro?.disconnect();
      offs.forEach((off) => off());
      root.classList.remove("tl-root", "tl-kompakt", "tl-last", "tl-av", "tl-avslojad", "tl-exakt");
      while (root.firstChild) root.removeChild(root.firstChild);
    },
  };
}
