// ============================================================================
// Slut-QA Läsresan 10 nivåer (#525, epic #516) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Verifierar docs/spec-lasresan-10-nivaer.md §5, §6 och §8 end-to-end. Allt som
// skriver går via klient-SDK:n inloggad som läraren/eleven (grenens regler
// gäller) med SAMMA rena funktioner som appens bryggor (speglade i
// admin/qa-lasresan-482-app.mjs). Admin-SDK:n används bara för seed och dump.
// Sektioner (default = alla):
//   migrering   §5: elever i GAMMAL skala (nivå 1/3/7 + väntande 2 + ej börjad i
//               klass med gammal startnivå 3) → 4/6/10, "6 → 5", startnivå 6;
//               försök +3; inget resultat borta; skrivning + omläsning = ingen
//               dubbelflytt (idempotent)
//   nyelev      §5: utan klass → 4; klass med lärarvald startnivå 2 resp. 9
//   progression §6: 1 → 10 med höga texter (3 i rad), tak 10, låga → ner, golv 1
//   behorighet  §5: elev kan inte ändra startnivå/annans nivå; 0/11/"5" nekas
//   gammalklient    gammal cachad klient (koden i #482-grenen, LEVEL_MAX 7)
//               läser/skriver ny data → korrumperar inte nivå 8–10
//               (qa-lasresan-10-gammal-klient.mjs)
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8540 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9540 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-lasresan-10-kontroll.mjs [sektion…]
//
// Kräver qalarare (admin/qa-lasresan-seed.mjs, körs av preview-skriptet) och för
// gammalklient den gamla koden utpackad:
//   mkdir -p /tmp/q525-gammal && git archive <#482-rev> src | tar -x -C /tmp/q525-gammal
// (GAMMAL_KOD=… pekar ut en annan katalog). Skriptet seedar sina egna elever
// (qa-525-*) och klasser varje körning och rör inte preview-eleverna.
// ============================================================================
import admin from "firebase-admin";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { normalizeLasresa } from "../src/lasresan/progress.js";
import { classStartLevelOf } from "../src/lasresan/level-control.js";
import { classStartLevelFields } from "../src/lasresan/level-scale.js";
import { coinsFor } from "../src/lasresan/rewards.js";
import { WORLDS } from "../src/lasresan/worlds/index.js";
import {
  adb, som, larare, sattNiva, nastaText, lasKlart, lasresaFor, startnivaFor, seedElev, lika,
} from "./qa-lasresan-482-app.mjs";
import {
  kontroll, rapport, utfall, nekad, NOW, forstaPa, lagrat, resultat, forsok, seedKlass,
} from "./qa-lasresan-10-app.mjs";
import { gammalklient } from "./qa-lasresan-10-gammal-klient.mjs";

/** Gammal skala (före #519): inga level10/levelScale-fält. */
const gammalLasresa = (level, over = {}) => {
  const t = forstaPa(level + 3);
  return {
    level, highStreak: 1, lowStreak: 0, worldId: "oknen", stepInWorld: 5, completedWorlds: ["skogen"],
    totalTexts: 21, totalQuestions: 150, totalCorrect: 120, totalIncorrect: 30, moneyEarned: 360,
    seenTextIds: [t.id, "borttagen-text"], catStats: { fakta: { q: 60, correct: 50 }, ordforstaelse: { q: 40, correct: 30 } },
    currentTextId: null, currentStartedAt: null, lastTextId: t.id, updatedAt: NOW,
    pendingLevel: null, levelSetAt: null, levelSetBy: null, ...over,
  };
};
const gammaltForsok = (textId, textLevel, correct, total, min) => ({
  textId, title: "Gammalt försök", textType: "story", textLevel,
  startedAt: NOW - (min + 5) * 60000, completedAt: NOW - min * 60000,
  totalQuestions: total, correct, incorrect: total - correct,
  percentage: Math.round((correct * 100) / total), earnedMoney: correct * 3, perQuestion: [], perCategory: {},
});

