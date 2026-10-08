// ============================================================================
// Slut-QA för Läsresan epic #482 (#515) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Verifierar docs/spec-lasresan-uppdatering.md avsnitt 5 end-to-end. Allt som
// skriver går via klient-SDK:n inloggad som läraren/eleven (reglerna gäller)
// och med SAMMA rena funktioner som appens brygga (data-lasresan.js,
// data-lasresan-niva.js): normalizeLasresa, withTeacherLevel, withStartedText,
// applyCompletion, buildAttempt, pickText. Admin-SDK:n används bara för seed
// av egna QA-elever och för att dumpa före/efter.
//
// Kör först admin/qa-lasresan-seed.mjs + admin/qa-lasresan-niva-seed.mjs (eller
// admin/qa-lasresan-482-preview.sh). Sektioner (default = alla):
//   bank         p1: varje nivå ≥ 40 giltiga texter, validateBank 0/0, facit
//                inom alternativen, pickText ger rätt nivå för varje nivå
//   enskild      p2: lärarens nivå → kvar efter "omladdning" (ny klient) →
//                nästa text från vald nivå; påbörjad text slutförs först
//   klass        p3: hela qa-klass-b (nivå 5/2/ej börjat) → 1; enskild ändras efteråt
//   startniva    p4: startnivå används för ej börjad + NY elev, inte för igång;
//                spec-exemplet startnivå 1 + alla till 1
//   bevarat      p5: dump av studentData + lasresaAttempts före/efter nivåbyte
//   progression  p6: 3 höga i rad → +1, 2 låga → −1, olästa texter först
//   behorighet   p7: elev kan inte ändra startnivå/annans nivå; ogiltig nivå nekas
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8515 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9515 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-lasresan-482-kontroll.mjs [sektion…]
//
// Skriptet seedar om sina egna elever (qa-482-*) varje körning, men ändrar
// även qa-pagaende och qa-klass-b – kör nivå-seeden igen för en ren preview.
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { normalizeLasresa, buildAttempt } from "../src/lasresan/progress.js";
import { withTeacherLevel, classStartLevelOf } from "../src/lasresan/level-control.js";
import { pickText } from "../src/lasresan/picker.js";
import { validateBank, validateText } from "../src/lasresan/content/validate.js";
import { coinsFor } from "../src/lasresan/rewards.js";
import {
  adb, BANK, som, larare, sattNiva, nastaText, svar, lasKlart, dump, lika, seedElev, igang,
} from "./qa-lasresan-482-app.mjs";

let fel = 0;
function kontroll(namn, ok, extra = "") {
  if (!ok) fel++;
  console.log(`  ${ok ? "✓" : "✗"} ${namn}${extra ? ` – ${extra}` : ""}`);
}
async function utfall(fn) {
  try { await fn(); return "ok"; } catch (e) { return e.code || String(e); }
}
const nekad = (r) => r === "permission-denied";

// --- Sektioner --------------------------------------------------------------------

async function bank() {
  console.log("\n[p1] bank: ≥ 40 kompletta texter per nivå");
  const r = validateBank(BANK);
  const errs = (r.errors || []).length, warns = (r.warnings || []).length;
  kontroll("validateBank över hela banken", errs === 0 && warns === 0, `${BANK.length} texter, ${errs} fel / ${warns} varningar`);
  for (let lvl = 1; lvl <= 7; lvl++) {
    const pool = BANK.filter((t) => t.level === lvl);
    const giltiga = pool.filter((t) => validateText(t).errors.length === 0);
    const facit = pool.every((t) => t.questions.every((q) => Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.options.length && q.options.length === 4));
    const valda = new Set();
    for (let i = 0; i < 200; i++) valda.add(pickText(lvl, [], BANK).level);
    kontroll(`nivå ${lvl}: ${giltiga.length}/${pool.length} giltiga, facit inom alternativen, pickText ger nivå ${[...valda]}`,
      giltiga.length >= 40 && facit && valda.size === 1 && valda.has(lvl));
  }
  kontroll("text-id unika", new Set(BANK.map((t) => t.id)).size === BANK.length);
  // Alla rätt → 100 %, alla fel → 0 % (rättningen följer facit).
  const t = BANK.find((x) => x.level === 6);
  const full = buildAttempt(t, svar(t, t.questions.length)), noll = buildAttempt(t, svar(t, 0));
  kontroll("rättning mot facit: alla rätt 100 %, alla fel 0 %", full.percentage === 100 && noll.percentage === 0 && full.earnedMoney === coinsFor(t.questions.length));
}

