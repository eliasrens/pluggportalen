// ============================================================================
// E2E: elevimporten (admin/importera-elever.mjs, #831) mot Auth- + Firestore-
// EMULATORERNA, med PÅHITTADE elever (aldrig riktiga namn här).
// ----------------------------------------------------------------------------
// Spec §5 test 1–14 (test 15 = de befintliga sviterna). Jämförelsen med ett
// handskapat konto kör KLIENTENS riktiga kod (src/data.js: upsertClass,
// upsertStudent, setClassStudents) som admin-lärare mot samma emulator och
// regler, via test/helpers/firebase-emulator-loader.js.
//
// Körs via:  npm run test:import
// (firebase emulators:exec startar auth+firestore, kör detta, river dem.)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { installeraFirebaseEmulator } from "./helpers/firebase-emulator-loader.js";
import {
  lasCsv,
  planera,
  kontrollera,
  importera,
  elevEmail,
} from "../admin/importera-elever-core.mjs";

const PROJECT_ID = "pluggportalen-so-2026";
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, "kör mot emulatorn");

const ROT = fileURLToPath(new URL("..", import.meta.url));
const SKRIPT = join(ROT, "admin/importera-elever.mjs");
const TMP = mkdtempSync(join(tmpdir(), "import-test-"));

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "import-test");
const aAuth = admin.auth(adminApp);
const aDb = admin.firestore(adminApp);
const deps = { auth: aAuth, db: aDb, FieldValue: admin.firestore.FieldValue };

installeraFirebaseEmulator();
const data = await import("../src/data.js");
const klientAuth = await import("../src/auth.js");
const { clearClassCache } = await import("../src/data-classes.js");

after(async () => {
  await klientAuth.signOutCurrent();
  await adminApp.delete().catch(() => {});
  rmSync(TMP, { recursive: true, force: true });
});

// --- hjälpare ------------------------------------------------------------------

const RUBRIK = "klass,namn,anvandarnamn,losenord";
let filNr = 0;
function csv(rader, rubrik = RUBRIK) {
  const p = join(TMP, `elever-${++filNr}.csv`);
  writeFileSync(p, [rubrik, ...rader].join("\r\n") + "\r\n");
  return p;
}

/** Alla lösenord som förekommer i testfilerna – får aldrig synas i utskrifterna (test 13). */
const LOSENORD = new Set();
const UTSKRIFTER = [];
function cli(args, { input = "" } = {}) {
  const r = spawnSync(process.execPath, [SKRIPT, ...args], {
    cwd: ROT,
    env: { ...process.env, IMPORT_PAUS_MS: "0" },
    input,
    encoding: "utf8",
  });
  const out = `${r.stdout}${r.stderr}`;
  UTSKRIFTER.push(out);
  return { kod: r.status, out };
}
function rad(klass, namn, anv, pw = `Hemlis${anv.replace(/\D/g, "")}`) {
  LOSENORD.add(pw);
  return `${klass},${namn},${anv},${pw}`;
}

/** Ögonblicksbild av allt som importen kan röra (för "ingenting skrivs/ändras"). */
async function bild() {
  const del = async (c) =>
    Object.fromEntries((await aDb.collection(c).get()).docs.map((d) => [d.id, d.updateTime.toMillis()]));
  const anv = (await aAuth.listUsers(1000)).users.map((u) => u.uid).sort();
  return {
    students: await del("students"),
    studentData: await del("studentData"),
    studentCredentials: await del("studentCredentials"),
    classes: await del("classes"),
    auth: anv,
  };
}

const elevAv = async (username) => {
  const s = await aDb.collection("students").where("username", "==", username.toLowerCase()).get();
  return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
};
const klass = async (id) => {
  const s = await aDb.collection("classes").doc(id).get();
  return s.exists ? s.data() : null;
};

