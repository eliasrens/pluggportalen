// ============================================================================
// Meteorstormen (#824): SKÄRMDUMPAR för finputsen – projektorn, elevskärmen i
// 375 px, det kopplade demoläget, historiken och formatväljaren – i en egen
// huvudlös Chromium via DevTools-protokollet (som qa-meteorstorm-fps.mjs).
// Startar en egen statisk server (slumpad port). Bilderna → --ut (standard
// docs/meteorstormen-824/). Inga beroenden: Node 22 + chromium i PATH.
//
//   node admin/qa-meteorstorm-skarmdumpar.mjs [--ut katalog] [--bara namn,namn]
//
// Varje bild: { namn, url, w, h, mobil?, reducerad?, vanta (ms), js? } – js körs
// i sidan före bilden (await-bar), t.ex. för att svara rätt i elevvyn.
// Skriver också en rad per bild med det sidan rapporterar (fel i konsolen).
// ============================================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROT = fileURLToPath(new URL("..", import.meta.url));
const UT = opt("--ut", join(ROT, "docs/meteorstormen-824"));
const BARA = opt("--bara", "") ? opt("--bara").split(",") : null;

// Elevvyn: svara rätt på frågan som visas (förhandsvisningens __msSvara) och vänta på knapparna.
const SVARA = `(async () => { for (let i = 0; i < 40 && !document.querySelector(".mse-svar input, .mse-svar .ca-knapp"); i++) await new Promise((r) => setTimeout(r, 150));
  window.__msSvara(true); await new Promise((r) => setTimeout(r, 900)); })()`;
const BILDER = [
  { namn: "projektor-storm", url: "preview-meteorstorm-demo.html?fas=storm&sek=200&panel=av", w: 1920, h: 1080, vanta: 5000 },
  { namn: "projektor-slut", url: "preview-meteorstorm-demo.html?fas=final&panel=av", w: 1920, h: 1080, vanta: 6000 },
  { namn: "projektor-reducerad", url: "preview-meteorstorm-demo.html?fas=storm&sek=200&panel=av&rorelse=reducerad", w: 1920, h: 1080, vanta: 5000, reducerad: true },
  { namn: "elev-375-fraga", url: "preview-meteorstorm-elev.html?fas=live", w: 375, h: 812, mobil: true, vanta: 2500, js: `document.querySelector("[data-panel]").hidden = true` },
  { namn: "elev-375-val", url: "preview-meteorstorm-elev.html?fas=live", w: 375, h: 812, mobil: true, vanta: 2500, js: `document.querySelector("[data-panel]").hidden = true; ${SVARA}` },
  { namn: "elev-375-quiz", url: "preview-meteorstorm-elev.html?fas=live&quiz=1", w: 375, h: 812, mobil: true, vanta: 2500, js: `document.querySelector("[data-panel]").hidden = true` },
  { namn: "elev-375-lobby", url: "preview-meteorstorm-elev.html?fas=lobby", w: 375, h: 812, mobil: true, vanta: 1500, js: `document.querySelector("[data-panel]").hidden = true` },
  { namn: "elev-375-slut", url: "preview-meteorstorm-elev.html?fas=live", w: 375, h: 812, mobil: true, vanta: 1500,
    js: `document.querySelector("[data-panel]").hidden = true; document.querySelector('[data-fas="slut"]').click(); await new Promise((r) => setTimeout(r, 2500))` },
  { namn: "historik-375", url: "preview-meteorstorm-historik.html", w: 375, h: 812, mobil: true, vanta: 2500, helsida: true },
  { namn: "demolage", url: "preview-meteorstorm-demolage.html", w: 1600, h: 900, vanta: 4000,
    js: `const f = document.querySelector("[data-elev]").contentWindow; f.__msSvara(true); await new Promise((r) => setTimeout(r, 1200));
      f.document.querySelector('[data-typ="laser"]:not([disabled])')?.click(); await new Promise((r) => setTimeout(r, 3500))` },
  { namn: "formatval", url: "preview-meteorstorm-formatval.html", w: 900, h: 700, vanta: 1500 },
  { namn: "formatval-375", url: "preview-meteorstorm-formatval.html", w: 375, h: 812, mobil: true, vanta: 1500, helsida: true },
].filter((b) => !BARA || BARA.includes(b.namn));

mkdirSync(UT, { recursive: true });
const port = 20000 + Math.floor(Math.random() * 20000);
const server = spawn("node", ["server.mjs"], { cwd: ROT, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const dbg = 40000 + Math.floor(Math.random() * 20000);
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--hide-scrollbars", "--disable-gpu", "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${dbg}`, `--user-data-dir=/tmp/ms-skarm-${dbg}`, "about:blank"], { stdio: "ignore" });
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
  const lyss = new Set();
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && vanta.has(d.id)) { vanta.get(d.id)(d); vanta.delete(d.id); }
    else if (d.method) lyss.forEach((f) => f(d));
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    vanta.set(i, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  for (const b of BILDER) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    const fel = [];
    const f = (d) => {
      if (d.sessionId !== sessionId) return;
      if (d.method === "Runtime.exceptionThrown") fel.push(d.params.exceptionDetails?.exception?.description?.split("\n")[0] || "undantag");
      if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") fel.push(d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 160));
    };
    lyss.add(f);
    await S("Page.enable");
    await S("Runtime.enable");
    await S("Emulation.setDeviceMetricsOverride", { width: b.w, height: b.h, deviceScaleFactor: b.mobil ? 2 : 1, mobile: !!b.mobil });
    if (b.reducerad) await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await S("Page.navigate", { url: `http://127.0.0.1:${port}/preview/${b.url}` });
    await sleep(b.vanta);
    if (b.js) await S("Runtime.evaluate", { expression: `(async () => { ${b.js} })()`, awaitPromise: true });
    const bred = await S("Runtime.evaluate", { expression: "document.documentElement.scrollWidth", returnByValue: true });
    let clip;
    if (b.helsida) {
      const hojd = await S("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true });
      clip = { x: 0, y: 0, width: b.w, height: Math.min(4000, hojd.result.value), scale: 1 };
    }
    const { data } = await S("Page.captureScreenshot", { format: "jpeg", quality: 82, ...(clip ? { clip, captureBeyondViewport: true } : {}) });
    writeFileSync(join(UT, `${b.namn}.jpg`), Buffer.from(data, "base64"));
    let bov = "";
    if (bred.result.value > b.w) {
      // Vilka element sticker ut (utan en scrollande förälder)?
      const r = await S("Runtime.evaluate", { returnByValue: true, expression: `[...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > ${b.w} + 1 && !e.closest("[class*=scroll]"))
        .map((e) => e.tagName.toLowerCase() + "." + [...e.classList].join(".")).slice(0, 4).join(" ")` });
      bov = `  (${r.result.value})`;
    }
    console.log(`${b.namn}.jpg  ${b.w}×${b.h}  scrollbredd ${bred.result.value}${bred.result.value > b.w ? " ⚠️ VÅGRÄT SCROLL" + bov : ""}  fel: ${fel.length ? fel.join(" | ") : "0"}`);
    lyss.delete(f);
    await send("Target.closeTarget", { targetId });
  }
  ws.close();
} finally {
  stang();
}
