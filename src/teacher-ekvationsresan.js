// ============================================================================
// Pluggporten – lärarsidan: Ekvationsresan-klassöversikt (teacher-ekvationsresan.js)
// ----------------------------------------------------------------------------
// Fliken "Ekvationsresan" i klasskortets Statistik-panel (teacher-class.js,
// issue #619, spec E1.12). Samma upplägg och mörka stil som Läsresan
// (teacher-lasresan.js):
//   Elev | Nivå | Trend | Uppgifter | ⭐⭐⭐/⭐⭐/⭐ | Lösta % | Hjälp % | Drag jämfört med optimalt
// Sorterbar på namn, nivå och uppgifter. Klick på en rad → elevdetaljen
// (teacher-ekvationsresan-elev.js) med räknegången och "Ändra nivå".
// Ovanför tabellen: "Ändra nivå för hela klassen" (Läsresans nivåstyrning, #506).
//
// KVOT (#114/#231): tabellen läser BARA elevernas progressdokument
// (ekvationsresa/progress, ett per elev, en gång) – sammanfattningen räknas
// ur det (teacherSummary). Försöken hämtas först när läraren öppnar EN elev.
//
// Laddas DYNAMISKT från teacher-class.js – aldrig i app.js bootgraf (#271).
// Datakällorna kan injiceras (preview/preview-ekvationsresan-larare.html).
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc, emptyState, icon } from "./teacher-shared.js";
import { KOLUMNER, NIVAER, NIVA_FEL, TREND, dragText, klassBekraftelse, klassResultat, klassRader,
  klassSummering, nastaSortering, sorteraRader, tolkaNiva } from "./ekvationsresan/larare.js";
import { confirmDialog } from "./teacher-lasresan-niva.js";
import { openEkvationsresanDetail } from "./teacher-ekvationsresan-elev.js";

const lazy = (name) => async (...args) => (await import("./ekvationsresan/ekv-data.js"))[name](...args);
/** Standardbryggan (Firestore), laddad först när den behövs. Kan injiceras. */
export const DEFAULT_EKV_API = {
  loadClass: lazy("getClassEkvationsresa"),
  loadAttempts: lazy("listAttempts"),
  setStudentLevel: lazy("setStudentLevel"),
  setClassLevel: lazy("setClassLevel"),
};

/** Lärarvyns egna stilar (dynamiska, som spelets ekvationsresan.css). */
export function loadTeacherCss() {
  if (typeof document === "undefined" || document.querySelector("link[data-ekt-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./ekvationsresan/larare.css", import.meta.url).href;
  link.dataset.ektCss = "1";
  const p = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
  });
  document.head.appendChild(link);
  return p;
}

let lastSort = { key: "namn", dir: "asc" };
const dash = `<span class="lrt-dash" aria-label="inget än">–</span>`;
const nivaOptions = (sel) => NIVAER.map((n) => `<option value="${n.level}"${n.level === sel ? " selected" : ""}>Nivå ${n.level} – ${esc(n.name)}</option>`).join("");

/** Stjärnfördelningen ⭐⭐⭐ / ⭐⭐ / ⭐ (antal uppgifter). */
export const starsCell = (s) =>
  `<span class="ekt-stars" title="${s.three} med ⭐⭐⭐, ${s.two} med ⭐⭐, ${s.one} med ⭐, ${s.none} ej lösta">${s.three}<span class="lrt-of"> / </span>${s.two}<span class="lrt-of"> / </span>${s.one}</span>`;

function rowHtml(r, student) {
  const name = student ? student.namn || student.username || r.studentId : r.namn;
  const t = TREND[r.trend] || TREND.flat;
  const s = r.started && r.tasks > 0;
  const drag = dragText(r.extraMoves);
  return `<tr class="lrt-row${r.started ? "" : " lrt-not-started"}" data-student="${esc(r.studentId)}" tabindex="0"
      role="button" title="Klicka för Ekvationsresan om ${esc(name)}">
    <th class="lrt-name" scope="row">
      <span class="cx-avatar">${avatarEmoji(student && student.avatarId)}</span>
      <span class="lrt-name-txt">${esc(name)}</span>
      ${r.started ? "" : `<span class="lrt-badge">ej börjat</span>`}
    </th>
    <td class="lrt-num"><span class="lrt-lvl${r.started ? "" : " start"}">${r.level}</span></td>
    <td class="lrt-num ekt-trend ekt-trend--${s ? r.trend : "tom"}" title="${s ? esc(t.text) : "inga uppgifter än"}">${s ? t.sym : dash}</td>
    <td class="lrt-num">${r.started ? r.tasks : dash}</td>
    <td class="lrt-num">${s ? starsCell(r.stars) : dash}</td>
    <td class="lrt-num">${r.solvedPct == null ? dash : `${r.solvedPct}%`}</td>
    <td class="lrt-num">${r.helpPct == null ? dash : `${r.helpPct}%`}</td>
    <td class="lrt-num" title="${drag == null ? "" : "extra drag per löst uppgift"}">${drag == null ? dash : esc(drag)}</td>
  </tr>`;
}

