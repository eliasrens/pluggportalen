// Preview-stub för src/ui.js (#693) – samma DOM-hjälpare, ingen router/topbar.
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const renderTopbar = async () => globalThis.__ritaFigur?.();
export function flash(msg, fel = false) {
  const f = document.getElementById("flash");
  f.textContent = msg;
  f.className = fel ? "fel" : "ok";
}
