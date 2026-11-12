// ============================================================================
// Kurragömma (#841, slut-QA): KVOTMÄTNING mot Firestore- + Realtime Database-
// EMULATORN (spec §5.5: < 8 000 Firestore-läsningar INKL. serverns, < 6 000
// skrivningar och < 50 MB nedladdat ur Realtime Database per 10-minutersmatch
// med 25 elever). Förebild: admin/ms-kvot-sim.mjs (Meteorstormen).
//
// Demots robotar (kg-demo-robotar.js: gömmare går till ett gömställe nära ett
// föremål och låser, svarar var 7–14 s med given träffsäkerhet; sökare vandrar,
// går mot visslingar, pulsar sin pos högst 5/s via samma filter som klienten,
// svarar och letar var 3–6,5 s när lampan är laddad) spelar en hel match mot
// SERVERKÄRNAN (functions/kurragomma-core.js – samma kod som Cloud Functions)
// med styrd klocka: 10 minuter går på någon minut. Projektorn kör kgTick var
// 5:e s och kgStarta efter KÖR!. Allt mäts i emulatorn:
//   • serverns läsningar/skrivningar: Firestore-anropen räknas (en läsning per
//     dokument, minst en per fråga/räknefråga – som Firestores debitering; en
//     skrivning per dokument i set/update/create/delete/transaktion)
//   • klienternas läsningar: RIKTIGA onSnapshot-lyssnare (Admin SDK) på
//     sessionen (25 elever + projektorn + lärarens styrvy) och varje elevs eget
//     kgPlayers (watchMe) – varje levererad ögonblicksbild = en läsning; plus
//     Vissla-panelen öppnad en gång (getGomda) och historiken öppnad en gång
//     (kgPlayers + kgEvents + räknefrågan) efter matchen
//   • Realtime Database: 26 riktiga strömlyssnare (REST text/event-stream på
//     /kg/{sid}, en per elev + projektorn) – bytes som faktiskt skickas till
//     klienterna räknas (klienten lyssnar på pos, hand och status; roll/med är
//     några byte extra). Serverns tick-läsning (roll + pos) räknas separat.
//   Kärnans egna dokument (players-puls, lobby, kvitton) räknas inte – de är
//   desamma i alla format.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:P FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:Q \
//     node admin/kg-kvot-sim.mjs --elever 25 --min 10 --ratt 0.65 --gomtid 30 \
//       --startsokare 1 --tystnad 1 --instanser 1 --seed 1 --steg 200 --md [--logg]
//   --logg skriver varje sökning (t, uid, x, z, hittade) till stderr: mätningen är
//   INTE deterministisk mellan körningar (kgPlayers-lyssnarnas leverans avgör i
//   vilket klocksteg en hittad robot byter roll), så före/efter en kodändring
//   jämförs bara körningar med identisk logg (#841 §2.1, #842).
// ============================================================================

import admin from "firebase-admin";
import { starta, anslut, las, svara, leta, tick, avsluta, nyttMinne } from "../functions/kurragomma-core.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { kollidera, gomstalleNaraForemal } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import { MAX_FART, TICK_MS, VISSLING_FONSTER_MS, VISSLING_OSAKERHET_M } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { skapaPosFilter } from "../src/live/formats/kurragomma/kg-kanal.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";
import { skapaRaknandeFirestore, raknaRtdb } from "./kvot-raknare.mjs";

