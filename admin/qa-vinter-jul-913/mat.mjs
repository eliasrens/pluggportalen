// ============================================================================
// QA #913 (slut-QA Vinter/Jul): skärmdumpar, pixeldiff, bildfrekvens och
// längsta uppgift mot appen i en QA-förhandsvisning (admin/qa-vinter-jul-913-
// preview.sh). Egen headless Chromium via cdp.mjs.
//
//   node mat.mjs sasong <origin> vinter jul halloween   # config/season via proxyns REST (emulatorn)
//   node mat.mjs bilder <origin> <utmapp> <prefix> [frys=1] vy…   # vy: port gate hus by gard rum
//   node mat.mjs diff a.png b.png [diff.png]
//   node mat.mjs stil <origin> <vy> [cpu=4] [css]   # stilberäkning (UpdateLayoutTree) per bildruta, spår 3 s × 3
//   node mat.mjs perf <origin> <vy> [dpr=2] [cpu=4] [sek=6] [vila=20] [css]
//   node mat.mjs steg <origin> <vy> <ut.png|-> <js>…   # inloggad (utom port/gate): kör varje js-steg (await), 1,5 s emellan
//
// Eleven är kc01 (lilla123, bara emulatorn). port/gate = utloggad.
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { startaChromium, sov } from "./cdp.mjs";
import { lasPng } from "../qa-vinter-blandtest.mjs";

const PROJ = "pluggportalen-so-2026";
const VYER = { admin: "/#/larare/admin/sasong", shop: "/#/elev/shop", avatar: "/#/elev/avatar", profil: "/#/elev/profil", port: "/#/", gate: "/#/larare", hus: "/#/elev/hus", by: "/#/elev/by", gard: "/#/elev/gard", rum: "/#/elev/rum" };
const FRYS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

export async function sattSasong(origin, season, tillagg = []) {
  // Ett tal sist = påslagna tillägg slutar om så många sekunder (test 5b).
  const sek = tillagg.find((x) => /^\d+$/.test(x));
  const till = sek ? { timestampValue: new Date(Date.now() + Number(sek) * 1000).toISOString() } : { nullValue: null };
  const f = { season: { stringValue: season }, updatedBy: { stringValue: "qa-913" } };
  for (const t of ["halloween", "jul"]) {
    f[t] = { booleanValue: tillagg.includes(t) };
    f[`${t}Until`] = tillagg.includes(t) ? till : { nullValue: null };
  }
  const url = `${origin}/v1/projects/${PROJ}/databases/(default)/documents/config/season`;
  const r = season === "bort"
    ? await fetch(url, { method: "DELETE", headers: { Authorization: "Bearer owner" } })
    : await fetch(url, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: f }) });
  if (!r.ok) throw new Error(`config/season ${r.status} ${await r.text()}`);
}

async function loggaInLarare(b, origin) {
  await b.goto(`${origin}/#/larare`);
  await b.vanta("!!document.querySelector('#username')");
  await b.eval(`(() => { const s = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    s(document.querySelector('#username'), 'qaadmin'); s(document.querySelector('#p'), 'lilla123'); document.querySelector('#submit').click(); })()`);
  await b.vanta("location.hash.startsWith('#/larare/')", 40000);
  await sov(2500);
}

async function loggaIn(b, origin) {
  await b.goto(`${origin}/#/`);
  await b.vanta("!!document.querySelector('#u')");
  await b.eval(`(() => { const s = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    s(document.querySelector('#u'), 'kc01'); s(document.querySelector('#p'), 'lilla123'); document.querySelector('#submit').click(); })()`);
  await b.vanta("location.hash.startsWith('#/elev')", 40000);
  await sov(2500);
}

async function oppnaVy(b, origin, vy, inloggad) {
  if (!inloggad) await b.goto(`${origin}${VYER[vy]}`);
  else await b.eval(`location.hash = ${JSON.stringify(VYER[vy].slice(1))}`);
  await b.eval("document.fonts.ready.then(() => true)");
  await sov(vy === "by" ? 9000 : 7000); // läsningar, kamerazoom, snöns rastrering (#908)
}

