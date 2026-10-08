// ============================================================================
// Klasscentrets rum – "City Hall" (#490, epic #475 Klasscentret 2/4).
// ----------------------------------------------------------------------------
// Klick/Enter på Klasscentret i byn (kc-by.js) → import() av denna modul →
// oppnaKcRum(): ett eget lager (.kc-rum-lager) läggs i husvärldens scen och en
// egen liten kamera korszoomar by-lagret ↔ hallen mot byggnaden – samma
// varld-kamera.js och samma anda som hus → rum (och kompis-nivån). "← Till
// byn" (eller Escape) zoomar tillbaka. Gäller både egna byn och en grannby
// – lagret byggs runt det by-lager centret står i. Gäst eller hemma avgörs
// av behörigheten i sessionen, inte av vägen in (spec §7, #501).
//
// Innehållet (data, inredning, Spara/Historik) är en session per öppning –
// kc-rum-session.js; här bor bara skalet: lager, UI-ram, kamera, öppna/stäng.
//
// Medan rummet är öppet står scenen på data-niva="kcrum": husvärldens egen UI
// (.varld-ui) göms och klick i byn ignoreras (de kollar nivån). Ett route-byte
// i husvärlden (pages-varld.js visaNiva) skickar "kc-rum-stang" på scenen →
// rummet stängs HÅRT innan huvudkameran rör by-lagret.
//
// #374: hallen och sakerna ritas UTAN ambient-animation medan kameran rör sig
// – ambienten slås på först när inzoomningen är klar (och av före utzoomning).
// Laddas BARA dynamiskt (#271); deps kan injiceras (preview utan Firestore).
// ============================================================================

import { createKamera } from "../varld-kamera.js";
import { startaKcRumSession } from "./kc-rum-session.js";

const CSS = "src/klasscenter/kc-rum.css";

function laddaCss() {
  const finns = document.querySelector(`link[data-kc-css="${CSS}"]`);
  if (finns) return finns._laddad || Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS;
  link.dataset.kcCss = CSS;
  link._laddad = new Promise((res) => {
    link.onload = res;
    link.onerror = res; // utan CSS hellre fult än inget rum
    setTimeout(res, 3000);
  });
  document.head.appendChild(link);
  return link._laddad;
}

const UI_HTML = `
  <div class="varld-ui-topp">
    <button type="button" class="varld-knapp" data-kc="tillbaka" title="Tillbaka till byn">← <span>Till byn</span></button>
    <div class="varld-titel kc-rum-titel"><span data-kc="titel"></span><small data-kc="matare"></small></div>
    <div class="kc-rum-verktyg" data-kc="verktyg" hidden>
      <button type="button" class="varld-knapp" data-kc-oppna="lada" title="Klassens upplåsta saker">📦 <span>Möbellådan</span></button>
      <button type="button" class="varld-knapp" data-kc-oppna="historik" title="Tidigare sparningar">🕘 <span>Historik</span></button>
      <button type="button" class="varld-knapp kc-spara" data-kc="spara" title="Spara rummet åt hela klassen">💾 <span>Spara</span></button>
    </div>
  </div>
  <div class="kc-rum-status" data-kc="status" role="status" aria-live="polite" hidden></div>
  <div class="varld-panel" data-kc-panel="lada" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3>Möbellådan 📦</h3>
    <p class="hint" data-kc="lada-hint"></p>
    <div class="room-tray" data-kc="lada"></div>
  </div>
  <div class="varld-panel" data-kc-panel="historik" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3>Historik 🕘</h3>
    <p class="hint" data-kc="historik-hint"></p>
    <ul class="kc-historik" data-kc="historik"></ul>
  </div>
  <div class="varld-panel kc-stat-panel" data-kc-panel="statistik" role="dialog" aria-label="Klassens statistik" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3>Klassens statistik 📊</h3>
    <div data-kc="statistik"></div>
  </div>`;

const VYER = new WeakMap(); // .varld-stage → vy

/**
 * Öppna klassens rum ovanpå byn.
 * @param {object} o
 * @param {HTMLElement} o.slot   .by-klasscenter som klickades
 * @param {string} o.classId
 * @param {boolean} [o.visaOnly]  kom via grannbyn (bara rubrikens gissning
 *   innan behörigheten är avgjord – rollen avgör, kc-behorighet.js #501)
 * @param {string} [o.klassNamn]
 * @param {number} [o.niva]       byggnadens nivå (hallens tema)
 * @param {string} [o.nivaNamn]
 * @param {string} [o.matare]     mätarraden ("50 / 200 övningar till Nivå 4")
 * @param {object} [o.deps]       injicerade beroenden (preview), se riktigaDeps
 */
export async function oppnaKcRum(o) {
  const stage = o.slot?.closest(".varld-stage");
  const yttre = o.slot?.closest(".varld-lager");
  if (!stage || !yttre || !o.classId) return;
  let vy = VYER.get(stage);
  if (!vy || !vy.lager.isConnected) {
    vy = byggVy(stage);
    VYER.set(stage, vy);
  }
  await vy.oppna(o, yttre);
}

