// ============================================================================
// Visuell + robusthets-QA för Trollkarlsduellen (#541) – headless Chromium.
// ----------------------------------------------------------------------------
// Kör DEMOLÄGET (preview-trollkarlsduellen.html, ingen Firestore) och:
//   • alla registrerade attacker från BÅDA sidor: skärmdumpar mitt i, längd,
//     återställning (IDLE, tomt effektlager, samma DOM-storlek, inga kvar-
//     hängande oändliga animationer), konsolfel
//   • finalerna: tvingar fram alla vinstvarianter × båda vinnarna + oavgjort,
//     kollar "exakt en gång" och resultatkortet
//   • ljud: räknar startade/avslutade Web Audio-källor (inget hänger kvar)
//   • minne: JS-heap + DOM-noder före/efter alla attacker (efter GC)
//   • bildrutor: rAF-intervall under attacker (SwiftShader – ingen riktig GPU)
// Resultat: <ut>/rapport.json + skärmdumpar + kontaktark (sharp).
//
//   NODE_PATH=/tmp/imgtool537/node_modules node admin/qa-trollkarlsduellen-visuell.mjs \
//     --url http://127.0.0.1:8542 --ut /tmp/qa541/vis-1920 [--size 1920x1080] [--reduced]
//     [--bara attacker|finaler|minne] [--varv 2]
// Kräver puppeteer-core (+ sharp för kontaktarket) och /usr/bin/chromium.
// ============================================================================
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(path.join(process.env.NODE_PATH || ".", "x.js"));
const puppeteer = require("puppeteer-core");
let sharp = null;
try { sharp = require("sharp"); } catch {}

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes(`--${k}`);
const BASE = arg("url", "http://127.0.0.1:8542");
const UT = arg("ut", "/tmp/qa541/vis");
const [W, H] = arg("size", "1920x1080").split("x").map(Number);
const REDUCED = has("reduced");
const BARA = arg("bara", "alla");
const VARV = Number(arg("varv", "1"));
mkdirSync(UT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Räknar Web Audio-källor (start/ended) och samlar rAF-intervall – före sidans kod.
const INIT = `
  window.__qa = { started: 0, ended: 0, frames: [], rec: false };
  const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
  if (S) { const o = S.start; S.start = function (...a) { window.__qa.started++;
    this.addEventListener('ended', () => window.__qa.ended++, { once: true }); return o.apply(this, a); }; }
  let last = 0; const loop = (t) => { if (window.__qa.rec && last) window.__qa.frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
`;

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", `--window-size=${W},${H}`, "--js-flags=--expose-gc"],
  defaultViewport: { width: W, height: H },
});
const page = await browser.newPage();
const fel = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) fel.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => fel.push(`pageerror: ${e.message}`));
if (REDUCED) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.evaluateOnNewDocument(INIT);
const cdp = await page.createCDPSession();
await cdp.send("Performance.enable");

async function nyMatch() {
  await page.goto(`${BASE}/preview-trollkarlsduellen.html`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector('[data-act="live"]').click());
  await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll(".tk-slot svg, .tk-slot img, .tk-slot canvas").length > 0, { timeout: 20000 });
  await page.addStyleTag({ content: ".pv{display:none!important}" });
  await page.mouse.click(W / 2, H / 2); // användargest → ljudet låses upp
  await sleep(1500);
}

const vy = () => page.evaluate(async () => {
  const m = await import("/src/live/trollkarl/trollkarl-vy.js");
  return !!m.trollkarlDemo.view;
});

async function lage() {
  return page.evaluate(() => {
    const stage = document.querySelector(".tk-stage");
    const anims = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity);
    return {
      states: [...document.querySelectorAll(".tk-slot")].map((s) => s.dataset.state),
      fx: document.querySelector(".tk-fx").children.length + document.querySelector(".tk-fxback").children.length,
      noder: stage.querySelectorAll("*").length,
      slotNoder: [...document.querySelectorAll(".tk-slot")].map((s) => s.querySelectorAll("*").length),
      oandliga: anims.length,
      banner: document.querySelector(".tk-banner").innerText.trim(),
      ljud: { ...window.__qa, frames: undefined },
    };
  });
}

async function metrics() {
  await page.evaluate(() => window.gc?.());
  await sleep(300);
  await page.evaluate(() => window.gc?.());
  const { metrics: m } = await cdp.send("Performance.getMetrics");
  const g = (n) => m.find((x) => x.name === n)?.value;
  return { heapMB: +(g("JSHeapUsedSize") / 1048576).toFixed(2), noder: g("Nodes"), lyssnare: g("JSEventListeners") };
}

