// QA (#704): skärmdumpar av Plugga-designens tre sidor (startsidan, områdessidan,
// menyn) i alla testskärmar, plus mätvärden (scroll, äventyrsbildernas storlek).
// Inga beroenden: Node 22 (global WebSocket) + `chromium` i PATH.
//
//   PORT=8704 node server.mjs &
//   node admin/qa-plugga-design-skarmdumpar.mjs [http://localhost:8704] [utmapp]
//
// Startsida + områdessida körs i preview/preview-plugga-703.html (stubbad data).
// Menyn: på dator syns den i sidornas vänsterkant; där hamburgaren syns öppnas
// den och fotograferas separat (meny-*.png).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:8704").replace(/\/$/, "");
const UT = process.argv[3] || "/tmp/plugga-design-skarmdumpar";
mkdirSync(UT, { recursive: true });
const SKARMAR = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [820, 1180], [1180, 820], [390, 844], [360, 740]];
const RIGG = `${BASE}/preview/preview-plugga-703.html`;
const SIDOR = [
  ["start", "#/elev/plugga"],
  ["omrade", "#/elev/omrade?subj=so&area=vikingatiden"],
];

const dbg = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${dbg}`, `--user-data-dir=/tmp/qa-plugga-design-${dbg}`, "about:blank"], { stdio: "ignore" });
let ver = null;
for (let i = 0; i < 50 && !ver; i++) {
  await new Promise((r) => setTimeout(r, 200));
  ver = await fetch(`http://127.0.0.1:${dbg}/json/version`).then((r) => r.json()).catch(() => null);
}
if (!ver) { chrome.kill(); throw new Error("chromium startade inte"); }
const flikar = await fetch(`http://127.0.0.1:${dbg}/json/list`).then((r) => r.json());
const ws = new WebSocket(flikar.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nr = 0;
const svar = new Map();
const fel = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && svar.has(m.id)) { svar.get(m.id)(m.result ?? m.error); svar.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") fel.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") fel.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++nr; svar.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (uttryck) => (await cdp("Runtime.evaluate", { expression: uttryck, awaitPromise: true, returnByValue: true })).result?.value;
await cdp("Runtime.enable");
await cdp("Page.enable");

async function bild(namn) {
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${UT}/${namn}.png`, Buffer.from(data, "base64"));
}

const matt = [];
for (const [w, h] of SKARMAR) {
  const mobil = w < 700;
  await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: mobil });
  for (const [sida, hash] of SIDOR) {
    await cdp("Page.navigate", { url: "about:blank" });
    await vanta(200);
    await cdp("Page.navigate", { url: `${RIGG}?w=${w}${hash}` });
    await vanta(1800);
    const m = await js(`(() => {
      const d = document.documentElement;
      const scener = [...document.querySelectorAll(".adv-liten .scen")].map((s) => { const r = s.getBoundingClientRect(); return Math.round(r.width) + "×" + Math.round(r.height); });
      const sista = [...document.querySelectorAll(".big-card, .omrade-kort")].pop();
      return { sidhojd: d.scrollHeight, vagrattScroll: d.scrollWidth > d.clientWidth,
        sistaKortSlut: sista ? Math.round(sista.getBoundingClientRect().bottom) : null,
        hamburger: !!document.getElementById("hamburger") && getComputedStyle(document.getElementById("hamburger")).display !== "none" && !document.getElementById("hamburger").hidden,
        scener };
    })()`);
    matt.push({ skarm: `${w}×${h}`, sida, ...m });
    await bild(`${sida}-${w}x${h}`);
    if (sida === "start" && m.hamburger) {
      await js(`document.getElementById("hamburger").click()`);
      await vanta(600);
      await bild(`meny-${w}x${h}`);
    }
  }
}
// Förhandsvisningen av äventyrskorten (§4.3), hela sidan.
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `${BASE}/preview/preview-aventyr-kort.html` });
await vanta(1800);
const hojd = await js("document.documentElement.scrollHeight");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: hojd, deviceScaleFactor: 1, mobile: false });
await vanta(400);
await bild("aventyr-kort-1440");

for (const r of matt) console.log(JSON.stringify(r));
console.log(fel.length ? `FEL:\n${fel.join("\n")}` : "inga konsolfel");
ws.close();
chrome.kill();
