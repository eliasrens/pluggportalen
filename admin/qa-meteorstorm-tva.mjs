// ============================================================================
// Meteorstormen (#822): TVÅ PROJEKTORER mot samma session, med simulerad
// nätfördröjning – Elias 2026-10-21: "visa att bilden är jämn och identisk på
// två projektorer". Bara emulator, inga beroenden utöver Node 22, java och
// chromium.
//
//   flock /tmp/pp-821-emulator.lock node admin/qa-meteorstorm-tva.mjs \
//     [--latens 300,1500] [--sek 90] [--ut docs/meteorstormen-822] [--java /tmp/j742/jdk…/bin/java]
//
// Gör så här:
//   1. Firestore-emulatorn (jar:en i ~/.cache/firebase/emulators) på en slumpad
//      port, med ÖPPNA QA-regler (det här testar renderingen och nätet, inte
//      reglerna – dem testar test:rules) + admin/qa-emulator-proxy.mjs på en
//      slumpad port (firebase-config → emulatorn, samma origin).
//   2. En pågående Klass mot klass-session (5 min, 4B mot 4D, 20 + 20 elever)
//      som pågått ~3 min: historiken skrivs i ett svep (som när en lärare
//      öppnar projektorn mitt i matchen), sedan nya msEvents i realtid som
//      servern skriver dem ({uid}_{nr}, t = serverns tid när den skrivs, ibland
//      en typ "fel"-länk). Stormens final hamnar inom mätningen.
//   3. Två huvudlösa Chromium-flikar med den RIKTIGA projektorn
//      (preview/qa-meteorstorm-projektor.html → projector.js → live-feed +
//      meteorstorm-data.js) – flik A med --latens[0] ms, flik B med --latens[1] ms
//      (DevTools Network.emulateNetworkConditions på varje anrop/long-poll,
//      påslagen när sidan laddat).
//   4. Var 3:e sekund: båda flikarna ritar bildrutan för SAMMA t i en egen
//      canvas (__mspProjektor.avtryckVid(t)) – t = det som visas just nu (den
//      äldre av flikarnas t) och t = nu − 10 s – och fingeravtrycken jämförs.
//      Skadescenariot (vad som VISADES och ändrades i efterhand):
//      admin/qa-meteorstorm-tva-revision.mjs.
//   5. Slutet: varje fliks stat() – "sena" (handlingar som kom efter att deras
//      tid redan ritats), "bakat" (bildrutor där t gick bakåt – ska vara 0),
//      största ryck i t mot verklig tid – och fps. Skärmdumpar av båda flikarna
//      frysta på samma t → <ut>/tva-a.jpg, tva-b.jpg.
// ============================================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROT = fileURLToPath(new URL("..", import.meta.url));
const LATENS = opt("--latens", "300,1500").split(",").map(Number);
const SEK = Number(opt("--sek", "90"));
const UT = opt("--ut", "");
const JAVA = opt("--java", existsSync("/tmp/j742/jdk-21.0.12.1+1-jre/bin/java") ? "/tmp/j742/jdk-21.0.12.1+1-jre/bin/java" : "java");
const JAR = join(homedir(), ".cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar");
const PROJ = "pluggportalen-so-2026";
const SID = "qa822";
const rnd = (a) => a + Math.floor(Math.random() * 15000);
const FS = rnd(30000);
const PROXY = rnd(46000);
const DBG = rnd(15000);
const dir = `/tmp/msp-tva-${FS}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/qa.rules`, "rules_version = '2';\nservice cloud.firestore { match /databases/{db}/documents { match /{d=**} { allow read, write: if true; } } }\n");

const barn = [];
const stang = () => barn.forEach((b) => { try { b.kill("SIGKILL"); } catch {} });
process.on("exit", stang);
const starta = (cmd, a, env = {}) => { const b = spawn(cmd, a, { cwd: ROT, env: { ...process.env, ...env }, stdio: "ignore" }); barn.push(b); return b; };

// --- Firestore via REST -----------------------------------------------------------
const BAS = `http://127.0.0.1:${FS}/v1/projects/${PROJ}/databases/(default)/documents`;
const H = { "Content-Type": "application/json", Authorization: "Bearer owner" };
const varde = (v) => {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === "number") return { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(varde) } };
  return { mapValue: { fields: falt(v) } };
};
const falt = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, varde(v)]));
async function commit(dokument) {
  for (let i = 0; i < dokument.length; i += 400) {
    const writes = dokument.slice(i, i + 400).map(([sokvag, data]) => ({ update: { name: `projects/${PROJ}/databases/(default)/documents/${sokvag}`, fields: falt(data) } }));
    const r = await fetch(`${BAS}:commit`, { method: "POST", headers: H, body: JSON.stringify({ writes }) });
    if (!r.ok) throw new Error(`commit ${r.status}: ${await r.text()}`);
  }
}

