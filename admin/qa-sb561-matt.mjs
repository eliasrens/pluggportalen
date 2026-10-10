// QA #561 test 9 / prestanda: när fråga <index> stängts – första/sista svar och stängning i ms efter
// öppning (serverstämplar). BARA emulatorn.
//   <emulator-env> node admin/qa-sb561-matt.mjs <sid> <index>
import admin from "firebase-admin";
const db = admin.initializeApp({ projectId: "pluggportalen-so-2026" }).firestore();
const [sid, ixS] = process.argv.slice(2); const ix = Number(ixS);

for (let i = 0; i < 400; i++) {
  const q = (await db.doc(`liveSessions/${sid}`).get()).data().q;
  if (q?.index === ix && q.closedAt) {
    const o = q.openedAt.toMillis(), c = q.closedAt.toMillis();
    const a = (await db.collection(`liveSessions/${sid}/sbAnswers`).where("q", "==", ix).get()).docs.map((d) => d.data().at.toMillis());
    console.log(JSON.stringify({ index: ix, svar: a.length, forstaSvar_ms: Math.min(...a) - o, sistaSvar_ms: Math.max(...a) - o, stangd_ms: c - o, stangdEfterSista_ms: c - Math.max(...a) }));
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log("timeout"); process.exit(1);
