// Preview-stub för src/data.js (#447) – kategori-stubben (#445: RIKTIGA
// data-progress.js mot minnes-Firestore) + det områdessidan behöver.
export * from "/preview/kategori-stubs/data.js";

export async function getArea(_subj, areaId) {
  return (globalThis.__PREVIEW_AREAS || {})[areaId] || null;
}
export async function getClassForStudent() {
  return null;
}
export async function getStudentDataFresh() {
  return globalThis.__MEM;
}
