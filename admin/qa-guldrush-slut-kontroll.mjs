// ============================================================================
// Guldrushen slut-QA (#567, epic #562) – BARA mot emulatorerna (functions +
// auth + firestore, admin/qa-guldrush-preview.sh). Varje elev är en EGEN
// klient (firebase-SDK:t, inloggad som eleven) som går via de riktiga Cloud
// Functions-anropen och reglerna – precis som elevdatorerna. Admin-SDK:t
// används bara för att sätta upp/avläsa (och för att flytta klockan).
//
//   attack            test 15–19 + trygghet + facit: ~35 attacker/kontroller
//   av                test 18: stöld & byte av → 160 kistor utan stöld/byte
//   nollstall         trygghet: 200 000 slumpade effekter – ingen hamnar på 0
//   (svärm + pluggmynt: qa-guldrush-slut-pris.mjs)
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8567 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9567 \
//   FUNCTIONS_EMULATOR_HOST=127.0.0.1:5567 GCLOUD_PROJECT=pluggportalen-so-2026 \
//   node admin/qa-guldrush-slut-kontroll.mjs attack
// ============================================================================
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, deleteField } from "firebase/firestore";
import { applySelfEffect, resolveVictim, victimProblem, rollChest, chestTable } from "../src/live/formats/guldrush/delat/guldrush-regler.js";
import { GR_CHESTS } from "../src/live/formats/guldrush/delat/chests-config.js";
import {
  adb, Timestamp, sleep, client, fel, check, spara, klassElever, nySession, gaMed, nyttId, svara, gp, setGp, tvingaVal, saldon,
} from "./qa-guldrush-slut-rigg.mjs";

