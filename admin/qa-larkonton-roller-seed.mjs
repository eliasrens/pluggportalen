// ============================================================================
// QA-seed för lärarsidan efter roll (#679) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs (klasser + qaadmin/qarasmus/qaarskurs5) och lägger
// till årskurskontot qaarskurs4 (4A, 4B), legacy-läraren qalegacy (bara teacher:true), elever i 4A/4B/5A, ämnen + områden med
// olika ägare (admin utan createdBy, Årskurs 4, Årskurs 5) och en Live-lobby
// 4A mot 5A. Lösenord lilla123 (endast emulator). Används av
// admin/qa-larkonton-roller-preview.sh.
// ============================================================================

import { auth, db, isEmulator, teacherUsernameToEmail, usernameToEmail } from "./_shared.mjs";
import { claimsFor } from "../functions/teacher-accounts-core.js";
import { subjects, areas } from "../seed/seed-data.js";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const u4 = await auth.createUser({ email: teacherUsernameToEmail("qaarskurs4"), password: "lilla123", displayName: "Årskurs 4" });
await auth.setCustomUserClaims(u4.uid, claimsFor("arskurs"));
await db.doc(`teacherAccounts/${u4.uid}`).set({
  username: "qaarskurs4", displayName: "Årskurs 4", role: "arskurs", classIds: ["4a", "4b"], active: true,
  createdAt: new Date(), createdBy: "qa-seed", updatedAt: new Date(),
});
// Omigrerat lärarkonto (bara teacher:true, inget teacherAccounts-dokument) = admin under övergången.
const legacy = await auth.createUser({ email: teacherUsernameToEmail("qalegacy"), password: "lilla123" });
await auth.setCustomUserClaims(legacy.uid, { teacher: true });
const u5 = (await auth.getUserByEmail(teacherUsernameToEmail("qaarskurs5"))).uid;

const ELEVER = { "4a": ["Alva", "Bilal", "Cleo", "Dante"], "4b": ["Ebba", "Fadi", "Gry"], "5a": ["Hugo", "Ines"] };
for (const [cid, namn] of Object.entries(ELEVER)) {
  const ids = [];
  for (const [i, n] of namn.entries()) {
    const username = `${cid}${String(i + 1).padStart(2, "0")}`;
    const u = await auth.createUser({ email: usernameToEmail(username), password: "lilla123" });
    await db.doc(`students/${u.uid}`).set({ namn: n, username, avatarId: "fox", classIds: [cid] });
    await db.doc(`studentData/${u.uid}`).set({ progress: {}, avatarId: "fox", coins: 0 });
    await db.doc(`studentCredentials/${u.uid}`).set({ username, password: "lilla123", updatedAt: new Date() });
    ids.push(u.uid);
  }
  await db.doc(`classes/${cid}`).set({ studentIds: ids }, { merge: true });
}

for (const { id, ...rest } of subjects) await db.doc(`subjects/${id}`).set(rest, { merge: true });
const { id: vid, ...vik } = areas.so[0];
const variant = (suffix, order, uid, namn) => ({
  ...vik, name: `${vik.name}${suffix}`, order, ...(uid ? { createdBy: uid, createdByName: namn } : {}),
});
await db.doc(`subjects/so/areas/${vid}`).set(vik); // admins (inget createdBy)
await db.doc(`subjects/so/areas/${vid}-rep`).set(variant(" – repetition", 2)); // admins
await db.doc(`subjects/so/areas/${vid}-ak4`).set(variant(" – Årskurs 4:s version", 3, u4.uid, "Årskurs 4"));
await db.doc(`subjects/so/areas/${vid}-ak5`).set(variant(" – Årskurs 5:s version", 4, u5, "Årskurs 5"));
for (const { id, ...rest } of areas.matte) await db.doc(`subjects/matte/areas/${id}`).set(rest);

await db.doc("liveSessions/qa-roller-lobby").set({
  name: "4A mot 5A", status: "lobby", gameMode: "klassmatch", participatingClassIds: ["4a", "5a"],
  classNames: { "4a": "4A", "5a": "5A" }, createdByName: "qaadmin", createdAt: new Date(), durationSeconds: 300,
});
await db.doc("liveSessions/qa-roller-6a").set({
  name: "6A övar", status: "lobby", gameMode: "klassmatch", participatingClassIds: ["6a"],
  classNames: { "6a": "6A" }, createdByName: "qarasmus", createdAt: new Date(), durationSeconds: 300,
});
console.log("✓ qaarskurs4 / lilla123 (4A, 4B), qalegacy (bara teacher:true), elever i 4A/4B/5A, SO-områden med ägare, Live-lobbyer.");
process.exit(0);
