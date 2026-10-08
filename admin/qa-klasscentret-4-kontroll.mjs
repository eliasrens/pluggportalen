// ============================================================================
// Slut-QA för hela Klasscentret (#502, epic #473) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Kör först: qa-klasscenter-by-seed → qa-klasscenter-rum-seed →
// qa-klasscenter-larare-seed → qa-klasscentrum-shop seed (qa-kc 14 elever,
// qa-kc2 5, qa-kc3 28, qa-ks 2 + qalarare). Lösenord lilla123. Allt som
// skriver går via klient-SDK:n som eleven/läraren (reglerna gäller).
//
//   placering    spec §9.1: byLayout för 0–30 elever (centret mitt i översta
//                raden, ≤ 2 hus per sida, en tomt per elev, inga krockar med
//                centret/skylten) + seedade klasser 5/14/28 har kvar sin elevdata
//   normalisering  beslut: 14 och 28 elever når samma nivå vid samma EXP/elev
//   regler       beslut: EXP-regel per modul (quiz/läsförståelse ≥ 50 %, memory/
//                para 3 första per område, Läsresan ≥ 5/7, MM var 20:e rätt,
//                Räkna 10 rätt, Live-bonus) – samma registry som appen
//   niva         spec §9.2: qa-kc sätts 1 under nästa tröskel, kc01 tjänar 1 EXP
//                (samma skrivplan som appen) → nivån byts; gäst nekas
//   insamling    spec §9.3 + §9.4 i qa-ks: A donerar 100 → B ser "100 / 5000"
//                i realtid; fyll målet med överskott → cappas, köpt, i lådan,
//                inga fler donationer. Kör `qa-klasscentrum-shop seed` efteråt.
//   gast         spec §9.5 + anonymt: kd01 (4B) läser 4A:s rum men ALLA råa
//                skrivningar nekas; elever läser inte donationsposter, läraren ja
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8520 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9520 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscentret-4-kontroll.mjs alla
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocFromServer, getDocs, getFirestore, increment,
  onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch,
} from "firebase/firestore";
import { byLayout, byParams, KC_HUS_PER_SIDA } from "../src/varld-by.js";
import { nivaFor, progressTillNasta, troskelFor, MAX_NIVA } from "../src/klasscenter/kc-niva.js";
import { planKlassExp, klassBonusFor } from "../src/klasscenter/kc-exp-regler.js";
import { planKlassExpWrites, sumKlassExp } from "../src/klasscenter/kc-exp-skriv.js";
import { korDonation, normaliseraFunds, unlockedItems } from "../src/klasscenter/kc-fund-plan.js";

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
const sdk = { runTransaction, doc, collection, getDocFromServer, writeBatch, increment, serverTimestamp };
const fv = { increment, serverTimestamp };

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
const sov = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 1. Placering ---------------------------------------------------------------

function kollaLayout(n) {
  const L = byLayout(byParams(n, { klasscenter: true }));
  const c = L.klasscenter;
  const rad0 = L.tomter.filter((t) => t.rad === 0);
  const vanster = rad0.filter((t) => t.x < c.x).length;
  const hoger = rad0.filter((t) => t.x > c.x).length;
  const iCentret = L.tomter.filter((t) => Math.abs(t.x - c.x) < c.bredd / 2 && t.y > c.topp && t.y < c.botten);
  const s = L.skylt;
  const iSkylt = s ? L.tomter.filter((t) => t.x >= s.v && t.x <= s.h && t.y >= s.o && t.y <= s.u) : [];
  const utanfor = L.tomter.filter((t) => t.x < 0 || t.x > 100 || t.y < 0 || t.y > 100);
  const unika = new Set(L.tomter.map((t) => `${t.rad}:${t.kol}`)).size;
  return { L, c, vanster, hoger, iCentret, iSkylt, utanfor, unika };
}

