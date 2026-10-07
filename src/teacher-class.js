// ============================================================================
// Pluggporten – lärarsidan: klassens framstegsmatris (teacher-class.js)
// ----------------------------------------------------------------------------
// Framstegsstatistiken för EN klass. Underflikar ur STATS_TABS: Ämnen (matrisen
// nedan), Per område (#446, teacher-plugga.js) och Läsresan (#402). Matrisen:
// elever (rader) mot arbetsområden (kolumner) för ett valt ämne. Varje cell visar intjänade
// stjärnor / möjliga stjärnor för området, och en summakolumn visar total
// progress per elev så man snabbt ser vem som ligger efter/före.
//
// Tidigare en egen flik/sida (#/larare/klass). Från issue #299 är statistiken
// SAMMANSLAGEN med Klasser & elever – den renderas som en 📊-expander per
// klasskort (teacher-classes.js), så lärarsidan har EN klass-flik i stället för
// två. Matrisen exponeras därför som en återanvändbar renderare, `renderClassStats`,
// som får klassens elever + ämnen + en loadAreas-hämtare och ritar in matrisen i
// ett värd-element. Läs-endast; ingen data ändras här.
//
// Progress läses per elev via data.getProgress(studentId) – EN gång per klass,
// delad mellan underflikarna i STATS_TABS (#446). Formen är:
//   progress[areaId][gamemode] = { completed, bestScore, stars, lastPlayed }
// (se data.js). Max 3 stjärnor per gamemode. Ett områdes möjliga stjärnor =
// områdets stjärn-lägen (areaStarModes, #467 – samma som elevpanelen) × 3.
// ============================================================================

import * as data from "./data.js";
import { avatarEmoji } from "./avatars.js";
import { el, esc, emptyState, icon } from "./teacher-shared.js";
import { MAX_STARS_PER_MODE, areaModes, areaEarned, progressLevel } from "./teacher-class-stats.js";
import { openStudentDetail } from "./teacher-class-detail.js";

/** Cellens innehåll för en elev × ett område. */
function cellHtml(earned, maxStars) {
  if (maxStars === 0) {
    return `<td class="cx tom" title="Området saknar övningar än"><span class="cx-empty">–</span></td>`;
  }
  if (earned.played === 0) {
    return `<td class="cx tom"><span class="cx-empty">ej börjat</span></td>`;
  }
  const ratio = maxStars > 0 ? earned.stars / maxStars : 0;
  const pct = Math.round(ratio * 100);
  const lvl = progressLevel(ratio);
  return `<td class="cx ${lvl}" title="${earned.stars} av ${maxStars} stjärnor · ${earned.completed} avklarade övningar">
    <span class="cx-stars">${earned.stars}<span class="cx-slash">/${maxStars}</span> ★</span>
    <span class="cx-bar"><span class="cx-bar-fill" style="width:${pct}%"></span></span>
  </td>`;
}

/**
 * Rita klassens framstegsmatris in i `host`. Återanvänds av 📊-expandern på ett
 * klasskort (issue #299). Elevernas progress hämtas EN gång (delas mellan
 * ämnesbyten) och arbetsområdena cachas per ämne.
 *
 * @param {object} ctx  lärar-context (för emptyState-länkar / elev-fördjupning)
 * @param {HTMLElement} host  värd-element att fylla
 * @param {{
 *   students: object[],                 // klassens elever (redan sorterade)
 *   subjects: object[],                 // ämneslistan
 *   studentById?: Map,                  // id → elev (för elev-fördjupningen)
 *   loadAreas: (subjectId:string) => Promise<object[]>  // områden per ämne (helst cachad)
 *   classId?: string                    // klassen – ger flikarna Mattematchen (#459) och Live (#460)
 * }} opts
 */