// ============================================================================
// ATTACK – test 15–19, trygghet, facit
// ============================================================================
async function attack() {
  const SID = "qa-gr-567-attack";
  await nySession(SID, { rewards: { firstPrize: 0, perCorrect: 0, cap: 300 } });
  const elever = await klassElever("4b");
  const [alma, omar, leo, ines, hussein, clara, juni, eva] = elever; // b01… (namn ur seeden)
  for (const e of elever.slice(0, 8)) await gaMed(SID, e.uid, "4b");
  const A = await client(alma.uid), O = await client(omar.uid), L = await client(leo.uid), I = await client(ines.uid);
  const H = await client(hussein.uid), C = await client(clara.uid), J = await client(juni.uid);
  console.log(`Roller: Alma=${alma.name} Omar=${omar.name} Leo=${leo.name} Ines=${ines.name}`);

  // Test 13/14: rätt → kista, fel → ingen.
  const r1 = await svara(A, SID, true);
  check("13a", "rätt svar → servern rättar (correct=true)", r1.correct === true);
  const k1 = await fel(A.openChest({ sid: SID, attemptId: r1.attemptId, chestIndex: 1 }));
  check("13b", "rätt svar → en kista öppnas, guldet kommer från servern", k1.ok && typeof k1.v.gold === "number", k1.ok ? `${k1.v.chest} → ${k1.v.gold} guld` : k1.code);
  const r2 = await svara(A, SID, false);
  check("14a", "fel svar → correct=false", r2.correct === false);
  await sleep(1100);
  const k2 = await fel(A.openChest({ sid: SID, attemptId: r2.attemptId, chestIndex: 0 }));
  check("14b/19b", "kista på FEL svar nekas", !k2.ok && k2.code === "failed-precondition", k2.code);

  // Test 19: samma kista två gånger, påhittat id, annans svar.
  await sleep(1100);
  const k3 = await fel(A.openChest({ sid: SID, attemptId: r1.attemptId, chestIndex: 2 }));
  check("19a", "samma kista två gånger nekas", !k3.ok && k3.code === "already-exists", k3.code);
  const k4 = await fel(A.openChest({ sid: SID, attemptId: "qa567-paahittat-id", chestIndex: 0 }));
  check("19c", "kista utan något svar (påhittat id) nekas", !k4.ok && k4.code === "permission-denied", k4.code);
  const rO = await svara(O, SID, true);
  const k5 = await fel(A.openChest({ sid: SID, attemptId: rO.attemptId, chestIndex: 0 }));
  check("19d", "kista på en klasskamrats rätta svar nekas", !k5.ok && k5.code === "permission-denied", k5.code);
  const k6 = await fel(A.openChest({ sid: SID, attemptId: r1.attemptId, chestIndex: 7 }));
  check("19e", "kistnummer utanför 0–2 nekas", !k6.ok && k6.code === "invalid-argument", k6.code);
  // Två kistor inom 1 s (skriptspärren).
  const ra = await svara(A, SID, true), rb = await svara(A, SID, true);
  await sleep(1100);
  await fel(A.openChest({ sid: SID, attemptId: ra.attemptId, chestIndex: 0 }));
  const k7 = await fel(A.openChest({ sid: SID, attemptId: rb.attemptId, chestIndex: 0 }));
  check("19f", "två kistor inom 1 s → 'En kista i taget!'", !k7.ok && k7.code === "resource-exhausted", k7.code);
  // Svar för klasskamrat / omförsök med samma id från annan elev.
  const k8 = await fel(O.answer({ sid: SID, attemptId: r1.attemptId, factorA: 2, factorB: 3, answer: 6 }));
  check("19g", "återanvända en klasskamrats svar-id nekas", !k8.ok && k8.code === "already-exists", k8.code);

  // Test 19 – skriva direkt i databasen (reglerna).
  const w = async (p) => (await fel(p)).ok === false;
  check("19h", "skriva eget guld (grPlayers) nekas", await w(setDoc(doc(A.db, "liveSessions", SID, "grPlayers", alma.uid), { gold: 10000 }, { merge: true })));
  check("19i", "skriva klasskamrats guld nekas", await w(updateDoc(doc(A.db, "liveSessions", SID, "grPlayers", omar.uid), { gold: 0 })));
  check("19j", "skapa en händelse (grEvents) nekas", await w(addDoc(collection(A.db, "liveSessions", SID, "grEvents"), { type: "chest", chest: "skattkammare", uid: alma.uid, amount: 100 })));
  check("19k", "skriva ledaren (grMeta) nekas", await w(setDoc(doc(A.db, "liveSessions", SID, "grMeta", "leader"), { uid: alma.uid })));
  const fejk = nyttId();
  const fejkSvar = await fel(setDoc(doc(A.db, "liveSessions", SID, "answers", fejk), {
    uid: alma.uid, classId: "4b", format: "guldrush", mode: "multiplication_0_10", factorA: 2, factorB: 2, answer: 4,
    correctAnswer: 4, isCorrect: true, at: serverTimestamp(),
  }));
  check("19l", "skriva ett eget 'rätt svar' direkt (förbi servern) nekas", !fejkSvar.ok, fejkSvar.code || "skrevs!");
  if (fejkSvar.ok) {
    await sleep(1100);
    const k = await fel(A.openChest({ sid: SID, attemptId: fejk, chestIndex: 0 }));
    check("19l2", "…och kistan på det svaret nekas", !k.ok, k.code);
  }
  check("19m", "ta bort 'chest' från sitt öppnade svar (öppna igen) nekas", await w(updateDoc(doc(A.db, "liveSessions", SID, "answers", r1.attemptId), { chest: deleteField() })));
  check("19n", "skriva matchens result nekas", await w(updateDoc(doc(A.db, "liveSessions", SID), { result: { rewards: { [alma.uid]: { total: 999 } } } })));
  check("19o", "skriva ett Pluggmynt-kvitto nekas", await w(setDoc(doc(A.db, "liveSessions", SID, "coinReceipts", alma.uid), { uid: alma.uid, total: 999 })));
  check("19p", "gå med under falskt namn nekas", await w(setDoc(doc(I.db, "liveSessions", "qa-gr-567-attack", "players", "b20"), { uid: "b20", classId: "4b", name: "Fejk", joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), correct: 0, incorrect: 0 })));
  const e01 = await client("e01");
  const e01ga = await fel(setDoc(doc(e01.db, "liveSessions", SID, "players", "e01"), { uid: "e01", classId: "4b", name: (await adb.doc("students/e01").get()).get("namn"), joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), correct: 0, incorrect: 0 }));
  check("19q", "elev i annan klass (5E) kan inte gå med som 4B", !e01ga.ok, e01ga.code);
  const e01svar = await fel(e01.answer({ sid: SID, attemptId: nyttId(), factorA: 2, factorB: 2, answer: 4 }));
  check("19r", "elev som inte är med kan inte svara", !e01svar.ok && e01svar.code === "permission-denied", e01svar.code);
  const fejkKlass = await fel(setDoc(doc(A.db, "liveSessions", SID, "players", alma.uid), { correct: 400 }, { merge: true }));
  check("19s", "räkna upp sina rätt (players.correct) nekas", !fejkKlass.ok, fejkKlass.code || "skrevs!");

  // Test 15: Alma 100 → Omar stjäl → 85 / +15, i en transaktion + händelse.
  await setGp(SID, alma.uid, { gold: 100, shield: false, protectedUntil: null });
  await setGp(SID, omar.uid, { gold: 40, shield: false, protectedUntil: null, lastVictimUid: null });
  const rs = await svara(O, SID, true);
  await tvingaVal(SID, omar.uid, "steal", rs.attemptId);
  const coinsFore = await saldon([alma.uid, omar.uid]);
  const s15 = await fel(O.chooseVictim({ sid: SID, victimUid: alma.uid }));
  const [ga, go] = [await gp(SID, alma.uid), await gp(SID, omar.uid)];
  check("15a", "stöld 100 → Alma 85, Omar +15", s15.ok && ga.gold === 85 && go.gold === 55, `Alma ${ga.gold}, Omar ${go.gold}`);
  const ev = (await adb.collection(`liveSessions/${SID}/grEvents`).where("type", "==", "steal").get()).docs.map((d) => d.data());
  check("15b", "händelsen (steal 15, båda namnen) finns i grEvents för projektorn", ev.some((e) => e.uid === omar.uid && e.victimUid === alma.uid && e.amount === 15));
  check("15c", "guldet bevarat (summan 140 före = 140 efter)", ga.gold + go.gold === 140);
  check("15d", "Alma fick stöldskydd (protectedUntil ≈ +30 s) + notis-underlag (lastHit)", ga.protectedUntil && ga.lastHit?.byUid === omar.uid && ga.lastHit?.amount === 15);
  const coinsEfter = await saldon([alma.uid, omar.uid]);
  check("20f", "stölden rör inga pluggmynt (studentData.coins oförändrat)", JSON.stringify(coinsFore) === JSON.stringify(coinsEfter), JSON.stringify(coinsEfter));

  // Test 16: Alma skyddad → Leos manipulerade anrop nekas.
  await setGp(SID, leo.uid, { gold: 30, lastVictimUid: null });
  const rl = await svara(L, SID, true);
  await tvingaVal(SID, leo.uid, "steal", rl.attemptId);
  const s16 = await fel(L.chooseVictim({ sid: SID, victimUid: alma.uid }));
  check("16", "stöld från elev med stöldskydd nekas av servern", !s16.ok && s16.code === "failed-precondition" && /stöldskydd/.test(s16.msg), `${s16.code}: ${s16.msg}`);
  const almaEfter16 = (await gp(SID, alma.uid)).gold;
  check("16b", "…och Almas guld är orört", almaEfter16 === 85);
  // Leo väljer sig själv.
  const s16c = await fel(L.chooseVictim({ sid: SID, victimUid: leo.uid }));
  check("16c", "välja sig själv nekas", !s16c.ok && /själv/.test(s16c.msg), s16c.msg);
  const s16d = await fel(L.chooseVictim({ sid: SID, victimUid: "finnsinte" }));
  check("16d", "välja någon som inte är med nekas", !s16d.ok && s16d.code === "not-found", s16d.code);
  // Leo väljer ingen (tiden ute) → servern slumpar bland dem som går.
  const s16e = await fel(L.chooseVictim({ sid: SID, victimUid: null }));
  check("16e", "inget val → servern slumpar en tillåten klasskamrat (aldrig Alma med skydd)", s16e.ok && s16e.v.victimUid !== alma.uid && s16e.v.victimUid !== leo.uid, JSON.stringify(s16e.v || s16e.code));

  // Samma offer två gånger i rad.
  await setGp(SID, juni.uid, { gold: 200, protectedUntil: null, shield: false });
  await setGp(SID, omar.uid, { lastVictimUid: juni.uid });
  const rj = await svara(O, SID, true);
  await tvingaVal(SID, omar.uid, "steal", rj.attemptId);
  const sSamma = await fel(O.chooseVictim({ sid: SID, victimUid: juni.uid }));
  check("T2", "samma offer två gånger i rad nekas", !sSamma.ok && /två gånger/.test(sSamma.msg), sSamma.msg);
  await O.chooseVictim({ sid: SID, victimUid: null }).catch(() => null);

  // Test 17: Ines minst guld → byte bara mot rikare.
  await setGp(SID, ines.uid, { gold: 5, lastVictimUid: null, protectedUntil: null });
  await setGp(SID, hussein.uid, { gold: 3, protectedUntil: null, shield: false });
  await setGp(SID, clara.uid, { gold: 300, protectedUntil: null, shield: false });
  const ri = await svara(I, SID, true);
  await tvingaVal(SID, ines.uid, "swap", ri.attemptId);
  const s17 = await fel(I.chooseVictim({ sid: SID, victimUid: hussein.uid }));
  check("17a", "byte med någon som har MINDRE guld nekas", !s17.ok && /mer guld/.test(s17.msg), s17.msg);
  const s17b = await fel(I.chooseVictim({ sid: SID, victimUid: clara.uid }));
  const [gi, gc] = [await gp(SID, ines.uid), await gp(SID, clara.uid)];
  check("17b", "byte med rikare → guldet byts (5 ↔ 300) i en transaktion", s17b.ok && gi.gold === 300 && gc.gold === 5, `Ines ${gi.gold}, Clara ${gc.gold}`);
  // Byte utan eget guld.
  await setGp(SID, hussein.uid, { gold: 0, lastVictimUid: null });
  const rh = await svara(H, SID, true);
  await tvingaVal(SID, hussein.uid, "swap", rh.attemptId);
  await setGp(SID, juni.uid, { protectedUntil: null });
  const s17c = await fel(H.chooseVictim({ sid: SID, victimUid: juni.uid }));
  check("17c", "byte med 0 eget guld nekas (ingen nollställs av ett byte)", !s17c.ok && /eget guld/.test(s17c.msg), s17c.msg);
  const s17d = await fel(H.chooseVictim({ sid: SID, victimUid: null }));
  check("17d", "har ingen giltig → vanlig guldkista i stället (fallback)", s17d.ok && s17d.v.result === "fallback", JSON.stringify(s17d.v || s17d.code));

  // Sköld: stoppar nästa stöld, förbrukas.
  await setGp(SID, eva.uid, { gold: 120, shield: true, protectedUntil: null });
  await setGp(SID, clara.uid, { lastVictimUid: null, pending: null });
  await sleep(1100);
  const rc = await svara(C, SID, true);
  await tvingaVal(SID, clara.uid, "steal", rc.attemptId);
  const sSk = await fel(C.chooseVictim({ sid: SID, victimUid: eva.uid }));
  const ge = await gp(SID, eva.uid);
  check("T3", "sköld stoppar stölden (0 guld flyttas) och förbrukas", sSk.ok && sSk.v.result === "blocked" && ge.gold === 120 && ge.shield === false, JSON.stringify(sSk.v || sSk.code));
  check("T3b", "stöld från elev med för lite guld (≤ 6) nekas – ingen hamnar på 0", victimProblem("steal", { uid: "x" }, { uid: "y", gold: 6 }, Date.now()) === "for-lite-guld");

  // Facit (quiz) – eleven kan inte läsa det.
  const QS = "qa-gr-567-quiz";
  await nySession(QS, { mode: "plugga_quiz", kind: "choice" });
  await adb.doc(`liveSessions/${QS}/grPublic/questions`).set({ questions: [
    { id: "q1", key: "0:q1", text: "2 + 2?", options: ["3", "4", "5", "6"], statKeys: ["q:q1"] },
    { id: "q2", key: "1:q2", text: "3 + 3?", options: ["6", "7", "8", "9"], statKeys: ["q:q2"] },
  ] });
  await adb.doc(`liveSessions/${QS}/grPrivate/snapshot`).set({ facit: [{ answerIndex: 1 }, { answerIndex: 0 }] });
  const Q = await gaMed(QS, alma.uid, "4b");
  const lasFacit = await fel(getDoc(doc(Q.db, "liveSessions", QS, "grPrivate", "snapshot")));
  check("F1", "eleven kan INTE läsa quizets facit (grPrivate)", !lasFacit.ok, lasFacit.code || "läsbart!");
  const pub = (await getDoc(doc(Q.db, "liveSessions", QS, "grPublic", "questions"))).data();
  check("F2", "de publika frågorna saknar answerIndex/rätt svar", !JSON.stringify(pub).match(/answerIndex|correct/), Object.keys(pub.questions[0]).join(","));
  const qa1 = await fel(Q.answer({ sid: QS, attemptId: nyttId(), q: 0, choiceIndex: 1 }));
  check("F3", "quizsvaret rättas på servern + servern väljer nästa fråga", qa1.ok && qa1.v.correct === true && qa1.v.nextQ === 1, JSON.stringify(qa1.v || qa1.code));
  const qa2 = await fel(Q.answer({ sid: QS, attemptId: nyttId(), q: 0, choiceIndex: 1 }));
  check("F4", "svara på en annan fråga än den servern gav (prova sig fram) nekas", !qa2.ok && qa2.code === "failed-precondition", qa2.code);
  const qa3 = await fel(Q.answer({ sid: QS, attemptId: nyttId(), q: 1, answer: "6" }));
  check("3d", "quiz = Flerval: ett 'skriv själv'-svar utan choiceIndex nekas", !qa3.ok && qa3.code === "invalid-argument", qa3.code);
  const egetSvar = await fel(getDoc(doc(Q.db, "liveSessions", QS, "answers", qa1.v?.attemptId || "x")));
  check("F5", "eleven läser sitt eget svar (omladdning)", egetSvar.ok);
  const andrasSvar = await fel(getDoc(doc(A.db, "liveSessions", SID, "answers", rO.attemptId)));
  check("F6", "eleven kan inte läsa en klasskamrats svar", !andrasSvar.ok, andrasSvar.code || "läsbart");

  // Test 20: tiden ute → svar, kistor och val nekas.
  const okOppnad = await svara(J, SID, true); // rätt svar vars kista inte öppnats
  const rp = await svara(L, SID, true);
  await tvingaVal(SID, leo.uid, "steal", rp.attemptId);
  const sess = adb.doc(`liveSessions/${SID}`);
  const t = Date.now();
  await sess.update({ startedAt: Timestamp.fromMillis(t - 604_000 - 1000), endsAt: Timestamp.fromMillis(t - 1000) });
  const t20a = await fel(J.answer({ sid: SID, attemptId: nyttId(), factorA: 2, factorB: 2, answer: 4 }));
  check("20a", "svar efter 00:00 nekas ('Tiden är ute! ⏰')", !t20a.ok && t20a.code === "failed-precondition" && /Tiden är ute/.test(t20a.msg), t20a.msg);
  const t20b = await fel(J.openChest({ sid: SID, attemptId: okOppnad.attemptId, chestIndex: 0 }));
  check("20b'", "kista efter 00:00 nekas (även på ett rätt svar)", !t20b.ok && t20b.code === "failed-precondition", t20b.msg);
  const t20c = await fel(L.chooseVictim({ sid: SID, victimUid: juni.uid }));
  check("20c'", "stöld/byte efter 00:00 nekas", !t20c.ok && t20c.code === "failed-precondition", t20c.msg);
  await sess.update({ status: "finished", finishedAt: Timestamp.now() });
  const t20d = await fel(J.answer({ sid: SID, attemptId: nyttId(), factorA: 2, factorB: 2, answer: 4 }));
  check("20d'", "svar efter avslutad match nekas", !t20d.ok, t20d.msg);
  spara("attack");
}