async function placering() {
  let ok = true;
  for (let n = 0; n <= 30; n++) {
    const r = kollaLayout(n);
    const bra = r.c && Math.abs(r.c.x - 50) < 0.01 && r.c.rad === 0 && r.L.tomter.length === n && r.unika === n
      && r.vanster <= KC_HUS_PER_SIDA && r.hoger <= KC_HUS_PER_SIDA && Math.abs(r.vanster - r.hoger) <= 1
      && r.vanster + r.hoger === Math.min(4, n) && !r.iCentret.length && !r.iSkylt.length && !r.utanfor.length;
    if (!bra) { ok = false; console.log("  fel vid", n, JSON.stringify({ v: r.vanster, h: r.hoger, c: r.c, t: r.L.tomter.length })); }
  }
  kontroll("byLayout 0–30 elever: centret x=50 rad 0, ≤ 2 hus/sida, en unik tomt per elev, ingen i centret/skylten/utanför", ok);
  for (const n of [5, 14, 28]) {
    const r = kollaLayout(n);
    console.log(`  ${n} elever: span ${r.c.span}, centret ${r.c.bredd.toFixed(1)} % brett (cell ${r.L.cellW.toFixed(1)} %), ` +
      `rad 0 = ${r.vanster} + CENTRET + ${r.hoger}, ${r.L.rader} rader, tomter ${r.L.tomter.length}`);
    kontroll(`${n} elever: centret tar extra plats (span ≥ 2 celler)`, r.c.span >= 2 && r.c.bredd >= 2 * r.L.cellW - 0.01);
  }
  // Elevdata finns kvar för varje elev i de seedade klasserna (centret flyttar bara husen).
  for (const [cid, n] of [["qa-kc2", 5], ["qa-kc", 14], ["qa-kc3", 28]]) {
    const ids = (await adb.doc(`classes/${cid}`).get()).data()?.studentIds || [];
    const snaps = await Promise.all(ids.map((u) => adb.doc(`studentData/${u}`).get()));
    const saknas = ids.filter((_, i) => !snaps[i].exists);
    kontroll(`${cid}: ${n} elever i klassen, alla har studentData`, ids.length === n && !saknas.length, saknas.join(","));
  }
}

// --- Beslut: normalisering per elev ----------------------------------------------

function normalisering() {
  const rader = [];
  let ok = true;
  for (let niva = 1; niva <= MAX_NIVA; niva++) {
    const t14 = troskelFor(niva, 14);
    const t28 = troskelFor(niva, 28);
    rader.push(`N${niva}: 14 el ${t14} / 28 el ${t28}`);
    const perElev = t28 / 28;
    if (nivaFor(Math.ceil(perElev * 14), 14) !== niva || nivaFor(t28, 28) !== niva || Math.abs(t14 / 14 - perElev) > 0.08) ok = false;
  }
  console.log("  trösklar:", rader.join(" · "));
  kontroll("14 och 28 elever: samma nivå vid samma EXP per elev (trösklar ∝ elevantal)", ok);
  const p14 = progressTillNasta(300, 14);
  const p28 = progressTillNasta(600, 28);
  kontroll("300 EXP/14 el och 600 EXP/28 el ger samma nivå och samma stapel", p14.niva === p28.niva && Math.abs(p14.andel - p28.andel) < 0.02,
    `N${p14.niva} ${(p14.andel * 100).toFixed(0)} % vs N${p28.niva} ${(p28.andel * 100).toFixed(0)} %`);
  kontroll("samma totala EXP (300): 28 elever ligger lägre än 14 (normaliserat)", nivaFor(300, 28) < nivaFor(300, 14),
    `${nivaFor(300, 14)} vs ${nivaFor(300, 28)}`);
}

// --- Beslut: EXP-regler per modul -------------------------------------------------

function kedja(modul, resultat, ganger, area) {
  let counts = {};
  const ut = [];
  for (let i = 0; i < ganger; i++) {
    const { antal, raknare } = planKlassExp(modul, resultat, { area, raknare: counts });
    ut.push(antal);
    if (raknare) counts = { ...counts, ...raknare };
  }
  return { ut, counts };
}

