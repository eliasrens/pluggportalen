// ============================================================================
// Pluggporten – kärnan i updateStudentLogin (functions/login-core.js)
// ----------------------------------------------------------------------------
// Läraren byter en elevs användarnamn och/eller lösenord. Klienten kan inte
// ändra en ANNAN användares Auth-konto, så det här körs server-side (Admin SDK)
// via den anropbara funktionen i index.js. Kärnan har INGA importer (Admin
// SDK:t injiceras) så den kan testas direkt mot Auth-/Firestore-emulatorn –
// även med en felande auth för att bevisa återställningen.
//
// Vad som skrivs (allt eller inget så gott det går):
//   1. Firestore i EN batch: students/{uid}.username, varje
//      classProjections/{klass}.members.{uid}.username där eleven har en post,
//      och studentCredentials/{uid} = { username, password?, updatedAt }.
//   2. Auth: e-post (username@elev.pluggportalen.local) och/eller lösenord.
//   Misslyckas Auth återställs Firestore-batchen till de gamla värdena. Auth
//   körs SIST eftersom ett gammalt lösenord inte går att återställa (bara hash).
// ============================================================================

// MÅSTE matcha src/auth.js ELEV_EMAIL_DOMAIN och admin/_shared.mjs.
export const ELEV_EMAIL_DOMAIN = "elev.pluggportalen.local";
// Samma tillåtna tecken som när kontot skapas (src/teacher-login-cards.js).
export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
export const MIN_PASSWORD_LEN = 6;
export const MAX_PASSWORD_LEN = 64;

/** Fel med en HttpsError-kod (index.js översätter) och ett svenskt meddelande. */
export class LoginError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function normalizeUsername(u) {
  return String(u ?? "").trim().toLowerCase();
}

export function usernameToEmail(u) {
  return `${normalizeUsername(u)}@${ELEV_EMAIL_DOMAIN}`;
}

/**
 * Validera och normalisera anropet. Kastar LoginError("invalid-argument").
 * @returns {{uid:string, username:string|null, password:string|null}}
 */
export function validateInput(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const uid = typeof d.uid === "string" ? d.uid.trim() : "";
  if (!uid || uid.length > 128 || uid.includes("/")) {
    throw new LoginError("invalid-argument", "Elevens id saknas.");
  }
  let username = null;
  if (d.username != null && d.username !== "") {
    if (typeof d.username !== "string") throw new LoginError("invalid-argument", "Ogiltigt användarnamn.");
    username = normalizeUsername(d.username);
    if (!USERNAME_RE.test(username)) {
      throw new LoginError(
        "invalid-argument",
        "Användarnamnet ska vara 3–40 tecken och bara innehålla a–z, 0–9, . _ -"
      );
    }
  }
  let password = null;
  if (d.password != null && d.password !== "") {
    if (typeof d.password !== "string") throw new LoginError("invalid-argument", "Ogiltigt lösenord.");
    password = d.password;
    if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
      throw new LoginError(
        "invalid-argument",
        `Lösenordet måste vara ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} tecken.`
      );
    }
  }
  if (!username && !password) {
    throw new LoginError("invalid-argument", "Ange ett nytt användarnamn eller lösenord.");
  }
  return { uid, username, password };
}

function authErrorToLogin(err) {
  const code = err?.code || err?.errorInfo?.code || "";
  if (code === "auth/email-already-exists") return new LoginError("already-exists", "Användarnamnet är redan taget.");
  if (code === "auth/invalid-password") return new LoginError("invalid-argument", "Lösenordet godtogs inte (minst 6 tecken).");
  if (code === "auth/user-not-found") return new LoginError("not-found", "Eleven saknar inloggningskonto.");
  return new LoginError("internal", "Kunde inte uppdatera inloggningen – inget ändrades. Försök igen.");
}

/**
 * Ändra en elevs inloggning. `deps` = { auth, db, FieldPath, serverTimestamp }
 * (Admin SDK: getAuth(), getFirestore(), FieldPath, () => FieldValue.serverTimestamp()).
 * @returns {Promise<{uid, username, usernameChanged:boolean, passwordChanged:boolean}>}
 */
export async function updateStudentLogin({ auth, db, FieldPath, serverTimestamp }, raw) {
  const { uid, username, password } = validateInput(raw);
  const studentRef = db.collection("students").doc(uid);
  const credRef = db.collection("studentCredentials").doc(uid);

  const [studentSnap, credSnap, classSnap, user] = await Promise.all([
    studentRef.get(),
    credRef.get(),
    db.collection("classes").where("studentIds", "array-contains", uid).get(),
    auth.getUser(uid).catch((err) => {
      throw authErrorToLogin(err);
    }),
  ]);
  if (!studentSnap.exists) throw new LoginError("not-found", "Eleven finns inte.");
  // En lärare får aldrig byta en ANNAN lärares inloggning den här vägen.
  if (user.customClaims?.teacher === true) {
    throw new LoginError("permission-denied", "Kontot är ett lärarkonto, inte en elev.");
  }

  const oldUsername = normalizeUsername(studentSnap.get("username"));
  const newUsername = username && username !== oldUsername ? username : null;
  if (!newUsername && !password) {
    throw new LoginError("invalid-argument", "Inget att ändra – användarnamnet är redan " + oldUsername + ".");
  }

  if (newUsername) {
    const [dupSnap, other] = await Promise.all([
      db.collection("students").where("username", "==", newUsername).get(),
      auth.getUserByEmail(usernameToEmail(newUsername)).catch((err) => {
        if ((err?.code || err?.errorInfo?.code) === "auth/user-not-found") return null;
        throw authErrorToLogin(err);
      }),
    ]);
    if (dupSnap.docs.some((d) => d.id !== uid) || (other && other.uid !== uid)) {
      throw new LoginError("already-exists", `Användarnamnet "${newUsername}" är redan taget.`);
    }
  }

  // Klass-projektionerna där eleven HAR en post (vi skapar aldrig halva poster).
  const projRefs = classSnap.docs.map((c) => db.collection("classProjections").doc(c.id));
  const projSnaps = newUsername && projRefs.length ? await db.getAll(...projRefs) : [];
  const projs = projSnaps
    .filter((s) => s.exists && s.get(new FieldPath("members", uid)))
    .map((s) => ({ ref: s.ref, prev: s.get(new FieldPath("members", uid, "username")) ?? oldUsername }));
  const memberPath = new FieldPath("members", uid, "username");

  const batch = db.batch();
  if (newUsername) {
    batch.update(studentRef, { username: newUsername });
    projs.forEach((p) => batch.update(p.ref, memberPath, newUsername));
  }
  const cred = { username: newUsername || oldUsername, updatedAt: serverTimestamp() };
  if (password) cred.password = password;
  batch.set(credRef, cred, { merge: true });
  await batch.commit();

  try {
    const patch = {};
    if (newUsername) patch.email = usernameToEmail(newUsername);
    if (password) patch.password = password;
    await auth.updateUser(uid, patch);
  } catch (err) {
    const undo = db.batch();
    if (newUsername) {
      undo.update(studentRef, { username: oldUsername });
      projs.forEach((p) => undo.update(p.ref, memberPath, p.prev));
    }
    if (credSnap.exists) undo.set(credRef, credSnap.data());
    else undo.delete(credRef);
    await undo.commit().catch((e) => console.error("updateStudentLogin: återställning misslyckades", uid, e));
    throw authErrorToLogin(err);
  }

  return {
    uid,
    username: newUsername || oldUsername,
    usernameChanged: !!newUsername,
    passwordChanged: !!password,
  };
}
