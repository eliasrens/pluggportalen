// ============================================================================
// QA #682: driftordningen i docs/ADMIN.md §8 torrt mot emulatorn – ingen
// utelåsning. Från main-reglerna och main-formad data till de nya reglerna.
// ----------------------------------------------------------------------------
//   0. Emulatorn får reglerna från origin/main. Två lärare som i dag
//      (claims { teacher: true }, inget teacherAccounts), elever, klasser,
//      material utan createdBy. Lärare A loggar in (gammal token).
//   2. migrate-teacher-admins.mjs: torrkörning (skriver inget) → --apply.
//   3. Torrkörning igen: "0 konto(n) blir admin".
//   4. De nya reglerna laddas. A:s GAMLA token (före migreringen) och en ny
//      token gör båda allt en lärare gjorde förut. Fel ordning (regler före
//      migrering) prövas också.
//   8.1 Övergången borttagen: gammal token nekas, ny admin-token fungerar.
//   8.2 Reserven set-teacher-claim.mjs skapar ett nytt adminkonto.
// Steg 1 (functions) och 5 (webbplatsen) prövas inte här – functions täcks
// av test:functions och admin/qa-lararkonton-callables.mjs.
//
//   firebase emulators:exec --only auth,firestore --project pluggportalen-so-2026 \
//     "node admin/qa-lararkonton-drift.mjs"
// Skriver ut varje steg; avslutar med kod 1 om något steg inte blev som väntat.
// ============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, Timestamp,
  terminate,
} from "firebase/firestore";

const PROJECT = "pluggportalen-so-2026";
const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) throw new Error("Kör under firebase emulators:exec --only auth,firestore");
const env = { ...process.env, GCLOUD_PROJECT: PROJECT };

const adminApp = admin.initializeApp({ projectId: PROJECT }, "qa682-drift");
const aAuth = admin.auth(adminApp);
const aDb = admin.firestore(adminApp);

let fel = 0;
const ok = (villkor, text) => { console.log(`  ${villkor ? "✓" : "✗"} ${text}`); if (!villkor) fel++; };

async function laddaRegler(text, namn) {
  const res = await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}:securityRules`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: { files: [{ name: "firestore.rules", content: text }] } }),
  });
  if (!res.ok) throw new Error(`regler ${namn}: ${res.status} ${await res.text()}`);
  console.log(`\n▶ Regler: ${namn}`);
}
const MAIN_REGLER = execFileSync("git", ["show", "origin/main:firestore.rules"], { encoding: "utf8" });
const NYA_REGLER = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
// §8.1 steg 1: radera isLegacyTeacher() och "|| isLegacyTeacher()".
const UTAN_OVERGANG = NYA_REGLER
  .replace(" || isLegacyTeacher()", "")
  .replace(/    function isLegacyTeacher\(\) \{[\s\S]*?\n    \}\n/, "");
if (UTAN_OVERGANG.split("\n").some((l) => !l.trim().startsWith("//") && l.includes("isLegacyTeacher"))) throw new Error("kunde inte ta bort övergången ur reglerna");

let n = 0;
/** Logga in i en egen klient – token ligger kvar i minnet (som en öppen flik). */
async function klient(email, pw) {
  const app = initializeApp({ apiKey: "fake", projectId: PROJECT }, `drift-${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const cred = await signInWithEmailAndPassword(auth, email, pw);
  const db = getFirestore(app);
  const [h, p] = FS.split(":");
  connectFirestoreEmulator(db, h, Number(p));
  const claims = (await cred.user.getIdTokenResult()).claims;
  return { app, db, uid: cred.user.uid, claims, stang: async () => { await terminate(db); await deleteApp(app); } };
}
const lyckas = (p) => p.then(() => true, (e) => { if (e?.code !== "permission-denied") console.log("    ", e.message); return false; });

