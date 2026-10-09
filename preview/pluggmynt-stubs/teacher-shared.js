// Stubb för preview-live-pluggmynt.html (#557): bara el/esc ur teacher-shared.js,
// utan auth/Firebase – så att lärarformulärets sektion kan visas utan inloggning.
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