// --- §5 migrering ---------------------------------------------------------------------
async function migrering() {
  console.log("\n[§5] migrering av elever i gammal skala (lat, idempotent)");
  const ELEVER = [
    { uid: "qa-525-g1", gammal: 1, ny: 4 },
    { uid: "qa-525-g3", gammal: 3, ny: 6 },
    { uid: "qa-525-g7", gammal: 7, ny: 10 },
  ];
  for (const e of ELEVER) {
    await seedElev(e.uid, `Gammal ${e.gammal}`, "qa-525-gammal", gammalLasresa(e.gammal));
    const t = forstaPa(e.ny);
    await adb.collection(`studentData/${e.uid}/lasresaAttempts`).add({ ...gammaltForsok(t.id, e.gammal, 5, 6, 30), studentId: e.uid });
    await adb.collection(`studentData/${e.uid}/lasresaAttempts`).add({ ...gammaltForsok("utan-konvention", e.gammal, 4, 6, 60), studentId: e.uid });
    await adb.doc(`studentData/${e.uid}`).update({
      coins: 777, lasresaAttemptsFallback: [gammaltForsok("fallback-utan-id", e.gammal, 3, 6, 90)],
    });
  }
  const pagaende = forstaPa(6); // gammal nivå 3-text (lr-n3-…), nu nivå 6
  await seedElev("qa-525-gp", "Väntande 3→2", "qa-525-gammal",
    gammalLasresa(3, { pendingLevel: 2, currentTextId: pagaende.id, currentStartedAt: NOW, levelSetAt: NOW, levelSetBy: "teacher" }));
  await seedElev("qa-525-ej", "Ej börjat", "qa-525-gammal", null);
  await seedKlass("qa-525-gammal", "QA 525 gammal", [...ELEVER.map((e) => e.uid), "qa-525-gp", "qa-525-ej"], { lasresaStartLevel: 3 });

  const L = await larare();
  const klass = (await getDoc(doc(L.db, "classes", "qa-525-gammal"))).data();
  kontroll("klassens gamla startnivå 3 läses som 6", classStartLevelOf(klass) === 6, String(classStartLevelOf(klass)));

  for (const e of ELEVER) {
    const fore = await lagrat(e.uid);
    const E = await som(e.uid);
    const lr = await lasresaFor(E.db, e.uid);
    kontroll(`${e.uid}: gammal ${e.gammal} → nivå ${e.ny} (elevens klient)`, lr.level === e.ny && lr.levelScale === 10, `level=${lr.level}`);
    const lrL = normalizeLasresa((await getDoc(doc(L.db, "studentData", e.uid))).data().lasresa, WORLDS);
    kontroll(`${e.uid}: lärarens vy visar ${e.ny}`, lrL.level === e.ny);
    kontroll(`${e.uid}: normalisering är idempotent`, lika(normalizeLasresa(lr, WORLDS), lr));
    const f = await forsok(E.db, e.uid);
    kontroll(`${e.uid}: försök (subkollektion + fallback) på nivå ${e.ny}`, f.length === 3 && f.every((a) => a.textLevel === e.ny), f.map((a) => a.textLevel).join(","));

    // Första skrivningen efter migreringen (startText) → ny lagringsform.
    const n = await nastaText(E.db, e.uid);
    kontroll(`${e.uid}: nästa text från nivå ${e.ny}`, n.text.level === e.ny, n.text.id);
    const mitt = await lagrat(e.uid);
    const s = mitt.sd.lasresa;
    kontroll(`${e.uid}: lagrat level10 ${e.ny} + spegel level ${e.ny - 3}`, s.level10 === e.ny && s.level === e.ny - 3, `level10=${s.level10} level=${s.level}`);
    kontroll(`${e.uid}: totals, catStats, seenTextIds, världar, pengar, försök, fallback oförändrade`, lika(resultat(fore), resultat(mitt)));
    const igen = await lasresaFor(E.db, e.uid);
    kontroll(`${e.uid}: omläsning efter skrivning → fortfarande ${e.ny} (ingen dubbelflytt)`, igen.level === e.ny, `level=${igen.level}`);

    const r = await lasKlart(E.db, e.uid, n.text, n.text.questions.length);
    const efter = await lagrat(e.uid);
    const lr2 = efter.sd.lasresa;
    kontroll(`${e.uid}: efter en text räknas allt vidare (texter +1, frågor +${n.text.questions.length}, coins +${coinsFor(n.text.questions.length)})`,
      lr2.totalTexts === 22 && lr2.totalQuestions === 150 + n.text.questions.length && efter.sd.coins === 777 + coinsFor(n.text.questions.length)
      && lr2.seenTextIds.includes("borttagen-text") && lr2.completedWorlds.includes("skogen") && lr2.catStats.fakta.q >= 60);
    kontroll(`${e.uid}: nytt försök levelScale 10, textLevel ${e.ny}; nivån kvar ${e.ny}`,
      r.attempt.levelScale === 10 && r.attempt.textLevel === e.ny && lr2.level10 === e.ny, `level10=${lr2.level10}`);
    const tredje = await lasresaFor((await som(e.uid)).db, e.uid);
    kontroll(`${e.uid}: ny inloggning → ${e.ny} igen`, tredje.level === e.ny);
  }

  // Väntande lärarnivå i gammal skala + påbörjad text.
  const P = await som("qa-525-gp");
  const lp = await lasresaFor(P.db, "qa-525-gp");
  kontroll("qa-525-gp: gammal 3 + väntande 2 → nivå 6, väntande 5", lp.level === 6 && lp.pendingLevel === 5, `${lp.level} → ${lp.pendingLevel}`);
  const np = await nastaText(P.db, "qa-525-gp");
  kontroll("qa-525-gp: den påbörjade texten återupptas (nu nivå 6)", np.resumed && np.text.id === pagaende.id && np.text.level === 6);
  const rp = await lasKlart(P.db, "qa-525-gp", np.text, np.text.questions.length);
  kontroll("qa-525-gp: efter texten nivå 5, inget väntande; försöket på nivå 6",
    rp.lasresa.level === 5 && rp.lasresa.pendingLevel === null && rp.attempt.textLevel === 6);
  const sp = (await lagrat("qa-525-gp")).sd.lasresa;
  kontroll("qa-525-gp: lagrat level10 5, spegel 2, pendingLevel10/pendingLevel null",
    sp.level10 === 5 && sp.level === 2 && sp.pendingLevel10 === null && sp.pendingLevel === null);

  // Ej börjad elev i klass med gammal startnivå.
  const J = await som("qa-525-ej");
  kontroll("qa-525-ej: startnivå för ej börjad = 6", (await startnivaFor(J.db, "qa-525-ej")) === 6);
  const nj = await nastaText(J.db, "qa-525-ej");
  kontroll("qa-525-ej: första texten från nivå 6, lagrad level10 6", nj.text.level === 6 && (await lagrat("qa-525-ej")).sd.lasresa.level10 === 6, nj.text.id);

  // Läraren sparar om samma startnivå (6) → båda fälten, fortfarande 6.
  await setDoc(doc(L.db, "classes", "qa-525-gammal"), classStartLevelFields(6), { merge: true });
  const k2 = (await adb.doc("classes/qa-525-gammal").get()).data();
  kontroll("startnivå sparad om som 6 → lasresaStartLevel10 6 + spegel 3, läses 6 (inte 9)",
    k2.lasresaStartLevel10 === 6 && k2.lasresaStartLevel === 3 && classStartLevelOf(k2) === 6);
}

