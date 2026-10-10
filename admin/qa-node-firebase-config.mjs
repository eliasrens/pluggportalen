// QA (#561): ersätter src/firebase-config.js när appens moduler körs i node
// (admin/qa-node-app-loader.mjs). Emulator + inloggning som QA_UID.
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) throw new Error("Avbryter: bara emulator (FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST).");
export const firebaseConfig = { apiKey: "qa", projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" };
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
const [host, port] = FS.split(":");
connectFirestoreEmulator(db, host, Number(port));
const uid = process.env.QA_UID;
if (uid) {
  const dom = process.env.QA_ROLL === "larare" ? "larare" : "elev";
  await signInWithEmailAndPassword(auth, `${uid}@${dom}.pluggportalen.local`, "lilla123");
}
