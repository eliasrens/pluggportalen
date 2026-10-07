// ============================================================================
// Pluggporten – lärarsidan: Plugga per område (teacher-plugga.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #446: underfliken "Per område" i klassdetaljens Statistik-
// sektion (STATS_TABS i teacher-class.js). Läraren väljer ämne + arbetsområde
// (eller hela ämnet) och ser hela klassen i EN sorterbar tabell:
//   Elev | Genomförda | Rätt % | Stjärnor (av möjliga) | Senast aktiv | Kategorier
// Kategori-kolumnen är kompakta mini-staplar (rätt-% per frågekategori). Klick
// på en rad → djupdykningen per kategori (teacher-plugga-elev.js).
//
// All statistik kommer ur läs-API:t summarizeClass (plugga-stats.js, #445).
// Stjärnor: starScope (teacher-class-stats.js) – områdenas stjärn-lägen
// (areaStarModes, #467) med klassens dolda lägen invägda. Intjänat och möjligt
// räknas över SAMMA lägen som elevpanelen och fliken Ämnen → aldrig över 100 %.
//
// KVOT (#114): progress läses EN gång per elev via `loadProgress` (delas med
// matrisen i teacher-class.js); ämnes-/områdesbyten läser inget nytt.
// Laddas DYNAMISKT från teacher-class.js – aldrig i bootgrafen (#271).
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc, emptyState, icon } from "./teacher-shared.js";
import { starScope } from "./teacher-class-stats.js";
import { summarizeClass } from "./plugga-stats.js";
import { QUESTION_CATEGORIES } from "./question-categories.js";
import {
  PLUGGA_COLUMNS,
  lastActiveText,
  nextPluggaSort,
  pctLevel,
  pluggaTeacherRows,
  sortPluggaRows,
} from "./plugga-teacher-rows.js";
import { openPluggaDetail } from "./teacher-plugga-elev.js";

// Senaste val delas mellan klasser under sessionen (bekvämt vid klassbyte).
let lastSort = { key: "namn", dir: "asc" };
let lastSubject = null;
let lastArea = ""; // "" = hela ämnet

const dash = `<span class="lrt-dash" aria-label="inget än">–</span>`;

/** Kompakta mini-staplar: en per kategori, höjd = rätt-%. */
export function miniBarsHtml(row) {
  if (!row.hasCategoryData) {
    const why = row.active ? "Inga kategoriserade frågor besvarade i urvalet" : "Har inte spelat i urvalet";
    return `<span class="pp-minibars none" title="${esc(why)}">${dash}</span>`;
  }
  const bars = row.perCategory
    .map((c) => {
      const has = c.t > 0;
      const h = has ? Math.max(8, c.pct) : 0;
      const tip = has ? `${c.label}: ${c.pct} % rätt (${c.r}/${c.t})` : `${c.label}: inga frågor än`;
      return `<span class="pp-minibar ${has ? pctLevel(c.pct) : "tom"}" title="${esc(tip)}">
        <span style="height:${h}%"></span></span>`;
    })
    .join("");
  const label = row.perCategory
    .filter((c) => c.t > 0)
    .map((c) => `${c.short} ${c.pct} %`)
    .join(", ");
  return `<span class="pp-minibars" role="img" aria-label="${esc(label)}">${bars}</span>`;
}

/** En tabellrad. All elevdata escapas. */
function rowHtml(r, student) {
  const name = student ? student.namn || student.username || r.studentId : r.namn;
  const lp = r.lastPlayed;
  return `<tr class="lrt-row${r.active ? "" : " lrt-not-started"}" data-student="${esc(r.studentId)}" tabindex="0"
      role="button" title="Klicka för resultat per kategori för ${esc(name)}">
    <th class="lrt-name" scope="row">
      <span class="cx-avatar">${avatarEmoji(student && student.avatarId)}</span>
      <span class="lrt-name-txt">${esc(name)}</span>
      ${r.active ? "" : `<span class="lrt-badge">ej börjat</span>`}
    </th>
    <td class="lrt-num" title="${r.plays} spelomgångar">${r.active ? r.completed : dash}</td>
    <td class="lrt-num lrt-pct ${pctLevel(r.pct)}"
      title="${r.answered ? `${r.correct} av ${r.answered} kategoriserade frågor rätt` : "Inga kategoriserade svar"}">${
        r.pct == null ? dash : `${r.pct}%`
      }</td>
    <td class="lrt-num pp-stars">${r.stars}<span class="lrt-of">/${r.possibleStars}</span> ★</td>
    <td class="lrt-num lrt-date" title="${lp ? esc(lp.toLocaleDateString("sv-SE")) : ""}">${
      lp ? esc(lastActiveText(lp)) : dash
    }</td>
    <td class="pp-cats-cell">${miniBarsHtml(r)}</td>
  </tr>`;
}

