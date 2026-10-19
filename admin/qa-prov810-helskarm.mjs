// ============================================================================
// QA #810: helskärmsläget i en RIKTIG (headful) Chromium under Xvfb – Esc, flikbyte
// och Alt+Tab (fokus i ett annat fönster > 2 s) som webbläsaren själv hanterar.
// CDP-Esc når aldrig webbläsarens helskärmsutgång (#782), så Esc trycks i X-servern
// med XTest (libXtst via python ctypes) – samma väg som ett tangentbord.
//
//   (bash admin/qa-prov810-preview.sh igång i ett annat skal)
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8981 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9981 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 APP=http://127.0.0.1:8810 BILDER=/tmp/qa-810 \
//   xvfb-run -a -s "-screen 0 1920x1080x24" node admin/qa-prov810-helskarm.mjs
//
// Skapar ett eget öppet tillfälle (10 min, helskärm på) för 4A – eller tar provet som 4A:s
// fokuslås pekar på – och låter Dante (4a04) skriva det från början. Läraren "släpper in" med samma skrivning som slappIn (admin-SDK:t – lärarens
// knappar och reglerna testas i webbläsaren mot översikten och i rules-sviten).
// ============================================================================
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import admin from "firebase-admin";
import { auth, db, isEmulator, teacherUsernameToEmail } from "./_shared.mjs";
import { delaUppProv } from "../src/prov/prov-modell.js";

if (!isEmulator) { console.error("Bara mot emulatorn."); process.exit(1); }
const APP = process.env.APP || "http://127.0.0.1:8810";
const BILDER = process.env.BILDER || "";
const CHROME = process.env.CHROME || "chromium";
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
let fel = 0;
const ok = (namn, villkor, info = "") => {
  if (!villkor) fel++;
  console.log(`${villkor ? "OK " : "FEL"} ${namn}${info ? ` – ${info}` : ""}`);
};

// --- X: en riktig Esc ---------------------------------------------------------
const X_ESC = `
import ctypes
x = ctypes.CDLL("libX11.so.6"); t = ctypes.CDLL("libXtst.so.6")
x.XOpenDisplay.restype = ctypes.c_void_p; d = x.XOpenDisplay(None)
x.XStringToKeysym.restype = ctypes.c_ulong; ks = x.XStringToKeysym(b"Escape")
x.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]; kc = x.XKeysymToKeycode(d, ks)
t.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
t.XTestFakeKeyEvent(d, kc, 1, 0); t.XTestFakeKeyEvent(d, kc, 0, 0)
x.XFlush.argtypes = [ctypes.c_void_p]; x.XFlush(d)
`;

// --- CDP ------------------------------------------------------------------------
const profil = mkdtempSync(join(tmpdir(), "qa810-"));
const chrome = spawn(CHROME, [
  "--remote-debugging-port=0", `--user-data-dir=${profil}`, "--no-first-run", "--no-default-browser-check",
  "--window-size=1366,768", "--window-position=0,0", "--disable-gpu", "--no-sandbox",
  // Ett annat fönster överst ska bara ta fokus (Alt+Tab), inte dölja provfliken.
  "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "about:blank",
], { stdio: "ignore", detached: true });
process.once("exit", () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} });
const portFil = join(profil, "DevToolsActivePort");
for (let i = 0; i < 300 && !existsSync(portFil); i++) await vila(100);
const [cdpPort, cdpPath] = readFileSync(portFil, "utf8").trim().split("\n");
const wsUrl = `ws://127.0.0.1:${cdpPort}${cdpPath}`;
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nr = 0;
const vantar = new Map();
const lyss = new Set();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && vantar.has(m.id)) {
    const { res, rej } = vantar.get(m.id);
    vantar.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else lyss.forEach((f) => f(m));
});
const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++nr;
  vantar.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

