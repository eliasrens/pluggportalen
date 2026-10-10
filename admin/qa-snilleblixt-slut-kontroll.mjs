// ============================================================================
// Snilleblixten slut-QA (#561, epic #555) – BARA emulatorn. Eleverna skriver
// via KLIENT-SDK:n inloggade som sig själva (reglerna gäller), med samma
// skrivplaner som appen (planLiveJoin/planLiveHeartbeat/planAnswer). Facit
// läses BARA av testriggen (admin) för att kunna svara rätt/fel med flit.
//
//   <emulator-env> node admin/qa-snilleblixt-slut-kontroll.mjs <kommando> <sid> …
//
//   saldo  <sid>                  spara alla deltagande elevers coins (före)
//   fraga78 <sid>                 lobby: fråga 1 = 7 × 8 (test 7b), samma form
//                                 som ögonblicksbilden (svarssättet bevaras)
//   utoka  <sid> <antal>          lobby: fler multiplikationsfrågor (20i: 50)
//   elever <sid> <antal> <scen> [--b01 rätt|av]   svärmen tills sessionen är slut
//       scen "A" (styrd ställning): L rätt först varje fråga; P1+P2 rätt SAMTIDIGT
//         på fråga 1 (delad 2:a), annars fel; D dubbelsvar (två olika val
//         samtidigt) på fråga 3; S spionerar (facit/svar/poäng) varje fråga;
//         N anslöt men svarar aldrig och slutar pulsa (20h); T svarar inte på fråga 4 (stängs
//         på tid); V svarar exakt 4 s efter öppning på fråga 5 (test 5);
//         sen anslutning (från 5E) när fråga 5 öppnas; övriga: fel i en
//         skur 0,3–2,5 s, rätt (8 s) på en egen fråga.
//       scen "B" (skriv själv, test 7b): fråga 1 = 7 × 8: 5 st "54", 3 st "64",
//         en " 056 ", resten "56"; övriga frågor skur ~60 % rätt.
//       scen "C" (20i): L rätt först alltid; b01 (webbläsaren) rätt näst –
//         från fråga 4 skrivs b01 här (klient, --b01 rätt), fråga 1–3 svarar
//         b01 själv i webbläsaren; b01 fel på de 8 sista; övriga ~35 % rätt.
//       scen "E" --b01 rätt --plan '[{"b01":"fel","andra":"ratt"},…]' (elevskärmen: b01
//         ledare/mitten/sist på beställning; b01 skrivs här, webbläsaren visar)
//   (verifieringen efteråt: admin/qa-snilleblixt-slut-verifiera.mjs <sid> <scen>)
//
// Loggar: /tmp/sb561-<sid>-elever.jsonl (varje svar: uid, q, skickat, svar).
// ============================================================================
import admin from "firebase-admin";
import { appendFileSync, writeFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, onSnapshot, serverTimestamp,
  setDoc, terminate, updateDoc,
} from "firebase/firestore";
import { planLiveJoin, planLiveHeartbeat } from "../src/tavling/answer-writes.js";
import { planAnswer } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const adb = admin.firestore(admin.initializeApp({ projectId: PROJECT }));
const AFV = admin.firestore.FieldValue;
const fv = { serverTimestamp };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ms = (t) => (t?.toMillis ? t.toMillis() : t?.seconds != null ? t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6) : null);

const [cmd, sid, ...rest] = process.argv.slice(2);
// Ett nekat steg i svärmen får aldrig döda resten av klassen – logga och fortsätt.
process.on("unhandledRejection", (e) => { console.error("ohanterat:", e?.code || e); logg({ ohanterat: String(e?.code || e) }); });
const sess = adb.doc(`liveSessions/${sid}`);
const LOG = `/tmp/sb561-${sid}-elever.jsonl`;
const logg = (o) => appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + "\n");