// --- §5 ny elev / startnivå -------------------------------------------------------------
async function nyelev() {
  console.log("\n[§5] nya elever: standard 4, lärarvald startnivå 2 och 9");
  await seedElev("qa-525-utan", "Utan klass", "ingen-klass", null);
  const U = await som("qa-525-utan");
  kontroll("elev utan klass: startnivå 4", (await startnivaFor(U.db, "qa-525-utan")) === 4);
  const nu = await nastaText(U.db, "qa-525-utan");
  kontroll("elev utan klass: första texten från nivå 4", nu.text.level === 4, nu.text.id);

  const L = await larare();
  for (const [klass, niva] of [["qa-525-k2", 2], ["qa-525-k9", 9]]) {
    await seedKlass(klass, `QA 525 start ${niva}`, []);
    await setDoc(doc(L.db, "classes", klass), classStartLevelFields(niva), { merge: true }); // setClassStartLevel
    const uid = `qa-525-ny${niva}`;
    await seedElev(uid, `Ny ${niva}`, klass, null);
    await adb.doc(`classes/${klass}`).update({ studentIds: admin.firestore.FieldValue.arrayUnion(uid) });
    const E = await som(uid);
    const lr = await lasresaFor(E.db, uid);
    const n = await nastaText(E.db, uid);
    const s = (await lagrat(uid)).sd.lasresa;
    kontroll(`klass med startnivå ${niva}: ny elev på nivå ${niva}, första texten nivå ${niva}, lagrat level10 ${niva}`,
      lr.level === niva && n.text.level === niva && s.level10 === niva, `${n.text.id}, spegel ${s.level}`);
  }
}

