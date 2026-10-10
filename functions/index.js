// ============================================================================
// Pluggporten – Cloud Functions (functions/index.js)
// ----------------------------------------------------------------------------
// updateStudentLogin (callable, europe-west1 – närmast Firestore eur3): läraren
// byter en elevs användarnamn och/eller lösenord. Bara Auth-användare med
// custom claim teacher:true (samma som isTeacher() i firestore.rules, sätts via
// admin/set-teacher-claim.mjs). Logiken bor i login-core.js.
//
// Guldrushen (#563, epic #562) – servern avgör allt guld (funktionsspec §6.6):
//   guldrushAnswer       eleven svarar → rättas här, answers/{attemptId}
//   guldrushOpenChest    ett rätt svar → en kista (slumpen här)
//   guldrushChooseVictim stöld/byte i en transaktion + trygghetsreglerna
// Bara inloggade elever som gått med i matchen. Logiken: guldrush-core.js.
//
// ⚠️ DEPLOY KRÄVS: firebase deploy --only functions (Blaze-planen). Klienten
// (src/data-student-login.js, src/live/formats/guldrush/guldrush-data.js) visar
// ett tydligt fel tills funktionerna finns.
// ============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { LoginError, updateStudentLogin as updateLogin } from "./login-core.js";
import { GrError, answerQuestion, openChest, chooseVictim } from "./guldrush-core.js";

initializeApp();

export const updateStudentLogin = onCall(
  { region: "europe-west1", maxInstances: 3, memory: "256MiB" },
  async (request) => {
    if (request.auth?.token?.teacher !== true) {
      throw new HttpsError("permission-denied", "Bara lärare får ändra elevers inloggning.");
    }
    try {
      const res = await updateLogin(
        {
          auth: getAuth(),
          db: getFirestore(),
          FieldPath,
          serverTimestamp: () => FieldValue.serverTimestamp(),
        },
        request.data
      );
      logger.info("updateStudentLogin", {
        teacher: request.auth.uid,
        uid: res.uid,
        usernameChanged: res.usernameChanged,
        passwordChanged: res.passwordChanged,
      });
      return res;
    } catch (err) {
      if (err instanceof LoginError) throw new HttpsError(err.code, err.message);
      logger.error("updateStudentLogin oväntat fel", err);
      throw new HttpsError("internal", "Något gick fel på servern – inget ändrades.");
    }
  }
);

// --- Guldrushen (#563) ---------------------------------------------------------
// Slumpen ur node:crypto (inte Math.random) – kistornas innehåll ska inte gå
// att förutsäga. cpu 1 + concurrency: 30 elever som svarar samtidigt ryms i
// en instans; maxInstances begränsar kostnaden.
const GR_OPTS = { region: "europe-west1", memory: "512MiB", cpu: 1, concurrency: 40, maxInstances: 4 };
const grRng = () => randomInt(0, 2 ** 32) / 2 ** 32;
const grDeps = () => ({ db: getFirestore(), FieldValue, Timestamp, now: Date.now, rng: grRng });

function guldrushCall(name, fn) {
  return onCall(GR_OPTS, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Logga in först.");
    try {
      return await fn(grDeps(), uid, request.data || {});
    } catch (err) {
      if (err instanceof GrError) throw new HttpsError(err.code, err.message);
      logger.error(`${name} oväntat fel`, err);
      throw new HttpsError("internal", "Något gick fel på servern – försök igen.");
    }
  });
}

export const guldrushAnswer = guldrushCall("guldrushAnswer", answerQuestion);
export const guldrushOpenChest = guldrushCall("guldrushOpenChest", openChest);
export const guldrushChooseVictim = guldrushCall("guldrushChooseVictim", chooseVictim);
