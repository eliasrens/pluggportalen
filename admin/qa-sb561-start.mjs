// QA #561 – körs med admin/qa-node-app-loader.mjs som lärare (QA_UID=rasmus QA_ROLL=larare).
// QA #561: STARTA (appens startLiveSession) + test 3b: svarssättet låst efter start (lärarens skrivning nekas).
const [sid] = process.argv.slice(2);
const live = await import("../src/live/live-data.js");
const { db } = await import("../src/firebase-config.js");
const { doc, updateDoc } = await import("firebase/firestore");
console.log("start:", await live.startLiveSession(sid));
for (const patch of [{ answerKind: "choice" }, { questionSeconds: 60 }, { questionCount: 5 }]) {
  try { await updateDoc(doc(db, "liveSessions", sid), patch); console.log("ÄNDRADE", JSON.stringify(patch)); }
  catch (e) { console.log("nekad", JSON.stringify(patch), e.code); }
}
process.exit(0);
