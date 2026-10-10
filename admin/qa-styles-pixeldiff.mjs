// ============================================================================
// #570 test 23: pixel-diff av sidorna FÖRE och EFTER att src/styles.css
// delades upp i src/styles/ – headless Chromium.
// ----------------------------------------------------------------------------
// Två servrar mot SAMMA emulator (samma data): --fore = gamla koden (t.ex. en
// `git archive <bas>`-kopia med egen qa-emulator-proxy), --efter = grenen.
// Varje sida mäts på två sätt, i mobil- och desktopbredd:
//   1. "separat"  – sidan laddas på båda servrarna, skärmdump, jämför.
//   2. "byte"     – SAMMA laddade sida (efter-servern, frusen JS + animationer):
//                   stilmallen byts på plats till gamla styles.css och tillbaka.
//                   Samma DOM/data → en pixelskillnad kan bara komma från CSS.
// Math.random är seedad och alla animationer fryses (oändliga → tid 0,
// ändliga → slutläge) innan skärmdump, så rörliga scener blir jämförbara.
//
// "kontroll" = efter1 mot efter2 (SAMMA CSS): rörelse som frysningen inte når
// (Live-demots egna JS-animationer). Syns en byte-diff även i kontrollen är
// den brus, inte CSS – kör om (bruset flyttar sig, en CSS-skillnad gör det inte).
//
//   NODE_PATH=/tmp/imgtool537/node_modules node admin/qa-styles-pixeldiff.mjs \
//     --fore http://127.0.0.1:8571 --efter http://127.0.0.1:8572 --ut /tmp/570/shots \
//     [--bara live]
// Kräver puppeteer-core + sharp och /usr/bin/chromium. Elev kc01 / lärare
// qalarare ur admin/qa-klasscentret-preview.sh (lösen lilla123, bara emulator).
// ============================================================================
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(path.join(process.env.NODE_PATH || ".", "x.js"));
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const FORE = arg("fore", "http://127.0.0.1:8571");
const EFTER = arg("efter", "http://127.0.0.1:8572");
const UT = arg("ut", "/tmp/570/shots");
const BARA = arg("bara", "");
const PW = "lilla123";

const BREDDER = [
  { namn: "desktop", width: 1366, height: 768, isMobile: false, hasTouch: false },
  { namn: "mobil", width: 390, height: 844, isMobile: true, hasTouch: true },
];

/** roll: null = utloggad, "elev" = kc01, "larare" = qalarare. */
const SIDOR = [
  { namn: "porten", roll: null, url: "/#/" },
  { namn: "elev-start", roll: "elev", url: "/#/" },
  { namn: "elev-rum", roll: "elev", url: "/#/elev/rum" },
  { namn: "elev-butik", roll: "elev", url: "/#/elev/shop" },
  { namn: "elev-plugga", roll: "elev", url: "/#/elev/plugga" },
  { namn: "elev-by", roll: "elev", url: "/#/elev/by" },
  { namn: "larare-klasser", roll: "larare", url: "/#/larare/klasser" },
  { namn: "larare-innehall", roll: "larare", url: "/#/larare/innehall" },
  { namn: "live-klassmatchen", roll: null, url: "/preview/preview-live-projektor.html?fas=live&auto=av" },
  { namn: "live-snilleblixt-fraga", roll: null, url: "/preview/preview-snilleblixt-demo.html?fas=fraga&auto=av" },
  { namn: "live-snilleblixt-final", roll: null, url: "/preview/preview-snilleblixt-demo.html?fas=final" },
  { namn: "live-guldrush-kammare", roll: null, url: "/preview/preview-guldrush-demo.html?fas=kammare&auto=av" },
  { namn: "live-guldrush-final", roll: null, url: "/preview/preview-guldrush-demo.html?fas=final" },
].filter((s) => !BARA || s.namn.includes(BARA));

// Körs före all sidkod: seedad Math.random (mulberry32) + frys-/bytes-hjälpare.
const INIT = `(() => {
  let s = 570;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__frysAnim = () => {
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (t && t.iterations === Infinity) { a.pause(); a.currentTime = 0; }
      else { try { a.finish(); } catch { a.pause(); a.currentTime = 0; } }
    }
  };
  window.__frys = () => {
    window.requestAnimationFrame = () => 0;
    const max = setTimeout(() => {}, 0);
    for (let i = 0; i <= max + 1000; i++) { clearTimeout(i); clearInterval(i); }
    window.__frysAnim();
  };
  window.__bytCss = (href) => new Promise((ok) => {
    const l = [...document.querySelectorAll('link[rel="stylesheet"]')].find((x) => x.dataset.pp570 || /\\/src\\/styles\\.css$/.test(x.href));
    l.dataset.pp570 = "1";
    l.onload = () => ok(true); l.onerror = () => ok(false);
    l.href = href;
  });
})();`;

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

async function loggaIn(page, bas, roll) {
  if (roll === "elev") {
    await page.goto(`${bas}/#/`, { waitUntil: "load" });
    await page.waitForSelector("#u", { timeout: 20000 });
    await page.type("#u", "kc01");
    await page.type("#p", PW);
    await page.click("#submit");
    await page.waitForFunction(() => location.hash.startsWith("#/elev"), { timeout: 30000 });
  } else if (roll === "larare") {
    await page.goto(`${bas}/#/larare`, { waitUntil: "load" });
    await page.waitForSelector("#username", { timeout: 20000 });
    await page.type("#username", "qalarare");
    await page.type("#p", PW);
    await page.click("#submit");
    await page.waitForFunction(() => location.hash.startsWith("#/larare/"), { timeout: 30000 });
  }
  await vanta(1500);
}