function regler() {
  const e = (m, r, ctx) => planKlassExp(m, r, ctx).antal;
  for (const m of ["quiz", "lasforstaelse"]) {
    kontroll(`${m}: 5/10 → 1, 4/10 → 0, 10/10 → 1`, e(m, { ratt: 5, totalt: 10 }) === 1 && e(m, { ratt: 4, totalt: 10 }) === 0 && e(m, { ratt: 10, totalt: 10 }) === 1);
  }
  for (const m of ["memory", "para", "kunskapsjakt", "sanningsjakt", "aventyr:gruvan"]) {
    const a = kedja(m, {}, 5, "vikingar");
    const b = kedja(m, {}, 1, "rymden");
    kontroll(`${m}: 3 första per område (5 ggr → ${a.ut.join("")}), nytt område → 1`, a.ut.join("") === "11100" && b.ut[0] === 1);
  }
  kontroll("lasresan: 5/7 → 1, 4/7 → 0, 7/7 → 1", e("lasresan", { ratt: 5, totalt: 7 }) === 1 && e("lasresan", { ratt: 4, totalt: 7 }) === 0 && e("lasresan", { ratt: 7, totalt: 7 }) === 1);
  const mm = [[18, 19], [19, 20], [20, 21], [39, 40], [0, 40]].map(([f, a]) => e("mattematchen", { rattFore: f, rattEfter: a }));
  kontroll("mattematchen: var 20:e rätt (18→19 0, 19→20 1, 20→21 0, 39→40 1, 0→40 2)", mm.join(",") === "0,1,0,1,2", mm.join(","));
  const r = kedja("rakna", { ratt: 7 }, 3);
  kontroll("rakna: 7+7+7 rätt → 0,1,1 och resten sparas (1)", r.ut.join(",") === "0,1,1" && r.counts["rakna|ratt"] === 1, `${r.ut} ${JSON.stringify(r.counts)}`);
  kontroll("rakna: 25 rätt i en omgång → 2", e("rakna", { ratt: 25 }) === 2);
  kontroll("okänd modul → 0", e("helt-ny-modul", { ratt: 9, totalt: 9 }) === 0);
  kontroll("Live-bonus skalas med elevantal: live 14 el = 42, 28 el = 84; live-vinst 14 el = 70",
    klassBonusFor("live", 14) === 42 && klassBonusFor("live", 28) === 84 && klassBonusFor("live-vinst", 14) === 70);
}

// --- 2. Nivåbyte ------------------------------------------------------------------

async function klassExp(cid) {
  return sumKlassExp((await adb.collection(`classCenters/${cid}/expShards`).get()).docs.map((d) => d.data()));
}
async function sattExp(cid, exp) {
  const s = await adb.collection(`classCenters/${cid}/expShards`).get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
  await adb.doc(`classCenters/${cid}/expShards/0`).set({ exp, lastKalla: "qa502" });
}

async function niva() {
  const cid = "qa-kc";
  const antal = (await adb.doc(`classes/${cid}`).get()).data().studentIds.length;
  const fore = await klassExp(cid);
  const nu = nivaFor(fore, antal);
  const mal = troskelFor(nu + 1, antal);
  await sattExp(cid, mal - 1);
  await adb.doc(`classCenters/${cid}/expMembers/kc01`).delete(); // takt-spärren 15 s
  const p0 = progressTillNasta(mal - 1, antal);
  const E = await som("kc01");
  const r = await utfall(() => runTransaction(E.db, async (tx) => {
    for (const w of planKlassExpWrites({ classId: cid, uid: E.uid, antal: 1, kalla: "quiz", shard: 2, fv })) {
      tx.set(doc(E.db, ...w.path), w.data, { merge: true });
    }
  }));
  const efter = await klassExp(cid);
  const p1 = progressTillNasta(efter, antal);
  kontroll(`kc01 (elev) +1 EXP via appens skrivplan: ${mal - 1} → ${efter}`, r === "ok" && efter === mal, r);
  kontroll(`nivån byts N${p0.niva} → N${p1.niva} och mätaren räknar mot nästa: "${p1.nuvarande} / ${p1.mal} till Nivå ${p1.nasta}"`,
    p1.niva === p0.niva + 1 && p1.mal === troskelFor(p1.niva + 1, antal));
  const G = await som("kd01");
  const g = await utfall(() => runTransaction(G.db, async (tx) => {
    for (const w of planKlassExpWrites({ classId: cid, uid: G.uid, antal: 1, kalla: "quiz", shard: 3, fv })) {
      tx.set(doc(G.db, ...w.path), w.data, { merge: true });
    }
  }));
  kontroll("gäst kd01 (4B) ger 4A EXP → nekas", nekad(g), g);
  await sattExp(cid, fore); // tillbaka till seedens värde
  console.log(`  qa-kc återställd till ${fore} EXP (N${nu})`);
}

