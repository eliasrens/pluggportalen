// ============================================================================
// QA-seed för Klasscentret i byn (#480, epic #476) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Lösenord för alla: lilla123 (endast emulator).
//
//   Klass qa-kc  "QA-klass 4A"  – 14 elever (kc01 … kc14), klass-EXP → Nivå 3
//   Klass qa-kc2 "QA-klass 4B"  –  5 elever (kd01 … kd05), klass-EXP → Nivå 7
//   Klass qa-kc3 "QA-klass 4C"  – 28 elever (ke01 … ke28), klass-EXP → Nivå 3 (#481)
//
// Logga in som kc01 → egna byn (centret först, 14 hus); "Andra byar" → 4B
// visar DERAS center (Nivå 7, view-only). `exp <klass> <antal>` sätter en
// klass EXP (shard 0) för att se nivåbytet live.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8480 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9480 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscenter-by-seed.mjs [exp qa-kc 450]
//
// Idempotent. Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);

const PW = "lilla123"; // endast emulator
const NAMN = ["Alva", "Ebbe", "Saga", "Leo", "Maja", "Noah", "Elsa", "Liam", "Wilma", "Hugo",
  "Alice", "Oskar", "Ella", "Vincent", "Freja", "Elias", "Stella", "Theo", "Ines"];
const AVATARER = ["fox", "owl", "cat", "dog", "panda", "frog", "unicorn", "lion", "penguin", "koala"];
const PALETTER = ["persika", "mint", "himmel", "rosa", "sol", "lavendel", "korall", "skog", "hav"];

const KLASSER = [
  { id: "qa-kc", name: "QA-klass 4A", prefix: "kc", antal: 14, exp: 230, order: 1 },
  { id: "qa-kc2", name: "QA-klass 4B", prefix: "kd", antal: 5, exp: 500, order: 2 },
  // #481: 28-elevsklass för normaliseringskollen (samma EXP/elev som 4A → samma nivå).
  { id: "qa-kc3", name: "QA-klass 4C", prefix: "ke", antal: 28, exp: 460, order: 3 },
];

async function ensureUser(uid, email) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
}

async function satExp(classId, exp) {
  await db.doc(`classCenters/${classId}/expShards/0`).set({
    exp, lastUid: "qa-seed", lastAt: admin.firestore.Timestamp.now(), lastKalla: "qa",
  });
  console.log(`✓ ${classId} exp = ${exp}`);
}

async function main() {
  if (process.argv[2] === "exp") return satExp(process.argv[3], Number(process.argv[4]) || 0);
  for (const k of KLASSER) {
    const ids = [];
    for (let i = 0; i < k.antal; i++) {
      const uid = `${k.prefix}${String(i + 1).padStart(2, "0")}`;
      const avatarId = AVATARER[(i * 3 + k.order) % AVATARER.length];
      const namn = NAMN[(i + k.order * 5) % NAMN.length];
      await ensureUser(uid, `${uid}@elev.pluggportalen.local`);
      await db.doc(`students/${uid}`).set({ namn, username: uid, avatarId, classIds: [k.id] });
      await db.doc(`studentData/${uid}`).set({
        progress: {}, avatarId, coins: 100, xp: 0, room: { paletteId: PALETTER[i % PALETTER.length] },
      });
      ids.push(uid);
    }
    await db.doc(`classes/${k.id}`).set({ name: k.name, order: k.order, createdAt: Date.now(), studentIds: ids });
    await satExp(k.id, k.exp);
    console.log(`✓ klass ${k.id} (${k.antal} elever)`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
