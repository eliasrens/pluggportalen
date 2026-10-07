// ============================================================================
// Pluggporten – lärarsidan: klassvyns detaljyta (teacher-classes-detail.js)
// ----------------------------------------------------------------------------
// Issue #440: visar inställningar för EN klass i taget (aldrig två klassers
// samtidigt). Huvud: klassnamn + antal elever + Döp om (K-12) + Ta bort (K-13).
// Under huvudet sektionsflikar ur CLASS_SECTIONS-registryn; exakt en sektion
// syns (ersätter K-14:s en-panel-åt-gången). Vald sektion behålls vid klassbyte.
// I skapa-läget (store.creating, lead-beslut D-4) visas skapa-klass-formuläret.
//
// Varje rendering får en NY värd-<div>: en långsam sektion för förra klassen
// skriver då in i ett lösryckt element i stället för i den nya klassens yta.
// (Får inte förväxlas med teacher-class-detail.js = elevdetalj-modalen.)
// ============================================================================

import * as data from "./data.js";
import { el, esc, icon } from "./teacher-shared.js";
import { CLASS_SECTIONS, sectionFor, withLoading } from "./teacher-classes-sections.js";
import { countLabel, studentCount } from "./teacher-classes-store.js";
import { renderCreateClass } from "./teacher-classes-create.js";

/** Bygg detaljytan. Returnerar { element, update() }. */
export function createClassDetail(ctx, store) {
  const root = el(`<section class="panel cls-detail" aria-label="Vald klass"></section>`);
  // Vad som ritades senast – avgör om sektionen ska byggas om eller bara huvudet uppdateras.
  let shown = { id: undefined, section: undefined, creating: undefined };
  let head = null; // { nameEl, countEl }

  function renderCreate() {
    const host = el(`<div class="cls-section"></div>`);
    root.replaceChildren(host);
    head = null;
    renderCreateClass(ctx, store, host);
  }

  function renderEmpty() {
    head = null;
    root.replaceChildren(
      el(`<div class="cls-detail-empty"><p class="hint">Välj en klass i listan till vänster.</p></div>`)
    );
  }

  function renderClass(cls, sectionKey) {
    const sec = sectionFor(sectionKey);
    const tabs = CLASS_SECTIONS.map(
      (s) => `<button type="button" role="tab" class="cls-tab${s.key === sec.key ? " active" : ""}"
        data-key="${s.key}" id="cls-tab-${s.key}" aria-controls="cls-section"
        aria-selected="${s.key === sec.key}" tabindex="${s.key === sec.key ? 0 : -1}">
        ${icon(s.icon, 16)}<span>${esc(s.label)}</span></button>`
    ).join("");
    const box = el(`<div class="cls-detail-inner">
      <header class="cls-detail-head">
        <div class="cls-detail-title">
          <span class="class-emoji" aria-hidden="true">${icon("school", 22)}</span>
          <h2 class="cls-detail-name"></h2>
          <span class="class-count cls-detail-count"></span>
        </div>
        <div class="row-inline cls-detail-actions">
          <button type="button" class="btn ghost small" data-act="rename">${icon("pencil", 16)}<span>Döp om</span></button>
          <button type="button" class="btn ghost small danger" data-act="del">${icon("trash", 16)}<span>Ta bort klassen</span></button>
        </div>
      </header>
      <div class="cls-flash"></div>
      <div class="cls-tabs" role="tablist" aria-label="Inställningar för klassen">${tabs}</div>
      <div class="cls-section" id="cls-section" role="tabpanel" aria-labelledby="cls-tab-${sec.key}"></div>
    </div>`);

    head = { nameEl: box.querySelector(".cls-detail-name"), countEl: box.querySelector(".cls-detail-count") };
    updateHead(cls);

    const flash = store.flashes.get(cls.id);
    if (flash) {
      box.querySelector(".cls-flash").replaceChildren(el(`<div class="msg ok">${flash}</div>`));
      store.flashes.delete(cls.id);
    }

    // Döp om (K-12) – samma prompt + data-anrop som förut; namnet i master följer med.
    box.querySelector('[data-act="rename"]').addEventListener("click", async () => {
      const next = prompt("Nytt namn på klassen:", cls.name || "");
      if (next === null) return;
      const name = next.trim();
      if (!name) return;
      try {
        await data.upsertClass(cls.id, { name });
        cls.name = name;
        store.notify();
      } catch (err) {
        alert("Kunde inte döpa om: " + err.message);
      }
    });

    // Ta bort (K-13) – samma confirm; efter borttag väljs nästa klass.
    box.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm(`Ta bort klassen "${cls.name || cls.id}"? Elevkontona finns kvar – bara grupperingen försvinner.`))
        return;
      try {
        await data.deleteClass(cls.id);
        store.removeClass(cls.id);
      } catch (err) {
        alert("Kunde inte ta bort: " + err.message);
      }
    });

    // Sektionsflikar: klick + piltangenter (tablist-mönstret).
    const tablist = box.querySelector(".cls-tabs");
    tablist.addEventListener("click", (e) => {
      const t = e.target.closest("[data-key]");
      if (t && t.dataset.key !== store.section) store.setSection(t.dataset.key);
    });
    tablist.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      const keys = CLASS_SECTIONS.map((s) => s.key);
      const i = keys.indexOf(sec.key);
      const j =
        e.key === "Home" ? 0 : e.key === "End" ? keys.length - 1
        : (i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
      e.preventDefault();
      store.setSection(keys[j]);
      root.querySelector(`#cls-tab-${keys[j]}`)?.focus();
    });

    root.replaceChildren(box);
    const host = box.querySelector(".cls-section");
    withLoading(host, sec.what, () => sec.render(ctx, cls, host, store));
  }

  function updateHead(cls) {
    if (!head) return;
    head.nameEl.textContent = cls.name || cls.id;
    head.countEl.textContent = countLabel(studentCount(cls));
  }

  function update() {
    const cls = store.selected();
    const next = { id: cls ? cls.id : null, section: store.section, creating: store.creating };
    const same =
      next.id === shown.id && next.section === shown.section && next.creating === shown.creating;
    if (same) {
      if (cls) updateHead(cls); // döp om / elevantal – sektionen rörs inte
      return;
    }
    shown = next;
    if (store.creating) renderCreate();
    else if (cls) renderClass(cls, store.section);
    else renderEmpty();
  }

  update();
  return { element: root, update };
}
