// ============================================================================
// Mattematchen – lärarens resultatvyer (#459)
// ----------------------------------------------------------------------------
//   renderFollow(host, comp, classNames)    – "Följ tävlingen": Topp 25 +
//       Klasskamp (alla deltagande klasser, 1 decimal). Uppdateras med knapp
//       och var 30:e s medan tävlingen är aktiv och vyn syns.
//   renderHistoryResult(host, result, classNames) – sparad ögonblicksbild:
//       vinnare, klassresultat, Topp 25, statistik (totalt + per tabell).
//   renderStudentResults(ctx, host, comp, classes, api) – Elevresultat: välj
//       klass → sorterbar tabell → elevdetalj (teacher-mm-stats.js).
// Topp 25/Klasskamp läses som på elevsidan (mm-data.js, aggregerade dokument).
// ============================================================================

import { el, esc, icon } from "../teacher-shared.js";
import { formatScore, TABLES } from "./mm-core.js";
import { renderMmTable, tablesHtml } from "./teacher-mm-stats.js";
import { getStudentsByIds } from "../data.js";

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const plats = (r) => MEDALJ[r] || `${r}.`;
const FOLLOW_MS = 30_000;

/** Topp 25-lista (rows = topList-rader). */
export function topHtml(rows, classNames) {
  if (!rows?.length) return `<p class="hint">Ingen har fått poäng än.</p>`;
  return `<ol class="mmt-lista">${rows.map((r) => `
    <li class="mmt-rad${r.rank <= 3 ? " mmt-pall" : ""}">
      <span class="mmt-plats">${plats(r.rank)}</span>
      <span class="mmt-namn">${esc(r.name)}<small>${esc(classNames.get(r.classId) || r.classId || "")}</small></span>
      <b class="mmt-tal">${r.correct}</b>
    </li>`).join("")}</ol>`;
}

/** Klasskamp (rows = classStandings-rader). */
export function classFightHtml(rows) {
  if (!rows?.length) return `<p class="hint">Inga klasser.</p>`;
  return `<ol class="mmt-lista">${rows.map((r) => `
    <li class="mmt-rad${r.rank === 1 && r.correct > 0 ? " mmt-pall" : ""}">
      <span class="mmt-plats">${plats(r.rank)}</span>
      <span class="mmt-namn">${esc(r.name)}<small>${r.correct} rätt / ${r.students} elever</small></span>
      <b class="mmt-tal">${formatScore(r.score)}</b>
    </li>`).join("")}</ol>`;
}

function twoCols(top, fight) {
  return `<div class="mmt-tva">
    <section class="mmt-kort"><h3>${icon("trophy", 16)} Topp 25</h3>${top}</section>
    <section class="mmt-kort"><h3>${icon("users", 16)} Klasskamp <span class="hint">rätt / elever</span></h3>${fight}</section>
  </div>`;
}

