// Preview-stub för src/data.js (#673): arbetsområdena lever i minnet (ingen
// Firebase). getArea ger en färsk KOPIA och saveArea skriver hela dokumentet –
// samma kontrakt som den riktiga data-content.js. Sidan ritar om tabellen via
// globalThis.PREVIEW_REFRESH efter varje sparning.
const clone = (x) => JSON.parse(JSON.stringify(x));
const store = () => (globalThis.PREVIEW_AREAS ||= {});

export async function getArea(subjectId, areaId) {
  await new Promise((r) => setTimeout(r, 80));
  const a = store()[`${subjectId}/${areaId}`];
  return a ? clone(a) : null;
}

export async function saveArea(subjectId, areaId, area) {
  await new Promise((r) => setTimeout(r, 120));
  const { id, ...rest } = clone(area);
  store()[`${subjectId}/${areaId}`] = { id: areaId, ...rest };
  globalThis.PREVIEW_SAVES = (globalThis.PREVIEW_SAVES || 0) + 1;
  return areaId;
}

export async function deleteArea(subjectId, areaId) {
  delete store()[`${subjectId}/${areaId}`];
}

export function getAreasSync(subjectId) {
  return Object.entries(store())
    .filter(([k]) => k.startsWith(`${subjectId}/`))
    .map(([, a]) => clone(a));
}
