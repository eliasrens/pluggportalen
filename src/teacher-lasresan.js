// ============================================================================
// Pluggporten – lärarsidan: Läsresan-klasstabell (teacher-lasresan.js)
// ----------------------------------------------------------------------------
// Fliken "Läsresan" i klasskortets Statistik-panel (teacher-class.js, issue
// #402, spec §18). EN tabell med hela klassen:
//   Elev | Texter | Frågor | Rätt | Fel | Rätt % | Läsnivå | Värld | Steg
// Sorterbar på varje kolumnrubrik. Klick på en rad → elevdetaljen
// (teacher-lasresan-elev.js).
//
// KVOT (incident #114): tabellen läser BARA de förberäknade totalerna i
// studentData.lasresa (getClassLasresa, ett dokument per elev, en gång).
// Försöken (lasresaAttempts) hämtas först när läraren öppnar EN elev.
//
// Laddas DYNAMISKT från teacher-class.js – aldrig i app.js statiska bootgraf
// (#271, vaktas av test/lasresan-reader.test.js). Datakällorna kan injiceras
// (preview-lasresan-larare.html kör utan Firebase).
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc, emptyState, icon } from "./teacher-shared.js";
import { LEVEL_MAX } from "./lasresan/config.js";
import { TABLE_COLUMNS, nextSort, pctLevel, sortTeacherRows, teacherClassRows } from "./lasresan/teacher-rows.js";
import { openLasresanDetail } from "./teacher-lasresan-elev.js";

/** Standardkällor: Firestore-bryggan, laddad först när den behövs. */
const defaultLoadClass = async (ids) => (await import("./data-lasresan.js")).getClassLasresa(ids);
const defaultLoadAttempts = async (id, max) => (await import("./data-lasresan.js")).listAttempts(id, max);

// Senaste sortering delas mellan klasskort under sessionen (bekvämt vid byte).
let lastSort = { key: "namn", dir: "asc" };

const dash = `<span class="lrt-dash" aria-label="inget än">–</span>`;
const numCell = (row, v) => (row.started ? String(v) : dash);

/** En tabellrad. All elevdata escapas. */
function rowHtml(r, student) {
  const name = student ? student.namn || student.username || r.studentId : r.namn;
  const pctCls = pctLevel(r.pct);
  const lvlTitle = r.started ? `Dold läsnivå ${r.level} av ${LEVEL_MAX}` : "Har inte börjat – räknas som startnivå 3";
  return `<tr class="lrt-row${r.started ? "" : " lrt-not-started"}" data-student="${esc(r.studentId)}" tabindex="0"
      role="button" title="Klicka för Läsresan-statistik om ${esc(name)}">
    <th class="lrt-name" scope="row">
      <span class="cx-avatar">${avatarEmoji(student && student.avatarId)}</span>
      <span class="lrt-name-txt">${esc(name)}</span>
      ${r.started ? "" : `<span class="lrt-badge">ej börjat</span>`}
    </th>
    <td class="lrt-num">${numCell(r, r.texts)}</td>
    <td class="lrt-num">${numCell(r, r.questions)}</td>
    <td class="lrt-num">${numCell(r, r.correct)}</td>
    <td class="lrt-num">${numCell(r, r.incorrect)}</td>
    <td class="lrt-num lrt-pct ${pctCls}">${r.pct == null ? dash : `${r.pct}%`}</td>
    <td class="lrt-num"><span class="lrt-lvl${r.started ? "" : " start"}" title="${esc(lvlTitle)}">${r.level}</span></td>
    <td class="lrt-world">${esc(r.worldName)}</td>
    <td class="lrt-num lrt-step">${r.stepInWorld}<span class="lrt-of">/${r.steps}</span></td>
  </tr>`;
}

/** Rubrikrad med sorteringsknappar (aria-sort på aktiv kolumn). */
function headHtml(sort) {
  const cols = TABLE_COLUMNS.map((c) => {
    const active = sort.key === c.key;
    const aria = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
    return `<th scope="col" class="lrt-th${c.num ? " lrt-num" : ""}${active ? " active" : ""}" aria-sort="${aria}">
      <button type="button" class="lrt-sort" data-key="${c.key}">
        <span>${esc(c.label)}</span><span class="lrt-arrow" aria-hidden="true">${arrow}</span>
      </button>
    </th>`;
  }).join("");
  return `<tr>${cols}</tr>`;
}

