// ============================================================================
// Live – historik och statistik (#460)
// ----------------------------------------------------------------------------
// Avslutade matcher ligger kvar i liveSessions (status "finished") med
// `result` (ögonblicksbild) + spelardokumenten (elevresultat). Saknas
// `result` (ingen projektor var öppen vid slutet) räknas det ur räknarna och
// sparas härifrån. Har matchen ett mynt-pris (#526) som inte betalats ut
// (projektorn stängdes innan) betalas det härifrån – idempotent.
// Det formatspecifika (vinnare, klasstabell, pris – Klassmatchen) ritar
// sessionens FORMAT (historyRenderer(), laddas latt, #547); kärnan ritar
// rubrik, datum, spelläge och elevtabellen.
//
// API
//   renderHistoryList(ctx, host)                 – Live-flikens historiklista
//   renderHistoryDetail(ctx, host, sid)          – en matchs resultat + elever
//   renderClassLiveStats(ctx, host, { classId, students })
//       Statistik → Live för EN klass: klassens matcher + elevernas summa
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { getGameMode } from "./modes/index.js";
import { formatOf, formatIdOf } from "./formats/index.js";
import {
  listFinishedSessions, listClassSessions, getSession, getPlayers, getCounters, writeResultIfMissing,
} from "./live-data.js";
import { toMs } from "./live-core.js";

const fmtDate = (t) => {
  const ms = toMs(t);
  return ms == null ? "–" : new Date(ms).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });
};
const pct = (c, w) => (c + w ? `${Math.round((100 * c) / (c + w))} %` : "–");
const className = (s, id) => s.classNames?.[id] || id;

/** Formatets historikdel (null = okänt format i den här versionen). */
function historyFor(s) {
  const fmt = formatOf(s);
  return fmt ? fmt.historyRenderer() : Promise.resolve(null);
}

/** result ur sessionen, eller räknat ur räknarna (och sparat) om det saknas. */
async function ensureResult(s, players) {
  if (s.result) return s.result;
  const fmt = formatOf(s);
  if (!fmt) return null;
  // players → perClass[].players (#499: utan dem blev det 0 → ingen pokal/bonus)
  const counters = fmt.classCounters ? await getCounters(s.id) : [];
  const { classes } = fmt.computeStandings(s, { counters, players });
  const result = fmt.buildResult(s, classes, players, getGameMode(s.gameMode));
  writeResultIfMissing(s.id, result).catch(() => {});
  return result;
}

export async function renderHistoryList(ctx, host) {
  host.replaceChildren(el(`<div class="spinner">Laddar historik…</div>`));
  let list, hist;
  try {
    list = (await listFinishedSessions()).filter((s) => s.startedAt);
    hist = await Promise.all(list.slice(0, 30).map((s) => historyFor(s).catch(() => null)));
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Kunde inte läsa historiken: ${esc(err.message)}</p>`));
    return;
  }
  if (!list.length) {
    host.replaceChildren(el(`<p class="hint">Inga avslutade matcher ännu.</p>`));
    return;
  }
  const ul = el(`<ul class="live-history-ul">${list.slice(0, 30).map((s, i) => `<li>
    <button class="live-history-item" data-sid="${esc(s.id)}">
      <span><b>${esc(s.name)}</b> <small class="hint">${fmtDate(s.startedAt)}</small></span>
      <span>${hist[i] ? hist[i].winnerText(s, s.result) : "–"}</span></button></li>`).join("")}</ul>`);
  ul.querySelectorAll("[data-sid]").forEach((b) => b.addEventListener("click", () => ctx.go(`#/larare/live?historik=${b.dataset.sid}`)));
  host.replaceChildren(ul);
}

export async function renderHistoryDetail(ctx, host, sid) {
  host.replaceChildren(el(`<div class="spinner">Laddar matchen…</div>`));
  let s, players, result, hist;
  try {
    s = await getSession(sid);
    if (!s) throw new Error("matchen finns inte");
    hist = await historyFor(s);
    if (!hist) throw new Error("matchen använder ett format som inte finns i den här versionen – ladda om sidan");
    players = await getPlayers(sid);
    result = s.status === "finished" && s.startedAt ? await ensureResult(s, players) : null;
    hist.settle?.(s);
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Kunde inte läsa matchen: ${esc(err.message)}</p>`));
    return;
  }
  const mode = getGameMode(s.gameMode);
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
    ${hist.detailHtml(s, result)}
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
  const hists = await Promise.all(sessions.map((s) => historyFor(s).catch(() => null)));
  // Avslutad match utan sparat result (ingen projektor vid slutet, ingen har
  // öppnat historiken): räkna ur räknarna, som historikvyn gör (#463).
  const results = await Promise.all(sessions.map((s, i) => ensureResult(s, playersBySession[i]).catch(() => null)));
  const perStudent = new Map(students.map((st) => [st.id, { name: st.namn || st.name || st.id, matches: 0, c: 0, w: 0 }]));
  const matchRows = [];
  let head = null;
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
    // Formatets kolumner; matcher i ett annat format än tabellens (första
    // matchens) – eller okänt format – listas utan formatkolumner.
    const h = hists[i];
    if (!head && h) head = { id: formatIdOf(s), stats: h.classStats };
    const cells = h && head && formatIdOf(s) === head.id
      ? head.stats.cells(s, results[i], classId)
      : `<td colspan="${head?.stats.cols ?? 4}" class="hint">–</td>`;
    matchRows.push(`<tr><th scope="row"><a class="live-link" data-sid="${esc(s.id)}">${esc(s.name)}</a></th><td>${fmtDate(s.startedAt)}</td>
      ${cells}<td class="num">${mine.length}</td></tr>`);
  }
  const studentRows = [...perStudent.values()].sort((a, b) => b.c - a.c || a.name.localeCompare(b.name, "sv")).map((r) =>
    `<tr><th scope="row">${esc(r.name)}</th><td class="num">${r.matches}</td><td class="num">${r.c}</td><td class="num">${r.w}</td>
      <td class="num">${r.c + r.w}</td><td class="num">${pct(r.c, r.w)}</td></tr>`).join("");
  const view = el(`<div class="live-class-stats">
    <h4>Matcher</h4>
    <table class="live-table"><thead><tr><th>Match</th><th>Datum</th>${head?.stats.head ?? ""}<th class="num">Elever</th></tr></thead><tbody>${matchRows.join("")}</tbody></table>
    <h4>Elever (alla Live-matcher)</h4>
    <table class="live-table"><thead><tr><th>Elev</th><th class="num">Matcher</th><th class="num">Rätt</th><th class="num">Fel</th>
      <th class="num">Totalt</th><th class="num">Rätt %</th></tr></thead><tbody>${studentRows}</tbody></table>
  </div>`);
  view.querySelectorAll("[data-sid]").forEach((a) => a.addEventListener("click", () => ctx.go(`#/larare/live?historik=${a.dataset.sid}`)));
  host.replaceChildren(view);
}
