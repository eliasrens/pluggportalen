// Preview-stub för src/ui.js – ersätter Firebase-/router-beroendena så att den
// RIKTIGA läsförståelse-koden (games-reading.js + game-shared.js) kan köras helt
// lokalt i preview-lasforstaelse.html. Bara det som spelkoden faktiskt använder.
export const app = document.getElementById("app");

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function go(hash) {
  // I preview: gå tillbaka till nivåvalet i stället för att navigera bort.
  const banner = document.getElementById("preview-note");
  if (banner) banner.textContent = `↩︎ (I appen skulle detta gå till: ${hash})`;
  window.dispatchEvent(new CustomEvent("preview-restart"));
}

export function getParams() {
  // Overview-harnessen sätter globalThis.__PREVIEW_PARAMS { subj, area }.
  return globalThis.__PREVIEW_PARAMS || {};
}

export function loading() {}

export async function renderTopbar() {}