/** Det en lärare gjorde i dag (admin-vägarna i de nya reglerna). */
async function lararensVardag({ db, uid }, tag) {
  const r = {};
  r.lasaElevdata = await lyckas(getDoc(doc(db, "studentData", "e5a")));
  r.lasaLosen = await lyckas(getDoc(doc(db, "studentCredentials", "e5a")));
  r.gemynt = await lyckas(updateDoc(doc(db, "studentData", "e5a"), { coins: increment(10) }));
  r.nyKlass = await lyckas(setDoc(doc(db, "classes", `ny-${tag}`), { name: "Ny", studentIds: [] }));
  r.bytNamn = await lyckas(updateDoc(doc(db, "classes", "5a"), { name: `5A ${tag}` }));
  r.nyElev = await lyckas(setDoc(doc(db, "students", `ny-${tag}`), { namn: "Ny", username: `ny-${tag}`, classIds: ["5a"] }));
  r.material = await lyckas(updateDoc(doc(db, "subjects", "so", "areas", "vikingar"), { title: `Vikingar ${tag}` }));
  r.nyttAmne = await lyckas(setDoc(doc(db, "subjects", `amne-${tag}`), { name: "Nytt" }));
  r.mm = await lyckas(setDoc(doc(db, "mathCompetitions", `mm-${tag}`), {
    name: "MM", participatingClassIds: ["5a"], startAt: Timestamp.now(),
    endAt: Timestamp.fromMillis(Date.now() + 3600e3), status: "active", counterShards: 4,
  }));
  r.live = await lyckas(setDoc(doc(db, "liveSessions", `live-${tag}`), {
    name: "5A mot 6A", gameMode: "multiplication_0_10", participatingClassIds: ["5a", "6a"],
    classDivisors: { "5a": 20, "6a": 20 }, durationSeconds: 600, countdownSeconds: 3, counterShards: 4,
    status: "lobby", createdBy: uid, createdAt: serverTimestamp(), coinPrize: 500,
  }));
  return r;
}