async function enskild() {
  console.log("\n[p2] enskild elev");
  await seedElev("qa-482-enskild", "Enskild Erik", "qa-klass", igang(3));
  await adb.doc("classes/qa-klass").update({ studentIds: admin.firestore.FieldValue.arrayUnion("qa-482-enskild") });
  const L = await larare();
  kontroll("läraren sätter nivå 6 (ingen påbörjad text) → gäller direkt", (await sattNiva(L.db, "qa-482-enskild", 6)) === "now");
  const L2 = await larare(); // "ladda om" = ny klient
  const efter = (await getDoc(doc(L2.db, "studentData", "qa-482-enskild"))).data().lasresa;
  kontroll("efter omladdning: nivå 6 kvar, levelSetBy teacher", efter.level === 6 && efter.levelSetBy === "teacher", `level=${efter.level}`);
  const E = await som("qa-482-enskild");
  const n = await nastaText(E.db, "qa-482-enskild");
  kontroll("elevens NÄSTA text kommer från nivå 6", n.text.level === 6, n.text.id);
  await lasKlart(E.db, "qa-482-enskild", n.text, 5);

  // Påbörjad text: qa-pagaende läser lr-n4-talangshowen.
  const fore = (await adb.doc("studentData/qa-pagaende").get()).data().lasresa;
  if (fore.currentTextId !== "lr-n4-talangshowen" || fore.level !== 4) {
    console.log("  (qa-pagaende är inte i seed-läget – kör admin/qa-lasresan-niva-seed.mjs först)");
  }
  kontroll("påbörjad text: nivå 1 sparas som väntande", (await sattNiva(L.db, "qa-pagaende", 1)) === "pending");
  const P = await som("qa-pagaende");
  const p1 = await nastaText(P.db, "qa-pagaende");
  kontroll("eleven får först den påbörjade nivå 4-texten", p1.resumed && p1.text.id === "lr-n4-talangshowen");
  const r = await lasKlart(P.db, "qa-pagaende", p1.text, p1.text.questions.length);
  kontroll("efter den: nivå 1, inget väntande, streaks 0 (trots 100 %)",
    r.lasresa.level === 1 && r.lasresa.pendingLevel === null && r.lasresa.highStreak === 0, `level=${r.lasresa.level}`);
  kontroll("försöket räknades på nivå 4", r.attempt.textLevel === 4);
  const p2 = await nastaText(P.db, "qa-pagaende");
  kontroll("NÄSTA text kommer från nivå 1", p2.text.level === 1, p2.text.id);
}