function byggVy(stage) {
  const lager = document.createElement("div");
  lager.className = "varld-lager room-stage kc-rum-lager varld-dold";
  lager.inert = true;
  const ui = document.createElement("div");
  ui.className = "varld-ui kc-rum-ui";
  ui.innerHTML = UI_HTML;
  const husUi = stage.querySelector(".varld-ui");
  stage.insertBefore(lager, husUi);
  stage.insertBefore(ui, husUi ? husUi.nextSibling : null);
  const q = (k) => ui.querySelector(`[data-kc="${k}"]`);

  const kameror = new Map(); // yttre lager → { kamera, ytter }
  let aktiv = false;
  let rorelse = false;
  let sess = null; // det öppna rummets session (kc-rum-session.js)
  let vakt = null;

  function kameraFor(yttre, fokus, zoom) {
    let k = kameror.get(yttre);
    if (!k) {
      const ytter = { id: "ute", el: yttre, fokus, zoom };
      k = {
        ytter, ny: true,
        kamera: createKamera({ nivaer: [ytter, { id: "kcrum", el: lager, fokus: { x: 50, y: 50 }, zoom: 6 }], startId: "ute" }),
      };
      kameror.set(yttre, k);
    } else {
      k.ny = false;
    }
    k.ytter.fokus = fokus;
    k.ytter.zoom = zoom;
    return k;
  }

  function stangPaneler() {
    for (const p of ui.querySelectorAll("[data-kc-panel]")) p.hidden = true;
    for (const b of ui.querySelectorAll("[data-kc-oppna]")) b.classList.remove("aktiv");
  }

  async function oppna(o, yttre) {
    if (aktiv || rorelse) return;
    aktiv = true;
    rorelse = true;
    await laddaCss();
    // Kamerans fokus = byggnadens mitt (strax under – där porten är) i
    // by-lagrets procent; zoom så att byggnaden ungefär fyller scenen.
    // Mäts EN gång vid klick (lagret står i scale(1)), aldrig i rörelsen.
    const lr = yttre.getBoundingClientRect();
    const sr = o.slot.getBoundingClientRect();
    const fokus = {
      x: ((sr.left + sr.width / 2 - lr.left) / lr.width) * 100,
      y: ((sr.top + sr.height * 0.7 - lr.top) / lr.height) * 100,
    };
    const zoom = Math.min(8, Math.max(2, 0.9 * Math.min(lr.width / sr.width, lr.height / sr.height)));
    const k = kameraFor(yttre, fokus, zoom);

    // Rubrik/mätare/behörighet sköts av sessionen (#501).
    sess = startaKcRumSession(o, { lager, q, oppnaPanel, stangHart: () => stang({ hart: true }) });
    sess.forraNiva = stage.dataset.niva;
    sess.kamera = k.kamera;
    sess.slot = o.slot;
    stage.dataset.niva = "kcrum";
    // Sidan lämnad (husvärlden ersatt) → släpp prenumerationerna.
    clearInterval(vakt);
    vakt = setInterval(() => { if (!stage.isConnected) stang({ hart: true }); }, 5000);

    const gaIn = () => k.kamera.gaTill("kcrum").then(() => {
      rorelse = false;
      if (sess) sess.slapAmbient(true);
    });
    // Nyskapad kamera bär varld-utan-anim tills nästa frame (som kompis-vyn).
    if (k.ny) requestAnimationFrame(() => requestAnimationFrame(gaIn));
    else gaIn();
    q("tillbaka").focus({ preventScroll: true });
  }

  /** Stäng rummet. hart = route-byte: direkt, ingen fråga, ingen animation. */
  function stang({ hart = false } = {}) {
    if (!aktiv || !sess) return;
    if (!hart && rorelse) return;
    if (!hart && sess.t.osparat &&
      !confirm("Du har ändringar i rummet som inte är sparade. Gå tillbaka till byn ändå?")) return;
    const s = sess;
    sess = null;
    aktiv = false;
    clearInterval(vakt);
    s.stad();
    stangPaneler();
    stage.dataset.niva = s.forraNiva || "by";
    const rensa = () => {
      if (!aktiv) lager.replaceChildren();
    };
    if (hart) {
      s.kamera.hoppaTill("ute");
      rorelse = false;
      rensa();
    } else {
      s.slapAmbient(false);
      rorelse = true;
      s.kamera.gaTill("ute").then(() => {
        rorelse = false;
        rensa();
      });
      s.slot.focus?.({ preventScroll: true });
    }
  }

  /** Öppna en panel (knapparna, eller statistiktavlan i scenen #498). */
  function oppnaPanel(namn) {
    const panel = ui.querySelector(`[data-kc-panel="${namn}"]`);
    if (!panel || !sess) return;
    stangPaneler();
    panel.hidden = false;
    ui.querySelector(`[data-kc-oppna="${namn}"]`)?.classList.add("aktiv");
    sess.panelOppnad(namn);
  }

  // Skalets knappar: Till byn, panelerna (öppna/stäng) och Escape. Sessionen
  // äger Spara/Visa deras/Återställ (kc-rum-session.js).
  ui.addEventListener("click", (e) => {
    if (!sess) return;
    if (e.target.closest('[data-kc="tillbaka"]')) return stang();
    if (e.target.closest(".varld-panel-stang")) return stangPaneler();
    const oppnaBtn = e.target.closest("[data-kc-oppna]");
    if (!oppnaBtn) return;
    const namn = oppnaBtn.dataset.kcOppna;
    if (!ui.querySelector(`[data-kc-panel="${namn}"]`).hidden) return stangPaneler();
    oppnaPanel(namn);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !sess || !lager.isConnected) return;
    if ([...ui.querySelectorAll("[data-kc-panel]")].some((p) => !p.hidden)) stangPaneler();
    else stang();
  });
  // Route-byte i husvärlden (pages-varld.js visaNiva) → stäng HÅRT först.
  stage.addEventListener("kc-rum-stang", () => stang({ hart: true }));

  return { lager, oppna, stang };
}
