// ============================================================================
// Pluggporten – lärarkonton på servern (functions/teacher-accounts-core.js, #677)
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_LARARKONTON.md §1 och §3. Två roller:
//   admin    claims { teacher: true, admin: true }        allt, som förut
//   arskurs  claims { teacher: true, role: "arskurs" }    bara sina classIds
// Kontona bor i teacherAccounts/{uid} = { username, displayName, role,
// classIds, active, createdAt, createdBy, updatedAt }. classIds läses av
// firestore.rules med get() (inte ur claims) så att en klassändring slår
// igenom direkt, utan att läraren loggar ut.
//
// Kärnan har INGA importer (Admin SDK:t injiceras, samma mönster som
// login-core.js) – index.js gör callables av den, admin/-skripten och
// testerna (test/functions-teacher-accounts.test.mjs) använder den direkt.
//   createTeacher(deps, callerUid, { username, displayName, password, role, classIds })
//   updateTeacher(deps, callerUid, { uid, displayName?, classIds?, role? })
//   setTeacherPassword(deps, callerUid, { uid, password })
//   setTeacherActive(deps, callerUid, { uid, active })
//   deleteTeacher(deps, callerUid, { uid })
// deps = { auth, db, FieldValue }.
//
// Spärrar: anroparen måste vara admin enligt AUTH-posten just nu (inte bara
// en gammal ID-token), admin kan aldrig ta bort sin egen adminroll, stänga av
// eller radera sig själv, och det måste alltid finnas minst ett aktivt
// adminkonto (räknas i teacherAccounts i samma transaktion som ändringen).
// Firestore skrivs först och återställs om Auth sedan fallerar.
// ============================================================================

// MÅSTE matcha src/auth.js TEACHER_EMAIL_DOMAIN och admin/_shared.mjs.
export const TEACHER_EMAIL_DOMAIN = "larare.pluggportalen.local";
export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
export const MIN_PASSWORD_LEN = 6;
export const MAX_PASSWORD_LEN = 64;
export const MAX_NAME_LEN = 60;
export const MAX_CLASSES = 100;
export const ROLES = ["admin", "arskurs"];
export const COLLECTION = "teacherAccounts";

/** Fel med en HttpsError-kod (index.js översätter) och ett svenskt meddelande. */
export class TeacherError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const normalizeUsername = (u) => String(u ?? "").trim().toLowerCase();
export const teacherEmail = (u) => `${normalizeUsername(u)}@${TEACHER_EMAIL_DOMAIN}`;

/** Användarnamnet ur en lärar-e-post (eller hela e-posten om domänen är en annan). */
export function usernameFromEmail(email) {
  const e = String(email || "").toLowerCase();
  return e.endsWith(`@${TEACHER_EMAIL_DOMAIN}`) ? e.slice(0, -TEACHER_EMAIL_DOMAIN.length - 1) : e;
}

/**
 * Nya claims för rollen. Övriga claims (som inte rör lärarrollen) behålls.
 * admin → teacher + admin, arskurs → teacher + role, null → ingen lärare alls.
 */
export function claimsFor(role, existing = {}) {
  const { teacher, admin, role: _r, ...rest } = existing || {};
  if (role === "admin") return { ...rest, teacher: true, admin: true };
  if (role === "arskurs") return { ...rest, teacher: true, role: "arskurs" };
  return rest;
}

/** Rollen enligt claims (null = inget lärarkonto). Ett lärarkonto utan role räknas som admin. */
export function roleFromClaims(c) {
  if (!c || c.teacher !== true) return null;
  if (c.admin === true) return "admin";
  return c.role === "arskurs" ? "arskurs" : "admin";
}

// --- Validering ----------------------------------------------------------------

const obj = (raw) => (raw && typeof raw === "object" ? raw : {});

function uidOf(d) {
  const uid = typeof d.uid === "string" ? d.uid.trim() : "";
  if (!uid || uid.length > 128 || uid.includes("/")) throw new TeacherError("invalid-argument", "Kontots id saknas.");
  return uid;
}

export function checkUsername(u) {
  const username = normalizeUsername(u);
  if (!USERNAME_RE.test(username)) {
    throw new TeacherError("invalid-argument", "Användarnamnet ska vara 3–40 tecken och bara innehålla a–z, 0–9, . _ -");
  }
  return username;
}

