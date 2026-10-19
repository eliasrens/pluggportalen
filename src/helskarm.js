// ============================================================================
// Delad helskärms-helper (#783). Samma mönster som elevens helskärm i Live /
// Datakuppen (kistspelets ks-helskarm.js, elevskärmens ⛶ i elevskarm-skarm.js)
// och Schack: Fullscreen-API:t med webkit-prefix som reserv, en diskret knapp
// vars ikon växlar via fullscreenchange (så att Esc och systemets utgång också
// syns), och ingen knapp alls där API:t saknas (t.ex. Safari på iPhone).
//
// Filen importeras bara av lata moduler (Live, Schack) – aldrig av bootgrafen
// (#271). Den har inga beroenden.
//
// API
//   fullscreenSupported(doc?) → bool
//   helskarmElement(doc?)     → elementet som visas i helskärm, eller null
//   goIn(target, doc?)        → går in i helskärm (löfte; avvisade löften sväljs)
//   goUt(doc?)                → lämnar helskärm
//   vaxla(target, doc?)       → ut om target visas, annars in
//   lyssna(fn, doc?)          → () => void; fn() vid varje fullscreenchange
//   createFullscreenButton(target, { cls?, doc?, text?, exitOnDestroy? })
//     → { el, destroy() } | null
//     target         elementet som visas i helskärm
//     text           true → knappen får även en synlig text (Helskärm / Lämna helskärm)
//     exitOnDestroy  false → destroy() lämnar inte helskärm (standard true)
// ============================================================================

const ENTER = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
const EXIT = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
const icon = (d) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

export function helskarmElement(doc = document) {
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function fullscreenSupported(doc = document) {
  const el = doc.documentElement;
  return !!((doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen));
}

export function goIn(target, doc = document) {
  try {
    const f = target?.requestFullscreen || target?.webkitRequestFullscreen;
    f?.call(target)?.catch?.(() => {});
  } catch {}
}

export function goUt(doc = document) {
  try {
    const f = doc.exitFullscreen || doc.webkitExitFullscreen;
    f?.call(doc)?.catch?.(() => {});
  } catch {}
}

export function vaxla(target, doc = document) {
  if (helskarmElement(doc) === target) goUt(doc);
  else goIn(target, doc);
}

export function lyssna(fn, doc = document) {
  doc.addEventListener("fullscreenchange", fn);
  doc.addEventListener("webkitfullscreenchange", fn);
  return () => {
    doc.removeEventListener("fullscreenchange", fn);
    doc.removeEventListener("webkitfullscreenchange", fn);
  };
}

export function createFullscreenButton(target, { cls = "ks-helskarm", doc = document, text = false, exitOnDestroy = true } = {}) {
  if (!target || !fullscreenSupported(doc)) return null;
  const el = doc.createElement("button");
  el.type = "button";
  el.className = cls;
  const draw = () => {
    const on = helskarmElement(doc) === target;
    const etikett = on ? "Lämna helskärm" : "Helskärm";
    el.innerHTML = icon(on ? EXIT : ENTER) + (text ? `<span class="helskarm-text">${etikett}</span>` : "");
    el.setAttribute("aria-pressed", String(on));
    el.setAttribute("aria-label", etikett);
    el.title = etikett;
  };
  el.addEventListener("click", () => vaxla(target, doc));
  const sluta = lyssna(draw, doc);
  draw();
  return {
    el,
    destroy() {
      sluta();
      if (exitOnDestroy && helskarmElement(doc) === target) goUt(doc);
      el.remove();
    },
  };
}