async function klass() {
  console.log("\n[p3] hela klassen (qa-klass-b)");
  const ids = (await adb.doc("classes/qa-klass-b").get()).data().studentIds;
  const fore = await Promise.all(ids.map(async (id) => ((await adb.doc(`studentData/${id}`).get()).data().lasresa || {}).level ?? "ej börjat"));
  console.log(`  före: ${ids.map((id, i) => `${id}=${fore[i]}`).join(", ")}`);
  const L = await larare();
  const res = await Promise.allSettled(ids.map((id) => sattNiva(L.db, id, 1)));
  kontroll(`alla ${ids.length} uppdaterade utan fel`, res.every((x) => x.status === "fulfilled"));
  const efter = await Promise.all(ids.map(async (id) => ((await adb.doc(`studentData/${id}`).get()).data().lasresa || {}).level));
  kontroll("alla på nivå 1 (även den som inte börjat)", efter.every((l) => l === 1), efter.join(","));
  for (const id of ids.slice(0, 2)) {
    const E = await som(id);
    const n = await nastaText(E.db, id);
    kontroll(`${id}: nästa text från nivå 1`, n.text.level === 1, n.text.id);
  }
  kontroll("enskild elev kan ändras efteråt (qa-b-bertil → 4)", (await sattNiva(L.db, "qa-b-bertil", 4)) === "pending"
    && ((await adb.doc("studentData/qa-b-bertil").get()).data().lasresa.pendingLevel === 4),
    "Bertil har en påbörjad text → väntande 4");
  const B = await som("qa-b-bertil");
  const b1 = await nastaText(B.db, "qa-b-bertil");
  await lasKlart(B.db, "qa-b-bertil", b1.text, 3);
  const b2 = await nastaText(B.db, "qa-b-bertil");
  kontroll("Bertils nästa text efter den påbörjade: nivå 4", b2.text.level === 4, b2.text.id);
}

async function startniva() {
  console.log("\n[p4] klassens startnivå (ny klass qa-482-kontroll)");
  await seedElev("qa-482-ejborjat", "Ejbörjat Edit", "qa-482-kontroll", null);
  await seedElev("qa-482-igang", "Igång Ivar", "qa-482-kontroll", igang(5));
  await adb.doc("classes/qa-482-kontroll").set({ name: "QA-klass 482 (kontroll)", order: 9, createdAt: 1, studentIds: ["qa-482-ejborjat", "qa-482-igang"] });
  await adb.doc("studentData/qa-482-ny").delete().catch(() => {});
  const L = await larare();
  await setDoc(doc(L.db, "classes", "qa-482-kontroll"), { lasresaStartLevel: 1 }, { merge: true });
  const L2 = await larare();
  kontroll("startnivå 1 sparad, kvar efter omladdning",
    classStartLevelOf((await getDoc(doc(L2.db, "classes", "qa-482-kontroll"))).data()) === 1);

  const E = await som("qa-482-ejborjat");
  const e1 = await nastaText(E.db, "qa-482-ejborjat");
  const eSparad = (await adb.doc("studentData/qa-482-ejborjat").get()).data().lasresa.level;
  kontroll("elev som INTE börjat: första texten från nivå 1, nivå 1 sparad", e1.text.level === 1 && eSparad === 1, e1.text.id);

  const I = await som("qa-482-igang");
  const i1 = await nastaText(I.db, "qa-482-igang");
  kontroll("elev som är IGÅNG påverkas inte (nivå 5)", i1.text.level === 5, i1.text.id);
  await lasKlart(I.db, "qa-482-igang", i1.text, 4);

  // NY elev läggs till i klassen efter att startnivån satts.
  await seedElev("qa-482-ny", "Ny Nisse", "qa-482-kontroll", null);
  await adb.doc("classes/qa-482-kontroll").update({ studentIds: admin.firestore.FieldValue.arrayUnion("qa-482-ny") });
  const N = await som("qa-482-ny");
  const n1 = await nastaText(N.db, "qa-482-ny");
  kontroll("NY elev i klassen: första texten från nivå 1", n1.text.level === 1, n1.text.id);

  // Spec-exemplet: startnivå 1 + alla nuvarande till nivå 1.
  const ids = (await adb.doc("classes/qa-482-kontroll").get()).data().studentIds;
  await Promise.all(ids.map((id) => sattNiva(L.db, id, 1)));
  const lv = await Promise.all(ids.map(async (id) => {
    const lr = (await adb.doc(`studentData/${id}`).get()).data().lasresa;
    return lr.currentTextId ? lr.pendingLevel ?? lr.level : lr.level;
  }));
  kontroll("exemplet: startnivå 1 + alla till 1 → alla (inkl. Ivar på 5) har nivå 1 (nu/väntande)", lv.every((l) => l === 1), lv.join(","));
  const i2 = await nastaText(I.db, "qa-482-igang");
  kontroll("Ivars nästa text: nivå 1", i2.text.level === 1, i2.text.id);
  kontroll("startnivån finns kvar (1)", (await adb.doc("classes/qa-482-kontroll").get()).data().lasresaStartLevel === 1);
}

