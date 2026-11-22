// ============================================================================
// #895: mät vänskapsmatchens tider per steg mot EMULATORERNA (functions, auth, firestore) –
// två inloggade klienter (Anna, Bo) som spelar lägen, var och en med sin lyssnare på matchen:
//   gammal = de sex callables (mdUtmana … mdGeUpp), ny = EN callable mdVanskap { op }.
// Gammal körs först: varje namn är kallt första gången (emulatorn laddar index.js per funktion,
// som en egen Cloud Run-tjänst i drift). Sedan ny – bara första anropet är kallt.
// Per läge: fraga + svar för båda i tur och ordning, och var 3:e läge svarar båda SAMTIDIGT
// (transaktionerna krockar på privat-dokumenten). "svar → bild" = från det sista svaret skickas
// tills den ANDRA klientens lyssnare har det nya läget (fas.nr + 1).
//   bash admin/qa-matchdagen-867-svit.sh bench:vanskap   (slumpportar, samma lås som sviterna)
//   LAGEN=9 (standard) = antal lägen per match
// ============================================================================

import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, onSnapshot } from "firebase/firestore";
import { createMvRig, KLASS, ANNA, BO } from "../test/helpers/md-vanskap-rig.js";
import { vLage } from "../src/matchdagen/delat/md-vanskap.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST;
const LAGEN = Number(process.env.LAGEN) || 9;
const PW = "matchdagen874";
const email = (u) => `${u}@elev.pluggportalen.local`;

const rig = createMvRig("mv895lat");
const adb = rig.db;
const GAMLA = { utmana: "mdUtmana", svara: "mdSvara", fraga: "mdFraga", svar: "mdSvar", tick: "mdTick", geUpp: "mdGeUpp" };

async function klient(uid) {
  const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, `lat-${uid}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email(uid), PW);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
  const fns = getFunctions(app, "europe-west1");
  connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
  const cache = new Map();
  const anrop = (lage) => async (op, data) => {
    const namn = lage === "ny" ? "mdVanskap" : GAMLA[op];
    if (!cache.has(namn)) cache.set(namn, httpsCallable(fns, namn));
    return (await cache.get(namn)(lage === "ny" ? { op, ...data } : data)).data;
  };
  return { uid, app, db, anrop };
}

const tider = {}; // steg → [ms …] (första = kallt för det namnet)
const mat = async (steg, p) => {
  const t0 = performance.now();
  const r = await p;
  (tider[steg] ||= []).push(performance.now() - t0);
  return r;
};

/** Vänta tills klientens lyssnare har matchen i läge > nr (eller slut). */
function lyssna(k, matchId) {
  let M = null;
  const vantare = new Set();
  const av = onSnapshot(doc(k.db, "mdVanskap", matchId), (s) => { M = s.data(); vantare.forEach((f) => f()); });
  const efter = (nr) => new Promise((ok) => {
    const f = () => { if (M && (M.fas?.nr > nr || M.status !== "pagar" || M.halvtid)) { vantare.delete(f); ok(M); } };
    vantare.add(f);
    f();
  });
  return { av, efter, get M() { return M; } };
}

async function svaret(matchId, uid, nr) {
  const { bank } = (await adb.doc(`mdVanskap/${matchId}/facit/${uid}`).get()).data();
  const p = bank[(nr - 1) % bank.length];
  return p.pub.typ === "flerval" ? p.pub.alternativ.indexOf(p.r.facit) : p.r.facit;
}

async function spela(lage, A, B) {
  await rig.rensa();
  await rig.seed();
  const [a, b] = [A.anrop(lage), B.anrop(lage)];
  if (lage === "ny") await mat(`${lage} varm`, a("varm", {}));
  const { utmaningId } = await mat(`${lage} utmana`, a("utmana", { classId: KLASS, till: BO }));
  const { matchId } = await mat(`${lage} svara`, b("svara", { utmaningId, ja: true, classId: KLASS }));
  const LA = lyssna(A, matchId);
  const LB = lyssna(B, matchId);
  await Promise.all([LA.efter(0), LB.efter(0)]);
  for (let i = 0; i < LAGEN; i++) {
    const m = LA.M;
    if (m.status !== "pagar" || m.halvtid) break;
    const nr = m.fas.nr;
    const l = vLage(m.V);
    const val = (s) => (l.anf === s ? (l.d <= 28 ? "skjut" : "kort") : "tackla");
    const [sa, sb] = [await svaret(matchId, ANNA, nr), await svaret(matchId, BO, nr)];
    await mat(`${lage} fraga`, a("fraga", { matchId, val: val("a") }));
    await mat(`${lage} fraga`, b("fraga", { matchId, val: val("b") }));
    let t0;
    if (i % 3 === 2) {
      t0 = performance.now();
      await Promise.all([mat(`${lage} svar (samtidigt)`, a("svar", { matchId, svar: sa })), mat(`${lage} svar (samtidigt)`, b("svar", { matchId, svar: sb }))]);
    } else {
      await mat(`${lage} svar (först)`, a("svar", { matchId, svar: sa }));
      t0 = performance.now();
      await mat(`${lage} svar (sist)`, b("svar", { matchId, svar: sb }));
    }
    await LA.efter(nr);
    (tider[`${lage} svar → bild hos den andra`] ||= []).push(performance.now() - t0);
  }
  await mat(`${lage} tick`, a("tick", { matchId }));
  await mat(`${lage} geUpp`, b("geUpp", { matchId }));
  LA.av();
  LB.av();
}

const median = (x) => { const s = [...x].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
const r = (x) => (x == null ? "–" : `${Math.round(x)}`);

const a = admin.auth(rig.app);
for (const uid of [ANNA, BO]) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
const [A, B] = [await klient(ANNA), await klient(BO)];
await spela("gammal", A, B);
await spela("ny", A, B);
console.log("\n| Steg | Första (ms) | Median därefter (ms) | Max (ms) | Antal |\n| --- | --- | --- | --- | --- |");
for (const [steg, x] of Object.entries(tider)) {
  console.log(`| ${steg} | ${r(x[0])} | ${r(x.length > 1 ? median(x.slice(1)) : null)} | ${r(Math.max(...x))} | ${x.length} |`);
}
await Promise.all([deleteApp(A.app), deleteApp(B.app), rig.app.delete()]);
process.exit(0);