/** Rubrikrad: sorterbara kolumner + kategori-kolumnen (ikoner över staplarna). */
function headHtml(sort) {
  const cols = PLUGGA_COLUMNS.map((c) => {
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
  const catIcons = QUESTION_CATEGORIES.map(
    (c) => `<span class="pp-minibar-head" title="${esc(c.label)}">${c.icon}</span>`
  ).join("");
  return `<tr>${cols}<th scope="col" class="lrt-th pp-cats-head" title="Rätt-% per frågekategori">
    <span class="pp-cats-lbl">Kategorier</span><span class="pp-minibars head" aria-hidden="true">${catIcons}</span>
  </th></tr>`;
}

/** Klassens summering + kategori-snitt ovanför tabellen. */
function summaryHtml(sum) {
  const t = sum.totals;
  const cats = sum.perCategory
    .filter((c) => c.t > 0)
    .map((c) => `<span class="pp-sum-cat ${pctLevel(c.pct)}">${c.icon} ${esc(c.short)} <b>${c.pct}%</b></span>`)
    .join("");
  return `<div class="lrt-summary">
    <span><b>${sum.activeStudents}</b> av ${sum.students} elever har spelat</span>
    <span><b>${t.completed}</b> klarade övningar</span>
    <span>${t.pct == null ? "Inga kategoriserade svar än" : `<b>${t.pct}%</b> rätt i klassen`}</span>
    ${cats}
  </div>`;
}

/**
 * Rita "Per område"-tabellen in i `host`.
 * @param {object} ctx  lärar-context (emptyState-länkar)
 * @param {HTMLElement} host
 * @param {{
 *   students: object[],                                  // klassens elever
 *   subjects: object[],                                  // ämnen ({ id, name })
 *   loadAreas: (subjectId:string) => Promise<object[]>,  // områden per ämne (cachad)
 *   loadProgress: () => Promise<Map<string, object>>,    // elev-id → progress (EN läsning)
 *   cls?: object,                                        // klassdokumentet (dolda lägen)
 * }} opts
 */
export async function renderClassPlugga(ctx, host, { students, subjects, loadAreas, loadProgress, cls = null }) {
  const list = (students || [])
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));
  if (list.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        icon: "users",
        title: "Klassen har inga elever än",
        text: "Lägg till elever under fliken Elever så syns deras resultat här.",
      })
    );
    return;
  }
  if (!subjects || subjects.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        icon: "book",
        title: "Inga ämnen än",
        text: "Lägg in ditt första arbetsområde så dyker klassens resultat upp här.",
        actionLabel: "Lägg in innehåll",
        actionHash: "#/larare/innehall",
      })
    );
    return;
  }
  const byId = new Map(list.map((s) => [s.id, s]));
  let subjectId = subjects.some((s) => s.id === lastSubject)
    ? lastSubject
    : subjects.find((s) => s.id === "so")?.id || subjects[0].id;

  const view = el(`<div class="lrt-teacher pp-teacher">
    <div class="pp-pickers">
      <div class="field"><label for="pp-subject">Ämne</label><select id="pp-subject" class="select"></select></div>
      <div class="field"><label for="pp-area">Arbetsområde</label><select id="pp-area" class="select"></select></div>
    </div>
    <div class="pp-body"><div class="spinner">Laddar resultat…</div></div>
  </div>`);
  const subjectSel = view.querySelector("#pp-subject");
  const areaSel = view.querySelector("#pp-area");
  const body = view.querySelector(".pp-body");
  subjectSel.innerHTML = subjects
    .map((s) => `<option value="${esc(s.id)}"${s.id === subjectId ? " selected" : ""}>${esc(s.name || s.id)}</option>`)
    .join("");
  host.replaceChildren(view);

  let progressById;
  try {
    progressById = await loadProgress();
  } catch (err) {
    body.replaceChildren(el(`<div class="msg error">Kunde inte ladda elevernas framsteg: ${esc(err.message)}</div>`));
    return;
  }
  const entries = list.map((s) => ({
    studentId: s.id,
    namn: s.namn || s.username || s.id,
    progress: progressById.get(s.id) || {},
  }));

  let areas = [];
  let rows = [];
  let scope = null; // { label, areas } för djupdykningen

  function draw() {
    const thead = body.querySelector("thead");
    const tbody = body.querySelector("tbody");
    if (!thead || !tbody) return;
    thead.innerHTML = headHtml(lastSort);
    tbody.innerHTML = sortPluggaRows(rows, lastSort.key, lastSort.dir)
      .map((r) => rowHtml(r, byId.get(r.studentId)))
      .join("");
  }

  function renderScope() {
    const chosen = lastArea ? areas.filter((a) => a.id === lastArea) : areas;
    const { maxStars, isStarMode } = starScope(chosen, cls);
    const sum = summarizeClass(entries, { areaIds: chosen.map((a) => a.id), isStarMode });
    rows = pluggaTeacherRows(sum.rows, maxStars);
    const subjectName = subjects.find((s) => s.id === subjectId)?.name || subjectId;
    scope = {
      label: lastArea ? `${chosen[0]?.name || lastArea}` : `${subjectName} – alla områden`,
      emoji: lastArea ? chosen[0]?.coverEmoji || "📖" : "📚",
    };
    const noCats = sum.activeStudents > 0 && !sum.totals.hasCategoryData;
    body.innerHTML = `
      ${summaryHtml(sum)}
      ${noCats ? `<p class="pp-note">${icon("sparkle", 14)} Det här urvalet har inga frågor med kategori än – rätt-% och
        kategori-staplar fylls i när eleverna spelar nyare innehåll. Klicka på en elev för resultat per spelläge.</p>` : ""}
      <div class="table-scroll"><table class="tbl lrt-tbl pp-tbl"><thead></thead><tbody></tbody></table></div>
      <div class="cx-legend lrt-legend">
        <span class="cx-legend-item"><span class="cx-dot hog"></span>Minst 67 % rätt</span>
        <span class="cx-legend-item"><span class="cx-dot mellan"></span>34–66 %</span>
        <span class="cx-legend-item"><span class="cx-dot lag"></span>Under 34 %</span>
        <span class="cx-legend-item">${QUESTION_CATEGORIES.map((c) => `${c.icon} ${esc(c.label)}`).join(" · ")}</span>
        <span class="cx-legend-tip">Klicka på en elev för resultat per kategori</span>
      </div>`;
    draw();
  }

  async function loadSubject() {
    body.replaceChildren(el(`<div class="spinner">Laddar arbetsområden…</div>`));
    try {
      areas = (await loadAreas(subjectId)) || [];
    } catch (err) {
      body.replaceChildren(el(`<div class="msg error">Kunde inte ladda arbetsområden: ${esc(err.message)}</div>`));
      return;
    }
    if (!areas.some((a) => a.id === lastArea)) lastArea = "";
    areaSel.innerHTML =
      `<option value="">Alla områden i ämnet</option>` +
      areas
        .map((a) => `<option value="${esc(a.id)}"${a.id === lastArea ? " selected" : ""}>${esc(
          `${a.coverEmoji || "📖"} ${a.name || a.id}`
        )}</option>`)
        .join("");
    areaSel.disabled = areas.length === 0;
    if (areas.length === 0) {
      body.replaceChildren(
        emptyState(ctx, {
          icon: "book",
          title: "Ämnet har inga arbetsområden än",
          text: "Lägg in innehåll i ämnet så visas elevernas resultat här.",
          actionLabel: "Lägg in innehåll",
          actionHash: "#/larare/innehall",
        })
      );
      return;
    }
    renderScope();
  }

  subjectSel.addEventListener("change", () => {
    subjectId = lastSubject = subjectSel.value;
    loadSubject();
  });
  areaSel.addEventListener("change", () => {
    lastArea = areaSel.value;
    renderScope();
  });

  // Sortering + öppna elev: delegerat på body (tabellen ritas om vid byten).
  body.addEventListener("click", (e) => {
    const btn = e.target.closest(".lrt-sort");
    if (btn) {
      lastSort = nextPluggaSort(lastSort, btn.dataset.key);
      draw();
      body.querySelector(`.lrt-sort[data-key="${lastSort.key}"]`)?.focus();
      return;
    }
    open(e.target.closest("tr.lrt-row"));
  });
  body.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tr.lrt-row");
    if (!tr) return;
    e.preventDefault();
    open(tr);
  });
  function open(tr) {
    const id = tr && tr.dataset.student;
    const student = byId.get(id);
    const row = rows.find((r) => r.studentId === id);
    if (student && row) openPluggaDetail(student, { row, scope });
  }

  lastSubject = subjectId;
  await loadSubject();
}
