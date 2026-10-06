// ============================================================================
// Pluggporten – lärarsidan: Innehållsstudion (teacher-content.js)
// ----------------------------------------------------------------------------
// #/larare/innehall, ombyggd (issue #303) från en tät JSON-vägg till en STUDIO:
//   • BIBLIOTEK (landning): ETT studiokort (#453) med sidhuvud, ämnesflikar,
//     verktygsrad och sorterbar tabell per arbetsområde (ärlig status, #441).
//     Klick på rad → utfällda underrader (#454) där frågor/par/texter
//     redigeras; pennan → wizarden. Sorteringsstate ({key, dir}) bor här.
//   • SKAPA/REDIGERA-WIZARD (modal, issue #442): 4 steg – grundinställningar,
//     innehåll & AI-önskemål, AI-verkstaden, synlighet & spara. All wiring bor i
//     teacher-wizard.js (+ ett modul per steg). Osparat → varning vid stäng.
//
// INGEN funktion är borttagen mot förr – bara omgrupperad. AI-genererat innehåll
// autosparas ALDRIG: materialrutan är ett redigerbart utkast och Spara sker först
// efter Kontrollera/granskning.
//
// BOOT-SÄKERT: teacher-content.js ligger i den STATISKA bootgrafen (index.html →
// app.js → teacher.js → hit). teacher-wizard.js + dess tunga imports laddas
// därför DYNAMISKT nedan – en NY fil i den statiska grafen kan 404:a under en
// icke-atomär deploy → vit sida (bevisad rotorsak #271, jfr #290).
// ============================================================================

import * as data from "./data.js";
import { buildAreaTable } from "./teacher-content-list.js";
import { buildLibraryView, buildSubjectTab } from "./teacher-content-view.js";
import { wireNewSubjectForm } from "./teacher-subject-form.js";
import { filterSortAreas } from "./grades.js";
import {
  el,
  esc,
  isTeacher,
  teacherNav,
  teacherHead,
  emptyState,
  renderGate,
} from "./teacher-shared.js";

export async function pageLarareInnehall(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar ämnen…</div>`));

  let subjects = [];
  try {
    subjects = await data.getSubjects();
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda ämnen: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  // Wizarden (och dess tunga imports: teacher-generator.js, teacher-area-input.js)
  // laddas DYNAMISKT så inget nytt hamnar i den statiska bootgrafen (#271/#290).
  // Fångas här och visas som ett snällt fel INNE i vyn – aldrig vit sida.
  let createAreaWizard;
  try {
    ({ createAreaWizard } = await import("./teacher-wizard.js"));
  } catch (err) {
    console.error("Wizarden kunde inte laddas:", err);
    const container = el(`<div class="teacher-page teacher-dark"></div>`);
    container.appendChild(teacherNav(ctx, "innehall"));
    container.appendChild(teacherHead(ctx, { icon: "book", title: "Innehållsstudion" }));
    container.appendChild(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda innehållsverktygen just nu.
        Prova att ladda om sidan om en stund.</div></div>`)
    );
    ctx.app.replaceChildren(container);
    return;
  }

  // Valt ämne: SO först om det finns, annars första.
  let selected = subjects.find((s) => s.id === "so")?.id || subjects[0]?.id || null;
  let currentAreas = []; // senast hämtade områden i valt ämne.

  const subjectName = () => subjects.find((s) => s.id === selected)?.name || selected || "";

  const lib = buildLibraryView();
  const subjectTabs = lib.querySelector("#subject-tabs");
  const areaCardsEl = lib.querySelector("#area-cards");
  const gradeFilterSel = lib.querySelector("#area-grade-filter");
  // Tabellens sortering: "order" (områdets ordning) tills en rubrik klickas;
  // samma rubrik igen vänder riktningen.
  let sort = { key: "order", dir: "asc" };
  // Utfällda underrader (#454) + engångsnotis efter sparning + vald flik per
  // område (#455) – överlever omladdning under sidbesöket.
  const itemState = { open: new Set(), notice: new Map(), tab: new Map() };
  const onSort = (key) => {
    sort = sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" };
    renderAreaCards();
  };

  // Skapa/redigera-wizarden (skapar sin egen DOM, wiras internt).
  const wizard = createAreaWizard({
    getSubjectId: () => selected,
    getSubjectName: subjectName,
    onSaved: refreshAreaList,
  });

  function renderSubjectTabs() {
    subjectTabs.replaceChildren(
      ...subjects.map((s) => {
        const tab = buildSubjectTab(s, s.id === selected);
        tab.addEventListener("click", () => {
          if (selected === s.id) return;
          selected = s.id;
          renderSubjectTabs();
          refreshAreaList();
        });
        return tab;
      })
    );
  }

  function renderAreaCards() {
    if (currentAreas.length === 0) {
      areaCardsEl.replaceChildren(
        emptyState(ctx, {
          emoji: "🗂️",
          title: "Inga arbetsområden i ämnet ännu",
          text: "Klicka <b>Skapa nytt område</b> för att lägga in det första.",
        })
      );
      return;
    }
    const shown = filterSortAreas(currentAreas, {
      filter: gradeFilterSel.value,
      sort: sort.key,
      dir: sort.dir,
    });
    if (shown.length === 0) {
      areaCardsEl.innerHTML = `<p class="hint">Inga arbetsområden matchar filtret. Ändra "Visa årskurs" ovan.</p>`;
      return;
    }
    areaCardsEl.replaceChildren(
      buildAreaTable(shown, {
        subjectId: selected,
        onEdit: wizard.openEdit,
        onRefresh: refreshAreaList,
        sort,
        onSort,
        itemState,
        onItemsSaved: () => refreshAreaList({ quiet: true }),
      })
    );
  }

  // quiet: ingen spinner (efter sparad underrad, #454) – tabellen byts ut på
  // plats så sidan inte hoppar och utfällda underrader står kvar.
  async function refreshAreaList({ quiet = false } = {}) {
    if (!selected) {
      areaCardsEl.innerHTML = `<p class="hint">Inget ämne valt.</p>`;
      return;
    }
    if (!quiet) areaCardsEl.innerHTML = `<div class="spinner">Laddar…</div>`;
    try {
      currentAreas = await data.getAreas(selected);
    } catch (err) {
      areaCardsEl.innerHTML = `<div class="msg error">Kunde inte ladda arbetsområden: ${esc(err.message)}</div>`;
      return;
    }
    renderAreaCards();
  }

  gradeFilterSel.addEventListener("change", renderAreaCards);
  renderSubjectTabs();

  wireNewSubjectForm({
    toggleBtn: lib.querySelector("#new-subject"),
    formEl: lib.querySelector("#new-subject-form"),
    subjects,
    onCreated: (id) => {
      selected = id;
      renderSubjectTabs();
      refreshAreaList();
    },
  });

  lib.querySelector("#create-new").addEventListener("click", () => {
    if (!selected) {
      alert("Skapa eller välj ett ämne först.");
      return;
    }
    wizard.openNew();
  });

  const container = el(`<div class="teacher-page teacher-dark"></div>`);
  container.appendChild(teacherNav(ctx, "innehall"));
  // Sidhuvudet (ikon + titel + undertitel) ligger INNE i studiokortet (#453).
  container.appendChild(lib);
  container.appendChild(wizard.element);
  ctx.app.replaceChildren(container);
  refreshAreaList();
}