async function flik(url, { nyttFonster = false } = {}) {
  const { targetId } = await cdp("Target.createTarget", { url, newWindow: nyttFonster });
  const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => cdp(m, p, sessionId);
  await s("Runtime.enable");
  await s("Page.enable");
  const ev = async (uttryck) => {
    const r = await s("Runtime.evaluate", { expression: uttryck, awaitPromise: true, returnByValue: true, userGesture: false });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const vanta = async (uttryck, ms = 15000) => {
    const slut = Date.now() + ms;
    while (Date.now() < slut) {
      if (await ev(uttryck).catch(() => false)) return true;
      await vila(250);
    }
    throw new Error(`väntade förgäves på ${uttryck}`);
  };
  // Ett RIKTIGT klick (CDP-musen ger användaraktivering – requestFullscreen kräver det).
  const klickText = async (text) => {
    const r = await ev(`(() => { const b = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length);
      if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!r) throw new Error(`ingen knapp: ${text}`);
    await s("Page.bringToFront");
    for (const type of ["mousePressed", "mouseReleased"]) await s("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
  };
  const bild = async (namn) => {
    if (!BILDER) return;
    mkdirSync(BILDER, { recursive: true });
    const r = await s("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${BILDER}/${namn}.png`, Buffer.from(r.data, "base64"));
  };
  return { targetId, s, ev, vanta, klickText, bild };
}

// --- Data -----------------------------------------------------------------------
const u4 = (await auth.getUserByEmail(teacherUsernameToEmail("qaarskurs4"))).uid;
const dante = (await auth.getUserByEmail("4a04@elev.pluggportalen.local")).uid;
const prov = (await db.doc("prov/qa810").get()).data();
const { fragor, facit, bedomningsstod } = delaUppProv(prov);
// Har 4A ett fokuslås på ett prov skickar låset eleven dit – använd då det tillfället.
const las = (await db.doc("classes/4a").get()).data()?.lock;
let tRef;
if (las?.mal?.typ === "prov") tRef = db.doc(`provTillfallen/${las.mal.id}`);
else {
  tRef = await db.collection("provTillfallen").add({
    provId: "qa810", provNamn: prov.namn, classId: "4a", createdBy: u4, createdByName: "Årskurs 4",
    status: "oppet", fragor, installningar: prov.installningar, tidsgransMin: 10, fokus: { pa: false, doljOvrigt: true },
    helskarm: true, helskarmUndantag: [], skapad: new Date(), oppnad: new Date(),
  });
  await tRef.collection("privat").doc("facit").set({ facit, bedomningsstod });
}
const t = tRef.id;
await tRef.collection("svar").doc(dante).delete(); // Dante börjar om
const svarRef = tRef.collection("svar").doc(dante);
const svar = async () => (await svarRef.get()).data() || {};
const slappIn = () => svarRef.update({ pausad: false, slapptInAt: admin.firestore.FieldValue.serverTimestamp() });
console.log(`tillfälle ${t}, elev Dante ${dante}`);

// --- Elev -------------------------------------------------------------------------
const e = await flik(`${APP}/#/`);
await e.vanta(`!!document.querySelector("form input")`, 30000);
await e.ev(`(() => { const set = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
  const i = document.querySelectorAll("form input"); set(i[0], "4a04"); set(i[1], "lilla123"); document.querySelector("form button").click(); })()`);
await e.vanta(`location.hash.startsWith("#/elev")`, 30000);
await vila(12000); // "Sajten uppdateras" efter inloggningen (#766)
await e.ev(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Kör igång"))?.click(), true`);
await vila(1500);
await e.ev(`location.hash = "#/elev/prov/skriv?t=${t}"`);
await e.vanta(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Starta provet")`, 20000);
ok("startrutan förklarar helskärmen", await e.ev(`document.body.innerText.includes("Provet visas i helskärm. Om du lämnar helskärmen pausas provet")`));
await e.bild("xvfb-1-start");
await e.klickText("Starta provet");
await e.vanta(`document.querySelectorAll(".provv-rot input").length > 0`);
await vila(800);
ok("Starta provet → helskärm", await e.ev(`!!document.fullscreenElement`),
  await e.ev(`JSON.stringify({ fs: !!document.fullscreenElement, fokus: document.hasFocus(), dold: document.hidden, paus: !!document.querySelector(".provv-paus"), hash: location.hash })`));
ok("ingen helskarmFel när helskärmen gick", (await svar()).helskarmFel !== true);
// Ett svar, och scrolla ner så att "samma plats" kan kontrolleras.
await e.ev(`(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Björkö"); l.click(); return true; })()`);
await vila(5500);
await e.ev(`window.scrollTo(0, 300)`);
await vila(300);
const scroll0 = await e.ev(`window.scrollY`);
console.log("   (före Esc)", await e.ev(`JSON.stringify({ y: scrollY, h: innerHeight, sh: document.documentElement.scrollHeight, fs: !!document.fullscreenElement })`));

const pausadVy = `!!document.querySelector(".provv-paus") && document.querySelectorAll(".provv-rot input, .provv-rot textarea").length === 0 && !document.body.innerText.includes("Var låg Birka")`;
async function tillbaka(steg) {
  await slappIn();
  await e.vanta(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Fortsätt provet" && !b.hidden)`);
  await e.bild(`xvfb-${steg}-slappt-in`);
  await e.klickText("Fortsätt provet");
  await e.vanta(`document.querySelectorAll(".provv-rot input").length > 0`);
  await vila(800);
}

// 1. Esc (riktig tangent i X)
await e.s("Page.bringToFront");
execFileSync("python3", ["-c", X_ESC]);
await e.vanta(pausadVy, 8000).catch(() => {});
ok("Esc: ur helskärm", !(await e.ev(`!!document.fullscreenElement`)));
ok("Esc: pausat, frågorna borta ur DOM:en", await e.ev(pausadVy));
await vila(1500);
let d = await svar();
ok("Esc: svar.pausad, pausOrsak helskarm, flikbyten 1, svaret sparat", d.pausad === true && d.pausOrsak === "helskarm" && d.flikbyten === 1 && d.pausLogg?.length === 1 && d.svar?.[fragor[0].id] === 0, JSON.stringify({ p: d.pausad, o: d.pausOrsak, f: d.flikbyten, l: d.pausLogg?.length, s: d.svar }));
await e.s("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
await e.bild("xvfb-2-pausad-1366");
await e.s("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await e.bild("xvfb-2-pausad-1920");
await e.s("Emulation.clearDeviceMetricsOverride");
// Fler lämningar under pausen ger ingen ny skrivning.
const andrad0 = d.uppdaterad?.toMillis?.();
await tillbaka(3);
// Samma plats: scrollY som förut, eller så långt det går i helskärm (hela skärmens höjd –
// utan fönsterhanterare i Xvfb krymper fönstret tillbaka efteråt, men scrollen har redan klämts).
const mal = Math.min(scroll0, await e.ev(`document.documentElement.scrollHeight - screen.height`));
ok("Fortsätt provet → helskärm igen, samma plats, svaret kvar", await e.ev(`!!document.fullscreenElement`) &&
  Math.abs((await e.ev(`window.scrollY`)) - mal) < 5 && await e.ev(`[...document.querySelectorAll("input:checked")].some((i) => i.closest("label")?.textContent.trim() === "Björkö")`),
  `scroll ${await e.ev(`window.scrollY`)} (förut ${scroll0}, mål ${mal}) ${await e.ev(`JSON.stringify({ h: innerHeight, sh: document.documentElement.scrollHeight })`)}`);

// 2. Flikbyte: en ny flik i samma fönster läggs överst
const annan = await flik("data:text/html,<h1>Ett annat program</h1>");
await annan.s("Page.bringToFront");
await cdp("Target.activateTarget", { targetId: annan.targetId });
await vila(2500);
ok("flikbyte: provfliken dold", await e.ev(`document.hidden`));
await cdp("Target.closeTarget", { targetId: annan.targetId });
await e.s("Page.bringToFront");
await vila(1500);
ok("flikbyte: pausat, frågorna borta", await e.ev(pausadVy));
d = await svar();
ok("flikbyte: EN skrivning – flikbyten 2, pausLogg 2, pausOrsak flik (ingen extra paus för helskärmen)", d.flikbyten === 2 && d.pausLogg?.length === 2 && d.pausLogg[1].orsak === "flik" && d.pausOrsak === "flik",
  JSON.stringify(d.pausLogg?.map((p) => p.orsak)));
await tillbaka(4);

// 3. Alt+Tab: fokus till ett annat fönster > 2 s (helskärmen ligger kvar). Sidan
// mäter själv när fönstret tappade fokus och när pausrutan kom.
const MATA = `(() => { window.__qa = { blur: 0, fokus: 0, paus: 0 };
  addEventListener("blur", () => { if (!__qa.blur) __qa.blur = performance.now(); });
  addEventListener("focus", () => { if (!__qa.fokus) __qa.fokus = performance.now(); });
  new MutationObserver(() => { if (!__qa.paus && document.querySelector(".provv-paus")) __qa.paus = performance.now(); })
    .observe(document.body, { childList: true, subtree: true }); return true; })()`;
await e.ev(MATA);
const fonster = await flik("data:text/html,<h1>Ett annat program</h1>", { nyttFonster: true });
await fonster.s("Page.bringToFront");
await cdp("Target.activateTarget", { targetId: fonster.targetId });
await vila(4000);
let m = await e.ev(`({ ...window.__qa, dold: document.hidden, fs: !!document.fullscreenElement })`);
const efter = m.paus && m.blur ? Math.round(m.paus - m.blur) : null;
ok("Alt+Tab: pausat först efter > 2 s utan fokus (inte dold)", efter != null && efter >= 1900 && efter < 4000 && !m.dold, `blur → paus ${efter} ms, ${JSON.stringify(m)}`);
await cdp("Target.closeTarget", { targetId: fonster.targetId });
await vila(1500);
d = await svar();
ok("Alt+Tab: pausOrsak fokus", d.pausad === true && d.pausOrsak === "fokus", `orsak ${d.pausOrsak}, logg ${JSON.stringify(d.pausLogg?.map((p) => p.orsak))}`);
await e.s("Page.bringToFront");
await cdp("Target.activateTarget", { targetId: e.targetId });
await tillbaka(5);

// 4. Kort fokusförlust (< 2 s) pausar inte. Ett nytt fönster tar ibland längre än 2 s att
// skapa i Xvfb – då ska det pausa (efter > 2 s); upp till tre försök att få en kort.
for (let forsok = 1; forsok <= 3; forsok++) {
  await vila(500);
  await e.ev(MATA);
  const kort = await flik("data:text/html,<h1>Kort</h1>", { nyttFonster: true });
  await cdp("Target.activateTarget", { targetId: kort.targetId });
  await cdp("Target.closeTarget", { targetId: kort.targetId });
  await e.s("Page.bringToFront");
  await cdp("Target.activateTarget", { targetId: e.targetId });
  await vila(3000);
  m = await e.ev(`({ ...window.__qa })`);
  const borta = m.blur && m.fokus ? Math.round(m.fokus - m.blur) : null;
  if (borta != null && borta < 1900) {
    ok("kort fokusförlust (< 2 s): inte pausat", !m.paus, `utan fokus ${borta} ms (försök ${forsok})`);
    break;
  }
  ok(`lång fokusförlust (${borta ?? "?"} ms): pausat först efter 2 s`, m.paus && m.paus - m.blur >= 1900, `blur → paus ${Math.round(m.paus - m.blur)} ms (försök ${forsok})`);
  if (await e.ev(`!!document.querySelector(".provv-paus")`)) await tillbaka(`5${forsok}`);
}

// 5. Omladdning mitt i provet = lämnat provet
const fore = (await svar()).flikbyten;
await e.s("Page.reload");
await vila(9000);
await e.vanta(`!!document.querySelector(".provv-paus")`, 20000).catch(() => {});
ok("omladdning: pausat (frågorna borta)", await e.ev(pausadVy));
d = await svar();
ok("omladdning: en paus till", d.pausad === true && d.flikbyten === fore + 1, `flikbyten ${fore} → ${d.flikbyten}`);
await tillbaka(6);

// 6. Lämna in → ut ur helskärm
await e.klickText("Lämna in");
await vila(800);
// Bekräftelserutan ("Du har svarat på …"): dess Lämna in.
if (await e.ev(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Gå tillbaka" && b.getClientRects().length)`)) await e.klickText("Lämna in");
await e.vanta(`(document.querySelector(".provv-banner")?.innerText || "").includes("Inlämnat")`, 15000).catch(() => {});
await vila(800);
ok("inlämnat: helskärmen avslutad, ingen paus", !(await e.ev(`!!document.fullscreenElement`)) && !(await e.ev(`!!document.querySelector(".provv-paus")`)),
  await e.ev(`JSON.stringify({ fs: !!document.fullscreenElement, paus: !!document.querySelector(".provv-paus"), banner: document.querySelector(".provv-banner")?.innerText, knappar: knapparna = [...document.querySelectorAll("button")].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()) })`.replace("knapparna = ", "")));
d = await svar();
ok("inlämnat i Firestore", d.inlamnad === true && d.pausad === false, `flikbyten ${d.flikbyten}, logg ${JSON.stringify(d.pausLogg?.map((p) => p.orsak))}`);
await e.bild("xvfb-7-inlamnat");

console.log(fel ? `${fel} FEL` : "ALLT OK");
ws.close();
process.exit(fel ? 1 : 0);
