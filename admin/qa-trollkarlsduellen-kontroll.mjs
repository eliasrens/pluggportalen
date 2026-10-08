// ============================================================================
// QA-kontroll för Trollkarlsduellen (#541) – BARA mot emulatorn.
// ----------------------------------------------------------------------------
// Hjälpkommandon till slut-QA:n (docs/trollkarlsduellen-qa.md). Elevsvar
// skrivs med admin/qa-mm-live-sim.mjs (riktiga klient-skrivningar); det här
// skriptet läser/skapar bara sessioner och prövar reglerna för wizards.
//
//   E="FIRESTORE_EMULATOR_HOST=127.0.0.1:8541 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9541"
//   env $E node admin/qa-trollkarlsduellen-kontroll.mjs visa <sid>
//       → status, wizards, nämnare, rätt per klass (summa av shards), snitt, result
//   env $E node admin/qa-trollkarlsduellen-kontroll.mjs ny <sid> <sek> [4b:10,5e:22] [4b=elias]
//       → ny LOBBY 4B mot 5E (längd i sekunder ≥ 30, nämnare, ev. trollkarlsval)
//   env $E node admin/qa-trollkarlsduellen-kontroll.mjs starta <sid>
//       → status live + startedAt/endsAt (som lärarens STARTA, via admin)
//   env $E node admin/qa-trollkarlsduellen-kontroll.mjs regler <sid>
//       → pröva wizards-reglerna som lärare: byte i lobby (ok), samma trollkarl
//         på båda / okänd klass (nekas), byte efter start (nekas), wizards i
//         en match med fler än två klasser (nekas)
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator, doc, updateDoc } from "firebase/firestore";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const adb = admin.firestore(admin.initializeApp({ projectId: PROJECT }));
const { FieldValue, Timestamp } = admin.firestore;

async function visa(sid) {
  const s = (await adb.doc(`liveSessions/${sid}`).get()).data();
  if (!s) throw new Error(`ingen session ${sid}`);
  const counters = (await adb.collection(`liveSessions/${sid}/counters`).get()).docs.map((d) => d.data());
  const rows = s.participatingClassIds.map((cid) => {
    const correct = counters.filter((c) => c.classId === cid).reduce((a, c) => a + (c.correct || 0), 0);
    const div = s.classDivisors?.[cid] || 1;
    return `${cid}: ${correct} rätt / ${div} = ${(correct / div).toFixed(2)} · ${s.wizards?.[cid] || "-"} · attacker ${Math.floor(correct / 100)} · mätare ${correct % 100}`;
  });
  console.log(JSON.stringify({ status: s.status, wizards: s.wizards || null, result: s.result || null,
    startedAt: s.startedAt?.toDate?.().toISOString() || null, finishedAt: s.finishedAt?.toDate?.().toISOString() || null }));
  rows.forEach((r) => console.log("  " + r));
}

async function ny(sid, sek, divs = "4b:10,5e:22", wiz = "") {
  const classDivisors = Object.fromEntries(divs.split(",").map((p) => p.split(":")).map(([c, n]) => [c, Number(n)]));
  const doc0 = {
    name: "4B mot 5E", gameMode: "multiplication_0_10", participatingClassIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, classDivisors, durationSeconds: Number(sek), countdownSeconds: 4,
    counterShards: 10, status: "lobby", createdBy: "elias", createdByName: "elias", createdAt: FieldValue.serverTimestamp(),
  };
  if (wiz) {
    const [c, w] = wiz.split("=");
    const o = c === "4b" ? "5e" : "4b";
    doc0.wizards = { [c]: w, [o]: w === "elias" ? "rasmus" : "elias" };
  }
  await adb.recursiveDelete(adb.doc(`liveSessions/${sid}`));
  await adb.doc(`liveSessions/${sid}`).set(doc0);
  console.log(`✓ lobby ${sid}: ${sek} s, nämnare ${divs}, wizards ${JSON.stringify(doc0.wizards || "standard")}`);
}

async function starta(sid) {
  const s = (await adb.doc(`liveSessions/${sid}`).get()).data();
  const start = Date.now();
  await adb.doc(`liveSessions/${sid}`).update({
    status: "live", startedAt: Timestamp.fromMillis(start),
    endsAt: Timestamp.fromMillis(start + (s.countdownSeconds + s.durationSeconds) * 1000),
  });
  console.log(`✓ ${sid} startad – slut om ${s.countdownSeconds + s.durationSeconds} s`);
}

async function larare() {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, "larare");
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = initializeFirestore(app, {});
  const [h, p] = FS.split(":");
  connectFirestoreEmulator(db, h, Number(p));
  await signInWithEmailAndPassword(auth, "elias@larare.pluggportalen.local", "lilla123");
  return db;
}

async function regler(sid) {
  const db = await larare();
  const ref = doc(db, "liveSessions", sid);
  const prova = async (namn, wizards, vantat) => {
    let ok = true;
    try { await updateDoc(ref, { wizards }); } catch { ok = false; }
    console.log(`${ok === vantat ? "✓" : "✗ FEL"} ${namn}: ${ok ? "godkänt" : "nekat"} (väntat ${vantat ? "godkänt" : "nekat"})`);
  };
  const s = (await adb.doc(`liveSessions/${sid}`).get()).data();
  if (s.participatingClassIds.length !== 2) {
    await prova(`wizards i ${s.participatingClassIds.length}-klassmatch`, { "4b": "rasmus", "5e": "elias" }, false);
  } else if (s.status === "lobby") {
    await prova("byte i lobbyn", { "4b": "rasmus", "5e": "elias" }, true);
    await prova("samma trollkarl på båda", { "4b": "elias", "5e": "elias" }, false);
    await prova("okänd klass", { "4b": "elias", "4a": "rasmus" }, false);
    await prova("okänd trollkarl", { "4b": "elias", "5e": "merlin" }, false);
    await prova("tillbaka", { "4b": "elias", "5e": "rasmus" }, true);
  } else {
    const byt = { [s.participatingClassIds[0]]: s.wizards?.[s.participatingClassIds[1]] || "elias",
      [s.participatingClassIds[1]]: s.wizards?.[s.participatingClassIds[0]] || "rasmus" };
    await prova(`byte när status = ${s.status}`, byt, false);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const jobs = { visa: () => visa(rest[0]), ny: () => ny(...rest), starta: () => starta(rest[0]), regler: () => regler(rest[0]) };
if (!jobs[cmd]) {
  console.error("Användning: visa|ny|starta|regler – se filhuvudet.");
  process.exit(1);
}
jobs[cmd]().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
