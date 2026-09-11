// ============================================================================
// Pluggportalen – lärarsidan: klassens framstegsmatris (teacher-class.js)
// ----------------------------------------------------------------------------
// Framstegsstatistiken för EN klass: en matris med elever (rader) mot
// arbetsområden (kolumner) för ett valt ämne. Varje cell visar intjänade
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
// Progress läses per elev via data.getProgress(studentId). Formen är:
//   progress[areaId][gamemode] = { completed, bestScore, stars, lastPlayed }
// (se data.js). Max 3 stjärnor per gamemode. Ett områdes möjliga stjärnor =
// antal tillgängliga gamemodes (utifrån quiz/pairs-innehåll) × 3.
// ============================================================================

import * as data from "./data.js";
import { avatarEmoji } from "./avatars.js";
import { el, esc, emptyState } from "./teacher-shared.js";
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
 * }} opts
 */
export async function renderClassStats(ctx, host, { students, subjects, studentById, loadAreas }) {
  students = (students || [])
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));
  const byId = studentById || new Map(students.map((s) => [s.id, s]));

  if (students.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        emoji: "🧑‍🎓",
        title: "Klassen har inga elever än",
        text: "Lägg till elever på klasskortet (🧑‍🎓 Elever) så syns deras framsteg här.",
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

  // Ladda klassens elevers progress EN gång (delas mellan ämnesbyten).
  let progressByStudent;
  try {
    const results = await Promise.all(
      students.map((s) => data.getProgress(s.id).catch(() => ({})))
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

    const openRow = (tr) => {
      const s = byId.get(tr.dataset.student);
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
