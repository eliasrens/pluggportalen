// Minimal CDP-driver (headless chromium, node 22 WebSocket).
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function startBrowser({ w = 1280, h = 800 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cdp909-"));
  const p = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--remote-debugging-port=0", `--user-data-dir=${dir}`, `--window-size=${w},${h}`, "--force-device-scale-factor=1",
    "--font-render-hinting=none", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = "";
    p.stderr.on("data", (d) => { buf += d; const m = buf.match(/ws:\/\/\S+/); if (m) res(m[0]); });
    setTimeout(() => rej(new Error("no ws " + buf)), 20000);
  });
  const port = new URL(wsUrl).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pend = new Map(); const listeners = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method) for (const l of listeners) l(m);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const logs = [];
  listeners.push((m) => {
    if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR " + m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  const api = {
    send, logs,
    async eval(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; },
    async goto(url, wait = 2500) {
      const loaded = new Promise((r) => { const l = (m) => { if (m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
      await send("Page.navigate", { url }); await Promise.race([loaded, new Promise((r) => setTimeout(r, 15000))]);
      await new Promise((r) => setTimeout(r, wait));
    },
    async shot(file) { const { data } = await send("Page.captureScreenshot", { format: "png" }); if (file) (await import("node:fs")).writeFileSync(file, Buffer.from(data, "base64")); return data; },
    async media(features) { await send("Emulation.setEmulatedMedia", { features }); },
    async size(w2, h2) { await send("Emulation.setDeviceMetricsOverride", { width: w2, height: h2, deviceScaleFactor: 1, mobile: w2 < 600 }); },
    close() { try { ws.close(); } catch {} p.kill("SIGKILL"); },
  };
  return api;
}

/** Pixeldiff av två PNG (base64) i webbläsaren: antal olika pixlar. */
export async function pixDiff(b, a64, b64) {
  return b.eval(`(async () => {
    const ld = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); return i; };
    const [x, y] = await Promise.all([ld(${JSON.stringify(a64)}), ld(${JSON.stringify(b64)})]);
    if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
    const c = document.createElement("canvas"); c.width = x.width; c.height = x.height; const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(x, 0, 0); const A = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(y, 0, 0); const B = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
    for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i+1] !== B[i+1] || A[i+2] !== B[i+2]) { n++; const p = i / 4, px = p % c.width, py = (p / c.width) | 0; minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py); }
    return { n, box: n ? [minx, miny, maxx, maxy] : null };
  })()`);
}
