// ============================================================================
// QA-seed för togglen "Skoltopplista / Gör till skolutmaning" (#635) – BARA mot emulatorerna.
// ----------------------------------------------------------------------------
// Kör efter qa-hitta-ratt-topplista-seed.mjs (eleverna hr-elev00…39 i 5A/5E/6B)
// och qa-hitta-ratt-egna-seed.mjs ("Gästrikland runt", elev1 har spelat en gång).
// Allt går genom serverns riktiga kärna (sparaPack, submit, sattTopplista).
//
//   "Gästrikland runt" delas även med 5A och 5E. 20 elever där spelar den
//   medan topplistan är AV → personbästa men ingen topplista. Omar (5E) får
//   600 p och blir ledare när topplistan slås PÅ; elev1 hamnar under Top 15
//   (egen rad). Läraren slår på/av i lärarvyn – eller här:
//   --pa / --av   anropar sattTopplista som qalarare (utan ny seed)
//   --pack=<id>   ett annat eget pack än Gästrikland runt (slut-QA #638: lärarens
//                 nya område, 20 elever spelar det innan topplistan slås på)
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-hitta-ratt-toggle-seed.mjs [--pa|--av]
// ============================================================================

import admin from "firebase-admin";
import { sparaPack, sattTopplista } from "../functions/hitta-ratt-egna.js";
import { submit } from "../functions/hitta-ratt-core.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { FieldValue, FieldPath, Timestamp } = admin.firestore;
const deps = { db, FieldValue, FieldPath, Timestamp, now: Date.now };
const ID = process.argv.find((a) => a.startsWith("--pack="))?.slice(7) || "e-qaegnapunkt1";

const larare = await admin.auth(app).getUserByEmail("qalarare@larare.pluggportalen.local").catch(() => null);
const packSnap = await db.doc(`hittaRattPacks/${ID}`).get();
if (!larare || !packSnap.exists) {
  console.error("Avbryter: kör qa-lasresan-seed.mjs, qa-hitta-ratt-topplista-seed.mjs och qa-hitta-ratt-egna-seed.mjs först.");
  process.exit(1);
}

const pa = process.argv.includes("--pa") ? true : process.argv.includes("--av") ? false : null;
if (pa !== null) {
  const r = await sattTopplista(deps, larare.uid, { packId: ID, pa });
  console.log(`✓ Skoltopplistan för ${packSnap.data().title}: ${r.leaderboard ? "PÅ" : "AV"} (${r.tillagda} poster ur personbästa)`);
  process.exit(0);
}

// Dela med 5A och 5E också (texter/klasser ändrar inte facit → samma version).
const pack = packSnap.data();
const classIds = [...new Set([...(pack.classIds || []), "hr-5a", "hr-5e"])];
await sparaPack(deps, larare.uid, { pack: { ...pack, classIds } }, { namn: "qalarare" });

const elever = (await db.collection("classes").where("__name__", "in", ["hr-5a", "hr-5e"]).get()).docs
  .flatMap((d) => d.data().studentIds || [])
  .sort()
  .slice(0, 20);
let nr = 0;
// Försöket måste starta efter senaste facitändringen (annars "Läraren har ändrat kartan").
const start = Math.max(Date.now() - 600_000, (pack.facitAt?.toMillis?.() ?? 0) + 1000);
for (const [i, uid] of elever.entries()) {
  // Omar (hr-elev00) exakt = 600 p, ensam etta; övriga missar 14–50 km på
  // varannan fråga (≤ 5 km ger full poäng) → 15 elever över elev1:s 548 p.
  const km = uid === "hr-elev00" ? 0 : 12 + i * 2;
  const svar = pack.items.map((it, n) => ({ itemId: it.id, lon: it.lon, lat: n % 2 ? it.lat - km / 111.2 : it.lat }));
  const attemptId = `qatoggle${Date.now().toString(36)}${(nr++).toString(36)}`;
  await db.doc(`hittaRattAttempts/${attemptId}`).set({ uid, packId: ID, startedAt: Timestamp.fromMillis(start), status: "open" });
  await submit(deps, uid, { attemptId, svar });
}
console.log(`✓ ${elever.length} elever i 5A/5E har spelat ${pack.title} med topplistan AV (personbästa, ingen topplista).`);
console.log("Klart: slå på i lärarvyn (qalarare → Hitta rätt! → Mina områden → Gästrikland runt) eller … qa-hitta-ratt-toggle-seed.mjs --pa");