// ============================================================================
// AV – test 18
// ============================================================================
async function av() {
  const SID = "qa-gr-567-av";
  await nySession(SID, { stealSwap: false, rewards: { firstPrize: 0, perCorrect: 0, cap: 300 } });
  const elever = (await klassElever("4b"));
  const cs = [];
  for (const e of elever) cs.push(await gaMed(SID, e.uid, "4b"));
  const typer = {};
  let fel18 = 0;
  await Promise.all(cs.map(async (c) => {
    for (let i = 0; i < 8; i++) {
      const r = await svara(c, SID, true);
      const k = await fel(c.openChest({ sid: SID, attemptId: r.attemptId, chestIndex: i % 3 }));
      if (k.ok) typer[k.v.chest] = (typer[k.v.chest] || 0) + 1;
      else fel18++;
      if (k.ok && k.v.pending) fel18 += 1000;
      await sleep(1050);
    }
  }));
  const n = Object.values(typer).reduce((a, b) => a + b, 0);
  check("18a", `stöld & byte av: ${n} kistor, ingen Stöld/Byte`, !typer.stold && !typer.byte && n >= 150, JSON.stringify(typer));
  check("18b", "inga väntande offerval uppstod / inga fel", fel18 === 0, `fel ${fel18}`);
  const tab = chestTable(false);
  check("18c", "kisttabellen utan stöld/byte: deras vikt flyttad till guldkistorna", !tab.some((r) => /stold|byte/.test(r.chest.id)) &&
    Math.abs(tab.reduce((s, r) => s + r.weight, 0) - GR_CHESTS.reduce((s, c) => s + c.weight, 0)) < 1e-9);
  const ev = (await adb.collection(`liveSessions/${SID}/grEvents`).get()).docs.map((d) => d.data().type);
  check("18d", "inga steal/swap-händelser i flödet", !ev.includes("steal") && !ev.includes("swap"), `${ev.length} händelser`);
  spara("av");
}