async function main() {
  console.log("▶ Steg 0: main-läge (regler från origin/main, lärare utan roll)");
  await laddaRegler(MAIN_REGLER, "origin/main");
  for (const uid of ["larareA", "larareB"]) {
    await aAuth.createUser({ uid, email: `${uid.toLowerCase()}@larare.pluggportalen.local`, password: "larare123", displayName: uid });
    await aAuth.setCustomUserClaims(uid, { teacher: true });
  }
  for (const [uid, classId] of [["e5a", "5a"], ["e6a", "6a"]]) {
    await aAuth.createUser({ uid, email: `${uid}@elev.pluggportalen.local`, password: "elev123" });
    await aDb.doc(`students/${uid}`).set({ namn: uid, username: uid, classIds: [classId] });
    await aDb.doc(`studentCredentials/${uid}`).set({ username: uid, password: "elev123" });
    await aDb.doc(`studentData/${uid}`).set({ coins: 100 });
    await aDb.doc(`classes/${classId}`).set({ name: classId.toUpperCase(), studentIds: [uid], assignedAreas: [] });
  }
  await aDb.doc("subjects/so").set({ name: "SO" });
  await aDb.doc("subjects/so/areas/vikingar").set({ title: "Vikingar" });

  const gammalA = await klient("lararea@larare.pluggportalen.local", "larare123");
  ok(gammalA.claims.teacher === true && !("admin" in gammalA.claims), "lärare A:s token före migreringen: { teacher: true }");
  const passMain = await lararensVardag(gammalA, "main");
  ok(Object.values(passMain).every(Boolean), `main-reglerna: läraren gör allt (${JSON.stringify(passMain)})`);

  console.log("\n▶ Fel ordning: de nya reglerna FÖRE migreringen (övergången bär)");
  await laddaRegler(NYA_REGLER, "epic (nya) – före migreringen");
  const foreMig = await lararensVardag(gammalA, "fore");
  ok(Object.values(foreMig).every(Boolean), `gammal token under nya regler: allt fungerar (${JSON.stringify(foreMig)})`);
  await laddaRegler(MAIN_REGLER, "origin/main igen");

  console.log("\n▶ Steg 2: migreringen – torrkörning");
  const torr = execFileSync("node", ["admin/migrate-teacher-admins.mjs"], { encoding: "utf8", env });
  console.log(torr.replace(/^/gm, "    "));
  ok(/EMULATOR/.test(torr) && /2 konto\(n\) blir admin/.test(torr), "torrkörningen listar båda lärarna som 'blir admin'");
  ok((await aDb.collection("teacherAccounts").get()).empty && !(await aAuth.getUser("larareA")).customClaims.admin,
    "torrkörningen skrev ingenting");

  console.log("▶ Steg 2: --apply");
  const apply = execFileSync("node", ["admin/migrate-teacher-admins.mjs", "--apply"], { encoding: "utf8", env });
  console.log(apply.replace(/^/gm, "    "));
  ok(/✓ Klart/.test(apply) && (apply.match(/✓ admin:true/g) || []).length === 2, "--apply: ✓ Klart och två ✓ admin:true");

  console.log("▶ Steg 3: torrkörning igen");
  const igen = execFileSync("node", ["admin/migrate-teacher-admins.mjs"], { encoding: "utf8", env });
  console.log(igen.replace(/^/gm, "    "));
  ok(/0 konto\(n\) blir admin/.test(igen) && (igen.match(/redan admin/g) || []).length === 2, "'0 konto(n) blir admin', båda 'redan admin'");
  const apply2 = execFileSync("node", ["admin/migrate-teacher-admins.mjs", "--apply"], { encoding: "utf8", env });
  ok(/0 konto\(n\) blir admin/.test(apply2), "--apply en gång till är ofarligt (idempotent)");

  await laddaRegler(NYA_REGLER, "Steg 4: epic (nya) – efter migreringen");
  const gammalEfter = await lararensVardag(gammalA, "gammal");
  ok(Object.values(gammalEfter).every(Boolean), `A:s GAMLA token (före migreringen) gör allt (${JSON.stringify(gammalEfter)})`);
  const nyA = await klient("lararea@larare.pluggportalen.local", "larare123");
  ok(nyA.claims.admin === true && nyA.claims.teacher === true, "ny inloggning: { teacher, admin: true }");
  const nyPass = await lararensVardag(nyA, "ny");
  ok(Object.values(nyPass).every(Boolean), `ny admin-token gör allt (${JSON.stringify(nyPass)})`);
  const elev = await klient("e5a@elev.pluggportalen.local", "elev123");
  ok(await lyckas(updateDoc(doc(elev.db, "studentData", "e5a"), { xp: 5 })), "eleven skriver sin egen elevdata som förut");
  ok(!(await lyckas(getDoc(doc(elev.db, "teacherAccounts", "larareA")))), "eleven läser inte lärarkontona");

  await laddaRegler(UTAN_OVERGANG, "§8.1: övergången borttagen");
  const utan = await lararensVardag(gammalA, "utan");
  ok(Object.values(utan).every((v) => !v), `gammal token { teacher } nekas nu allt (${JSON.stringify(utan)})`);
  const nyB = await klient("larareb@larare.pluggportalen.local", "larare123");
  const utanNy = await lararensVardag(nyB, "utanny");
  ok(Object.values(utanNy).every(Boolean), `ny admin-token fungerar utan övergången (${JSON.stringify(utanNy)})`);

  console.log("\n▶ §8.2 reserv: set-teacher-claim.mjs skapar ett nytt adminkonto");
  const res = execFileSync("node", ["admin/set-teacher-claim.mjs", "--username=reservadmin", "--password=reserv123"], { encoding: "utf8", env });
  console.log(res.replace(/^/gm, "    "));
  const reserv = await klient("reservadmin@larare.pluggportalen.local", "reserv123");
  ok(reserv.claims.admin === true && (await aDb.doc(`teacherAccounts/${(await aAuth.getUserByEmail("reservadmin@larare.pluggportalen.local")).uid}`).get()).get("role") === "admin",
    "reservkontot har admin-claim och ett admin-dokument");
  ok(await lyckas(setDoc(doc(reserv.db, "classes", "reserv"), { name: "R", studentIds: [] })), "reservkontot skriver som admin");

  for (const k of [gammalA, nyA, nyB, elev, reserv]) await k.stang();
  await adminApp.delete();
  console.log(fel ? `\n✗ ${fel} steg blev inte som väntat.` : "\n✓ Driftordningen gick igenom utan utelåsning.");
  process.exit(fel ? 1 : 0);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
