// Live (#460): ladda Live-stilarna först när en Live-vy visas (inte i index.html,
// så elevsidans vanliga laddning påverkas inte). Idempotent.
const SHEETS = ["src/live/live.css", "src/mult/fast-answer.css"];

export function ensureLiveCss() {
  for (const href of SHEETS) {
    if (document.querySelector(`link[data-live-css="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.liveCss = href;
    document.head.appendChild(link);
  }
}

/** Kör `cleanup` när routern lämnar `path` (hash-byte till annan route). */
export function onLeaveRoute(path, cleanup) {
  const check = () => {
    const now = (window.location.hash || "#/").slice(1).split("?")[0];
    if (now === path) return;
    window.removeEventListener("hashchange", check);
    cleanup();
  };
  window.addEventListener("hashchange", check);
  return () => window.removeEventListener("hashchange", check);
}
