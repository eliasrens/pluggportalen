// ============================================================================
// Slut-QA Läsresan 7 världar (#668): bevarade framsteg + nya texter i flödet.
// ----------------------------------------------------------------------------
// BARA emulatorn. Körs efter admin/qa-lasresan-varldar-seed.mjs (elever byggda
// av den GAMLA klienten). Läser och skriver som eleven via klient-SDK:t (reglerna
// gäller) med appens dataväg (admin/qa-lasresan-482-app.mjs):
//   1. Läsning ändrar ingenting och ger samma worldId/steg/nivå/statistik/
//      belöningar som lagrat (Öknen klar → Havet steg 0).
//   2. En text till: allt räknas vidare, gamla försök och mynt orörda,
//      Öknen klar → Havet steg 1.
//   3. Gammal cachad klient efter att nya klienten skrivit Havet.
//   4. Lärarvyns rader (teacherClassRows) för klassen.
//   5. Nya texter dras: picker över hela banken + vilka texter eleverna fick.
// Muterar data – seeda om före en ny körning.
//   OLD_SRC=/tmp/q668-gammal/src FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… \
//     node admin/qa-lasresan-varldar-kontroll.mjs
// ============================================================================
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { doc, getDoc, setLogLevel } from "firebase/firestore";
import { adb, BANK, som, larare, lasresaFor, nastaText, lasKlart, lika } from "./qa-lasresan-482-app.mjs";
import { normalizeLasresa } from "../src/lasresan/progress.js";
import { teacherClassRows } from "../src/lasresan/teacher-rows.js";
import { pickText } from "../src/lasresan/picker.js";
import { coinsFor } from "../src/lasresan/rewards.js";
import { WORLDS } from "../src/lasresan/worlds/index.js";

setLogLevel("silent");
const OLD = process.env.OLD_SRC || "/tmp/q668-gammal/src";
let fel = 0;
const kontroll = (namn, ok, extra = "") => {
  if (!ok) fel++;
  console.log(`  ${ok ? "✓" : "✗"} ${namn}${extra ? ` – ${extra}` : ""}`);
};
const lagrat = async (uid) => {
  const sd = (await adb.doc(`studentData/${uid}`).get()).data();
  const at = await adb.collection(`studentData/${uid}/lasresaAttempts`).get();
  return { sd, attempts: at.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? -1 : 1)) };
};
const STAT = ["totalTexts", "totalQuestions", "totalCorrect", "totalIncorrect", "moneyEarned", "highStreak", "lowStreak"];
const BANK_DIR = new URL("../src/lasresan/content/bank/", import.meta.url);
const isNew = new Set(readdirSync(BANK_DIR).filter((f) => f.endsWith("-b.json"))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, BANK_DIR), "utf8")).map((t) => t.id)));

console.log("Världsordning:", WORLDS.map((w) => `${w.order}.${w.name}(${w.steps})`).join(" → "));
kontroll("7 världar i rätt ordning", WORLDS.map((w) => w.id).join(",") === "skogen,oknen,havet,djungeln,bergen,vulkanlandet,manen");
kontroll("unlockAfter-kedja", WORLDS.every((w, i) => (i === 0 ? w.unlockAfter == null : w.unlockAfter === WORLDS[i - 1].id)));
kontroll("20 steg var", WORLDS.every((w) => w.steps === 20 && w.stepPositions.length === 20));

const FALL = [
  { uid: "qa-v-skog", vantat: (lr) => ({ worldId: lr.worldId, stepInWorld: lr.stepInWorld }) },
  { uid: "qa-v-okn", vantat: (lr) => ({ worldId: lr.worldId, stepInWorld: lr.stepInWorld }) },
  { uid: "qa-v-klar", vantat: () => ({ worldId: "havet", stepInWorld: 0 }) },
  { uid: "qa-v-extra", vantat: () => ({ worldId: "havet", stepInWorld: 0 }) },
];

const drogs = [];
for (const f of FALL) {
  const fore = await lagrat(f.uid);
  const s = fore.sd.lasresa;
  console.log(`\n${f.uid}: lagrat ${s.worldId} steg ${s.stepInWorld}, klara [${s.completedWorlds}], nivå ${s.level10}, ${s.totalTexts} texter, ${s.moneyEarned} kr intjänat, saldo ${fore.sd.coins}`);
  const { db, uid } = await som(f.uid);
  // 1. Läsa (getLasresa) – ny klient.
  const lr = await lasresaFor(db, uid);
  const v = f.vantat(s);
  kontroll("worldId/steg", lr.worldId === v.worldId && lr.stepInWorld === v.stepInWorld, `${lr.worldId} steg ${lr.stepInWorld}`);
  kontroll("completedWorlds oförändrat", lika(lr.completedWorlds, s.completedWorlds));
  kontroll("nivå oförändrad", lr.level === s.level10, `nivå ${lr.level}`);
  kontroll("statistik oförändrad", STAT.every((k) => lr[k] === s[k]));
  kontroll("catStats + seenTextIds + lastTextId oförändrade", lika(lr.catStats, s.catStats) && lika(lr.seenTextIds, s.seenTextIds) && lr.lastTextId === s.lastTextId);
  kontroll("läsning skrev ingenting", lika(await lagrat(f.uid), fore));
  // 2. En text till (allt rätt).
  const { text } = await nastaText(db, uid);
  const res = await lasKlart(db, uid, text, text.questions.length);
  const efter = await lagrat(f.uid);
  const e = normalizeLasresa(efter.sd.lasresa, WORLDS);
  drogs.push({ uid, level: lr.level, id: text.id, ny: isNew.has(text.id) });
  console.log(`  · läste ${text.id} (nivå ${text.level}${isNew.has(text.id) ? ", NY -b-text" : ""}), ${text.questions.length}/${text.questions.length} rätt`);
  const vantatSteg = v.stepInWorld + 1;
  kontroll("ett steg framåt i rätt värld", e.worldId === v.worldId && e.stepInWorld === vantatSteg, `${e.worldId} steg ${e.stepInWorld}`);
  kontroll("statistik räknas vidare", e.totalTexts === s.totalTexts + 1 && e.totalQuestions === s.totalQuestions + text.questions.length
    && e.totalCorrect === s.totalCorrect + text.questions.length && e.totalIncorrect === s.totalIncorrect);
  kontroll("belöning: moneyEarned + saldo", e.moneyEarned === s.moneyEarned + coinsFor(text.questions.length)
    && efter.sd.coins === fore.sd.coins + coinsFor(text.questions.length), `saldo ${fore.sd.coins} → ${efter.sd.coins}`);
  kontroll("gamla försök orörda (+1 nytt)", efter.attempts.length === fore.attempts.length + 1
    && fore.attempts.every((a) => lika(a, efter.attempts.find((b) => b.id === a.id))));
  kontroll("completedWorlds kvar, övriga fält kvar", lika(e.completedWorlds, s.completedWorlds) && lika(efter.sd.ownedItems, fore.sd.ownedItems));
  kontroll("nivå enligt reglerna (inte nollställd)", Math.abs(e.level - lr.level) <= 1, `${lr.level} → ${e.level}`);
  kontroll("ok från transaktionen", res.ok);
}

