// ============================================================================
// QA (#805): Mina klasser → Elever (kompakt elevtabell med ⋯) och Admin-sidan
// i en riktig webbläsare mot stub-förhandsvisningen
// (preview/preview-mina-klasser.html – hela appen mot ett minnes-Firestore).
// Inga beroenden: Node 22 (global WebSocket) + `chromium` i PATH.
//
//   node admin/qa-elever-admin-e2e.mjs --serve [utmapp]        (startar server.mjs på en slumpport)
//   node admin/qa-elever-admin-e2e.mjs http://127.0.0.1:<p> [utmapp]
//
// Kontrollerar (spec TESTER + §3.4/3.5): årskurslärare ser aldrig Ge mynt, Ta ur
// klassen, Ta bort konto, Lägg till elev, Ge hela klassen mynt, Skapa klass eller
// Admin; ⋯-menyn (tangentbord, Esc), Visa lösenord/mynt, sök, bekräftelserutor
// (aldrig confirm/prompt/alert), Ge mynt/hela klassen, Ta ur, Ta bort, Lägg till
// elev, Admin-sidans kort (skapa/döp om/ta bort klass), omdirigeringen av
// #/larare/admin/klasser, inga läsningar när Elever öppnas, mobil 320 px utan
// sidscroll. Skärmdumpar till utmappen. Avslutar med kod 1 om något fallerar.
// ============================================================================
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROT = fileURLToPath(new URL("..", import.meta.url));
const SERVE = process.argv.includes("--serve");
const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let server = null;
let BASE = SERVE ? null : (argv.shift() || "http://127.0.0.1:8805").replace(/\/$/, "");
const UT = argv[0] || "/tmp/qa-elever-admin";
mkdirSync(UT, { recursive: true });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const resultat = [];
const kolla = (namn, ok, info = "") => {
  resultat.push({ namn, ok: !!ok });
  console.log(`${ok ? "✓" : "✗"} ${namn}${ok ? "" : `  ${info}`}`);
};

if (SERVE) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  server = spawn("node", ["server.mjs"], { cwd: ROT, env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" }, stdio: "ignore" });
  BASE = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${BASE}/server.mjs`).then((r) => r.ok, () => false)) break;
    await vanta(200);
  }
}

async function webblasare(namn) {
  const dbg = 30000 + Math.floor(Math.random() * 20000);
  const dir = `/tmp/qa-elever-admin-${namn}-${dbg}`;
  const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${dbg}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let ver = null;
  for (let i = 0; i < 80 && !ver; i++) {
    await vanta(200);
    ver = await fetch(`http://127.0.0.1:${dbg}/json/version`).then((r) => r.json()).catch(() => null);
  }
  if (!ver) throw new Error("chromium startade inte");
  const sidor = await fetch(`http://127.0.0.1:${dbg}/json/list`).then((r) => r.json());
  const ws = new WebSocket(sidor.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let nr = 0;
  const svar = new Map();
  const fel = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && svar.has(m.id)) { svar.get(m.id)(m.result ?? m.error); svar.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") {
      const t = m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text;
      if (!/pages-varld\.js:\d+:\d+/.test(t)) fel.push(t); // känt och orelaterat (#697)
    }
    // Webbläsarens egna dialoger får aldrig dyka upp (§3.4: bekräftelse i en ruta på sidan).
    if (m.method === "Page.javascriptDialogOpening") { fel.push(`dialog: ${m.params.type} ${m.params.message}`); cdp("Page.handleJavaScriptDialog", { accept: false }); }
  });
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++nr; svar.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (u) => (await cdp("Runtime.evaluate", { expression: u, awaitPromise: true, returnByValue: true })).result?.value;
  const tills = async (u, ms = 12000) => {
    for (let t = 0; t < ms; t += 150) { if (await js(u)) return true; await vanta(150); }
    return false;
  };
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  const storlek = (w, h) => cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  const bild = async (filnamn, hel = true) => {
    const h = hel ? await js(`Math.min(4000, document.documentElement.scrollHeight)`) : null;
    const y = hel ? 0 : await js("scrollY");
    const w = await js("innerWidth");
    const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: hel,
      ...(hel ? { clip: { x: 0, y, width: w, height: h, scale: 1 } } : {}) });
    writeFileSync(`${UT}/${filnamn}.png`, Buffer.from(data, "base64"));
  };
  const ga = async (hash) => { await js(`location.hash = ${JSON.stringify(hash)}`); await vanta(300); };
  const sluta = () => { ws.close(); chrome.kill(); setTimeout(() => { try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {} }, 1500); };
  return { cdp, js, tills, storlek, bild, ga, sluta, fel };
}

