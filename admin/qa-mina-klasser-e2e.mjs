// ============================================================================
// QA (#804): Mina klasser i en riktig webbläsare mot emulator-förhandsvisningen
// (admin/qa-mina-klasser-preview.sh). Inga beroenden: Node 22 (global
// WebSocket) + `chromium` i PATH.
//
//   APP_PORT=… FS_PORT=… AUTH_PORT=… bash admin/qa-mina-klasser-preview.sh &
//   node admin/qa-mina-klasser-e2e.mjs http://127.0.0.1:<APP_PORT> [utmapp] [--bara-bilder]
// eller utan emulator, mot stub-förhandsvisningen (preview/preview-mina-klasser.html):
//   PORT=<p> node server.mjs &   node admin/qa-mina-klasser-e2e.mjs http://127.0.0.1:<p> [utmapp] --stub
//
// Kontrollerar (spec TESTER, del B): vald klass + statistikens underflik kommer
// ihåg efter sidbyte och omladdning; avstängda moduler nedtonade med länk till
// Vad eleverna ser; hela områdesnamn; Sparat ✓ per steg; årskurslärare ser inga
// admin-kontroller; admin: sökbar rullgardin (10 klasser) och gamla länkar;
// mobil 320/375 px utan horisontell scroll. Skärmdumpar till utmappen.
// Avslutar med kod 1 om någon kontroll fallerar.
// ============================================================================
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const BASE = (process.argv[2] || "http://127.0.0.1:8804").replace(/\/$/, "");
const UT = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "/tmp/qa-mina-klasser";
const BARA_BILDER = process.argv.includes("--bara-bilder");
const STUB = process.argv.includes("--stub");
mkdirSync(UT, { recursive: true });
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const resultat = [];
const kolla = (namn, ok, info = "") => {
  resultat.push({ namn, ok: !!ok });
  console.log(`${ok ? "✓" : "✗"} ${namn}${ok ? "" : `  ${info}`}`);
};

async function webblasare(namn) {
  const dbg = 9400 + Math.floor(Math.random() * 500);
  const dir = `/tmp/qa-mina-klasser-${namn}-${dbg}`;
  const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${dbg}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) {
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
      // Känt och orelaterat (pages-varld.js, #697): new URL(e.oldURL) när headless-sidan byter hash via CDP – filen är orörd av #804.
      if (!/pages-varld\.js:\d+:\d+/.test(t)) fel.push(t);
    }
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
  const bild = async (filnamn) => {
    const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`${UT}/${filnamn}.png`, Buffer.from(data, "base64"));
  };
  const ga = async (hash) => { await js(`location.hash = ${JSON.stringify(hash)}`); await vanta(300); };
  const sluta = () => { ws.close(); chrome.kill(); setTimeout(() => { try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch {} }, 1500); };
  return { cdp, js, tills, storlek, bild, ga, sluta, fel };
}

async function loggaIn(b, anvandare) {
  await b.storlek(1366, 900);
  if (STUB) {
    const roll = anvandare === "qaarskurs4" ? "arskurs" : "admin";
    await b.cdp("Page.navigate", { url: `${BASE}/preview/preview-mina-klasser.html?roll=${roll}#/larare/hem` });
    return b.tills(`!!document.querySelector(".teacher-nav")`, 20000);
  }
  await b.cdp("Page.navigate", { url: `${BASE}/#/larare` });
  await b.tills(`!!document.querySelector("#username")`, 20000);
  await b.js(`(() => { const f = (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
    f("#username", ${JSON.stringify(anvandare)}); f("#p", "lilla123"); document.querySelector("#form").requestSubmit(); })()`);
  return b.tills(`!!document.querySelector(".teacher-nav")`, 20000);
}

const ladda = (b) => b.tills(`!!document.querySelector(".mk-innehall") && !document.querySelector(".mk-innehall .spinner") && !document.querySelector(".stats-pane:not([hidden]) .spinner")`, 15000);
const ingenSidscroll = `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
const klick = (b, sel) => b.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); return !!e; })()`);

