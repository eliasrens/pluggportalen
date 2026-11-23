// ============================================================================
// QA #913: minimal CDP-drivare (Node 22, inbyggd WebSocket) mot en egen headless
// Chromium – ingen npm-modul. Används av mat.mjs (pixeldiff, bländtest, fps,
// längsta uppgift). Varje anrop startar en egen Chromium med egen profil.
// ============================================================================
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function startaChromium({ w = 1366, h = 768, dpr = 1 } = {}) {
  const prof = mkdtempSync(join(tmpdir(), "t913-chr-"));
  const p = spawn("chromium", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${prof}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
    `--window-size=${w},${h}`, `--force-device-scale-factor=${dpr}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = "";
    const t = setTimeout(() => rej(new Error("chromium startade inte")), 20000);
    p.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\S+)/);
      if (m) { clearTimeout(t); res(m[1]); }
    });
  });
  const port = new URL(wsUrl).port;
  const lista = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const sida = lista.find((x) => x.type === "page");
  const ws = new WebSocket(sida.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const vantar = new Map();
  const lyss = new Set();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && vantar.has(m.id)) {
      const { res, rej } = vantar.get(m.id);
      vantar.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method) for (const f of lyss) f(m);
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    vantar.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  const api = {
    send,
    on: (f) => { lyss.add(f); return () => lyss.delete(f); },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async goto(url) {
      const klar = new Promise((r) => { const av = api.on((m) => { if (m.method === "Page.loadEventFired") { av(); r(); } }); });
      await send("Page.navigate", { url });
      await klar;
    },
    async vanta(expr, ms = 30000) {
      const slut = Date.now() + ms;
      while (Date.now() < slut) {
        try { if (await api.eval(expr)) return true; } catch { /* sidan laddar */ }
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("timeout: " + expr);
    },
    async bild({ hel = false, jpg = false } = {}) {
      const opt = { format: jpg ? "jpeg" : "png", ...(jpg ? { quality: 82 } : {}) };
      if (hel) {
        const m = await send("Page.getLayoutMetrics");
        const { width, height } = m.cssContentSize || m.contentSize;
        Object.assign(opt, { captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
      }
      const r = await send("Page.captureScreenshot", opt);
      return Buffer.from(r.data, "base64");
    },
    async stang() {
      try { ws.close(); } catch { /* redan stängd */ }
      p.kill("SIGKILL");
      await new Promise((r) => setTimeout(r, 300));
      rmSync(prof, { recursive: true, force: true });
    },
  };
  return api;
}

export const sov = (ms) => new Promise((r) => setTimeout(r, ms));
