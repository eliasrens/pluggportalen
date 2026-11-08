// ============================================================================
// Meteorstormen (#821): KVOTMÄTNING mot Firestore-EMULATORN (Elias 2026-10-21:
// ≤ 3 000 skrivningar per match, mål ~2 200–2 500, läsningar < 6 000).
//
// Simulerade elever spelar en hel match mot SERVERKÄRNAN (functions/meteorstorm-
// core.js, samma kod som Cloud Functions kör) med elevklienten (ms-klient.js,
// samma buffring som elevskärmen) och en styrd klocka – 10 minuter går på
// någon minut. Allt mäts i emulatorn:
//   • serverns läsningar/skrivningar: Firestore-anropen räknas (en läsning per
//     dokument, minst en per fråga – som Firestores debitering; en skrivning
//     per dokument i set/update/create/transaktion)
//   • projektorernas lyssnare på msEvents och sessionen: riktiga onSnapshot-
//     lyssnare (Admin SDK), varje dokument i en ögonblicksbild = en läsning
//   • elevskärmarna: msLage vid start, status ur svaren och en läsning av
//     msPublic/status bara när inget kommit på 20 s (meteorstorm-data.js
//     skapaStatusvakt), sessionsdokumentet, eget msPlayers efter matchen
//   Kärnans egna dokument (players-puls, lobby, kvitton) räknas inte – de är
//   desamma i alla format.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:PORT node admin/ms-kvot-sim.mjs
//     --elever 25 --klasser 2 --min 10 --takt 8 --ratt 0.7,0.6 --projektorer 2
//     --instanser 1 --lage klass-mot-klass --attacker milda --quiz --md --seed 1 --status 20
// ============================================================================

import admin from "firebase-admin";
import { agera, lage, avsluta, nyttMinne } from "../functions/meteorstorm-core.js";
import { createMsKlient } from "../src/live/formats/meteorstorm/ms-klient.js";
import { skapaPrng } from "../src/live/formats/meteorstorm/delat/ms-prng.js";

const arg = (namn, std) => {
  const i = process.argv.indexOf(`--${namn}`);
  if (i < 0) return std;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const ELEVER = Number(arg("elever", 25));
const KLASSER = Number(arg("klasser", 2));
const MIN = Number(arg("min", 10));
const TAKT = Number(arg("takt", 8)) * 1000;
const RATT = String(arg("ratt", "0.7,0.6")).split(",").map(Number);
const PROJEKTORER = Number(arg("projektorer", 2));
const INSTANSER = Number(arg("instanser", 1));
const LAGE = arg("lage", KLASSER === 1 ? "en-klass" : "klass-mot-klass");
const ATTACKER = arg("attacker", LAGE === "en-klass" ? "av" : "milda");
const QUIZ = arg("quiz", false) === true;
const MD = arg("md", false) === true;
const SEED = Number(arg("seed", 1));
const STATUS_POLL_MS = Number(arg("status", 20)) * 1000; // = meteorstorm-data.js STATUS_INTERVALL_MS

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Sätt FIRESTORE_EMULATOR_HOST (kör i emulatorn) – mätningen ska aldrig gå mot produktion.");
  process.exit(1);
}

const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" }, "ms-kvot");
const rawDb = app.firestore();
const { FieldValue, Timestamp } = admin.firestore;

// ---- Räknande Firestore (serverns anrop) ----------------------------------------
const server = { las: 0, skriv: 0, perSort: {} };
const sort = (namn, n = 1) => { server.perSort[namn] = (server.perSort[namn] || 0) + n; };
const lasN = (snap) => (snap?.docs ? Math.max(1, snap.size) : 1);
const ursprung = new WeakMap();
const ut = (x) => ursprung.get(x) || x;
const SKRIV = ["set", "update", "create", "delete"];
const KEDJA = ["collection", "doc", "where", "orderBy", "limit", "select", "startAfter"];

