// ============================================================================
// Pluggportalen – lärarsidan: synliga lägen per KLASS (teacher-class-modes.js)
// ----------------------------------------------------------------------------
// Utbruten del av teacher-classes.js (fil-cap): renderar sektionen "Synliga
// lägen för klassen" på ett klasskort. Läraren bockar UR spellägen/spel som ska
// döljas för HELA klassen (issue #208), utöver per-område-valet (#200).
//
// Listan härleds GENERISKT ur ALL_MODES (vanliga lägen + äventyrs-teman), så nya
// lägen/spel (inkl. äventyrsspelen) dyker upp automatiskt. Klass-nivån gate:as
// INTE på innehåll – alla teman listas. Ikryssat = synligt; urbockat sparas i
// classes/{id}.hiddenModes. Tomt = allt synligt (bakåtkompatibelt).
//
// Skiljer sig från per-område-kryssrutorna (teacher-content.js) på en punkt:
// här filtreras INTE på innehåll (has-gaten) – klass-valet gäller alla klassens
// områden, och vilka lägen ett enskilt område faktiskt har underlag för avgörs
// per område. Elev-gaten (gamemode-visibility.js) tar unionen klass ∪ område.
//
// OBS (issue #299): den klass-globala blanketten (renderClassModes) upplevdes
// rörig (två okoordinerade axlar). Lärar-UI:t använder numera i stället
// renderClassAreaModes nedan – per (klass × område)-val, gate:at på innehåll.
// renderClassModes behålls (bakåtkompatibel resolution + ev. återanvändning) men
// wiras inte längre i teacher-classes.js.
// ============================================================================

import * as data from "./data.js";
import {
  ALL_MODES,
  isModeHiddenForClass,
  availableGamemodes,
  classAreaHiddenModes,
} from "./game-shared.js";
import { el, esc, emptyState } from "./teacher-shared.js";

/**
 * Rendera och koppla "Synliga lägen för klassen"-sektionen in i `modesEl`.
 * @param {object} ctx        lärar-context (ej använt här, hålls för symmetri)
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenModes vid spar)
 * @param {HTMLElement} modesEl värd-element att fylla
 */
export function renderClassModes(ctx, cls, modesEl) {
  const rows = ALL_MODES.map((gm) => {
    const checked = isModeHiddenForClass(cls, gm.id) ? "" : " checked";
    return `<label class="member-row">
      <input type="checkbox" data-mode="${esc(gm.id)}"${checked} />
      <span class="member-avatar">${esc(gm.emoji)}</span>
      <span class="member-name">${esc(gm.name)}<br><span class="hint">${esc(gm.sub)}</span></span>
    </label>`;
  }).join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de lägen/spel klassen ska <b>se</b>. Ur-bockade lägen döljs
      för hela klassen i alla dess områden. Lämnar du allt ikryssat ser eleverna allt
      (per-område-valet i Innehåll gäller fortfarande ovanpå detta).</p>
    <div class="member-grid">${rows}</div>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-modes">💾 Spara lägen</button>
      <button class="btn ghost small" data-act="all-modes">Visa alla</button>
      <span class="modes-result"></span>
    </div>
  </div>`);

  const resultEl = box.querySelector(".modes-result");

  box.querySelector('[data-act="all-modes"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-modes"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Urbockade = dolda. (Checked = synligt.)
    const hidden = [...box.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(
      (c) => c.dataset.mode
    );
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenModes(cls.id, hidden);
      cls.hiddenModes = saved;
      resultEl.innerHTML = saved.length
        ? `<span class="ok-inline">✓ Sparat (${saved.length} läge${saved.length === 1 ? "" : "n"} dolda)</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla lägen</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  modesEl.replaceChildren(box);
}

// ---------------------------------------------------------------------------
// Per (klass × område) (issue #298/#299): utöver klass-globala valet ovan kan
// läraren finjustera synliga lägen för klassen PÅ ETT visst område. Sparas i
// classes/{id}.areaModes[areaId].hiddenModes (data.setClassAreaModes). Till
// skillnad från klass-nivån ovan gate:as detta PÅ innehåll (availableGamemodes)
// – bara lägen området faktiskt har underlag för listas per område.
// ---------------------------------------------------------------------------

/**
 * Vilka arbetsområden som är RELEVANTA för klassen: har klassen tilldelade
 * områden (assignedAreas) visas bara de, annars hela biblioteket. Behåller
 * ämnes-grupperingen från `library` och släpper ämnen utan relevanta områden.
 * @param {object} cls
 * @param {Array<{id:string,name?:string,icon?:string,areas:object[]}>} library
 */
