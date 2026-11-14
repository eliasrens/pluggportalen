// Preview-stub för Firestore-SDK:t (#445) – ett enda studentData-dokument i
// minnet. Räcker för att den RIKTIGA src/data-progress.js (saveProgress) ska
// köras oförändrad: doc() + updateDoc() med punkt-sökvägar + serverTimestamp().
// #853: runTransaction för data-mynt.js tjanaMynt – dagskvittot
// studentData/{uid}/myntDag/{dag} ligger i globalThis.__MEM_DOCS.
export const MEM = (globalThis.__MEM = globalThis.__MEM || { coins: 0, xp: 0, progress: {} });
const DOCS = (globalThis.__MEM_DOCS = globalThis.__MEM_DOCS || {});

export function doc(_db, coll, id, ...rest) {
  return { coll, id, rest };
}
const sti = (ref) => [ref.coll, ref.id, ...(ref.rest || [])].join("/");
const arElev = (ref) => ref.coll === "studentData" && !(ref.rest || []).length;
const kopia = (d) => JSON.parse(JSON.stringify(d));
function merge(a, b) {
  for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  return a;
}
export async function runTransaction(_db, fn) {
  const ut = [];
  const tx = {
    get: async (ref) => {
      const d = arElev(ref) ? MEM : DOCS[sti(ref)];
      return { exists: () => d != null, data: () => kopia(d) };
    },
    set: (ref, data, opt) => ut.push(() => {
      if (arElev(ref)) Object.assign(MEM, kopia(data));
      else DOCS[sti(ref)] = opt && opt.merge ? merge(DOCS[sti(ref)] || {}, kopia(data)) : kopia(data);
    }),
    update: (ref, patch) => ut.push(() => (arElev(ref) ? updateDoc(ref, patch) : merge(DOCS[sti(ref)], kopia(patch)))),
  };
  const r = await fn(tx);
  ut.forEach((f) => f());
  console.log("[preview] transaktion", kopia(DOCS));
  return r;
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
