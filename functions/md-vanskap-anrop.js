// ============================================================================
// Matchdagen – vänskapsmatchernas callables (functions/md-vanskap-anrop.js, #874, spec §11)
// ----------------------------------------------------------------------------
// europe-west1 som schacket. index.js re-exporterar dem.
//   mdUtmana { classId, till }          utmana en klasskompis med Matchdagen
//   mdSvara  { utmaningId, ja, classId? } anta / tacka nej / ta tillbaka → matchen startar
//   mdFraga  { matchId, val }           elevens drag i läget → lägets fråga (privat dokument, utan facit)
//   mdSvar   { matchId, svar }          svaret rättas på servern; båda svarat → läget avgörs
//   mdTick   { matchId, redo? }         tiden ute / halvtid (redo = "Andra halvlek") / walkover
//   mdGeUpp  { matchId }                lämna matchen (walkover)
// Bara inloggade elever. Logiken: md-vanskap-lobby.js och md-vanskap-spel.js (+ -state, -fragor).
// Slumpen ur node:crypto (ctx). ⚠️ DEPLOY: rules → functions → webben.
// ============================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { MdFel } from "./md-vanskap-state.js";
import { utmana, svara } from "./md-vanskap-lobby.js";
import { fraga, svar, tick, geUpp } from "./md-vanskap-spel.js";

const MD_OPTS = { region: "europe-west1", memory: "256MiB", cpu: 1, concurrency: 40, maxInstances: 3 };
const deps = () => ({ db: getFirestore(), FieldValue, now: Date.now });

function mdCall(name, core) {
  return onCall(MD_OPTS, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Logga in först.");
    if (request.auth.token?.teacher === true) throw new HttpsError("permission-denied", "Vänskapsmatcher spelas av elever.");
    try {
      return await core(deps(), uid, request.data || {});
    } catch (err) {
      if (err instanceof MdFel) throw new HttpsError(err.code, err.message);
      logger.error(`${name} oväntat fel`, err);
      throw new HttpsError("internal", "Något gick fel på servern – försök igen.");
    }
  });
}

export const mdUtmana = mdCall("mdUtmana", utmana);
export const mdSvara = mdCall("mdSvara", svara);
export const mdFraga = mdCall("mdFraga", fraga);
export const mdSvar = mdCall("mdSvar", svar);
export const mdTick = mdCall("mdTick", tick);
export const mdGeUpp = mdCall("mdGeUpp", geUpp);
