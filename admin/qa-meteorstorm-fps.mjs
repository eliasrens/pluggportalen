// ============================================================================
// Meteorstormen (#822): FPS-MÄTNING av projektorn i en riktig (huvudlös)
// Chromium via DevTools-protokollet. Startar en egen statisk server (slumpad
// port) och demosidan (preview/preview-meteorstorm-demo.html) i stormens
// tyngsta del – finalen, där flest meteorer, explosioner och träffar ritas
// samtidigt – och läser projektorns egna mätare (__mspProjektor.fps()):
//   fps / medelMs / p95Ms   tiden mellan bildrutorna (requestAnimationFrame)
//   ritaMedelMs / ritaP95Ms JS-tiden per bildruta för motorn + hela ritningen
//                           (budgeten för 60 fps är 16,7 ms)
// Inga beroenden: Node 22 (global WebSocket) + chromium i PATH.
//
//   node admin/qa-meteorstorm-fps.mjs [--gpu] [--sek 8]
//   --gpu  utan --disable-gpu (SwiftShader/ANGLE i en maskin utan GPU)
// ============================================================================

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROT = fileURLToPath(new URL("..", import.meta.url));
const MAT_S = Number(opt("--sek", "8"));

const port = 20000 + Math.floor(Math.random() * 20000);
const server = spawn("node", ["server.mjs"], { cwd: ROT, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const dbg = 40000 + Math.floor(Math.random() * 20000);
const flaggor = ["--headless=new", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${dbg}`, `--user-data-dir=/tmp/msp-fps-${dbg}`];
if (!args.includes("--gpu")) flaggor.push("--disable-gpu");
const chrome = spawn("chromium", [...flaggor, "about:blank"], { stdio: "ignore" });
const stang = () => { chrome.kill(); server.kill(); };

try {
  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) {
    await sleep(200);
    ver = await fetch(`http://127.0.0.1:${dbg}/json/version`).then((r) => r.json()).catch(() => null);
  }
  if (!ver) throw new Error("chromium startade inte");
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const vanta = new Map();
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && vanta.has(d.id)) { vanta.get(d.id)(d); vanta.delete(d.id); }
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    vanta.set(i, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  const ut = [];
  for (const [w, h, fall] of [[1920, 1080, "finalen"], [1280, 720, "finalen"], [1920, 1080, "mitten"]]) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S("Page.enable");
    await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    const sek = fall === "finalen" ? 600 - MAT_S - 6 : 300;
    await S("Page.navigate", { url: `http://127.0.0.1:${port}/preview/preview-meteorstorm-demo.html?fas=storm&sek=${sek}&panel=av&ratt=0.45,0.3` });
    await sleep(4000); // laddning + renderingsbufferten
    await S("Runtime.evaluate", { expression: "window.__mspProjektor && (window.__mspProjektor.nollstall?.(), 1)" });
    await sleep(MAT_S * 1000);
    const r = await S("Runtime.evaluate", {
      expression: `(() => { const f = window.__mspProjektor?.fps(); const s = window.__msDemo?.demo.state(); return { ...f, handelser: s?.events.length }; })()`,
      returnByValue: true,
    });
    ut.push({ storlek: `${w}×${h}`, fall, ...r.result.value });
    await send("Target.closeTarget", { targetId });
  }
  console.log(JSON.stringify({ chromium: ver.Browser, gpu: args.includes("--gpu") ? "standard (SwiftShader utan GPU)" : "--disable-gpu (Skia på CPU)", matt: ut }, null, 2));
  ws.close();
} finally {
  stang();
}