function vag(t) {
  return t.path || t._queryOptions?.collectionId || "fråga";
}
function slag(v) {
  const p = String(v);
  const m = p.match(/(msEvents|msPlayers|msPublic|msPrivate|msLas|players)(\/[^/]*)?$/);
  return m ? m[1] + (m[1] === "msPublic" && m[2] ? m[2] : "") : p.includes("liveSessions/") && p.split("/").length === 2 ? "session" : p;
}

function omslut(obj) {
  const p = new Proxy(obj, {
    get(t, namn) {
      const v = t[namn];
      if (typeof v !== "function") return v;
      if (namn === "get") {
        return async (...a) => {
          const s = await v.apply(t, a);
          const n = lasN(s);
          server.las += n;
          sort(`läs ${slag(vag(t))}`, n);
          return s;
        };
      }
      if (SKRIV.includes(namn)) {
        return async (...a) => {
          server.skriv++;
          sort(`skriv ${slag(vag(t))}`);
          return v.apply(t, a.map(ut));
        };
      }
      if (KEDJA.includes(namn)) return (...a) => omslut(v.apply(t, a));
      return v.bind(t);
    },
  });
  ursprung.set(p, obj);
  return p;
}

function omslutTx(tx) {
  const w = {
    async get(r) {
      const s = await tx.get(ut(r));
      const n = lasN(s);
      server.las += n;
      sort(`läs ${slag(vag(ut(r)))} (tx)`, n);
      return s;
    },
    async getAll(...rs) {
      const s = await tx.getAll(...rs.map(ut));
      server.las += rs.length;
      for (const r of rs) sort(`läs ${slag(vag(ut(r)))} (tx)`);
      return s;
    },
    ...Object.fromEntries(SKRIV.map((m) => [m, (r, ...a) => {
      server.skriv++;
      sort(`skriv ${slag(vag(ut(r)))} (tx)`);
      tx[m](ut(r), ...a);
      return w;
    }])),
  };
  return w;
}

const db = {
  collection: (...a) => omslut(rawDb.collection(...a)),
  doc: (...a) => omslut(rawDb.doc(...a)),
  async getAll(...rs) {
    server.las += rs.length;
    for (const r of rs) sort(`läs ${slag(vag(ut(r)))}`);
    return rawDb.getAll(...rs.map(ut));
  },
  runTransaction: (fn) => rawDb.runTransaction((tx) => fn(omslutTx(tx))),
};

// ---- Matchen ------------------------------------------------------------------
const sid = `kvot-${Date.now().toString(36)}`;
const klasser = Array.from({ length: KLASSER }, (_, i) => `k${i + 1}`);
const elever = klasser.flatMap((c, ci) => Array.from({ length: ELEVER }, (_, i) => ({ uid: `${c}e${i + 1}`, classId: c, p: RATT[ci] ?? RATT[0] })));
const START = Date.now() - 1000;
const T0 = START;
const END = T0 + MIN * 60_000;
let klocka = T0;
const minnen = Array.from({ length: INSTANSER }, () => nyttMinne());
const rng = skapaPrng(SEED, "kvot");
const deps = () => ({
  db, FieldValue, Timestamp, now: () => klocka, sleep: async () => {},
  minne: minnen[Math.floor(rng.tal() * minnen.length)],
  roll: async (a) => (a?.teacher ? { role: "admin" } : null),
});
const anrop = { msAgera: (d, uid) => agera(deps(), uid, d), msLage: (d, uid) => lage(deps(), uid, d) };

