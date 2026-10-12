// ============================================================================
// QA-dump för egna Hitta rätt!-pack (#638) – BARA mot emulatorn, läser bara.
// ----------------------------------------------------------------------------
// Visar packen, katalogposten, topplistan, ledarna, bilderna och personbästa för
// valda elever. --packfil skriver packdokumentet som JSON (för
// qa-hitta-ratt-input.mjs --packfil, så att facit läses ur servern, inte sidan).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8648 node admin/qa-hitta-ratt-dump.mjs <packId> [uid …] [--packfil=/tmp/x.json]
// ============================================================================

import admin from "firebase-admin";
import { writeFileSync } from "node:fs";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const args = process.argv.slice(2);
const packfil = args.find((a) => a.startsWith("--packfil="))?.slice(10);
const [id, ...uids] = args.filter((a) => !a.startsWith("--"));
if (!id) { console.error("Ange packId."); process.exit(1); }

const [pack, katalog, board, ledare] = await Promise.all([
  db.doc(`hittaRattPacks/${id}`).get(),
  db.doc("hittaRattMeta/egnaPack").get(),
  db.doc(`hittaRattBoards/${id}`).get(),
  db.doc("hittaRattMeta/ledare").get(),
]);
const bilder = await db.collection("hittaRattBilder").where("packId", "==", id).select("ownerUid", "mime", "bredd", "hojd").get();
const p = pack.exists ? pack.data() : null;
const ut = {
  pack: p && {
    title: p.title, ownerUid: p.ownerUid, classIds: p.classIds, leaderboard: p.leaderboard, version: p.version,
    type: p.type, geo: p.geo,
    items: p.items.map((it) => ({ id: it.id, name: it.name, lat: it.lat, lon: it.lon, omrade: it.omrade, kalla: it.kalla,
      bild: it.bild && { id: it.bild.id, kalla: it.bild.kalla, licens: it.bild.licens, fotograf: it.bild.fotograf } })),
  },
  katalog: katalog.data()?.packs?.[id] ?? null,
  topplista: board.exists ? { v: board.data().v, antal: Object.keys(board.data().entries || {}).length, leaders: board.data().leaders } : null,
  ledare: ledare.data()?.packs?.[id] ?? null,
  bilder: bilder.docs.map((d) => ({ id: d.id, ...d.data() })),
  best: {},
};
for (const uid of uids) ut.best[uid] = (await db.doc(`hittaRattBest/${uid}`).get()).data()?.packs?.[id] ?? null;
console.log(JSON.stringify(ut, (k, v) => (v && v._seconds !== undefined ? new Date(v._seconds * 1000).toISOString() : v), 2));
if (packfil && p) { writeFileSync(packfil, JSON.stringify(p)); console.error(`✓ packen skriven till ${packfil}`); }
process.exit(0);
