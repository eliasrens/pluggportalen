// ============================================================================
// Schack-QA (#777): en elev i riktiga appen via CDP – logga in, starta parti,
// trycka/dra/tangenter på brädet och läsa av det. Bara DOM + localStorage,
// inga interna API:er, så det som testas är det eleven ser och gör.
//
//   const e = skapaElev(p, origin);  await e.loggaIn("4a02");  await e.startaParti("tornet", "b");
// ============================================================================

const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, Escape: 27, Tab: 9 };

export function skapaElev(p, ORIGIN) {
  let nyckel = null;
  let finger = false; // true: tryck och klick som touch (med Emulation.setTouchEmulationEnabled)
  const j = JSON.stringify;
  const rutaSel = (r) => `.schack-bradet [data-ruta="${r}"]`;

  async function klickXY(x, y) {
    if (finger) {
      await p.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await p.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      return;
    }
    await p.s("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await p.s("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await p.s("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  }
  async function mitt(sel) {
    const r = await p.ev(`(() => { const e = document.querySelector(${j(sel)}); if (!e) return null; e.scrollIntoView({ block: "nearest" });
      const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
    if (!r) throw new Error("saknas: " + sel);
    return r;
  }
  const klick = async (sel) => klickXY(...(await mitt(sel)));
  const tryck = (r) => klick(rutaSel(r));

  async function dra(fran, till, { touch = false } = {}) {
    const [x0, y0] = await mitt(rutaSel(fran));
    const [x1, y1] = await mitt(rutaSel(till));
    const steg = 8;
    const punkt = (i) => ({ x: x0 + ((x1 - x0) * i) / steg, y: y0 + ((y1 - y0) * i) / steg });
    if (touch) {
      await p.s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= steg; i++) await p.s("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [punkt(i)] });
      await p.s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await p.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
      await p.s("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", buttons: 1, clickCount: 1 });
      for (let i = 1; i <= steg; i++) await p.s("Input.dispatchMouseEvent", { type: "mouseMoved", ...punkt(i), button: "left", buttons: 1 });
      await p.s("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", buttons: 0, clickCount: 1 });
    }
  }
  async function tangent(key) {
    const kc = KEY[key];
    await p.s("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: kc });
    if (key === "Enter") await p.s("Input.dispatchKeyEvent", { type: "char", text: "\r", key, code: key, windowsVirtualKeyCode: kc });
    await p.s("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: kc });
  }

  /** Det sparade partiet i localStorage (+ nyckeln). */
  const parti = () => p.ev(`(() => { const k = Object.keys(localStorage).find(k => /^pp:schack:dator:[^:]+$/.test(k));
    return k ? { nyckel: k, ...JSON.parse(localStorage.getItem(k)) } : null; })()`);
  const status = () => p.ev(`document.querySelector(".schack-status-text")?.textContent || ""`);
  const lage = () => p.ev(`(() => { const q = (s) => [...document.querySelectorAll(".schack-bradet " + s)].map(e => e.dataset.ruta);
    return { vald: q(".vald"), mal: q(".mal"), malTar: q(".mal-tar"), senast: q(".senast"), schack: q(".i-schack"), kan: q(".kan-valjas"),
      vantar: q(".vantar"), interaktiv: !!document.querySelector(".schack-bradet.interaktiv") }; })()`);
  const etikett = (r) => p.ev(`document.querySelector(${j(rutaSel(r))}).getAttribute("aria-label")`);
  const synlig = (sel) => p.ev(`(() => { const e = document.querySelector(${j(sel)}); return !!e && !e.hidden && e.getClientRects().length > 0; })()`);
  /** Rutan nere till vänster som eleven ser den (a1 för vit, h8 för svart). */
  const hornRuta = () => p.ev(`(() => { let b = null; for (const e of document.querySelectorAll(".schack-bradet [data-ruta]")) {
    const r = e.getBoundingClientRect(); if (!b || r.bottom > b.r.bottom + 1 || (Math.abs(r.bottom - b.r.bottom) < 1 && r.left < b.r.left)) b = { r, ruta: e.dataset.ruta }; }
    return b.ruta; })()`);
  const bradeKlart = () => p.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 20000);

  async function loggaIn(anv) {
    await p.gaTill(`${ORIGIN}/#/`);
    await p.vanta(`!!document.querySelector("form input[type=password]")`, 20000);
    await p.ev(`(() => { const f = [...document.querySelectorAll("form input")]; const set = (e, v) => { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
      set(f[0], ${j(anv)}); set(f.find(e => e.type === "password"), "lilla123");
      [...document.querySelectorAll("button")].find(b => /Logga in/.test(b.textContent)).click(); })()`);
    await p.vanta(`location.hash.startsWith("#/elev/")`, 20000);
    if (await p.ev(`location.hash.startsWith("#/elev/avatar")`)) {
      await p.ev(`[...document.querySelectorAll("button")].find(b => /Kör igång/.test(b.textContent)).click()`);
      await p.vanta(`!location.hash.startsWith("#/elev/avatar")`, 20000);
    }
    // Husvärlden ritar klart asynkront och kan skriva över en route som öppnats
    // under tiden (finns även på main, se rapporten F1) – låt den bli klar först.
    await vila(5000);
  }

  async function startaParti(niva, farg) {
    await p.ev(`location.hash = "#/elev/schack?vy=dator&ny=1"`);
    await p.vanta(`!!document.querySelector(".schack-niva") && !!document.querySelector('[data-act="starta"]')`);
    await vila(200);
    await klick(`.schack-niva[data-niva="${niva}"]`);
    await klick(`.schack-farg[data-farg="${farg}"]`);
    await klick(`[data-act="starta"]`);
    await bradeKlart();
    await vila(200);
    nyckel = (await parti()).nyckel;
  }

  /** Öppna `hash` med en riktig sidladdning (Page.navigate till samma sida + ny hash laddar inte om). */
  async function oppna(hash) {
    await p.ev(`history.replaceState(null, "", ${j(hash)})`);
    await p.laddaOm();
  }

  /** Lägg ett parti (SAN-drag) i elevens localStorage och öppna det med en riktig sidladdning. */
  async function injicera(drag, { niva = "bonden", egenFarg = "w", varna, slut = null } = {}) {
    if (!nyckel) throw new Error("starta ett parti först (nyckeln behövs)");
    const pt = { v: 1, niva, egenFarg, drag, varna: varna ?? (niva === "bonden" || niva === "springaren"), seed: 12345,
      skapad: Date.now(), uppdaterad: Date.now(), slut };
    await p.ev(`localStorage.setItem(${j(nyckel)}, ${j(j(pt))})`);
    await oppna("#/elev/schack?vy=dator");
    await bradeKlart();
    await vila(300);
  }

  /** Vänta tills partiet har `n` drag (datorn har svarat). Returnerar ms sedan t0. */
  async function vantaDrag(n, t0 = Date.now(), ms = 15000) {
    while (Date.now() - t0 < ms) {
      const pp = await parti();
      if (pp && pp.drag.length >= n) return Date.now() - t0;
      await vila(20);
    }
    throw new Error(`datorn svarade inte (väntade på ${n} drag)`);
  }

  /** Ett elevdrag med tryck–tryck: en slumpad pjäs med drag (helst ett slag). Svarar på väljare/varning. */
  async function elevDrag({ helstSlag = true } = {}) {
    const l = await lage();
    for (const fran of l.kan.sort(() => Math.random() - 0.5)) {
      await tryck(fran);
      const m = await lage();
      const mal = [...m.malTar, ...m.mal];
      if (!mal.length) continue;
      const till = helstSlag && m.malTar.length ? m.malTar[0] : mal[Math.floor(Math.random() * mal.length)];
      await tryck(till);
      if (await synlig(".schack-forvandling")) await klick(`.schack-forvandling .forvald`);
      if (await synlig(".schack-varna-ruta")) await klick(`[data-act="varna-anda"]`);
      return { fran, till };
    }
    throw new Error("inget elevdrag hittades");
  }

  return { klick, klickXY, tryck, dra, tangent, parti, status, lage, etikett, synlig, hornRuta, loggaIn, startaParti, injicera, vantaDrag, elevDrag, bradeKlart, oppna, anvandFinger: (ja) => { finger = ja; } };
}
