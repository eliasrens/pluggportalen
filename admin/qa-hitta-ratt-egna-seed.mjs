// ============================================================================
// QA-seed för lärarens EGNA pack i Hitta rätt! (#633) – BARA mot emulatorerna.
// ----------------------------------------------------------------------------
// Kör efter qa-lasresan-seed.mjs (lärare qalarare, elev1 i qa-klass) och
// qa-hitta-ratt-topplista-seed.mjs (Hitta rätt! PÅ i qa-klass, klass hr-6b).
// Packen skapas genom serverns riktiga kärna (functions/hitta-ratt-egna.js
// sparaPack) – samma validering, version och katalog som callablen.
//
//   "Gästrikland runt" (punkt, Sverige, 6 orter) → qa-klass: elev1 ser den
//     under "Från din lärare" med ett personbästa (spelat en gång här)
//   "Norden" (område, Europa, 5 länder) → qa-klass: startvy auto = Norden
//   "Bara 6B" (punkt) → hr-6b: elev1 ser den INTE; ?pack=e-qaegna6b0001
//     ger "Kartan finns inte längre"
//   --andra  flyttar Gävle i "Gästrikland runt" → version 2: elev1:s rekord
//            försvinner från kortet, en pågående omgång får "Läraren har
//            ändrat kartan".
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-hitta-ratt-egna-seed.mjs [--andra]
// ============================================================================

import admin from "firebase-admin";
import { sparaPack } from "../functions/hitta-ratt-egna.js";
import { submit } from "../functions/hitta-ratt-core.js";
import { GEO_OMRADEN } from "../functions/hitta-ratt/packs.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { FieldValue, Timestamp } = admin.firestore;
const TIMME = 3_600_000;
const deps = (nar = Date.now()) => ({ db, FieldValue, Timestamp, now: () => nar });

const larare = await admin.auth(app).getUserByEmail("qalarare@larare.pluggportalen.local").catch(() => null);
if (!larare) {
  console.error("Avbryter: kör qa-lasresan-seed.mjs först (läraren qalarare saknas).");
  process.exit(1);
}
const UID = larare.uid;
const NAMN = "qalarare";

const ORTER = [
  ["gavle", "Gävle", 60.6749, 17.1413], ["sandviken", "Sandviken", 60.6167, 16.7667], ["hofors", "Hofors", 60.55, 16.2833],
  ["ockelbo", "Ockelbo", 60.8917, 16.7167], ["storvik", "Storvik", 60.5833, 16.5333], ["torsaker", "Torsåker", 60.5167, 16.4667],
];
const gastrikland = (flyttaGavle = false) => ({
  id: "e-qaegnapunkt1", title: "Gästrikland runt", description: "Orter i Gästrikland", ikon: "🏞️",
  type: "point", geo: "sverige-landskap", startvy: "auto", classIds: ["qa-klass"],
  items: ORTER.map(([id, name, lat, lon]) => ({ id, name, lat: id === "gavle" && flyttaGavle ? lat + 0.05 : lat, lon, kalla: "qa" })),
});
const eu = GEO_OMRADEN.europa;
const omr = (key) => Object.keys(eu).find((id) => eu[id] === key);
const norden = {
  id: "e-qaegnanorden", title: "Norden", description: "Klicka på de nordiska länderna", ikon: "🌲",
  type: "area", geo: "europa", startvy: "auto", classIds: ["qa-klass"],
  items: [["SWE", "Sverige"], ["NOR", "Norge"], ["FIN", "Finland"], ["DNK", "Danmark"], ["ISL", "Island"]]
    .map(([key, name]) => ({ id: name.toLowerCase(), name, omrade: omr(key) })),
};
const bara6b = {
  id: "e-qaegna6b0001", title: "Bara 6B", type: "point", geo: "sverige-landskap", classIds: ["hr-6b"],
  items: ORTER.slice(0, 2).map(([id, name, lat, lon]) => ({ id, name, lat, lon })),
};

if (process.argv.includes("--andra")) {
  const r = await sparaPack(deps(), UID, { pack: gastrikland(true) }, { namn: NAMN });
  console.log(`✓ Gästrikland runt sparad med flyttat Gävle → version ${r.version} (nollställd: ${r.nollstalld})`);
  process.exit(0);
}

for (const pack of [gastrikland(), norden, bara6b]) {
  const r = await sparaPack(deps(Date.now() - TIMME), UID, { pack }, { namn: NAMN });
  console.log(`✓ ${pack.title} (${pack.type}, ${pack.geo}) → ${r.id} v${r.version}`);
}

// elev1 spelar Gästrikland en gång (startad efter facitAt) → personbästa med v.
const attemptId = `qaegna${Date.now().toString(36)}`;
await db.doc(`hittaRattAttempts/${attemptId}`).set({ uid: "elev1", packId: "e-qaegnapunkt1", startedAt: Timestamp.fromMillis(Date.now() - 600_000), status: "open" });
const svar = ORTER.map(([itemId, , lat, lon], i) => ({ itemId, lat: lat - (i % 3) * 0.2, lon }));
const res = await submit(deps(), "elev1", { attemptId, svar });
console.log(`✓ elev1 spelade Gästrikland runt: ${res.result.s} p (v${res.pb.v}), topplista ${res.leaderboard ? "PÅ" : "AV"}`);
console.log("Klart: elev1 / lilla123 → Hitta rätt! → 'Från din lärare'. Ändra facit live: … qa-hitta-ratt-egna-seed.mjs --andra");
