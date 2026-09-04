// ============================================================================
// Pluggportalen – lärarsidan: per-elev-fördjupning (teacher-class-detail.js)
// ----------------------------------------------------------------------------
// Öppnas när läraren klickar på en elevrad i klassöversikten. Visar mer än
// stjärnmatrisen:
//   * spelade / avklarade övningar
//   * totala stjärnor + andel av möjliga
//   * senaste aktivitet (lastPlayed)
//   * svaga & ej påbörjade områden (var eleven behöver hjälp)
//   * bästa resultat per läge & område
// Allt härleds klientvis ur redan inläst progress – ingen ny Firestore-data.
// ============================================================================

import * as data from "./data.js";
import { avatarEmoji } from "./avatars.js";
import { el, esc } from "./teacher-shared.js";
import { MAX_STARS_PER_MODE, areaModes, areaEarned, progressLevel } from "./teacher-class-stats.js";

/** Svensk "senast spelad"-text ur ett Date (relativt idag). */
function lastPlayedText(date) {
  if (!date) return "aldrig spelat";
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `för ${days} dagar sedan`;
  if (days < 14) return "för en vecka sedan";
  if (days < 31) return `för ${Math.round(days / 7)} veckor sedan`;
  if (days < 60) return "för en månad sedan";
  return date.toLocaleDateString("sv-SE");
}

/** Fullständig datumtext (för title-attribut). */
function fullDate(date) {
  return date
    ? date.toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })
    : "";
}

/**
 * Härled en elevs fördjupade statistik ur progress + alla ämnens områden.
 * @param {object} progress  progress[areaId][gamemode] = {...}
 * @param {Array<{subject:object, areas:object[]}>} subjectsAreas
 */
function computeStudentDetail(progress, subjectsAreas) {
  const base = data.statsFromProgress(progress); // played, completed, stars, areas, lastPlayed
  let maxStars = 0;
  const subjectBlocks = [];
  const weak = []; // påbörjade men låg stjärnandel
  const notStarted = []; // har övningar men eleven har inte börjat

  for (const { subject, areas } of subjectsAreas) {
    const areaRows = [];
    for (const area of areas) {
      const modes = areaModes(area);
      if (modes.length === 0) continue; // område utan övningar – hoppa över
      const areaMax = modes.length * MAX_STARS_PER_MODE;
      maxStars += areaMax;
      const earned = areaEarned(progress, area.id);
      const ratio = areaMax > 0 ? earned.stars / areaMax : 0;
      const modeRows = modes.map((gm) => ({
        gm,
        result: (progress && progress[area.id] && progress[area.id][gm.id]) || null,
      }));
      const row = { area, subject, areaMax, earned, ratio, modeRows };
      areaRows.push(row);
      if (earned.played === 0) notStarted.push(row);
      else if (ratio < 0.34) weak.push(row);
    }
    if (areaRows.length > 0) subjectBlocks.push({ subject, areaRows });
  }

  const ratio = maxStars > 0 ? base.stars / maxStars : 0;
  weak.sort((a, b) => a.ratio - b.ratio); // svagast först
  return {
    played: base.playedExercises,
    completed: base.completed,
    stars: base.stars,
    maxStars,
    ratio,
    areasStarted: base.areas,
    lastPlayed: base.lastPlayed,
    subjectBlocks,
    weak,
    notStarted,
  };
}

/** En liten stjärnetikett "x/max ★". */
function starsLabel(stars, max) {
  return `${stars}<span class="cx-slash">/${max}</span> ★`;
}

/**
 * Öppna detaljvyn (modal) för en elev.
 * @param {object} student   elevobjekt ({ id, namn, username, avatarId })
 * @param {object} progress  elevens redan inlästa progress
 * @param {object[]} subjects  alla ämnen ({ id, name })
 * @param {(subjectId:string)=>Promise<object[]>} loadAreas  cachad områdesladdare
 */