const arg = (namn, std) => {
  const i = process.argv.indexOf(`--${namn}`);
  if (i < 0) return std;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const ELEVER = Number(arg("elever", 25));
const MIN = Number(arg("min", 10));
const RATT = Number(arg("ratt", 0.65));
const GOMTID = Number(arg("gomtid", 30));
const STARTSOKARE = Number(arg("startsokare", 1));
const TYSTNAD = String(arg("tystnad", "1")) !== "0";
const INSTANSER = Number(arg("instanser", 1));
const SEED = Number(arg("seed", 1));
const STEG_MS = Number(arg("steg", 200));
const MD = arg("md", false) === true;
const DEBUG = arg("debug", false) === true;
const LOGG = arg("logg", false) === true;
const logg = (rad) => { if (LOGG) console.error(rad); };

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  console.error("Sätt FIRESTORE_EMULATOR_HOST och FIREBASE_DATABASE_EMULATOR_HOST (kör i emulatorerna) – mätningen ska aldrig gå mot produktion.");
  process.exit(1);
}
const NS = `${PROJECT_ID}-default-rtdb`;
const app = admin.initializeApp({ projectId: PROJECT_ID, databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${NS}` }, "kg-kvot");
const rawDb = app.firestore();
const rtdb = app.database();
const { FieldValue, Timestamp } = admin.firestore;

// ---- Räknande Firestore (serverns anrop) och RTDB-läsningar (kvot-raknare.mjs) -------
function slag(v) {
  const p = String(v);
  const m = p.match(/(kgPlayers|kgSelf|kgSecret|kgEvents|kgPublic|kgPrivate|answers|players)(\/[^/]*)?$/);
  if (m) return m[1];
  return p === "liveSessions" || (p.includes("liveSessions/") && p.split("/").length === 2) ? "session" : p;
}
const { db, server } = skapaRaknandeFirestore(rawDb, slag);
const rtdbServer = raknaRtdb(rtdb);

// ---- Matchen ---------------------------------------------------------------------
const sid = `kgkvot-${Date.now().toString(36)}`;
const LARARE = { uid: "larare-kvot", teacher: true };
const elever = Array.from({ length: ELEVER }, (_, i) => `e${i + 1}`);
const START = Date.now() - 60_000;
const T0 = START + 4000; // KÖR!
const GOMSLUT = T0 + GOMTID * 1000;
const SLUT = GOMSLUT + MIN * 60_000;
let klocka = T0;
const minnen = Array.from({ length: INSTANSER }, () => nyttMinne());
const prng = skapaPrng(SEED);
const rng = () => prng.tal();
const mellan = (lo, hi) => lo + (hi - lo) * rng();
const deps = () => ({
  db, rtdb, FieldValue, Timestamp, now: () => klocka, rng,
  minne: minnen[Math.floor(rng() * minnen.length)],
  roll: async (a) => (a?.teacher ? { role: "admin" } : null),
});

await rawDb.doc(`liveSessions/${sid}`).set({
  name: "Kvotmätning", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: GOMTID + MIN * 60, countdownSeconds: 4,
  status: "live", createdBy: LARARE.uid, kgInstallningar: { gomtid: GOMTID, startsokare: STARTSOKARE, tystnad: TYSTNAD, karta: "on" },
  showNames: true, startedAt: Timestamp.fromMillis(START), rewards: { firstPrize: 20, perCorrect: 1, cap: 100 },
});
for (const uid of elever) {
  await rawDb.doc(`liveSessions/${sid}/players/${uid}`).set({
    uid, classId: "4b", name: uid.toUpperCase(), correct: 0, incorrect: 0,
    joinedAt: Timestamp.fromMillis(START - 10_000), lastSeenAt: Timestamp.fromMillis(T0),
  });
}

// ---- Klienternas riktiga lyssnare ---------------------------------------------------
const klient = { session: 0, kgPlayers: 0, panel: 0, historik: 0 };
const stopp = [];
const robotar = new Map();
let sessionSnaps = 0;
stopp.push(rawDb.doc(`liveSessions/${sid}`).onSnapshot(() => { sessionSnaps++; }));
for (const uid of elever) {
  stopp.push(rawDb.doc(`liveSessions/${sid}/kgPlayers/${uid}`).onSnapshot((s) => {
    klient.kgPlayers++;
    const r = robotar.get(uid);
    const d = s.data();
    if (!r || !d) return;
    if (d.roll === "sokare" && r.roll !== "sokare") blirSokare(r, d.hittadAv ? r.gomstalle : null);
    r.laddningar = d.laddningar | 0;
    r.harLast = !!d.harLast;
  }));
}

// Realtime Database: 26 strömlyssnare på /kg/{sid} (eleverna + projektorn).
const RTDB_LYSSNARE = ELEVER + 1;
let rtdbBytes = 0;
let rtdbHandelser = 0;
const strommar = [];
async function strom() {
  const ac = new AbortController();
  const res = await fetch(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/kg/${sid}.json?ns=${NS}`, {
    headers: { Accept: "text/event-stream", Authorization: "Bearer owner" }, signal: ac.signal,
  });
  const reader = res.body.getReader();
  (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        rtdbBytes += value.byteLength;
        rtdbHandelser += (Buffer.from(value).toString("latin1").match(/^event: /gm) || []).length;
      }
    } catch { /* avbruten */ }
  })();
  return ac;
}
for (let i = 0; i < RTDB_LYSSNARE; i++) strommar.push(await strom());
const rawRef = rtdb.ref.bind(rtdb);