// 3. Gammal cachad klient (före epicen) läser eleven som nya klienten flyttat till Havet.
console.log("\nGammal cachad klient efter Havet-skrivning (qa-v-klar):");
const g = await import(pathToFileURL(`${OLD}/lasresan/progress.js`).href);
const gW = (await import(pathToFileURL(`${OLD}/lasresan/worlds/index.js`).href)).WORLDS;
const nu = (await adb.doc("studentData/qa-v-klar").get()).data().lasresa;
const gl = g.normalizeLasresa(nu, gW);
console.log(`  · gammal klient ser ${gl.worldId} steg ${gl.stepInWorld} (lagrat ${nu.worldId} steg ${nu.stepInWorld})`);
const gNext = g.applyCompletion(gl, { textId: "x", correct: 5, incorrect: 0, totalQuestions: 5, earnedMoney: 15, perCategory: {} }, gW).lasresa;
const tillbaka = normalizeLasresa({ ...nu, ...gNext }, WORLDS);
console.log(`  · om gamla klienten sparar en text: ${gNext.worldId} steg ${gNext.stepInWorld} → ny klient läser ${tillbaka.worldId} steg ${tillbaka.stepInWorld}`);
kontroll("gammal klient: nivå/statistik bevaras", gNext.totalTexts === nu.totalTexts + 1 && lika(gNext.completedWorlds, nu.completedWorlds));

// 4. Lärarvyn (data-lasresan.getClassLasresa → teacherClassRows) som läraren.
console.log("\nLärarvyn, QA-klass Världar:");
const { db: ldb } = await larare();
const klass = (await getDoc(doc(ldb, "classes", "qa-v-klass"))).data();
const entries = [];
for (const id of klass.studentIds) {
  const st = (await getDoc(doc(ldb, "students", id))).data();
  const sd = (await getDoc(doc(ldb, "studentData", id))).data();
  entries.push({ studentId: id, namn: st.namn, lasresa: (sd && sd.lasresa) || null });
}
const rows = teacherClassRows(entries, WORLDS, {});
for (const r of rows) console.log(`  · ${r.namn.padEnd(22)} nivå ${String(r.level).padStart(2)}  ${String(r.worldName).padEnd(13)} steg ${r.stepInWorld}/${r.steps}  texter ${r.texts}  ${r.pct ?? "–"}%`);
const rad = (id) => rows.find((r) => r.studentId === id);
kontroll("Klar-Klara visas i Havet", rad("qa-v-klar").worldName === "Havet");
kontroll("varje ny värld har ett riktigt namn i lärarvyn", ["havet", "djungeln", "bergen", "vulkanlandet", "manen"].every((w) => rows.some((r) => r.worldId === w && r.worldName === WORLDS.find((x) => x.id === w).name)));

// 5. Nya texter dras.
console.log("\nNya texter i läsflödet:");
for (let lvl = 1; lvl <= 7; lvl++) {
  const pool = BANK.filter((t) => t.level === lvl);
  const nya = pool.filter((t) => isNew.has(t.id)).length;
  let first = 0;
  for (let i = 0; i < 2000; i++) if (isNew.has(pickText(lvl, [], BANK).id)) first++;
  const seen = [];
  for (let i = 0; i < pool.length; i++) seen.push(pickText(lvl, seen, BANK).id);
  const allaNya = pool.filter((t) => isNew.has(t.id)).every((t) => seen.includes(t.id));
  kontroll(`nivå ${lvl}: ${pool.length} texter (${nya} nya), första valet ny i ${Math.round(first / 20)} %, alla nya dras inom ${pool.length} texter`, allaNya && Math.abs(first / 2000 - nya / pool.length) < 0.06);
}
for (const d of drogs) console.log(`  · ${d.uid} (nivå ${d.level}) fick ${d.id}${d.ny ? " – NY" : ""}`);

console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} FEL`}`);
process.exit(fel ? 1 : 0);
