// ============================================================================
// Liten CDP-driver för schack-QA:n (#777): headless chromium (/usr/bin/chromium
// eller CHROMIUM=…) på en slumpad debug-port, Node 22:s inbyggda WebSocket –
// inga npm-paket. Ger riktiga (betrodda) mus-, touch- och tangenthändelser.
// QA_HEADFUL=1 (under xvfb-run): synligt fönster – då når t.ex. Esc webbläsarens helskärmsutgång.
//
//   const br = await startaChromium();  const p = await br.nySida();
//   await p.gaTill(url);  await p.ev("document.title");  br.stang();
// ============================================================================
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const medTidsgrans = (lofte, ms, vad) =>
  Promise.race([lofte, new Promise((_, j) => setTimeout(() => j(new Error(`timeout ${ms} ms: ${vad}`)), ms))]);

export async function startaChromium({ extra = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "qa-schack-"));
  const proc = spawn(process.env.CHROMIUM || "/usr/bin/chromium", [...(process.env.QA_HEADFUL ? [] : ["--headless=new"]), "--no-sandbox", "--disable-gpu",
    "--remote-debugging-port=0", `--user-data-dir=${dir}`, "--no-first-run", "--disable-dev-shm-usage", ...extra, "about:blank"],
  { stdio: "ignore", detached: true }); // egen processgrupp – stang() dödar hela trädet (zygote, renderare)
  const doda = () => { try { process.kill(-proc.pid, "SIGKILL"); } catch { /* redan borta */ } };
  process.once("exit", doda); // även om skriptet avslutas med process.exit() eller ett fel
  const fil = join(dir, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(fil); i++) await vila(100);
  const [port, path] = readFileSync(fil, "utf8").trim().split("\n");
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const vantar = new Map();
  const lyss = new Set();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && vantar.has(m.id)) {
      const { r, j } = vantar.get(m.id);
      vantar.delete(m.id);
      if (m.error) j(new Error(JSON.stringify(m.error)));
      else r(m.result);
    } else for (const l of lyss) l(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((r, j) => {
    const i = ++id;
    vantar.set(i, { r, j });
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  async function nySida() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => medTidsgrans(send(m, p, sessionId), 150000, m);
    await s("Page.enable");
    await s("Runtime.enable");
    const konsol = [];
    lyss.add((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.consoleAPICalled") konsol.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
      if (m.method === "Runtime.exceptionThrown") konsol.push(`EXCEPTION: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    });
    /** Kör ett uttryck i sidan (inväntar löften), med tidsgräns. */
    const ev = async (expr, { timeout = 30000 } = {}) => {
      const r = await medTidsgrans(send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId), timeout, expr.slice(0, 80));
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const laddad = () => new Promise((r) => {
      const l = (m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { lyss.delete(l); r(); } };
      lyss.add(l);
    });
    const gaTill = async (url) => { const l = laddad(); await s("Page.navigate", { url }); await medTidsgrans(l, 30000, url); };
    const laddaOm = async () => { const l = laddad(); await s("Page.reload", {}); await medTidsgrans(l, 30000, "reload"); };
    const vanta = async (expr, ms = 15000) => {
      const t = Date.now();
      while (Date.now() - t < ms) {
        try { if (await ev(expr, { timeout: 5000 })) return true; } catch { /* sidan laddas */ }
        await vila(80);
      }
      throw new Error("väntade förgäves: " + expr);
    };
    /** CDP-händelser för just den här sidan (t.ex. Network.requestWillBeSent); returnerar avregistreringen. */
    const pa = (fn) => { const l = (m) => { if (m.sessionId === sessionId && m.method) fn(m); }; lyss.add(l); return () => lyss.delete(l); };
    return { s, ev, gaTill, laddaOm, vanta, konsol, sessionId, targetId, pa };
  }

  return {
    send,
    nySida,
    /** Stäng webbläsaren (hela processgruppen) och ta bort profilmappen – synkront, så process.exit() direkt efteråt är ok. */
    stang() {
      try { ws.close(); } catch { /* redan stängd */ }
      doda();
      for (let i = 0; i < 20; i++) {
        try { rmSync(dir, { recursive: true, force: true }); break; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
      }
    },
  };
}
