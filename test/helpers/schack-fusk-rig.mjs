// ============================================================================
// Tester-rigg för fuskproven mot Schack 2A (#779): en inloggad klientapp per elev
// (så att anrop kan köras SAMTIDIGT), Admin SDK för att se/ändra tillstånd och
// tidsförskjuta, och en återställning mellan testerna. Delas av
// functions-schack-fusk-{lobby,parti,regler}.test.mjs. Egna id-prefix (scf-).
// ============================================================================

import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

export const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

export const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "scf-admin");
export const adb = adminApp.firestore();
export const FV = admin.firestore.FieldValue;

const PW = "schack779";
export const KLASS = "scf-4a";
export const KLASS_B = "scf-4b";
export const ANNA = "scfanna";
export const BO = "scfbo";
export const CIA = "scfcia";
export const DAN = "scfdan"; // bara klass B
export const ADMIN = "scfadmin";
export const AK = "scfak"; // årskurskonto med scf-4a
export const AK5 = "scfak5"; // årskurskonto utan
export const AKOFF = "scfakoff"; // avstängt årskurskonto med scf-4a
export const ADMOFF = "scfadmoff"; // admin-claims men avstängt konto
export const ALLA = [ANNA, BO, CIA, DAN, ADMIN, AK, AK5, AKOFF, ADMOFF];
export const email = (u) => `${u}@elev.pluggportalen.local`;

const clients = new Map();
export async function who(uid) {
  if (clients.has(uid)) return clients.get(uid);
  const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, `scf-${uid}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email(uid), PW);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
  const fns = getFunctions(app, "europe-west1");
  connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
  const c = { uid, app, db, call: (name, d) => httpsCallable(fns, name)(d).then((r) => r.data) };
  clients.set(uid, c);
  return c;
}
export const code = async (p) => {
  try {
    await p;
  } catch (e) {
    return String(e?.code || "").replace(/^(functions|firestore)\//, "");
  }
  return "ok";
};

export async function stang() {
  for (const c of clients.values()) await deleteApp(c.app).catch(() => {});
  await adminApp.delete().catch(() => {});
}

export const getP = async (id) => (await adb.doc(`schackPartier/${id}`).get()).data();
export const getK = async (id = KLASS) => (await adb.doc(`schackKlass/${id}`).get()).data();

export async function reset({ extra = {}, enabledB = true } = {}) {
  for (const coll of ["schackKlass", "schackPartier"]) {
    const s = await adb.collection(coll).get();
    await Promise.all(s.docs.filter((d) => d.id.startsWith("scf") || (d.data().classId || "").startsWith("scf")).map((d) => d.ref.delete()));
  }
  await adb.doc(`classes/${KLASS}`).set({ name: "4A", studentIds: [ANNA, BO, CIA], enabledModules: ["schack"], ...extra });
  await adb.doc(`classes/${KLASS_B}`).set({ name: "4B", studentIds: [DAN, ANNA], ...(enabledB ? { enabledModules: ["schack"] } : {}) });
  await adb.doc(`classProjections/${KLASS}`).set({ members: { [ANNA]: { namn: "Anna" }, [BO]: { namn: "Bo" }, [CIA]: { namn: "Cia" } } });
  await adb.doc(`classProjections/${KLASS_B}`).set({ members: { [ANNA]: { namn: "Anna" }, [DAN]: { namn: "Dan" } } });
  for (const uid of [ANNA, BO, CIA, DAN]) await adb.doc(`studentData/${uid}`).set({ coins: 0 });
}

export async function nytt(a, b, { klocka = null, classId = KLASS } = {}) {
  const ca = await who(a);
  const cb = await who(b);
  await ca.call("schackVanta", { classId, klocka });
  const r = await cb.call("schackGaMed", { classId, motstandare: a });
  const vit = r.farg === "w" ? b : a;
  return { partiId: r.partiId, vit, svart: vit === a ? b : a };
}

export async function seed() {
  const a = admin.auth(adminApp);
  for (const uid of ALLA) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  await a.setCustomUserClaims(ADMIN, { teacher: true, admin: true });
  await a.setCustomUserClaims(ADMOFF, { teacher: true, admin: true });
  for (const uid of [AK, AK5, AKOFF]) await a.setCustomUserClaims(uid, { teacher: true, role: "arskurs" });
  await adb.doc(`teacherAccounts/${AK}`).set({ role: "arskurs", classIds: [KLASS], active: true });
  await adb.doc(`teacherAccounts/${AK5}`).set({ role: "arskurs", classIds: [KLASS_B], active: true });
  await adb.doc(`teacherAccounts/${AKOFF}`).set({ role: "arskurs", classIds: [KLASS], active: false });
  await adb.doc(`teacherAccounts/${ADMOFF}`).set({ role: "admin", active: false });
  await reset();
}