// --- §6 progression ---------------------------------------------------------------------
async function progression() {
  console.log("\n[§6] automatisk progression på alla tio nivåer (golv 1, tak 10)");
  const uid = "qa-525-prog";
  await seedElev(uid, "Progression", "ingen-klass", null);
  const L = await larare();
  kontroll("läraren sätter nivå 1", (await sattNiva(L.db, uid, 1)) === "now");
  const E = await som(uid);
  const las = async (andel) => {
    const n = await nastaText(E.db, uid);
    const fore = (await lasresaFor(E.db, uid)).level;
    const r = await lasKlart(E.db, uid, n.text, Math.round(n.text.questions.length * andel));
    return { text: n.text, fore, efter: r.lasresa.level };
  };
  const vag = [1];
  let ratNiva = true;
  for (let i = 0; i < 27; i++) {
    const r = await las(1);
    if (r.text.level !== r.fore) ratNiva = false;
    if (r.efter !== vag[vag.length - 1]) vag.push(r.efter);
  }
  kontroll("27 höga texter i rad: 1 → 10, ett steg per 3 höga", lika(vag, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), vag.join("→"));
  kontroll("varje text kom från elevens aktuella nivå", ratNiva);
  let tak = 10;
  for (let i = 0; i < 4; i++) tak = (await las(1)).efter;
  kontroll("4 höga till på nivå 10 → stannar på 10 (tak)", tak === 10);
  const l1 = await las(0);
  const l2 = await las(0);
  kontroll("2 låga i rad på nivå 10 → 9 (en låg räcker inte)", l1.efter === 10 && l2.efter === 9, `${l1.efter}, ${l2.efter}`);
  await sattNiva(L.db, uid, 2);
  const g1 = await las(0);
  const g2 = await las(0);
  const g3 = await las(0);
  const g4 = await las(0);
  kontroll("från 2: 2 låga → 1, 2 låga till → stannar på 1 (golv)", g2.efter === 1 && g4.efter === 1 && g3.text.level === 1, `${g1.efter},${g2.efter},${g3.efter},${g4.efter}`);
  const s = (await lagrat(uid)).sd.lasresa;
  kontroll("lagrat level10 1 + spegel 1", s.level10 === 1 && s.level === 1);
}

// --- behörighet ------------------------------------------------------------------------
async function behorighet() {
  console.log("\n[§5] behörighet (grenens regler)");
  await seedElev("qa-525-b1", "Behörighet 1", "qa-525-beh", null);
  await seedElev("qa-525-b2", "Behörighet 2", "qa-525-beh", { ...gammalLasresa(2), level10: 5 });
  await seedKlass("qa-525-beh", "QA 525 behörighet", ["qa-525-b1", "qa-525-b2"]);
  const E = await som("qa-525-b1");
  const L = await larare();
  const k = (f) => setDoc(doc(E.db, "classes", "qa-525-beh"), f, { merge: true });
  kontroll("elev kan inte sätta klassens startnivå", nekad(await utfall(() => k(classStartLevelFields(2)))));
  kontroll("elev kan inte ändra en annan elevs nivå", nekad(await utfall(() => sattNiva(E.db, "qa-525-b2", 10))));
  const t = (f) => setDoc(doc(L.db, "classes", "qa-525-beh"), f, { merge: true });
  kontroll("lärare: startnivå 10 (+ spegel 7) tillåts", (await utfall(() => t(classStartLevelFields(10)))) === "ok");
  kontroll("lärare: startnivå 1 (+ spegel 1) tillåts", (await utfall(() => t(classStartLevelFields(1)))) === "ok");
  kontroll("lärare: lasresaStartLevel10 11 nekas", nekad(await utfall(() => t({ lasresaStartLevel10: 11, lasresaStartLevel: 7 }))));
  kontroll("lärare: lasresaStartLevel10 0 nekas", nekad(await utfall(() => t({ lasresaStartLevel10: 0, lasresaStartLevel: 1 }))));
  kontroll('lärare: lasresaStartLevel10 "5" (sträng) nekas', nekad(await utfall(() => t({ lasresaStartLevel10: "5", lasresaStartLevel: 2 }))));
  kontroll("lärare: spegeln lasresaStartLevel 8 nekas", nekad(await utfall(() => t({ lasresaStartLevel10: 10, lasresaStartLevel: 8 }))));
  kontroll("lärare sätter elevnivå 10", (await utfall(() => sattNiva(L.db, "qa-525-b2", 10))) === "ok");
}


const SEKTIONER = { migrering, nyelev, progression, behorighet, gammalklient };
const valda = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SEKTIONER);
for (const s of valda) {
  if (!SEKTIONER[s]) { console.error(`okänd sektion ${s}`); process.exit(2); }
  await SEKTIONER[s]();
}
console.log(rapport.fel ? `\n✗ ${rapport.fel} kontroll(er) föll` : "\n✓ alla kontroller gröna");
process.exit(rapport.fel ? 1 : 0);
