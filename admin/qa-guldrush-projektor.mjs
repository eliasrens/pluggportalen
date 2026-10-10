// ============================================================================
// QA (#565): Guldrushens Skattkammare i en riktig (huvudlös) Chromium via
// DevTools-protokollet – skärmdumpar i realtid (inga virtuella klockor) och
// mätningar i förhandsvisningen preview-guldrush-skattkammare.html (låtsas-
// data, ingen Firestore). Inga beroenden: Node 22 (global WebSocket) + en
// chromium i PATH.
//
//   node admin/qa-guldrush-projektor.mjs <steg.json> [--port 8565] [--ut dir] [--jpeg]
//
// steg.json = [{ "namn": "kammare-1920", "w": 1920, "h": 1080,
//                "url": "fas=kammare", "vanta": 4000, "js": "…valfritt…",
//                "reduced": false, "mat": "…uttryck som loggas…" }, …]
//   "full": "http://127.0.0.1:8569/#/…" i stället för url = riktiga appen mot
//   emulatorerna (admin/qa-guldrush-preview.sh). Profilen (/tmp/gr565-profil)
//   ligger kvar mellan stegen, så ett inloggningssteg räcker:
//   { "namn": "login", "full": "http://127.0.0.1:8569/#/", "js": "…fyll #u/#p…" }
//   "ingenBild": true hoppar över skärmdumpen. "behall": true – nästa steg i
//   samma flik (lärarinloggningen gäller bara fliken).
// Varje steg: ny flik i rätt storlek → url (+ &panel=av) → väntar → kör js
// (async, i sidan) → väntar "efter" ms → skärmdump <ut>/<namn>.png. "mat"
// utvärderas och skrivs ut (JSON) – t.ex. antal poster i flödet.
// ============================================================================

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const steps = JSON.parse(readFileSync(args[0], "utf8"));
const port = opt("--port", "8565");
const ut = opt("--ut", "/tmp/gr565");
const jpeg = args.includes("--jpeg");
mkdirSync(ut, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dbg = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${dbg}`, "--user-data-dir=/tmp/gr565-profil", "about:blank"], { stdio: "ignore" });
let ver = null;
for (let i = 0; i < 50 && !ver; i++) {
  await sleep(200);
  ver = await fetch(`http://127.0.0.1:${dbg}/json/version`).then((r) => r.json()).catch(() => null);
}
if (!ver) { chrome.kill(); throw new Error("chromium startade inte"); }

const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const wait = new Map();
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id;
  wait.set(i, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});

try {
  let kept = null; // { targetId, sessionId } – "behall": nästa steg i samma flik
  for (const s of steps) {
    const { targetId } = kept || await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = kept || await send("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    if (!kept) {
      await S("Page.enable");
      await S("Runtime.enable");
    }
    kept = null;
    await S("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: false });
    if (s.reduced) await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await S("Page.navigate", { url: s.full || `http://localhost:${port}/preview-guldrush-skattkammare.html?${s.url}&panel=av` });
    await sleep(s.vanta ?? 4000);
    if (s.js) {
      const r = await S("Runtime.evaluate", { expression: `(async () => { ${s.js} })()`, awaitPromise: true });
      if (r.exceptionDetails) console.log(s.namn, "js-fel:", r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    if (s.efter) await sleep(s.efter);
    if (s.mat) {
      const r = await S("Runtime.evaluate", { expression: `(async () => (${s.mat}))()`, awaitPromise: true, returnByValue: true });
      console.log(s.namn, JSON.stringify(r.result.value));
    }
    if (!s.ingenBild) {
      const shot = await S("Page.captureScreenshot", jpeg ? { format: "jpeg", quality: 82 } : { format: "png" });
      const fil = `${ut}/${s.namn}.${jpeg ? "jpg" : "png"}`;
      writeFileSync(fil, Buffer.from(shot.data, "base64"));
      console.log("✓", fil);
    }
    if (s.behall) kept = { targetId, sessionId };
    else await send("Target.closeTarget", { targetId });
  }
} finally {
  ws.close();
  chrome.kill();
}
