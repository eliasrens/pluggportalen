// ============================================================================
// Butiken på SERVERN – callable butikKop (functions/butik-kop.js, #854, epic #851)
// ----------------------------------------------------------------------------
// Alla köp i butiken (varor, ägg, värmelampa, Mysterymat, djur, gårdsdjur,
// gårdsuppgraderingar och mysterylådorna) går hit. Klienten skickar bara
// { itemId } (src/butik-kop.js); priset tas ur katalogen och mysterylådan lottas
// här, med slumpen ur node:crypto. Logiken är den rena kopVara i butik/butik-core.js
// (kopia av src/, admin/sync-butik-functions.mjs) – samma svar som de gamla
// klientfunktionerna: { ok, coins, owned?, counts?, pets?, animals?, farm?,
// appleCount?, item?, duplicate?, refund?, error? }.
//
// EN transaktion per köp: läser studentData/{uid} (+ config/season för en
// samlingsvara) och skriver patchen. Två samtidiga köp av samma single-vara drar
// alltså bara en gång (den andra transaktionen ser varan som ägd).
// Bara inloggade elever – lärarkonton (claim teacher) nekas. Ingen klass- eller
// låskontroll: butiken är inte låsgrindad. Reglerna rörs inte (additivt, B2).
// ============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import { butikVara, kopVara } from "./butik/butik-core.js";

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

/**
 * Ett köp. deps = { db, now?(), rng?() } (tester injicerar klocka/slump).
 * @returns {Promise<object>} köpets result (se huvudet)
 */
export async function kopa(deps, uid, data = {}) {
  const { db } = deps;
  const vara = butikVara(data.itemId);
  const ref = db.collection("studentData").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const sasong = vara?.collection ? (await tx.get(db.collection("config").doc("season"))).data() || null : null;
    const r = kopVara(snap.exists ? snap.data() : {}, vara, { nu: (deps.now || Date.now)(), rng: deps.rng || rng, sasong });
    if (r.ok && r.patch) {
      // Utan dokument finns inga mynt – kopVara ger då ok:false för allt som kostar något.
      if (!snap.exists) return { ok: false, coins: 0, error: "Eleven saknar data." };
      tx.update(ref, r.patch);
    }
    return r.result;
  });
}

export const butikKop = onCall({ region: "europe-west1", maxInstances: 3, memory: "256MiB" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Logga in först.");
  if (request.auth.token?.teacher === true) {
    throw new HttpsError("permission-denied", "Lärarkonton handlar inte i butiken.");
  }
  if (typeof request.data?.itemId !== "string") throw new HttpsError("invalid-argument", "Ange en vara.");
  try {
    return await kopa({ db: getFirestore() }, uid, request.data);
  } catch (err) {
    logger.error("butikKop oväntat fel", err);
    throw new HttpsError("internal", "Något gick fel vid köpet – inget drogs.");
  }
});