// --- 3+4. Insamling och upplåsning -------------------------------------------------

async function insamling() {
  const cid = "qa-ks";
  const fundRef = adb.doc(`classCenters/${cid}/fund/guldstaty`);
  if ((await fundRef.get()).exists) {
    console.log("  guldstatyn har redan en insamling – kör `qa-klasscentrum-shop.mjs seed` först"); fel++; return;
  }
  const A = await som("ks01");
  const B = await som("ks02");
  const sett = [];
  const stopp = onSnapshot(doc(B.db, "classCenters", cid, "fund", "guldstaty"), (s) => {
    const d = s.data();
    if (d) sett.push(`${d.fundedAmount} / ${d.targetPrice}`);
  });
  const coinsA0 = (await adb.doc(`studentData/${A.uid}`).get()).data().coins;
  const r = await korDonation(sdk, A.db, { classId: cid, uid: A.uid, itemId: "guldstaty", amount: 100 });
  for (let i = 0; i < 20 && !sett.includes("100 / 5000"); i++) await sov(100);
  kontroll("A donerar 100 → ok", r.ok !== false, JSON.stringify(r).slice(0, 80));
  kontroll('B (egen session) ser "100 / 5000" i realtid', sett.includes("100 / 5000"), sett.join(" → "));
  kontroll("A:s saldo −100", (await adb.doc(`studentData/${A.uid}`).get()).data().coins === coinsA0 - 100);
  // Fyll målet: B har 3000, A 2900 → B 3000 + A 2000 (av 2900 begärt) = 5000.
  await korDonation(sdk, B.db, { classId: cid, uid: B.uid, itemId: "guldstaty", amount: 3000 });
  const coinsA1 = (await adb.doc(`studentData/${A.uid}`).get()).data().coins;
  const r2 = await korDonation(sdk, A.db, { classId: cid, uid: A.uid, itemId: "guldstaty", amount: coinsA1 });
  const coinsA2 = (await adb.doc(`studentData/${A.uid}`).get()).data().coins;
  const f = (await fundRef.get()).data();
  kontroll(`överskott cappas: A begärde ${coinsA1}, drogs ${coinsA1 - coinsA2} (= det som saknades)`, coinsA1 - coinsA2 === 1900 && r2.ok !== false);
  kontroll("100 % → isUnlocked, exakt 5000 / 5000", f.isUnlocked === true && f.fundedAmount === 5000);
  const r3 = await korDonation(sdk, B.db, { classId: cid, uid: B.uid, itemId: "guldstaty", amount: 50 });
  kontroll("fler donationer → redan-kopt, inga mynt dras", r3.kod === "redan-kopt", r3.kod);
  const funds = normaliseraFunds((await getDocs(collection(B.db, "classCenters", cid, "fund"))).docs);
  kontroll("guldstatyn ligger i klassens möbellåda (unlockedItems)", unlockedItems(funds).some((i) => i.id === "guldstaty"));
  const poster = (await adb.collection(`classCenters/${cid}/donations`).get()).docs.map((d) => d.data().amount);
  kontroll("dragna mynt == summan av donationsposterna", poster.reduce((a, b) => a + b, 0) === 5000, poster.join("+"));
  stopp();
}