const FRAGOR = 30;
await rawDb.doc(`liveSessions/${sid}`).set({
  name: "Kvotmätning", format: "meteorstorm", gameMode: QUIZ ? "plugga_quiz" : "multiplication_0_10", answerKind: QUIZ ? "choice" : "free",
  participatingClassIds: klasser, classNames: Object.fromEntries(klasser.map((c) => [c, c.toUpperCase()])),
  durationSeconds: MIN * 60, countdownSeconds: 0, status: "live", createdBy: "kvot", msSeed: SEED,
  msInstallningar: { lage: LAGE, attacker: ATTACKER }, showNames: true, startedAt: Timestamp.fromMillis(START),
  rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, ...(QUIZ ? { questionCount: FRAGOR } : {}),
});
if (QUIZ) {
  await rawDb.doc(`liveSessions/${sid}/msPublic/questions`).set({ questions: Array.from({ length: FRAGOR }, (_, i) => ({ id: `q${i}`, text: `Fråga ${i}`, options: ["a", "b", "c", "d"] })) });
  await rawDb.doc(`liveSessions/${sid}/msPrivate/snapshot`).set({ facit: Array.from({ length: FRAGOR }, (_, i) => ({ answerIndex: i % 4 })) });
}
for (const e of elever) {
  await rawDb.doc(`liveSessions/${sid}/players/${e.uid}`).set({ uid: e.uid, classId: e.classId, name: e.uid, joinedAt: Timestamp.fromMillis(START - 30_000) });
}

// Projektorerna: riktiga lyssnare på loggen och sessionen.
const klient = { projektorEvents: 0, projektorSession: 0, elevSession: 0, elevStatus: 0, elevPlayers: 0, quizFragor: 0 };
const stopp = [];
let sessionSnaps = 0;
for (let i = 0; i < PROJEKTORER; i++) {
  stopp.push(rawDb.collection(`liveSessions/${sid}/msEvents`).orderBy("t").onSnapshot((s) => {
    klient.projektorEvents += Math.max(s.docChanges().length, s.docChanges().length ? 0 : 1);
  }));
}
stopp.push(rawDb.doc(`liveSessions/${sid}`).onSnapshot(() => { sessionSnaps++; }));

// Elevskärmarna.
for (const e of elever) {
  e.k = createMsKlient({
    sid, uid: e.uid, seed: SEED, gameMode: QUIZ ? "plugga_quiz" : "multiplication_0_10", antalFragor: FRAGOR,
    call: (namn, d) => (namn === "msRatta" ? import("../functions/meteorstorm-core.js").then((m) => m.ratta(deps(), e.uid, d)) : anrop[namn](d, e.uid)),
    vanta: async (ms) => { klocka += ms; },
  });
  e.kalla = e.k.kalla();
  e.rng = skapaPrng(SEED, e.uid);
  e.nasta = T0 + Math.floor(e.rng.tal() * TAKT);
  e.status = -Infinity;
}
for (const e of elever) await e.k.lage();
const svarTakt = (e) => Math.round(TAKT * (0.75 + 0.5 * e.rng.tal()));

let rattSvar = 0;
let felSvar = 0;
// "blandar" (balanssimuleringen) med elevskärmens status: det andra när en
// mätare är full, spara när båda är det; ibland dragstrålen när energin räcker.
const valj = (e, energi) => {
  const st = e.senast?.stationer?.find((x) => x.classId === e.classId);
  if (LAGE !== "en-klass" && ATTACKER !== "av" && energi >= 2 && st?.drag?.armerad === false && e.rng.tal() < 0.1) return "drag";
  const skoldFull = st && st.skold >= 59.5;
  const laserFull = st && st.laddning >= 9.95;
  if (skoldFull && laserFull) return "spara";
  if (skoldFull) return "laser";
  if (laserFull) return "skold";
  return e.rng.tal() < 0.5 ? "skold" : "laser";
};

