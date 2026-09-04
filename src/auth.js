// ============================================================================
// Pluggportalen – autentisering (auth.js)
// ----------------------------------------------------------------------------
// Äkta Firebase Auth ligger BAKOM samma enkla UX som förut: eleven loggar in
// med användarnamn + lösenord, läraren låser upp lärarläget med sitt konto.
//
// Varför ett auth-lager mellan appen och Firebase Auth?
//   * Resten av appen förlitar sig på SYNKRONA anrop: currentStudentId(),
//     isLoggedIn(), getSession(), isTeacher(). Firebase Auth återställer sin
//     session ASYNKRONT vid sidladdning (onAuthStateChanged). Vi håller därför
//     en liten synkron spegel (cache) som fylls så fort auth är klar, och
//     app.js väntar in authReady() innan första sidan ritas – så en "kom-ihåg-
//     mig"-elev inte kastas ut vid en omladdning.
//   * Elevens användarnamn mappas deterministiskt till en SYNTETISK e-post
//     (username@elev.pluggportalen.local). Eleven ser aldrig någon e-post.
//   * Elevens Firestore-dokument-id = Auth-uid (migreringen sätter uid = det
//     gamla doc-id:t, t.ex. "elev1", så kopplingen till studentData behålls).
//
// Källa till sanning för "vem är inloggad" = Firebase Auth. localStorage-spegeln
// är bara en bekvämlighet och rekoncilieras alltid mot auth vid uppstart.
// ============================================================================

import { app, auth, firebaseConfig, db } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Syntetisk e-postdomän för elevkonton. Ändra INTE i efterhand – den är en del
// av mappningen username -> Auth-konto och måste matcha migreringsskriptet.
export const ELEV_EMAIL_DOMAIN = "elev.pluggportalen.local";

/** Firebase Auth kräver minst 6 tecken i ett lösenord. */
export const MIN_PASSWORD_LEN = 6;

/**
 * Mappar ett elevanvändarnamn till dess syntetiska e-post. Ren strängoperation
 * (ingen Firestore-läsning) så inloggningen inte behöver läsa `students` i
 * förväg. `elev1` -> `elev1@elev.pluggportalen.local`.
 */
export function usernameToEmail(username) {
  return `${String(username || "").trim().toLowerCase()}@${ELEV_EMAIL_DOMAIN}`;
}

// ---------------------------------------------------------------------------
// Synkron session-spegel (bara vem som är inloggad: studentId + namn).
// ---------------------------------------------------------------------------

const SESSION_KEY = "pluggportalen.session";

function readMirror() {
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeMirror(session, remember) {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    const raw = JSON.stringify(session);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, raw);
  } catch {}
}
function clearMirror() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

// Optimistisk start-spegel; rekoncilieras mot Firebase Auth i authReady.
let cachedSession = readMirror();
let teacherClaim = false; // sätts true när en lärar-Auth-användare är inloggad

/** Sessionsobjektet ({ studentId, namn, username }) eller null. */
export function getSession() {
  return cachedSession;
}
/** Den inloggade elevens id (= Auth-uid), eller null. */
export function currentStudentId() {
  return cachedSession?.studentId ?? null;
}
/** Är en elev inloggad? */
export function isLoggedIn() {
  return !!cachedSession;
}
/** Är den inloggade användaren lärare (custom claim teacher:true)? */
export function isTeacher() {
  return teacherClaim === true;
}

// ---------------------------------------------------------------------------
// Auth-ready: rekonciliera den synkrona spegeln mot Firebase Auth EN gång vid
// uppstart, inndan routern ritar första sidan.
// ---------------------------------------------------------------------------

let resolveReady;
const authReady = new Promise((res) => (resolveReady = res));
let readySettled = false;

/** Resolvar när Firebase Auth har återställt (eller bekräftat frånvaron av) en session. */
export function whenAuthReady() {
  return authReady;
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      teacherClaim = false;
      cachedSession = null;
      clearMirror();
      return;
    }
    // Läs custom claims (teacher) ur ID-token.
    let isTeach = false;
    try {
      const tok = await user.getIdTokenResult();
      isTeach = tok.claims.teacher === true;
    } catch {}
    teacherClaim = isTeach;

    if (isTeach) {
      // En lärare är inloggad – det är ingen elevsession.
      cachedSession = null;
      clearMirror();
    } else {
      // Elev: se till att den synkrona spegeln stämmer med Auth-uid.
      if (!cachedSession || cachedSession.studentId !== user.uid) {
        let namn = user.uid;
        let username = "";
        try {
          const snap = await getDoc(doc(db, "students", user.uid));
          if (snap.exists()) {
            namn = snap.data().namn || user.uid;
            username = snap.data().username || "";
          }
        } catch {}
        cachedSession = { studentId: user.uid, namn, username };
        // Persistensen (kom-ihåg) styrs av Firebase Auth; spegeln lägger vi i
        // localStorage för snabb synkron uppslag (rensas ändå av rekoncilieringen
        // om Auth saknar användare).
        writeMirror(cachedSession, true);
      }
    }
  } finally {
    if (!readySettled) {
      readySettled = true;
      resolveReady();
    }
  }
});

