// QA (#753): "Fortsätt" på Kontrollera-knappens plats. Kör preview/qa-brakresan-753.html
// (testomgång med förifyllda rätt/fel-utkast) i flera skärmar: klickar Kontrollera med
// riktig mus, mäter var Fortsätt hamnar, fokus, scroll, och fortsätter med Enter.
// Inga beroenden: Node 22 (global WebSocket) + `chromium` i PATH.
//
//   PORT=8753 node server.mjs &
//   node admin/qa-brakresan-753.mjs [http://localhost:8753] [utmapp] [01,03,…]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.argv[2] || "http://localhost:8753").replace(/\/$/, "");
const UT = process.argv[3] || "/tmp/qa-753";
const UTM = (process.argv[4] || "01,03,12,15,19,24,34").split(",");
mkdirSync(UT, { recursive: true });
const SKARMAR = [[1920, 1080], [1366, 768], [1280, 720], [390, 844]];

const dbg = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${dbg}`, `--user-data-dir=/tmp/qa-753-${dbg}`, "about:blank"], { stdio: "ignore" });
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
const bild = async (namn) => {
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${UT}/${namn}.png`, Buffer.from(data, "base64"));
};
const klick = async (x, y) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
};
const enter = async () => {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
};
// Huvudknappen: ny vy = .brv-kontrollera; gamla vyn: Fortsätt låg i .brv-svar.
const knappar = () => js(`(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), text: el.textContent.trim(), disabled: el.disabled }; };
  const alla = [...document.querySelectorAll(".brv-yta button")].filter((b) => b.offsetParent);
  const fortsatt = alla.find((b) => /^(Fortsätt|Se resultatet|Prova ett till)/.test(b.textContent.trim()));
  const d = document.documentElement;
  const nr = document.querySelector(".brv-omgangrad")?.textContent.trim();
  const besked = document.querySelector(".brv-svar")?.textContent.trim().slice(0, 90);
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let ratt = 0;
  for (let n; (n = w.nextNode());) if (/Rätt!/.test(n.data) && n.parentElement.checkVisibility() && n.parentElement.getBoundingClientRect().width > 2) ratt++;
  const instr = document.querySelector(".brv-instruktion")?.getBoundingClientRect();
  return { kontroll: r(document.querySelector(".brv-kontrollera")), fortsatt: r(fortsatt), fokus: document.activeElement?.textContent?.trim().slice(0, 30),
    scrollY: Math.round(scrollY), sidhojd: d.scrollHeight, fonster: innerHeight, vagratt: d.scrollWidth > d.clientWidth, nr, besked, ratt,
    instrTopp: instr ? Math.round(instr.top) : null, trang: !!document.querySelector(".brv-yta--trang") };
})()`);
const mitt = (k) => [k.x + k.w / 2, k.y + k.h / 2];
// Samma plats = musen (Kontrollera-knappens mitt) träffar fortfarande knappen och raden står still (±3 px).
const pa = (k, ny) => !!ny && Math.abs(ny.y - k.y) <= 3 && (([mx, my]) => mx >= ny.x && mx <= ny.x + ny.w && my >= ny.y && my <= ny.y + ny.h)(mitt(k));

const rader = [];
const nota = (o) => { rader.push(o); console.log(JSON.stringify(o)); };
for (const [w, h] of SKARMAR) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  for (const u of UTM) {
    const tag = `${u}-${w}x${h}`;
    await cdp("Page.navigate", { url: "about:blank" });
    await vanta(150);
    await cdp("Page.navigate", { url: `${BASE}/preview/qa-brakresan-753.html?u=${u}&svar=rf` });
    for (let i = 0; i < 40 && !(await js("document.body.dataset.klar")); i++) await vanta(150);
    await js(`[...document.querySelectorAll("button")].find((b) => /Starta 10/.test(b.textContent))?.click()`);
    await vanta(1200);
    // Uppgift 1 = rätt, uppgift 2 = fel.
    for (const [i, typ] of [[0, "ratt"], [1, "fel"]]) {
      const fore = await knappar();
      if (!fore.kontroll || fore.kontroll.disabled) { nota({ tag, typ, fel: "Kontrollera saknas/avstängd", fore }); break; }
      await bild(`${tag}-${typ}-1-fore`);
      await klick(...mitt(fore.kontroll));
      await vanta(900);
      const efter = await knappar();
      await bild(`${tag}-${typ}-2-efter`);
      const f = efter.fortsatt;
      const sammaPlats = pa(fore.kontroll, f);
      const rad = { tag, typ, kontroll: fore.kontroll, fortsatt: f, sammaPlats, fokusFortsatt: f && efter.fokus === f.text,
        synlig: !!f && f.y >= 0 && f.y + f.h <= h, scroll: efter.scrollY, sidhojd: efter.sidhojd, fonster: h, behoverScroll: efter.sidhojd > h + 1,
        instrTopp: efter.instrTopp, vagratt: efter.vagratt, trang: efter.trang, rattAntal: efter.ratt, besked: efter.besked };
      if (typ === "fel") {
        // Försök igen → "Kontrollera igen" på samma plats → (fortfarande fel) → Fortsätt på samma plats.
        await js(`[...document.querySelectorAll(".brv-yta button")].find((b) => /Försök igen/.test(b.textContent))?.click()`);
        await vanta(400);
        const be = await knappar();
        rad.igen = be.kontroll && { text: be.kontroll.text, x: be.kontroll.x, y: be.kontroll.y, disabled: be.kontroll.disabled };
        rad.igenSammaPlats = pa(fore.kontroll, be.kontroll);
        await bild(`${tag}-${typ}-3-bearbeta`);
        if (be.kontroll && !be.kontroll.disabled) {
          await klick(...mitt(be.kontroll));
          await vanta(900);
          const e2 = await knappar();
          rad.efterIgen = e2.fortsatt && { text: e2.fortsatt.text, x: e2.fortsatt.x, y: e2.fortsatt.y };
          rad.efterIgenSammaPlats = pa(fore.kontroll, e2.fortsatt);
          await bild(`${tag}-${typ}-4-efter-igen`);
        }
      }
      await enter();
      await vanta(1000);
      const nasta = await knappar();
      rad.enterNasta = nasta.nr;
      rad.enterGickVidare = !!nasta.kontroll && nasta.kontroll.text === "Kontrollera" && nasta.fortsatt == null;
      nota(rad);
    }
  }
}
writeFileSync(`${UT}/matt.json`, JSON.stringify({ rader, fel }, null, 2));
console.log("JS-fel:", fel.length ? fel : "inga");
ws.close();
chrome.kill();