// --- eleverna: rätt svar → en händelse, som msAgera skriver den --------------------
let fro = 822;
const slump = () => ((fro = (Math.imul(fro, 1103515245) + 12345) >>> 0) / 4294967296);
const elever = [];
for (const [c, p] of [["4b", 0.7], ["4d", 0.6]]) for (let k = 1; k <= 20; k++) elever.push({ uid: `${c}-e${k}`, classId: c, namn: `${c.toUpperCase()} elev ${k}`, p, nr: 0, fel: 0, nasta: 0 });
function handelse(e, t) {
  if (slump() >= e.p) {
    if (++e.fel < 25) return null;
    e.fel = 0;
    return [`liveSessions/${SID}/msEvents/${e.uid}_${++e.nr}`, { uid: e.uid, classId: e.classId, namn: e.namn, t, typ: "fel", nr: e.nr, energi: 0 }];
  }
  const typ = slump() < 0.04 ? "drag" : slump() < 0.5 ? "laser" : "skold";
  return [`liveSessions/${SID}/msEvents/${e.uid}_${++e.nr}`, { uid: e.uid, classId: e.classId, namn: e.namn, t, typ, nr: e.nr, energi: 1 }];
}

// --- CDP ----------------------------------------------------------------------------
let ws;
let id = 0;
const vantar = new Map();
const send = (sock, method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id;
  vantar.set(i, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
  sock.send(JSON.stringify({ id: i, method, params, sessionId }));
});
async function flik(latens) {
  const sock = ws;
  const { targetId } = await send(sock, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send(sock, "Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(sock, m, p, sessionId);
  await S("Page.enable");
  await S("Network.enable");
  await S("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await S("Page.navigate", { url: `http://127.0.0.1:${PROXY}/preview/qa-meteorstorm-projektor.html?sid=${SID}` });
  const js = async (expr) => {
    const r = await S("Runtime.evaluate", { expression: `(async () => (${expr}))()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  // Fördröjningen slås på när sidan laddat (annars tar 200 moduler × 1,5 s minuter):
  // det som mäts är händelsernas väg Firestore → projektorn (varje long-poll).
  const latensPa = () => S("Network.emulateNetworkConditions", { offline: false, latency: latens, downloadThroughput: -1, uploadThroughput: -1 });
  return { S, js, latens, targetId, latensPa };
}

try {
  starta(JAVA, ["-Xmx512m", "-jar", JAR, "--host", "127.0.0.1", "--port", String(FS), "--rules", `${dir}/qa.rules`, "--project_id", PROJ]);
  for (let i = 0; i < 100; i++) { if (await fetch(`http://127.0.0.1:${FS}/`).then(() => true).catch(() => false)) break; await sleep(300); }
  starta("node", ["admin/qa-emulator-proxy.mjs"], { PORT: String(PROXY), FIRESTORE_EMULATOR_HOST: `127.0.0.1:${FS}`, GCLOUD_PROJECT: PROJ });

  // session: 5 min, startad för ~3 min sedan → finalen inom mätningen
  const nu = Date.now();
  const forbi = Math.max(0, 300 - SEK - 40) * 1000; // ~40 s till mätningen börjar → finalen mitt i
  const t0 = nu - forbi;
  await commit([[`liveSessions/${SID}`, {
    name: "QA 4B mot 4D (#822)", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" }, durationSeconds: 300, countdownSeconds: 4,
    status: "live", createdBy: "qa", startedAt: new Date(t0 - 4000), msSeed: 8220, showNames: true,
    msInstallningar: { lage: "klass-mot-klass", attacker: "milda" }, msStationer: [{ classId: "4b", aktiva: 20 }, { classId: "4d", aktiva: 20 }],
  }]]);
  for (const e of elever) e.nasta = t0 + 500 + slump() * 8000;
  const historik = [];
  for (;;) {
    const e = elever.reduce((a, b) => (b.nasta < a.nasta ? b : a));
    if (e.nasta >= nu) break;
    const h = handelse(e, Math.round(e.nasta));
    if (h) historik.push(h);
    e.nasta += 6000 + slump() * 4000;
  }
  await commit(historik);

  // Två webbläsare = två klassrum (en flik i bakgrunden får inga bildrutor).
  const webblasare = async (n) => {
    const port = DBG + n;
    starta("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}/profil-${n}`, "about:blank"]);
    let ver = null;
    for (let i = 0; i < 60 && !ver; i++) { await sleep(250); ver = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null); }
    if (!ver) throw new Error("chromium startade inte");
    const w = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise((r) => w.addEventListener("open", r, { once: true }));
    w.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && vantar.has(d.id)) { vantar.get(d.id)(d); vantar.delete(d.id); } });
    return w;
  };
  const wsA = await webblasare(0);
  const wsB = await webblasare(1);
  ws = wsA;
  const A = await flik(LATENS[0]);
  ws = wsB;
  const B = await flik(LATENS[1] ?? LATENS[0]);
  for (let i = 0; i < 60; i++) {
    const ok = await Promise.all([A, B].map((f) => f.js("!!window.__mspProjektor && window.__mspProjektor.stat().handlingar > 0").catch(() => false)));
    if (ok.every(Boolean)) break;
    await sleep(500);
  }
  for (const f of [A, B]) {
    if (await f.js("!!window.__mspProjektor").catch(() => false)) continue;
    throw new Error(`projektorn (latens ${f.latens} ms) ritar inte: ${await f.js("document.body.innerText.slice(0, 400)").catch((e) => e.message)}`);
  }
  await Promise.all([A, B].map((f) => f.latensPa()));
  await sleep(4000);

  // realtid: nya händelser medan vi jämför
  let skrivna = 0;
  let igang = true;
  const skrivare = (async () => {
    while (igang) {
      const t = Date.now();
      const e = elever.reduce((a, b) => (b.nasta < a.nasta ? b : a));
      if (e.nasta <= t) {
        const h = handelse(e, t);
        e.nasta += 6000 + slump() * 4000;
        if (h) { await commit([h]); skrivna++; }
      } else await sleep(Math.min(200, e.nasta - t));
    }
  })();

  const jamfor = [];
  const slut = Date.now() + SEK * 1000;
  while (Date.now() < slut) {
    await sleep(3000);
    // "visad t" = det äldsta av de två t som projektorerna ritar just nu (efter
    // varsin anpassade buffert); "nu−10 s" = när allt borde ha kommit fram.
    const w = Date.now();
    const visad = Math.min(...(await Promise.all([A, B].map((f) => f.js("window.__mspProjektor.t()")))));
    for (const [namn, T] of [["visad t", visad], ["nu−10 s", w - 10_000]]) {
      const [a, b] = await Promise.all([A, B].map((f) => f.js(`window.__mspProjektor.avtryckVid(${T})`)));
      jamfor.push({ namn, t: T - t0, lika: a.hash === b.hash, a: a.hash, b: b.hash, tillstandLika: a.tillstand === b.tillstand, hA: a.handlingar, hB: b.handlingar });
    }
  }
  igang = false;
  await skrivare;
  const stat = await Promise.all([A, B].map(async (f) => ({ latens: f.latens, ...(await f.js("window.__mspProjektor.stat()")), ...(await f.js("window.__mspProjektor.fps()")) })));

  if (UT) {
    mkdirSync(join(ROT, UT), { recursive: true });
    const T = Date.now() - 4000;
    for (const [f, namn] of [[A, "tva-a"], [B, "tva-b"]]) {
      await f.js(`window.__mspProjektor.frys(${T})`);
      await sleep(400);
      const { data } = await f.S("Page.captureScreenshot", { format: "jpeg", quality: 85 });
      writeFileSync(join(ROT, UT, `${namn}.jpg`), Buffer.from(data, "base64"));
    }
  }
  const sammanfatt = (namn) => { const l = jamfor.filter((j) => j.namn === namn); return `${l.filter((j) => j.lika).length}/${l.length} identiska`; };
  console.log(JSON.stringify({
    latens: LATENS, sekunder: SEK, historik: historik.length, nyaHandelser: skrivna,
    "samma t, pixlar": { "visad t": sammanfatt("visad t"), "nu−10 s": sammanfatt("nu−10 s") },
    leverans: stat.map((x) => ({ nominell: x.latens, ...x.leverans, sena: x.sena, bakat: x.bakat })),
    projektorer: stat, olika: jamfor.filter((j) => !j.lika),
  }, null, 2));
  wsA.close();
  wsB.close();
} finally {
  stang();
}
