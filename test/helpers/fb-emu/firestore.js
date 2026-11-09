// Webb-SDK:ts firebase-firestore.js (CDN) → npm-paketet, kopplat till
// emulatorn i FIRESTORE_EMULATOR_HOST. Se firebase-emulator-loader.js.
import { getFirestore as npmGetFirestore, connectFirestoreEmulator } from "firebase/firestore";
export * from "firebase/firestore";

const kopplade = new WeakSet();
export function getFirestore(app) {
  const db = npmGetFirestore(app);
  if (!kopplade.has(db)) {
    kopplade.add(db);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    connectFirestoreEmulator(db, host, Number(port));
  }
  return db;
}