async function bevarat() {
  console.log("\n[p5] resultat/belöningar kvar efter nivåbyte");
  await seedElev("qa-482-bevarat", "Bevarad Bea", "qa-klass", igang(4, { completedWorlds: ["skogen"], worldId: "oknen" }));
  await adb.doc("classes/qa-klass").update({ studentIds: admin.firestore.FieldValue.arrayUnion("qa-482-bevarat") });
  const E = await som("qa-482-bevarat");
  for (let i = 0; i < 2; i++) { const t = await nastaText(E.db, "qa-482-bevarat"); await lasKlart(E.db, "qa-482-bevarat", t.text, 4); }
  const t3 = await nastaText(E.db, "qa-482-bevarat"); // påbörjad
  const L = await larare();
  for (const [lvl, vag] of [[7, "enskild (påbörjad → väntande)"], [2, "hela klassen-vägen"]]) {
    const fore = await dump("qa-482-bevarat");
    await sattNiva(L.db, "qa-482-bevarat", lvl);
    const efter = await dump("qa-482-bevarat");
    kontroll(`${vag} → ${lvl}: studentData (coins, ägda saker, …) oförändrat`, lika(fore.rest, efter.rest), `coins=${efter.rest.coins}`);
    kontroll(`${vag} → ${lvl}: lasresa utom nivåfälten oförändrad (texter, totaler, moneyEarned, världar, catStats)`,
      lika(fore.lasresa, efter.lasresa), `totalTexts=${efter.lasresa.totalTexts} moneyEarned=${efter.lasresa.moneyEarned}`);
    kontroll(`${vag} → ${lvl}: lasresaAttempts oförändrade (${efter.attempts.length} st)`, lika(fore.attempts, efter.attempts));
  }
  const fore = await dump("qa-482-bevarat");
  const r = await lasKlart(E.db, "qa-482-bevarat", t3.text, 5);
  const efter = await dump("qa-482-bevarat");
  kontroll("efter nästa text räknas allt vidare (totaler +1, moneyEarned och coins ökar, försök +1)",
    efter.lasresa.totalTexts === fore.lasresa.totalTexts + 1 && efter.lasresa.moneyEarned === fore.lasresa.moneyEarned + r.attempt.earnedMoney
    && efter.rest.coins === fore.rest.coins + r.attempt.earnedMoney && efter.attempts.length === fore.attempts.length + 1
    && lika(efter.rest.ownedItems, fore.rest.ownedItems),
    `totalTexts ${fore.lasresa.totalTexts}→${efter.lasresa.totalTexts}, coins ${fore.rest.coins}→${efter.rest.coins}`);
  kontroll("väntande nivå 2 gäller efter texten", r.lasresa.level === 2);
}