// ---------------------------------------------------------------------------
// Elevinloggning / utloggning
// ---------------------------------------------------------------------------

/** Översätt Firebase Auth-felkoder till barnvänliga svenska meddelanden. */
function loginErrorMessage(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Fel användarnamn eller lösenord. Försök igen.";
    case "auth/too-many-requests":
      return "För många försök. Vänta en stund och försök igen.";
    case "auth/network-request-failed":
      return "Nätverksfel. Kontrollera din uppkoppling och försök igen.";
    default:
      return "Kunde inte logga in. Försök igen.";
  }
}

/**
 * Logga in en elev med användarnamn + lösenord (via Firebase Auth).
 * @returns {Promise<{ok:true, uid:string} | {ok:false, error:string}>}
 */
export async function signInStudent(username, password, remember = false) {
  const uname = String(username || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!uname || !pw) {
    return { ok: false, error: "Fyll i både användarnamn och lösenord." };
  }
  try {
    await setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence
    );
    const cred = await signInWithEmailAndPassword(
      auth,
      usernameToEmail(uname),
      pw
    );
    return { ok: true, uid: cred.user.uid };
  } catch (err) {
    return { ok: false, error: loginErrorMessage(err?.code) };
  }
}

/** Logga ut (elev eller lärare). Rensar spegeln direkt + signOut i bakgrunden. */
export function signOutCurrent() {
  cachedSession = null;
  teacherClaim = false;
  clearMirror();
  // Fire-and-forget: anroparna väntar inte, och onAuthStateChanged städar ändå.
  return signOut(auth).catch(() => {});
}

// ---------------------------------------------------------------------------
// Lärarinloggning (ersätter det hårdkodade "larare2026").
// ---------------------------------------------------------------------------

/**
 * Logga in en lärare med e-post + lösenord. Kräver att kontot har custom claim
 * teacher:true (sätts via admin/set-teacher-claim.mjs). Annars nekas det och
 * användaren loggas ut igen.
 * @returns {Promise<{ok:true} | {ok:false, error:string}>}
 */
export async function signInTeacher(email, password) {
  const mail = String(email || "").trim();
  const pw = String(password || "");
  if (!mail || !pw) {
    return { ok: false, error: "Fyll i både e-post och lösenord." };
  }
  try {
    // Lärarsession behöver inte "kom-ihåg" mellan datorns sessioner.
    await setPersistence(auth, browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, mail, pw);
    const tok = await cred.user.getIdTokenResult(true);
    if (tok.claims.teacher !== true) {
      await signOut(auth).catch(() => {});
      teacherClaim = false;
      return {
        ok: false,
        error: "Det här kontot är inte ett lärarkonto.",
      };
    }
    teacherClaim = true;
    cachedSession = null;
    clearMirror();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: loginErrorMessage(err?.code) };
  }
}

// ---------------------------------------------------------------------------
// Elevkontoskapande via en SEKUNDÄR Firebase-app-instans.
// ----------------------------------------------------------------------------
// createUserWithEmailAndPassword loggar in som den nya användaren på den app
// den körs mot. Vi kör den därför mot en separat, namngiven app-instans så att
// LÄRARENS egen inloggning på huvud-appen inte kastas ut. Den sekundära appen
// rivs efteråt.
// ---------------------------------------------------------------------------

/**
 * Skapa ett nytt elev-Auth-konto (utan att röra lärarens session) och returnera
 * dess uid. Använder elevens användarnamn -> syntetisk e-post.
 * @returns {Promise<string>} den nya elevens uid
 */
export async function createStudentAuthAccount(username, password) {
  const email = usernameToEmail(username);
  const pw = String(password || "");
  if (pw.length < MIN_PASSWORD_LEN) {
    throw new Error(
      `Lösenordet måste vara minst ${MIN_PASSWORD_LEN} tecken (Firebase-krav).`
    );
  }
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pw);
    return cred.user.uid;
  } catch (err) {
    if (err?.code === "auth/email-already-in-use") {
      throw new Error(
        `Användarnamnet "${String(username).trim().toLowerCase()}" är redan taget.`
      );
    }
    if (err?.code === "auth/weak-password") {
      throw new Error(
        `Lösenordet är för svagt (minst ${MIN_PASSWORD_LEN} tecken).`
      );
    }
    throw new Error(err?.message || "Kunde inte skapa elevkontot.");
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondary).catch(() => {});
  }
}