async function loggaInLarare() {
  if (!(await aAuth.getUserByEmail("larare831@larare.pluggportalen.local").catch(() => null))) {
    const u = await aAuth.createUser({ email: "larare831@larare.pluggportalen.local", password: "larare123" });
    await aAuth.setCustomUserClaims(u.uid, { teacher: true, admin: true });
  }
  const r = await klientAuth.signInTeacher("larare831", "larare123");
  assert.equal(r.ok, true, r.error);
}

/** "Lägg till elev" + "Skapa klass" som lärarsidan gör det (teacher-classes-create/-class-accounts). */
async function handskapaKlass(namn, elever) {
  await loggaInLarare();
  const id = (await import("../src/validate.js")).slugify(namn);
  clearClassCache();
  const order = (await import("../src/klass-membership.js")).nextClassOrder(await data.getClasses());
  await data.upsertClass(id, { name: namn, order });
  const ids = [];
  for (const e of elever) {
    ids.push(await data.upsertStudent(null, { namn: e.namn, username: e.username.toLowerCase(), password: e.pw, avatarId: "fox" }));
  }
  await data.setClassStudents(id, ids);
  return { id, ids };
}

const utanTid = (o) => {
  const { createdAt, updatedAt, ...rest } = o;
  return rest;
};

// --- testerna --------------------------------------------------------------------