async function oppna(page, bas, sida) {
  await page.goto("about:blank"); // alltid full laddning (förra sidans JS är fryst)
  await page.goto(`${bas}${sida.url}`, { waitUntil: "load" });
  if (sida.url.includes("#/")) await page.evaluate((h) => { if (location.hash !== h) location.hash = h; }, sida.url.slice(sida.url.indexOf("#")));
  await page.evaluate(() => document.fonts.ready);
  await vanta(5000); // låt Firestore-läsningar, kamerazoomar och intåg landa
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function bild(page, fil) {
  await page.evaluate(() => window.__frysAnim());
  await vanta(300);
  await page.screenshot({ path: fil, fullPage: true });
  return fil;
}

async function diff(a, b, diffFil) {
  const [A, B] = await Promise.all([a, b].map((f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    return { olika: -1, storlek: `${A.info.width}×${A.info.height} ≠ ${B.info.width}×${B.info.height}` };
  }
  const { width, height } = A.info;
  const ut = Buffer.alloc(width * height * 4);
  let olika = 0;
  for (let i = 0; i < width * height * 4; i += 4) {
    const lika = A.data[i] === B.data[i] && A.data[i + 1] === B.data[i + 1] && A.data[i + 2] === B.data[i + 2] && A.data[i + 3] === B.data[i + 3];
    if (!lika) olika++;
    ut[i] = lika ? A.data[i] >> 2 : 255; ut[i + 1] = lika ? A.data[i + 1] >> 2 : 0; ut[i + 2] = lika ? A.data[i + 2] >> 2 : 0; ut[i + 3] = 255;
  }
  if (olika) await sharp(ut, { raw: { width, height, channels: 4 } }).png().toFile(diffFil);
  return { olika, storlek: `${width}×${height}` };
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none"],
});
const rapport = [];
const konsolfel = [];
try {
  for (const b of BREDDER) {
    const dir = path.join(UT, b.namn);
    mkdirSync(dir, { recursive: true });
    for (const roll of [null, "elev", "larare"]) {
      const sidor = SIDOR.filter((s) => s.roll === roll);
      if (!sidor.length) continue;
      // Egen inkognito-kontext per server och roll (inloggningen lever i IndexedDB).
      const sidPar = {};
      for (const [vem, bas] of [["fore", FORE], ["efter", EFTER]]) {
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        await page.setViewport({ width: b.width, height: b.height, deviceScaleFactor: 1, isMobile: b.isMobile, hasTouch: b.hasTouch });
        await page.evaluateOnNewDocument(INIT);
        page.on("console", (m) => { if (m.type() === "error") konsolfel.push({ vem, bredd: b.namn, text: m.text().slice(0, 200) }); });
        page.on("response", (r) => { if (r.status() >= 400) konsolfel.push({ vem, bredd: b.namn, text: `${r.status()} ${r.url()}`.slice(0, 200) }); });
        page.on("pageerror", (e) => konsolfel.push({ vem, bredd: b.namn, text: `pageerror ${e.message}`.slice(0, 200) }));
        await loggaIn(page, bas, roll);
        sidPar[vem] = { ctx, page, bas };
      }
      for (const sida of sidor) {
        const f = (x) => path.join(dir, `${sida.namn}-${x}.png`);
        // 1. Separat laddning på båda servrarna.
        await Promise.all(["fore", "efter"].map((v) => oppna(sidPar[v].page, sidPar[v].bas, sida)));
        await bild(sidPar.fore.page, f("fore"));
        await bild(sidPar.efter.page, f("efter"));
        const separat = await diff(f("fore"), f("efter"), f("diff-separat"));
        // 2. Byte på plats i efter-sidan: efter → före → efter.
        const p = sidPar.efter.page;
        await p.evaluate(() => window.__frys());
        await bild(p, f("byte-efter1"));
        const okF = await p.evaluate((h) => window.__bytCss(h), `${FORE}/src/styles.css?pp570=fore`);
        await vanta(500);
        await bild(p, f("byte-fore"));
        const okE = await p.evaluate((h) => window.__bytCss(h), `${EFTER}/src/styles.css?pp570=efter`);
        await vanta(500);
        await bild(p, f("byte-efter2"));
        const byte = await diff(f("byte-fore"), f("byte-efter2"), f("diff-byte"));
        const kontroll = await diff(f("byte-efter1"), f("byte-efter2"), f("diff-kontroll"));
        const rad = { bredd: b.namn, sida: sida.namn, separat, byte, kontroll, bytLaddad: okF && okE };
        rapport.push(rad);
        console.log(`${b.namn.padEnd(8)} ${sida.namn.padEnd(24)} separat ${separat.olika} px (${separat.storlek})  byte ${byte.olika} px (${byte.storlek})  kontroll ${kontroll.olika} px${rad.bytLaddad ? "" : "  ⚠ bytet laddade inte"}`);
      }
      for (const v of Object.values(sidPar)) await v.ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(path.join(UT, "rapport.json"), JSON.stringify({ rapport, konsolfel }, null, 2));
console.log(`konsolfel: ${konsolfel.length} (se ${UT}/rapport.json)`);
