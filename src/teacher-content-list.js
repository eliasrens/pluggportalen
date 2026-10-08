// ============================================================================
// Pluggporten – lärarsidan: innehållstabell för arbetsområden (teacher-content-list.js)
// ----------------------------------------------------------------------------
// Innehållsstudions BIBLIOTEK som en kompakt, sorterbar datatabell (issue #441,
// tidigare kort från #303). En rad per arbetsområde i valt ämne: Område · Årskurs ·
// Innehåll · Omfattning · Åtgärder. Klick/Enter/Space på raden (eller ögat) fäller
// ut områdets UNDERRADER (#454, teacher-area-items.js – laddas med import() vid
// första utfällning, #271): redigera/lägg till/ta bort enskilda frågor, par och
// texter. ✏️ öppnar wizarden (onEdit); övriga ikonknappar bevarar alla gamla
// funktioner: Lägg till (#40) och Ta bort (med confirm).
// Utfällningar visas i en full-bredds-rad direkt under raden; vilka områden som
// är utfällda (och vald flik, #455) minns i opts.itemState så de står kvar när listan laddas om. Rubrikerna Område/Årskurs är
// klickbara (aria-sort + ▲/▼); själva sorteringen sker i grades.filterSortAreas
// och sorteringsstate ägs av teacher-content.js – hit kommer redan sorterade områden.
// ============================================================================

import * as data from "./data.js";
import { buildMergeForm } from "./teacher-content-merge.js";
import { areaExerciseTypes, hasGeneratorContent, EXERCISE_TYPES } from "./exercise-types.js";
import { normalizeGrade, gradeLabel } from "./grades.js";
import { el, esc, icon } from "./teacher-shared.js";
import { generatorSummary } from "./teacher-generator-labels.js";

let itemsMod = null; // teacher-area-items.js efter första import() (#454/#271).

const TYPE_BY_ID = new Map(EXERCISE_TYPES.map((t) => [t.id, t]));

/** Korta typ-etiketter för kortet (ikon + kort ord), i kanonisk ordning. */
const TYPE_SHORT = {
  quiz: "Quiz",
  pairs: "Para ihop",
  bildpar: "Bildpar",
  generator: "Räkna",
};

/** Bygg typ-badges ur områdets övningstyper (ärlig status – vad området FAKTISKT har). */
function typeBadges(a) {
  return areaExerciseTypes(a)
    .map((id) => {
      const t = TYPE_BY_ID.get(id);
      const emoji = t ? t.emoji : "•";
      return `<span class="badge type-badge">${esc(emoji)} ${esc(TYPE_SHORT[id] || id)}</span>`;
    })
    .join("");
}

/** Ärlig mängd-indikator: generator → oändligt, annars faktiska antal. */
function quantityText(a) {
  if (hasGeneratorContent(a)) {
    const g = generatorSummary(a.generator);
    return `🔢 ${g.topics} · genererat · oändligt (${g.variants} varianter)`;
  }
  const parts = [];
  if (a.quiz?.length) parts.push(`${a.quiz.length} frågor`);
  if (a.pairs?.length) parts.push(`${a.pairs.length} par`);
  if (a.texts?.length) parts.push(`${a.texts.length} texter`);
  return parts.length ? parts.join(" · ") : "Tomt – inget innehåll ännu";
}

/** Innehålls-piller för läs-material som inte är egna övningstyper. */
function textBadges(a) {
  let out = "";
  if (a.texts?.length) out += `<span class="badge type-badge">📄 Lästexter</span>`;
  return out;
}

/** Sorterbara kolumner: nyckel → rubrik. */
const SORT_COLS = [
  { key: "name", label: "Område" },
  { key: "grade", label: "Årskurs" },
];

function sortHeader({ key, label }, sort) {
  const active = sort?.key === key;
  const dir = active ? sort.dir : null;
  const ariaSort = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
  const arrow = dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕";
  return `<th scope="col" aria-sort="${ariaSort}" class="${active ? "sorted" : ""}">
    <button type="button" class="th-sort" data-sort="${key}"
      title="Sortera på ${esc(label.toLowerCase())}">${esc(label)}<span class="sort-ind" aria-hidden="true">${arrow}</span></button>
  </th>`;
}

