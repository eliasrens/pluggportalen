// ============================================================================
// Pluggporten – Cloud Functions (functions/index.js)
// ----------------------------------------------------------------------------
// updateStudentLogin (callable, europe-west1 – närmast Firestore eur3): läraren
// byter en elevs användarnamn och/eller lösenord. Admin: allt; årskurskonto
// (#678): bara lösenord för elever i sina klasser. Rollen avgörs som i
// firestore.rules (teacher-role.js). Logiken bor i login-core.js.
//
// Guldrushen (#563, epic #562) – servern avgör allt guld (funktionsspec §6.6):
//   guldrushAnswer       eleven svarar → rättas här, answers/{attemptId}
//   guldrushOpenChest    ett rätt svar → en kista (slumpen här)
//   guldrushChooseVictim stöld/byte i en transaktion + trygghetsreglerna
// Bara inloggade elever som gått med i matchen. Logiken: guldrush-core.js.
//
// Datakuppen (#652, epic Datakuppen) – servern avgör all data, alla koder och
// hack (spec docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §2):
//   datakuppAnswer       eleven svarar → rättas här, answers/{attemptId}
//   datakuppOpenFile     ett rätt svar → en fil (slumpen här)
//   datakuppChooseTarget Hack: välj mål → tre koder i slumpad ordning
//   datakuppGuessCode    en gissning; rätt → 15 % flyttas i en transaktion
//   datakuppPickCode     välj kod (index i förslagen, aldrig en egen kod)
// Logiken: datakuppen-core.js (+ -server/-koder/-hack).
//
// Hitta rätt! (#609, epic #603) – hittaRattSubmit: eleven skickar en hel
// omgångs svar → servern räknar om allt och sparar personbästa, skolans
// topplista, ledare och coins i EN transaktion. Logiken: hitta-ratt-core.js.
// Egna pack (#633, epic #612): hittaRattSparaPack / hittaRattRaderaPack – bara
// admin (#678: egna kartor är inte Plugga-material i §2.1), bara ägaren skriver. hittaRattSattTopplista (#635) slår på/av
// skoltopplistan (PÅ = byggs upp ur personbästa). Logiken: hitta-ratt-egna.js.
//
// Lärarkonton (#677, epic Lärarkonton) – bara admin (färska claims i Auth):
//   adminCreateTeacher / adminUpdateTeacher / adminSetTeacherPassword /
//   adminSetTeacherActive / adminDeleteTeacher. Logiken: teacher-accounts-core.js.
//
// Bråkresan (#708, epic #705) – servern avgör omgångar, bedömning, stjärnor,
// mynt och drake (spec docs/BRAKRESAN-SPEC.md §13, docs/BRAKRESAN.md §6):
//   brakresaStartRound / brakresaAnswer / brakresaRework /
//   brakresaFinishRound / brakresaAbortRound / brakresaAckDragon
// Bara inloggade elever – lärarkonton nekas (testläget körs i klienten och
// skriver aldrig). Logiken: brakresan-core.js + brakresan-avslut.js.
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
import {
  answerQuestion as dkAnswer, openFile as dkOpenFile, chooseTarget as dkChooseTarget,
  guessCode as dkGuessCode, pickCode as dkPickCode,
} from "./datakuppen-core.js";
import { HrFel, submit as hittaRattSubmitCore } from "./hitta-ratt-core.js";
import { sparaPack, raderaPack, sattTopplista } from "./hitta-ratt-egna.js";
import { callerRole } from "./teacher-role.js";
import {
  TeacherError, createTeacher, updateTeacher, setTeacherPassword, setTeacherActive, deleteTeacher,
} from "./teacher-accounts-core.js";
import {
  BrFel, startRound as brStart, answerTask as brAnswer, reworkTask as brRework, finishRound as brFinish,
  abortRound as brAbort, ackDragon as brAckDragon,
} from "./brakresan-core.js";

initializeApp();