export async function openStudentDetail(student, progress, subjects, loadAreas) {
  const name = student.namn || student.username || student.id;

  // Overlay + kort. Skapas direkt med en spinner så klicket känns responsivt.
  const overlay = el(`<div class="cx-modal-overlay" role="dialog" aria-modal="true" aria-label="Statistik för ${esc(name)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div>
          <h2 class="cx-modal-name">${esc(name)}</h2>
          <p class="cx-modal-sub">${student.username ? "Användarnamn: " + esc(student.username) : ""}</p>
        </div>
      </div>
      <div class="cx-modal-body"><div class="spinner">Laddar statistik…</div></div>
    </div>
  </div>`);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  overlay.querySelector(".cx-modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);

  const bodyEl = overlay.querySelector(".cx-modal-body");

  // Ladda alla ämnens områden (cachas via loadAreas).
  let subjectsAreas;
  try {
    const areasList = await Promise.all(subjects.map((s) => loadAreas(s.id)));
    subjectsAreas = subjects.map((s, i) => ({ subject: s, areas: areasList[i] || [] }));
  } catch (err) {
    bodyEl.replaceChildren(
      el(`<div class="msg error">Kunde inte ladda statistiken: ${esc(err.message)}</div>`)
    );
    return;
  }

  const d = computeStudentDetail(progress, subjectsAreas);
  bodyEl.replaceChildren(renderStudentDetail(d));
}

/** Bygg detaljvyns innehåll (DOM) ur beräknad statistik. */
function renderStudentDetail(d) {
  const pct = Math.round(d.ratio * 100);
  const lvl = progressLevel(d.ratio);
  const lp = d.lastPlayed;

  // 1) Snabböversikt – nyckeltal.
  const cards = `<div class="cx-stat-grid">
    <div class="cx-stat">
      <div class="cx-stat-num">${d.played}</div>
      <div class="cx-stat-lbl">spelade övningar</div>
    </div>
    <div class="cx-stat">
      <div class="cx-stat-num">${d.completed}</div>
      <div class="cx-stat-lbl">avklarade</div>
    </div>
    <div class="cx-stat">
      <div class="cx-stat-num">${d.stars}<span class="cx-stat-of">/${d.maxStars}</span> ★</div>
      <div class="cx-stat-lbl">stjärnor (${pct}% av möjliga)</div>
    </div>
    <div class="cx-stat" title="${lp ? "Senast aktiv " + esc(fullDate(lp)) : "Har inte spelat än"}">
      <div class="cx-stat-num cx-stat-when">${esc(lastPlayedText(lp))}</div>
      <div class="cx-stat-lbl">senast aktiv</div>
    </div>
  </div>`;

  // Total-stapel.
  const totalBar = `<div class="cx-detail-total ${lvl}">
    <div class="cx-detail-total-bar"><span style="width:${pct}%"></span></div>
  </div>`;

  // 2) Behöver hjälp – svaga + ej påbörjade områden.
  const chip = (row, kind) =>
    `<span class="cx-chip ${kind}" title="${esc(row.subject.name || row.subject.id)} · ${row.earned.stars}/${row.areaMax} ★">
      <span class="cx-chip-emoji">${esc(row.area.coverEmoji || "📖")}</span>
      ${esc(row.area.name || row.area.id)}${kind === "weak" ? ` <b>${Math.round(row.ratio * 100)}%</b>` : ""}
    </span>`;
  let helpSection = "";
  if (d.weak.length || d.notStarted.length) {
    const weakChips = d.weak.map((r) => chip(r, "weak")).join("");
    const notChips = d.notStarted.map((r) => chip(r, "not")).join("");
    helpSection = `<div class="cx-detail-sec">
      <h3>Behöver hjälp här 🎯</h3>
      ${d.weak.length ? `<p class="cx-chip-lbl">Låg stjärnandel:</p><div class="cx-chips">${weakChips}</div>` : ""}
      ${d.notStarted.length ? `<p class="cx-chip-lbl">Ej påbörjade områden:</p><div class="cx-chips">${notChips}</div>` : ""}
    </div>`;
  } else if (d.played > 0) {
    helpSection = `<div class="cx-detail-sec"><h3>Behöver hjälp här 🎯</h3>
      <p class="hint">Inga svaga områden – eleven ligger bra till överlag. 🎉</p></div>`;
  }

  // 3) Per ämne & område: stjärnandel + bästa resultat per läge.
  const subjectHtml = d.subjectBlocks.map((block) => renderSubjectBlock(block)).join("");
  const detailSection = subjectHtml
    ? `<div class="cx-detail-sec"><h3>Per område 📚</h3>${subjectHtml}</div>`
    : `<p class="hint">Det finns inga arbetsområden med övningar än.</p>`;

  return el(`<div>${cards}${totalBar}${helpSection}${detailSection}</div>`);
}

/** Ett ämnesblock med en rad per område (stjärnandel + lägesresultat). */
function renderSubjectBlock(block) {
  const rows = block.areaRows
    .map((r) => {
      const rpct = Math.round(r.ratio * 100);
      const rlvl = progressLevel(r.ratio);
      const started = r.earned.played > 0;
      const modeChips = r.modeRows.map(({ gm, result }) => renderModeChip(gm, result)).join("");
      return `<div class="cx-area-row">
        <div class="cx-area-main">
          <span class="cx-area-name"><span class="cx-area-emoji">${esc(r.area.coverEmoji || "📖")}</span>${esc(r.area.name || r.area.id)}</span>
          <span class="cx-area-stars">${started ? starsLabel(r.earned.stars, r.areaMax) : '<span class="cx-empty">ej börjat</span>'}</span>
        </div>
        <div class="cx-area-bar ${started ? rlvl : "tom"}"><span style="width:${started ? rpct : 0}%"></span></div>
        <div class="cx-modes">${modeChips}</div>
      </div>`;
    })
    .join("");
  return `<div class="cx-subject-block">
    <h4>${esc(block.subject.name || block.subject.id)}</h4>
    ${rows}
  </div>`;
}

/** En liten "läges-bricka" (gamemode) med stjärnor + bästa resultat i title. */
function renderModeChip(gm, result) {
  if (!result) {
    return `<span class="cx-mode tom" title="${esc(gm.name)} – ej spelad">${gm.emoji}<span class="cx-mode-val">–</span></span>`;
  }
  const stars = typeof result.stars === "number" ? Math.min(MAX_STARS_PER_MODE, result.stars) : 0;
  const best = typeof result.bestScore === "number" ? ` · bästa ${result.bestScore} p` : "";
  const played = data.toDate(result.lastPlayed);
  const title = `${gm.name}: ${stars}/3 ★${best}${played ? " · " + fullDate(played) : ""}`;
  return `<span class="cx-mode klar" title="${esc(title)}">${gm.emoji}<span class="cx-mode-val">${stars}★</span></span>`;
}
