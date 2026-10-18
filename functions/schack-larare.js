// ============================================================================
// Schack på SERVERN – lärarens callables (functions/schack-larare.js, #779;
// spec §8 och §10, UI:t byggs i 2C)
// ----------------------------------------------------------------------------
// Grinden är hasClass(classId) som i firestore.rules: admin, eller årskurskonto
// vars kontodokument har klassen (assertLarare i schack-state.js).
//
//   larareAvsluta    { partiId } → { slut: { resultat: null, orsak: "avbrutet" } }
//                    partiet slutar som avbrutet; tabellen rörs inte (§10)
//   larareTopplista  { classId, dold?: bool, nollstall?: bool } → { dold, nollstalld }
//                    dölj/visa topplistan för klassen och/eller nollställ `tabell`
// ============================================================================

import { SchackFel, KLASS_COLL, PARTI_COLL, ctx, idEller, klassData, assertLarare } from "./schack-state.js";
import { avslutaParti } from "./schack-parti.js";

export { SchackFel };

export async function larareAvsluta(deps, auth, data = {}) {
  const c = ctx(deps);
  const partiId = idEller(data.partiId, "parti-id");
  const partiRef = c.db.collection(PARTI_COLL).doc(partiId);
  const fore = await partiRef.get();
  if (!fore.exists) throw new SchackFel("not-found", "Partiet finns inte.");
  await assertLarare(c.db, auth, fore.data().classId);
  return c.db.runTransaction(async (tx) => {
    const snap = await tx.get(partiRef);
    const parti = snap.data();
    if (parti.status !== "pagar") throw new SchackFel("failed-precondition", "Partiet är redan slut.");
    const klassRef = c.db.collection(KLASS_COLL).doc(parti.classId);
    const klass = klassData(await tx.get(klassRef));
    const nu = c.now();
    return { slut: avslutaParti(tx, { partiRef, parti, klassRef, klass, resultat: null, orsak: "avbrutet", nu }) };
  });
}

export async function larareTopplista(deps, auth, data = {}) {
  const c = ctx(deps);
  const classId = idEller(data.classId, "klass-id");
  const satt = "dold" in data && data.dold != null;
  const nollstall = data.nollstall === true;
  if (satt && typeof data.dold !== "boolean") throw new SchackFel("invalid-argument", "dold måste vara true eller false.");
  if (!satt && !nollstall) throw new SchackFel("invalid-argument", "Ange dold och/eller nollstall.");
  await assertLarare(c.db, auth, classId);
  const ref = c.db.collection(KLASS_COLL).doc(classId);
  return c.db.runTransaction(async (tx) => {
    const klass = klassData(await tx.get(ref));
    const dold = satt ? data.dold : klass.dold;
    tx.set(ref, { ...klass, dold, tabell: nollstall ? {} : klass.tabell });
    return { dold, nollstalld: nollstall };
  });
}
