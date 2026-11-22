// ============================================================================
// Pluggporten – veckoschema per klass (#901): persistens
// ----------------------------------------------------------------------------
// setClassSchema skriver classes/{id}.schema HELT (formen bor i klass-schema.js,
// gränserna i firestore.rules validSchemaShape). EN skrivning per sparning.
// Egen fil av samma skäl som data-class-lock.js: laddas bara DYNAMISKT (lärarens
// sektion Veckoschema), så bootgrafen växer inte (incident #271).
// ============================================================================

import { db, auth } from "./firebase-config.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearClassCache } from "./data-classes.js";
import { normalizeSchema } from "./klass-schema.js";

/**
 * Spara klassens veckoschema (ersätter fältet helt).
 * @param {string} classId
 * @param {{pa:boolean, lektioner:Array, koppling:object}} schema
 * @returns {Promise<{pa:boolean, lektioner:Array, koppling:object}>} det sparade (normaliserade)
 */
export async function setClassSchema(classId, schema) {
  const clean = normalizeSchema(schema);
  if (!clean) throw new Error("Schemat gick inte att spara.");
  await updateDoc(doc(db, "classes", classId), {
    schema: { ...clean, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || null },
  });
  clearClassCache();
  return clean;
}
