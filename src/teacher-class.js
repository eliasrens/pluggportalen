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
import { GAMEMODES } from "./game-shared.js";
import { avatarEmoji } from "./avatars.js";
import { el, esc, isTeacher, teacherNav, renderGate } from "./teacher-shared.js";

const MAX_STARS_PER_MODE = 3;

/** Antal möjliga stjärnor för ett område = tillgängliga gamemodes × 3. */
function areaMaxStars(area) {
  const hasQuiz = Array.isArray(area.quiz) && area.quiz.length > 0;
  const hasPairs = Array.isArray(area.pairs) && area.pairs.length > 0;
  let modes = 0;
  for (const gm of GAMEMODES) {
    if (gm.needs === "quiz" && hasQuiz) modes++;
    else if (gm.needs === "pairs" && hasPairs) modes++;
  }
  return modes * MAX_STARS_PER_MODE;
}

/** Sammanställ en elevs progress för ett område ur progress-objektet. */
function areaEarned(progress, areaId) {
  const modes = (progress && progress[areaId]) || {};
  let stars = 0;
  let completed = 0;
  let played = 0;
  for (const result of Object.values(modes)) {
    if (!result) continue;
    played++;
    if (typeof result.stars === "number") stars += Math.min(MAX_STARS_PER_MODE, result.stars);
    if (result.completed) completed++;
  }
  return { stars, completed, played };
}

/** Progress-klass (färg) utifrån andel intjänade stjärnor. */
function progressLevel(ratio) {
  if (ratio >= 0.67) return "hog";
  if (ratio >= 0.34) return "mellan";
  if (ratio > 0) return "lag";
  return "tom";
}

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

  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "klass"));

  const view = el(`<div>
    <div class="panel">
      <div class="panel-head">
        <h1>Klassöversikt 📊</h1>
      </div>
      <p class="hint">Se hur långt varje elev kommit. Varje cell visar intjänade stjärnor av
        möjliga för arbetsområdet (max 3 per övning), och <b>Totalt</b> summerar elevens
        framsteg. Läs-endast – inget ändras här.</p>
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
      el(`<p class="hint">Det finns inga ämnen än. Lägg in innehåll under
        <a data-hash="#/larare/innehall">Innehåll</a> först.</p>`)
    );
    wireHashLinks(ctx, matrixEl);
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

  async function renderMatrix() {
    matrixEl.replaceChildren(el(`<div class="spinner">Laddar arbetsområden…</div>`));
    let areas = [];
    try {
      areas = await data.getAreas(selectedSubject);
    } catch (err) {
      matrixEl.replaceChildren(
        el(`<div class="msg error">Kunde inte ladda arbetsområden: ${esc(err.message)}</div>`)
      );
      return;
    }

    if (students.length === 0) {
      matrixEl.replaceChildren(
        el(`<p class="hint">Det finns inga elevkonton än. Lägg in en klass under
          <a data-hash="#/larare/elever">Elevkonton</a>.</p>`)
      );
      wireHashLinks(ctx, matrixEl);
      return;
    }
    if (areas.length === 0) {
      matrixEl.replaceChildren(
        el(`<p class="hint">Ämnet har inga arbetsområden än. Lägg in innehåll under
          <a data-hash="#/larare/innehall">Innehåll</a>.</p>`)
      );
      wireHashLinks(ctx, matrixEl);
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
        return `<tr>
          <th class="cx-name" scope="row">
            <span class="cx-avatar">${avatarEmoji(s.avatarId)}</span>
            <span class="cx-name-txt">${esc(s.namn || s.username || s.id)}</span>
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
    </div>`);

    matrixEl.replaceChildren(table, legend);
  }

  subjectSel.addEventListener("change", () => {
    selectedSubject = subjectSel.value;
    renderMatrix();
  });

  await renderMatrix();
}

/** Koppla data-hash-länkar (interna navigeringar) i ett element. */
function wireHashLinks(ctx, root) {
  root.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.go(a.dataset.hash);
    })
  );
}
