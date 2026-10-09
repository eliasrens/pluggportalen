// ============================================================================
// Live-design (#571): BANDEROLLEN – en enda återanvänd remsa överst på
// scenen. Kön (live-queue.js) ser till att bara en visas åt gången; här
// spelas den: glider ner, står kvar, glider upp (bara transform/opacitet).
// Reducerad rörelse: tonar in och ut på plats. Den ligger i scenens övre del
// men under projektorns timer/rubrik (vyn väljer värden – §3.2: viktig
// information får aldrig döljas).
//
// API
//   createBanner(host) → {
//     show({ icon?, title, sub?, tone? }, signal?, { speed? }) → Promise
//     destroy()
//   }
//   tone: "gold" | "blue" | "red" | (standard: kräm)
// ============================================================================

import { esc } from "../../teacher-shared.js";
import { prefersReducedMotion } from "./live-reactions.js";
import { ensureDesignCss } from "./live-avatar-pool.js";

const HOLD_MS = 1500;

export function createBanner(host) {
  ensureDesignCss();
  const wrap = document.createElement("div");
  wrap.className = "lbn-host";
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");
  const el = document.createElement("div");
  el.className = "lbn";
  wrap.appendChild(el);
  host.appendChild(wrap);
  let anim = null;

  function show({ icon = "", title = "", sub = "", tone = "" } = {}, signal, { speed = 1 } = {}) {
    anim?.cancel();
    el.dataset.tone = tone;
    el.innerHTML = `${icon ? `<span class="lbn-ikon" aria-hidden="true">${esc(icon)}</span>` : ""}<span>${esc(title)}${sub ? `<br><span class="lbn-sub">${esc(sub)}</span>` : ""}</span>`;
    const reduced = prefersReducedMotion();
    const s = Math.max(0.5, speed);
    const dur = (HOLD_MS + 700) / s;
    const frames = reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }]
      : [
        { opacity: 0, transform: "translateY(-120%) scale(.9)" },
        { opacity: 1, transform: "translateY(6%) scale(1.03)", offset: 0.12 },
        { opacity: 1, transform: "none", offset: 0.18 },
        { opacity: 1, transform: "none", offset: 0.86 },
        { opacity: 0, transform: "translateY(-80%) scale(.95)" },
      ];
    const a = el.animate(frames, { duration: dur, easing: "ease-out" });
    anim = a;
    const stop = () => a.cancel();
    signal?.addEventListener("abort", stop, { once: true });
    return a.finished.catch(() => {}).finally(() => signal?.removeEventListener("abort", stop));
  }

  return {
    show,
    destroy() {
      anim?.cancel();
      wrap.remove();
    },
  };
}