function headHtml(sort) {
  return `<tr>${KOLUMNER.map((c) => {
    if (!c.sort) return `<th scope="col" class="lrt-th${c.num ? " lrt-num" : ""}">${esc(c.label)}</th>`;
    const active = sort.key === c.key;
    const aria = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "↕";
    return `<th scope="col" class="lrt-th${c.num ? " lrt-num" : ""}${active ? " active" : ""}" aria-sort="${aria}">
      <button type="button" class="lrt-sort" data-key="${c.key}"><span>${esc(c.label)}</span><span class="lrt-arrow" aria-hidden="true">${arrow}</span></button>
    </th>`;
  }).join("")}</tr>`;
}

function summaryHtml(rows) {
  const s = klassSummering(rows);
  const span = s.levelMin == null ? "" : s.levelMin === s.levelMax ? `nivå ${s.levelMin}` : `nivå ${s.levelMin}–${s.levelMax}`;
  return `<div class="lrt-summary">
    <span><b>${s.started}</b> av ${s.total} elever har börjat</span>
    <span><b>${s.tasks}</b> uppgifter</span>
    ${span ? `<span>Eleverna är på <b>${span}</b></span>` : ""}
  </div>`;
}

/** Kortet "Ändra nivå för hela klassen" (Läsresans UX: klassväljare, nivå, bekräftelse). */
function renderClassLevel(host, { cls, classes, studentById, api, onChanged }) {
  const all = (Array.isArray(classes) && classes.length ? classes : [cls]).filter(Boolean);
  if (!all.some((c) => c.id === cls.id)) all.unshift(cls);
  const nameOf = (c) => c.name || c.id;
  const studentName = (id) => (studentById?.get(id)?.namn || studentById?.get(id)?.username || id);
  const card = el(`<section class="lrn-panel ekt-panel" aria-label="Nivåstyrning för Ekvationsresan">
    <div class="lrn-card">
      <h4 class="lrn-card-title">${icon("users", 16)}<span>Ändra nivå för hela klassen</span></h4>
      <p class="lrn-what">Ändrar <b>även elever som redan är igång</b>. Fönstret med senaste resultat nollställs och
        eleven får en ny uppgift på nivån. Statistik och mynt finns kvar.</p>
      <div class="lrn-row">
        <label for="ekt-klass">Klass</label>
        <select id="ekt-klass" class="ekt-class-sel">${all.map((c) => `<option value="${esc(c.id)}"${c.id === cls.id ? " selected" : ""}>${esc(nameOf(c))}</option>`).join("")}</select>
        <label for="ekt-niva">Nivå</label>
        <select id="ekt-niva" class="ekt-class-lvl">${nivaOptions(1)}</select>
        <button type="button" class="btn small ekt-class-go">Ändra nivå för klassen…</button>
      </div>
      <div class="lrn-msg" role="status" aria-live="polite"></div>
    </div>
  </section>`);
  const msg = card.querySelector(".lrn-msg");
  const say = (kind, lines) => (msg.innerHTML = `<div class="msg ${kind}">${lines.map(esc).join("<br>")}</div>`);
  const btn = card.querySelector(".ekt-class-go");
  btn.addEventListener("click", async () => {
    const target = all.find((c) => c.id === card.querySelector(".ekt-class-sel").value) || cls;
    const level = tolkaNiva(card.querySelector(".ekt-class-lvl").value);
    if (level === null) return say("error", [NIVA_FEL]);
    const ids = [...new Set((target.studentIds || []).filter((id) => typeof id === "string" && id && (!studentById || studentById.has(id))))];
    if (!ids.length) return say("warn", [`${nameOf(target)} har inga elever.`]);
    msg.innerHTML = "";
    if (!(await confirmDialog(klassBekraftelse({ className: nameOf(target), count: ids.length, level })))) return;
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Sparar…";
    try {
      const { ok, lines } = klassResultat(await api.setClassLevel(ids, level), nameOf(target), studentName);
      say(ok ? "ok" : "warn", [`${ok ? "✓ " : ""}${lines[0]}`, ...lines.slice(1)]);
      if (target.id === cls.id) onChanged();
    } catch (err) {
      say("error", [`Kunde inte ändra nivån: ${err.message}`]);
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  });
  host.replaceChildren(card);
}

/**
 * Rita klassens Ekvationsresan-översikt in i `host`.
 * @param {object} ctx
 * @param {HTMLElement} host
 * @param {{ students: object[], cls?: object, classes?: object[], studentById?: Map,
 *   api?: typeof DEFAULT_EKV_API }} opts
 */
export async function renderClassEkvationsresan(ctx, host, opts = {}) {
  const { students, cls, classes, studentById, api = DEFAULT_EKV_API } = opts;
  const list = Array.isArray(students) ? students : [];
  if (!list.length) {
    host.replaceChildren(emptyState(ctx, { icon: "users", title: "Klassen har inga elever än",
      text: "Lägg till elever på klasskortet (Elever) så syns deras ekvationer här." }));
    return;
  }
  host.replaceChildren(el(`<div class="spinner">Laddar Ekvationsresan…</div>`));
  let entries;
  try {
    [entries] = await Promise.all([api.loadClass(list.map((s) => s.id)), loadTeacherCss()]);
  } catch (err) {
    host.replaceChildren(el(`<div class="msg error">Kunde inte ladda Ekvationsresan: ${esc(err.message)}</div>`));
    return;
  }
  const byId = new Map(list.map((s) => [s.id, s]));
  const progressById = new Map((entries || []).map((e) => [e.studentId, e.progress || null]));
  let rows = [];
  let rowById = new Map();
  const buildRows = () => {
    rows = klassRader(list.map((s) => ({ studentId: s.id, namn: s.namn || s.username || s.id, progress: progressById.get(s.id) || null })));
    rowById = new Map(rows.map((r) => [r.studentId, r]));
  };
  buildRows();

  const off = cls && !(Array.isArray(cls.enabledModules) && cls.enabledModules.includes("ekvationsresan"));
  const view = el(`<div class="lrt-teacher ekt-teacher">
    <div class="lrt-intro">
      <h3 class="subhead lrt-title">${icon("sliders", 18)}<span>Ekvationsresan</span></h3>
      ${summaryHtml(rows)}
    </div>
    ${off ? `<p class="msg warn ekt-off">Ekvationsresan är avstängd för ${esc(cls.name || "klassen")} – slå på den under Synliga moduler så ser eleverna den.</p>` : ""}
    <div class="ekt-level-host"></div>
    <div class="table-scroll">
      <table class="tbl lrt-tbl ekt-tbl"><thead></thead><tbody></tbody></table>
    </div>
    <div class="cx-legend lrt-legend">
      <span class="cx-legend-item">Trend ↗ → ↘ ur de senaste uppgifterna</span>
      <span class="cx-legend-item">Hjälp % = uppgifter där 💡 användes</span>
      <span class="cx-legend-item">Drag = extra drag per löst uppgift jämfört med optimalt</span>
      <span class="cx-legend-tip">Klicka på en elev för räknegången${cls ? " och för att ändra elevens nivå" : ""}</span>
    </div>
  </div>`);
  const thead = view.querySelector("thead");
  const tbody = view.querySelector("tbody");
  const draw = () => {
    view.querySelector(".lrt-summary").outerHTML = summaryHtml(rows);
    thead.innerHTML = headHtml(lastSort);
    tbody.innerHTML = sorteraRader(rows, lastSort.key, lastSort.dir).map((r) => rowHtml(r, byId.get(r.studentId))).join("");
  };
  thead.addEventListener("click", (e) => {
    const b = e.target.closest(".lrt-sort");
    if (!b) return;
    lastSort = nastaSortering(lastSort, b.dataset.key);
    draw();
    thead.querySelector(`.lrt-sort[data-key="${lastSort.key}"]`)?.focus();
  });

  const reload = async (ids = list.map((s) => s.id)) => {
    const fresh = await api.loadClass(ids);
    ids.forEach((id) => progressById.set(id, null));
    (fresh || []).forEach((e) => progressById.set(e.studentId, e.progress || null));
    buildRows();
    draw();
  };
  if (cls) {
    renderClassLevel(view.querySelector(".ekt-level-host"), { cls, classes, studentById: studentById || byId, api,
      onChanged: () => reload().catch((err) => console.warn("[Ekvationsresan] kunde inte läsa om tabellen", err)) });
  }

  const open = (tr) => {
    const id = tr?.dataset.student;
    const student = byId.get(id);
    if (!student) return;
    openEkvationsresanDetail(student, {
      row: rowById.get(id),
      progress: progressById.get(id) || null,
      api,
      canSetLevel: !!cls,
      reload: async () => {
        await reload([id]);
        return { row: rowById.get(id), progress: progressById.get(id) || null };
      },
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