async function progression() {
  console.log("\n[p6] automatisk progression från lärarens nivå");
  await seedElev("qa-482-prog", "Progress Per", "qa-klass", igang(5));
  await adb.doc("classes/qa-klass").update({ studentIds: admin.firestore.FieldValue.arrayUnion("qa-482-prog") });
  const L = await larare();
  await sattNiva(L.db, "qa-482-prog", 2);
  const E = await som("qa-482-prog");
  const lasta = [];
  const kor = async (andel) => {
    const n = await nastaText(E.db, "qa-482-prog");
    kontroll(`  text ${lasta.length + 1} (nivå ${n.text.level}) är oläst`, !lasta.includes(n.text.id) && !n.lr.seenTextIds.includes(n.text.id), n.text.id);
    lasta.push(n.text.id);
    return (await lasKlart(E.db, "qa-482-prog", n.text, Math.ceil(n.text.questions.length * andel))).lasresa;
  };
  let lr;
  for (let i = 0; i < 2; i++) { lr = await kor(1); }
  kontroll("2 höga på nivå 2 → fortfarande nivå 2", lr.level === 2 && lr.highStreak === 2);
  lr = await kor(1);
  kontroll("3:e höga i rad → nivå 3", lr.level === 3 && lr.highStreak === 0);
  const n3 = await nastaText(E.db, "qa-482-prog");
  kontroll("nästa text från nivå 3", n3.text.level === 3, n3.text.id);
  lr = (await lasKlart(E.db, "qa-482-prog", n3.text, 0)).lasresa;
  kontroll("1 låg → kvar på 3", lr.level === 3 && lr.lowStreak === 1);
  lr = await kor(0);
  kontroll("2:a låga i rad → nivå 2", lr.level === 2);
  // Olästa först: markera alla nivå 2-texter utom en som lästa → den väljs.
  const n2 = BANK.filter((t) => t.level === 2);
  const kvar = n2.find((t) => !lasta.includes(t.id));
  const seen = n2.filter((t) => t !== kvar).map((t) => t.id);
  kontroll("pickText väljer den enda olästa nivå 2-texten (100 försök)",
    Array.from({ length: 100 }, () => pickText(2, seen, BANK).id).every((id) => id === kvar.id), kvar.id);
}

async function behorighet() {
  console.log("\n[p7] behörighet (råa skrivningar som eleven/läraren)");
  const E = await som("qa-mitt");
  kontroll("elev kan INTE sätta klassens startnivå", nekad(await utfall(() => setDoc(doc(E.db, "classes", "qa-klass"), { lasresaStartLevel: 1 }, { merge: true }))));
  kontroll("elev kan INTE ändra en annan elevs nivå", nekad(await utfall(() => updateDoc(doc(E.db, "studentData", "qa-hog"), { "lasresa.level": 7 }))));
  kontroll("elev kan INTE ta bort klassens startnivå", nekad(await utfall(() => updateDoc(doc(E.db, "classes", "qa-482-kontroll"), { lasresaStartLevel: deleteField() }))));
  const L = await larare();
  kontroll("lärare: startnivå 8 nekas", nekad(await utfall(() => setDoc(doc(L.db, "classes", "qa-klass"), { lasresaStartLevel: 8 }, { merge: true }))));
  kontroll("lärare: startnivå \"3\" (sträng) nekas", nekad(await utfall(() => setDoc(doc(L.db, "classes", "qa-klass"), { lasresaStartLevel: "3" }, { merge: true }))));
  kontroll("lärare: startnivå 3 tillåts", (await utfall(() => setDoc(doc(L.db, "classes", "qa-klass"), { lasresaStartLevel: 3 }, { merge: true }))) === "ok");
  await updateDoc(doc(L.db, "classes", "qa-klass"), { lasresaStartLevel: deleteField() });
  let kastar = 0;
  for (const v of [0, 8, 3.5, "abc", null]) { try { withTeacherLevel(normalizeLasresa(null), v); } catch { kastar++; } }
  kontroll("bryggan vägrar ogiltig elevnivå (0, 8, 3.5, \"abc\", null)", kastar === 5);
}

const SEKTIONER = { bank, enskild, klass, startniva, bevarat, progression, behorighet };
const valda = process.argv.slice(2).filter((a) => a !== "alla");
for (const namn of valda.length ? valda : Object.keys(SEKTIONER)) {
  if (!SEKTIONER[namn]) { console.error(`okänd sektion: ${namn}`); process.exit(2); }
  await SEKTIONER[namn]();
}
console.log(fel ? `\n✗ ${fel} kontroll(er) röda` : "\n✓ alla kontroller gröna");
process.exit(fel ? 1 : 0);
