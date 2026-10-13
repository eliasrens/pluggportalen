// ============================================================================
// Pluggporten – lärarsidan: Ämnesläsning per område (teacher-amneslasning.js)
// ----------------------------------------------------------------------------
// Issue #674: sektionen "📖 Ämnesläsning" under tabellen i Statistik → Per
// område (teacher-plugga.js). Per elev i det valda området (eller hela ämnet):
//   Elev | Lästa texter (x av N) | Läsningar | Rätt % | Frågetyper
// Frågetyperna är Läsresans fyra kategorier som mini-staplar (samma pp-minibar
// som Plugga-tabellen). Logiken bor i src/amneslasning/teacher-stats.js.
//
// Visas bara när urvalet har ämnestexter eller någon elev har läst där.
// Laddas bara från teacher-plugga.js (själv dynamisk) – aldrig i bootgrafen.
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc } from "./teacher-shared.js";
import { CATEGORY_LABELS } from "./lasresan/config.js";
import { sortRows } from "./lasresan/stats.js";
import { pctLevel } from "./lasresan/teacher-rows.js";
import { AMNES_COLUMNS, amnesAreaRows, availableAmnesTexts, summarizeAmnesRows } from "./amneslasning/teacher-stats.js";

const SHORT = { fakta: "Fakta", ordforstaelse: "Ord", mellan_raderna: "Mellan", helhet_slutsats: "Helhet" };
const ICON = { fakta: "🔎", ordforstaelse: "🔤", mellan_raderna: "💭", helhet_slutsats: "🧩" };

let lastSort = { key: "namn", dir: "asc" };
const dash = `<span class="lrt-dash" aria-label="inget än">–</span>`;

function miniBarsHtml(row) {
  if (!row.hasCategoryData) return `<span class="pp-minibars none" title="Har inte läst i urvalet">${dash}</span>`;
  const bars = row.perCategory
    .map((c) => {
      const has = c.q > 0;
      const tip = has ? `${c.label}: ${c.pct} % rätt (${c.correct}/${c.q})` : `${c.label}: inga frågor än`;
      return `<span class="pp-minibar ${has ? pctLevel(c.pct) : "tom"}" title="${esc(tip)}">
        <span style="height:${has ? Math.max(8, c.pct) : 0}%"></span></span>`;
    })
    .join("");
  const label = row.perCategory.filter((c) => c.q > 0).map((c) => `${c.label} ${c.pct} %`).join(", ");
  return `<span class="pp-minibars" role="img" aria-label="${esc(label)}">${bars}</span>`;
}

function rowHtml(r, student) {
  const name = student ? student.namn || student.username || r.studentId : r.namn;
  return `<tr class="${r.active ? "" : "lrt-not-started"}">
    <th class="lrt-name" scope="row">
      <span class="cx-avatar">${avatarEmoji(student && student.avatarId)}</span>
      <span class="lrt-name-txt">${esc(name)}</span>
      ${r.active ? "" : `<span class="lrt-badge">ej läst</span>`}
    </th>
    <td class="lrt-num">${r.active ? r.read : dash}${r.available ? `<span class="lrt-of"> av ${r.available}</span>` : ""}</td>
    <td class="lrt-num">${r.active ? r.readings : dash}</td>
    <td class="lrt-num lrt-pct ${pctLevel(r.pct)}"
      title="${r.questions ? `${r.correct} av ${r.questions} frågor rätt` : "Inga svar"}">${r.pct == null ? dash : `${r.pct}%`}</td>
    <td class="pp-cats-cell">${miniBarsHtml(r)}</td>
  </tr>`;
}

function headHtml(sort) {
  const cols = AMNES_COLUMNS.map((c) => {
    const active = sort.key === c.key;
    const aria = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
    return `<th scope="col" class="lrt-th${c.num ? " lrt-num" : ""}${active ? " active" : ""}" aria-sort="${aria}"
        ${c.title ? `title="${esc(c.title)}"` : ""}>
      <button type="button" class="lrt-sort" data-key="${c.key}">
        <span>${esc(c.label)}</span><span class="lrt-arrow" aria-hidden="true">${arrow}</span>
      </button>
    </th>`;
  }).join("");
  const icons = Object.keys(SHORT)
    .map((k) => `<span class="pp-minibar-head" title="${esc(CATEGORY_LABELS[k])}">${ICON[k]}</span>`)
    .join("");
  return `<tr>${cols}<th scope="col" class="lrt-th pp-cats-head" title="Rätt-% per frågetyp">
    <span class="pp-cats-lbl">Frågetyper</span><span class="pp-minibars head" aria-hidden="true">${icons}</span>
  </th></tr>`;
}

function summaryHtml(sum) {
  const cats = sum.perCategory
    .filter((c) => c.q > 0)
    .map((c) => `<span class="pp-sum-cat ${pctLevel(c.pct)}">${ICON[c.category] || ""} ${esc(SHORT[c.category] || c.label)} <b>${c.pct}%</b></span>`)
    .join("");
  return `<div class="lrt-summary">
    <span><b>${sum.activeStudents}</b> av ${sum.students} elever har läst</span>
    <span><b>${sum.readings}</b> lästa ämnestexter</span>
    <span>${sum.pct == null ? "Inga svar än" : `<b>${sum.pct}%</b> rätt i klassen`}</span>
    ${cats}
  </div>`;
}

/**
 * Rita (eller töm) ämnesläsningssektionen in i `host`.
 * @param {HTMLElement} host
 * @param {{ entries: {studentId, namn, amneslasning}[], areas: object[], byId: Map }} opts
 */
export function renderAmnesSection(host, { entries, areas, byId }) {
  const rows = amnesAreaRows(entries, areas);
  const sum = summarizeAmnesRows(rows);
  if (availableAmnesTexts(areas) === 0 && sum.activeStudents === 0) {
    host.replaceChildren();
    return;
  }
  const view = el(`<section class="am-teacher" aria-label="Ämnesläsning">
    <h3 class="subhead am-title">📖 <span>Ämnesläsning</span></h3>
    ${summaryHtml(sum)}
    <div class="table-scroll"><table class="tbl lrt-tbl pp-tbl am-tbl"><thead></thead><tbody></tbody></table></div>
    <div class="cx-legend lrt-legend">
      <span class="cx-legend-item">${Object.keys(SHORT).map((k) => `${ICON[k]} ${esc(CATEGORY_LABELS[k])}`).join(" · ")}</span>
      <span class="cx-legend-tip">Räknas också in i elevens läsning under fliken Läsresan</span>
    </div>
  </section>`);
  const thead = view.querySelector("thead");
  const tbody = view.querySelector("tbody");
  const draw = () => {
    thead.innerHTML = headHtml(lastSort);
    tbody.innerHTML = sortRows(sortRows(rows, "namn", "asc"), lastSort.key, lastSort.dir)
      .map((r) => rowHtml(r, byId && byId.get(r.studentId)))
      .join("");
  };
  thead.addEventListener("click", (e) => {
    const btn = e.target.closest(".lrt-sort");
    if (!btn) return;
    e.stopPropagation(); // Per område-tabellens delegerade sortering ska inte se klicket
    const key = btn.dataset.key;
    const col = AMNES_COLUMNS.find((c) => c.key === key);
    lastSort = lastSort.key === key
      ? { key, dir: lastSort.dir === "asc" ? "desc" : "asc" }
      : { key, dir: col && col.num ? "desc" : "asc" };
    draw();
    thead.querySelector(`.lrt-sort[data-key="${lastSort.key}"]`)?.focus();
  });
  draw();
  host.replaceChildren(view);
}
