// ============================================================================
// Slut-QA Läsresan 10 nivåer (#525): gammal cachad klient mot ny data – BARA emulatorn.
// ----------------------------------------------------------------------------
// En klient som laddat JS före epic #516 (Pages cachar ~10 min, en flik kan stå
// öppen i timmar) har LEVEL_MAX 7 och skriver normaliserat lasresa-objekt rakt
// av. Här körs den GAMLA koden (#482-grenen, utpackad i GAMMAL_KOD, default
// /tmp/q525-gammal) mot data som den nya klienten skrivit, och den nya klienten
// läser resultatet. Beslutet bakom: docs/LASRESAN.md "Nivåskala 1–10" (#519).
//   mkdir -p /tmp/q525-gammal && git archive <#482-rev> src | tar -x -C /tmp/q525-gammal
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import admin from "firebase-admin";
import { collection, doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { classStartLevelOf } from "../src/lasresan/level-control.js";
import { classStartLevelFields } from "../src/lasresan/level-scale.js";
import { adb, BANK, som, larare, sattNiva, nastaText, svar, lasresaFor, seedElev } from "./qa-lasresan-482-app.mjs";
import { kontroll, forstaPa, lagrat, forsok, seedKlass } from "./qa-lasresan-10-app.mjs";

// --- gammal cachad klient ---------------------------------------------------------------
export async function gammalklient() {
  console.log("\n[B-beslut] gammal cachad klient (LEVEL_MAX 7) mot ny data");
  const dir = process.env.GAMMAL_KOD || "/tmp/q525-gammal";
  if (!existsSync(`${dir}/src/lasresan/progress.js`)) {
    kontroll(`gammal kod finns i ${dir} (se huvudet)`, false);
    return;
  }
  const G = await import(pathToFileURL(`${dir}/src/lasresan/progress.js`).href);
  const GC = await import(pathToFileURL(`${dir}/src/lasresan/level-control.js`).href);
  const GCONF = await import(pathToFileURL(`${dir}/src/lasresan/config.js`).href);
  const GLOAD = await import(pathToFileURL(`${dir}/src/lasresan/content/loader.js`).href);
  const GW = await import(pathToFileURL(`${dir}/src/lasresan/worlds/index.js`).href);
  kontroll("gamla koden har LEVEL_MAX 7, START_LEVEL 3", GCONF.LEVEL_MAX === 7 && GCONF.START_LEVEL === 3);

  // Den gamla klientens bryggor: läs → gammal normalizeLasresa → skriv objektet rakt av.
  const ref = (db, uid) => doc(db, "studentData", uid);
  const gammalStart = (db, uid, textId) => runTransaction(db, async (tx) => {
    const cur = G.normalizeLasresa((await tx.get(ref(db, uid))).data().lasresa, GW.WORLDS);
    const out = G.withStartedText(cur, textId, Date.now());
    if (!out.resumed) tx.update(ref(db, uid), { lasresa: out.lasresa });
  });
  const gammalKlar = (db, uid, text, ratt) => runTransaction(db, async (tx) => {
    const cur = G.normalizeLasresa((await tx.get(ref(db, uid))).data().lasresa, GW.WORLDS);
    const attempt = G.buildAttempt(text, svar(text, ratt), { startedAt: cur.currentStartedAt, completedAt: Date.now(), studentId: uid });
    const { lasresa } = G.applyCompletion(cur, attempt, GW.WORLDS, Date.now());
    tx.set(doc(collection(ref(db, uid), "lasresaAttempts")), attempt);
    tx.update(ref(db, uid), { lasresa });
    return { attempt, lasresa };
  });
  const gammalLarare = (db, uid, level) => runTransaction(db, async (tx) => {
    const cur = G.normalizeLasresa((await tx.get(ref(db, uid))).data().lasresa, GW.WORLDS);
    tx.update(ref(db, uid), { lasresa: GC.withTeacherLevel(cur, level, Date.now()).lasresa });
  });
  const nyNiva = async (uid) => (await lasresaFor((await som(uid)).db, uid)).level;
  const L = await larare();

  // a) Ny nivå 9 (spegel 6): gammal klient läser en text utan nivåbyte.
  await seedElev("qa-525-o9", "Gammal klient 9", "ingen-klass", null);
  await sattNiva(L.db, "qa-525-o9", 9);
  const E9 = await som("qa-525-o9");
  const gl = G.normalizeLasresa((await getDoc(ref(E9.db, "qa-525-o9"))).data().lasresa, GW.WORLDS);
  kontroll("a) gammal klient ser spegeln 6 (giltig på dess skala), level10 följer med", gl.level === 6 && gl.level10 === 9);
  const t6 = forstaPa(6);
  await gammalStart(E9.db, "qa-525-o9", t6.id);
  const ra = await gammalKlar(E9.db, "qa-525-o9", t6, t6.questions.length);
  const sa = (await lagrat("qa-525-o9")).sd.lasresa;
  kontroll("a) efter gammal skrivning: level10 9 kvar, spegel 6 → ny klient läser 9", sa.level10 === 9 && sa.level === 6 && (await nyNiva("qa-525-o9")) === 9);
  const fa = (await forsok(E9.db, "qa-525-o9"))[0];
  kontroll("a) gammalt försök (utan levelScale) får rätt nivå via text-id", ra.attempt.levelScale === undefined && fa.textLevel === 6, `textLevel lagrat ${ra.attempt.textLevel}, normaliserat ${fa.textLevel}`);

  // b) Gammal klients progression 6 → 7 (= 10).
  for (let i = 0; i < 2; i++) {
    const t = BANK.filter((x) => x.level === 6)[i + 1];
    await gammalStart(E9.db, "qa-525-o9", t.id);
    await gammalKlar(E9.db, "qa-525-o9", t, t.questions.length);
  }
  const sb = (await lagrat("qa-525-o9")).sd.lasresa;
  kontroll("b) 3 höga i gammal klient: spegel 6 → 7, ny klient läser 10 (9 + 1)", sb.level === 7 && (await nyNiva("qa-525-o9")) === 10, `level=${sb.level} level10=${sb.level10}`);
  // Ny klient skriver igen → båda fälten i takt.
  const nb = await nastaText((await som("qa-525-o9")).db, "qa-525-o9");
  const sb2 = (await lagrat("qa-525-o9")).sd.lasresa;
  kontroll("b) nästa skrivning från ny klient: level10 10 + spegel 7, text nivå 10", sb2.level10 === 10 && sb2.level === 7 && nb.text.level === 10);

  // c) Ny nivå 10 – gammal klient klampar inte bort den (7 = tak på dess skala).
  await seedElev("qa-525-o10", "Gammal klient 10", "ingen-klass", null);
  await sattNiva(L.db, "qa-525-o10", 10);
  const E10 = await som("qa-525-o10");
  const t7 = forstaPa(7);
  for (let i = 0; i < 3; i++) {
    const t = BANK.filter((x) => x.level === 7)[i];
    await gammalStart(E10.db, "qa-525-o10", t.id);
    await gammalKlar(E10.db, "qa-525-o10", t, t.questions.length);
  }
  kontroll("c) nivå 10 + 3 höga i gammal klient → fortfarande 10", (await nyNiva("qa-525-o10")) === 10, t7.id);

  // d) Gammal lärarvy sätter nivå 7 på elev med ny nivå 5 → 10; nivå 1 → 4.
  await seedElev("qa-525-od", "Gammal lärarvy", "ingen-klass", null);
  await sattNiva(L.db, "qa-525-od", 5);
  await gammalLarare(L.db, "qa-525-od", 7);
  kontroll("d) gammal lärarvy sätter 7 → ny klient läser 10", (await nyNiva("qa-525-od")) === 10);
  await gammalLarare(L.db, "qa-525-od", 1);
  kontroll("d) gammal lärarvy sätter 1 → ny klient läser 4", (await nyNiva("qa-525-od")) === 4);

  // e) Ny väntande nivå 2 (spegel 1) förbrukas av gammal klient → 2 (inte 4).
  await seedElev("qa-525-oe", "Väntande gammal", "ingen-klass", null);
  await sattNiva(L.db, "qa-525-oe", 8);
  const Ee = await som("qa-525-oe");
  const ne = await nastaText(Ee.db, "qa-525-oe");
  await sattNiva(L.db, "qa-525-oe", 2); // påbörjad text → väntande
  await gammalKlar(Ee.db, "qa-525-oe", ne.text, 3);
  kontroll("e) väntande ny nivå 2 läggs på plats av gammal klient → ny klient läser 2", (await nyNiva("qa-525-oe")) === 2);

  // f) Gammal lärarvy ändrar/tar bort klassens startnivå.
  await seedKlass("qa-525-of", "QA 525 gammal lärarvy", []);
  await setDoc(doc(L.db, "classes", "qa-525-of"), classStartLevelFields(10), { merge: true });
  await setDoc(doc(L.db, "classes", "qa-525-of"), { lasresaStartLevel: 2 }, { merge: true }); // gammal setClassStartLevel(2)
  kontroll("f) gammal lärarvy sätter startnivå 2 → läses 5", classStartLevelOf((await adb.doc("classes/qa-525-of").get()).data()) === 5);
  await adb.doc("classes/qa-525-of").update({ lasresaStartLevel: admin.firestore.FieldValue.delete() }); // gammal "standard"
  kontroll("f) gammal lärarvy tar bort startnivån → standard (null → 4)", classStartLevelOf((await adb.doc("classes/qa-525-of").get()).data()) === null);

  // g) Känd grovhet: ny nivå 1–3 har spegel 1; gammal klients uppflytt → 5.
  await seedElev("qa-525-og", "Grovhet", "ingen-klass", null);
  await sattNiva(L.db, "qa-525-og", 2);
  const Eg = await som("qa-525-og");
  for (let i = 0; i < 3; i++) {
    const t = BANK.filter((x) => x.level === 4)[i];
    await gammalStart(Eg.db, "qa-525-og", t.id);
    await gammalKlar(Eg.db, "qa-525-og", t, t.questions.length);
  }
  const ng = await nyNiva("qa-525-og");
  kontroll("g) (dokumenterad grovhet) nivå 2 + 3 höga i gammal klient → 5, inte 3", ng === 5, `ny nivå ${ng}`);

  // h) Vilka texter ser den gamla klienten i den nya banken?
  const bankUrl = new URL("../src/lasresan/content/bank/", import.meta.url);
  const fetchFil = async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL(url), "utf8")) });
  const varningar = [];
  const loader = GLOAD.createLoader({ fetch: fetchFil, baseUrl: bankUrl, warn: (...a) => varningar.push(a.join(" ")) });
  const rader = [];
  for (let lvl = 1; lvl <= 7; lvl++) {
    const texter = await loader.loadLevel(lvl);
    const ny = new Set(texter.filter((t) => BANK.some((b) => b.id === t.id)).map((t) => BANK.find((b) => b.id === t.id).level));
    const src = ny.size ? `nya bankens nivå ${[...ny].join("/")}` : "dev-seed";
    rader.push(`gammal ${lvl} (= ny ${lvl + 3}): ${texter.length} texter ur ${src}${texter[0] ? `, t.ex. ${texter[0].id}` : ""}`);
  }
  console.log(`    ${rader.join("\n    ")}`);
  const hittad = await loader.findText(BANK.find((t) => t.id.startsWith("lr-n7-")).id);
  kontroll("h) gammal klient kraschar inte på ny bank (varje gammal nivå ger texter)", rader.every((r) => !/: 0 st/.test(r)));
  console.log(`    (lr-n7-text återupptas av gammal klient: ${hittad ? "ja" : "nej – den gamla sidan startar då en ny text"})`);
}
