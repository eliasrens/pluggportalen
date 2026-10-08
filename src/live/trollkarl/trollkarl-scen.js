// ============================================================================
// Trollkarlsduellen (#536): SCENEN – det attacker (del C/D) och finaler (del E)
// får att rita i. Kontraktet: docs/trollkarlsduellen-arkitektur.md.
// Allt i designrummet 1600 × 900 (stage skalas in av vyn).
//
// API: createScene({ stage, fx, fxBack, bannerEl, slots, sound, reducedMotion, director })
//   → scene = {
//     W, H, stage, fx, fxBack, reducedMotion,
//     layer(back?)          → nytt <div> i effektlagret (tas bort av clear())
//     point(wizard, name)   → { x, y } i designrummet (ur wizard.anchor i viewport-px)
//     banner(text, side?)   → attacknamnet stort en stund
//     state(side, STATE)    → §11-tillståndet på figurens plats (data-state)
//     sound(name)           → spelar ett registrerat ljud (registerSound) om ljudet är på
//     wait(ms, signal?)     → Promise (kastar AbortError om signal avbryts)
//     on(type, fn)          → regins händelser (attack:start, finale …)
//     clear()               – rensar alla lager (regin anropar efter varje attack)
//   }
// ============================================================================

import { getSound } from "./trollkarl-register.js";

export const W = 1600;
export const H = 900;

export function createScene({ stage, fx, fxBack, bannerEl, slots, sound, reducedMotion, director }) {
  const layers = new Set();
  let bannerT = 0;

  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException("Avbruten", "AbortError"));
      const t = setTimeout(resolve, reducedMotion ? Math.min(ms, 400) : ms);
      signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Avbruten", "AbortError")); }, { once: true });
    });
  }

  return {
    W,
    H,
    stage,
    fx,
    fxBack,
    reducedMotion,
    layer(back = false) {
      const l = document.createElement("div");
      l.className = "tk-layer";
      (back ? fxBack : fx).appendChild(l);
      layers.add(l);
      return l;
    },
    point(wizard, name) {
      const p = wizard?.anchor?.(name);
      const r = stage.getBoundingClientRect();
      const k = r.width / W || 1;
      if (!p) return { x: W / 2, y: H / 2 };
      return { x: (p.x - r.left) / k, y: (p.y - r.top) / k };
    },
    banner(text, side = "") {
      clearTimeout(bannerT);
      bannerEl.textContent = text;
      bannerEl.dataset.side = side;
      bannerEl.classList.remove("on");
      void bannerEl.offsetWidth;
      bannerEl.classList.add("on");
      bannerT = setTimeout(() => bannerEl.classList.remove("on"), 2400);
    },
    state(side, st) {
      if (slots[side]) slots[side].dataset.state = st;
    },
    sound(name) {
      const fn = getSound(name);
      if (fn) sound?.fx?.((ac, out) => fn(ac, out, ac.currentTime));
    },
    wait,
    on: (type, fn) => director.on(type, fn),
    clear() {
      for (const l of layers) l.remove();
      layers.clear();
    },
    destroy() {
      clearTimeout(bannerT);
      this.clear();
    },
  };
}