/** Följ en pågående tävling (Topp 25 + Klasskamp). */
export function renderFollow(host, comp, classNames) {
  const box = el(`<div class="mmt-follow">
    <div class="row-inline mmt-follow-topp">
      <span class="hint mmt-uppdaterad"></span>
      <button type="button" class="btn ghost small" data-uppdatera="1">Uppdatera</button>
    </div>
    <div class="mmt-follow-body"><div class="spinner">Laddar topplistor…</div></div>
  </div>`);
  const body = box.querySelector(".mmt-follow-body");
  const stamp = box.querySelector(".mmt-uppdaterad");
  let busy = false;
  const load = async () => {
    if (busy) return;
    busy = true;
    try {
      const { loadTop25, loadClassFight } = await import("./mm-data.js");
      const [top, fight] = await Promise.all([loadTop25(comp.id, { fresh: true }), loadClassFight(comp, { fresh: true })]);
      body.innerHTML = twoCols(topHtml(top, classNames), classFightHtml(fight));
      stamp.textContent = `Uppdaterad ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    } catch (err) {
      body.replaceChildren(el(`<div class="msg error">Kunde inte ladda topplistorna: ${esc(err.message)}</div>`));
    } finally {
      busy = false;
    }
  };
  box.querySelector("[data-uppdatera]").addEventListener("click", load);
  // Stannar av sig själv när vyn lämnas (samma mönster som fokuslägets status).
  const tick = setInterval(() => {
    if (!box.isConnected) return clearInterval(tick);
    if (!document.hidden) load();
  }, FOLLOW_MS);
  host.replaceChildren(box);
  load();
}

/** Sparad historik (MathCompetition.result). */
export function renderHistoryResult(host, result, classNames) {
  const w = result.winner;
  const wc = result.classes?.find((k) => k.classId === result.winnerClass);
  const t = result.totals || {};
  const tables = (result.tables || TABLES.map((n) => ({ table: n, correct: 0, wrong: 0 }))).map((r) => {
    const total = (r.correct || 0) + (r.wrong || 0);
    return { ...r, total, pct: total ? Math.round((r.correct * 100) / total) : 0 };
  });
  const pct = t.total ? Math.round((t.correct * 100) / t.total) : null;
  host.replaceChildren(el(`<div class="mmt-historik">
    <div class="mmt-vinnare">
      <div class="mmt-vinnare-kort"><span class="mmt-v-ikon">🥇</span><div>
        <small>Vinnare individuellt</small>
        <b>${w ? `${esc(w.name)}` : "Ingen"}</b>
        <span class="hint">${w ? `${esc(classNames.get(w.classId) || w.classId)} · ${w.correct} rätt` : "Inga rätta svar"}</span>
      </div></div>
      <div class="mmt-vinnare-kort"><span class="mmt-v-ikon">🏆</span><div>
        <small>Vinnande klass</small>
        <b>${wc ? esc(wc.name) : "Ingen"}</b>
        <span class="hint">${wc ? `${formatScore(wc.score)} poäng (${wc.correct} rätt / ${wc.students} elever)` : "Inga rätta svar"}</span>
      </div></div>
      <div class="mmt-vinnare-kort"><span class="mmt-v-ikon">🧮</span><div>
        <small>Statistik</small>
        <b>${t.total || 0} svar</b>
        <span class="hint">${t.correct || 0} rätt · ${t.incorrect || 0} fel${pct == null ? "" : ` · ${pct}% rätt`} · ${t.participants || 0} elever</span>
      </div></div>
    </div>
    ${twoCols(topHtml(result.top, classNames), classFightHtml(result.classes))}
    <details class="mmt-kort mmt-alla-tabeller"><summary>Hela tävlingen per tabell 0–10</summary>${tablesHtml(tables)}</details>
  </div>`));
}

/** Elevresultat: välj en deltagande klass → tabell. */
export function renderStudentResults(ctx, host, comp, classes, api) {
  const deltar = (comp.participatingClassIds || []).map((id) => classes.find((k) => k.id === id) || { id, name: id, studentIds: [] });
  const box = el(`<div class="mmt-elevres">
    <label class="mmt-period">Klass
      <select class="select mmt-klass-sel" aria-label="Välj klass">
        ${deltar.map((k) => `<option value="${esc(k.id)}">${esc(k.name || k.id)}</option>`).join("")}
      </select>
    </label>
    <div class="mmt-elevres-body"></div>
  </div>`);
  const sel = box.querySelector(".mmt-klass-sel");
  const body = box.querySelector(".mmt-elevres-body");
  const show = async () => {
    const k = deltar.find((x) => x.id === sel.value);
    if (!k) return;
    body.replaceChildren(el(`<div class="spinner">Laddar elevresultat…</div>`));
    try {
      const ids = Array.isArray(k.studentIds) ? k.studentIds : [];
      const [students, statsById] = await Promise.all([getStudentsByIds(ids), api.loadStatsFor(comp.id, ids)]);
      if (sel.value !== k.id) return;
      students.sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));
      renderMmTable(ctx, body, { students, statsById, competition: comp });
    } catch (err) {
      body.replaceChildren(el(`<div class="msg error">Kunde inte ladda elevresultat: ${esc(err.message)}</div>`));
    }
  };
  sel.addEventListener("change", show);
  host.replaceChildren(box);
  if (deltar.length) show();
}