export function checkDisplayName(n) {
  const name = typeof n === "string" ? n.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > MAX_NAME_LEN) {
    throw new TeacherError("invalid-argument", `Visningsnamnet ska vara 1–${MAX_NAME_LEN} tecken.`);
  }
  return name;
}

export function checkPassword(p) {
  if (typeof p !== "string" || p.length < MIN_PASSWORD_LEN || p.length > MAX_PASSWORD_LEN) {
    throw new TeacherError("invalid-argument", `Lösenordet måste vara ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} tecken.`);
  }
  return p;
}

export function checkRole(r) {
  if (!ROLES.includes(r)) throw new TeacherError("invalid-argument", "Rollen ska vara admin eller årskurskonto.");
  return r;
}

function checkClassIdList(list) {
  if (!Array.isArray(list) || list.length > MAX_CLASSES) throw new TeacherError("invalid-argument", "Ogiltig klasslista.");
  const ids = [...new Set(list.map((x) => (typeof x === "string" ? x.trim() : "")))];
  if (ids.some((id) => !id || id.length > 128 || id.includes("/"))) throw new TeacherError("invalid-argument", "Ogiltig klasslista.");
  return ids;
}

/** Klasserna måste finnas (en läsning per klass i ETT getAll). */
async function existingClassIds(db, list) {
  const ids = checkClassIdList(list);
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => db.collection("classes").doc(id)));
  const missing = snaps.filter((s) => !s.exists).map((s) => s.id);
  if (missing.length) throw new TeacherError("invalid-argument", `Klassen finns inte: ${missing.join(", ")}.`);
  return ids;
}

// --- Spärrar -------------------------------------------------------------------

const authCode = (err) => err?.code || err?.errorInfo?.code || "";

function authError(err, fallback) {
  const code = authCode(err);
  if (code === "auth/email-already-exists") return new TeacherError("already-exists", "Användarnamnet är redan taget.");
  if (code === "auth/invalid-password") return new TeacherError("invalid-argument", "Lösenordet godtogs inte (minst 6 tecken).");
  if (code === "auth/user-not-found") return new TeacherError("not-found", "Kontot finns inte i inloggningen.");
  return new TeacherError("internal", fallback);
}

/**
 * Anroparen är admin enligt Auth-posten JUST NU (färska claims, inte avstängd).
 * En gammal ID-token från ett konto som blivit årskurskonto eller stängts av
 * räcker alltså inte. Returnerar { uid, name } för createdBy och ägarbyte.
 */
export async function assertAdmin({ auth }, callerUid) {
  if (!callerUid) throw new TeacherError("unauthenticated", "Logga in först.");
  const user = await auth.getUser(callerUid).catch(() => null);
  if (!user || user.disabled || user.customClaims?.admin !== true || user.customClaims?.teacher !== true) {
    throw new TeacherError("permission-denied", "Det här kan bara admin göra.");
  }
  return { uid: callerUid, name: user.displayName || usernameFromEmail(user.email) };
}

/** Lärarkontot (dokumentet) i en transaktion. Saknas → not-found. */
async function readAccount(tx, db, uid) {
  const ref = db.collection(COLLECTION).doc(uid);
  const snap = await tx.get(ref);
  if (!snap.exists) throw new TeacherError("not-found", "Kontot finns inte bland lärarkontona.");
  return { ref, data: snap.data() };
}

/** Minst ett aktivt adminkonto ska finnas kvar om `uid` slutar vara aktiv admin. */
async function assertOtherActiveAdmin(tx, db, uid) {
  const admins = await tx.get(db.collection(COLLECTION).where("role", "==", "admin"));
  if (!admins.docs.some((d) => d.id !== uid && d.get("active") !== false)) {
    throw new TeacherError("failed-precondition", "Det måste alltid finnas minst ett aktivt adminkonto.");
  }
}

function notSelf(callerUid, uid, message) {
  if (callerUid === uid) throw new TeacherError("permission-denied", message);
}

/** Kör Auth-steget; misslyckas det skrivs dokumentet tillbaka som det var. */
async function authOrRestore(ref, before, step, fallback) {
  try {
    await step();
  } catch (err) {
    await ref.set(before).catch((e) => console.error("lärarkonto: återställning misslyckades", ref.id, e));
    throw authError(err, fallback);
  }
}