function relevantAreaGroups(cls, library) {
  const assigned = Array.isArray(cls.assignedAreas) ? cls.assignedAreas : [];
  const only =
    assigned.length > 0
      ? new Set(assigned.map((a) => `${a.subjectId}/${a.areaId}`))
      : null;
  return library
    .map((subj) => ({
      subj,
      areas: subj.areas.filter((a) => !only || only.has(`${subj.id}/${a.id}`)),
    }))
    .filter((g) => g.areas.length > 0);
}

/**
 * Rendera "Lägen per område"-sektionen: område-rader med läges-kryssrutor, så
 * läraren per (klass × område) kan bocka i/ur vilka lägen som visas. Default =
 * områdets tillgängliga lägen minus det som redan är dolt för (klass × område).
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.areaModes vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 * @param {Array} library     ämnen med sina fulla område-dokument (data.getAreas)
 */
export function renderClassAreaModes(ctx, cls, host, library) {
  const groups = relevantAreaGroups(cls, library);

  if (groups.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        emoji: "📌",
        title: "Inga områden att finjustera än",
        text:
          Array.isArray(cls.assignedAreas) && cls.assignedAreas.length > 0
            ? "Klassens tilldelade områden saknar spelbart innehåll än."
            : "Lägg in innehåll (eller tilldela klassen områden) först, så kan du välja lägen per område här.",
        actionLabel: "Lägg in innehåll",
        actionHash: "#/larare/innehall",
      })
    );
    return;
  }

  const groupsHtml = groups
    .map(({ subj, areas }) => {
      const rows = areas
        .map((a) => {
          const modes = availableGamemodes(a);
          const hidden = new Set(classAreaHiddenModes(cls, a.id));
          const body =
            modes.length === 0
              ? `<p class="hint" style="margin:2px 0 0">Inga spelbara lägen på området än.</p>`
              : `<div class="member-grid">${modes
                  .map(
                    (gm) => `<label class="member-row">
                      <input type="checkbox" data-mode="${esc(gm.id)}"${
                      hidden.has(gm.id) ? "" : " checked"
                    } />
                      <span class="member-avatar">${esc(gm.emoji)}</span>
                      <span class="member-name">${esc(gm.name)}</span>
                    </label>`
                  )
                  .join("")}</div>`;
          return `<div class="area-modes-row" data-area="${esc(a.id)}" style="margin:10px 0 4px">
            <div class="assign-subject" style="font-weight:600">${esc(a.coverEmoji || "📖")} ${esc(a.name || a.id)}</div>
            ${body}
          </div>`;
        })
        .join("");
      return `<div class="assign-group">
        <div class="assign-subject">${esc(subj.icon || "📚")} ${esc(subj.name || subj.id)}</div>
        ${rows}
      </div>`;
    })
    .join("");

  const box = el(`<div>
    <p class="hint">Finjustera vilka lägen klassen ser <b>per område</b>. Ikryssat = synligt;
      urbockat döljs för klassen bara på det området. Bara lägen området har innehåll för visas.
      Detta läggs ovanpå både per-område-valet (Innehåll) och klassens 🎮 Lägen ovan.</p>
    ${groupsHtml}
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-area-modes">💾 Spara lägen per område</button>
      <button class="btn ghost small" data-act="all-area-modes">Visa alla</button>
      <span class="area-modes-result"></span>
    </div>
  </div>`);

  const resultEl = box.querySelector(".area-modes-result");

  box.querySelector('[data-act="all-area-modes"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-area-modes"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Bygg map:en för ALLA renderade områden (även helt ikryssade → tom lista) så
    // deep-merge:en även kan AV-dölja ett läge som tidigare var urbockat.
    const map = {};
    box.querySelectorAll(".area-modes-row").forEach((row) => {
      const areaId = row.dataset.area;
      const hidden = [...row.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(
        (c) => c.dataset.mode
      );
      map[areaId] = { hiddenModes: hidden };
    });
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassAreaModes(cls.id, map);
      cls.areaModes = { ...(cls.areaModes || {}), ...saved };
      const hiddenCount = Object.values(saved).reduce((n, v) => n + v.hiddenModes.length, 0);
      resultEl.innerHTML = hiddenCount
        ? `<span class="ok-inline">✓ Sparat (${hiddenCount} läge${hiddenCount === 1 ? "" : "n"} dolda per område)</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla lägen på områdena</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  host.replaceChildren(box);
}