const rapport = { url: BASE, size: `${W}x${H}`, reduced: REDUCED, attacker: [], finaler: [], fel };

async function korAttacker() {
  await nyMatch();
  const ids = await page.evaluate(async () => (await import("/src/live/trollkarl/trollkarl-register.js")).listAttacks().map((a) => ({ id: a.id, name: a.name, ms: a.durationMs })));
  rapport.antalAttacker = ids.length;
  const fore = await lage();
  rapport.minneFore = await metrics();
  for (let varv = 0; varv < VARV; varv++) {
    for (const side of ["left", "right"]) {
      for (const a of ids) {
        const n0 = fel.length;
        const ljud0 = await page.evaluate(() => window.__qa.started);
        await page.evaluate(() => { window.__qa.frames = []; window.__qa.rec = true; });
        const t0 = Date.now();
        const ok = await page.evaluate(async (s, id) => (await import("/src/live/trollkarl/trollkarl-vy.js")).trollkarlDemo.view.attack(s, id), side, a.id);
        const skott = [];
        if (varv === 0) {
          for (const f of [0.35, 0.65]) {
            await sleep(Math.max(0, t0 + 1300 + a.ms * f - Date.now()));
            const fil = path.join(UT, `${a.id}-${side}-${Math.round(f * 100)}.jpg`);
            await page.screenshot({ path: fil, type: "jpeg", quality: 70 });
            skott.push(fil);
          }
        }
        await page.evaluate(async () => (await import("/src/live/trollkarl/trollkarl-vy.js")).trollkarlDemo.view.director.whenIdle());
        const ms = Date.now() - t0;
        const frames = await page.evaluate(() => { window.__qa.rec = false; return window.__qa.frames; });
        await sleep(400);
        const efter = await lage();
        const sorted = [...frames].sort((x, y) => x - y);
        rapport.attacker.push({
          varv, id: a.id, namn: a.name, side, koad: ok, ms, durationMs: a.ms,
          aterstallt: efter.states.every((s) => s === "IDLE") && efter.fx === 0,
          states: efter.states, fx: efter.fx, noderDiff: efter.noder - fore.noder, slotNoder: efter.slotNoder,
          oandliga: efter.oandliga, ljudStartade: efter.ljud.started - ljud0,
          frames: { n: frames.length, p50: +(sorted[Math.floor(sorted.length * 0.5)] || 0).toFixed(1), p95: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1), over50: frames.filter((x) => x > 50).length },
          fel: fel.slice(n0), skott,
        });
        console.log(`${a.id.padEnd(16)} ${side.padEnd(5)} ${ms} ms  återställt=${rapport.attacker.at(-1).aterstallt} noder${efter.noder - fore.noder >= 0 ? "+" : ""}${efter.noder - fore.noder} ∞anim=${efter.oandliga} ljud=${efter.ljud.started - ljud0} fel=${fel.length - n0}`);
      }
    }
  }
  await sleep(4000);
  rapport.ljudEfter = await page.evaluate(() => ({ started: window.__qa.started, ended: window.__qa.ended }));
  rapport.minneEfter = await metrics();
  rapport.oandligaFore = fore.oandliga;
  console.log("minne före", rapport.minneFore, "efter", rapport.minneEfter, "ljud", rapport.ljudEfter);
}