// ---- Robotarna (som kg-demo-robotar.js) --------------------------------------------
const FART = 0.55;
const SVAR_MS = [7000, 14000];
const LETA_MS = [3000, 6500];
let nr = 0;
let vissling = null; // senaste visslingen { x, z, t } (hörs av alla sökare)
const stat = { svar: 0, ratt: 0, fel: 0, visslingar: 0, sokningar: 0, traffar: 0, nekade: 0, posSkick: 0, ticks: 0, lasningar: 0, fel2: {} };
const felet = (e) => { const k = `${e?.code || "okänt"}: ${e?.message || e}`; stat.fel2[k] = (stat.fel2[k] || 0) + 1; };

for (const uid of elever) {
  robotar.set(uid, { uid, roll: null, x: 0, z: 0, yaw: 0, mal: null, stilla: 0, harLast: false, laddningar: 0, gomstalle: null, nastaSvar: 0, nastaLeta: 0, lastar: false, malVissling: 0, filter: null });
}
function blirSokare(r, fran) {
  r.roll = "sokare";
  r.mal = null;
  const sp = fran || r.gomstalle || ON.sokarStart;
  r.x = sp.x; r.z = sp.z;
  r.filter = skapaPosFilter({ nu: () => klocka });
  r.nastaLeta = klocka + mellan(...LETA_MS);
}
function ga(r, dt) {
  if (!r.mal) return;
  r.yaw = Math.atan2(r.mal.x - r.x, r.mal.z - r.z);
  const s = MAX_FART * FART * dt;
  const p = kollidera(r.x + Math.sin(r.yaw) * s, r.z + Math.cos(r.yaw) * s, ON);
  r.stilla = Math.hypot(p.x - r.x, p.z - r.z) < s * 0.2 ? r.stilla + dt : 0;
  r.x = p.x; r.z = p.z;
}
const framme = (r) => !r.mal || Math.hypot(r.mal.x - r.x, r.mal.z - r.z) < 0.4 || r.stilla > 0.8;
async function svar(r, korrekt) {
  const a = Math.floor(rng() * 11);
  const b = Math.floor(rng() * 11);
  nr++;
  stat.svar++;
  try {
    const res = await svara(deps(), r.uid, { sid, attemptId: `${r.uid}_${nr}_${klocka.toString(36)}`, factorA: a, factorB: b, answer: String(korrekt ? a * b : a * b + 1 + Math.floor(rng() * 3)) });
    if (res.correct) stat.ratt++; else stat.fel++;
    if (Number.isFinite(res.laddningar)) r.laddningar = res.laddningar;
    if (res.vissling) {
      stat.visslingar++;
      const g = r.gomstalle || r;
      const v = rng() * 6.28;
      const d = rng() * VISSLING_OSAKERHET_M;
      vissling = { x: g.x + Math.sin(v) * d, z: g.z + Math.cos(v) * d, t: klocka };
    }
  } catch (e) { felet(e); }
}
const fas = () => (klocka < GOMSLUT ? "gom" : "leta");
// Anropen väntas in ett i taget (som ett elevanrop i taget per skärm): samma antal läsningar
// och skrivningar, men emulatorns transaktioner slipper låskrockar (ABORTED) från hundratals
// samtidiga anrop i samma klocksteg.
async function gommare(r, nu, dt) {
  if (fas() === "gom" && !r.harLast) {
    if (!r.mal) {
      r.mal = gomstalleNaraForemal(ON, rng);
      const start = ON.gomStart[Math.floor(rng() * ON.gomStart.length)];
      r.x = start.x; r.z = start.z;
    }
    ga(r, dt);
    if (framme(r) && !r.lastar) {
      r.lastar = true;
      stat.lasningar++;
      try {
        const u = await las(deps(), r.uid, { sid, x: r.x, z: r.z });
        if (u?.gomstalle) { r.gomstalle = u.gomstalle; r.x = u.gomstalle.x; r.z = u.gomstalle.z; r.harLast = true; }
      } catch (e) { felet(e); }
      r.lastar = false;
    }
    return;
  }
  if (fas() !== "leta") return;
  if (!r.nastaSvar) r.nastaSvar = nu + mellan(...SVAR_MS);
  if (nu >= r.nastaSvar) { r.nastaSvar = nu + mellan(...SVAR_MS); await svar(r, rng() < RATT); }
}
async function sokare(r, nu, dt) {
  const ny = vissling && nu - vissling.t < VISSLING_FONSTER_MS && r.malVissling !== vissling.t;
  if (ny && rng() < 0.6) { r.mal = { x: vissling.x, z: vissling.z }; r.malVissling = vissling.t; r.stilla = 0; }
  else if (framme(r)) { const a = rng() * 6.28; const d = 3 + rng() * (ON.radie - 5); r.mal = { x: Math.cos(a) * d, z: Math.sin(a) * d }; r.stilla = 0; }
  if (fas() === "leta") ga(r, dt);
  if (r.filter?.prova({ x: r.x, z: r.z, yaw: r.yaw })) {
    stat.posSkick++;
    rawRef(`kg/${sid}/pos/${r.uid}`).set({ x: r.x, z: r.z, yaw: r.yaw, t: nu }).catch(() => null);
  }
  if (!r.nastaSvar) r.nastaSvar = nu + mellan(...SVAR_MS) * 0.7;
  if (nu >= r.nastaSvar) { r.nastaSvar = nu + mellan(...SVAR_MS) * 0.7; await svar(r, rng() < RATT + 0.1); }
  if (fas() === "leta" && r.laddningar > 0 && nu >= r.nastaLeta) {
    r.nastaLeta = nu + mellan(...LETA_MS);
    stat.sokningar++;
    try {
      const u = await leta(deps(), r.uid, { sid, x: r.x, z: r.z });
      logg(`LETA t+${((nu - T0) / 1000) | 0} ${r.uid} ${r.x.toFixed(2)} ${r.z.toFixed(2)} -> ${(u?.hittade || []).map((h) => h.uid).join(",") || "-"}`);
      if (Number.isFinite(u?.laddningar)) r.laddningar = u.laddningar;
      stat.traffar += u?.hittade?.length || 0;
      for (const h of u?.hittade || []) { const hr = robotar.get(h.uid); if (hr && hr.roll !== "sokare") blirSokare(hr, { x: h.x, z: h.z }); }
    } catch (e) { stat.nekade++; felet(e); logg(`LETA t+${((nu - T0) / 1000) | 0} ${r.uid} FEL ${e?.code || e?.message}`); }
  }
}

