// Preview-stub för src/data.js (#446). Allt utom getProgress är den RIKTIGA
// modulen (laddad via "?real" så importmappen inte pekar tillbaka hit);
// getProgress svarar ur fixturen i preview/preview-plugga-larare.html.
export * from "/src/data.js?real";

export async function getProgress(studentId) {
  await new Promise((r) => setTimeout(r, 120));
  return (globalThis.PREVIEW_PROGRESS || {})[studentId] || {};
}