// --- 5. Gästläge + anonymitet ----------------------------------------------------

async function gast() {
  const cid = "qa-kc";
  const G = await som("kd01");
  const las = async (p) => utfall(() => getDocFromServer(doc(G.db, ...p.split("/"))));
  const lasAlla = async (p) => utfall(() => getDocs(collection(G.db, ...p.split("/"))));
  kontroll("gäst läser layout/current", (await las(`classCenters/${cid}/layout/current`)) === "ok");
  kontroll("gäst läser pokaler, insamling, klass-EXP", ["trophies", "fund", "expShards"].every(Boolean) &&
    (await lasAlla(`classCenters/${cid}/trophies`)) === "ok" && (await lasAlla(`classCenters/${cid}/fund`)) === "ok" && (await lasAlla(`classCenters/${cid}/expShards`)) === "ok");
  kontroll("gäst läser INTE klassprofilen (spärrlistan)", nekad(await las(`classCenters/${cid}`)));
  kontroll("gäst läser INTE donationsposter", nekad(await lasAlla(`classCenters/${cid}/donations`)));
  const cur = (await adb.doc(`classCenters/${cid}/layout/current`).get()).data() || {};
  const skriv = (p, data, o) => utfall(() => setDoc(doc(G.db, ...p.split("/")), data, o));
  kontroll("rå skrivning: gäst flyttar en möbel (layout/current) → nekas",
    nekad(await skriv(`classCenters/${cid}/layout/current`, { ...cur, version: (cur.version || 0) + 1, updatedBy: G.uid, updatedAt: serverTimestamp() })));
  kontroll("rå skrivning: gäst skriver historikslot → nekas", nekad(await skriv(`classCenters/${cid}/layoutHistory/0`, { version: 99 })));
  kontroll("rå skrivning: gäst tar bort spärren (klassprofil) → nekas", nekad(await skriv(`classCenters/${cid}`, { inredningSparr: [] }, { merge: true })));
  kontroll("rå skrivning: gäst skapar pokal → nekas", nekad(await skriv(`classCenters/${cid}/trophies/mm-klasskamp-x`, { typ: "mm-klasskamp" })));
  const d = await utfall(() => korDonation(sdk, G.db, { classId: cid, uid: G.uid, itemId: "flygel", amount: 50 }));
  kontroll("gäst donerar via appens donationskod → nekas", d !== "ok", d);
  const E = await som("kc01");
  kontroll("anonymt: hemmaelev kc01 läser INTE donationsposter", nekad(await utfall(() => getDocs(collection(E.db, "classCenters", cid, "donations")))));
  const fund = (await getDoc(doc(E.db, "classCenters", cid, "fund", "flygel"))).data() || {};
  kontroll("anonymt: fund-dokumentet bär ingen givare", !Object.keys(fund).some((k) => /uid|givare|donor|namn/i.test(k)), Object.keys(fund).join(","));
  const L = await larareKonto();
  const dl = await getDocs(collection(L.db, "classCenters", cid, "donations"));
  kontroll("läraren läser vem som donerat", dl.size > 0 && dl.docs.every((x) => x.data().uid), `${dl.size} poster`);
}

const KOMMANDON = { placering, normalisering, regler, niva, insamling, gast };
const val = process.argv[2] || "alla";
const kor = val === "alla" ? ["placering", "normalisering", "regler", "niva", "gast"] : [val];
for (const k of kor) {
  if (!KOMMANDON[k]) { console.error(`Okänt kommando ${k}: ${Object.keys(KOMMANDON).join(" | ")} | alla`); process.exit(2); }
  console.log(`\n== ${k}`);
  await KOMMANDON[k]();
}
console.log(fel ? `\n${fel} kontroll(er) FAILADE` : "\nAlla kontroller OK");
process.exit(fel ? 1 : 0);