// --- Funktionerna --------------------------------------------------------------

/** Skapa ett lärarkonto: Auth-inloggning, claims och teacherAccounts-dokumentet. */
export async function createTeacher(deps, callerUid, raw) {
  const { auth, db, FieldValue } = deps;
  const caller = await assertAdmin(deps, callerUid);
  const d = obj(raw);
  const username = checkUsername(d.username);
  const displayName = checkDisplayName(d.displayName);
  const password = checkPassword(d.password);
  const role = checkRole(d.role);
  const classIds = role === "arskurs" ? await existingClassIds(db, d.classIds ?? []) : [];

  const taken = await auth.getUserByEmail(teacherEmail(username)).then(() => true, (err) => {
    if (authCode(err) === "auth/user-not-found") return false;
    throw authError(err, "Kunde inte kontrollera användarnamnet – försök igen.");
  });
  if (taken) throw new TeacherError("already-exists", `Användarnamnet "${username}" är redan taget.`);

  const user = await auth
    .createUser({ email: teacherEmail(username), password, displayName, emailVerified: true })
    .catch((err) => { throw authError(err, "Kunde inte skapa inloggningen – inget sparades."); });
  try {
    await auth.setCustomUserClaims(user.uid, claimsFor(role));
    await db.collection(COLLECTION).doc(user.uid).set({
      username, displayName, role, classIds, active: true,
      createdAt: FieldValue.serverTimestamp(), createdBy: caller.uid, updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    await auth.deleteUser(user.uid).catch((e) => console.error("createTeacher: kunde inte städa", user.uid, e));
    throw err instanceof TeacherError ? err : new TeacherError("internal", "Kunde inte skapa kontot – inget sparades.");
  }
  return { uid: user.uid, username, displayName, role, classIds };
}

/** Ändra visningsnamn, klasser och/eller roll. */
export async function updateTeacher(deps, callerUid, raw) {
  const { auth, db, FieldValue } = deps;
  await assertAdmin(deps, callerUid);
  const d = obj(raw);
  const uid = uidOf(d);
  const displayName = d.displayName != null ? checkDisplayName(d.displayName) : null;
  const role = d.role != null ? checkRole(d.role) : null;
  const classIds = d.classIds != null ? await existingClassIds(db, d.classIds) : null;
  if (displayName == null && role == null && classIds == null) {
    throw new TeacherError("invalid-argument", "Inget att ändra.");
  }

  const { ref, before, after } = await db.runTransaction(async (tx) => {
    const { ref, data } = await readAccount(tx, db, uid);
    const nextRole = role || data.role;
    if (data.role === "admin" && nextRole !== "admin") {
      notSelf(callerUid, uid, "Du kan inte ta bort din egen adminroll.");
      await assertOtherActiveAdmin(tx, db, uid);
    }
    const after = {
      ...data,
      displayName: displayName ?? data.displayName,
      role: nextRole,
      classIds: nextRole === "arskurs" ? classIds ?? data.classIds ?? [] : [],
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, after);
    return { ref, before: data, after };
  });

  const roleChanged = after.role !== before.role;
  await authOrRestore(ref, before, async () => {
    const user = await auth.getUser(uid);
    if (displayName != null && displayName !== user.displayName) await auth.updateUser(uid, { displayName });
    if (roleChanged) {
      await auth.setCustomUserClaims(uid, claimsFor(after.role, user.customClaims));
      // Nedgradering: den gamla refresh-token ska inte kunna ge en ny admin-token.
      if (after.role !== "admin") await auth.revokeRefreshTokens(uid);
    }
  }, "Kunde inte uppdatera inloggningen – inget ändrades.");
  return { uid, displayName: after.displayName, role: after.role, classIds: after.classIds, roleChanged };
}

/** Byt lösenord på ett lärarkonto (aldrig en elev – de byts via updateStudentLogin). */
export async function setTeacherPassword(deps, callerUid, raw) {
  const { auth, db, FieldValue } = deps;
  await assertAdmin(deps, callerUid);
  const d = obj(raw);
  const uid = uidOf(d);
  const password = checkPassword(d.password);
  const snap = await db.collection(COLLECTION).doc(uid).get();
  if (!snap.exists) throw new TeacherError("not-found", "Kontot finns inte bland lärarkontona.");
  await auth.updateUser(uid, { password }).catch((err) => { throw authError(err, "Kunde inte byta lösenord – försök igen."); });
  await snap.ref.update({ updatedAt: FieldValue.serverTimestamp() });
  return { uid, passwordChanged: true };
}

/** Stäng av (active:false + disabled i Auth) eller aktivera ett konto. */
export async function setTeacherActive(deps, callerUid, raw) {
  const { auth, db, FieldValue } = deps;
  await assertAdmin(deps, callerUid);
  const d = obj(raw);
  const uid = uidOf(d);
  if (typeof d.active !== "boolean") throw new TeacherError("invalid-argument", "Ange om kontot ska vara aktivt.");
  const active = d.active;

  const { ref, before } = await db.runTransaction(async (tx) => {
    const { ref, data } = await readAccount(tx, db, uid);
    if (!active) {
      notSelf(callerUid, uid, "Du kan inte stänga av ditt eget konto.");
      if (data.role === "admin") await assertOtherActiveAdmin(tx, db, uid);
    }
    tx.set(ref, { ...data, active, updatedAt: FieldValue.serverTimestamp() });
    return { ref, before: data };
  });

  await authOrRestore(ref, before, async () => {
    await auth.updateUser(uid, { disabled: !active });
    if (!active) await auth.revokeRefreshTokens(uid);
  }, "Kunde inte ändra inloggningen – inget ändrades.");
  return { uid, active };
}

/**
 * Radera ett konto. Materialet det skapat raderas INTE utan blir admins:
 *   * Plugga-områden (subjects/{s}/areas, createdBy == uid): createdBy och
 *     createdByName tas bort – material utan createdBy räknas som admins (§2.3).
 *   * Hitta rätt!-kartor (hittaRattPacks + katalogposten + bilderna, ownerUid):
 *     ägs därefter av admin som raderade kontot (de kräver en ägare).
 */
export async function deleteTeacher(deps, callerUid, raw) {
  const { auth, db } = deps;
  const caller = await assertAdmin(deps, callerUid);
  const uid = uidOf(obj(raw));
  notSelf(callerUid, uid, "Du kan inte radera ditt eget konto.");

  // Spärren först (läser bara), så att inget material flyttas i onödan.
  await db.runTransaction(async (tx) => {
    const { data } = await readAccount(tx, db, uid);
    if (data.role === "admin") await assertOtherActiveAdmin(tx, db, uid);
  });
  const moved = await transferMaterial(deps, uid, caller);
  await db.runTransaction(async (tx) => {
    const { ref, data } = await readAccount(tx, db, uid);
    if (data.role === "admin") await assertOtherActiveAdmin(tx, db, uid);
    tx.delete(ref);
  });
  await auth.deleteUser(uid).catch((err) => {
    if (authCode(err) !== "auth/user-not-found") throw authError(err, "Kontot togs bort ur listan men inloggningen kunde inte raderas – försök igen.");
  });
  return { uid, deleted: true, ...moved };
}

/** Flytta kontots material till admin (se deleteTeacher). Idempotent. */
export async function transferMaterial({ db, FieldValue }, uid, caller) {
  const writes = [];
  const subjects = await db.collection("subjects").get();
  const areaSnaps = await Promise.all(subjects.docs.map((s) => s.ref.collection("areas").where("createdBy", "==", uid).get()));
  const areas = areaSnaps.flatMap((q) => q.docs);
  for (const a of areas) writes.push((b) => b.update(a.ref, { createdBy: FieldValue.delete(), createdByName: FieldValue.delete() }));

  const [packs, bilder] = await Promise.all([
    db.collection("hittaRattPacks").where("ownerUid", "==", uid).get(),
    db.collection("hittaRattBilder").where("ownerUid", "==", uid).select().get(),
  ]);
  const owner = { ownerUid: caller.uid, ownerNamn: caller.name };
  const katalog = db.collection("hittaRattMeta").doc("egnaPack");
  for (const p of packs.docs) {
    writes.push((b) => b.update(p.ref, owner));
    writes.push((b) => b.set(katalog, { packs: { [p.id]: owner } }, { merge: true }));
  }
  for (const bild of bilder.docs) writes.push((b) => b.update(bild.ref, { ownerUid: caller.uid }));

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }
  return { areas: areas.length, hittaRattPacks: packs.size };
}
