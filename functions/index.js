// ============================================================================
// Pluggporten – Cloud Functions (functions/index.js)
// ----------------------------------------------------------------------------
// updateStudentLogin (callable, europe-west1 – närmast Firestore eur3): läraren
// byter en elevs användarnamn och/eller lösenord. Bara Auth-användare med
// custom claim teacher:true (samma som isTeacher() i firestore.rules, sätts via
// admin/set-teacher-claim.mjs). Logiken bor i login-core.js.
//
// ⚠️ DEPLOY KRÄVS: firebase deploy --only functions (Blaze-planen). Klienten
// (src/data-student-login.js) visar ett tydligt fel tills funktionen finns.
// ============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath, FieldValue } from "firebase-admin/firestore";
import { LoginError, updateStudentLogin as updateLogin } from "./login-core.js";

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