async function korFinaler() {
  const mal = new Set();
  const behov = ["energikula", "potatis-gigantus", "drakus-finalus"].flatMap((v) => [`${v}|rasmus`, `${v}|elias`]).concat(["magisk-krock|draw"]);
  for (let forsok = 0; forsok < 40 && behov.some((b) => !mal.has(b)); forsok++) {
    await nyMatch();
    // Spela in vilken finalvariant som körs (samma registerobjekt som vyn använder).
    await page.evaluate(async () => {
      const r = await import("/src/live/trollkarl/trollkarl-register.js");
      window.__fin = [];
      for (const kind of ["win", "draw"]) for (const d of r.listFinales(kind)) {
        if (d.__qa) continue;
        const run = d.run; d.__qa = true;
        d.run = function (...x) { window.__fin.push(d.id); return run.apply(this, x); };
      }
    });
    const kvar = behov.filter((b) => !mal.has(b));
    const act = kvar.includes("magisk-krock|draw") && forsok % 3 === 2 ? "oavgjort" : kvar.some((b) => b.endsWith("|rasmus")) && (forsok % 2 === 0 || !kvar.some((b) => b.endsWith("|elias"))) ? "vinn-rasmus" : "vinn-elias";
    const t0 = Date.now();
    await page.evaluate((a) => document.querySelector(`[data-act="${a}"]`).click(), act);
    await page.waitForFunction(() => !document.querySelector(".tk-result")?.hidden, { timeout: 45000 });
    const ms = Date.now() - t0;
    const info = await page.evaluate(() => ({ fin: window.__fin, res: document.querySelector(".tk-result").innerText.split("\n")[0],
      states: [...document.querySelectorAll(".tk-slot")].map((s) => `${s.dataset.who}:${s.dataset.state}`) }));
    const vinnare = act === "oavgjort" ? "draw" : act.slice(5);
    const id = info.fin[0] || "?";
    const nyckel = `${id}|${vinnare}`;
    const ny = !mal.has(nyckel);
    mal.add(nyckel);
    let skott = null;
    if (ny) {
      skott = path.join(UT, `final-${id}-${vinnare}.jpg`);
      await page.screenshot({ path: skott, type: "jpeg", quality: 70 });
    }
    // Exakt en gång: vänta en stund till och se att inget mer spelas.
    await sleep(3000);
    const antal = await page.evaluate(() => window.__fin.length);
    rapport.finaler.push({ act, id, vinnare, ms, antalKorningar: antal, res: info.res, states: info.states, skott });
    console.log(`final ${act.padEnd(11)} → ${id.padEnd(16)} ${ms} ms  körningar=${antal}  "${info.res}"  ${info.states.join(" ")}`);
    if (ny && id !== "?") {
      // Mitt i finalen: kör om samma variant och ta en bild halvvägs.
      await page.evaluate(() => { sessionStorage.clear(); });
    }
  }
  rapport.finalerTackta = [...mal];
}

async function finalBilder() {
  // Mitt-i-bilder för varje vinstvariant (seedad på sessions-id → leta tills varianten kommer).
  const sett = new Set();
  for (let forsok = 0; forsok < 25 && sett.size < 4; forsok++) {
    await nyMatch();
    await page.evaluate(async () => {
      const r = await import("/src/live/trollkarl/trollkarl-register.js");
      window.__fin = [];
      for (const kind of ["win", "draw"]) for (const d of r.listFinales(kind)) { const run = d.run; d.run = function (...x) { window.__fin.push(d.id); return run.apply(this, x); }; }
    });
    const act = sett.has("magisk-krock") || forsok % 4 !== 3 ? (forsok % 2 ? "vinn-elias" : "vinn-rasmus") : "oavgjort";
    await page.evaluate((a) => document.querySelector(`[data-act="${a}"]`).click(), act);
    await page.waitForFunction(() => window.__fin.length > 0, { timeout: 15000 });
    const id = await page.evaluate(() => window.__fin[0]);
    if (sett.has(id)) continue;
    sett.add(id);
    for (const t of [1500, 3500, 5500, 7500]) {
      await sleep(t === 1500 ? 1500 : 2000);
      await page.screenshot({ path: path.join(UT, `finalmitt-${id}-${act}-${t}.jpg`), type: "jpeg", quality: 70 });
    }
  }
}

if (BARA === "alla" || BARA === "attacker" || BARA === "minne") await korAttacker();
if (BARA === "alla" || BARA === "finaler") { await korFinaler(); await finalBilder(); }

writeFileSync(path.join(UT, "rapport.json"), JSON.stringify(rapport, null, 1));
if (sharp) {
  const { readdirSync } = await import("node:fs");
  const filer = readdirSync(UT).filter((f) => f.endsWith(".jpg") && !f.startsWith("ark-")).sort();
  const TW = 384, TH = 216, KOL = 6;
  for (let i = 0; i < filer.length; i += 36) {
    const del = filer.slice(i, i + 36);
    const rader = Math.ceil(del.length / KOL);
    const bitar = await Promise.all(del.map(async (f, j) => ({
      input: await sharp(path.join(UT, f)).resize(TW, TH).composite([{ input: Buffer.from(
        `<svg width="${TW}" height="18"><rect width="${TW}" height="18" fill="black" opacity=".7"/><text x="4" y="13" font-size="12" fill="white" font-family="sans-serif">${f}</text></svg>`), top: 0, left: 0 }]).toBuffer(),
      left: (j % KOL) * TW, top: Math.floor(j / KOL) * TH,
    })));
    await sharp({ create: { width: KOL * TW, height: rader * TH, channels: 3, background: "#000" } })
      .composite(bitar).jpeg({ quality: 75 }).toFile(path.join(UT, `ark-${String(i / 36 + 1).padStart(2, "0")}.jpg`));
  }
}
console.log(`klart → ${UT}/rapport.json · konsolfel totalt ${fel.length}`);
await browser.close();
