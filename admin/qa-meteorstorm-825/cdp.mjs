// Minimal CDP-klient (Node 22, global WebSocket) för slut-QA #825.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startChrome({ port, dir, flags = [] }) {
  const p = spawn("chromium", ["--headless=new", "--no-sandbox", "--hide-scrollbars", "--disable-gpu",
    "--autoplay-policy=no-user-gesture-required", "--window-size=1600,900",
    `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, ...flags, "about:blank"], { stdio: "ignore", detached: true });
  p.unref();
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return { pid: p.pid, ...(await r.json()) }; } catch {}
    await sleep(250);
  }
  throw new Error("chromium startade inte");
}

export async function connect(port) {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pend = new Map();
  const lyss = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const { r, j } = pend.get(d.id); pend.delete(d.id); d.error ? j(new Error(JSON.stringify(d.error))) : r(d.result); return; }
    if (d.method) for (const f of lyss.get(d.sessionId || "") || []) f(d);
  };
  const send = (method, params = {}, sessionId) => new Promise((r, j) => {
    const i = ++id; pend.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const on = (sid, f) => { if (!lyss.has(sid)) lyss.set(sid, []); lyss.get(sid).push(f); };

  async function pages() { return (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page"); }
  async function attach(targetId) { return newPage(null, { targetId, keepMetrics: true }); }
  async function newPage(url, { isolate = true, w = 1600, h = 900, mobile = false, targetId: tid = null, keepMetrics = false } = {}) {
    const ctx = !tid && isolate ? (await send("Target.createBrowserContext", { disposeOnDetach: false })).browserContextId : undefined;
    const { targetId } = tid ? { targetId: tid } : await send("Target.createTarget", { url: "about:blank", newWindow: true, ...(ctx ? { browserContextId: ctx } : {}) });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    const konsol = [];
    on(sessionId, (d) => {
      if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) konsol.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
      if (d.method === "Runtime.exceptionThrown") konsol.push(`exception: ${d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text}`.slice(0, 300));
    });
    await s("Page.enable"); await s("Runtime.enable");
    await s("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    if (!keepMetrics) await s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
    if (url) await s("Page.navigate", { url });
    const page = {
      targetId, sessionId, ctx, konsol, send: s, on: (f) => on(sessionId, f),
      async eval(expr, { await: aw = true } = {}) {
        const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: aw, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async waitFor(expr, ms = 15000) {
        const t = Date.now();
        while (Date.now() - t < ms) { try { const v = await page.eval(expr); if (v) return v; } catch {} await sleep(200); }
        throw new Error(`timeout: ${expr}`);
      },
      async shot(fil, { format = "jpeg", quality = 80 } = {}) {
        const r = await s("Page.captureScreenshot", { format, quality });
        writeFileSync(fil, Buffer.from(r.data, "base64"));
      },
      goto: (u) => s("Page.navigate", { url: u }),
      async click(sel) { return page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; e.click(); return true;})()`); },
      async key(key, code = key, keyCode = 0) {
        await s("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode });
        await s("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
      },
      async close() { await send("Target.closeTarget", { targetId }); },
    };
    return page;
  }
  return { send, newPage, pages, attach, ws, close: () => ws.close() };
}
