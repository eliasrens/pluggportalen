import admin from "firebase-admin";
import { defaultStudentData } from "../../src/klass-membership.js";
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(app); const auth = admin.auth(app);
const NU = Date.now(); const K = "k848-3a";
for (const uid of process.argv.slice(2)) {
  try { await auth.createUser({ uid, email: `${uid}@elev.pluggportalen.local`, password: "lilla123" }); } catch {}
  const ids = (await db.doc(`classes/${K}`).get()).data().studentIds;
  await db.doc(`classes/${K}`).update({ studentIds: [...new Set([...ids, uid])] });
  await db.doc(`students/${uid}`).set({ namn: uid, username: uid, avatarId: "fox", classIds: [K] });
  const bas = defaultStudentData("fox");
  const ko = (u) => ({ uid: u, id: "animal_cow", name: null, pos: null, trivsel: 100, lastFedAt: NU - 3600_000, lastGiftAt: null });
  await db.doc(`studentData/${uid}`).set({ ...bas, coins: 3000, xp: 100, avatarChosen: true,
    progress: { vikingatiden: { quiz: { completed: true, stars: 2, plays: 1 } } },
    agdaDjur: { "animal_cow#k1": "animal_cow", "animal_cow#k2": "animal_cow" },
    farm: { ...bas.farm, barnLevel: 2, animals: [ko("animal_cow#k1"), ko("animal_cow#k2")] } });
  console.log("✓", uid);
}
process.exit(0);
