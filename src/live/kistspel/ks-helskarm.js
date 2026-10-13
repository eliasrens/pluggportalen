// ============================================================================
// Kistspel 🎁 (#653): HELSKÄRMSKNAPPEN – en diskret knapp som visar elevvyn i
// helskärm (Fullscreen-API:t, webkit-prefix som reserv). Ikonen = standard-
// ikonen (fyra hörn, SVG – ingen emoji); i helskärm "lämna helskärm". Esc
// eller systemets utgång synkar ikonen via fullscreenchange. Saknas API:t
// (t.ex. Safari på iPhone) visas ingen knapp alls. Formatet placerar och
// stilar knappen (cls); Guldrushen använder den inte.
//
// API
//   fullscreenSupported(doc?) → bool
//   createFullscreenButton(target, { cls?, doc? }) → { el, destroy() } | null
//     target  elementet som visas i helskärm (elevvyns rot)
//     el      knappen (vyn lägger in den där den ska synas)
// ============================================================================

const ENTER = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
const EXIT = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
const icon = (d) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const current = (doc) => doc.fullscreenElement || doc.webkitFullscreenElement || null;

export function fullscreenSupported(doc = document) {
  const el = doc.documentElement;
  return !!((doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen));
}

export function createFullscreenButton(target, { cls = "ks-helskarm", doc = document } = {}) {
  if (!target || !fullscreenSupported(doc)) return null;
  const el = doc.createElement("button");
  el.type = "button";
  el.className = cls;
  const draw = () => {
    const on = current(doc) === target;
    el.innerHTML = icon(on ? EXIT : ENTER);
    el.setAttribute("aria-pressed", String(on));
    el.setAttribute("aria-label", on ? "Lämna helskärm" : "Helskärm");
    el.title = on ? "Lämna helskärm" : "Helskärm";
  };
  el.addEventListener("click", () => {
    const on = current(doc) === target;
    try {
      const p = on
        ? (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc)
        : (target.requestFullscreen || target.webkitRequestFullscreen).call(target);
      p?.catch?.(() => {});
    } catch {}
  });
  doc.addEventListener("fullscreenchange", draw);
  doc.addEventListener("webkitfullscreenchange", draw);
  draw();
  return {
    el,
    destroy() {
      doc.removeEventListener("fullscreenchange", draw);
      doc.removeEventListener("webkitfullscreenchange", draw);
      if (current(doc) === target) (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)?.catch?.(() => {});
      el.remove();
    },
  };
}