/** Klassens summering ovanför tabellen. */
function summaryHtml(rows) {
  const started = rows.filter((r) => r.started);
  const texts = started.reduce((s, r) => s + r.texts, 0);
  const q = started.reduce((s, r) => s + r.questions, 0);
  const c = started.reduce((s, r) => s + r.correct, 0);
  const pct = q > 0 ? Math.round((c * 100) / q) : null;
  return `<div class="lrt-summary">
    <span><b>${started.length}</b> av ${rows.length} elever har börjat</span>
    <span><b>${texts}</b> lästa texter</span>
    <span>${pct == null ? "Inga svar än" : `<b>${pct}%</b> rätt i klassen`}</span>
  </div>`;
}

/**
 * Rita klassens Läsresan-tabell in i `host`.
 * @param {object} ctx  lärar-context (emptyState-länkar)
 * @param {HTMLElement} host
 * @param {{
 *   students: object[],   // klassens elever ({ id, namn, username, avatarId })
 *   loadClass?: (ids:string[]) => Promise<{studentId, lasresa}[]>,
 *   loadAttempts?: (studentId:string, max:number) => Promise<object[]>,
 * }} opts
 */
export async function renderClassLasresan(ctx, host, { students, loadClass, loadAttempts } = {}) {
  const list = Array.isArray(students) ? students : [];
  if (list.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        icon: "users",
        title: "Klassen har inga elever än",
        text: "Lägg till elever på klasskortet (Elever) så syns deras läsning här.",
      })
    );
    return;
  }
  host.replaceChildren(el(`<div class="spinner">Laddar Läsresan…</div>`));

  let entries;
  try {
    entries = await (loadClass || defaultLoadClass)(list.map((s) => s.id));
  } catch (err) {
    host.replaceChildren(el(`<div class="msg error">Kunde inte ladda Läsresan: ${esc(err.message)}</div>`));
    return;
  }

  const byId = new Map(list.map((s) => [s.id, s]));
  const lasresaById = new Map((entries || []).map((e) => [e.studentId, e.lasresa || null]));
  // En rad för VARJE elev i klassen – även de som saknas i svaret (= ej börjat).
  const rows = teacherClassRows(
    list.map((s) => ({ studentId: s.id, namn: s.namn || s.username || s.id, lasresa: lasresaById.get(s.id) || null }))
  );
  const rowById = new Map(rows.map((r) => [r.studentId, r]));

  const view = el(`<div class="lrt-teacher">
    <div class="lrt-intro">
      <h3 class="subhead lrt-title">${icon("book", 18)}<span>Läsresan</span></h3>
      ${summaryHtml(rows)}
    </div>
    <div class="table-scroll">
      <table class="tbl lrt-tbl">
        <thead></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="cx-legend lrt-legend">
      <span class="cx-legend-item"><span class="cx-dot hog"></span>Minst 67 % rätt</span>
      <span class="cx-legend-item"><span class="cx-dot mellan"></span>34–66 %</span>
      <span class="cx-legend-item"><span class="cx-dot lag"></span>Under 34 %</span>
      <span class="cx-legend-item">Läsnivå 1–${LEVEL_MAX} är dold för eleven</span>
      <span class="cx-legend-tip">Klicka på en elev för detaljer</span>
    </div>
  </div>`);
  const thead = view.querySelector("thead");
  const tbody = view.querySelector("tbody");

  function draw() {
    thead.innerHTML = headHtml(lastSort);
    tbody.innerHTML = sortTeacherRows(rows, lastSort.key, lastSort.dir)
      .map((r) => rowHtml(r, byId.get(r.studentId)))
      .join("");
  }

  // Sortering: klick på rubrik (delegerat – rubrikerna ritas om vid varje klick).
  thead.addEventListener("click", (e) => {
    const btn = e.target.closest(".lrt-sort");
    if (!btn) return;
    lastSort = nextSort(lastSort, btn.dataset.key);
    draw();
    thead.querySelector(`.lrt-sort[data-key="${lastSort.key}"]`)?.focus();
  });

  const open = (tr) => {
    const id = tr && tr.dataset.student;
    const student = byId.get(id);
    if (!student) return;
    openLasresanDetail(student, {
      row: rowById.get(id),
      lasresa: lasresaById.get(id) || null,
      loadAttempts: loadAttempts || defaultLoadAttempts,
    });
  };
  tbody.addEventListener("click", (e) => open(e.target.closest("tr.lrt-row")));
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tr.lrt-row");
    if (!tr) return;
    e.preventDefault();
    open(tr);
  });

  draw();
  host.replaceChildren(view);
}
