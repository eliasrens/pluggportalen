// ============================================================================
// Mattematchen – lärarens statistik (#459): klasstabell + elevdetalj
// ----------------------------------------------------------------------------
// Används på två ställen:
//   • Statistik → Mattematchen (klassdetaljens statistikflik, teacher-class.js):
//     renderClassMattematchen – välj period → klassens tabell.
//   • Mattematchen-fliken, en tävlings "Elevresultat" (teacher-mm-detail.js):
//     renderMmTable med vald klass.
// Tabell: Elev | Rätt | Fel | Totalt | Rätt % | Fel % (sorterbar). Klick på en
// elev → detalj: totals + per tabell 0–10 + (om indexet finns) "Totalt i
// multiplikation" = MM + Live ur gemensam träningsstatistik. Tävlingspoängen
// hålls separata – träningssiffran är bara information.
//
// KVOT (#114): en klass = ≤ ⌈n/30⌉ frågor mot studentStats (cache-dokument),
// aldrig svarsdokument. Träningstotalen = två count()-aggregat för EN elev.
// Tabell-/modalstilarna lånas från Läsresan (.lrt-*, .cx-modal) + mm-larare.css.
// Laddas DYNAMISKT (#271).
// ============================================================================

import { avatarEmoji } from "../avatars.js";
import { el, esc, emptyState, icon } from "../teacher-shared.js";
import { MM_COLUMNS, sortMmRows, nextMmSort, studentRows, formatPeriod, PHASE_LABEL } from "./mm-teacher-core.js";
import { competitionPhase, toMs } from "./mm-core.js";
import { pctLevel } from "../lasresan/teacher-rows.js";

