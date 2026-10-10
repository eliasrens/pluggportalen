// ============================================================================
// Snilleblixten – historiken och Statistik → Live (#560). Laddas LATT av
// teacher-live-history.js via SNILLEBLIXT.historyRenderer(). Siffrorna räknas
// i sb-historik-data.js (ren logik); här ritas de.
//
// En match: ⚡-vinnare, pallplats (delad placering), topplista med Pluggmynt
// per elev, andel rätt per fråga ("vilka frågor klassen hade svårast för"),
// andel rätt per spellägets statKeys (multiplikation: per tabell) och – ur
// sbScores – varje elev × fråga. Kärnans elevtabell (players.correct, som
// Snilleblixten inte räknar) ersätts av topplistan (ownPlayerTable).
//
// API
//   winnerText(s, result)          → "⚡ Alma" | "⚡ Alma & Omar" | "–"
//   detailHtml(s, result)          → Promise<html> (en match)
//   ownPlayerTable                 true – kärnan ritar ingen elevtabell
//   playerCounts(s, result)        → Map uid → { correct, incorrect } (elevernas
//                                    summa i Statistik → Live)
//   classStats.head / .cols / .cells(s, result, classId) – klassens rad
//   classSummaryHtml(entries, classId) → html – klassens Snilleblixt-matcher
//                                    sammantaget: per tabell + svåraste frågorna
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { getGameMode } from "../../modes/index.js";
import { ensureLiveCss } from "../../live-css.js";
import {
  questionRates, hardestQuestions, categoryRates, podiumGroups, playerCounts as counts, answerMatrix,
} from "./sb-historik-data.js";

const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const procent = (r) => (r == null ? "–" : `${Math.round(r * 100)} %`);
const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };
const className = (s, id) => s.classNames?.[id] || id || "";
const qLabel = (q) => `Fråga ${q.nr}${q.text ? ` · ${esc(q.text)}` : ""}`;

function catTitle(mode) {
  return mode?.id?.startsWith("multiplication") ? "Andel rätt per tabell" : "Andel rätt per kategori";
}

function bar(r) {
  const p = r == null ? 0 : Math.round(r * 100);
  const ton = r == null ? "" : r < 0.5 ? " sbh-lag" : r < 0.75 ? " sbh-mellan" : "";
  return `<span class="sbh-bar${ton}" role="img" aria-label="${procent(r)}"><i style="width:${p}%"></i></span> <b>${procent(r)}</b>`;
}

export function winnerText(_s, result) {
  const ettor = (result?.ranking || []).filter((p) => p.rank === 1 && p.points > 0);
  if (!ettor.length) return "–";
  return `⚡ ${ettor.map((p) => esc(p.name || "?")).join(" & ")}`;
}

export const ownPlayerTable = true;

export function playerCounts(_s, result) {
  return counts(result);
}

function pallHtml(result) {
  const groups = podiumGroups(result?.ranking);
  if (!groups.length) return "";
  return `<ol class="sbh-pall" aria-label="Pallplats">${groups.map((g) => `<li class="sbh-pall-${g.rank}">
      <span class="sbh-medalj" aria-hidden="true">${MEDALJ[g.rank]}</span>
      <b>${g.players.map((p) => esc(p.name || "?")).join(" & ")}</b>
      <small>${g.players.length > 1 ? `delad ${g.rank}:a · ` : `${g.rank}:a · `}${tal(g.players[0].points)} poäng</small></li>`).join("")}</ol>`;
}