test("test 14: admin/import/ är ignorerad av git", () => {
  const ut = execFileSync("git", ["check-ignore", "-v", "admin/import/elever-test.csv"], { cwd: ROT, encoding: "utf8" });
  assert.match(ut, /\.gitignore:\d+:admin\/import\//);
});

test("filen läses som text: inledande nollor och BOM/CRLF", () => {
  const { rader, fel } = lasCsv(`﻿${RUBRIK}\r\n3X,Nolla,Test023,Hemlis023\r\n\r\n`);
  assert.deepEqual(fel, []);
  assert.deepEqual(rader[0], { rad: 2, klass: "3X", namn: "Nolla", anvandarnamn: "Test023", losenord: "Hemlis023" });
  assert.match(lasCsv("klass,namn,user,losenord\n3X,A,b123,Hemlis123").fel[0], /Rubrikraden/);
  assert.match(lasCsv(`${RUBRIK}\n3X,,b123,Hemlis123`).fel[0], /tomt fält \(namn\)/);
  assert.match(planera(lasCsv(`${RUBRIK}\n3X,A,b ö1,Hem1`).rader).fel.join(" "), /ogiltigt[\s\S]*6–64 tecken/);
});

const FIL_A = () =>
  csv([
    rad("9A", "Alfa", "Alfa101"),
    rad("9A", "Beta", "Beta102"),
    rad("9A", "Nolla", "Test023"),
    rad("9A", "Fyra", "Test1807"),
    rad("9B", "Gemma", "Gemma201"),
    rad("9B", "Yoyo", "Yoyo412"),
    rad("9B", "Yoyo", "Yoyo135"),
    rad("9B", "Alfa", "Alfa202"),
  ]);
let filA;

test("test 1: torrkörning skriver ingenting och visar vad som skulle hända", async () => {
  filA = FIL_A();
  const fore = await bild();
  const r = cli(["--fil", filA]);
  assert.equal(r.kod, 0, r.out);
  assert.match(r.out, /Mål: EMULATOR/);
  assert.match(r.out, /9A\s+4\s+0\s+0/);
  assert.match(r.out, /9B\s+4\s+0\s+0/);
  assert.match(r.out, /Totalt\s+8\s+0\s+0/);
  assert.match(r.out, /9A\s+skapas \(id 9a\)/);
  assert.match(r.out, /Torrkörning – ingenting skrevs/);
  assert.deepEqual(await bild(), fore);
});

test("test 2: körning skapar klasser och elever identiska med Lägg till elev (utom importBatch)", async () => {
  // Facit: en klass + elev skapade med klientens riktiga kod.
  const hand = await handskapaKlass("9H", [{ namn: "Handen", username: "hand301", pw: "Hemlis301" }]);
  LOSENORD.add("Hemlis301");
  const r = cli(["--fil", filA, "--kor", "--batch", "test-a"]);
  assert.equal(r.kod, 0, r.out);
  assert.match(r.out, /Klass\s+Skapad\s+Fanns redan\s+Fel/);
  assert.match(r.out, /Totalt\s+8\s+0\s+0/);
  assert.match(r.out, /Skapade klasser: 9A, 9B/);

  const facitKlass = await klass(hand.id);
  const k9a = await klass("9a");
  assert.deepEqual(Object.keys(k9a).sort(), [...Object.keys(facitKlass), "importBatch"].sort());
  assert.equal(k9a.name, "9A");
  assert.equal(k9a.importBatch, "test-a");
  assert.equal(k9a.order, facitKlass.order + 1, "ny klass hamnar sist, som Skapa klass");
  assert.equal(k9a.studentIds.length, 4);

  const fStud = (await aDb.collection("students").doc(hand.ids[0]).get()).data();
  const iStud = await elevAv("Alfa101");
  assert.deepEqual(utanTid({ ...iStud, id: undefined, importBatch: undefined }), {
    ...fStud,
    id: undefined,
    importBatch: undefined,
    namn: "Alfa",
    username: "alfa101",
    classIds: ["9a"],
  });
  const fData = (await aDb.collection("studentData").doc(hand.ids[0]).get()).data();
  const iData = (await aDb.collection("studentData").doc(iStud.id).get()).data();
  assert.deepEqual(iData, fData, "studentData: samma standardvärden, 0 mynt");
  assert.equal(iData.coins, 0);
  const fCred = (await aDb.collection("studentCredentials").doc(hand.ids[0]).get()).data();
  const iCred = (await aDb.collection("studentCredentials").doc(iStud.id).get()).data();
  assert.deepEqual(Object.keys(iCred).sort(), Object.keys(fCred).sort());
  assert.deepEqual(utanTid(iCred), { username: "alfa101", password: "Hemlis101" });
  assert.equal(iCred.updatedAt.constructor.name, fCred.updatedAt.constructor.name);

  const fAuth = await aAuth.getUser(hand.ids[0]);
  const iAuth = await aAuth.getUser(iStud.id);
  assert.equal(iAuth.email, elevEmail("alfa101"));
  assert.equal(fAuth.email, elevEmail("hand301"));
  for (const k of ["customClaims", "displayName", "emailVerified", "disabled", "photoURL", "phoneNumber"]) {
    assert.deepEqual(iAuth[k], fAuth[k], `Auth.${k}`);
  }
  assert.deepEqual(iAuth.providerData.map((p) => p.providerId), fAuth.providerData.map((p) => p.providerId));
});

test("test 3, 7, 8: eleven loggar in med användarnamnet som i filen", async () => {
  for (const [anv, pw] of [["Alfa101", "Hemlis101"], ["Test023", "Hemlis023"], ["Test1807", "Hemlis1807"]]) {
    const r = await data.login(anv, pw);
    assert.equal(r.ok, true, `${anv}: ${r.error}`);
    assert.equal(r.student.username, anv.toLowerCase());
    await data.logout();
  }
  // Test 7/8: nollorna och fyra siffror finns kvar i användarnamn och sparat lösenord.
  for (const [anv, pw] of [["test023", "Hemlis023"], ["test1807", "Hemlis1807"]]) {
    const s = await elevAv(anv);
    assert.equal(s.username, anv);
    assert.equal((await aDb.collection("studentCredentials").doc(s.id).get()).data().password, pw);
  }
});

test("test 9: samma namn i samma klass får namn + siffror, olika klasser behåller namnet", async () => {
  assert.equal((await elevAv("yoyo412")).namn, "Yoyo 412");
  assert.equal((await elevAv("yoyo135")).namn, "Yoyo 135");
  assert.equal((await elevAv("alfa101")).namn, "Alfa");
  assert.equal((await elevAv("alfa202")).namn, "Alfa");
  const r = cli(["--fil", filA]);
  assert.match(r.out, /9B\s+Yoyo412: "Yoyo" → "Yoyo 412"/);
});

test("test 4: andra körningen skapar ingenting och ändrar ingenting", async () => {
  const fore = await bild();
  const r = cli(["--fil", filA, "--kor", "--batch", "test-a"]);
  assert.equal(r.kod, 0, r.out);
  assert.match(r.out, /Totalt\s+0\s+8\s+0/);
  assert.match(r.out, /Inga nya klasser skapades/);
  assert.deepEqual(await bild(), fore);
});

test("test 5: användarnamn som finns för en annan elev stoppar allt innan något skrivs", async () => {
  const fore = await bild();
  // Hand301 finns i 9H som "Handen"; här står det en annan elev i en annan klass.
  const r = cli(["--fil", csv([rad("9C", "Ny", "Ny501"), rad("9C", "Annan", "Hand301")]), "--kor"]);
  assert.equal(r.kod, 3, r.out);
  assert.match(r.out, /Användarnamnet "Hand301" \(Annan, 9C\) finns redan för "Handen" \(klass 9H\)/);
  // Samma namn men i fel klass är också en krock.
  const r2 = cli(["--fil", csv([rad("9C", "Alfa", "Alfa101")]), "--kor"]);
  assert.equal(r2.kod, 3, r2.out);
  assert.deepEqual(await bild(), fore);
  assert.equal(await klass("9c"), null);
});

test("test 6: dubblett i filen (även med annan skiftläge) stoppar innan något skrivs", async () => {
  const fore = await bild();
  const r = cli(["--fil", csv([rad("9C", "Ett", "Dubbel601"), rad("9C", "Två", "dubbel601")]), "--kor"]);
  assert.equal(r.kod, 2, r.out);
  assert.match(r.out, /användarnamnet "dubbel601" finns redan på rad 2/);
  assert.deepEqual(await bild(), fore);
});

test("test 10: befintlig klass får nya elever men inställningar och elever ändras inte", async () => {
  const hand = await handskapaKlass("9E", [{ namn: "Gammal", username: "gammal701", pw: "Hemlis701" }]);
  LOSENORD.add("Hemlis701");
  await data.setClassHiddenModes("9e", ["match"]);
  const fore = await klass("9e");
  const foreElev = (await aDb.collection("students").doc(hand.ids[0]).get()).data();
  const r = cli(["--fil", csv([rad("9E", "Nyare", "Nyare702")]), "--kor", "--batch", "test-e"]);
  assert.equal(r.kod, 0, r.out);
  assert.match(r.out, /9E\s+finns redan \(id 9e, används oförändrad\)/);
  const efter = await klass("9e");
  const ny = await elevAv("nyare702");
  assert.deepEqual({ ...efter, studentIds: undefined }, { ...fore, studentIds: undefined });
  assert.equal(efter.importBatch, undefined, "befintlig klass märks inte");
  assert.deepEqual(efter.studentIds, [...fore.studentIds, ny.id]);
  assert.deepEqual((await aDb.collection("students").doc(hand.ids[0]).get()).data(), foreElev);
});

test("test 11: fel mitt i körningen lämnar inget halvt konto, och nästa körning slutför", async () => {
  const fil = csv([rad("9F", "Ett", "Fel801"), rad("9F", "Två", "Fel802"), rad("9F", "Tre", "Fel803")]);
  const plan = planera(lasCsv(await import("node:fs").then((f) => f.readFileSync(fil, "utf8"))).rader);
  // En db vars andra elev-batch fallerar EFTER att Auth-kontot skapats.
  let n = 0;
  const felDb = new Proxy(aDb, {
    get(t, k) {
      if (k !== "batch") return typeof t[k] === "function" ? t[k].bind(t) : t[k];
      return () => {
        const b = t.batch();
        if (++n === 2) b.commit = async () => { throw new Error("påhittat nätfel"); };
        return b;
      };
    },
  });
  const felDeps = { ...deps, db: felDb };
  const res = await importera(felDeps, await kontrollera(felDeps, plan), { batch: "test-f" });
  assert.deepEqual(res.fel.map((f) => f.anvandarnamn), ["Fel802"]);
  assert.match(res.fel[0].orsak, /påhittat nätfel/);
  assert.equal(await elevAv("fel802"), null);
  await assert.rejects(aAuth.getUserByEmail(elevEmail("fel802")), /no user record/i);
  assert.equal((await klass("9f")).studentIds.length, 2);

  const r = cli(["--fil", fil, "--kor", "--batch", "test-f"]);
  assert.equal(r.kod, 0, r.out);
  assert.match(r.out, /9F\s+1\s+2\s+0/);
  assert.equal((await klass("9f")).studentIds.length, 3);
  assert.ok(await aAuth.getUserByEmail(elevEmail("fel802")));
});

test("test 12: ångra tar bort exakt det importen skapade och inget annat", async () => {
  const fore = await bild();
  const torr = cli(["--angra", "--batch", "test-a"]);
  assert.equal(torr.kod, 0, torr.out);
  assert.match(torr.out, /Import "test-a": 8 elevkonton, 2 klasser/);
  assert.match(torr.out, /klass 9A – tas bort/);
  assert.deepEqual(await bild(), fore, "ångra utan --kor skriver ingenting");
  assert.equal(cli(["--angra", "--batch", "test-a", "--kor"], { input: "nej\n" }).kod, 1);
  assert.deepEqual(await bild(), fore, "utan ja tas ingenting bort");

  const ids = await Promise.all(["alfa101", "yoyo412", "test023"].map(elevAv));
  // En elev som spelat lite: klassprojektion + Läsresan-försök (underkollektion).
  await aDb.collection("classProjections").doc("9a").set({ members: { [ids[0].id]: { namn: "Alfa" }, annan: { namn: "X" } } });
  await aDb.collection("studentData").doc(ids[0].id).collection("lasresaAttempts").doc("t1").set({ ok: true });

  const r = cli(["--angra", "--batch", "test-a", "--kor"], { input: "ja\n" });
  assert.equal(r.kod, 0, r.out);
  assert.match(r.out, /Klart: 8 elever och 2 klasser borttagna, 0 fel/);
  for (const e of ids) {
    assert.equal((await aDb.collection("students").doc(e.id).get()).exists, false);
    assert.equal((await aDb.collection("studentData").doc(e.id).get()).exists, false);
    assert.equal((await aDb.collection("studentCredentials").doc(e.id).get()).exists, false);
    await assert.rejects(aAuth.getUser(e.id), /no user record/i);
  }
  assert.equal((await aDb.collection("studentData").doc(ids[0].id).collection("lasresaAttempts").get()).size, 0);
  assert.deepEqual((await aDb.collection("classProjections").doc("9a").get()).data().members, { annan: { namn: "X" } });
  assert.equal(await klass("9a"), null);
  assert.equal(await klass("9b"), null);
  // Allt annat finns kvar: handskapade klasser/elever och de andra importerna.
  const efter = await bild();
  for (const c of ["9h", "9e", "9f"]) assert.ok(efter.classes[c], c);
  assert.ok(await elevAv("hand301"));
  assert.ok(await elevAv("gammal701"));
  assert.ok(await elevAv("nyare702"));
  assert.equal(efter.auth.length, fore.auth.length - 8);
  assert.equal(Object.keys(efter.students).length, Object.keys(fore.students).length - 8);

  // Ångra i en befintlig klass: bara den importerade eleven försvinner, klassen blir kvar.
  const e = cli(["--angra", "--batch", "test-e", "--kor"], { input: "ja\n" });
  assert.match(e.out, /0 klasser borttagna/);
  assert.deepEqual((await klass("9e")).studentIds, [(await elevAv("gammal701")).id]);
});

test("test 13: inga lösenord i skriptets utskrifter", () => {
  assert.ok(UTSKRIFTER.length >= 10 && LOSENORD.size >= 8);
  for (const out of UTSKRIFTER) {
    for (const pw of LOSENORD) assert.ok(!out.includes(pw), `lösenordet ${pw} syns i utskriften`);
  }
});