// ---- Kör ---------------------------------------------------------------------------
const tid0 = Date.now();
klocka = T0 + 1000;
await starta(deps(), LARARE, { sid });
for (const uid of elever) {
  const a = await anslut(deps(), uid, { sid });
  const r = robotar.get(uid);
  r.roll = a.roll;
  r.laddningar = a.laddningar | 0;
  if (a.roll === "sokare") blirSokare(r, a.start || ON.sokarStart);
}
let result = null;
let sist = klocka;
let nastaTick = klocka + TICK_MS;
for (let t = klocka + STEG_MS; t <= SLUT + 6000 && !result; t += STEG_MS) {
  klocka = t;
  const dt = (t - sist) / 1000;
  sist = t;
  if (t < SLUT) { // efter slutet gör eleverna inget (skärmen väntar på resultatet)
    for (const r of robotar.values()) {
      if (r.roll === "gomd") await gommare(r, t, dt);
      else if (r.roll === "sokare") await sokare(r, t, dt);
    }
  }
  if (t >= nastaTick) {
    nastaTick = t + TICK_MS;
    stat.ticks++;
    if (DEBUG) console.error(`t+${((t - T0) / 1000) | 0}s`, [...robotar.values()].filter((r) => r.roll === "sokare").map((r) => `${r.uid} ladd=${r.laddningar} nästaLeta=+${((r.nastaLeta - t) / 1000) | 0}s`).join(" | "));
    try {
      const u = await tick(deps(), LARARE, { sid });
      if (u?.result) result = u.result;
      if (u?.nySokare) { const r = robotar.get(u.nySokare); if (r && r.roll !== "sokare") blirSokare(r, r.gomstalle); }
    } catch (e) { felet(e); }
  }
  await new Promise((res) => setImmediate(res)); // lyssnarna och RTDB-skrivningarna får köra
}
if (!result) {
  klocka = SLUT + 2000;
  result = (await avsluta(deps(), LARARE, { sid })).result;
}
// Lyssnarna hinner ikapp.
await new Promise((res) => setTimeout(res, 3000));
stopp.forEach((f) => f());
for (const ac of strommar) ac.abort();