export const updateStudentLogin = onCall(
  { region: "europe-west1", maxInstances: 3, memory: "256MiB" },
  async (request) => {
    const caller = request.auth ? await callerRole(getFirestore(), request.auth) : null;
    if (!caller) {
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
        request.data,
        caller
      );
      logger.info("updateStudentLogin", {
        teacher: request.auth.uid,
        role: caller.role,
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

// --- Datakuppen (#652) -----------------------------------------------------------
// Samma rigg som Guldrushen (crypto-slump, samma kapacitet): DkError och
// GrError är båda kistspelsmotorns KsError, så guldrushCall fungerar rakt av.
export const datakuppAnswer = guldrushCall("datakuppAnswer", dkAnswer);
export const datakuppOpenFile = guldrushCall("datakuppOpenFile", dkOpenFile);
export const datakuppChooseTarget = guldrushCall("datakuppChooseTarget", dkChooseTarget);
export const datakuppGuessCode = guldrushCall("datakuppGuessCode", dkGuessCode);
export const datakuppPickCode = guldrushCall("datakuppPickCode", dkPickCode);

// --- Hitta rätt! (#609) ----------------------------------------------------------
// Ett anrop per avslutad omgång (inte per fråga) – låg last. Retry med samma
// attemptId ger samma svar utan nya coins (idempotent).
export const hittaRattSubmit = onCall(
  { region: "europe-west1", memory: "256MiB", concurrency: 40, cpu: 1, maxInstances: 3 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Logga in först.");
    try {
      return await hittaRattSubmitCore({ db: getFirestore(), FieldValue, Timestamp, now: Date.now }, uid, request.data || {});
    } catch (err) {
      if (err instanceof HrFel) throw new HttpsError(err.code, err.message);
      logger.error("hittaRattSubmit oväntat fel", err);
      throw new HttpsError("internal", "Något gick fel på servern – försök igen.");
    }
  }
);

// --- Hitta rätt! egna pack (#633) -------------------------------------------------
// Lärarens egna kartor. Reglerna nekar alla klientskrivningar i hittaRattPacks
// och katalogen – valideringen (items, scope, områden) kräver servern.
function hittaRattLarare(namn, core) {
  return onCall({ region: "europe-west1", memory: "256MiB", maxInstances: 3 }, async (request) => {
    const token = request.auth?.token;
    if ((await callerRole(getFirestore(), request.auth))?.role !== "admin") {
      throw new HttpsError("permission-denied", "Det här kan bara admin göra.");
    }
    const lararNamn = token.name || String(token.email || "").split("@")[0];
    try {
      return await core({ db: getFirestore(), FieldValue, FieldPath, Timestamp, now: Date.now }, request.auth.uid, request.data || {}, { namn: lararNamn });
    } catch (err) {
      if (err instanceof HrFel) throw new HttpsError(err.code, err.message);
      logger.error(`${namn} oväntat fel`, err);
      throw new HttpsError("internal", "Något gick fel på servern – inget ändrades.");
    }
  });
}

export const hittaRattSparaPack = hittaRattLarare("hittaRattSparaPack", sparaPack);
export const hittaRattRaderaPack = hittaRattLarare("hittaRattRaderaPack", raderaPack);
export const hittaRattSattTopplista = hittaRattLarare("hittaRattSattTopplista", sattTopplista);

// --- Lärarkonton (#677) -----------------------------------------------------------
// Snabb koll på token först; kärnan kontrollerar sedan Auth-posten (en gammal
// admin-token från ett nedgraderat eller avstängt konto räcker inte).
function adminCall(name, core) {
  return onCall({ region: "europe-west1", memory: "256MiB", maxInstances: 2 }, async (request) => {
    if (request.auth?.token?.admin !== true) throw new HttpsError("permission-denied", "Det här kan bara admin göra.");
    try {
      const res = await core({ auth: getAuth(), db: getFirestore(), FieldValue }, request.auth.uid, request.data || {});
      logger.info(name, { admin: request.auth.uid, uid: res.uid });
      return res;
    } catch (err) {
      if (err instanceof TeacherError) throw new HttpsError(err.code, err.message);
      logger.error(`${name} oväntat fel`, err);
      throw new HttpsError("internal", "Något gick fel på servern – inget ändrades.");
    }
  });
}

export const adminCreateTeacher = adminCall("adminCreateTeacher", createTeacher);
export const adminUpdateTeacher = adminCall("adminUpdateTeacher", updateTeacher);
export const adminSetTeacherPassword = adminCall("adminSetTeacherPassword", setTeacherPassword);
export const adminSetTeacherActive = adminCall("adminSetTeacherActive", setTeacherActive);
export const adminDeleteTeacher = adminCall("adminDeleteTeacher", deleteTeacher);

// --- Bråkresan (#708) ----------------------------------------------------------
// Ett anrop per svar/avslut. Allt är idempotent (låst första svar, belöning
// per händelse-id), så klienten anropar igen med samma id efter ett nätfel.
// Lärare (claims teacher) nekas: inget lärarflöde får mutera elevdata (§12).
const BR_OPTS = { region: "europe-west1", memory: "512MiB", cpu: 1, concurrency: 40, maxInstances: 4 };

function brakresaCall(name, core) {
  return onCall(BR_OPTS, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Logga in först.");
    if (request.auth.token?.teacher === true) {
      throw new HttpsError("permission-denied", "Lärare provar Bråkresan i testläget – inget sparas på elever.");
    }
    try {
      return await core({ db: getFirestore(), FieldValue, Timestamp, now: Date.now }, uid, request.data || {});
    } catch (err) {
      if (err instanceof BrFel) throw new HttpsError(err.code, err.message);
      logger.error(`${name} oväntat fel`, err);
      throw new HttpsError("internal", "Något gick fel på servern – försök igen.");
    }
  });
}

export const brakresaStartRound = brakresaCall("brakresaStartRound", brStart);
export const brakresaAnswer = brakresaCall("brakresaAnswer", brAnswer);
export const brakresaRework = brakresaCall("brakresaRework", brRework);
export const brakresaFinishRound = brakresaCall("brakresaFinishRound", brFinish);
export const brakresaAbortRound = brakresaCall("brakresaAbortRound", brAbort);
export const brakresaAckDragon = brakresaCall("brakresaAckDragon", brAckDragon);