// ---------------------------------------------------------------- Årskurslärare
{
  const b = await webblasare("arskurs");
  kolla("årskurs: inloggning", await loggaIn(b, "qaarskurs4"));
  await b.ga("#/larare/mina-klasser");
  await ladda(b);
  if (!BARA_BILDER) {
    kolla("årskurs: toppmenyn utan Admin", await b.js(`![...document.querySelectorAll(".teacher-nav-tabs .tnav")].some((a) => /Admin/.test(a.textContent))`));
    kolla("årskurs: klassknappar 4A + 4B", (await b.js(`[...document.querySelectorAll(".mk-klassknapp-namn")].map((k) => k.textContent.trim()).join(",")`)) === "4A,4B");
    kolla("årskurs: fyra flikar med undertext", (await b.js(`[...document.querySelectorAll(".mk-flik")].map((f) => [...f.children].map((c) => c.textContent.trim()).join(" ")).join("|")`)) ===
      "Hur går det? Statistik|Vad eleverna ser Områden och moduler|Fokusläge Lås till en sak|Elever Inloggning och konton");
  }
  await klick(b, '.mk-klassknapp[data-klass="4b"]');
  await ladda(b);
  await b.tills(`!!document.querySelector(".stats-tab")`);
  if (!BARA_BILDER) {
    kolla("4B vald → adressen har klass=4b&flik=hur", await b.js(`/klass=4b&flik=hur/.test(location.hash)`));
    const av = await b.js(`Object.fromEntries([...document.querySelectorAll(".stats-tab")].map((t) => [t.dataset.tab, t.classList.contains("av") && /· av/.test(t.textContent)]))`);
    kolla("avstängda moduler nedtonade '· av' (4B: Bråkresan dold, Ekvationsresan av; Schack på)",
      av.brakresan && av.ekvationsresan && !av.schack && !av.lasresan && !av.amnen, JSON.stringify(av));
    await klick(b, '.stats-tab[data-tab="ekvationsresan"]');
    await b.tills(`!!document.querySelector('[data-pane="ekvationsresan"] .stats-av-notis')`);
    const text = await b.js(`document.querySelector('[data-pane="ekvationsresan"] .stats-av-notis')?.textContent.replace(/\\s+/g, " ").trim()`);
    kolla("klick på avstängd: texten med länk", text === "Ekvationsresan är avstängd för 4B. Eleverna ser den inte. Slå på den under Vad eleverna ser.", text);
    await b.tills(`!document.querySelector('[data-pane="ekvationsresan"] .spinner')`);
    await b.bild("efter-arskurs-desktop-hur-gar-det-av");
    await klick(b, '[data-pane="ekvationsresan"] .stats-av-lank');
    await ladda(b);
    kolla("länken öppnar Vad eleverna ser", await b.js(`document.querySelector(".mk-flik.active")?.dataset.flik === "ser" && /flik=ser/.test(location.hash)`));

    // Kommer ihåg: underfliken Läsresan → sidbyte → Mina klasser i toppmenyn → omladdning.
    await klick(b, '.mk-flik[data-flik="hur"]');
    await ladda(b);
    await klick(b, '.stats-tab[data-tab="lasresan"]');
    await vanta(800);
    await b.ga("#/larare/innehall");
    await b.tills(`!document.querySelector(".mk-page")`);
    await vanta(800);
    await klick(b, '.teacher-nav-tabs .tnav[data-hash="#/larare/mina-klasser"]');
    await ladda(b);
    const minns = () => b.js(`({ klass: document.querySelector('.mk-klassknapp[aria-pressed="true"]')?.dataset.klass,
      flik: document.querySelector(".mk-flik.active")?.dataset.flik, del: document.querySelector(".stats-tab.active")?.dataset.tab, hash: location.hash })`);
    let m = await minns();
    kolla("sidbyte: samma klass och underflik", m.klass === "4b" && m.flik === "hur" && m.del === "lasresan", JSON.stringify(m));
    await b.cdp("Page.reload");
    await ladda(b);
    await b.tills(`!!document.querySelector(".stats-tab.active")`);
    m = await minns();
    kolla("omladdning: samma klass och underflik", m.klass === "4b" && m.del === "lasresan" && /del=lasresan/.test(m.hash), JSON.stringify(m));
  }

  // Vad eleverna ser – hela namn, tre steg, Sparat ✓.
  await klick(b, '.mk-flik[data-flik="ser"]');
  await ladda(b);
  await b.tills(`!!document.querySelector('[data-steg="omraden"] .member-name')`);
  if (!BARA_BILDER) {
    kolla("tre numrerade steg, steg 3 ihopfällt", await b.js(`[...document.querySelectorAll(".mk-steg-nr")].map((n) => n.textContent).join("") === "123" && !document.querySelector('[data-steg="lagen"]').open`));
    const kapade = await b.js(`[...document.querySelectorAll('[data-steg="omraden"] .member-name')].filter((n) => n.scrollWidth > n.clientWidth + 1 || getComputedStyle(n).textOverflow === "ellipsis").map((n) => n.textContent)`);
    kolla("hela områdesnamn (inga kapade)", kapade.length === 0, JSON.stringify(kapade));
    kolla("långt namn syns helt", await b.js(`[...document.querySelectorAll('[data-steg="omraden"] .member-name')].some((n) => n.textContent === "Svensk historia under stormaktstiden")`));
    await b.js(`document.querySelector('[data-steg="omraden"] input[type=checkbox]').click()`);
    kolla("ändring → 'Inte sparat än'", await b.tills(`document.querySelector('[data-steg="omraden"] .mk-sparat')?.textContent === "Inte sparat än"`, 3000));
    await klick(b, '[data-steg="omraden"] [data-act="save-areas"]');
    kolla("Spara → 'Sparat ✓' i steg 1", await b.tills(`document.querySelector('[data-steg="omraden"] .mk-sparat')?.textContent === "Sparat ✓"`));
    await b.js(`document.querySelector('[data-steg="lagen"] summary').click()`);
    kolla("steg 3 ritas när det fälls ut", await b.tills(`!!document.querySelector('[data-steg="lagen"] .mk-steg-body').children.length`));
  }
  await b.bild("efter-arskurs-desktop-vad-eleverna-ser");

  // Elever: inga admin-kontroller.
  await klick(b, '.mk-flik[data-flik="elever"]');
  await ladda(b);
  await b.tills(`!!document.querySelector(".et-tabell")`);
  if (!BARA_BILDER) {
    // #805: kompakt elevtabell – adminvalen (mynt, ⋯-adminval, Lägg till elev) ritas inte alls.
    const admin = await b.js(`(() => { const t = document.querySelector(".mk-page").innerText;
      return { knappar: document.querySelectorAll(".mk-page .give-coins, .mk-page .et-mynt, .mk-page .et-knappar [data-klass], .mk-page .et-menyval:not([data-val=losen]), .mk-page .mm-add, .mk-page .cls-new").length,
        text: /Ta bort konto|Ge mynt|Skapa en ny klass|Ta bort klassen|Ta ur klassen/.test(t) }; })()`);
    kolla("årskurs ser inga admin-kontroller (Elever)", admin.knappar === 0 && !admin.text, JSON.stringify(admin));
  }
  await b.bild("efter-arskurs-desktop-elever");

  // Mobil.
  for (const w of [320, 375]) {
    await b.storlek(w, 780);
    for (const f of ["hur", "ser", "fokus", "elever"]) {
      await klick(b, `.mk-flik[data-flik="${f}"]`);
      await ladda(b);
      await vanta(400);
      if (!BARA_BILDER) kolla(`mobil ${w} px, ${f}: ingen horisontell scroll`, await b.js(ingenSidscroll), String(await b.js("document.documentElement.scrollWidth")));
      if (w === 375 && (f === "hur" || f === "ser")) await b.bild(`efter-arskurs-mobil-${f}`);
    }
    if (BARA_BILDER) continue;
    // Varje underflik i Hur går det? (tabellerna scrollar i sin egen ruta, aldrig sidan).
    await klick(b, '.mk-flik[data-flik="hur"]');
    await ladda(b);
    for (const del of await b.js(`[...document.querySelectorAll(".stats-tab")].map((t) => t.dataset.tab)`)) {
      await klick(b, `.stats-tab[data-tab="${del}"]`);
      await ladda(b);
      await vanta(500);
      kolla(`mobil ${w} px, Hur går det? → ${del}: ingen horisontell scroll`, await b.js(ingenSidscroll), String(await b.js("document.documentElement.scrollWidth")));
    }
  }
  if (b.fel.length) console.log("  JS-fel (årskurs):", b.fel.slice(0, 5));
  if (!BARA_BILDER) kolla("årskurs: inga JS-fel", b.fel.length === 0);
  b.sluta();
}

