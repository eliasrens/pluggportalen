// ============================================================================
// Pluggporten – lärarsidan: synliga moduler per klass (teacher-class-modules.js)
// ----------------------------------------------------------------------------
// Issue #412: läraren kryssar vilka TOP-NIVÅ-moduler (sidomenyns sektioner, t.ex.
// Plugga och Läsresan) klassens elever ser. Speglar byar-kontrollen
// (teacher-class-villages.js): ikryssat = synligt, urbockat sparas i
// classes/{id}.hiddenModules via data.setClassHiddenModules. Tomt = allt synligt
// (bakåtkompatibelt). Listan byggs ur registret TOGGLABLE_MODULES; elevens
// sidomeny (ui.renderTopbar) och routern (app.js) respekterar valet.
// Opt-in-moduler (#605, Hitta rätt!) är AV som standard: ikryssat sparas i
// stället i classes/{id}.enabledModules (samma knapp, samma skrivning).
// Matchdagen (#876) står här för HELA klassen; enskilda elever sätts under
// Elever → Anpassningar per elev. Klassens frågor (#878) väljs direkt här under
// listan: samma panel som raden "Hela klassen" där (md-anpassningar-panel.js, lat).
//
// Laddas DYNAMISKT från teacher-classes.js (vid klick på "Synliga moduler") så att
// filen aldrig hamnar i den statiska bootgrafen (incident #271).
// ============================================================================

import * as data from "./data.js";
import { MATCHDAGEN_IKON, TOGGLABLE_MODULES, normalizeHiddenModules, normalizeEnabledModules } from "./gamemode-visibility.js";
import { el, esc, icon } from "./teacher-shared.js";
import { schackLararIkon } from "./teacher-schack-ikon.js";

// Lärarsidans SVG-ikon per modul (samma ikonuppsättning som resten av lärarsidan).
const LARAR_IKON = { plugga: "grad", lasresan: "book", shop: "sparkle", hittaratt: "pin", ekvationsresan: "sliders", brakresan: "brak" };

/**
 * Rendera "Synliga moduler"-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenModules vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 * @param {{loadLibrary?:Function}} [opts]  biblioteket för Matchdagens frågeval (#878)
 */
export function renderClassModules(ctx, cls, host, opts = {}) {
  const hidden = new Set(normalizeHiddenModules(cls.hiddenModules));
  const enabled = new Set(normalizeEnabledModules(cls.enabledModules));
  const synlig = (m) => (m.optIn ? enabled.has(m.id) && !hidden.has(m.id) : !hidden.has(m.id));
  const md = TOGGLABLE_MODULES.some((m) => m.id === "matchdagen");
  const rows = TOGGLABLE_MODULES.map(
    (m) => `<label class="member-row">
        <input type="checkbox" data-module="${esc(m.id)}"${m.optIn ? ' data-opt-in="1"' : ""}${synlig(m) ? " checked" : ""} />
        <span class="member-avatar">${m.id === "schack" ? schackLararIkon(20) : m.id === "matchdagen" ? MATCHDAGEN_IKON : icon(LARAR_IKON[m.id] || "eye", 20)}</span>
        <span class="member-name">${esc(m.label)}${m.optIn ? ' <span class="hint">(av som standard)</span>' : ""}</span>
      </label>`
  ).join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de delar av sidan som <b>${esc(cls.name || cls.id)}</b> ska
      <b>se</b> i elevernas meny. Urbockade delar döljs för klassen och går inte att öppna,
      inte ens via en direktlänk. Hem syns alltid. Delar märkta <i>av som standard</i> syns
      först när du kryssar i dem.</p>
    <div class="member-grid">${rows}</div>
    ${md ? `<div class="mda cls-md-klass">
      <button type="button" class="btn ghost small" data-act="md-klass" aria-expanded="false" aria-controls="cls-md-klass-${esc(cls.id)}">
        <span class="mda-boll" aria-hidden="true">${MATCHDAGEN_IKON}</span><span>Matchdagen: välj frågor för hela klassen</span></button>
      <div class="mda-panel" id="cls-md-klass-${esc(cls.id)}" hidden></div>
    </div>` : ""}
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-modules">${icon("save", 16)}<span>Spara moduler</span></button>
      <button class="btn ghost small" data-act="all-modules">Visa alla</button>
      <span class="modules-result"></span>
    </div>
  </div>`);

  const resultEl = box.querySelector(".modules-result");
  const mdPanel = md ? kopplaMatchdagen(ctx, cls, box, opts) : null;

  box.querySelector('[data-act="all-modules"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-modules"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Urbockade = dolda. (Checked = synligt.) Opt-in: ikryssade = aktiverade.
    const picked = [...box.querySelectorAll('input[type="checkbox"]:not([data-opt-in]):not(:checked)')].map(
      (c) => c.dataset.module
    );
    const pa = [...box.querySelectorAll('input[data-opt-in]:checked')].map((c) => c.dataset.module);
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenModules(cls.id, picked, pa);
      cls.hiddenModules = saved;
      cls.enabledModules = normalizeEnabledModules(pa);
      mdPanel?.rita(); // en öppen frågepanel visar klassens på/av
      const av = TOGGLABLE_MODULES.filter((m) => m.optIn && !pa.includes(m.id)).map((m) => m.id);
      const namn = TOGGLABLE_MODULES.filter((m) => saved.includes(m.id) || av.includes(m.id)).map((m) => m.label);
      resultEl.innerHTML = namn.length
        ? `<span class="ok-inline">✓ Sparat – dolt för klassen: ${esc(namn.join(", "))}</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla moduler</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  host.replaceChildren(box);
}

/**
 * Matchdagens frågor för hela klassen (#878): knappen under modullistan fäller ut
 * samma panel som "Hela klassen" i Anpassningar per elev (classes/{id}.matchdagenInst +
 * enabledModules, md-inst-data.js sparaKlass). Panelens på/av speglas i kryssrutan ovan.
 * @returns {{rita:Function}} rita om panelen om den är öppen
 */
function kopplaMatchdagen(ctx, cls, box, { loadLibrary }) {
  const knapp = box.querySelector('[data-act="md-klass"]');
  const panel = box.querySelector(".cls-md-klass .mda-panel");
  let avbryt = null;
  const rita = async () => {
    if (panel.hidden) return;
    if (avbryt) avbryt.aborted = true;
    const mitt = (avbryt = { aborted: false });
    try {
      const { renderPanel } = await import("./matchdagen/larare/md-anpassningar-panel.js");
      await renderPanel(ctx, {
        cls, elev: null, host: panel, avbryt: mitt, loadLibrary: loadLibrary || (() => Promise.resolve([])),
        onSaved: () => {
          const kryss = box.querySelector('input[data-module="matchdagen"]');
          if (kryss) kryss.checked = normalizeEnabledModules(cls.enabledModules).includes("matchdagen");
        },
      });
    } catch (err) {
      if (!mitt.aborted) panel.replaceChildren(el(`<p class="err-inline">Kunde inte ladda Matchdagens inställningar: ${esc(err?.message || String(err))}</p>`));
    }
  };
  knapp.addEventListener("click", () => {
    const oppna = panel.hidden;
    panel.hidden = !oppna;
    knapp.setAttribute("aria-expanded", String(oppna));
    if (oppna) rita();
    else {
      if (avbryt) avbryt.aborted = true;
      panel.replaceChildren();
    }
  });
  return { rita };
}
