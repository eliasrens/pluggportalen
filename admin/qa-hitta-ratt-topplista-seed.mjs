// ============================================================================
// QA-seed för Hitta rätt!s topplistor (#609) – BARA mot emulatorerna.
// ----------------------------------------------------------------------------
// Kör efter qa-lasresan-seed.mjs (elev1 + qa-klass). Aktiverar Hitta rätt! i
// qa-klass, skapar 40 elever i 5A/5E/6B och SPELAR omgångar genom serverns
// riktiga kärna (functions/hitta-ratt-core.js submit) – samma kod som
// Cloud Functionen, så topplistor, personbästa och ledare blir äkta.
//
//   Sveriges städer (punkt):  Omar 5E och Clara 5A delar plats 1 (test 3);
//     elev1 (Astrid) hamnar långt ner → egen rad under Top 15 (test 10);
//     elev1 spelar sedan ett SÄMRE försök – rekordet ligger kvar (test 6)
//   Sveriges landskap (område): Deniz 25/25 1:39 före Alma 25/25 1:45, Hugo
//     24/25 1:00 efter båda (test 5); elev1 i Top 15 → ingen extra rad
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-hitta-ratt-topplista-seed.mjs
// ============================================================================

import admin from "firebase-admin";
import { submit } from "../functions/hitta-ratt-core.js";
import { PACKS } from "../functions/hitta-ratt/packs.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const auth = admin.auth(app);
const { FieldValue, Timestamp } = admin.firestore;
const deps = { db, FieldValue, Timestamp, now: Date.now };
const PW = "lilla123"; // endast emulator

const NAMN = ["Omar", "Clara", "Alma", "Deniz", "Hugo", "Saga", "Elias", "Maja", "Noah", "Ella", "Liam", "Wilma",
  "Hugo B", "Alice", "Adam", "Freja", "Ali", "Selma", "Vincent", "Agnes", "Melvin", "Ebba", "Ture", "Vera", "Leo",
  "Stella", "Nils", "Signe", "Malte", "Tyra", "Otto", "Juni", "Sixten", "Iris", "Ludvig", "Lova", "Rasmus", "Nova",
  "Love", "Ines"];
const KLASSER = { "hr-5a": "5A", "hr-5e": "5E", "hr-6b": "6B" };
const KLASS_AV = (i) => (i === 0 || i === 2 || i === 3 ? "hr-5e" : i === 1 ? "hr-5a" : Object.keys(KLASSER)[i % 3]);
const elever = NAMN.map((namn, i) => ({ uid: `hr-elev${String(i).padStart(2, "0")}`, namn, klass: KLASS_AV(i) }));

const STADER = PACKS["sverige-stader"];
const LANDSKAP = PACKS["sverige-landskap"];
let nr = 0;

async function spela(uid, pack, svar, sekSedan) {
  const id = `qahr${Date.now().toString(36)}${(nr++).toString(36)}`;
  await db.doc(`hittaRattAttempts/${id}`).set({ uid, packId: pack.id, startedAt: Timestamp.fromMillis(Date.now() - sekSedan * 1000), status: "open" });
  return submit(deps, uid, { attemptId: id, svar });
}
/** Punkt: `exakta` frågor exakt, resten `km` söderut. */
const punkt = (exakta, km) => STADER.items.map((it, i) => ({ itemId: it.id, lon: it.lon, lat: i < exakta ? it.lat : it.lat - km / 111.2 }));
/** Område: `ratt` rätt, total aktiv tid i tiondelar. */
function omrade(ratt, tiondelar) {
  const n = LANDSKAP.items.length;
  const per = Math.floor((tiondelar * 100) / n);
  return LANDSKAP.items.map((it, i) => ({
    itemId: it.id,
    omrade: i < ratt ? it.omrade : LANDSKAP.omraden.find((o) => o !== it.omrade),
    ms: per + (i === 0 ? tiondelar * 100 - per * n : 0),
  }));
}

async function main() {
  for (const c of ["hittaRattBoards", "hittaRattBest", "hittaRattAttempts", "hittaRattMeta"]) {
    for (const d of (await db.collection(c).get()).docs) await d.ref.delete();
  }
  for (const e of elever) {
    await auth.deleteUser(e.uid).catch(() => {});
    await auth.createUser({ uid: e.uid, email: `${e.uid}@elev.pluggportalen.local`, password: PW });
    await db.doc(`students/${e.uid}`).set({ namn: e.namn, username: e.uid, avatarId: "fox", classIds: [e.klass] });
    await db.doc(`studentData/${e.uid}`).set({ coins: 0 }, { merge: true });
  }
  for (const [id, name] of Object.entries(KLASSER)) {
    await db.doc(`classes/${id}`).set({ name, order: 5, studentIds: elever.filter((e) => e.klass === id).map((e) => e.uid), enabledModules: ["hittaratt"] });
  }
  await db.doc("classes/qa-klass").set({ enabledModules: ["hittaratt"] }, { merge: true });

  // Sveriges städer: Omar + Clara lika (1966 p), sedan fallande.
  await spela("hr-elev00", STADER, punkt(18, 40), 900);
  await spela("hr-elev01", STADER, punkt(18, 40), 900);
  for (let i = 2; i < elever.length; i++) await spela(elever[i].uid, STADER, punkt(17 - Math.floor(i / 4), 25 + i * 4), 900);
  const bra = await spela("elev1", STADER, punkt(4, 160), 900);
  const samre = await spela("elev1", STADER, punkt(1, 300), 900);
  console.log(`✓ Sveriges städer: elev1 plats ${samre.plats} av ${samre.antal}, rekord ${samre.pb.s} p (sämre försök ${samre.result.s} p, nyttRekord ${samre.nyttRekord}, bästa ${bra.result.s})`);

  // Sveriges landskap: test 5.
  await spela("hr-elev03", LANDSKAP, omrade(25, 990), 900); // Deniz 25/25 1:39
  await spela("hr-elev02", LANDSKAP, omrade(25, 1050), 900); // Alma 25/25 1:45
  await spela("hr-elev04", LANDSKAP, omrade(24, 600), 900); // Hugo 24/25 1:00
  for (let i = 5; i < 18; i++) await spela(elever[i].uid, LANDSKAP, omrade(22 - Math.floor(i / 3), 1100 + i * 37), 900);
  const l = await spela("elev1", LANDSKAP, omrade(21, 1500), 900);
  console.log(`✓ Sveriges landskap: ${l.top.slice(0, 3).map((r) => `${r.plats}. ${r.n}, ${r.k} ${r.r}/25 ${r.t}`).join(" · ")}; elev1 plats ${l.plats}, egen rad ${l.egen ? "JA" : "nej"}`);
  console.log(`Klart: ${elever.length} elever (lösenord ${PW}), Hitta rätt! aktiverat i qa-klass + ${Object.values(KLASSER).join("/")}.`);
}

main().then(() => app.delete()).catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