async function bilder(origin, ut, prefix, frys, vyer) {
  mkdirSync(ut, { recursive: true });
  const ute = vyer.filter((v) => v === "port" || v === "gate");
  const inne = vyer.filter((v) => !ute.includes(v));
  const filer = [];
  const ta = async (b, vy, inloggad) => {
    await oppnaVy(b, origin, vy, inloggad);
    if (frys) await b.eval(`(() => { const s = document.createElement('style'); s.id = 'qa-frys'; s.textContent = ${JSON.stringify(FRYS)}; document.head.append(s); return true; })()`);
    await sov(600);
    const fil = join(ut, `${prefix}-${vy}.png`);
    writeFileSync(fil, await b.bild());
    if (frys) await b.eval("document.getElementById('qa-frys')?.remove(), true");
    filer.push(fil);
  };
  for (const vy of ute) {
    const b = await startaChromium();
    try { await ta(b, vy, false); } finally { await b.stang(); }
  }
  if (inne.length) {
    const b = await startaChromium();
    try {
      await loggaIn(b, origin);
      for (const vy of inne) await ta(b, vy, true);
    } finally { await b.stang(); }
  }
  console.log(filer.join("\n"));
}

function diff(a, b, ut) {
  const A = lasPng(readFileSync(a)), B = lasPng(readFileSync(b));
  if (A.w !== B.w || A.h !== B.h) return console.log(JSON.stringify({ a, b, olika: -1 }));
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  const mask = Buffer.alloc(A.w * A.h * 3);
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    const i = y * A.w + x;
    let olik = false;
    for (let c = 0; c < 3; c++) if (A.data[i * A.k + c] !== B.data[i * B.k + c]) olik = true;
    const v = A.data[i * A.k + 1] >> 2;
    mask[i * 3] = olik ? 255 : v; mask[i * 3 + 1] = olik ? 0 : v; mask[i * 3 + 2] = olik ? 0 : v;
    if (olik) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  if (ut && n) writeFileSync(ut, png(A.w, A.h, mask));
  console.log(JSON.stringify({ a: a.split("/").pop(), b: b.split("/").pop(), olika: n, ruta: n ? [x0, y0, x1, y1] : null }));
}

