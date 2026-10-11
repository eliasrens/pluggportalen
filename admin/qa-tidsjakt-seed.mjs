// ============================================================================
// QA-seed för Tidsjakten (#599, epic #595) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Lösenord: lilla123 (endast emulator).
//   Elev   tj-elev  Tilda   (klass qa-tj)       Lärare qalarare (teacher-claim)
//   Områden:
//     so/vasatiden    Vasatiden-fixturen (test/fixtures/vasatiden-tidsjakt.js)
//                     + 6 vanliga quizfrågor → Quiz blandar in tidslinjefrågor
//     so/vikingatiden gammalt område UTAN tidslinje (seed-data.js) – regression
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8599 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9599 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-tidsjakt-seed.mjs
//
// Idempotent; nollställer elevens progress. Vägrar köra utan emulator-variablerna.
// ============================================================================
import admin from "firebase-admin";
import { subjects, areas } from "../seed/seed-data.js";
import { parseAndValidateArea } from "../src/validate.js";
import { VASATIDEN_JSON } from "../test/fixtures/vasatiden-tidsjakt.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const PW = "lilla123"; // endast emulator
const CLASS_ID = "qa-tj";

const EXTRA_QUIZ = [
  ["Vilket land styrde Sverige före Gustav Vasa?", ["Danmark", "Norge", "Finland", "Tyskland"], "Under Kalmarunionen styrdes Sverige av den danske kungen."],
  ["I vilket landskap samlade Gustav Vasa bönder till uppror?", ["Dalarna", "Skåne", "Gotland", "Lappland"], "Gustav Vasa fick hjälp av dalkarlarna."],
  ["Vad hette Gustav Vasas son som blev kung efter honom?", ["Erik XIV", "Karl XII", "Gustav II Adolf", "Kristian II"], "Erik XIV blev kung efter sin far."],
  ["Vad tog kungen från kyrkan under reformationen?", ["Pengar och mark", "Kyrkklockor", "Präster", "Böcker"], "Kungen tog kyrkans rikedomar."],
  ["Vilket språk började gudstjänsterna hållas på?", ["Svenska", "Latin", "Danska", "Tyska"], "Gudstjänsterna började hållas på svenska."],
  ["Vad betyder arvrike?", ["Kungens barn ärver kronan", "Bönderna väljer kung", "Kyrkan väljer kung", "Danmark väljer kung"], "I ett arvrike ärver kungens barn kronan."],
].map(([question, options, explanation], i) => ({ id: `x${i + 1}`, question, options, answerIndex: 0, explanation, category: "fakta" }));

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

async function main() {
  for (const s of subjects) {
    const { id, ...rest } = s;
    await db.doc(`subjects/${id}`).set(rest, { merge: true });
  }
  const vasa = JSON.parse(VASATIDEN_JSON);
  vasa.quiz = [...vasa.quiz, ...EXTRA_QUIZ];
  const res = parseAndValidateArea(JSON.stringify(vasa));
  if (!res.ok) throw new Error(res.errors.join("; "));
  const { id: _vid, ...vasaValue } = res.value;
  await db.doc("subjects/so/areas/vasatiden").set(vasaValue);
  const vik = areas.so.find((a) => a.id === "vikingatiden");
  const { id: _kid, ...vikValue } = vik;
  await db.doc("subjects/so/areas/vikingatiden").set(vikValue);
  console.log(`✓ so/vasatiden (${vasaValue.quiz.length} quiz, ${vasaValue.timeline.length} händelser), so/vikingatiden`);

  await ensureUser("qalarare", "qalarare@larare.pluggportalen.local", { teacher: true });
  await ensureUser("tj-elev", "tj-elev@elev.pluggportalen.local");
  await db.doc("students/tj-elev").set({ namn: "Tilda", username: "tj-elev", avatarId: "fox", classIds: [CLASS_ID] });
  await db.doc("studentData/tj-elev").set({ progress: {}, avatarId: "fox", coins: 100, xp: 0 });
  await db.doc(`classes/${CLASS_ID}`).set({ name: "QA-klass Tidsjakt", order: 1, createdAt: Date.now(), studentIds: ["tj-elev"] });
  console.log(`✓ klass ${CLASS_ID}, elev tj-elev / lärare qalarare (${PW})`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
