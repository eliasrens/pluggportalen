// ============================================================================
// QA (#565): Guldrushens Skattkammare i en riktig (huvudlös) Chromium via
// DevTools-protokollet – skärmdumpar i realtid (inga virtuella klockor) och
// mätningar i förhandsvisningen preview-guldrush-skattkammare.html (låtsas-
// data, ingen Firestore). Inga beroenden: Node 22 (global WebSocket) + en
// chromium i PATH.
//
//   node admin/qa-guldrush-projektor.mjs <steg.json> [--port 8565] [--ut dir]
//
// steg.json = [{ "namn": "kammare-1920", "w": 1920, "h": 1080,
//                "url": "fas=kammare", "vanta": 4000, "js": "…valfritt…",
//                "reduced": false, "mat": "…uttryck som loggas…" }, …]
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
  for (const s of steps) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S("Page.enable");
    await S("Runtime.enable");
    await S("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: false });
    if (s.reduced) await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await S("Page.navigate", { url: `http://localhost:${port}/preview-guldrush-skattkammare.html?${s.url}&panel=av` });
    await sleep(s.vanta ?? 4000);
    if (s.js) await S("Runtime.evaluate", { expression: `(async () => { ${s.js} })()`, awaitPromise: true });
    if (s.efter) await sleep(s.efter);
    if (s.mat) {
      const r = await S("Runtime.evaluate", { expression: `(async () => (${s.mat}))()`, awaitPromise: true, returnByValue: true });
      console.log(s.namn, JSON.stringify(r.result.value));
    }
    const shot = await S("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${ut}/${s.namn}.png`, Buffer.from(shot.data, "base64"));
    console.log("✓", `${ut}/${s.namn}.png`);
    await send("Target.closeTarget", { targetId });
  }
} finally {
  ws.close();
  chrome.kill();
}
