// ============================================================================
// QA-seed för Kartmästare-pokalerna (#610) – BARA mot emulatorerna.
// ----------------------------------------------------------------------------
// Kör efter qa-hitta-ratt-topplista-seed.mjs (40 elever, elev1 i qa-klass).
// Spelar genom serverns riktiga kärna (functions/hitta-ratt-core.js submit),
// så ledarna i hittaRattMeta/ledare blir äkta:
//   Sveriges geografi      elev1 ensam etta, pokalen UTSTÄLLD i rummet
//   Europas huvudstäder 20 elev1 + Saga delar ettan (båda har pokalen); elev1:s
//                          ligger i Möbler-lådan, Sagas står i hennes rum
//   Europas länder 20      elev1 var etta och ställde ut pokalen, sedan tog
//                          Maja ledningen → pokalen ska vara BORTA ur elev1:s
//                          rum (och placeringen städas när rummet öppnas)
//   --byt                  Ludvig slår elev1 på Sveriges geografi (ledarbyte
//                          medan rummet står öppet – syns vid nästa besök)
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-hitta-ratt-pokal-seed.mjs [--byt]
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
const { FieldValue, Timestamp } = admin.firestore;
const deps = { db, FieldValue, Timestamp, now: Date.now };

const GEO = PACKS["sverige-geografi"];
const HUVUD = PACKS["europa-huvudstader-20"];
const LANDER = PACKS["europa-lander-20"];
const SAGA = "hr-elev05";
const MAJA = "hr-elev07";
const LUDVIG = "hr-elev34";
let nr = 0;

async function spela(uid, pack, svar) {
  const id = `qahp${Date.now().toString(36)}${(nr++).toString(36)}`;
  await db.doc(`hittaRattAttempts/${id}`).set({ uid, packId: pack.id, startedAt: Timestamp.fromMillis(Date.now() - 900_000), status: "open" });
  return submit(deps, uid, { attemptId: id, svar });
}
const punkt = (pack, exakta, km = 60) =>
  pack.items.map((it, i) => ({ itemId: it.id, lon: it.lon, lat: i < exakta ? it.lat : it.lat - km / 111.2 }));
function omrade(pack, ratt, tiondelar) {
  const n = pack.items.length;
  const per = Math.floor((tiondelar * 100) / n);
  return pack.items.map((it, i) => ({
    itemId: it.id,
    omrade: i < ratt ? it.omrade : pack.omraden.find((o) => o !== it.omrade),
    ms: per + (i === 0 ? tiondelar * 100 - per * n : 0),
  }));
}
const stall = (uid, packId, x, y) =>
  db.doc(`studentData/${uid}`).set({ room: { placements: { [`hrpokal-${packId}`]: { x, y } } } }, { merge: true });
const ledare = async (packId) => (await db.doc("hittaRattMeta/ledare").get()).data()?.packs?.[packId]?.uids || [];

async function main() {
  if (process.argv.includes("--byt")) {
    await spela(LUDVIG, GEO, punkt(GEO, 20));
    console.log(`✓ ledarbyte: Sveriges geografi leds nu av ${(await ledare(GEO.id)).join(", ")}`);
    return;
  }
  await spela("elev1", GEO, punkt(GEO, 17));
  await spela("hr-elev10", GEO, punkt(GEO, 12));
  await stall("elev1", GEO.id, 30, 82);

  await spela("elev1", HUVUD, punkt(HUVUD, 16));
  await spela(SAGA, HUVUD, punkt(HUVUD, 16));
  await stall(SAGA, HUVUD.id, 62, 84);

  await spela("elev1", LANDER, omrade(LANDER, 18, 800));
  await stall("elev1", LANDER.id, 70, 82);
  await spela(MAJA, LANDER, omrade(LANDER, 20, 700));

  for (const p of [GEO, HUVUD, LANDER]) console.log(`✓ ${p.titel}: ledare ${(await ledare(p.id)).join(", ")}`);
  console.log("Klart: elev1 / lilla123 → Mitt hus. Kompis: #/elev/klasskamrat?id=hr-elev05 (Saga).");
}

main().then(() => app.delete()).catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
