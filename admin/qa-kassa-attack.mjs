// ============================================================================
// QA (#526): angreppsförsök mot klasskassan med RIKTIGA inloggade klienter
// (Auth-emulatorn + firebase-SDK:t) – kör efter qa-live-seed + qa-kassa-seed
// och en utbetalning till 4B. BARA emulatorn. Skriver ut OK/FEL per försök.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8526 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9526 \
//   node admin/qa-kassa-attack.mjs
// ============================================================================
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, getDocFromServer, writeBatch, updateDoc,
  increment, serverTimestamp,
} from "firebase/firestore";
import { korKassaUt, korLivePris, planKassaUtWrites, planKassaUt } from "../src/klasscenter/kc-kassa-plan.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST, AU = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AU) { console.error("Avbryter: bara emulator."); process.exit(1); }
const sdk = { doc, collection, getDoc, getDocFromServer, writeBatch, increment, serverTimestamp };
let n = 0, fel = 0;
async function som(user, larare) {
  const app = initializeApp({ projectId: "pluggportalen-so-2026", apiKey: "x" }, `a${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${AU}`, { disableWarnings: true });
  const db = getFirestore(app); const [h, p] = FS.split(":"); connectFirestoreEmulator(db, h, Number(p));
  await signInWithEmailAndPassword(auth, `${user}@${larare ? "larare" : "elev"}.pluggportalen.local`, "lilla123");
  return { db, uid: auth.currentUser.uid, app };
}
async function nekas(namn, fn) {
  try { const r = await fn(); if (r && r.ok === false) { console.log("OK  nekad (klient):", namn, "–", r.error); return; }
    fel++; console.log("FEL gick igenom:", namn, JSON.stringify(r ?? null)); }
  catch (e) { console.log("OK  nekad:", namn, `(${e.code || e.message})`); }
}
const saldo = async (db, c) => (await getDoc(doc(db, "classCenters", c, "kassa", "saldo"))).data()?.saldo;

const larare = await som("rasmus", true);
const fore = await saldo(larare.db, "4b");
console.log("4B saldo före:", fore);

const clara = await som("clara5e");
await nekas("gäst (5E) läser 4B:s saldo", () => getDoc(doc(clara.db, "classCenters/4b/kassa/saldo")));
await nekas("gäst (5E) läser 4B:s historik", () => getDocs(collection(clara.db, "classCenters/4b/kassaHistorik")));
await nekas("gäst (5E) tar ur 4B:s kassa", () => korKassaUt(sdk, clara.db, { classId: "4b", uid: clara.uid, itemId: "guldstaty", amount: 50, forsok: 1 }));
await nekas("5E-elev (ingen kassör i 5E) tar ur egen kassa", () => korKassaUt(sdk, clara.db, { classId: "5e", uid: clara.uid, itemId: "guldstaty", amount: 50, forsok: 1 }));

const omar = await som("omar4b");
await nekas("vanlig 4B-elev tar ur kassan", () => korKassaUt(sdk, omar.db, { classId: "4b", uid: omar.uid, itemId: "guldstaty", amount: 50, forsok: 1 }));

