// ============================================================================
// QA för Klasscentret 3/4 (#499, epic #474) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Kör först: qa-klasscenter-by-seed → qa-klasscenter-rum-seed →
// qa-klasscenter-larare-seed (qa-kc/qa-kc2/qa-kc3, kc01…, kd01…, qalarare).
// Lösenord lilla123. Allt går via klient-SDK:n som läraren/eleven (reglerna
// gäller), testdata (källdokument) skrivs med admin.
//
//   pokaler      utdelning via korPokalUtdelning/pokalerUrKalla (samma kod som
//                appens kc-pokal-data): MM-vinst, idempotens (igen + två
//                samtidiga lärare), MM oavgjort, live-vinst, live-avklarat
//                (kooperativt), draw, fel klass, ej avslutad, elev skapar/
//                ändrar/raderar, lärare ändrar/raderar, manipulerade fält.
//                Källorna heter qa499-* och städas före varje körning.
//   layout       pokal-nycklar i rummets layout mot reglerna (råa skrivningar
//                förbi klientvalideringen): fullt rum 8 möbler + 8 pokaler som
//                ELEV (1000-uttryckstaket), 9 pokaler, okänd typ, '/'-trick,
//                otillåtna tecken, position utanför, spärrad elev.
//   placering    auto-placeringen är deterministisk (samma resultat oavsett
//                ordning/klient) + hyllan först, äldst först.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8510 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9510 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscentret-3-kontroll.mjs pokaler
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  connectFirestoreEmulator, deleteDoc, doc, getFirestore, runTransaction, serverTimestamp, setDoc, updateDoc,
  writeBatch,
} from "firebase/firestore";
import { korPokalUtdelning, pokalerUrKalla, normaliseraPokaler } from "../src/klasscenter/kc-pokal-typer.js";
import { placeraPokaler } from "../src/klasscenter/kc-pokal-placering.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const PW = "lilla123";
const adminApp = admin.initializeApp({ projectId: PROJECT });
const adb = admin.firestore(adminApp);
const sdk = { runTransaction, doc, serverTimestamp };
const TS = admin.firestore.Timestamp;

