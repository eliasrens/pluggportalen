// QA #561: vänta tills Snilleblixt-sessionen nått fråga <index> (och fas) eller är slut. BARA emulatorn.
//   <emulator-env> node admin/qa-sb561-vanta.mjs <sid> <index> [open|closed|revealed]
import admin from "firebase-admin";
const db = admin.initializeApp({ projectId: "pluggportalen-so-2026" }).firestore();
const [sid, ix, fas] = process.argv.slice(2);
for (let i = 0; i < 600; i++) {
  const s = (await db.doc(`liveSessions/${sid}`).get()).data();
  if (s.status === "finished" || (s.q && s.q.index >= Number(ix) && (!fas || s.q.phase === fas))) { console.log(s.status, JSON.stringify({ index: s.q?.index, phase: s.q?.phase })); process.exit(0); }
  await new Promise((r) => setTimeout(r, 300));
}
console.log("timeout"); process.exit(1);
