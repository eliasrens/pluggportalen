// ============================================================================
// QA-seed för lärarens "Redigera inloggning" + inloggningskort – BARA emulator.
// ----------------------------------------------------------------------------
// Lärare qalarare / lilla123 (claim teacher:true) och klassen 4B med fem elever.
// Tre har ett sparat lösenord i studentCredentials (som om kontot skapats i
// lärarsidan), två är "gamla" konton utan (→ "Lösenord okänt – sätt nytt").
// Omar (omar861) är fallet Elias ändrade för hand. Idempotent.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-inloggning-seed.mjs
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const email = (u, dom = "elev") => `${u}@${dom}.pluggportalen.local`;

async function user(uid, mail, password, claims) {
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, email: mail, password });
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

const ELEVER = [
  ["qa-omar", "Omar", "omar861", "tiger555", "lion"],
  ["qa-lisa", "Lisa", "lisa4b", "katt482", "cat"],
  ["qa-sam", "Sam", "sam4b", "raket907", "owl"],
  ["qa-nora", "Nora", "nora4b", null, "fox"],
  ["qa-ali", "Ali", "ali4b", null, "panda"],
];

async function main() {
  await user("qalarare", email("qalarare", "larare"), "lilla123", { teacher: true });
  const members = {};
  for (const [uid, namn, username, pw, avatarId] of ELEVER) {
    await user(uid, email(username), pw || "gammalt1");
    await db.doc(`students/${uid}`).set({ namn, username, avatarId });
    await db.doc(`studentData/${uid}`).set({ coins: 50, progress: {}, avatarId }, { merge: true });
    const cred = db.doc(`studentCredentials/${uid}`);
    if (pw) await cred.set({ username, password: pw, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    else await cred.delete();
    members[uid] = { namn, username, avatarId, avatarItems: [], xp: 0, completed: 0, stars: 0 };
  }
  await db.doc("classes/4b").set({ name: "4B", order: 1, studentIds: ELEVER.map((e) => e[0]) });
  await db.doc("classProjections/4b").set({ members });
  console.log("✓ qalarare / lilla123 – klass 4B med 5 elever (3 med sparat lösenord).");
}

main().then(() => process.exit(0), (e) => (console.error(e), process.exit(1)));
