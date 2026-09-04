// ============================================================================
// E2E-test av auth-flödet mot Auth- + Firestore-EMULATORERNA.
// ----------------------------------------------------------------------------
// Kör exakt den väg klienten kör (Firebase Web SDK: signInWithEmailAndPassword,
// getDoc/setDoc) mot de riktiga firestore.rules, men i emulatorn. Bevisar hela
// kedjan auth → regler → data, inte bara reglerna isolerat:
//
//   1. Seed: lärare (claim teacher:true), elev1 + elev2 med Auth-konton, data.
//   2. Elev1 loggar in med användarnamn→e-post + lösenord (oförändrad UX).
//   3. Elev1 läser BARA sin egen data; en annan elevs data nekas.
//   4. Elev1:s försök att direktskriva elev2:s studentData NEKAS.
//   5. Läraren loggar in, skapar en elev och ger coins – tillåts.
//   6. Utloggad (obehörig) kan inte läsa students eller skriva studentData.
//
// Körs via:  npm run test:e2e
// (firebase emulators:exec startar auth+firestore, kör detta, river dem.)
// Kräver Java 21+ (emulatorerna) – se docs/ADMIN.md.
//
// OBS testlösenord: emulatorn tillåter godtyckligt korta lösenord, men för att
// spegla live (Firebase-krav >= 6) använder vi >= 6 tecken här. Det verkliga
// live-testkontot är elev1/123 (se README + docs/ADMIN.md).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { terminate } from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  connectFirestoreEmulator,
} from "firebase/firestore";

// Måste matcha projektet emulatorn kör som (firebase emulators:exec sätter
// GCLOUD_PROJECT), annars hittar klienten inte de admin-seedade användarna i
// singleProjectMode.
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT ||
  "pluggportalen-so-2026";
const DOMAIN = "elev.pluggportalen.local";
const usernameToEmail = (u) => `${String(u).trim().toLowerCase()}@${DOMAIN}`;

const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

// --- Admin (seed, kringgår regler) -----------------------------------------
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
const adminApp = admin.initializeApp({ projectId: PROJECT_ID });
const adminAuth = admin.auth(adminApp);
const adminDb = admin.firestore(adminApp);

// --- Klient (samma SDK som appen) ------------------------------------------
const clientApp = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID });
const clientAuth = getAuth(clientApp);
const clientDb = getFirestore(clientApp);
connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
connectFirestoreEmulator(clientDb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));

const TEACHER_EMAIL = "larare@skolan.se";
const TEACHER_PW = "larare123";
const ELEV1_PW = "hejsan6"; // >= 6 för emulator-seed via createUser-liknande väg

test("seed: skapa lärare, elever och data i emulatorn", async () => {
  const t = await adminAuth.createUser({ email: TEACHER_EMAIL, password: TEACHER_PW });
  await adminAuth.setCustomUserClaims(t.uid, { teacher: true });

  await adminAuth.createUser({ uid: "elev1", email: usernameToEmail("elev1"), password: ELEV1_PW });
  await adminAuth.createUser({ uid: "elev2", email: usernameToEmail("elev2"), password: "hejsan7" });

  await adminDb.doc("students/elev1").set({ namn: "Astrid", username: "elev1", avatarId: "fox" });
  await adminDb.doc("students/elev2").set({ namn: "Björn", username: "elev2", avatarId: "owl" });
  await adminDb.doc("studentData/elev1").set({ coins: 300, progress: {} });
  await adminDb.doc("studentData/elev2").set({ coins: 50, progress: {} });
  await adminDb.doc("subjects/so").set({ name: "SO", order: 1 });
});

test("elev1 loggar in (användarnamn→e-post) och ser BARA sin egen data", async () => {
  const cred = await signInWithEmailAndPassword(clientAuth, usernameToEmail("elev1"), ELEV1_PW);
  assert.equal(cred.user.uid, "elev1", "uid ska vara det gamla doc-id:t");

  const own = await getDoc(doc(clientDb, "studentData", "elev1"));
  assert.ok(own.exists(), "elev1 ska kunna läsa sin egen studentData");
  assert.equal(own.data().coins, 300);

  const ownStudent = await getDoc(doc(clientDb, "students", "elev1"));
  assert.ok(ownStudent.exists(), "elev1 ska kunna läsa sitt eget students-dokument");

  // Innehåll är läsbart för inloggade.
  const subj = await getDoc(doc(clientDb, "subjects", "so"));
  assert.ok(subj.exists());

  // En annan elevs data ska NEKAS.
  await assert.rejects(
    () => getDoc(doc(clientDb, "studentData", "elev2")),
    /permission-denied|PERMISSION_DENIED|Missing or insufficient/i,
    "elev1 ska INTE kunna läsa elev2:s studentData"
  );
  await assert.rejects(
    () => getDoc(doc(clientDb, "students", "elev2")),
    /permission-denied|PERMISSION_DENIED|Missing or insufficient/i,
    "elev1 ska INTE kunna läsa elev2:s students-dokument"
  );
});

test("elev1 kan skriva sin egen studentData men INTE elev2:s (fusk nekas)", async () => {
  await setDoc(doc(clientDb, "studentData", "elev1"), { coins: 305, progress: {} }, { merge: true });
  const own = await getDoc(doc(clientDb, "studentData", "elev1"));
  assert.equal(own.data().coins, 305);

  await assert.rejects(
    () => setDoc(doc(clientDb, "studentData", "elev2"), { coins: 0 }, { merge: true }),
    /permission-denied|PERMISSION_DENIED|Missing or insufficient/i,
    "elev1 ska INTE kunna skriva elev2:s studentData"
  );
  await signOut(clientAuth);
});

test("obehörig (utloggad) kan inte läsa students eller skriva studentData", async () => {
  await assert.rejects(
    () => getDoc(doc(clientDb, "students", "elev1")),
    /permission-denied|PERMISSION_DENIED|Missing or insufficient/i
  );
  await assert.rejects(
    () => setDoc(doc(clientDb, "studentData", "elev1"), { coins: 999999 }),
    /permission-denied|PERMISSION_DENIED|Missing or insufficient/i
  );
});

test("lärare loggar in, skapar elev-dokument och ger coins", async () => {
  const cred = await signInWithEmailAndPassword(clientAuth, TEACHER_EMAIL, TEACHER_PW);
  const tok = await cred.user.getIdTokenResult(true);
  assert.equal(tok.claims.teacher, true, "läraren ska ha teacher-claim");

  // Skapa students-dokument (Auth-kontot skapas i klienten via sekundär app –
  // här testar vi Firestore-behörigheten: läraren får skriva students).
  await setDoc(doc(clientDb, "students", "elev3"), { namn: "Ny", username: "elev3", avatarId: "fox" });
  const created = await getDoc(doc(clientDb, "students", "elev3"));
  assert.ok(created.exists(), "läraren ska kunna skapa students-dokument");

  // Ge coins till elev2 (klassöversikt/belöning).
  await setDoc(doc(clientDb, "studentData", "elev2"), { coins: 80 }, { merge: true });
  const e2 = await getDoc(doc(clientDb, "studentData", "elev2"));
  assert.equal(e2.data().coins, 80);

  await signOut(clientAuth);
});

// Stäng alla öppna handles så node kan avsluta (annars hänger emulators:exec).
after(async () => {
  try { await terminate(clientDb); } catch {}
  try { await deleteApp(clientApp); } catch {}
  try { await adminApp.delete(); } catch {}
  // Firebase Auth kan hålla kvar en timer en kort stund – tvinga rent avslut.
  setTimeout(() => process.exit(process.exitCode ?? 0), 250).unref();
});
