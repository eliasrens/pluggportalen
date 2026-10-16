// Preview-stub för src/ui.js (#739): bara getParams (ui.js drar in data.js/Firebase).
export function getParams() {
  const hash = window.location.hash || "";
  const q = hash.indexOf("?");
  return q === -1 ? {} : Object.fromEntries(new URLSearchParams(hash.slice(q + 1)));
}