async function som(uid) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "qa" }, `${uid}-${Math.random()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FS.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  await signInWithEmailAndPassword(auth, `${uid}@elev.pluggportalen.local`, "lilla123");
  return { uid, db };
}

async function deltagare(s) {
  const out = [];
  for (const cid of s.participatingClassIds) {
    const c = (await adb.doc(`classes/${cid}`).get()).data();
    for (const uid of c?.studentIds || []) out.push({ uid, classId: cid });
  }
  return out;
}

// ---------------------------------------------------------------------------
if (cmd === "saldo") {
  const s = (await sess.get()).data();
  const saldo = {};
  for (const p of await deltagare(s)) saldo[p.uid] = Number((await adb.doc(`studentData/${p.uid}`).get()).data()?.coins) || 0;
  writeFileSync(`/tmp/sb561-${sid}-saldo.json`, JSON.stringify(saldo));
  console.log(`saldo sparat för ${Object.keys(saldo).length} elever`);
  process.exit(0);
}

if (cmd === "fraga78" || cmd === "utoka") {
  const s = (await sess.get()).data();
  if (s.status !== "lobby") throw new Error("bara i lobbyn");
  const ref = adb.doc(`liveSessions/${sid}/sbPrivate/snapshot`);
  if (cmd === "utoka") {
    const { requireGameMode } = await import("../src/live/modes/index.js");
    const { buildSnapshot } = await import("../src/live/formats/snilleblixt/snilleblixt-core.js");
    const n = Number(rest[0]) || 50;
    await ref.set(buildSnapshot(requireGameMode(s.gameMode), { answerKind: s.answerKind, count: n, shuffle: true }));
    await sess.update({ questionCount: n });
    console.log(`${n} frågor`);
  } else {
    const snap = (await ref.get()).data();
    const q0 = { ...snap.questions[0], key: "0:7x8", text: "7 × 8", statKeys: ["t7", "t8"] };
    const f0 = { ...snap.facit[0], correctAnswer: "56" };
    if (s.answerKind === "choice") { q0.options = ["54", "56", "64", "48"]; f0.answerIndex = 1; }
    snap.questions[0] = q0;
    snap.facit[0] = f0;
    await ref.set(snap);
    console.log("fråga 1 = 7 × 8", JSON.stringify(q0), JSON.stringify(f0));
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
if (cmd === "elever") {
  const [antalS, scen] = rest;
  const b01 = rest.includes("--b01") ? rest[rest.indexOf("--b01") + 1] : null;
  const PLAN = rest.includes("--plan") ? JSON.parse(rest[rest.indexOf("--plan") + 1]) : [];
  const s0 = (await sess.get()).data();
  const alla = await deltagare(s0);
  const antal = Number(antalS) || 24;
  const pool = alla.filter((p) => p.uid !== "b01");
  const sims = pool.slice(0, antal);
  const sen = scen === "A" ? pool.find((p) => !sims.includes(p)) : null;
  const facit = (await adb.doc(`liveSessions/${sid}/sbPrivate/snapshot`).get()).data().facit;
  const roll = {};
  if (scen === "A") Object.assign(roll, { L: sims[0], P1: sims[1], P2: sims[2], D: sims[3], S: sims[4], N: sims[5], T: sims[6], V: sims[7] });
  if (scen === "B" || scen === "C") roll.L = sims[0];
  writeFileSync(`/tmp/sb561-${sid}-roller.json`, JSON.stringify(Object.fromEntries(Object.entries(roll).map(([k, v]) => [k, v.uid])).valueOf()));
  console.log("roller:", Object.entries(roll).map(([k, v]) => `${k}=${v.uid}`).join(" "), sen ? `sen=${sen.uid}` : "");

  const t0 = Date.now();
  const klienter = await Promise.all(sims.map((p) => som(p.uid).then((c) => ({ ...p, ...c }))));
  if (b01 === "rätt") klienter.push({ uid: "b01", classId: alla.find((p) => p.uid === "b01").classId, ...(await som("b01")), webb: true });
  console.log(`${klienter.length} klienter inloggade på ${Date.now() - t0} ms`);
  // Rollerna pekar på klientobjekten (jämförs med ===).
  for (const [r, p] of Object.entries(roll)) roll[r] = klienter.find((k) => k.uid === p.uid);
  // Anslut (b01 ansluter själv i webbläsaren).
  for (const k of klienter.filter((k) => !k.webb)) {
    const w = planLiveJoin({ sessionId: sid, uid: k.uid, classId: k.classId, name: "", fv });
    const have = await getDoc(doc(k.db, ...w.path));
    if (!have.exists()) {
      const namn = (await getDoc(doc(k.db, "students", k.uid))).data()?.namn || "";
      await setDoc(doc(k.db, ...w.path), { ...w.data, name: namn });
    }
    await sleep(60 + Math.random() * 120); // "poppar upp" en i taget
  }
  console.log(`${klienter.length} anslutna`);
  const puls = setInterval(() => {
    for (const k of klienter) {
      // N "fäller ner locket": ingen puls → efter 75 s räknas N inte som ansluten.
      if (k.webb || k === roll.N) continue;
      const w = planLiveHeartbeat({ sessionId: sid, uid: k.uid, fv });
      setDoc(doc(k.db, ...w.path), w.data, { merge: true }).catch(() => {});
    }
  }, 20_000);

  const svara = async (k, s, i, { right, choiceIndex, answer }) => {
    const f = facit[i];
    const arg = s.answerKind === "choice"
      ? { choiceIndex: choiceIndex ?? (right ? f.answerIndex : (f.answerIndex + 1 + (k.uid.charCodeAt(2) % 3)) % 4) }
      : { answer: answer ?? (right ? String(f.correctAnswer) : String(Number(f.correctAnswer) + 1 + (k.uid.charCodeAt(2) % 5))) };
    const w = planAnswer({ sid, s, uid: k.uid, classId: k.classId, ...arg, fv });
    const skickat = Date.now();
    try {
      await setDoc(doc(k.db, ...w.path), w.data);
      logg({ uid: k.uid, q: i, skickat, klar: Date.now(), ...arg, status: "ok" });
      return "ok";
    } catch (e) {
      logg({ uid: k.uid, q: i, skickat, ...arg, status: e.code || String(e) });
      return e.code || "fel";
    }
  };

  const spion = async (k, s, i) => {
    const r = {};
    const tryRead = async (namn, fn) => { try { await fn(); r[namn] = "LÄSTE"; } catch (e) { r[namn] = e.code; } };
    await tryRead("snapshot", () => getDoc(doc(k.db, "liveSessions", sid, "sbPrivate", "snapshot")));
    await tryRead("allaSvar", () => getDocs(collection(k.db, "liveSessions", sid, "sbAnswers")));
    await tryRead("annansSvar", () => getDoc(doc(k.db, "liveSessions", sid, "sbAnswers", `${i}_${roll.L.uid}`)));
    await tryRead("poangSkriv", () => setDoc(doc(k.db, "liveSessions", sid, "sbScores", String(i)), { index: i, points: { [k.uid]: 1000 } }));
    await tryRead("fasSkriv", () => updateDoc(doc(k.db, "liveSessions", sid), { "q.phase": "revealed" }));
    const sd = (await getDoc(doc(k.db, "liveSessions", sid))).data();
    r.facitISession = sd?.q?.facit !== undefined;
    r.frågorISession = JSON.stringify(sd).includes("questions") || JSON.stringify(sd).includes("facit");
    // Skriv själv-form på en flervalssession (test 3d) och klientstämplad tid.
    r.felForm = await (async () => {
      const data = { uid: k.uid, classId: k.classId, q: i, answerKind: "free", answer: "1", at: serverTimestamp() };
      try { await setDoc(doc(k.db, "liveSessions", sid, "sbAnswers", `${i}_${k.uid}`), data); return "SKREV"; } catch (e) { return e.code; }
    })();
    logg({ uid: k.uid, q: i, spion: r });
    return r;
  };

  let senAnsluten = null;
  const sett = new Set();
  const stangdaSvar = new Set();
  let resolveSlut;
  const slut = new Promise((r) => { resolveSlut = r; });
  const unsub = onSnapshot(doc(klienter[0].db, "liveSessions", sid), async (snap) => {
    const s = snap.data();
    if (!s) return;
    if (s.status === "finished") { resolveSlut(s); return; }
    const q = s.q;
    // Svar EFTER stängning nekas (test: svarsfönstret).
    if (q && q.phase === "closed" && scen === "A" && !stangdaSvar.has(q.index) && q.index === 3) {
      stangdaSvar.add(q.index);
      const r = await svara(roll.T, s, q.index, { right: true });
      logg({ uid: roll.T.uid, q: q.index, efterStangning: r });
    }
    if (!q || q.phase !== "open" || sett.has(q.index)) return;
    sett.add(q.index);
    const i = q.index;
    const opened = ms(q.openedAt);
    logg({ q: i, oppnad: opened, sett: Date.now() });
    const jobb = [];
    const efter = (delay, fn) => jobb.push(sleep(delay).then(fn));
    // Riktning: alla skurar räknas från när eleven SÅG frågan.
    if (scen === "A") {
      if (i === 4 && sen && !senAnsluten) {
        senAnsluten = { ...sen, ...(await som(sen.uid)) };
        const w = planLiveJoin({ sessionId: sid, uid: sen.uid, classId: sen.classId, name: "", fv });
        const namn = (await getDoc(doc(senAnsluten.db, "students", sen.uid))).data()?.namn || "";
        await setDoc(doc(senAnsluten.db, ...w.path), { ...w.data, name: namn });
        klienter.push(senAnsluten);
        const r = await svara(senAnsluten, s, i, { right: true });
        logg({ uid: sen.uid, q: i, senAnslutningSvar: r });
      }
      for (const k of klienter) {
        if (k === senAnsluten && i === 4) continue;
        const u = k.uid;
        if (k === roll.N) continue;
        if (k === roll.T && i === 3) continue;
        if (k === roll.L) { efter(300, () => svara(k, s, i, { right: true })); continue; }
        if (k === roll.P1 || k === roll.P2) continue; // nedan, samtidigt
        if (k === roll.V && i === 5) {
          const vänta = Math.max(0, opened + 4000 - Date.now() - 15);
          efter(vänta, () => svara(k, s, i, { right: true }));
          continue;
        }
        if (k === roll.D && i === 2) {
          const f = facit[i].answerIndex;
          efter(900, () => Promise.all([
            svara(k, s, i, { choiceIndex: f }), svara(k, s, i, { choiceIndex: (f + 1) % 4 }),
          ]).then((r) => logg({ uid: u, q: i, dubbel: r })));
          continue;
        }
        if (k === roll.S) efter(200, () => spion(k, s, i));
        const egen = Number(u.replace(/\D/g, "")) % s.questionCount;
        if (egen === i && k !== roll.S && k !== roll.V) efter(8000, () => svara(k, s, i, { right: true }));
        else efter(300 + Math.random() * 2200, () => svara(k, s, i, { right: false }));
      }
      const par = i === 0;
      efter(1000, () => Promise.all([svara(roll.P1, s, i, { right: par }), svara(roll.P2, s, i, { right: par })]));
    } else if (scen === "B") {
      let n = 0;
      for (const k of klienter) {
        if (k === roll.L) { efter(400, () => svara(k, s, i, { right: true })); continue; }
        if (i === 0) {
          const a = n < 5 ? "54" : n < 8 ? "64" : n === 8 ? " 056 " : "56";
          n++;
          efter(500 + Math.random() * 2000, () => svara(k, s, i, { answer: a }));
        } else efter(500 + Math.random() * 2000, () => svara(k, s, i, { right: Math.random() < 0.6 }));
      }
    } else if (scen === "C") {
      const sist = s.questionCount - 8; // b01 rätt på de första 42 av 50
      for (const k of klienter) {
        if (k === roll.L) efter(200, () => svara(k, s, i, { right: true }));
        else if (k.webb && i < 3) continue; // fråga 1–3 svarar b01 själv i webbläsaren
        else if (k.webb) efter(700, () => getDoc(doc(k.db, "liveSessions", sid, "sbAnswers", `${i}_b01`))
          .then((d) => (d.exists() ? "redan" : svara(k, s, i, { right: i < sist }))));
        else efter(1200 + Math.random() * 1500, () => svara(k, s, i, { right: Math.random() < 0.35 }));
      }
    } else if (scen === "E") {
      // Styrd elevskärm (#561 runda 2): plan per fråga (sista posten upprepas).
      //   b01: forst (rätt 200 ms) | fel (600 ms) · andra: ratt | fel | halv (varannan rätt)
      const p = PLAN[Math.min(i, PLAN.length - 1)];
      klienter.forEach((k, n) => {
        if (k.webb) efter(p.b01 === "forst" ? 200 : 600, () => svara(k, s, i, { right: p.b01 === "forst" }));
        else efter(700 + n * 60, () => svara(k, s, i, { right: p.andra === "ratt" || (p.andra === "halv" && n % 2 === 0) }));
      });
    }
    await Promise.all(jobb);
  });

  const s = await slut;
  unsub();
  clearInterval(puls);
  console.log(`sessionen slut (${s.status}) – ${klienter.length} klienter kopplas ner`);
  await Promise.all(klienter.map((k) => terminate(k.db).catch(() => {})));
  process.exit(0);
}

// ---------------------------------------------------------------------------
console.error("okänt kommando");
process.exit(1);