// ---------------------------------------------------------------- Admin
{
  const b = await webblasare("admin");
  kolla("admin: inloggning", await loggaIn(b, "qaadmin"));
  await b.ga("#/larare/mina-klasser");
  await ladda(b);
  if (!BARA_BILDER) {
    kolla("admin: 10 klasser → sök + rullgardin", await b.js(`!!document.querySelector(".mk-klass-select") && !document.querySelector(".mk-klassknapp") && document.querySelectorAll(".mk-klass-select option").length === 10`));
    await b.js(`(() => { const i = document.querySelector(".mk-sok-falt"); i.value = "stud"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    kolla("sökningen filtrerar rullgardinen", await b.js(`[...document.querySelectorAll(".mk-klass-select option:not([disabled])")].map((o) => o.value).join() === "studion"`));
    await b.js(`document.querySelector(".mk-sok-falt").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))`);
    await ladda(b);
    kolla("Enter väljer träffen", await b.js(`/klass=studion/.test(location.hash) && document.querySelector(".mk-namn").textContent === "Studion"`));
    await b.ga("#/larare/klasser?klass=4b&sektion=fokus");
    await ladda(b);
    kolla("gammal länk ?sektion=fokus → Mina klasser → Fokusläge för 4B", await b.js(`location.hash.startsWith("#/larare/mina-klasser") && document.querySelector(".mk-flik.active")?.dataset.flik === "fokus" && document.querySelector(".mk-namn").textContent === "4B"`));
    await b.ga("#/larare/statistik?klass=4a");
    await ladda(b);
    kolla("gammal länk Statistik → Hur går det? för 4A", await b.js(`document.querySelector(".mk-flik.active")?.dataset.flik === "hur" && document.querySelector(".mk-namn").textContent === "4A"`));
  }
  await b.ga("#/larare/mina-klasser?klass=4a&flik=hur&del=amnen");
  await ladda(b);
  await b.tills(`!!document.querySelector(".class-tbl, .empty-state")`);
  await b.bild("efter-admin-desktop-hur-gar-det");
  await b.ga("#/larare/mina-klasser?klass=4a&flik=elever");
  await ladda(b);
  await b.tills(`!!document.querySelector(".et-tabell")`);
  await vanta(800);
  if (!BARA_BILDER) {
    kolla("admin: Elever har elevkonton (mynt m.m.) och Klasscentret", await b.js(`!!document.querySelector(".mk-page .et-mynt") && /Klasscentret/.test(document.querySelector(".mk-innehall").innerText)`));
    // Allt från Inloggning finns kvar för admin: inloggningskort + Byt lösenord (användarnamn + lösenord) per elev (#805: i ⋯).
    const inl = await b.js(`({ rader: document.querySelectorAll(".mk-page .et-elev").length,
      login: document.querySelectorAll('.mk-page .et-elev [data-val="losen"]').length, utskrift: !!document.querySelector(".mk-page .et-skriv-ut") })`);
    kolla("admin: Elever har Inloggningens funktioner (Skriv ut inloggningskort, Redigera inloggning per elev)",
      inl.rader > 0 && inl.login === inl.rader && inl.utskrift, JSON.stringify(inl));
    await klick(b, ".mk-page .et-elev .et-meny-knapp");
    await klick(b, '.mk-page .et-elev [data-val="losen"]');
    kolla("admin: Redigera inloggning öppnar användarnamn + nytt lösenord", await b.tills(`!!document.querySelector(".le-modal .le-user") && !!document.querySelector(".le-modal .le-pass-row")`));
    await b.js(`document.querySelector(".le-modal .cx-modal-close")?.click()`);
    await klick(b, ".mk-page .et-skriv-ut");
    kolla("admin: Skriv ut inloggningskort öppnar utskriftsvalet", await b.tills(`document.querySelectorAll(".lp-modal .lp-row").length > 0`));
    await b.js(`document.querySelector(".lp-modal .cx-modal-close")?.click()`);
  }
  await b.bild("efter-admin-desktop-elever");
  await b.storlek(375, 780);
  await b.ga("#/larare/mina-klasser?klass=4b&flik=ser");
  await ladda(b);
  await vanta(800);
  if (!BARA_BILDER) kolla("admin mobil 375 px (ser): ingen horisontell scroll", await b.js(ingenSidscroll));
  await b.bild("efter-admin-mobil-vad-eleverna-ser");
  if (!BARA_BILDER) {
    // F1: steg 2 har två sparegrupper (moduler + byar) – att spara byarna gör inte modulerna sparade.
    await b.tills(`!!document.querySelector('[data-steg="synlighet"] [data-act="save-villages"]') && !!document.querySelector('[data-steg="synlighet"] input[data-module]')`);
    await b.js(`document.querySelector('[data-steg="synlighet"] input[data-module="lasresan"]').click()`);
    await klick(b, '[data-steg="synlighet"] [data-act="save-villages"]');
    await b.tills(`!!document.querySelector('[data-steg="synlighet"] .villages-result .ok-inline')`);
    await vanta(400);
    const st = () => b.js(`document.querySelector('[data-steg="synlighet"] .mk-sparat').textContent`);
    const efterByar = await st();
    kolla("steg 2: spara byar med osparad modul → 'Inte sparat än'", efterByar === "Inte sparat än", efterByar);
    await klick(b, '[data-steg="synlighet"] [data-act="save-modules"]');
    kolla("steg 2: spara moduler också → 'Sparat ✓'", await b.tills(`document.querySelector('[data-steg="synlighet"] .mk-sparat').textContent === "Sparat ✓"`), await st());
  }
  await b.ga("#/larare/mina-klasser?klass=4b&flik=hur&del=schack");
  await ladda(b);
  await vanta(1200);
  if (!BARA_BILDER) kolla("admin mobil 375 px (Schack): ingen horisontell scroll", await b.js(ingenSidscroll));
  await b.bild("efter-admin-mobil-hur-gar-det-schack");
  if (b.fel.length) console.log("  JS-fel (admin):", b.fel.slice(0, 5));
  if (!BARA_BILDER) kolla("admin: inga JS-fel", b.fel.length === 0);
  b.sluta();
}

const fel = resultat.filter((r) => !r.ok);
console.log(`\n${resultat.length - fel.length}/${resultat.length} kontroller gröna. Skärmdumpar i ${UT}`);
process.exit(fel.length ? 1 : 0);
