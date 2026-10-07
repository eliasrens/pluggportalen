// ============================================================================
// QA för Klasscentret 2/4 (#492, epic #475) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Kör först: qa-klasscenter-by-seed → qa-klasscenter-rum-seed →
// qa-klasscenter-larare-seed → qa-klasscentrum-shop seed. Lösenord lilla123.
//
//   samtidighet [elever=10] [perElev=3]   (elever 1–28; #493: 28 1 = en hel klass)
//                 klass qa-ks får ks03…ks12 (1 000 mynt); 10 elever × 3
//                 samtidiga donationer à 300 till troféhyllan (2 500) och
//                 10 × 3 à 100 till akvariet (4 000). Kontroll: insamlat ==
//                 summan av donationsposterna == summan av dragna mynt, aldrig
//                 över målet.
//   regler        manipulationsförsök som elev/lärare (förväntat nekad/ok).
//   layout        två samtidiga sparningar i qa-kc (kc01 + kc02), spärrad kc03,
//                 gäst kd01 (4B).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8492 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9492 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscentret-2-kontroll.mjs samtidighet
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocFromServer, getDocs, getFirestore, increment,
  runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { korDonation } from "../src/klasscenter/kc-fund-plan.js";
import { korSparning, korAterstallning } from "../src/klasscenter/kc-layout-plan.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const PW = "lilla123";
const KS = "qa-ks";
const adminApp = admin.initializeApp({ projectId: PROJECT });
const adb = admin.firestore(adminApp);
const aauth = admin.auth(adminApp);
const sdk = { runTransaction, doc, collection, getDocFromServer, writeBatch, increment, serverTimestamp }; // fund: batch, layout: transaktion

