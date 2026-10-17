// ============================================================================
// QA #749: riktig utskrift (A4-PDF via Chromium/CDP) av Prov-utskrifterna i
// den RIKTIGA appen mot emulatorriggen (admin/qa-prov2-preview.sh) – inte
// preview-stubben. Loggar in som läraren, öppnar Översikt för tillfället,
// trycker "Skriv ut provet"/"Skriv ut resultat" (window.print stubbas) och
// skriver PDF + sidantal.
//   node admin/qa-prov2-utskrift.mjs <app-origin> <tillfälle-id> <ut-mapp> [användare] [lösen]
// Utskrifter: resultat (med facit), resultat-utan-facit, prov, prov-facit.
// ============================================================================
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";

const [origin, t, ut, anv = "qaarskurs4", los = "lilla123"] = process.argv.slice(2);
if (!origin || !t || !ut) { console.error("node admin/qa-prov2-utskrift.mjs <origin> <tillfälle> <ut-mapp>"); process.exit(1); }
mkdirSync(ut, { recursive: true });
const dir = mkdtempSync("/tmp/qa749-chrome-");
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
let port;
for (let i = 0; i < 100 && !port; i++) { await vanta(100); if (existsSync(`${dir}/DevToolsActivePort`)) port = readFileSync(`${dir}/DevToolsActivePort`, "utf8").split("\n")[0]; }
const lista = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(lista.find((x) => x.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const vant = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && vant.has(m.id)) { vant.get(m.id)(m); vant.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; vant.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: `${origin}/#/larare` });
await vanta(4000);
await js(`(async () => { const s=(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
  const f=document.querySelectorAll('form input'); s(f[0], ${JSON.stringify(anv)}); s(f[1], ${JSON.stringify(los)});
  document.querySelector('form button').click(); })()`);
await vanta(4000);

const sidor = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
async function skrivUt(namn, knapp, facit) {
  await js(`location.hash = '#/larare/prov/ratta?t=${t}&lage=oversikt'`);
  await vanta(4500);
  const info = await js(`(async () => {
    window.print = () => {};
    document.querySelector('.provl-utskrift')?.remove();
    const b = [...document.querySelectorAll('button,a')].find((x) => x.offsetParent && x.innerText.includes(${JSON.stringify(knapp)}));
    if (!b) return 'ingen knapp';
    b.click(); await new Promise((r) => setTimeout(r, 2500));
    const u = document.querySelector('.provl-utskrift'); if (!u) return 'ingen utskrift';
    const cb = [...u.querySelectorAll('input[type=checkbox]')][0];
    if (cb && cb.checked !== ${facit}) { cb.click(); await new Promise((r) => setTimeout(r, 800)); }
    return { verktyg: u.querySelector('.provl-ut-verktyg')?.innerText.replace(/\\n+/g, ' | '), sidor: u.querySelectorAll('.provl-ut-sida').length };
  })()`);
  const pdf = await cdp("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
  const buf = Buffer.from(pdf.result.data, "base64");
  writeFileSync(`${ut}/${namn}.pdf`, buf);
  console.log(namn, JSON.stringify(info), "PDF-sidor:", sidor(buf));
}
await skrivUt("resultat-med-facit", "Skriv ut resultat", true);
await skrivUt("resultat-utan-facit", "Skriv ut resultat", false);
await skrivUt("prov", "Skriv ut provet", false);
await skrivUt("prov-med-facit", "Skriv ut provet", true);
ws.close();
chrome.kill();
process.exit(0);