const tid0 = Date.now();
for (let t = T0; t < END; t += 1000) {
  klocka = t;
  for (const e of elever) {
    if (e.nasta > t) continue;
    e.nasta = t + svarTakt(e);
    const ratt = e.rng.tal() < e.p;
    const attemptId = `a-${e.uid}-${t}`;
    if (QUIZ) {
      const q = e.k.fraga();
      const r = await e.k.svara({ attemptId, q, choiceIndex: ratt ? q % 4 : (q + 1) % 4 });
      if (!r.correct) { felSvar++; continue; }
    } else {
      const { a, b } = e.kalla.next(); // elevens kortlek (#821 F1)
      const r = await e.k.svara({ attemptId, factorA: a, factorB: b, answer: String(ratt ? a * b : a * b + 1) });
      if (!r.correct) { felSvar++; continue; }
    }
    rattSvar++;
    const res = await e.k.agera(valj(e, e.k.energi));
    if (res.status) { e.status = t; e.senast = res.status; }
  }
  for (const e of elever) {
    if (t - e.status >= STATUS_POLL_MS) {
      e.status = t;
      e.senast = (await rawDb.doc(`liveSessions/${sid}/msPublic/status`).get()).data() || e.senast;
      klient.elevStatus++;
    }
  }
}
klocka = END + 1000;
for (const e of elever) await e.k.skickaFel().catch(() => null);
klocka = END + 5000;
const { result } = await avsluta(deps(), { uid: "kvot", teacher: true }, { sid });
// Lyssnarna hinner ikapp (emulatorn levererar med fördröjning under last).
for (let i = 0; i < 60 && klient.projektorEvents < rattSvar * PROJEKTORER; i++) await new Promise((r) => setTimeout(r, 500));
stopp.forEach((f) => f());
klient.projektorSession = sessionSnaps * PROJEKTORER;
klient.elevSession = sessionSnaps * elever.length;
klient.elevPlayers = elever.length * 2; // lyssnaren: ingen post under matchen, totalerna efteråt
klient.quizFragor = QUIZ ? elever.length + PROJEKTORER : 0; // msPublic/questions en gång per skärm
const klientLas = Object.values(klient).reduce((a, b) => a + b, 0);

const rader = [
  ["Rätta svar (= händelser) / fel svar", `${rattSvar} / ${felSvar}`],
  ["Serverns skrivningar", server.skriv],
  ["Serverns läsningar", server.las],
  ["Projektorernas läsningar (msEvents)", klient.projektorEvents],
  ["Projektorernas läsningar (sessionen)", klient.projektorSession],
  [`Elevernas läsningar (status efter ${STATUS_POLL_MS / 1000} s utan svar)`, klient.elevStatus],
  ["Elevernas läsningar (sessionen, eget msPlayers)", klient.elevSession + klient.elevPlayers],
  ...(QUIZ ? [["Quizets frågor (msPublic/questions, en gång per skärm)", klient.quizFragor]] : []),
  ["Klienternas läsningar totalt", klientLas],
  ["Läsningar totalt (server + klienter)", klientLas + server.las],
  ["Skrivningar totalt", server.skriv],
];
const titel = `${KLASSER} × ${ELEVER} elever, ${MIN} min, svar var ~${TAKT / 1000} s, rätt ${RATT.join("/")}, ${PROJEKTORER} projektorer, ${INSTANSER} instans(er), ${QUIZ ? "quiz" : "multiplikation"}, ${LAGE}/${ATTACKER}`;
if (MD) {
  console.log(`**${titel}**\n\n| | Antal |\n| --- | --- |\n${rader.map(([a, b]) => `| ${a} | ${b} |`).join("\n")}`);
} else {
  console.log(titel);
  for (const [a, b] of rader) console.log(`  ${a.padEnd(48)} ${b}`);
}
console.log(`\nPer sort (servern):\n${Object.entries(server.perSort).sort().map(([k, v]) => `  ${k.padEnd(40)} ${v}`).join("\n")}`);
console.log(`\nVinnare: ${result.winner ?? "–"} · ${result.placering.map((p) => `${p.classId}: skrov ${p.skrov}, nedskjutna ${p.nedskjutna}, ${JSON.stringify(result.perClass[p.classId].handlingar)}`).join(" · ")} · ${((Date.now() - tid0) / 1000).toFixed(1)} s`);
await app.delete();