const alma = await som("alma4b");
await nekas("kassör: mer än saldot (klienten)", async () => {
  const r = await korKassaUt(sdk, alma.db, { classId: "4b", uid: alma.uid, itemId: "kristallkrona", amount: fore + 1000, forsok: 1 });
  return r.ok && r.amount <= fore ? { ok: false, error: `cappad till ${r.amount}` } : r;
});
const efterCap = await saldo(larare.db, "4b");
await nekas("kassör: handbyggd övertrassering (saldo under 0)", async () => {
  const item = kcShopItem("pampigfontan") || kcShopItem("flygel");
  const plan = { ...planKassaUt({ fund: null, item, amount: 1, saldo: 1 }), amount: efterCap + 1 };
  const id = doc(collection(alma.db, "classCenters/4b/donations")).id;
  const b = writeBatch(alma.db);
  for (const w of planKassaUtWrites({ classId: "4b", uid: alma.uid, itemId: item.id, plan: { ...plan, fundedAmount: plan.amount, unlocked: false }, txId: id, saldoFore: efterCap, fv: { serverTimestamp } })) b.set(doc(alma.db, ...w.path), w.data, w.merge ? { merge: true } : {});
  await b.commit();
});
await nekas("kassör i 4B tar ur 5E:s kassa", () => korKassaUt(sdk, alma.db, { classId: "5e", uid: alma.uid, itemId: "guldstaty", amount: 10, forsok: 1 }));
await nekas("kassör (elev) betalar in Live-pris", async () => {
  const s = (await getDoc(doc(larare.db, "liveSessions/historik-demo"))).data();
  const b = writeBatch(alma.db);
  b.set(doc(alma.db, "classCenters/4b/kassa/saldo"), { saldo: increment(1000), lastTxId: "live-x" }, { merge: true });
  b.set(doc(alma.db, "classCenters/4b/kassaHistorik/live-x"), { typ: "in", kalla: "live", sessionId: "historik-demo", titel: s.name, belopp: 1000, at: serverTimestamp(), av: alma.uid });
  await b.commit();
});

const s = { id: "historik-demo", ...(await getDoc(doc(larare.db, "liveSessions/historik-demo"))).data() };
await nekas("lärare: dubbel utbetalning (samma match igen)", async () => {
  const r = await korLivePris(sdk, larare.db, { sid: s.id, session: s, uid: larare.uid });
  return r.every((x) => x.status === "redan") ? { ok: false, error: JSON.stringify(r) } : r;
});
await nekas("lärare: dubbel utbetalning med annat id", async () => {
  const b = writeBatch(larare.db);
  b.set(doc(larare.db, "classCenters/4b/kassa/saldo"), { saldo: increment(1000), lastTxId: "live-historik-demo2" }, { merge: true });
  b.set(doc(larare.db, "classCenters/4b/kassaHistorik/live-historik-demo2"), { typ: "in", kalla: "live", sessionId: "historik-demo", titel: "x", belopp: 1000, at: serverTimestamp(), av: larare.uid });
  await b.commit();
});
await nekas("lärare: ändra pris efter matchen", () => updateDoc(doc(larare.db, "liveSessions/historik-demo"), { coinPrize: 5000 }));
await nekas("lärare: ändra pris i lobbyn", () => updateDoc(doc(larare.db, "liveSessions/fredag-lobby"), { coinPrize: 5000 }));
await nekas("lärare: byta vinnare i result", () => updateDoc(doc(larare.db, "liveSessions/historik-demo"), { "result.winnerClasses": ["5e"] }));
await nekas("lärare: betala 5E (förlorare) för historik-demo", async () => {
  const b = writeBatch(larare.db);
  b.set(doc(larare.db, "classCenters/5e/kassa/saldo"), { saldo: increment(1000), lastTxId: "live-historik-demo" }, { merge: true });
  b.set(doc(larare.db, "classCenters/5e/kassaHistorik/live-historik-demo"), { typ: "in", kalla: "live", sessionId: "historik-demo", titel: "x", belopp: 1000, at: serverTimestamp(), av: larare.uid });
  await b.commit();
});
await nekas("lärare: radera historikpost", async () => { const b = writeBatch(larare.db); b.delete(doc(larare.db, "classCenters/4b/kassaHistorik/live-historik-demo")); await b.commit(); });

console.log("4B saldo efter:", await saldo(larare.db, "4b"), "(före", fore + ", cappat uttag", fore - efterCap + ")");
for (const x of [larare, clara, omar, alma]) await deleteApp(x.app);
console.log(fel ? `❌ ${fel} försök gick igenom` : "✓ alla angrepp nekades");
process.exit(fel ? 1 : 0);
