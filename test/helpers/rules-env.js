// ============================================================================
// Delad emulator-rigg för regel-testerna (firestore-rules*.test.js).
// ----------------------------------------------------------------------------
// Initierar @firebase/rules-unit-testing mot den RIKTIGA firestore.rules och
// exponerar de tre kontexterna testerna resonerar i:
//   * unauth()  – ingen Auth alls
//   * elev(uid) – inloggad elev, uid == doc-id, ingen teacher-claim
//   * teacher() – valfri uid med custom claim teacher:true
// Varje testfil skapar sin EGEN rigg med ett UNIKT projectId (node --test kan
// köra filerna parallellt mot samma emulator – olika projekt = ingen krock)
// och äger sin egen seed i beforeEach.
// ============================================================================

import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

/**
 * Skapa en regel-testrigg mot firestore.rules.
 * @param {string} projectId unikt per testfil
 * @returns {Promise<{testEnv, unauth, elev, teacher}>}
 */
export async function createRulesEnv(projectId) {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
    },
  });
  return {
    testEnv,
    unauth: () => testEnv.unauthenticatedContext().firestore(),
    elev: (uid) => testEnv.authenticatedContext(uid).firestore(),
    teacher: () => testEnv.authenticatedContext("larare1", { teacher: true }).firestore(),
  };
}