/** Lärarstilarna (en gång, dynamiskt – styles.css rörs inte). */
export function ensureMmTeacherCss() {
  if (document.querySelector('link[data-mm-css="larare"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./mm-larare.css", import.meta.url).href;
  link.dataset.mmCss = "larare";
  document.head.appendChild(link);
}

const defaultData = () => import("./mm-teacher-data.js");
let lastSort = { key: "correct", dir: "desc" };
const dash = `<span class="lrt-dash" aria-label="inga svar än">–</span>`;

function rowHtml(r, student) {
  const name = r.namn;
  const num = (v) => (r.started ? String(v) : dash);
  const pct = (v) => (v == null ? dash : `${v}%`);
  return `<tr class="lrt-row${r.started ? "" : " lrt-not-started"}" data-student="${esc(r.studentId)}" tabindex="0"
      role="button" title="Klicka för Mattematchen-statistik om ${esc(name)}">
    <th class="lrt-name" scope="row">
      <span class="cx-avatar">${avatarEmoji(student && student.avatarId)}</span>
      <span class="lrt-name-txt">${esc(name)}</span>
      ${r.started ? "" : `<span class="lrt-badge">inga svar</span>`}
    </th>
    <td class="lrt-num">${num(r.correct)}</td>
    <td class="lrt-num">${num(r.incorrect)}</td>
    <td class="lrt-num">${num(r.total)}</td>
    <td class="lrt-num lrt-pct ${pctLevel(r.pctCorrect)}">${pct(r.pctCorrect)}</td>
    <td class="lrt-num">${pct(r.pctWrong)}</td>
  </tr>`;
}

function headHtml(sort) {
  return `<tr>${MM_COLUMNS.map((c) => {
    const active = sort.key === c.key;
    const aria = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
    return `<th scope="col" class="lrt-th${c.num ? " lrt-num" : ""}${active ? " active" : ""}" aria-sort="${aria}">
      <button type="button" class="lrt-sort" data-key="${c.key}"><span>${esc(c.label)}</span><span class="lrt-arrow" aria-hidden="true">${arrow}</span></button>
    </th>`;
  }).join("")}</tr>`;
}

function summaryHtml(rows) {
  const started = rows.filter((r) => r.started);
  const c = started.reduce((s, r) => s + r.correct, 0);
  const t = started.reduce((s, r) => s + r.total, 0);
  return `<div class="lrt-summary">
    <span><b>${started.length}</b> av ${rows.length} elever har svarat</span>
    <span><b>${c}</b> rätt · <b>${t - c}</b> fel</span>
    <span>${t > 0 ? `<b>${Math.round((c * 100) / t)}%</b> rätt i klassen` : "Inga svar än"}</span>
  </div>`;
}

/**
 * Rita den sorterbara tabellen för en klass i en tävling.
 * @param {{ students:object[], statsById:Map, competition:object, loadTraining?:Function }} opts
 */
export function renderMmTable(ctx, host, { students, statsById, competition, loadTraining }) {
  ensureMmTeacherCss();
  const list = Array.isArray(students) ? students : [];
  if (!list.length) {
    host.replaceChildren(emptyState(ctx, { icon: "users", title: "Klassen har inga elever",
      text: "Lägg till elever på klasskortet så syns deras Mattematchen-resultat här." }));
    return;
  }
  const byId = new Map(list.map((s) => [s.id, s]));
  const rows = studentRows(list, statsById);
  const rowById = new Map(rows.map((r) => [r.studentId, r]));
  const view = el(`<div class="mmt-table">
    ${summaryHtml(rows)}
    <div class="table-scroll"><table class="tbl lrt-tbl mmt-tbl"><thead></thead><tbody></tbody></table></div>
    <div class="cx-legend lrt-legend"><span class="cx-legend-tip">Klicka på en elev för statistik per tabell 0–10</span></div>
  </div>`);
  const thead = view.querySelector("thead");
  const tbody = view.querySelector("tbody");
  const draw = () => {
    thead.innerHTML = headHtml(lastSort);
    tbody.innerHTML = sortMmRows(rows, lastSort.key, lastSort.dir).map((r) => rowHtml(r, byId.get(r.studentId))).join("");
  };
  thead.addEventListener("click", (e) => {
    const btn = e.target.closest(".lrt-sort");
    if (!btn) return;
    lastSort = nextMmSort(lastSort, btn.dataset.key);
    draw();
    thead.querySelector(`.lrt-sort[data-key="${lastSort.key}"]`)?.focus();
  });
  const open = (tr) => {
    const id = tr?.dataset.student;
    if (!byId.has(id)) return;
    openMmStudentDetail(byId.get(id), rowById.get(id), { competition, loadTraining });
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

const stat = (num, lbl, extra = "") =>
  `<div class="cx-stat ${extra}"><div class="cx-stat-num">${num}</div><div class="cx-stat-lbl">${lbl}</div></div>`;

/** Per tabell 0–10: rätt, fel, totalt, rätt % + stapel. */
export function tablesHtml(tables) {
  if (!tables.some((t) => t.total > 0)) return `<p class="hint lrt-empty">Inga svar än.</p>`;
  return `<div class="table-scroll"><table class="tbl mmt-tabeller">
    <thead><tr><th>Tabell</th><th class="lrt-num">Rätt</th><th class="lrt-num">Fel</th>
      <th class="lrt-num">Totalt</th><th class="lrt-num">Rätt %</th><th class="mmt-bar-col" aria-hidden="true"></th></tr></thead>
    <tbody>${tables.map((t) => {
      const has = t.total > 0;
      const lvl = has ? pctLevel(t.pct) : "tom";
      return `<tr class="mmt-tab-row ${lvl}">
        <th scope="row">${t.table}:ans</th>
        <td class="lrt-num">${t.correct}</td><td class="lrt-num">${t.wrong}</td><td class="lrt-num">${t.total}</td>
        <td class="lrt-num lrt-pct ${lvl}">${has ? `${t.pct}%` : "–"}</td>
        <td class="mmt-bar-col"><span class="lrt-bar"><span style="width:${has ? t.pct : 0}%"></span></span></td>
      </tr>`;
    }).join("")}</tbody>
  </table></div>
  <p class="hint mmt-not">7 × 8 räknas i både 7:ans och 8:ans tabell (7 × 7 en gång).</p>`;
}

/** Elevdetalj (modal) för en tävling. */
export function openMmStudentDetail(student, row, { competition, loadTraining } = {}) {
  ensureMmTeacherCss();
  const s = row.summary;
  const name = row.namn;
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lrt-modal mmt-modal" role="dialog" aria-modal="true"
      aria-label="Mattematchen – ${esc(name)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div>
          <h2 class="cx-modal-name">${esc(name)}</h2>
          <p class="cx-modal-sub">${icon("trophy", 14)} ${esc(competition?.name || "Mattematchen")}</p>
        </div>
      </div>
      <div class="cx-modal-body">
        <div class="cx-stat-grid lrt-stat-grid mmt-stat-grid">
          ${stat(s.correct, "rätt")}
          ${stat(s.incorrect, "fel")}
          ${stat(s.total, "svar totalt")}
          ${stat(s.total ? `${s.pctCorrect}%` : "–", "rätt %", `lrt-pct ${pctLevel(s.total ? s.pctCorrect : null)}`)}
          ${stat(s.total ? `${s.pctWrong}%` : "–", "fel %")}
        </div>
        <div class="cx-detail-sec"><h3>Per multiplikationstabell</h3>${tablesHtml(s.tables)}</div>
        <div class="cx-detail-sec mmt-traning">
          <h3>Totalt i multiplikation <span class="hint">Mattematchen + Live</span></h3>
          <div class="mmt-traning-body"><div class="spinner">Räknar…</div></div>
          <p class="hint mmt-not">Bara information – tävlingspoängen ovan räknas separat.</p>
        </div>
      </div>
    </div>
  </div>`);
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  overlay.querySelector(".cx-modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => e.target === overlay && close());
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  overlay.querySelector(".cx-modal-close").focus();

  const tHost = overlay.querySelector(".mmt-traning-body");
  const load = loadTraining || (async (uid) => (await defaultData()).loadTrainingTotals(uid));
  Promise.resolve()
    .then(() => load(student.id))
    .then((t) => {
      if (!overlay.isConnected) return;
      const pct = t.total ? Math.round((t.correct * 100) / t.total) : null;
      tHost.innerHTML = `<div class="cx-stat-grid lrt-stat-grid mmt-stat-grid">
        ${stat(t.correct, "rätt")}${stat(t.incorrect, "fel")}${stat(t.total, "svar")}
        ${stat(pct == null ? "–" : `${pct}%`, "rätt %", `lrt-pct ${pctLevel(pct)}`)}
      </div>`;
    })
    .catch((err) => {
      console.warn("[Mattematchen] träningstotal", err);
      if (overlay.isConnected) tHost.innerHTML = `<p class="hint">Inte tillgänglig just nu (index saknas eller ingen behörighet).</p>`;
    });
  return { close };
}

/** Periodväljarens text: "Mattematchen oktober · Aktiv · 12 okt 08:00 – …". */
function periodLabel(c, now) {
  return `${c.name || "Mattematchen"} · ${PHASE_LABEL[competitionPhase(c, now)]} · ${formatPeriod(c, now)}`;
}

/**
 * Statistik → Mattematchen för EN klass: välj period → tabell.
 * @param {{ classId:string, students:object[], data?:object }} opts
 */
export async function renderClassMattematchen(ctx, host, { classId, students, data } = {}) {
  ensureMmTeacherCss();
  host.replaceChildren(el(`<div class="spinner">Laddar Mattematchen…</div>`));
  const api = data || (await defaultData());
  let comps;
  try {
    comps = await api.competitionsForClass(classId);
  } catch (err) {
    host.replaceChildren(el(`<div class="msg error">Kunde inte ladda Mattematchen: ${esc(err.message)}</div>`));
    return;
  }
  if (!comps.length) {
    host.replaceChildren(emptyState(ctx, { icon: "trophy", title: "Klassen har inte varit med i någon Mattematch",
      text: "Skapa en tävling under fliken Mattematchen så syns klassens resultat här.",
      actionLabel: "Till Mattematchen", actionHash: "#/larare/mattematchen" }));
    return;
  }
  const now = Date.now();
  // Senast startade först; förval = aktiv tävling, annars den senaste.
  comps.sort((a, b) => toMs(b.startAt) - toMs(a.startAt));
  const pick = comps.find((c) => competitionPhase(c, now) === "aktiv") || comps[0];
  const view = el(`<div class="mmt-class">
    <div class="lrt-intro">
      <h3 class="subhead lrt-title">${icon("trophy", 18)}<span>Mattematchen</span></h3>
      <label class="mmt-period">Period
        <select class="select mmt-period-sel" aria-label="Välj Mattematch">
          ${comps.map((c) => `<option value="${esc(c.id)}"${c.id === pick.id ? " selected" : ""}>${esc(periodLabel(c, now))}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="mmt-class-body"></div>
  </div>`);
  const body = view.querySelector(".mmt-class-body");
  const sel = view.querySelector(".mmt-period-sel");
  const show = async () => {
    const comp = comps.find((c) => c.id === sel.value);
    body.replaceChildren(el(`<div class="spinner">Laddar resultat…</div>`));
    try {
      const statsById = await api.loadStatsFor(comp.id, students.map((s) => s.id));
      if (sel.value !== comp.id) return;
      renderMmTable(ctx, body, { students, statsById, competition: comp });
    } catch (err) {
      body.replaceChildren(el(`<div class="msg error">Kunde inte ladda resultat: ${esc(err.message)}</div>`));
    }
  };
  sel.addEventListener("change", show);
  host.replaceChildren(view);
  await show();
}