async function oppna(b, roll) {
  await b.storlek(1366, 900);
  await b.cdp("Page.navigate", { url: `${BASE}/preview/preview-mina-klasser.html?roll=${roll}#/larare/hem` });
  return b.tills(`!!document.querySelector(".teacher-nav")`, 20000);
}

const klick = (b, sel) => b.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); return !!e; })()`);
const skriv = (b, sel, v) => b.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
const tangent = (b, key) => b.js(`document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, bubbles: true }))`);
const elever = (b) => b.tills(`!!document.querySelector(".et-tabell, .mk-innehall .hint") && !document.querySelector(".mk-innehall .spinner")`);
const ingenSidscroll = `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
const synligaNamn = `[...document.querySelectorAll(".et-elev:not([hidden]) .et-namn-txt")].map((n) => n.textContent).join(",")`;
const radMed = (namn) => `[...document.querySelectorAll(".et-elev")].find((r) => r.querySelector(".et-namn-txt").textContent === ${JSON.stringify(namn)})`;
const ADMINTEXT = /Ge mynt|Ge hela klassen mynt|Ta ur klassen|Ta bort konto|Lägg till elev|Skapa klass|Skapa en ny klass|Ta bort klass|Mynt/;

// ---------------------------------------------------------------- Årskurslärare
{
  const b = await webblasare("arskurs");
  kolla("årskurs: förhandsvisningen laddar", await oppna(b, "arskurs"));
  await b.js(`window.__ppStub.nollstallRakning()`);
  await b.ga("#/larare/mina-klasser?klass=4a&flik=elever");
  await elever(b);
  await vanta(400);
  // Läsningar: bara klasser + elever + kontot (som förut) – ingen läsning per elev när fliken öppnas.
  const las = await b.js(`window.__ppStub.rakna.logg.filter((l) => l.startsWith("las")).filter((l) => /studentData|studentCredentials/.test(l))`);
  kolla("Elever-fliken: inga läsningar per elev (studentData/studentCredentials) när den öppnas", las.length === 0, JSON.stringify(las));
  const vy = await b.js(`({ rader: document.querySelectorAll(".et-elev").length, huvud: [...document.querySelectorAll(".et-huvud [role=columnheader]")].map((h) => h.textContent.trim()).filter((t) => t && t !== "Fler val"),
    knappar: [...document.querySelectorAll(".et-knappar button")].map((k) => k.textContent.trim()), sok: !!document.querySelector(".et-sok-falt"), text: document.querySelector(".mk-page").innerText })`);
  kolla("årskurs: en rad per elev (7) med Namn · Användarnamn · Lösenord", vy.rader === 7 && vy.huvud.join("|") === "Namn|Användarnamn|Lösenord", JSON.stringify(vy.huvud));
  kolla("årskurs: bara Skriv ut inloggningskort överst + sökfält", vy.knappar.join("|") === "Skriv ut inloggningskort" && vy.sok, JSON.stringify(vy.knappar));
  kolla("årskurs: ingen admintext någonstans på sidan (Ge mynt, Ta bort konto, Skapa klass …)", !ADMINTEXT.test(vy.text), (vy.text.match(ADMINTEXT) || [])[0]);
  kolla("årskurs: Admin finns inte i toppmenyn eller profilmenyn", await b.js(`![...document.querySelectorAll(".teacher-nav a, .teacher-nav button")].some((a) => /Admin/.test(a.textContent))`));

  // ⋯-menyn: bara Byt lösenord; Esc stänger och fokus tillbaka.
  await b.js(`${radMed("Bilal")}.querySelector(".et-meny-knapp").click()`);
  const meny = await b.js(`[...document.querySelectorAll(".et-meny:not([hidden]) .et-menyval")].map((v) => v.textContent.trim())`);
  kolla("årskurs: ⋯ har bara Byt lösenord", JSON.stringify(meny) === '["Byt lösenord"]', JSON.stringify(meny));
  kolla("⋯: första valet får fokus", await b.js(`document.activeElement?.dataset.val === "losen"`));
  await b.bild("efter-arskurs-desktop-elever-meny", false);
  await tangent(b, "Escape");
  kolla("⋯: Esc stänger och fokus går tillbaka till ⋯", await b.js(`!document.querySelector(".et-meny:not([hidden])") && document.activeElement?.classList.contains("et-meny-knapp")`));
  await b.js(`${radMed("Bilal")}.querySelector(".et-meny-knapp").click()`);
  await b.js(`document.querySelector(".mk-namn").click()`);
  kolla("⋯: klick utanför stänger", await b.js(`!document.querySelector(".et-meny:not([hidden])")`));

  // Byt lösenord: samma dialog, användarnamnet låst.
  await b.js(`${radMed("Bilal")}.querySelector(".et-meny-knapp").click()`);
  await klick(b, '.et-meny:not([hidden]) [data-val="losen"]');
  kolla("Byt lösenord öppnar dialogen med låst användarnamn", await b.tills(`document.querySelector(".le-modal .le-user")?.disabled === true && !!document.querySelector(".le-modal .le-pass")`));
  await b.js(`document.querySelector(".le-modal .cx-modal-close")?.click()`);

  // Visa lösenord: en läsning, bara den eleven.
  await b.js(`window.__ppStub.nollstallRakning()`);
  await b.js(`${radMed("Cleo")}.querySelector(".et-los .et-visa").click()`);
  kolla("Visa lösenord visar lösenordet", await b.tills(`${radMed("Cleo")}.querySelector(".et-kod")?.textContent === "lilla123"`));
  const losLas = await b.js(`window.__ppStub.rakna.logg.filter((l) => l.startsWith("las"))`);
  kolla("Visa lösenord: exakt en läsning (studentCredentials för eleven)", losLas.length === 1 && /studentCredentials\/stub-cleo/.test(losLas[0]), JSON.stringify(losLas));

  // Långt lösenord (64 tecken, största tillåtna) får inte ge sidscroll (#805 F1).
  await b.js(`(async () => { const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    await fs.setDoc(fs.doc(fs.getFirestore(), "studentCredentials", "stub-alva"), { username: "4a01", password: "${"x".repeat(64)}" }); })()`);
  await b.js(`${radMed("Alva")}.querySelector(".et-los .et-visa").click()`);
  await b.tills(`${radMed("Alva")}.querySelector(".et-kod")?.textContent.length === 64`);
  for (const w of [320, 768]) {
    await b.storlek(w, 780);
    await vanta(300);
    kolla(`långt lösenord (64 tecken) vid ${w} px: ingen horisontell scroll`, await b.js(ingenSidscroll), String(await b.js("document.documentElement.scrollWidth")));
  }
  await b.storlek(1366, 900);

  // Sök.
  await skriv(b, ".et-sok-falt", "bi");
  kolla("sök 'bi' → bara Bilal", (await b.js(synligaNamn)) === "Bilal", await b.js(synligaNamn));
  await skriv(b, ".et-sok-falt", "4A0");
  kolla("sök på användarnamn (skiftlägesokänsligt) → alla 7", (await b.js(`document.querySelectorAll(".et-elev:not([hidden])").length`)) === 7);
  await skriv(b, ".et-sok-falt", "zzz");
  kolla("sök utan träff → 'Ingen elev matchar sökningen.'", await b.js(`document.querySelector(".et-ingen")?.hidden === false`));
  await skriv(b, ".et-sok-falt", "");

  // Skriv ut inloggningskort.
  await klick(b, ".et-skriv-ut");
  kolla("Skriv ut inloggningskort öppnar utskriftsvalet med klassens elever", await b.tills(`document.querySelectorAll(".lp-modal .lp-row").length === 7`));
  await b.js(`document.querySelector(".lp-modal .cx-modal-close")?.click()`);
  await b.bild("efter-arskurs-desktop-elever");

  // Admin-adresser.
  await b.ga("#/larare/admin");
  kolla("årskurs: #/larare/admin → 'Det här kan bara admin göra.'", await b.tills(`/Det här kan bara admin göra\\./.test(document.querySelector("#app").innerText) && !document.querySelector(".adm-kort")`));
  await b.ga("#/larare/admin/klasser?klass=4b");
  kolla("årskurs: gamla #/larare/admin/klasser?klass=4b → Mina klasser → Elever för 4B", await b.tills(`/flik=elever/.test(location.hash) && document.querySelector(".mk-namn")?.textContent === "4B" && !!document.querySelector(".et-tabell")`));

  // Mobil.
  for (const w of [320, 375]) {
    await b.storlek(w, 780);
    await b.ga("#/larare/mina-klasser?klass=4a&flik=elever");
    await elever(b);
    await b.js(`${radMed("Alva")}.querySelector(".et-meny-knapp").click()`);
    await vanta(300);
    kolla(`årskurs mobil ${w} px: ingen horisontell scroll (meny öppen)`, await b.js(ingenSidscroll), String(await b.js("document.documentElement.scrollWidth")));
    if (w === 320) await b.bild("efter-arskurs-mobil-elever");
  }
  if (b.fel.length) console.log("  JS-fel (årskurs):", b.fel.slice(0, 5));
  kolla("årskurs: inga JS-fel och inga webbläsardialoger", b.fel.length === 0);
  b.sluta();
}

