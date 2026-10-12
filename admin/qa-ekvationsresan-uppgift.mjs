// ============================================================================
// QA (#620): lägg en BESTÄMD ekvation som elevens pågående uppgift – BARA mot
// Firebase-emulatorerna. Spec E1.14 test 1–7 och 9–11 kräver exakta ekvationer
// (2x + 4 = 14, 2x + 3 = 11, 5x + 13 = 48 …), som generatorn bara ger av slump.
// Uppgiften byggs som generatorns buildTask (samma fält, optimalt antal drag ur
// BFS:en, vågens visning över hela vägen). Nivå/fönster/statistik rörs inte,
// utom att --niva sätter nivån (uppgiften måste höra till elevens nivå).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8618 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9618 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-ekvationsresan-uppgift.mjs "2x+4=14" [--niva 3] [--elev elev1] [--typ A|B]
//
// Därefter: ladda om #/elev/ekvationsresan.
// ============================================================================
import admin from "firebase-admin";
import { parseEquation, solve, toJSON, equationKey } from "../src/ekvationsresan/equation.js";
import { rulesFor } from "../src/ekvationsresan/config.js";
import { optimalPath } from "../src/ekvationsresan/solver.js";
import { chooseView, statesAlong } from "../src/ekvationsresan/vag-visning.js";
import { equationRow } from "../src/ekvationsresan/notation.js";
import { normalizeProgress, withCurrent } from "../src/ekvationsresan/framsteg.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const text = args[0];
const uid = opt("--elev", "elev1");
const db = admin.firestore(admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }));

const ref = db.doc(`studentData/${uid}/ekvationsresa/progress`);
const progress = normalizeProgress((await ref.get()).data() || null);
const level = Number(opt("--niva", progress.level));
const equation = parseEquation(text);
const solution = solve(equation);
const best = optimalPath(equation, rulesFor(level));
if (!solution || !best) throw new Error(`${text}: ingen lösning inom spärrarna på nivå ${level}`);
const task = {
  schema: 1, level, form: "qa", type: opt("--typ", "A"),
  key: equationKey(equation), equation: toJSON(equation),
  text: equationRow(equation, "start").text,
  solution: { n: solution.n, d: solution.d },
  optimalMoves: best.moves, optimalPath: best.path,
  display: chooseView(statesAlong(equation, best.path, rulesFor(level))),
};
const now = Date.now();
const id = `qa${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const next = withCurrent({ ...progress, level, maxLevel: Math.max(progress.maxLevel || 1, level) }, task, { id, at: now });
await ref.set(next);
console.log(`✓ ${uid}: nivå ${level}, ${task.text} (optimalt ${task.optimalMoves}: ${task.optimalPath.map((m) => m.op + m.value).join(" ")}, visning ${task.display}, typ ${task.type})`);
process.exit(0);