/** Ren ikonknapp (utan boxad bakgrund, #453) med tooltip + aria-label. */
const actBtn = (act, ic, label, extra = "") =>
  `<button type="button" class="area-act ${extra}" data-act="${act}"
    title="${esc(label)}" aria-label="${esc(label)}">${icon(ic, 16)}</button>`;

/**
 * Bygg den sorterbara innehållstabellen.
 * @param {object[]} areas – redan filtrerade/sorterade områden att visa.
 * @param {object} opts
 * @param {string} opts.subjectId  – valt ämne (för spara/ta bort).
 * @param {(area:object)=>void} opts.onEdit – öppna området i kompositören.
 * @param {()=>void} opts.onRefresh – ladda om listan efter ändring.
 * @param {{key:string,dir:string}} [opts.sort] – aktiv sortering ("order" = ingen).
 * @param {(key:string)=>void} [opts.onSort] – rubrikklick på en sorterbar kolumn.
 * @param {{open:Set<string>, notice:Map<string,string>, tab?:Map<string,string>}} [opts.itemState] – utfällda
 *   områden + engångs-notis efter sparning + senast vald flik per område (#455) (ägs av teacher-content.js, överlever omladdning).
 * @param {()=>void} [opts.onItemsSaved] – tyst omladdning efter sparad underrad (#454).
 * @returns {HTMLElement}
 */
