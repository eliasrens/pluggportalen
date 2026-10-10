// Live (#460): ladda Live-stilarna först när en Live-vy visas (inte i index.html,
// så elevsidans vanliga laddning påverkas inte). Idempotent.
// Sökvägarna är relativa repo-roten men löses mot modulens plats, så att
// sidor i preview/ laddar samma ark som index.html (#568).
const ROT = new URL("../../", import.meta.url);
const SHEETS = ["src/live/live.css", "src/mult/fast-answer.css"];

/** @param {string[]} [extra] fler ark (t.ex. projektorns, #461) */
export function ensureLiveCss(extra = []) {
  for (const href of [...SHEETS, ...extra]) {
    if (document.querySelector(`link[data-live-css="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(href, ROT).href;
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
