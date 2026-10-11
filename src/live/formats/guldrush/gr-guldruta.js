// ============================================================================
// Guldrushen – Skattkammaren (#591, finputs DEL 2): FÖRLOPPSMÄTAREN i
// guldrutan uppe till höger ("Tillsammans 2 140 guld"). Mätaren visar hur
// långt klassen kommit mot nästa gemensamma skatt (milestone); siffran står
// kvar som liten text under ("Nästa skatt: 3 000").
// När klassen når en skatt firas det I RUTAN – ingen notis/banderoll (den
// låg förut över timern): mätaren fylls, rutan pulserar, kort konfetti runt
// rutan och ett kort ljud (fanfarKort), sedan börjar mätaren om mot nästa
// skatt. Allt stannar i rutan och dess närmaste kant – den översta raden
// (logga, timer, guldruta) täcks aldrig av något annat.
// Första värdet är baslinjen (en omladdning firar aldrig gamla skatter); flera
// skatter i rad medan det firas = ett firande, mätaren landar på det senaste.
// Bara transform/opacitet animeras. Reducerad rörelse: ingen puls/konfetti,
// rutan lyser upp en stund.
//
// API
//   createGuldruta(box, { sound? }) → {
//     sync(total, { celebrate? = true })  klassens totala guld (varje tick)
//     firing()                            firar just nu (test/QA)
//     destroy()
//   }
//   box = .grk-tills (markupen: GULDRUTA_HTML)
// ============================================================================

import { prefersReducedMotion } from "../../design/live-reactions.js";
import { milestone, crossedMilestone, tal } from "./gr-proj-scen.js";

export const GULDRUTA_HTML = `<span>Tillsammans</span><b><i data-tills>0</i> guld</b>
  <div class="grk-matare" role="progressbar" aria-label="Mot nästa skatt" aria-valuemin="0" aria-valuemax="100"><i class="grk-fyll"></i></div>
  <small data-mal></small><div class="grk-konfetti" aria-hidden="true"></div>`;

const FILL_MS = 450; // mätaren fylls upp till 100 %
const RESET_MS = 950; // … och börjar om mot nästa skatt
const DONE_MS = 1900; // firandet klart (pulsen, texten)
const KONFETTI = ["#ffcf3a", "#fff3b0", "#86d8e8", "#e88fa8", "#ffb648", "#c58cff"];

export function createGuldruta(box, { sound = null } = {}) {
  const meter = box.querySelector(".grk-matare");
  const fyll = box.querySelector(".grk-fyll");
  const mal = box.querySelector("[data-mal]");
  const konf = box.querySelector(".grk-konfetti");
  let base = null; // senast synkade totalen (null = baslinjen inte satt)
  let fire = null; // { timers } medan det firas
  let latest = 0;

  const text = (t) => { if (mal.textContent !== t) mal.textContent = t; };
  const nextText = (total) => {
    const g = milestone(total);
    return g.next ? `Nästa skatt: ${tal(g.next)}` : "Alla skatter hittade! 🎉";
  };

  function setFill(frac, { animate = true } = {}) {
    const f = Math.max(0, Math.min(1, frac));
    fyll.style.transition = animate ? "" : "none";
    fyll.style.transform = `scaleX(${f.toFixed(4)})`;
    if (!animate) void fyll.offsetWidth;
    fyll.style.transition = "";
    meter.setAttribute("aria-valuenow", String(Math.round(f * 100)));
  }

  function show(total, opts) {
    setFill(milestone(total).frac, opts);
    text(nextText(total));
  }

  function konfetti() {
    const r = box.getBoundingClientRect();
    if (!r.width) return;
    const w = r.width;
    const h = r.height;
    for (let i = 0; i < 22; i++) {
      // Startpunkt på rutans kant, flyger en kort bit utåt.
      const side = i % 4;
      const t = Math.random();
      const x = side === 0 || side === 2 ? t * w : side === 1 ? w : 0;
      const y = side === 1 || side === 3 ? t * h : side === 2 ? h : 0;
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const len = 26 + Math.random() * 36;
      const el = document.createElement("i");
      el.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;background:${KONFETTI[i % KONFETTI.length]}`;
      konf.appendChild(el);
      const rot = (Math.random() - 0.5) * 540;
      el.animate([
        { transform: "translate(-50%, -50%) scale(.4)", opacity: 1 },
        { transform: `translate(calc(-50% + ${(dx * len).toFixed(1)}px), calc(-50% + ${(dy * len + 14).toFixed(1)}px)) rotate(${rot.toFixed(0)}deg) scale(1)`, opacity: 0 },
      ], { duration: 800 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" })
        .finished.catch(() => {}).finally(() => el.remove());
    }
  }

  function celebrate(reached) {
    const reduced = prefersReducedMotion();
    const timers = [];
    fire = { timers };
    setFill(1);
    text(`🎉 Skatt: ${tal(reached)} guld!`);
    timers.push(setTimeout(() => {
      box.classList.add(reduced ? "grk-fira-lugn" : "grk-fira");
      if (!reduced) konfetti();
      sound?.cue?.("fanfarKort");
    }, FILL_MS));
    timers.push(setTimeout(() => setFill(0, { animate: false }), RESET_MS));
    timers.push(setTimeout(() => setFill(milestone(latest).frac), RESET_MS + 30));
    timers.push(setTimeout(() => {
      box.classList.remove("grk-fira", "grk-fira-lugn");
      fire = null;
      show(latest);
    }, DONE_MS));
  }

  return {
    sync(total, { celebrate: may = true } = {}) {
      const t = Math.max(0, Number(total) || 0);
      latest = t;
      if (base == null) {
        base = t;
        show(t, { animate: false });
        return;
      }
      const reached = may ? crossedMilestone(base, t) : null;
      base = t;
      if (fire) return; // landar på det senaste när firandet är klart
      if (reached) celebrate(reached);
      else show(t);
    },
    firing: () => !!fire,
    destroy() {
      for (const id of fire?.timers || []) clearTimeout(id);
      fire = null;
      konf.replaceChildren();
    },
  };
}
