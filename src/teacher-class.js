// ============================================================================
// Pluggportalen – lärarsidan: klassöversikt (teacher-class.js)
// ----------------------------------------------------------------------------
// #/larare/klass: läs-endast dashboard där läraren ser hur långt varje elev
// kommit. En matris med elever (rader) mot arbetsområden (kolumner) för ett
// valt ämne. Varje cell visar intjänade stjärnor / möjliga stjärnor för
// området, och en summakolumn visar total progress per elev så man snabbt ser
// vem som ligger efter/före. Ingen data ändras här.
//
// Progress läses per elev via data.getProgress(studentId). Formen är:
//   progress[areaId][gamemode] = { completed, bestScore, stars, lastPlayed }
// (se data.js). Max 3 stjärnor per gamemode. Ett områdes möjliga stjärnor =
// antal tillgängliga gamemodes (utifrån quiz/pairs-innehåll) × 3.
// ============================================================================

import * as data from "./data.js";
import { avatarEmoji } from "./avatars.js";
import {
  el,
  esc,
  isTeacher,
  teacherNav,
  teacherHead,
  emptyState,
  renderGate,
} from "./teacher-shared.js";
import { areaMaxStars, areaEarned, progressLevel } from "./teacher-class-stats.js";
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

export async function pageLarareKlass(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klassöversikt…</div>`));

  // 1) Ämnen + elever parallellt.
  let subjects = [];
  let students = [];
  try {
    [subjects, students] = await Promise.all([data.getSubjects(), data.getStudents()]);
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda översikten: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  students = students
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));

  // Valt ämne: SO först om det finns, annars första.
  let selectedSubject = subjects.find((s) => s.id === "so")?.id || subjects[0]?.id || null;

  const container = el(`<div class="teacher-page"></div>`);
  container.appendChild(teacherNav(ctx, "klass"));
  container.appendChild(
    teacherHead(ctx, {
      emoji: "📊",
      title: "Klassöversikt",
      lead: `Se hur långt varje elev kommit. Varje cell visar intjänade stjärnor av
        möjliga för arbetsområdet (max 3 per övning), och <b>Totalt</b> summerar elevens
        framsteg. <b>Klicka på en elev</b> för fördjupad statistik. Läs-endast – inget ändras här.`,
    })
  );

  const view = el(`<div>
    <div class="panel">
      <div class="field" id="subject-field">
        <label for="klass-subject">Ämne</label>
        <select id="klass-subject" class="select"></select>
      </div>
      <div id="matrix"><div class="spinner">Laddar framsteg…</div></div>
    </div>
  </div>`);

  container.appendChild(view);
  ctx.app.replaceChildren(container);

  const subjectSel = view.querySelector("#klass-subject");
  const matrixEl = view.querySelector("#matrix");

  if (subjects.length === 0) {
    view.querySelector("#subject-field").style.display = "none";
    matrixEl.replaceChildren(
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

  subjectSel.innerHTML = subjects
    .map((s) => `<option value="${esc(s.id)}" ${s.id === selectedSubject ? "selected" : ""}>${esc(s.name || s.id)}</option>`)
    .join("");

  // Ladda alla elevers progress EN gång (delas mellan ämnesbyten).
  matrixEl.replaceChildren(el(`<div class="spinner">Laddar framsteg för ${students.length} elever…</div>`));
  let progressByStudent;
  try {
    const results = await Promise.all(
      students.map((s) =>
        data.getProgress(s.id).catch(() => ({})) // en trasig elev ska inte fälla hela vyn
      )
    );
    progressByStudent = new Map(students.map((s, i) => [s.id, results[i] || {}]));
  } catch (err) {
    matrixEl.replaceChildren(
      el(`<div class="msg error">Kunde inte ladda elevernas framsteg: ${esc(err.message)}</div>`)
    );
    return;
  }

  // Arbetsområden cachas per ämne så matris-byten och elev-fördjupningen delar
  // samma läsningar (läraren är läs-endast, så det är säkert att memoisera).
  const areasCache = new Map();
  function loadAreas(subjectId) {
    if (!areasCache.has(subjectId)) {
      areasCache.set(
        subjectId,
        data.getAreas(subjectId).catch(() => [])
      );
    }
    return areasCache.get(subjectId);
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

    if (students.length === 0) {
      matrixEl.replaceChildren(
        emptyState(ctx, {
          emoji: "🧑‍🎓",
          title: "Inga elevkonton än",
          text: "Lägg in en klass med elevkonton så kan du följa deras framsteg här.",
          actionLabel: "Lägg in elevkonton",
          actionHash: "#/larare/elever",
        })
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

    const areaMax = areas.map((a) => areaMaxStars(a));
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
            const earned = areaEarned(progress, a.id);
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

    // Klick (eller Enter/mellanslag) på en elevrad → fördjupad per-elev-vy.
    const studentById = new Map(students.map((s) => [s.id, s]));
    const openRow = (tr) => {
      const s = studentById.get(tr.dataset.student);
      if (s) openStudentDetail(s, progressByStudent.get(s.id) || {}, subjects, loadAreas);
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
