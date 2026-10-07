// ============================================================================
// Live – historik och statistik (#460)
// ----------------------------------------------------------------------------
// Avslutade matcher ligger kvar i liveSessions (status "finished") med
// `result` (ögonblicksbild) + spelardokumenten (elevresultat). Saknas
// `result` (ingen projektor var öppen vid slutet) räknas det ur räknarna och
// sparas härifrån.
//
// API
//   renderHistoryList(ctx, host)                 – Live-flikens historiklista
//   renderHistoryDetail(ctx, host, sid)          – en matchs resultat + elever
//   renderClassLiveStats(ctx, host, { classId, students })
//       Statistik → Live för EN klass: klassens matcher + elevernas summa
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { getGameMode } from "./modes/index.js";
import {
  listFinishedSessions, listClassSessions, getSession, getPlayers, getCounters, writeResultIfMissing,
} from "./live-data.js";
import { toMs, sumCounters, classStandings, buildResult, formatScore } from "./live-core.js";

const fmtDate = (t) => {
  const ms = toMs(t);
  return ms == null ? "–" : new Date(ms).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
};
const pct = (c, w) => (c + w ? `${Math.round((100 * c) / (c + w))} %` : "–");
const className = (s, id) => s.classNames?.[id] || id;

function winnerText(s, result) {
  if (!result) return "–";
  return result.winner === "draw" ? "Oavgjort" : `🏆 ${esc(className(s, result.winner))}`;
}

/** result ur sessionen, eller räknat ur räknarna (och sparat) om det saknas. */
async function ensureResult(s, players) {
  if (s.result) return s.result;
  const standings = classStandings(s, sumCounters(await getCounters(s.id)));
  const result = buildResult(s, standings, players);
  writeResultIfMissing(s.id, result).catch(() => {});
  return result;
}