export async function renderClassStats(ctx, host, opts) {
  // Underflikar ur STATS_TABS (#402 Läsresan, #446 Per område, #459 Mattematchen,
  // #460 Live). `when` döljer flikar som kräver t.ex. classId. Elevernas
  // progress läses EN gång och delas mellan flikarna (kvot-regeln #114).
  let progressPromise = null;
  const loadProgress = () => (progressPromise ||= loadClassProgress(opts.students));
  const tabOpts = { ...opts, loadProgress };
  const tabs = STATS_TABS.filter((t) => !t.when || t.when(opts));
  const view = el(`<div class="stats-tabs-wrap">
    <div class="stats-tabs" role="tablist" aria-label="Statistik">${tabs.map(
      (t) => `<button type="button" class="stats-tab" role="tab" data-tab="${t.key}">${icon(t.icon, 16)}<span>${esc(t.label)}</span></button>`
    ).join("")}</div>
    ${tabs.map((t) => `<div class="stats-pane" data-pane="${t.key}" hidden></div>`).join("")}
  </div>`);
  host.replaceChildren(view);
  const rendered = new Set();
  const show = (key) => {
    const tab = tabs.find((t) => t.key === key) || tabs[0];
    lastStatsTab = tab.key;
    view.querySelectorAll(".stats-tab").forEach((b) => {
      const on = b.dataset.tab === tab.key;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    view.querySelectorAll(".stats-pane").forEach((p) => (p.hidden = p.dataset.pane !== tab.key));
    if (rendered.has(tab.key)) return;
    rendered.add(tab.key);
    const pane = view.querySelector(`[data-pane="${tab.key}"]`);
    if (!tab.lazy) return tab.render(ctx, pane, tabOpts);
    pane.replaceChildren(el(`<div class="spinner">Laddar ${esc(tab.what)}…</div>`));
    return Promise.resolve()
      .then(() => tab.render(ctx, pane, tabOpts))
      .catch((err) => {
        rendered.delete(tab.key);
        pane.replaceChildren(el(`<div class="msg error">Kunde inte ladda ${esc(tab.what)}: ${esc(err.message)}</div>`));
      });
  };
  view.querySelectorAll(".stats-tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));
  await show((lastStatsTab === "live" || lastStatsTab === "mattematchen") && !opts.classId ? "amnen" : lastStatsTab);
}

/** Elev-id → progress för klassens elever (en läsning per elev; fel → {}). */
async function loadClassProgress(students) {
  const list = students || [];
  const results = await Promise.all(list.map((s) => data.getProgress(s.id).catch(() => ({}))));
  return new Map(list.map((s, i) => [s.id, results[i] || {}]));
}

// Statistikens underflikar. `lazy` = modulen laddas med import() vid första
// klick – aldrig i bootgrafen (#271). En ny vy = en rad här.
const STATS_TABS = [
  { key: "amnen", label: "Ämnen", icon: "chart", render: (ctx, pane, o) => renderSubjectStats(ctx, pane, o) },
  {
    key: "omraden", label: "Per område", icon: "pin", what: "resultat per område", lazy: true,
    // #446: klasstabell per ämne/område + djupdykning per frågekategori.
    render: async (ctx, pane, o) => (await import("./teacher-plugga.js")).renderClassPlugga(ctx, pane, o),
  },
  {
    key: "lasresan", label: "Läsresan", icon: "book", what: "Läsresan", lazy: true,
    render: async (ctx, pane, o) =>
      (await import("./teacher-lasresan.js")).renderClassLasresan(ctx, pane, { students: o.students }),
  },
  {
    key: "mattematchen", label: "Mattematchen", icon: "trophy", what: "Mattematchen", lazy: true,
    when: (o) => !!o.classId,
    // #459: välj period → klassens tabell.
    render: async (ctx, pane, o) =>
      (await import("./tavling/teacher-mm-stats.js")).renderClassMattematchen(ctx, pane, { classId: o.classId, students: o.students }),
  },
  {
    key: "live", label: "Live", icon: "bolt", what: "Live", lazy: true,
    when: (o) => !!o.classId,
    // #460: klassens Live-matcher + elevernas summa.
    render: async (ctx, pane, o) =>
      (await import("./live/teacher-live-history.js")).renderClassLiveStats(ctx, pane, { classId: o.classId, students: o.students }),
  },
];

// Senast valda statistikflik (delas mellan klasskort under sessionen).
let lastStatsTab = "amnen";

/** Ämnesfliken: klassens stjärnmatris (elever × arbetsområden). */
async function renderSubjectStats(ctx, host, { students, subjects, studentById, loadAreas, loadProgress, cls }) {
  students = (students || [])
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));
  const byId = studentById || new Map(students.map((s) => [s.id, s]));

  if (students.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        emoji: "🧑‍🎓",
        title: "Klassen har inga elever än",
        text: "Lägg till elever under fliken Elever så syns deras framsteg här.",
      })
    );
    return;
  }
  if (!subjects || subjects.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        emoji: "📚",
        title: "Inga ämnen än",
        text: "Lägg in ditt första arbetsområde så dyker klassens framsteg upp här.",
        actionLabel: "Lägg in innehåll",
        actionHash: "#/larare/innehall",
      })
    );
    return;
  }

  // Valt ämne: SO först om det finns, annars första.
  let selectedSubject = subjects.find((s) => s.id === "so")?.id || subjects[0]?.id || null;

  const view = el(`<div>
    <div class="field" style="max-width:320px">
      <label for="stats-subject">Ämne</label>
      <select id="stats-subject" class="select"></select>
    </div>
    <div class="stats-matrix"><div class="spinner">Laddar framsteg…</div></div>
  </div>`);
  const subjectSel = view.querySelector("#stats-subject");
  const matrixEl = view.querySelector(".stats-matrix");
  subjectSel.innerHTML = subjects
    .map(
      (s) =>
        `<option value="${esc(s.id)}"${s.id === selectedSubject ? " selected" : ""}>${esc(s.name || s.id)}</option>`
    )
    .join("");
  host.replaceChildren(view);

  // Klassens progress (EN läsning per elev, delad med övriga underflikar).
  let progressByStudent;
  try {
    progressByStudent = await loadProgress();
  } catch (err) {
    matrixEl.replaceChildren(
      el(`<div class="msg error">Kunde inte ladda elevernas framsteg: ${esc(err.message)}</div>`)
    );
    return;
  }

  async function renderMatrix() {
    matrixEl.replaceChildren(el(`<div class="spinner">Laddar arbetsområden…</div>`));
    let areas = [];
    try {
      areas = await loadAreas(selectedSubject);
    } catch (err) {
      matrixEl.replaceChildren(
        el(`<div class="msg error">Kunde inte ladda arbetsområden: ${esc(err.message)}</div>`)
      );
      return;
    }
    if (areas.length === 0) {
      matrixEl.replaceChildren(
        emptyState(ctx, {
          emoji: "📖",
          title: "Ämnet har inga arbetsområden än",
          text: "Lägg in innehåll i ämnet så visas elevernas stjärnor per område.",
          actionLabel: "Lägg in innehåll",
          actionHash: "#/larare/innehall",
        })
      );
      return;
    }

    // Stjärn-lägena per område (areaStarModes, #467): samma lägen för möjligt
    // OCH intjänat, med klassens dolda lägen invägda → aldrig över 100 %.
    const areaStar = areas.map((a) => areaModes(a, cls).map((m) => m.id));
    const areaMax = areaStar.map((ids) => ids.length * MAX_STARS_PER_MODE);
    const subjectMaxStars = areaMax.reduce((sum, m) => sum + m, 0);

    const headCols = areas
      .map(
        (a, i) =>
          `<th class="cx-head" title="${esc(a.name || a.id)}${areaMax[i] === 0 ? " (inga övningar än)" : ""}">
            <span class="cx-head-emoji">${esc(a.coverEmoji || "📖")}</span>
            <span class="cx-head-name">${esc(a.name || a.id)}</span>
          </th>`
      )
      .join("");

    const bodyRows = students
      .map((s) => {
        const progress = progressByStudent.get(s.id) || {};
        let earnedTotal = 0;
        const cells = areas
          .map((a, i) => {
            const earned = areaEarned(progress, a.id, areaStar[i]);
            earnedTotal += earned.stars;
            return cellHtml(earned, areaMax[i]);
          })
          .join("");

        const totRatio = subjectMaxStars > 0 ? earnedTotal / subjectMaxStars : 0;
        const totPct = Math.round(totRatio * 100);
        const totLvl = progressLevel(totRatio);
        return `<tr class="cx-row" data-student="${esc(s.id)}" tabindex="0" role="button"
            title="Klicka för fördjupad statistik om ${esc(s.namn || s.username || s.id)}">
          <th class="cx-name" scope="row">
            <span class="cx-avatar">${avatarEmoji(s.avatarId)}</span>
            <span class="cx-name-txt">${esc(s.namn || s.username || s.id)}</span>
            <span class="cx-row-more" aria-hidden="true">›</span>
          </th>
          ${cells}
          <td class="cx-total ${totLvl}" title="${earnedTotal} av ${subjectMaxStars} möjliga stjärnor">
            <span class="cx-total-pct">${totPct}%</span>
            <span class="cx-total-stars">${earnedTotal}/${subjectMaxStars} ★</span>
          </td>
        </tr>`;
      })
      .join("");

    const table = el(`<div class="table-scroll">
      <table class="tbl class-tbl">
        <thead>
          <tr>
            <th class="cx-corner">Elev</th>
            ${headCols}
            <th class="cx-total-head">Totalt</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`);

    const legend = el(`<div class="cx-legend">
      <span class="cx-legend-item"><span class="cx-dot hog"></span>Ligger bra till</span>
      <span class="cx-legend-item"><span class="cx-dot mellan"></span>På gång</span>
      <span class="cx-legend-item"><span class="cx-dot lag"></span>Precis börjat</span>
      <span class="cx-legend-item"><span class="cx-dot tom"></span>Ej börjat</span>
      <span class="cx-legend-tip">💡 Klicka på en elev för fördjupad statistik</span>
    </div>`);

    const openRow = (tr) => {
      const s = byId.get(tr.dataset.student);
      if (s) openStudentDetail(s, progressByStudent.get(s.id) || {}, subjects, loadAreas, cls);
    };
    table.querySelectorAll("tr.cx-row").forEach((tr) => {
      tr.addEventListener("click", () => openRow(tr));
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRow(tr);
        }
      });
    });

    matrixEl.replaceChildren(table, legend);
  }

  subjectSel.addEventListener("change", () => {
    selectedSubject = subjectSel.value;
    renderMatrix();
  });

  await renderMatrix();
}
