// ============================================================================
// QA-seed för Stjärnor & kategoristatistik (#448, epic #444) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Lösenord för alla: lilla123 (endast emulator).
//
//   Lärare   qalarare                       (teacher-claim)
//   Klass    qa-kat "QA-klass 5B"
//     kat-ny      Nina   – färsk elev, spelar det NYA (wizard-skapade) området
//     kat-gammal  Gustav – GAMMAL progress på vikingatiden (utan cat, utan plays)
//     kat-mix     Mira   – gammal progress + redan cat på ett läge + reading-nod
//     kat-ingen   Ivar   – har aldrig spelat
//     kat-eko     Ebbe   – ekonomi-jämförelse main ↔ epic (återställs per körning)
//
// Områden: so/vikingatiden = GAMMALT område UTAN kategorier (seed-data.js).
// Det NYA området skapas av läraren i wizarden (klistra in qa-kategori-omrade.json).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8448 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9448 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-kategori-seed.mjs [eko]
//
// `eko` återställer bara kat-eko (ekonomitestet), `omraden` bara områdena. Idempotent.
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { subjects, areas } from "../seed/seed-data.js";
import { validateArea } from "../src/validate.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;

const PW = "lilla123"; // endast emulator
const CLASS_ID = "qa-kat";
const DAG = 24 * 3600 * 1000;
const ts = (dagarSedan) => Timestamp.fromMillis(Date.now() - dagarSedan * DAG);

const ELEVER = [
  { uid: "kat-ny", namn: "Nina", avatarId: "fox", data: { coins: 100, xp: 0 } },
  {
    // Gammal data: före #445 fanns varken cat eller plays.
    uid: "kat-gammal", namn: "Gustav", avatarId: "owl",
    data: {
      coins: 250, xp: 140,
      progress: {
        vikingatiden: {
          quiz: { completed: true, bestScore: 4, stars: 2, lastPlayed: ts(30) },
          para: { completed: true, bestScore: 6, stars: 3, lastPlayed: ts(29) },
          lasforstaelse: { completed: true, bestScore: 3, stars: 1, plays: 2, lastPlayed: ts(28) },
        },
      },
    },
  },
  {
    uid: "kat-mix", namn: "Mira", avatarId: "cat",
    data: {
      coins: 80, xp: 60,
      progress: {
        vikingatiden: {
          quiz: { completed: true, bestScore: 3, stars: 1, plays: 1, lastPlayed: ts(10) },
          reading: { "vem-var-vikingarna": { read: true } },
        },
      },
    },
  },
  { uid: "kat-ingen", namn: "Ivar", avatarId: "dog", data: { coins: 0, xp: 0 } },
  { uid: "kat-eko", namn: "Ebbe", avatarId: "panda", data: { coins: 100, xp: 0 } },
];

async function ensureUser(uid, email, claims) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

async function seedStudent(s) {
  await ensureUser(s.uid, `${s.uid}@elev.pluggportalen.local`);
  await db.doc(`students/${s.uid}`).set({ namn: s.namn, username: s.uid, avatarId: s.avatarId, classIds: [CLASS_ID] });
  await db.doc(`studentData/${s.uid}`).set({ progress: {}, avatarId: s.avatarId, ...s.data });
  console.log(`✓ ${s.uid} (${s.namn})`);
}

async function main() {
  if (process.argv[2] === "eko") {
    await seedStudent(ELEVER.find((s) => s.uid === "kat-eko"));
    return;
  }
  if (process.argv[2] === "omraden") return seedAreas();
  for (const s of subjects) {
    const { id, ...rest } = s;
    await db.doc(`subjects/${id}`).set(rest, { merge: true });
  }
  await seedAreas();
  await ensureUser("qalarare", "qalarare@larare.pluggportalen.local", { teacher: true });
  for (const s of ELEVER) await seedStudent(s);
  await db.doc(`classes/${CLASS_ID}`).set({
    name: "QA-klass 5B", order: 1, createdAt: Date.now(), studentIds: ELEVER.map((s) => s.uid),
  });
  console.log(`✓ klass ${CLASS_ID}, lärare qalarare/${PW}`);
}

async function seedAreas() {
  const vik = areas.so.find((a) => a.id === "vikingatiden");
  const { id: vid, ...vrest } = vik;
  await db.doc(`subjects/so/areas/${vid}`).set(vrest); // gammalt område, inga category-fält
  console.log("✓ so/vikingatiden (utan kategorier)");
  // Regression: bildpar (partisymboler) + räkna-generator (gammalt område, inga kategorier).
  const bild = validateArea({
    name: "QA Bildpar", order: 9, coverEmoji: "🗳️", description: "Bildpar-regression (#448).",
    pairs: ["s", "m", "v", "c"].map((l) => ({ id: `b${l}`, term: "", termImage: `partier/${l}`, definition: `Parti ${l.toUpperCase()}` })),
  });
  if (!bild.ok) throw new Error(bild.errors.join("; "));
  const { id: _bid, ...bildValue } = bild.value;
  await db.doc("subjects/so/areas/qa-bildpar").set(bildValue);
  await db.doc("subjects/matte/areas/qa-rakna").set({
    name: "QA Räkna", order: 9, coverEmoji: "➗", description: "Räkna-regression (#448).", texts: [], quiz: [], pairs: [],
    exerciseTypes: ["generator"], generator: { topic: "addition", variants: ["enkel"] },
  });
  console.log("✓ so/qa-bildpar, matte/qa-rakna");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