async function som(uid, email = `${uid}@elev.pluggportalen.local`) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "qa" }, `${uid}-${Math.random()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FS.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  await signInWithEmailAndPassword(auth, email, PW);
  return db;
}

let fel = 0;
function kontroll(namn, ok, extra = "") {
  if (!ok) fel++;
  console.log(`${ok ? "✓" : "✗"} ${namn}${extra ? ` – ${extra}` : ""}`);
}
async function utfall(fn) {
  try { await fn(); return "ok"; } catch (e) { return e.code || String(e); }
}

async function samtidighet(antal = 10, perElev = 3) {
  const nAktiva = Number(antal), nPer = Number(perElev);
  const elever = Array.from({ length: Math.max(10, nAktiva) }, (_, i) => `ks${String(i + 3).padStart(2, "0")}`);
  for (const uid of elever) {
    try { await aauth.getUser(uid); await aauth.updateUser(uid, { email: `${uid}@elev.pluggportalen.local`, password: PW }); } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
      await aauth.createUser({ uid, email: `${uid}@elev.pluggportalen.local`, password: PW });
    }
    await adb.doc(`students/${uid}`).set({ namn: uid, username: uid, avatarId: "fox", classIds: [KS] });
    await adb.doc(`studentData/${uid}`).set({ progress: {}, avatarId: "fox", coins: 1000, xp: 0 });
  }
  await adb.doc(`classes/${KS}`).update({ studentIds: admin.firestore.FieldValue.arrayUnion(...elever) });
  for (const id of ["trofehylla", "akvarium"]) await adb.doc(`classCenters/${KS}/fund/${id}`).delete();
  const gamla = await adb.collection(`classCenters/${KS}/donations`).where("itemId", "in", ["trofehylla", "akvarium"]).get();
  await Promise.all(gamla.docs.map((d) => d.ref.delete()));
  const dbs = await Promise.all(elever.slice(0, nAktiva).map((uid) => som(uid)));

  for (const [itemId, belopp, mal] of [["trofehylla", 300, 2500], ["akvarium", 100, 4000]]) {
    const t0 = Date.now();
    const res = await Promise.all(dbs.flatMap((db, i) => Array.from({ length: nPer }, () =>
      korDonation(sdk, db, { classId: KS, uid: elever[i], itemId, amount: belopp })
        .catch((e) => ({ ok: false, kod: `${e.code || e}${e.krock === false ? " (verkligt nekad)" : e.krock ? " (försöken slut)" : ""}` })))));
    const ms = Date.now() - t0;
    const fund = (await adb.doc(`classCenters/${KS}/fund/${itemId}`).get()).data();
    const poster = (await adb.collection(`classCenters/${KS}/donations`).where("itemId", "==", itemId).get()).docs.map((d) => d.data());
    const summaPoster = poster.reduce((s, p) => s + p.amount, 0);
    const okSumma = res.filter((r) => r.ok).reduce((s, r) => s + r.amount, 0);
    const koder = res.filter((r) => !r.ok).reduce((m, r) => ({ ...m, [r.kod]: (m[r.kod] || 0) + 1 }), {});
    console.log(`\n${itemId}: ${nAktiva} elever × ${nPer} samtidiga à ${belopp} (${ms} ms) → ${res.filter((r) => r.ok).length} ok, nekade ${JSON.stringify(koder)}, cappade ${res.filter((r) => r.cappat).length}`);
    kontroll(`${itemId} insamlat == summan av posterna`, fund.fundedAmount === summaPoster, `${fund.fundedAmount} / ${mal}, poster ${summaPoster} (${poster.length} st)`);
    kontroll(`${itemId} insamlat == summan av lyckade svar`, fund.fundedAmount === okSumma, `${okSumma}`);
    kontroll(`${itemId} aldrig över målet`, fund.fundedAmount <= mal && fund.targetPrice === mal);
    kontroll(`${itemId} isUnlocked stämmer`, fund.isUnlocked === (fund.fundedAmount === mal));
  }
  let drag = 0;
  for (const uid of elever) drag += 1000 - (await adb.doc(`studentData/${uid}`).get()).data().coins;
  const allt = (await adb.collection(`classCenters/${KS}/donations`).where("itemId", "in", ["trofehylla", "akvarium"]).get()).docs
    .reduce((s, d) => s + d.data().amount, 0);
  kontroll("dragna mynt == summan av alla poster (ingen förlorar mynt)", drag === allt, `${drag} dragna, ${allt} i poster`);
}

async function regler() {
  const ks01 = await som("ks01");
  const ks99 = await som("ks99");
  const larare = await som("qalarare", "qalarare@larare.pluggportalen.local");
  await adb.doc("studentData/ks01").set({ coins: 500 }, { merge: true });
  const nekad = (r) => r === "permission-denied";
  kontroll("elev läser donations (egen klass) nekas", nekad(await utfall(() => getDocs(collection(ks01, "classCenters", KS, "donations")))));
  kontroll("elev läser en enskild donationspost nekas", nekad(await utfall(async () => {
    const d = (await adb.collection(`classCenters/${KS}/donations`).limit(1).get()).docs[0];
    await getDoc(doc(ks01, "classCenters", KS, "donations", d.id));
  })));
  const lr = await utfall(async () => {
    const s = await getDocs(collection(larare, "classCenters", KS, "donations"));
    if (!s.size || !s.docs.every((d) => d.data().uid)) throw new Error("tom");
  });
  kontroll("lärare läser donations (med uid)", lr === "ok", lr);
  kontroll("elev läser fund (totalsumma) ok", (await utfall(() => getDocs(collection(ks01, "classCenters", KS, "fund")))) === "ok");
  kontroll("elev utan klass (ks99) donerar nekas", nekad(await utfall(() =>
    korDonation(sdk, ks99, { classId: KS, uid: "ks99", itemId: "lounge", amount: 10, forsok: 1 }))));
  kontroll("elev donerar till annan klass (qa-kc) nekas", nekad(await utfall(() =>
    korDonation(sdk, ks01, { classId: "qa-kc", uid: "ks01", itemId: "flygel", amount: 10, forsok: 1 }))));
  kontroll("fund ökar utan donationspost nekas", nekad(await utfall(() =>
    updateDoc(doc(ks01, "classCenters", KS, "fund", "guldstaty"), { fundedAmount: increment(100) }))));
  kontroll("fund + post utan myntavdrag nekas", nekad(await utfall(async () => {
    const f = (await getDoc(doc(ks01, "classCenters", KS, "fund", "guldstaty"))).data();
    const id = doc(collection(ks01, "classCenters", KS, "donations")).id;
    const b = writeBatch(ks01);
    b.set(doc(ks01, "classCenters", KS, "donations", id), { uid: "ks01", itemId: "guldstaty", amount: 100, at: serverTimestamp() });
    b.set(doc(ks01, "classCenters", KS, "fund", "guldstaty"), { ...f, fundedAmount: f.fundedAmount + 100, lastDonationId: id });
    await b.commit();
  })));
  kontroll("donation mer än saldot (rå batch) nekas", nekad(await utfall(async () => {
    const f = (await getDoc(doc(ks01, "classCenters", KS, "fund", "guldstaty"))).data();
    const id = doc(collection(ks01, "classCenters", KS, "donations")).id;
    const b = writeBatch(ks01);
    b.set(doc(ks01, "classCenters", KS, "donations", id), { uid: "ks01", itemId: "guldstaty", amount: 600, at: serverTimestamp() });
    b.set(doc(ks01, "classCenters", KS, "fund", "guldstaty"), { ...f, fundedAmount: f.fundedAmount + 600, lastDonationId: id });
    b.set(doc(ks01, "studentData", "ks01"), { coins: -100 }, { merge: true });
    await b.commit();
  })));
  kontroll("donation till köpt föremål (rå batch) nekas", nekad(await utfall(async () => {
    const id = doc(collection(ks01, "classCenters", KS, "donations")).id;
    const b = writeBatch(ks01);
    b.set(doc(ks01, "classCenters", KS, "donations", id), { uid: "ks01", itemId: "klassfana", amount: 10, at: serverTimestamp() });
    b.set(doc(ks01, "classCenters", KS, "fund", "klassfana"), { targetPrice: 2000, fundedAmount: 2000, isUnlocked: true, unlockedAt: serverTimestamp(), lastDonationId: id });
    b.set(doc(ks01, "studentData", "ks01"), { coins: 490 }, { merge: true });
    await b.commit();
  })));
  kontroll("elev låser upp med eget lågt pris (targetPrice 100) nekas", nekad(await utfall(async () => {
    const id = doc(collection(ks01, "classCenters", KS, "donations")).id;
    const b = writeBatch(ks01);
    b.set(doc(ks01, "classCenters", KS, "donations", id), { uid: "ks01", itemId: "lounge", amount: 100, at: serverTimestamp() });
    b.set(doc(ks01, "classCenters", KS, "fund", "lounge"), { targetPrice: 100, fundedAmount: 100, isUnlocked: true, unlockedAt: serverTimestamp(), lastDonationId: id });
    b.set(doc(ks01, "studentData", "ks01"), { coins: 400 }, { merge: true });
    await b.commit();
  })));
  kontroll("elev raderar donationspost nekas", nekad(await utfall(async () => {
    const d = (await adb.collection(`classCenters/${KS}/donations`).limit(1).get()).docs[0];
    const b = writeBatch(ks01); b.delete(doc(ks01, "classCenters", KS, "donations", d.id)); await b.commit();
  })));
  kontroll("lärare raderar donationspost nekas", nekad(await utfall(async () => {
    const d = (await adb.collection(`classCenters/${KS}/donations`).limit(1).get()).docs[0];
    const b = writeBatch(larare); b.delete(doc(larare, "classCenters", KS, "donations", d.id)); await b.commit();
  })));
  kontroll("elev skriver inredningSparr (tar bort spärr) nekas", nekad(await utfall(() =>
    setDoc(doc(ks01, "classCenters", KS), { inredningSparr: [] }, { merge: true }))));
}

async function layout() {
  const KC = "qa-kc";
  const [kc01, kc02, kc03, kd01] = await Promise.all(["kc01", "kc02", "kc03", "kd01"].map((u) => som(u)));
  const fore = (await adb.doc(`classCenters/${KC}/layout/current`).get()).data()?.version || 0;
  const a = { guldstaty: { x: 20, y: 60, z: 1 } };
  const b = { akvarium: { x: 70, y: 55, z: 2 } };
  const [ra, rb] = await Promise.all([
    korSparning(sdk, kc01, { classId: KC, uid: "kc01", placedItems: a }).catch((e) => ({ ok: false, kod: e.code })),
    korSparning(sdk, kc02, { classId: KC, uid: "kc02", placedItems: b }).catch((e) => ({ ok: false, kod: e.code })),
  ]);
  const cur = (await adb.doc(`classCenters/${KC}/layout/current`).get()).data();
  const hist = (await adb.collection(`classCenters/${KC}/layoutHistory`).get()).docs.map((d) => d.data());
  const h1 = hist.find((h) => h.version === fore + 1);
  const h2 = hist.find((h) => h.version === fore + 2);
  console.log(`\nlayout: före v${fore}; kc01 ${JSON.stringify(ra.ok ? { v: ra.version } : ra)}, kc02 ${JSON.stringify(rb.ok ? { v: rb.version } : rb)}`);
  kontroll("två samtidiga sparningar → två versioner i följd", cur.version === fore + 2 && !!h1 && !!h2, `current v${cur.version} av ${cur.updatedBy}`);
  const vinnare = cur.updatedBy === "kc01" ? a : b;
  kontroll("current == en hel layout (ingen sammanslagning)", JSON.stringify(cur.placedItems) === JSON.stringify(vinnare), JSON.stringify(cur.placedItems));
  kontroll("historiken innehåller båda layouterna oförändrade",
    [h1, h2].every((h) => JSON.stringify(h.placedItems) === JSON.stringify(h.savedBy === "kc01" ? a : b)));
  const rr = await korAterstallning(sdk, kc01, { classId: KC, uid: "kc01", slot: (fore + 1) % 10 }).catch((e) => ({ ok: false, kod: e.code }));
  const efter = (await adb.doc(`classCenters/${KC}/layout/current`).get()).data();
  kontroll("återställ v" + (fore + 1) + " → ny version med dess layout", rr.ok && efter.version === fore + 3 &&
    JSON.stringify(efter.placedItems) === JSON.stringify(h1.placedItems), `v${efter.version}`);
  const r3 = await utfall(() => korSparning(sdk, kc03, { classId: KC, uid: "kc03", placedItems: a, forsok: 1 }));
  kontroll("spärrad elev (kc03) sparar → nekas av reglerna", r3 === "permission-denied", r3);
  const r3b = await utfall(() => korAterstallning(sdk, kc03, { classId: KC, uid: "kc03", slot: 1, forsok: 1 }));
  kontroll("spärrad elev (kc03) återställer → nekas", r3b === "permission-denied", r3b);
  const r4 = await utfall(() => korSparning(sdk, kd01, { classId: KC, uid: "kd01", placedItems: a, forsok: 1 }));
  kontroll("elev från annan klass (kd01) sparar → nekas", r4 === "permission-denied", r4);
  const r5 = await utfall(() => getDoc(doc(kd01, "classCenters", KC, "layout", "current")));
  kontroll("gäst (kd01) får LÄSA layouten (gästläge)", r5 === "ok", r5);
}

const [cmd, ...arg] = process.argv.slice(2);
const kor = { samtidighet: () => samtidighet(...arg), regler, layout }[cmd];
if (!kor) {
  console.error("Användning: samtidighet | regler | layout");
  process.exit(1);
}
kor().then(() => { console.log(fel ? `\n${fel} kontroll(er) FAILADE` : "\nAlla kontroller OK"); process.exit(fel ? 1 : 0); },
  (e) => { console.error(e); process.exit(1); });
