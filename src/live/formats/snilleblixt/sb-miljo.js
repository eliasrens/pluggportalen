// ============================================================================
// Snilleblixten – TV-studion (#559): MILJÖN (designspec §5.1) – ritas EN gång
// per vy och rörs sedan aldrig (bara CSS-animationer på transform/opacitet):
// djupblå/lila scen, tre strålkastare som sakta sveper, blankt studiogolv
// med mjuk reflektion, egen ⚡-logga (SVG, ingen bild att ladda). Stilarna:
// snilleblixt-studio.css (.sbm-* m.m.) + snilleblixt-scener.css. Bakgrunden tar aldrig fokus: låg
// opacitet, inga blinkningar; reducerad rörelse = stilla strålkastare.
//
// API
//   ensureStudioCss()
//   miljoHtml()            → bakgrundens markup (aria-hidden)
//   boltSvg(cls?)          → blixten som inline-SVG
//   logoHtml({ size })     → "⚡ SNILLEBLIXTEN" ("stor" i lobbyn, "liten" i hörnet)
//   flash(host, { strong }) → en kort blixt över scenen (ingen stroboskop:
//                            en enda toning ~0,4 s, reducerad rörelse = svagare)
// ============================================================================

import { ensureLiveCss } from "../../live-css.js";
import { ensureDesignCss } from "../../design/live-avatar-pool.js";
import { prefersReducedMotion } from "../../design/live-reactions.js";

const CSS = ["src/live/formats/snilleblixt/snilleblixt-studio.css", "src/live/formats/snilleblixt/snilleblixt-scener.css"];

export function ensureStudioCss() {
  ensureDesignCss();
  ensureLiveCss(CSS);
}

export function boltSvg(cls = "sbm-bolt") {
  return `<svg class="${cls}" viewBox="0 0 64 96" aria-hidden="true" focusable="false">
    <defs><linearGradient id="sbm-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
    <path d="M38 2 6 54h22l-8 40 38-56H34L46 2Z" fill="url(#sbm-bg)" stroke="#7a3d00" stroke-width="3" stroke-linejoin="round"/>
    <path d="M36 8 14 48h12" fill="none" stroke="#fffbe0" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  </svg>`;
}

export function logoHtml({ size = "liten" } = {}) {
  return `<div class="sbm-logo sbm-logo-${size}">${boltSvg()}<span class="sbm-namn">SNILLE<b>BLIXTEN</b></span></div>`;
}

export function miljoHtml() {
  return `<div class="sbm" aria-hidden="true">
    <div class="sbm-glod"></div>
    <div class="sbm-spots">
      <span class="sbm-spot sbm-s1"></span><span class="sbm-spot sbm-s2"></span><span class="sbm-spot sbm-s3"></span>
    </div>
    <div class="sbm-vatten">${boltSvg("sbm-bolt sbm-vatten-bolt")}</div>
    <div class="sbm-golv"><span class="sbm-reflex"></span><span class="sbm-linjer"></span></div>
  </div>`;
}

/** En kort ljusblixt över hela scenen (ett tillfälle, aldrig upprepat). */
export function flash(host, { strong = false } = {}) {
  const el = document.createElement("div");
  el.className = "sbm-flash";
  host.appendChild(el);
  const peak = prefersReducedMotion() ? 0.18 : strong ? 0.6 : 0.4;
  const a = el.animate([{ opacity: 0 }, { opacity: peak, offset: 0.18 }, { opacity: 0 }], { duration: strong ? 650 : 420, easing: "ease-out" });
  a.finished.catch(() => {}).finally(() => el.remove());
  return a;
}