export async function renderHistoryList(ctx, host) {
  host.replaceChildren(el(`<div class="spinner">Laddar historik…</div>`));
  let list;
  try {
    list = (await listFinishedSessions()).filter((s) => s.startedAt);
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Kunde inte läsa historiken: ${esc(err.message)}</p>`));
    return;
  }
  if (!list.length) {
    host.replaceChildren(el(`<p class="hint">Inga avslutade matcher ännu.</p>`));
    return;
  }
  const ul = el(`<ul class="live-history-ul">${list.slice(0, 30).map((s) => `<li>
    <button class="live-history-item" data-sid="${esc(s.id)}">
      <span><b>${esc(s.name)}</b> <small class="hint">${fmtDate(s.startedAt)}</small></span>
      <span>${winnerText(s, s.result)}</span></button></li>`).join("")}</ul>`);
  ul.querySelectorAll("[data-sid]").forEach((b) => b.addEventListener("click", () => ctx.go(`#/larare/live?historik=${b.dataset.sid}`)));
  host.replaceChildren(ul);
}

export async function renderHistoryDetail(ctx, host, sid) {
  host.replaceChildren(el(`<div class="spinner">Laddar matchen…</div>`));
  let s, players, result;
  try {
    s = await getSession(sid);
    if (!s) throw new Error("matchen finns inte");
    players = await getPlayers(sid);
    result = s.status === "finished" && s.startedAt ? await ensureResult(s, players) : null;
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Kunde inte läsa matchen: ${esc(err.message)}</p>`));
    return;
  }
  const mode = getGameMode(s.gameMode);
  const perClass = result?.perClass || {};
  const classRows = s.participatingClassIds.map((id) => {
    const c = perClass[id] || { correct: 0, divisor: s.classDivisors?.[id] || 1, score: 0 };
    const win = result && (result.winner === id || result.winner === "draw");
    return `<tr class="${win ? "live-win" : ""}"><th scope="row">${esc(className(s, id))}</th>
      <td class="num">${c.correct}</td><td class="num">${c.divisor}</td><td class="num"><b>${formatScore(c.score)}</b></td></tr>`;
  }).join("");
  const sorted = [...players].sort((a, b) => (b.correct || 0) - (a.correct || 0) || String(a.name).localeCompare(String(b.name), "sv"));
  const playerRows = sorted.map((p) => {
    const c = p.correct || 0, w = p.incorrect || 0;
    return `<tr><th scope="row">${esc(p.name || p.uid)}</th><td>${esc(className(s, p.classId))}</td>
      <td class="num">${c}</td><td class="num">${w}</td><td class="num">${c + w}</td><td class="num">${pct(c, w)}</td></tr>`;
  }).join("");
  const view = el(`<div class="panel live-history-detail">
    <a class="back-link" data-back>← Till Live</a>
    <h2 class="live-h2">${esc(s.name)}</h2>
    <p class="hint">${fmtDate(s.startedAt)} · ${esc(mode ? mode.displayName : s.gameMode)} · ${Math.round(s.durationSeconds / 60)} min
      ${s.status !== "finished" ? " · pågår ännu" : ""}</p>
    <p class="live-history-winner">${result ? (result.winner === "draw" ? "🤝 OAVGJORT" : `🏆 VINNARE – ${esc(className(s, result.winner))}`) : ""}
      ${result ? `<small class="hint">Totalt ${result.totalCorrect} rätt</small>` : ""}</p>
    <table class="live-table"><thead><tr><th>Klass</th><th class="num">Rätt</th><th class="num">Nämnare</th><th class="num">Poäng</th></tr></thead>
      <tbody>${classRows}</tbody></table>
    <h3>Elevresultat</h3>
    ${players.length ? `<table class="live-table"><thead><tr><th>Elev</th><th>Klass</th><th class="num">Rätt</th><th class="num">Fel</th>
      <th class="num">Totalt</th><th class="num">Rätt %</th></tr></thead><tbody>${playerRows}</tbody></table>` : `<p class="hint">Inga elever anslöt.</p>`}
  </div>`);
  view.querySelector("[data-back]").addEventListener("click", () => ctx.go("#/larare/live"));
  host.replaceChildren(view);
}

/** Statistik → Live för en klass. */
export async function renderClassLiveStats(ctx, host, { classId, students = [] }) {
  host.replaceChildren(el(`<div class="spinner">Laddar Live-matcher…</div>`));
  const sessions = await listClassSessions(classId);
  if (!sessions.length) {
    host.replaceChildren(el(`<p class="hint">Klassen har inte spelat någon Live-match ännu.</p>`));
    return;
  }
  const playersBySession = await Promise.all(sessions.map((s) => getPlayers(s.id).catch(() => [])));
  const perStudent = new Map(students.map((st) => [st.id, { name: st.namn || st.name || st.id, matches: 0, c: 0, w: 0 }]));
  const matchRows = [];
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const mine = playersBySession[i].filter((p) => p.classId === classId);
    for (const p of mine) {
      const row = perStudent.get(p.uid) || { name: p.name || p.uid, matches: 0, c: 0, w: 0 };
      row.matches++;
      row.c += p.correct || 0;
      row.w += p.incorrect || 0;
      perStudent.set(p.uid, row);
    }
    const r = s.result?.perClass?.[classId];
    const outcome = !s.result ? "–" : s.result.winner === "draw" ? "Oavgjort" : s.result.winner === classId ? "🏆 Vinst" : "Förlust";
    matchRows.push(`<tr><th scope="row"><a class="live-link" data-sid="${esc(s.id)}">${esc(s.name)}</a></th><td>${fmtDate(s.startedAt)}</td>
      <td class="num">${r ? r.correct : "–"}</td><td class="num">${r ? r.divisor : "–"}</td><td class="num">${r ? formatScore(r.score) : "–"}</td>
      <td>${outcome}</td><td class="num">${mine.length}</td></tr>`);
  }
  const studentRows = [...perStudent.values()].sort((a, b) => b.c - a.c || a.name.localeCompare(b.name, "sv")).map((r) =>
    `<tr><th scope="row">${esc(r.name)}</th><td class="num">${r.matches}</td><td class="num">${r.c}</td><td class="num">${r.w}</td>
      <td class="num">${r.c + r.w}</td><td class="num">${pct(r.c, r.w)}</td></tr>`).join("");
  const view = el(`<div class="live-class-stats">
    <h4>Matcher</h4>
    <table class="live-table"><thead><tr><th>Match</th><th>Datum</th><th class="num">Rätt</th><th class="num">Nämnare</th>
      <th class="num">Poäng</th><th>Utfall</th><th class="num">Elever</th></tr></thead><tbody>${matchRows.join("")}</tbody></table>
    <h4>Elever (alla Live-matcher)</h4>
    <table class="live-table"><thead><tr><th>Elev</th><th class="num">Matcher</th><th class="num">Rätt</th><th class="num">Fel</th>
      <th class="num">Totalt</th><th class="num">Rätt %</th></tr></thead><tbody>${studentRows}</tbody></table>
  </div>`);
  view.querySelectorAll("[data-sid]").forEach((a) => a.addEventListener("click", () => ctx.go(`#/larare/live?historik=${a.dataset.sid}`)));
  host.replaceChildren(view);
}
