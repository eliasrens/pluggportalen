// ============================================================================
// Tidslinjekomponent (#597) – pekare och gester. Samma beteende för mus,
// finger och penna (pointer events):
//   linjen     tryck = markören hoppar dit, dra = markören följer; nära kanten
//              på en inzoomad linje rullar linjen med. Två fingrar = nyp-zoom.
//              Ctrl+hjul = zoom, Shift+hjul / sidled = panorera.
//   översikten tryck/dra = flytta det synliga fönstret (panorera).
//   stegknapp  tryck = ett steg, håll inne = upprepa.
// Gesterna talar bara med tillståndet (createTimelineState i ./timeline-logic.js)
// och tre återanrop: choose(year), restore(year|null) och render().
// ============================================================================

import { fracToYear, isZoomed, ZOOM_STEP } from "./timeline-logic.js";

const EDGE = 0.05;
const DRAG_PX = 8;

/** Fånga pekaren om det går – en redan släppt pekare kastar InvalidPointerId. */
function capture(node, pointerId) {
  try {
    node.setPointerCapture?.(pointerId);
  } catch {
    /* utan fångst fungerar dragningen ändå så länge pekaren är över linjen */
  }
}

function listen(node, type, fn, opts, offs) {
  node.addEventListener?.(type, fn, opts);
  offs.push(() => node.removeEventListener?.(type, fn, opts));
}

/**
 * @param {{ linje, yta, oversikt, ovBana, focusEl, win }} dom
 * @param {{ state: () => object, choose: (y:number)=>void, restore: (y:number|null)=>void, render: ()=>void }} ctl
 *        state() ger AKTUELLT tillståndsobjekt (det byts vid ny fråga)
 * @returns {{ cancel(): void, destroy(): void }}
 */
export function attachGestures(dom, ctl) {
  const { linje, yta, oversikt, ovBana, focusEl, win } = dom;
  const offs = [];
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let edgeRaf = 0;
  let ovDrag = null;

  const rect = (n) => {
    const r = n.getBoundingClientRect();
    return { left: r.left, width: r.width || 1 };
  };
  const yearAtFrac = (clientX) => {
    const r = rect(yta);
    const st = ctl.state().get();
    return st.view.min + ((clientX - r.left) / r.width) * (st.view.max - st.view.min);
  };
  const yearAt = (clientX) => {
    const r = rect(yta);
    const st = ctl.state().get();
    return fracToYear((clientX - r.left) / r.width, st.view, st.span);
  };

  function edgeLoop() {
    edgeRaf = 0;
    if (!drag || pinch) return;
    const s = ctl.state();
    const st = s.get();
    if (!isZoomed(st.view, st.span)) return;
    const r = rect(yta);
    const f = (drag.x - r.left) / r.width;
    const dir = f < EDGE ? -1 : f > 1 - EDGE ? 1 : 0;
    if (!dir) return;
    s.pan(dir * (st.view.max - st.view.min) * 0.012);
    ctl.choose(yearAt(drag.x));
    ctl.render();
    edgeRaf = win?.requestAnimationFrame?.(edgeLoop) || 0;
  }

  function onDown(e) {
    if (e.pointerType === "mouse" && e.button !== undefined && e.button !== 0) return;
    pointers.set(e.pointerId, e.clientX);
    capture(linje, e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.abs(a - b) || 1, view0: { ...ctl.state().get().view }, anchor: yearAtFrac((a + b) / 2) };
      // Första fingret i en nypning var inget val – ångra dess hopp.
      if (drag && Math.abs(drag.x - drag.x0) <= DRAG_PX) ctl.restore(drag.before);
      drag = null;
      linje.classList.remove("tl-drar");
      return;
    }
    if (pointers.size > 2) return;
    e.preventDefault?.();
    focusEl.focus?.({ preventScroll: true });
    drag = { id: e.pointerId, x: e.clientX, x0: e.clientX, before: ctl.state().get().year };
    linje.classList.add("tl-drar");
    ctl.choose(yearAt(e.clientX));
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e.clientX);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const s = ctl.state();
      s.setView(pinch.view0);
      s.zoom(Math.abs(a - b) / pinch.d0 || 1, pinch.anchor);
      ctl.render();
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    drag.x = e.clientX;
    ctl.choose(yearAt(e.clientX));
    if (!edgeRaf) edgeLoop();
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) {
      drag = null;
      linje.classList.remove("tl-drar");
    }
  }

  function onWheel(e) {
    const s = ctl.state();
    const st = s.get();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      s.zoom(Math.pow(ZOOM_STEP, -e.deltaY / 200), yearAtFrac(e.clientX));
      ctl.render();
      return;
    }
    const dx = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX;
    if (!dx || !isZoomed(st.view, st.span)) return;
    e.preventDefault();
    s.pan((dx / rect(yta).width) * (st.view.max - st.view.min));
    ctl.render();
  }

  function ovCenter(clientX) {
    const r = rect(ovBana);
    const s = ctl.state();
    const st = s.get();
    const w = st.view.max - st.view.min;
    const c = st.span.min + ((clientX - r.left) / r.width) * (st.span.max - st.span.min);
    s.setView({ min: c - w / 2, max: c + w / 2 });
    ctl.render();
  }

  listen(linje, "pointerdown", onDown, undefined, offs);
  listen(linje, "pointermove", onMove, undefined, offs);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) listen(linje, t, onUp, undefined, offs);
  listen(linje, "wheel", onWheel, { passive: false }, offs);
  listen(oversikt, "pointerdown", (e) => {
    ovDrag = e.pointerId;
    capture(oversikt, e.pointerId);
    e.preventDefault?.();
    ovCenter(e.clientX);
  }, undefined, offs);
  listen(oversikt, "pointermove", (e) => { if (ovDrag === e.pointerId) ovCenter(e.clientX); }, undefined, offs);
  for (const t of ["pointerup", "pointercancel"]) {
    listen(oversikt, t, (e) => { if (ovDrag === e.pointerId) ovDrag = null; }, undefined, offs);
  }

  function cancel() {
    drag = null;
    pinch = null;
    pointers.clear();
    linje.classList.remove("tl-drar");
    if (edgeRaf) win?.cancelAnimationFrame?.(edgeRaf);
    edgeRaf = 0;
  }

  return {
    cancel,
    destroy() {
      cancel();
      offs.forEach((off) => off());
    },
  };
}

/**
 * Stegknappar: pekartryck = ett steg direkt + upprepning när knappen hålls in;
 * klick utan pekare (Space/Enter via tangentbord, skärmläsare) = ett steg.
 * @returns {{ stop(): void, destroy(): void }}
 */
export function attachRepeatButtons(buttons, onStep) {
  const offs = [];
  let timer = 0;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(timer);
    timer = 0;
  };
  for (const b of buttons) {
    const d = Number(b.dataset.steg);
    listen(b, "pointerdown", () => {
      if (b.disabled) return;
      onStep(d);
      stop();
      timer = setTimeout(() => { timer = setInterval(() => onStep(d), 90); }, 420);
    }, undefined, offs);
    // Pekarklick har detail ≥ 1 (steget togs redan i pointerdown).
    listen(b, "click", (e) => { if (!(e.detail > 0)) onStep(d); }, undefined, offs);
    for (const t of ["pointerup", "pointerleave", "pointercancel"]) listen(b, t, stop, undefined, offs);
  }
  return {
    stop,
    destroy() {
      stop();
      offs.forEach((off) => off());
    },
  };
}