// Läraren öppnar Vissla-panelen en gång (getGomda) och historiken en gång efteråt.
klient.panel = (await rawDb.collection(`liveSessions/${sid}/kgPlayers`).where("roll", "==", "gomd").get()).size;
klient.historik = ELEVER + (await rawDb.collection(`liveSessions/${sid}/kgEvents`).get()).size + 1;
klient.session = sessionSnaps * (ELEVER + 2);
const klientLas = klient.session + klient.kgPlayers + klient.panel + klient.historik;
const sek = ((Date.now() - tid0) / 1000).toFixed(0);
const MB = (b) => (b / 1e6).toFixed(2);

const rader = [
  ["Elever / speltid / träffsäkerhet", `${ELEVER} / ${MIN} min (+ gömtid ${GOMTID} s) / ${Math.round(RATT * 100)} %`],
  ["Svar (rätt / fel) · visslingar", `${stat.svar} (${stat.ratt} / ${stat.fel}) · ${stat.visslingar}`],
  ["Sökningar (träffar) · låsningar · ticks", `${stat.sokningar} (${stat.traffar}) · ${stat.lasningar} · ${stat.ticks}`],
  ["Resultat: hittade / klarade sig / gömda kvar", `${result.hittade} / ${result.klaradeSig} / ${result.gomstallen.filter((g) => !g.hittad).length}`],
  ["**Serverns Firestore-läsningar**", `**${server.las}**`],
  ["**Serverns Firestore-skrivningar**", `**${server.skriv}**`],
  [`Klienternas läsningar: sessionen (${sessionSnaps} ögonblicksbilder × ${ELEVER + 2} skärmar)`, klient.session],
  ["Klienternas läsningar: eget kgPlayers (watchMe, 25 lyssnare)", klient.kgPlayers],
  ["Klienternas läsningar: Vissla-panelen (1 öppning) + historiken (1 öppning)", `${klient.panel} + ${klient.historik}`],
  ["**Klienternas läsningar totalt**", `**${klientLas}**`],
  ["**Läsningar totalt (server + klienter)** – budget 8 000", `**${server.las + klientLas}**`],
  ["**Skrivningar totalt** – budget 6 000", `**${server.skriv}**`],
  [`Realtime Database: nedladdat av ${RTDB_LYSSNARE} lyssnare (pos-skick ${stat.posSkick}, händelser i strömmen ${rtdbHandelser})`, `${MB(rtdbBytes)} MB – budget 50 MB`],
  ["Realtime Database: serverns läsningar (kgTick roll + pos)", `${rtdbServer.las} st, ${MB(rtdbServer.bytes)} MB`],
  ["Nekade anrop (fel: antal)", Object.entries(stat.fel2).map(([k, v]) => `${k} × ${v}`).join("; ") || "–"],
  ["Väggtid", `${sek} s`],
];
if (MD) {
  console.log(`| ${ELEVER} elever, ${MIN} min, ${INSTANSER} instans(er), seed ${SEED} | |\n| --- | --- |`);
  for (const [a, b] of rader) console.log(`| ${a} | ${b} |`);
  console.log("\nServerns anrop per sort:\n");
  console.log("| Sort | Antal |\n| --- | --- |");
  for (const [k, v] of Object.entries(server.perSort).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${v} |`);
} else {
  for (const [a, b] of rader) console.log(`${a.replace(/\*\*/g, "")}: ${String(b).replace(/\*\*/g, "")}`);
  console.log(server.perSort);
}
rtdb.goOffline();
await app.delete();
process.exit(0);