export function buildAreaTable(areas, { subjectId, onEdit, onRefresh, sort, onSort, itemState, onItemsSaved }) {
  const state = itemState || { open: new Set(), notice: new Map() };
  state.tab ??= new Map();
  const wrap = el(`<div class="table-scroll area-table-scroll">
    <table class="area-tbl">
      <thead><tr>
        ${sortHeader(SORT_COLS[0], sort)}
        ${sortHeader(SORT_COLS[1], sort)}
        <th scope="col">Innehåll</th>
        <th scope="col">Omfattning</th>
        <th scope="col" class="area-tbl-actions-h">Åtgärder</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </div>`);
  wrap.querySelectorAll("[data-sort]").forEach((b) =>
    b.addEventListener("click", () => onSort?.(b.dataset.sort))
  );
  const tbody = wrap.querySelector("tbody");

  for (const a of areas) {
    const grade = normalizeGrade(a.grade);
    const key = `${subjectId}/${a.id}`;
    const row = el(`<table><tbody><tr class="area-tbl-row" tabindex="0"
        aria-expanded="false" aria-label="Visa innehållet i ${esc(a.name)}">
      <td class="area-tbl-name"><span class="area-tbl-emoji" aria-hidden="true">${esc(a.coverEmoji || "📖")}</span><span>${esc(a.name)}</span></td>
      <td class="area-tbl-grade">${grade ? esc(gradeLabel(grade)) : "–"}</td>
      <td><div class="area-tbl-badges">${typeBadges(a)}${textBadges(a)}</div></td>
      <td class="area-tbl-count">${esc(quantityText(a))}</td>
      <td><div class="area-tbl-actions">
        ${actBtn("edit", "pencil", `Redigera ${a.name}`)}
        ${actBtn("review", "eye", "Granska innehållet")}
        ${actBtn("add", "plus", "Lägg till innehåll")}
        ${actBtn("del", "trash", "Ta bort", "danger")}
      </div></td>
    </tr></tbody></table>`).querySelector("tr");

    // Utfällbara slots i en full-bredds-rad under raden (behåller alla gamla funktioner).
    const expandRow = el(`<table><tbody><tr class="area-expand-row" hidden>
      <td colspan="5"></td></tr></tbody></table>`).querySelector("tr");
    const itemsSlot = el(`<div class="area-items" hidden></div>`);
    const mergeSlot = el(`<div class="area-merge" hidden></div>`);
    expandRow.firstElementChild.append(itemsSlot, mergeSlot);
    const btn = (act) => row.querySelector(`[data-act="${act}"]`);
    const slotBtns = new Map([[itemsSlot, btn("review")], [mergeSlot, btn("add")]]);
    let panel = null; // underradens panel när den är byggd.

    // Utfällningsraden + knapparnas aktiv-läge följer slottarnas hidden – även när
    // formulärets egen "Stäng"-knapp (merge) döljer sin slot.
    const syncExpand = () => {
      for (const [slot, b] of slotBtns) {
        b.classList.toggle("active", !slot.hidden);
        b.setAttribute("aria-expanded", String(!slot.hidden));
      }
      row.setAttribute("aria-expanded", String(!itemsSlot.hidden));
      row.classList.toggle("expanded", !itemsSlot.hidden);
      expandRow.hidden = itemsSlot.hidden && mergeSlot.hidden;
    };
    const obs = new MutationObserver(syncExpand);
    for (const slot of slotBtns.keys()) obs.observe(slot, { attributes: true, attributeFilter: ["hidden"] });
    syncExpand();

    const toggleSlot = (slot, build) => {
      if (!slot.hidden) {
        slot.hidden = true;
        slot.innerHTML = "";
        syncExpand();
        return;
      }
      slot.replaceChildren(build());
      slot.hidden = false;
      syncExpand();
      slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    // Underraderna (#454): UI:t laddas med import() vid första utfällning (#271).
    // Redan laddad modul → byggs synkront (ingen spinner-blink vid tyst omladdning).
    const openItems = async () => {
      state.open.add(key);
      itemsSlot.hidden = false;
      syncExpand();
      try {
        if (!itemsMod) {
          itemsSlot.replaceChildren(el(`<div class="spinner">Laddar innehåll…</div>`));
          itemsMod = await import("./teacher-area-items.js");
          if (itemsSlot.hidden) return;
        }
        const notice = state.notice.get(key);
        state.notice.delete(key);
        panel = itemsMod.buildItemsPanel(a, {
          subjectId,
          notice,
          tab: state.tab.get(key),
          onTabChange: (id) => {
            state.tab.set(key, id);
            syncExpand();
          },
          onSaved: (msg) => {
            state.notice.set(key, msg);
            (onItemsSaved || onRefresh)();
          },
        });
        itemsSlot.replaceChildren(panel);
        // Efter sparning: fokus till underraden (tabellen byggdes om och sätts in
        // i DOM:en först efter buildAreaTable – därav nästa frame).
        const built = panel;
        if (notice) requestAnimationFrame(() => built.isConnected && built.focus({ preventScroll: true }));
      } catch (err) {
        console.error("Underraderna kunde inte laddas:", err);
        itemsSlot.innerHTML = `<div class="msg error">Kunde inte ladda innehållet just nu. Prova att ladda om sidan.</div>`;
      }
    };
    const toggleItems = () => {
      if (!itemsSlot.hidden) {
        state.open.delete(key);
        panel = null;
        itemsSlot.hidden = true;
        itemsSlot.replaceChildren();
        syncExpand();
        return;
      }
      openItems().then(() => itemsSlot.scrollIntoView?.({ behavior: "smooth", block: "nearest" }));
    };

    // Klick/Enter/Space på raden (men inte på en åtgärdsknapp) fäller ut/ihop underraden.
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-act]")) return;
      toggleItems();
    });
    row.addEventListener("keydown", (e) => {
      if (e.target !== row) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleItems();
      }
    });

    btn("edit").addEventListener("click", () => onEdit(a));
    btn("review").addEventListener("click", toggleItems);
    btn("add").addEventListener("click", () =>
      toggleSlot(mergeSlot, () => buildMergeForm(a, mergeSlot, { subjectId, onSaved: onRefresh }))
    );
    btn("del").addEventListener("click", async () => {
      if (!confirm(`Ta bort arbetsområdet "${a.name}"? Detta går inte att ångra.`)) return;
      try {
        await data.deleteArea(subjectId, a.id);
        onRefresh();
      } catch (err) {
        alert("Kunde inte ta bort: " + err.message);
      }
    });

    tbody.append(row, expandRow);
    if (state.open.has(key)) openItems();
  }
  return wrap;
}