// ============================================================================
// NOLLSTÄLL – trygghet: ingen effekt sätter guld > 0 till 0
// ============================================================================
function nollstall() {
  let rng = 12345;
  const rnd = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
  let nollad = 0, overStold = 0, overHal = 0, n = 0;
  for (let i = 0; i < 200_000; i++) {
    const g = 1 + Math.floor(rnd() * (rnd() < 0.3 ? 20 : 3000));
    const chest = rollChest(true, rnd);
    const k = chest.effect.kind;
    if (k === "steal" || k === "swap") {
      const thief = { uid: "t", gold: Math.floor(rnd() * 3000), lastVictimUid: null };
      const victim = { uid: "v", gold: g, shield: rnd() < 0.1 };
      if (victimProblem(k, thief, victim, 0)) continue;
      const r = resolveVictim(k, thief, victim);
      if (r.victimGold === 0 || r.thiefGold === 0) nollad++;
      if (k === "steal" && r.amount > Math.floor(g * 0.15)) overStold++;
    } else {
      const r = applySelfEffect(chest, g);
      if (r.gold === 0) nollad++;
      if (k === "lose" && -r.delta > Math.floor(g * 0.1)) overHal++;
    }
    n++;
  }
  check("T1", `inget sätt att nollställa någon (${n} slumpade effekter på guld > 0)`, nollad === 0, `nollade ${nollad}`);
  check("T1b", "stöld högst 15 %, hål i fickan högst 10 %", overStold === 0 && overHal === 0);
  const texter = GR_CHESTS.map((c) => c.eventText).join(" | ");
  check("T4", "händelsetexterna är lekfulla (inga hånfulla ord)", !/(dum|loser|förlorare|haha|ha ha|töntig|ful|usel|pinsam)/i.test(texter), texter);
  spara("nollstall");
}

const [cmd] = process.argv.slice(2);
if (cmd === "attack") await attack();
else if (cmd === "av") await av();
else if (cmd === "nollstall") nollstall();
else console.log("attack | av | nollstall");
process.exit(0);
