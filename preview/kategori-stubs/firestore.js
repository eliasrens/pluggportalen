// Preview-stub för Firestore-SDK:t (#445) – ett enda studentData-dokument i
// minnet. Räcker för att den RIKTIGA src/data-progress.js (saveProgress) ska
// köras oförändrad: doc() + updateDoc() med punkt-sökvägar + serverTimestamp().
export const MEM = (globalThis.__MEM = globalThis.__MEM || { coins: 0, progress: {} });

export function doc(_db, coll, id) {
  return { coll, id };
}
export function serverTimestamp() {
  return { seconds: Math.floor(Date.now() / 1000) };
}
export async function updateDoc(_ref, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split(".");
    let cur = MEM;
    for (const k of keys.slice(0, -1)) cur = cur[k] = cur[k] && typeof cur[k] === "object" ? cur[k] : {};
    cur[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
  }
  console.log("[preview] updateDoc", patch);
}
