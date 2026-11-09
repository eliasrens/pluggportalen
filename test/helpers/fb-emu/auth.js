// Webb-SDK:ts firebase-auth.js (CDN) → npm-paketet, men varje Auth-instans
// (även den sekundära appen i auth.createStudentAuthAccount) kopplas till
// emulatorn i FIREBASE_AUTH_EMULATOR_HOST. Se firebase-emulator-loader.js.
import { getAuth as npmGetAuth, connectAuthEmulator } from "firebase/auth";
export * from "firebase/auth";

const kopplade = new WeakSet();
export function getAuth(app) {
  const a = npmGetAuth(app);
  if (!kopplade.has(a)) {
    kopplade.add(a);
    connectAuthEmulator(a, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  }
  return a;
}
