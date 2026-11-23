// Preview-stub för firebase-functions.js (#910): callablen butikKop körs i
// sidan med den RIKTIGA kärnan (src/butik-core.js) mot Firestore i minnet
// (vinter-908/fb-firestore.js) – samma pris och samma säsongskontroll
// (config/season) som functions/butik-kop.js. Andra callables svarar med fel.
import { getFirestore, doc, getDoc, updateDoc } from "/preview/vinter-908/fb-firestore.js";
import { butikVara, kopVara } from "/src/butik-core.js";

async function butikKop({ itemId }) {
  const db = getFirestore();
  const uid = JSON.parse(localStorage.getItem("pluggportalen.session") || "{}").studentId || "elev1";
  const ref = doc(db, "studentData", uid);
  const snap = await getDoc(ref);
  const vara = butikVara(itemId);
  const sasong = vara?.collection ? (await getDoc(doc(db, "config", "season"))).data() || null : null;
  const r = kopVara(snap.exists() ? snap.data() : {}, vara, { sasong });
  if (r.ok && r.patch) await updateDoc(ref, r.patch);
  console.log("[preview] butikKop", itemId, r.result);
  return r.result;
}

export function getFunctions() { return {}; }
export function httpsCallable(_f, namn) {
  if (namn === "butikKop") return async (data) => ({ data: await butikKop(data) });
  return async () => { throw Object.assign(new Error(`callable ${namn} finns inte i previewn`), { code: "unavailable" }); };
}