function topplistaHtml(s, result) {
  const rw = result?.rewards;
  const flera = (s.participatingClassIds || []).length > 1;
  const pc = counts(result);
  const rows = (result?.ranking || []).map((p) => {
    const c = pc.get(p.uid);
    return `<tr${p.rank === 1 && p.points > 0 ? ` class="live-win"` : ""}><td class="num">${p.points > 0 ? p.rank : "–"}</td>
      <th scope="row">${esc(p.name || "?")}</th>${flera ? `<td>${esc(className(s, p.classId))}</td>` : ""}
      <td class="num">${c.correct}</td><td class="num">${c.incorrect}</td><td class="num"><b>${tal(p.points)}</b></td>
      ${rw ? `<td class="num">${rw[p.uid] ? tal(rw[p.uid].total) : "–"}</td>` : ""}</tr>`;
  }).join("");
  if (!rows) return `<p class="hint">Inga elever anslöt.</p>`;
  return `<table class="live-table"><thead><tr><th class="num">Plats</th><th>Elev</th>${flera ? "<th>Klass</th>" : ""}
      <th class="num">Rätt</th><th class="num">Fel</th><th class="num">Poäng</th>${rw ? `<th class="num">🪙 Pluggmynt</th>` : ""}</tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function fragorHtml(result) {
  const qs = questionRates(result);
  if (!qs.length) return `<p class="hint">Inga frågor spelades.</p>`;
  const svarast = hardestQuestions(result, 3);
  const svar = new Set(svarast.filter((q) => q.rate < 1).map((q) => q.index));
  const rows = qs.map((q) => `<tr${svar.has(q.index) ? ` class="sbh-svar"` : ""}><th scope="row">${qLabel(q)}${svar.has(q.index) ? ` <span class="sbh-tagg">svår</span>` : ""}</th>
      <td class="num">${q.skipped ? "–" : q.answered}</td><td class="num">${q.skipped ? "–" : q.correct}</td>
      <td class="sbh-andel">${q.skipped ? `<span class="hint">hoppades över</span>` : bar(q.rate)}</td></tr>`).join("");
  const tips = svar.size
    ? `<p class="hint">Svårast för klassen: ${svarast.filter((q) => svar.has(q.index)).map((q) => `<b>${qLabel(q)}</b> (${procent(q.rate)})`).join(", ")}</p>`
    : "";
  return `${tips}<table class="live-table sbh-fragor"><thead><tr><th>Fråga</th><th class="num">Svarade</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function kategorierHtml(mode, perQuestions, classId = null) {
  const rows = categoryRates(perQuestions, mode?.statCategories, { classId });
  if (!rows.length) return "";
  return `<h3>${catTitle(mode)}</h3>
    <table class="live-table sbh-kat"><thead><tr><th>${mode?.id?.startsWith("multiplication") ? "Tabell" : "Kategori"}</th>
      <th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="num">${r.answered}</td><td class="num">${r.correct}</td>
      <td class="sbh-andel">${bar(r.rate)}</td></tr>`).join("")}</tbody></table>`;
}

const CELL = { ratt: ["✓", "rätt"], fel: ["✗", "fel"], inget: ["·", "inget svar"], hoppad: ["–", "hoppades över"] };

async function matrisHtml(s, result) {
  if (!result?.ranking?.length || !s.id) return "";
  let scores;
  try {
    scores = await (await import("./snilleblixt-data.js")).getScores(s.id);
  } catch {
    return "";
  }
  if (!scores.length) return "";
  const rows = answerMatrix(result.ranking, scores).map((r) => `<tr><th scope="row">${esc(r.name || "?")}</th>${r.cells
    .map((c) => `<td class="sbh-c sbh-${c}" title="${CELL[c][1]}">${CELL[c][0]}</td>`).join("")}</tr>`).join("");
  return `<details class="sbh-matris"><summary>Varje elev och fråga</summary>
    <div class="sbh-scroll"><table class="live-table"><thead><tr><th>Elev</th>${scores.map((sc) => `<th class="num">${sc.index + 1}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="hint">✓ rätt · ✗ fel · · inget svar · – frågan hoppades över</p></details>`;
}

export async function detailHtml(s, result) {
  ensureLiveCss(["src/live/formats/snilleblixt/snilleblixt-historik.css"]);
  const mode = getGameMode(s.gameMode);
  const info = result
    ? `<small class="hint">${result.questionsPlayed} frågor · ${KIND[s.answerKind] || ""} · totalt ${result.totalCorrect} rätt</small>`
    : "";
  if (!result) return `<p class="live-history-winner">⚡ ${info}</p><p class="hint">Inget resultat ännu.</p>`;
  return `<p class="live-history-winner">${winnerText(s, result)} ${info}</p>
    ${pallHtml(result)}
    <h3>Topplista</h3>
    ${topplistaHtml(s, result)}
    <h3>Andel rätt per fråga</h3>
    ${fragorHtml(result)}
    ${kategorierHtml(mode, result.perQuestion)}
    ${await matrisHtml(s, result)}`;
}

export const classStats = {
  cols: 3,
  head: `<th class="num">Rätt</th><th class="num">Poäng</th><th>Svårast</th>`,
  cells(_s, res, classId) {
    if (!res) return `<td class="num">–</td><td class="num">–</td><td>–</td>`;
    const mine = (res.ranking || []).filter((p) => p.classId === classId);
    const h = hardestQuestions(res, 1)[0];
    return `<td class="num">${mine.reduce((n, p) => n + p.correct, 0)}</td><td class="num">${tal(mine.reduce((n, p) => n + p.points, 0))}</td>
      <td>${h ? `${qLabel(h)} (${procent(h.rate)})` : "–"}</td>`;
  },
};

/** Klassens Snilleblixt-matcher sammantaget (Statistik → Live). entries = [{ s, result }]. */
export function classSummaryHtml(entries, classId) {
  ensureLiveCss(["src/live/formats/snilleblixt/snilleblixt-historik.css"]);
  const byMode = new Map();
  for (const { s, result } of entries || []) {
    if (!result?.perQuestion) continue;
    const list = byMode.get(s.gameMode) || [];
    list.push(...result.perQuestion.map((q) => ({ ...q, _s: s })));
    byMode.set(s.gameMode, list);
  }
  const parts = [];
  for (const [modeId, qs] of byMode) {
    const mode = getGameMode(modeId);
    const tab = kategorierHtml(mode, qs, classId);
    const svar = qs.filter((q) => !q.skipped && q.byClass?.[classId]?.answered > 0)
      .map((q) => ({ q, r: q.byClass[classId].correct / q.byClass[classId].answered, n: q.byClass[classId].answered }))
      .filter((x) => x.r < 0.75)
      .sort((a, b) => a.r - b.r || b.n - a.n).slice(0, 5);
    if (!tab && !svar.length) continue;
    parts.push(`<div class="sbh-klass"><h4>⚡ Snilleblixten – ${esc(mode ? mode.displayName : modeId)}</h4>
      ${tab.replace("<h3>", "<h5>").replace("</h3>", "</h5>")}
      ${svar.length ? `<h5>Klassens svåraste frågor</h5><table class="live-table"><thead><tr><th>Fråga</th><th>Match</th><th class="num">Svar</th><th>Andel rätt</th></tr></thead>
        <tbody>${svar.map(({ q, r, n }) => `<tr><th scope="row">${q.text ? esc(q.text) : `Fråga ${q.index + 1}`}</th><td>${esc(q._s.name || "")}</td>
          <td class="num">${n}</td><td class="sbh-andel">${bar(r)}</td></tr>`).join("")}</tbody></table>` : ""}</div>`);
  }
  return parts.join("");
}
