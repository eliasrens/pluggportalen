// QA (#568, acceptanstest 22): öppna varje förhandsvisningssida i headless
// Chromium och lista konsolfel, ohanterade undantag och misslyckade
// nätverksanrop (4xx/5xx eller nätverksfel). Inga beroenden: Node 22 (global
// WebSocket) + `chromium` i PATH.
//
//   npm start &                                   (servar repo-roten på :8000)
//   node admin/qa-preview-sidor.mjs              → alla preview/*.html
//   node admin/qa-preview-sidor.mjs http://localhost:8000 preview/preview-gruvan.html …
//
// Skriver en rad per sida och avslutar med kod 1 om någon sida hade fel.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:8000").replace(/\/$/, "");
const sidor = process.argv.length > 3
  ? process.argv.slice(3)
  : readdirSync(new URL("../preview/", import.meta.url)).filter((f) => f.endsWith(".html")).sort().map((f) => `preview/${f}`);
const VANTA_MS = Number(process.env.VANTA_MS || 2500);

const dbg = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${dbg}`,
  `--user-data-dir=/tmp/qa-preview-sidor-${dbg}`, "about:blank"], { stdio: "ignore" });
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
let fel = [];
const urlFor = new Map(); // requestId → url
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && svar.has(m.id)) { svar.get(m.id)(m.result); svar.delete(m.id); return; }
  const p = m.params;
  if (m.method === "Runtime.exceptionThrown") fel.push(`undantag: ${p.exceptionDetails.exception?.description?.split("\n")[0] || p.exceptionDetails.text}`);
  if (m.method === "Runtime.consoleAPICalled" && p.type === "error") fel.push(`console.error: ${p.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200)}`);
  if (m.method === "Network.requestWillBeSent") urlFor.set(p.requestId, p.request.url);
  if (m.method === "Network.responseReceived" && p.response.status >= 400) fel.push(`${p.response.status}: ${p.response.url}`);
  if (m.method === "Network.loadingFailed" && !p.canceled) fel.push(`nätfel ${p.errorText}: ${urlFor.get(p.requestId)}`);
});
const S = (method, params = {}) => new Promise((res) => { const id = ++nr; svar.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await S("Runtime.enable");
await S("Network.enable");
await S("Network.setCacheDisabled", { cacheDisabled: true });

let trasiga = 0;
for (const sida of sidor) {
  fel = [];
  await S("Page.navigate", { url: `${BASE}/${sida}` });
  await new Promise((r) => setTimeout(r, VANTA_MS));
  const unika = [...new Set(fel)];
  if (unika.length) trasiga++;
  console.log(`${unika.length ? "FEL" : "OK "} ${sida}${unika.map((f) => `\n      ${f}`).join("")}`);
}
console.log(`\n${sidor.length - trasiga}/${sidor.length} sidor utan fel.`);
ws.close();
chrome.kill();
process.exit(trasiga ? 1 : 0);