function png(w, h, rgb) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (typ, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(typ), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function steg(origin, vy, ut, js) {
  const b = await startaChromium();
  const fel = [];
  b.on((m) => {
    if (m.method === "Runtime.exceptionThrown") fel.push(m.params.exceptionDetails.exception?.description?.split("\n")[0] || m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") fel.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  });
  try {
    const inloggad = !(vy === "port" || vy === "gate");
    // QA_RED=1: reducerad rörelse (prefers-reduced-motion: reduce) före sidan.
    // QA_SKIFT=<ms>: elevens klocka (Date) flyttas – serverNow() ska ändå stå rätt (test 5b).
    if (process.env.QA_SKIFT) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const D = Date, k = ${Number(process.env.QA_SKIFT)};
      class S extends D { constructor(...a) { super(...(a.length ? a : [D.now() + k])); } static now() { return D.now() + k; } }
      globalThis.Date = S; })();` });
    // QA_INIT=<js>: eget init-skript före sidkoden (t.ex. en MutationObserver för blinktestet 4b).
    if (process.env.QA_INIT) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: process.env.QA_INIT });
    if (process.env.QA_RED) await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    if (vy === "admin") await loggaInLarare(b, origin);
    else if (inloggad) await loggaIn(b, origin);
    await oppnaVy(b, origin, vy, inloggad);
    for (const s of js) {
      console.log(JSON.stringify(await b.eval(`(async () => { ${s} })()`)));
      await sov(1500);
    }
    if (ut !== "-") writeFileSync(ut, await b.bild());
    console.log(JSON.stringify({ konsolfel: fel }));
  } finally { await b.stang(); }
}

// Stilberäkning per bildruta (F1 i Halloween-QA:n): spåra 3 s i vila och summera
// UpdateLayoutTree/RecalculateStyles på huvudtråden, delat med antalet bildrutor.
async function stil(origin, vy, cpu = 4, css = "") {
  const b = await startaChromium();
  try {
    const inloggad = !(vy === "port" || vy === "gate");
    if (inloggad) await loggaIn(b, origin);
    await b.goto(`${origin}/?qa=stil${VYER[vy].slice(1)}`);
    await sov(15000);
    if (css) await b.eval(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.append(s); return true; })()`);
    await b.send("Emulation.setCPUThrottlingRate", { rate: Number(cpu) });
    await sov(1500);
    const ut = [];
    for (let i = 0; i < 3; i++) {
      const ev = [];
      const av = b.on((m) => { if (m.method === "Tracing.dataCollected") ev.push(...m.params.value); });
      const klar = new Promise((r) => { const av2 = b.on((m) => { if (m.method === "Tracing.tracingComplete") { av2(); r(); } }); });
      await b.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline.frame"] } });
      await sov(3000);
      await b.send("Tracing.end");
      await klar;
      av();
      const stilMs = ev.filter((e) => (e.name === "UpdateLayoutTree" || e.name === "RecalculateStyles") && e.ph === "X").reduce((s, e) => s + (e.dur || 0), 0) / 1000;
      const rutor = ev.filter((e) => e.name === "BeginMainThreadFrame" || e.name === "BeginFrame").length || 1;
      const anim = ev.filter((e) => e.name === "Animation").length;
      ut.push({ stilMs: Math.round(stilMs), rutor, msPerRuta: Math.round((stilMs / rutor) * 100) / 100 });
    }
    console.log(JSON.stringify({ vy, cpu: Number(cpu), css: css || undefined, matningar: ut }));
  } finally { await b.stang(); }
}

// Längsta uppgift under första laddningen + bildfrekvens i vila. Strypningen
// sätts FÖRE navigeringen; PerformanceObserver för longtask registreras i ett
// init-skript så att uppgifterna från första ritningen kommer med.
async function perf(origin, vy, dpr = 2, cpu = 4, sek = 6, vila = 20, css = "") {
  const b = await startaChromium({ dpr: Number(dpr) });
  try {
    const inloggad = !(vy === "port" || vy === "gate");
    if (inloggad) await loggaIn(b, origin);
    await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}` });
    await b.send("Emulation.setCPUThrottlingRate", { rate: Number(cpu) });
    const t0 = Date.now();
    // Ny sökväg (?qa=perf) = full laddning även när bara hashen skiljer (annars laddas inget om).
    await b.goto(`${origin}/?qa=perf${VYER[vy].slice(1)}`);
    await sov(Number(vila) * 1000); // laddning, zoom och snöns rastrering
    const lt = await b.eval("window.__lt.splice(0)");
    // A/B: extra CSS före fps-mätningen (t.ex. .sz-sno-lager{display:none}).
    if (css) await b.eval(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.append(s); return true; })()`);
    const fps = [];
    for (let i = 0; i < 3; i++) {
      fps.push(await b.eval(`new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ${sek * 1000}) requestAnimationFrame(f); else ok(Math.round(10 * n * 1000 / (performance.now() - t0)) / 10); }; requestAnimationFrame(f); })`));
    }
    const ltVila = await b.eval("window.__lt.splice(0)"); // långa uppgifter UNDER fps-mätningen (vila)
    const lager = await b.eval(`({ sno: document.querySelectorAll('.sz-sno').length, lov: document.querySelectorAll('.sz-lov').length,
      fladder: document.querySelectorAll('.sz-fladder').length, jul: document.documentElement.dataset.jul || '', hw: document.documentElement.dataset.halloween || '',
      sasong: document.documentElement.dataset.sasong || '' })`);
    const max = lt.reduce((m, [, d]) => Math.max(m, d), 0);
    console.log(JSON.stringify({ vy, dpr: Number(dpr), cpu: Number(cpu), css: css || undefined, langstaUppgiftMs: max, antalLanga: lt.length, langaIVila: ltVila.length, maxIVila: ltVila.reduce((m, [, d]) => Math.max(m, d), 0), fps, lager, sek: Math.round((Date.now() - t0) / 1000) }));
  } finally { await b.stang(); }
}

const [kmd, ...a] = process.argv.slice(2);
if (kmd === "sasong") await sattSasong(a[0], a[1], a.slice(2)).then(() => console.log("config/season =", a.slice(1).join(" ")));
else if (kmd === "bilder") await bilder(a[0], a[1], a[2], a[3] !== "0", a.slice(4));
else if (kmd === "diff") diff(a[0], a[1], a[2]);
else if (kmd === "steg") await steg(a[0], a[1], a[2], a.slice(3));
else if (kmd === "stil") await stil(...a);
else if (kmd === "perf") await perf(...a);
else console.log("kmd: sasong | bilder | diff | perf");