async function som(uid, email = `${uid}@elev.pluggportalen.local`) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "qa" }, `${uid}-${Math.random()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FS.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  const cred = await signInWithEmailAndPassword(auth, email, PW);
  return { db, uid: cred.user.uid };
}
const larareKonto = () => som("qalarare", "qalarare@larare.pluggportalen.local");

let fel = 0;
function kontroll(namn, ok, extra = "") {
  if (!ok) fel++;
  console.log(`${ok ? "✓" : "✗"} ${namn}${extra ? ` – ${extra}` : ""}`);
}
async function utfall(fn) {
  try { const r = await fn(); return r && r.ok === false ? r.kod : "ok"; } catch (e) { return e.code || String(e); }
}
const nekad = (r) => r === "permission-denied";

// --- Pokaler -------------------------------------------------------------------

async function antalPokaler(classId, id) {
  return (await adb.doc(`classCenters/${classId}/trophies/${id}`).get()).exists ? 1 : 0;
}
async function stada() {
  for (const c of ["qa-kc", "qa-kc2", "qa-kc3"]) {
    const s = await adb.collection(`classCenters/${c}/trophies`).get();
    await Promise.all(s.docs.filter((d) => d.data().kallaId?.startsWith("qa499")).map((d) => d.ref.delete()));
  }
}
function mm(id, result, extra = {}) {
  return adb.doc(`mathCompetitions/${id}`).set({
    name: `QA499 ${id}`, status: "finished", participatingClassIds: ["qa-kc", "qa-kc2", "qa-kc3"], result, ...extra,
  }).then(() => ({ id, data: { name: `QA499 ${id}`, status: "finished", participatingClassIds: ["qa-kc", "qa-kc2", "qa-kc3"], result, ...extra } }));
}
function live(id, result, extra = {}) {
  const data = { name: `QA499 ${id}`, status: "finished", participatingClassIds: ["qa-kc", "qa-kc2"], result, ...extra };
  return adb.doc(`liveSessions/${id}`).set(data).then(() => ({ id, data }));
}
/** Hela appflödet: pokalerUrKalla → korPokalUtdelning per klass (som kc-pokal-data). */
async function delaUt(db, uid, kalla, k) {
  const ut = [];
  for (const p of pokalerUrKalla(kalla, k.id, k.data)) {
    ut.push({ classId: p.classId, typ: p.typ, ...(await korPokalUtdelning(sdk, db, { classId: p.classId, typ: p.typ, kallaId: k.id, detalj: p.detalj, uid })) });
  }
  return ut;
}

async function pokaler() {
  await stada();
  const L = await larareKonto();
  const L2 = await larareKonto();
  const E = await som("kc01");

  // 1. MM-vinst
  const m1 = await mm("qa499-mm1", { winnerClass: "qa-kc", winnerClasses: ["qa-kc"] });
  const r1 = await delaUt(L.db, L.uid, "mattematchen", m1);
  kontroll("MM: vinnarklassen qa-kc får mm-klasskamp", r1.length === 1 && r1[0].ok && r1[0].ny && await antalPokaler("qa-kc", "mm-klasskamp-qa499-mm1") === 1, JSON.stringify(r1));
  kontroll("MM: förloraren qa-kc2 får ingen", await antalPokaler("qa-kc2", "mm-klasskamp-qa499-mm1") === 0);
  const r1b = await delaUt(L.db, L.uid, "mattematchen", m1);
  kontroll("MM: avsluta igen → ny:false, fortfarande EN", r1b[0]?.ny === false && (await adb.collection("classCenters/qa-kc/trophies").where("kallaId", "==", "qa499-mm1").get()).size === 1);
  const doc1 = (await adb.doc("classCenters/qa-kc/trophies/mm-klasskamp-qa499-mm1").get()).data();
  kontroll("MM: dokumentet har titel/detalj/wonAt/awardedBy", doc1.titel === "Mattematchens mästare" && doc1.detalj === "QA499 qa499-mm1" && doc1.wonAt && doc1.awardedBy === L.uid, JSON.stringify({ ...doc1, wonAt: !!doc1.wonAt }));

  // 2. Två lärarklienter samtidigt (finish i en flik + archiveIfEnded i en annan)
  const m2 = await mm("qa499-mm2", { winnerClass: "qa-kc2", winnerClasses: ["qa-kc2"] });
  const [a, b] = await Promise.all([delaUt(L.db, L.uid, "mattematchen", m2), delaUt(L2.db, L2.uid, "mattematchen", m2)]);
  kontroll("MM: två samtidiga utdelare → en ny:true + en ny:false, EN pokal", [a[0]?.ny, b[0]?.ny].sort().join() === "false,true" &&
    (await adb.collection("classCenters/qa-kc2/trophies").where("kallaId", "==", "qa499-mm2").get()).size === 1, `${a[0]?.ny}/${b[0]?.ny}`);

  // 3. Oavgjort: delad förstaplats
  const m3 = await mm("qa499-mm3", { winnerClass: "qa-kc", winnerClasses: ["qa-kc", "qa-kc3"] });
  const r3 = await delaUt(L.db, L.uid, "mattematchen", m3);
  kontroll("MM oavgjort: båda delade vinnarna får pokal", r3.length === 2 && r3.every((r) => r.ok) &&
    await antalPokaler("qa-kc", "mm-klasskamp-qa499-mm3") + await antalPokaler("qa-kc3", "mm-klasskamp-qa499-mm3") === 2, JSON.stringify(r3.map((r) => r.classId)));
  kontroll("MM oavgjort: tredje klassen får ingen", await antalPokaler("qa-kc2", "mm-klasskamp-qa499-mm3") === 0);
  const m4 = await mm("qa499-mm4", { winnerClass: null, winnerClasses: [] });
  kontroll("MM utan rätt svar (ingen vinnare) → ingen pokal", pokalerUrKalla("mattematchen", m4.id, m4.data).length === 0);

  // 4. Fel klass / ej avslutad (förbi pokalerUrKalla – direkt mot reglerna)
  kontroll("lärare ger MM-pokal till förlorande klass (qa-kc2) → nekas", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc2", typ: "mm-klasskamp", kallaId: m1.id, detalj: "x", uid: L.uid }))));
  const m5 = await mm("qa499-mm5", { winnerClass: "qa-kc", winnerClasses: ["qa-kc"] }, { status: "active" });
  kontroll("pokal för tävling som inte är finished → nekas", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "mm-klasskamp", kallaId: m5.id, uid: L.uid }))));
  kontroll("pokal för källa som inte finns → nekas", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "mm-klasskamp", kallaId: "qa499-finnsinte", uid: L.uid }))));
  kontroll("MM-källa som live-vinst-pokal → nekas", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "live-vinst", kallaId: m1.id, uid: L.uid }))));

  // 5. Live
  const pc = (a, b) => ({ "qa-kc": { players: a, correct: 30 }, "qa-kc2": { players: b, correct: 20 } });
  const l1 = await live("qa499-live1", { winner: "qa-kc", perClass: pc(4, 3) });
  const rl1 = await delaUt(L.db, L.uid, "live", l1);
  kontroll("Live tävling: vinnaren får live-vinst (bara den)", rl1.length === 1 && rl1[0].typ === "live-vinst" && rl1[0].classId === "qa-kc" && rl1[0].ok, JSON.stringify(rl1));
  kontroll("Live tävling: live-avklarat delas INTE ut (inget kooperativt mål)", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "live-avklarat", kallaId: l1.id, uid: L.uid }))));
  kontroll("Live tävling: förloraren qa-kc2 kan inte få live-vinst", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc2", typ: "live-vinst", kallaId: l1.id, uid: L.uid }))));
  const l2 = await live("qa499-live2", { winner: "draw", perClass: pc(4, 3) });
  kontroll("Live oavgjort (draw) → ingen pokal", pokalerUrKalla("live", l2.id, l2.data).length === 0 && nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "live-vinst", kallaId: l2.id, uid: L.uid }))));
  const l3 = await live("qa499-live3", { cooperative: true, goalReached: true, perClass: pc(4, 3) });
  const rl3 = await delaUt(L.db, L.uid, "live", l3);
  kontroll("Live kooperativt, mål nått → live-avklarat till båda deltagande klasserna", rl3.length === 2 && rl3.every((r) => r.ok && r.typ === "live-avklarat"), JSON.stringify(rl3.map((r) => `${r.classId}:${r.typ}`)));
  const l4 = await live("qa499-live4", { cooperative: true, goalReached: false, perClass: pc(4, 3) });
  kontroll("Live kooperativt, mål INTE nått → ingen pokal", pokalerUrKalla("live", l4.id, l4.data).length === 0 && nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "live-avklarat", kallaId: l4.id, uid: L.uid }))));
  const l5 = await live("qa499-live5", { cooperative: true, goalReached: true, winner: "qa-kc", perClass: pc(4, 0) });
  const rl5 = pokalerUrKalla("live", l5.id, l5.data);
  kontroll("Live kooperativt: klass med 0 spelare får ingen, ingen live-vinst i koop", rl5.length === 1 && rl5[0].classId === "qa-kc" && rl5[0].typ === "live-avklarat" &&
    nekad(await utfall(() => korPokalUtdelning(sdk, L.db, { classId: "qa-kc2", typ: "live-avklarat", kallaId: l5.id, uid: L.uid }))) &&
    nekad(await utfall(() => korPokalUtdelning(sdk, L.db, { classId: "qa-kc", typ: "live-vinst", kallaId: l5.id, uid: L.uid }))));
  const l6 = await live("qa499-live6", { winner: "qa-kc3", perClass: { "qa-kc3": { players: 3 } } });
  kontroll("Live: vinnare som inte är deltagande klass → nekas", nekad(await utfall(() =>
    korPokalUtdelning(sdk, L.db, { classId: "qa-kc3", typ: "live-vinst", kallaId: l6.id, uid: L.uid }))));

  // 6. Elev
  const m6 = await mm("qa499-mm6", { winnerClass: "qa-kc", winnerClasses: ["qa-kc"] });
  kontroll("elev (vinnande klass) skapar pokal → nekas", nekad(await utfall(() =>
    korPokalUtdelning(sdk, E.db, { classId: "qa-kc", typ: "mm-klasskamp", kallaId: m6.id, uid: E.uid }))));
  const ref = (db) => doc(db, "classCenters", "qa-kc", "trophies", "mm-klasskamp-qa499-mm1");
  kontroll("elev ändrar pokal → nekas", nekad(await utfall(() => updateDoc(ref(E.db), { titel: "Hackad" }))));
  kontroll("elev raderar pokal → nekas", nekad(await utfall(() => deleteDoc(ref(E.db)))));
  kontroll("lärare ändrar pokal → nekas (create-only)", nekad(await utfall(() => updateDoc(ref(L.db), { titel: "Ny" }))));
  kontroll("lärare raderar pokal → nekas", nekad(await utfall(() => deleteDoc(ref(L.db)))));
  kontroll("lärare skriver över befintlig pokal med set → nekas", nekad(await utfall(() =>
    setDoc(ref(L.db), { typ: "mm-klasskamp", kallaId: "qa499-mm1", titel: "x", wonAt: serverTimestamp(), awardedBy: L.uid }))));
  kontroll("elev läser pokaler (även annan klass, gästläge) → ok", (await utfall(async () => {
    const { getDocs, collection } = await import("firebase/firestore");
    const s = await getDocs(collection(E.db, "classCenters", "qa-kc2", "trophies"));
    if (!s.size) throw new Error("tom");
  })) === "ok");

  // 7. Manipulerade fält (rått setDoc som lärare, källan vann)
  const rad = (id, data) => utfall(() => setDoc(doc(L.db, "classCenters", "qa-kc", "trophies", id), data));
  const bas = { typ: "mm-klasskamp", kallaId: m6.id, titel: "Mattematchens mästare", wonAt: serverTimestamp(), awardedBy: L.uid };
  kontroll("fel id (≠ typ-kallaId) → nekas", nekad(await rad("mm-klasskamp-annat", bas)));
  kontroll("awardedBy = annan → nekas", nekad(await rad(`mm-klasskamp-${m6.id}`, { ...bas, awardedBy: "kc01" })));
  kontroll("wonAt = klientens tid → nekas", nekad(await rad(`mm-klasskamp-${m6.id}`, { ...bas, wonAt: new Date(2020, 0, 1) })));
  kontroll("extra fält → nekas", nekad(await rad(`mm-klasskamp-${m6.id}`, { ...bas, poang: 999 })));
  kontroll("okänd typ → nekas", nekad(await rad(`guld-${m6.id}`, { ...bas, typ: "guld" })));
  kontroll("titel > 80 tecken → nekas", nekad(await rad(`mm-klasskamp-${m6.id}`, { ...bas, titel: "x".repeat(81) })));
  kontroll("detalj > 120 tecken → nekas", nekad(await rad(`mm-klasskamp-${m6.id}`, { ...bas, detalj: "x".repeat(121) })));
  kontroll("korrekt rått dokument → ok (kontroll av basfallet)", (await rad(`mm-klasskamp-${m6.id}`, bas)) === "ok");
}

// --- Layout --------------------------------------------------------------------

const MOBLER = ["klassfana", "trofehylla", "lounge", "akvarium", "guldstaty", "flygel", "fontan", "kristallkrona"];
async function raSpara(konto, classId, placedItems) {
  return utfall(() => runTransaction(konto.db, async (tx) => {
    const cur = await tx.get(doc(konto.db, "classCenters", classId, "layout", "current"));
    const version = (cur.exists() ? cur.data().version : 0) + 1;
    tx.set(doc(konto.db, "classCenters", classId, "layout", "current"), { placedItems, version, updatedBy: konto.uid, updatedAt: serverTimestamp() });
    tx.set(doc(konto.db, "classCenters", classId, "layoutHistory", String(version % 10)), { placedItems, savedBy: konto.uid, savedAt: serverTimestamp(), version });
  }));
}
function pokalNycklar(n, typ = "mm-klasskamp") {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [`pokal-${typ}-qa499-p${i}`, { x: 10 + i * 5, y: 30.5, z: 3 }]));
}
const mobler = () => Object.fromEntries(MOBLER.map((m, i) => [m, { x: 5 + i * 11, y: 75, z: i }]));

async function layout() {
  const fore = (await adb.doc("classCenters/qa-kc/layout/current").get()).data();
  const kc01 = await som("kc01");
  const kc03 = await som("kc03");
  const kd01 = await som("kd01");
  try {
    kontroll("ELEV: fullt rum 8 möbler + 8 pokaler sparas (1000-uttryckstaket)", (await raSpara(kc01, "qa-kc", { ...mobler(), ...pokalNycklar(8) })) === "ok");
    kontroll("ELEV: 8 pokaler + 1 live-vinst + 1 live-avklarat (10) → nekas", nekad(await raSpara(kc01, "qa-kc",
      { ...pokalNycklar(8), ...pokalNycklar(1, "live-vinst"), ...pokalNycklar(1, "live-avklarat") })));
    kontroll("ELEV: 9 pokaler → nekas", nekad(await raSpara(kc01, "qa-kc", pokalNycklar(9))));
    kontroll("ELEV: blandade typer (mm + live-vinst + live-avklarat) → ok", (await raSpara(kc01, "qa-kc",
      { ...pokalNycklar(2), ...pokalNycklar(2, "live-vinst"), ...pokalNycklar(2, "live-avklarat") })) === "ok");
    const en = (k, p = { x: 50, y: 50, z: 1 }) => raSpara(kc01, "qa-kc", { [k]: p });
    kontroll("okänd pokaltyp 'pokal-guld-x' → nekas", nekad(await en("pokal-guld-x")));
    kontroll("okänd nyckel utan prefix 'hackad' → nekas", nekad(await en("hackad")));
    kontroll("'/'-trick (två nycklar som en) → nekas", nekad(await en("pokal-mm-klasskamp-a/pokal-mm-klasskamp-b")));
    kontroll("otillåtet tecken 'pokal-mm-klasskamp-å' → nekas", nekad(await en("pokal-mm-klasskamp-å")));
    kontroll("tomt kallaId 'pokal-mm-klasskamp-' → nekas", nekad(await en("pokal-mm-klasskamp-")));
    kontroll("pokal x = 101 → nekas", nekad(await en("pokal-mm-klasskamp-a", { x: 101, y: 50, z: 1 })));
    kontroll("pokal z = 1.5 → nekas", nekad(await en("pokal-mm-klasskamp-a", { x: 5, y: 50, z: 1.5 })));
    kontroll("pokal med extra fält → nekas", nekad(await en("pokal-mm-klasskamp-a", { x: 5, y: 50, z: 1, w: 3 })));
    kontroll("pokal x som text → nekas", nekad(await en("pokal-mm-klasskamp-a", { x: "5", y: 50, z: 1 })));
    kontroll("giltig pokalflytt → ok", (await en("pokal-mm-klasskamp-a", { x: 0, y: 100, z: 999 })) === "ok");
    kontroll("SPÄRRAD elev (kc03) flyttar bara en pokal → nekas", nekad(await raSpara(kc03, "qa-kc", { "pokal-mm-klasskamp-qa-mm-host": { x: 40, y: 40, z: 1 } })));
    kontroll("annan klass (kd01) flyttar pokal i qa-kc → nekas", nekad(await raSpara(kd01, "qa-kc", { "pokal-mm-klasskamp-qa-mm-host": { x: 40, y: 40, z: 1 } })));
  } finally {
    // Tillbaka till layouten före körningen (ny version, som en återställning).
    const v = ((await adb.doc("classCenters/qa-kc/layout/current").get()).data()?.version || 0) + 1;
    await adb.doc("classCenters/qa-kc/layout/current").set({ placedItems: fore?.placedItems || {}, version: v, updatedBy: "qa499", updatedAt: TS.now() });
    await adb.doc(`classCenters/qa-kc/layoutHistory/${v % 10}`).set({ placedItems: fore?.placedItems || {}, savedBy: "qa499", savedAt: TS.now(), version: v });
    console.log(`(layouten återställd till före körningen som v${v})`);
  }
}

// --- Placering -----------------------------------------------------------------

function placering() {
  const docs = [
    { id: "mm-klasskamp-b", data: { typ: "mm-klasskamp", kallaId: "b", titel: "t", wonAt: 3000 } },
    { id: "live-vinst-a", data: { typ: "live-vinst", kallaId: "a", titel: "t", wonAt: 1000 } },
    { id: "mm-klasskamp-a", data: { typ: "mm-klasskamp", kallaId: "a", titel: "t", wonAt: 3000 } },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `mm-klasskamp-x${i}`, data: { typ: "mm-klasskamp", kallaId: `x${i}`, titel: "t", wonAt: 5000 + i } })),
  ];
  const A = normaliseraPokaler(docs);
  const B = normaliseraPokaler([...docs].reverse());
  const pi = { lounge: { x: 36, y: 22, z: 1 } };
  const pa = placeraPokaler(A, pi);
  const pb = placeraPokaler(B, pi);
  const pc = placeraPokaler([...A].sort(() => 0.5 - Math.random()), pi);
  kontroll("två klienter (olika ordning) → identisk placering", JSON.stringify(pa) === JSON.stringify(pb) && JSON.stringify(pa) === JSON.stringify(pc));
  const ord = Object.keys(pa);
  kontroll("äldst först på hyllan (live-vinst-a, sedan mm-klasskamp-a före -b vid lika wonAt)",
    ord[0] === "pokal-live-vinst-a" && ord[1] === "pokal-mm-klasskamp-a" && ord[2] === "pokal-mm-klasskamp-b", ord.slice(0, 3).join(", "));
  kontroll("11 pokaler → 8 på hyllan + 3 på väggen, ingen på upptagen plats (lounge 36,22)",
    ord.length === 11 && Object.values(pa).slice(8).every((p) => Math.hypot(p.x - 36, p.y - 22) >= 6), JSON.stringify(Object.values(pa).slice(8)));
  const flyttad = placeraPokaler(A, { ...pi, "pokal-live-vinst-a": { x: 70, y: 70, z: 2 } });
  kontroll("flyttad pokal auto-placeras inte (finns kvar i layouten)", !("pokal-live-vinst-a" in flyttad) && Object.keys(flyttad).length === 10);
  const skalor = [{ W: 780, H: 437, enhet: 18 }, { W: 1280, H: 720, enhet: 30 }].map((m) => Object.keys(placeraPokaler(A, pi, m)).join());
  kontroll("valet av plats beror inte på skärmstorleken (samma ordning)", skalor[0] === skalor[1] && skalor[0] === ord.join());
}

const [cmd] = process.argv.slice(2);
const kor = { pokaler, layout, placering: async () => placering() }[cmd];
if (!kor) {
  console.error("Användning: pokaler | layout | placering");
  process.exit(1);
}
kor().then(() => { console.log(fel ? `\n${fel} kontroll(er) FAILADE` : "\nAlla kontroller OK"); process.exit(fel ? 1 : 0); },
  (e) => { console.error(e); process.exit(1); });