// ---------------------------------------------------------------- Admin
{
  const b = await webblasare("admin");
  kolla("admin: förhandsvisningen laddar", await oppna(b, "admin"));
  await b.js(`window.__ppStub.nollstallRakning()`);
  await b.ga("#/larare/mina-klasser?klass=4a&flik=elever");
  await elever(b);
  await b.tills(`/Klasscentret/.test(document.querySelector(".mk-innehall").innerText)`);
  const vy = await b.js(`({ huvud: [...document.querySelectorAll(".et-huvud [role=columnheader]")].map((h) => h.textContent.trim()).filter((t) => t && t !== "Fler val"),
    knappar: [...document.querySelectorAll(".et-knappar button")].map((k) => k.textContent.trim()) })`);
  kolla("admin: kolumnerna Namn · Användarnamn · Lösenord · Mynt", vy.huvud.join("|") === "Namn|Användarnamn|Lösenord|Mynt", JSON.stringify(vy.huvud));
  kolla("admin: Skriv ut inloggningskort · Ge hela klassen mynt · Lägg till elev", vy.knappar.join("|") === "Skriv ut inloggningskort|Ge hela klassen mynt|Lägg till elev", JSON.stringify(vy.knappar));
  const las = await b.js(`window.__ppStub.rakna.logg.filter((l) => l.startsWith("las") && /studentData|studentCredentials/.test(l))`);
  kolla("admin: inga läsningar per elev när Elever öppnas (Mynt visas först vid Visa)", las.length === 0, JSON.stringify(las));
  kolla("admin: destruktiva val aldrig framme på raden", await b.js(`![...document.querySelectorAll(".et-rad")].some((r) => [...r.querySelectorAll("button")].some((k) => !k.closest(".et-meny") && /Ta bort|Ta ur/.test(k.textContent)))`));

  await b.js(`${radMed("Alva")}.querySelector(".et-meny-knapp").click()`);
  const meny = await b.js(`[...document.querySelectorAll(".et-meny:not([hidden]) .et-menyval")].map((v) => v.textContent.trim())`);
  kolla("admin: ⋯ = Byt lösenord eller användarnamn, Ändra namn och avatar, Ge mynt, Ta ur klassen, Ta bort konto",
    meny.join("|") === "Byt lösenord eller användarnamn|Ändra namn och avatar|Ge mynt|Ta ur klassen|Ta bort konto", JSON.stringify(meny));
  await tangent(b, "ArrowUp");
  kolla("⋯: pil upp från första går till sista (Ta bort konto)", await b.js(`document.activeElement?.dataset.val === "bort"`));
  await b.bild("efter-admin-desktop-elever-meny", false);
  await tangent(b, "Escape");

  // Visa mynt + Ge mynt.
  await b.js(`${radMed("Alva")}.querySelector(".et-mynt .et-visa").click()`);
  kolla("Visa mynt visar saldot (47)", await b.tills(`/^47/.test(${radMed("Alva")}.querySelector(".et-mynt .et-visat")?.textContent.trim() || "")`));
  await b.js(`${radMed("Alva")}.querySelector(".et-meny-knapp").click()`);
  await klick(b, '.et-meny:not([hidden]) [data-val="mynt"]');
  await b.tills(`!!${radMed("Alva")}.querySelector(".et-panel .gc-give")`);
  kolla("Ge mynt: samma gräns som hela klassen (1001 nekas)", await b.js(`(async () => { const r = ${radMed("Alva")}; r.querySelector(".et-panel .gc-amount").value = "1001"; r.querySelector(".et-panel .gc-give").click();
    await new Promise((v) => setTimeout(v, 200)); return /Högst 1000/.test(r.querySelector(".gc-flash").textContent); })()`));
  await b.js(`${radMed("Alva")}.querySelector(".et-panel .gc-quick[data-add='50']").click(); ${radMed("Alva")}.querySelector(".et-panel .gc-give").click()`);
  kolla("Ge mynt (+50) → nytt saldo 97 i panelen och kolumnen", await b.tills(`/nytt saldo: 97/.test(${radMed("Alva")}.querySelector(".gc-flash").textContent) && /^97/.test(${radMed("Alva")}.querySelector(".et-mynt .et-visat").textContent.trim())`));

  // Ge hela klassen mynt (bekräftelse i ruta).
  await klick(b, '.et-knappar [data-klass="mynt"]');
  await b.tills(`!!document.querySelector(".et-klasspanel .gc-give")`);
  await b.js(`document.querySelector(".et-klasspanel .gc-amount").value = "5"; document.querySelector(".et-klasspanel .gc-give").click()`);
  kolla("Ge hela klassen mynt: bekräftelseruta på sidan först", await b.tills(`/var och en av 7 elever/.test(document.querySelector(".et-klasspanel .et-bekrafta")?.textContent || "")`));
  await b.bild("efter-admin-desktop-hela-klassen-mynt", false);
  await klick(b, ".et-klasspanel .et-ja");
  kolla("… Ja → 7 elever fick 5 var, Alva nu 102", await b.tills(`/7 elever fick 5/.test(document.querySelector(".et-klasspanel .gc-flash").textContent) && /^102/.test(${radMed("Alva")}.querySelector(".et-mynt .et-visat").textContent.trim())`),
    await b.js(`document.querySelector(".et-klasspanel")?.innerText`));
  kolla("… och sparat i studentData (Bilal 54 + 5 = 59)", (await b.js(`window.__ppStub.las("studentData/stub-bilal")?.coins`)) === 59);
  await klick(b, '.et-knappar [data-klass="mynt"]');

  // Ändra namn och avatar.
  await b.js(`${radMed("Cleo")}.querySelector(".et-meny-knapp").click()`);
  await klick(b, '.et-meny:not([hidden]) [data-val="namn"]');
  await b.tills(`!!document.querySelector(".et-panel .mm-namn")`);
  await b.js(`document.querySelector(".et-panel .mm-namn").value = "Cleopatra"; document.querySelector(".et-panel .mm-save").click()`);
  kolla("Ändra namn → raden heter Cleopatra", await b.tills(`!!${radMed("Cleopatra")}`));

  // Ta ur klassen: Avbryt först, sedan Ja.
  await b.js(`${radMed("Dante")}.querySelector(".et-meny-knapp").click()`);
  await klick(b, '.et-meny:not([hidden]) [data-val="ur"]');
  kolla("Ta ur klassen: bekräftelseruta under raden", await b.tills(`/Ta <?b?>?Dante|Dante/.test(${radMed("Dante")}.querySelector(".et-bekrafta")?.textContent || "")`));
  kolla("… fokus på Avbryt", await b.js(`document.activeElement?.classList.contains("et-avbryt")`));
  await b.bild("efter-admin-desktop-bekrafta", false);
  await b.js(`${radMed("Dante")}.querySelector(".et-avbryt").click()`);
  kolla("… Avbryt stänger, Dante kvar", await b.js(`!!${radMed("Dante")} && ${radMed("Dante")}.querySelector(".et-panel").hidden`));
  await b.js(`${radMed("Dante")}.querySelector(".et-meny-knapp").click()`);
  await klick(b, '.et-meny:not([hidden]) [data-val="ur"]');
  await b.tills(`!!${radMed("Dante")}?.querySelector(".et-ja")`);
  await b.js(`${radMed("Dante")}.querySelector(".et-ja").click()`);
  kolla("… Ja → Dante borta, 6 elever i huvudet, kontot finns kvar", await b.tills(`!${radMed("Dante")} && document.querySelector(".mk-antal").textContent === "6 elever"`) &&
    !!(await b.js(`window.__ppStub.las("students/stub-dante")`)));

  // Ta bort konto.
  await b.js(`${radMed("Ebba")}.querySelector(".et-meny-knapp").click()`);
  await klick(b, '.et-meny:not([hidden]) [data-val="bort"]');
  await b.tills(`!!${radMed("Ebba")}?.querySelector(".et-bekrafta.farlig .et-ja")`);
  await b.js(`${radMed("Ebba")}.querySelector(".et-ja").click()`);
  const ebbaBorta = await b.tills(`!${radMed("Ebba")}`);
  kolla("Ta bort konto (bekräftat) → Ebba borta och kontot raderat (inget tomt students-dokument kvar)", ebbaBorta && !(await b.js(`window.__ppStub.las("students/stub-ebba")`)),
    JSON.stringify({ ebbaBorta, doc: await b.js(`window.__ppStub.las("students/stub-ebba")`), logg: await b.js(`window.__ppStub.rakna.logg.filter((l) => /ebba/.test(l))`) }));

  // Lägg till elev: befintliga (Dante tillbaka).
  await klick(b, '.et-knappar [data-klass="lagg-till"]');
  kolla("Lägg till elev: Skapa nya elevkonton (öppen) + Lägg till befintliga", await b.tills(`document.querySelectorAll(".et-klasspanel .mm-add").length === 2 && !!document.querySelector(".et-klasspanel .mm-create")`));
  await b.bild("efter-admin-desktop-lagg-till", false);
  await b.js(`document.querySelectorAll(".et-klasspanel .mm-add")[1].open = true; document.querySelector('.et-klasspanel .mm-existing input[value="stub-dante"]').checked = true; document.querySelector(".et-klasspanel .mm-link").click()`);
  kolla("… Lägg till valda → Dante tillbaka (6 elever)", await b.tills(`!!${radMed("Dante")} && document.querySelector(".mk-antal").textContent === "6 elever"`));

  // Klasscentret ligger kvar under tabellen.
  kolla("Klasscentret under tabellen (admin)", await b.js(`/Vem får inreda/.test(document.querySelector(".mk-innehall").innerText)`));
  await b.bild("efter-admin-desktop-elever");

  // Admin-sidan.
  await b.ga("#/larare/admin/klasser");
  kolla("gamla #/larare/admin/klasser → #/larare/admin", await b.tills(`location.hash === "#/larare/admin" && !!document.querySelector(".adm-kort")`));
  const kort = await b.js(`[...document.querySelectorAll(".adm-kortet b")].map((k) => k.textContent)`);
  kolla("Admin: kort Skapa klass · Döp om klass · Ta bort klass · Lärarkonton · Säsong · Hitta rätt! · Mattematchen",
    kort.join("|") === "Skapa klass|Döp om klass|Ta bort klass|Lärarkonton|Säsong|Hitta rätt!|Mattematchen", JSON.stringify(kort));
  kolla("Admin: underraden Översikt · Lärarkonton · Säsong", (await b.js(`[...document.querySelectorAll(".teacher-subnav .tsub")].map((a) => a.textContent.trim()).join("|")`)) === "Översikt|Lärarkonton|Säsong");
  await b.bild("efter-admin-desktop-admin");

  await klick(b, '.adm-kortet[data-verktyg="dopom"]');
  await b.tills(`document.querySelectorAll(".adm-klassrad").length === 10`);
  kolla("Döp om klass: ?verktyg=dopom i adressen", await b.js(`location.hash === "#/larare/admin?verktyg=dopom"`));
  await b.js(`(() => { const r = [...document.querySelectorAll(".adm-klassrad")].find((f) => f.querySelector("input").value === "4C"); r.querySelector("input").value = "4C Ugglorna"; r.requestSubmit(); })()`);
  kolla("Döp om 4C → '4C Ugglorna' sparat", await b.tills(`window.__ppStub.las("classes/4c")?.name === "4C Ugglorna"`));

  await klick(b, '.adm-kortet[data-verktyg="tabort"]');
  await b.tills(`document.querySelectorAll(".adm-klassrad").length === 10`);
  await b.js(`[...document.querySelectorAll(".adm-klassrad-wrap")].find((r) => r.querySelector("b").textContent === "Flex").querySelector("button").click()`);
  kolla("Ta bort klass: bekräftelseruta på sidan", await b.tills(`/Ta bort klassen Flex/.test(document.querySelector(".adm-bekrafta:not([hidden]) .et-bekrafta")?.textContent || "")`));
  kolla("… fokus på Avbryt (Enter bekräftar inte av misstag)", await b.js(`document.activeElement?.classList.contains("et-avbryt")`));
  await b.js(`[...document.querySelectorAll(".adm-klassrad-wrap")].find((r) => r.querySelector("b").textContent === "Studion").querySelector("button").click()`);
  await b.js(`[...document.querySelectorAll(".adm-klassrad-wrap")].find((r) => r.querySelector("b").textContent === "Flex").querySelector("button").click()`);
  kolla("… bara EN bekräftelseruta öppen åt gången", (await b.js(`document.querySelectorAll(".adm-bekrafta:not([hidden])").length`)) === 1);
  await b.bild("efter-admin-desktop-ta-bort-klass", false);
  await klick(b, ".adm-bekrafta:not([hidden]) .et-ja");
  kolla("… Ja → Flex borttagen", await b.tills(`/Flex" togs bort/.test(document.querySelector(".adm-besked").textContent) && !window.__ppStub.las("classes/flex")`));
  kolla("… fokus flyttar till grannklassens Ta bort…", await b.js(`document.activeElement?.closest(".adm-klassrad-wrap")?.querySelector("b")?.textContent === "Studion"`));

  await klick(b, '.adm-kortet[data-verktyg="skapa"]');
  await b.tills(`!!document.querySelector(".adm-panel #new-name")`);
  await b.js(`document.querySelector("#new-name").value = "6Z"; document.querySelector(".adm-panel form.new-class").requestSubmit()`);
  kolla("Skapa klass 6Z (0 elever) → Mina klasser → Elever för 6Z med beskedet", await b.tills(`/klass=6z&flik=elever/.test(location.hash) && document.querySelector(".mk-namn")?.textContent === "6Z" && /Klassen "6Z" skapades/.test(document.querySelector(".mk-flash").textContent)`));
  const tomKnappar = `[...document.querySelectorAll(".et-knappar button")].map((k) => k.textContent.trim()).join("|")`;
  kolla("… tom klass: Lägg till elev finns, ingen utskrift", await b.tills(`${tomKnappar} === "Lägg till elev"`), await b.js(tomKnappar));
  kolla("… tom klass: ingen fotnot om ⋯", await b.js(`document.querySelector(".et-fot").hidden && !document.querySelector(".et-fot").offsetParent`));

  // Mobil.
  for (const w of [320, 375]) {
    await b.storlek(w, 780);
    await b.ga("#/larare/mina-klasser?klass=4a&flik=elever");
    await elever(b);
    await b.js(`${radMed("Alva")}.querySelector(".et-meny-knapp").click()`);
    await vanta(300);
    kolla(`admin mobil ${w} px Elever: ingen horisontell scroll (meny öppen)`, await b.js(ingenSidscroll), String(await b.js("document.documentElement.scrollWidth")));
    if (w === 320) await b.bild("efter-admin-mobil-elever-meny", false);
    await b.ga("#/larare/admin?verktyg=tabort");
    await b.tills(`!!document.querySelector(".adm-klassrad")`);
    kolla(`admin mobil ${w} px Admin: ingen horisontell scroll`, await b.js(ingenSidscroll), String(await b.js("document.documentElement.scrollWidth")));
    if (w === 320) await b.bild("efter-admin-mobil-admin");
  }
  await b.storlek(320, 780);
  await b.ga("#/larare/mina-klasser?klass=4a&flik=elever");
  await elever(b);
  await b.bild("efter-admin-mobil-elever");
  if (b.fel.length) console.log("  JS-fel (admin):", b.fel.slice(0, 5));
  kolla("admin: inga JS-fel och inga webbläsardialoger", b.fel.length === 0);
  b.sluta();
}

if (server) server.kill();
const fel = resultat.filter((r) => !r.ok);
console.log(`\n${resultat.length - fel.length}/${resultat.length} kontroller gröna. Skärmdumpar i ${UT}`);
process.exit(fel.length ? 1 : 0);
