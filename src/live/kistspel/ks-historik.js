// ============================================================================
// Kistspel – HISTORIKEN och Statistik → Live (#566, utbrutet ur Guldrushen
// #655; gemensamt för alla kistformat). Laddas LATT av formatets
// historyRenderer() (guldrush-history.js, datakuppen-history.js) som skickar
// in sitt TEMA. Siffrorna räknas i ks-historik-data.js (ren logik); här ritas
// de. CSS-klasserna (grh-*) bor i guldrush-historik.css och delas av alla
// kistformat.
//
// En match: vinnaren, pallplats (delad placering), klassens totala saldo,
// formatets egen ruta (theme.extraHtml – Datakuppen: hackförsök), topplista
// med rätt/fel/kistor/saldo och Pluggmynt per elev, andel rätt per fråga
// (multiplikation: faktorparet) och per spellägets statKeys (multiplikation:
// per tabell) och – ur svaren – varje elevs felsvar. Kärnans elevtabell
// ersätts av topplistan (ownPlayerTable).
//
// Match som avslutades före #566 (result utan perQuestion): frågestatistiken
// räknas ur svaren när matchen öppnas (sparas inte).
//
// API
//   createKistHistory(theme) → { winnerText, detailHtml, ownPlayerTable,
//                                playerCounts, classStats, classSummaryHtml }
//   theme = {
//     css[]            extra CSS utöver guldrush-historik.css
//     icon             "💰" – vinnaren, pallen, klassrutan, sammanfattningen
//     amount(n)        → "120 guld" | "120 MB" (pallen och matchraden)
//     classTotal       "guld tillsammans" – texten under klassens saldo
//     balanceHead      "💰 Guld" – topplistans kolumn
//     chestsHead       "Kistor"
//     statsHead        "Guld" – Statistik → Live, matchraden
//     summaryTitle     "💰 Guldrushen" – klassens sammanfattning
//     klasserCls?      extra klass på klassrutan (färgen)
//     loadAnswers()    → Promise<getAnswers(sid)> (formatets datalager, latt)
//     extraHtml?(s, result)   formatets ruta efter klassens saldo
//     classStatsExtra? { head, cols, cells(s, result, classId) } efter saldot
//   }
// ============================================================================

import { esc } from "../../teacher-shared.js";
import { coinIcon } from "../../icons.js";
import { getGameMode } from "../modes/index.js";
import { ensureLiveCss } from "../live-css.js";
import { categoryRates } from "../formats/snilleblixt/sb-historik-data.js";
import {
  questionStats, playerAnswerStats, hardestQuestions, podiumGroups, playerCounts as counts,
} from "./ks-historik-data.js";

const CSS = "src/live/formats/guldrush/guldrush-historik.css";
const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const procent = (r) => (r == null ? "–" : `${Math.round(r * 100)} %`);
const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };
const className = (s, id) => s.classNames?.[id] || id || "";
const isMult = (mode) => !!mode?.id?.startsWith("multiplication");

export function bar(r) {
  const p = r == null ? 0 : Math.round(r * 100);
  const ton = r == null ? "" : r < 0.5 ? " grh-lag" : r < 0.75 ? " grh-mellan" : "";
  return `<span class="grh-bar${ton}" role="img" aria-label="${procent(r)}"><i style="width:${p}%"></i></span> <b>${procent(r)}</b>`;
}

export { tal, procent };

export function createKistHistory(theme) {
  const T = theme;
  const css = () => ensureLiveCss([CSS, ...(T.css || [])]);

  function winnerText(_s, result) {
    const ettor = (result?.ranking || []).filter((p) => p.rank === 1 && p.gold > 0);
    if (!ettor.length) return "–";
    return `${T.icon} ${ettor.map((p) => esc(p.name || "?")).join(" & ")}`;
  }

  function pallHtml(result) {
    const groups = podiumGroups(result?.ranking);
    if (!groups.length) return "";
    return `<ol class="grh-pall" aria-label="Pallplats">${groups.map((g) => `<li class="grh-pall-${g.rank}">
      <span class="grh-medalj" aria-hidden="true">${MEDALJ[g.rank]}</span>
      <b>${g.players.map((p) => esc(p.name || "?")).join(" & ")}</b>
      <small>${g.players.length > 1 ? `delad ${g.rank}:a · ` : `${g.rank}:a · `}${T.icon} ${T.amount(g.players[0].gold)}</small></li>`).join("")}</ol>`;
  }

  function klassSaldoHtml(s, result) {
    const ids = s.participatingClassIds || [];
    if (!ids.length) return "";
    return `<ul class="grh-klasser${T.klasserCls ? ` ${T.klasserCls}` : ""}">${ids.map((id) => `<li><span>${esc(className(s, id))}</span>
      <b>${T.icon} ${tal(result?.classGold?.[id])}</b><small>${T.classTotal}</small></li>`).join("")}</ul>`;
  }

  function topplistaHtml(s, result, perPlayer) {
    const rw = result?.rewards;
    const flera = (s.participatingClassIds || []).length > 1;
    const pc = counts(result);
    const rows = (result?.ranking || []).map((p) => {
      const c = pc.get(p.uid);
      const wrong = perPlayer?.get(p.uid)?.wrong || [];
      return `<tr${p.rank === 1 && p.gold > 0 ? ` class="live-win"` : ""}><td class="num">${p.gold > 0 ? p.rank : "–"}</td>
      <th scope="row">${esc(p.name || "?")}</th>${flera ? `<td>${esc(className(s, p.classId))}</td>` : ""}
      <td class="num">${c.correct}</td><td class="num">${c.incorrect}</td><td class="num">${tal(p.chests)}</td><td class="num"><b>${tal(p.gold)}</b></td>
      ${rw ? `<td class="num">${rw[p.uid] ? tal(rw[p.uid].total) : "–"}</td>` : ""}
      ${perPlayer ? `<td class="grh-fel">${wrong.length ? wrong.slice(0, 8).map(esc).join(", ") + (wrong.length > 8 ? " …" : "") : "–"}</td>` : ""}</tr>`;
    }).join("");
    if (!rows) return `<p class="hint">Inga elever anslöt.</p>`;
    return `<div class="grh-scroll"><table class="live-table"><thead><tr><th class="num">Plats</th><th>Elev</th>${flera ? "<th>Klass</th>" : ""}
      <th class="num">Rätt</th><th class="num">Fel</th><th class="num">${T.chestsHead}</th><th class="num">${T.balanceHead}</th>${rw ? `<th class="num">${coinIcon("1em")} Pluggmynt</th>` : ""}
      ${perPlayer ? "<th>Svarade fel på</th>" : ""}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
  }

  async function loadAnswers(s, getAnswers) {
    if (!s?.id) return null;
    try {
      const get = getAnswers || (await T.loadAnswers());
      return await get(s.id);
    } catch {
      return null; // utan svar: topplistan utan felsvar, ingen frågestatistik
    }
  }

  async function detailHtml(s, result, { getAnswers = null } = {}) {
    css();
    const mode = getGameMode(s.gameMode);
    const info = result
      ? `<small class="hint">${KIND[s.answerKind] || ""} · totalt ${tal(result.totalCorrect)} rätt · ${T.amount(result.totalGold)}</small>`
      : "";
    if (!result) return `<p class="live-history-winner">${T.icon} ${info}</p><p class="hint">Inget resultat ännu.</p>`;
    const answers = await loadAnswers(s, getAnswers);
    const perQuestion = result.perQuestion || (answers ? questionStats(answers, { players: result.ranking }) : null);
    const perPlayer = answers ? playerAnswerStats(answers) : null;
    return `<p class="live-history-winner">${winnerText(s, result)} ${info}</p>
    ${pallHtml(result)}
    ${klassSaldoHtml(s, result)}${T.extraHtml ? T.extraHtml(s, result) : ""}
    <h3>Topplista</h3>
    ${topplistaHtml(s, result, perPlayer)}
    <h3>Andel rätt per ${isMult(mode) ? "uppgift" : "fråga"}</h3>
    ${perQuestion ? fragorHtml(perQuestion, mode) : `<p class="hint">Svaren kunde inte läsas.</p>`}
    ${perQuestion ? kategorierHtml(mode, perQuestion) : ""}`;
  }

  const extra = T.classStatsExtra || null;
  const classStats = {
    cols: 2 + (extra?.cols || 0),
    head: `<th class="num">Rätt</th><th class="num">${T.statsHead}</th>${extra?.head || ""}`,
    cells(s, res, classId) {
      const ext = extra ? extra.cells(s, res, classId) : "";
      if (!res) return `<td class="num">–</td><td class="num">–</td>${ext}`;
      const mine = (res.ranking || []).filter((p) => p.classId === classId);
      return `<td class="num">${mine.reduce((n, p) => n + p.correct, 0)}</td><td class="num">${tal(res.classGold?.[classId])}</td>${ext}`;
    },
  };

  /** Klassens matcher i formatet sammantaget (Statistik → Live). entries = [{ s, result }]. */
  function classSummaryHtml(entries, classId) {
    css();
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
      const tab = kategorierHtml(mode, qs, classId, "h5");
      // Samma uppgift i flera matcher (multiplikation) slås ihop för klassen.
      const sum = new Map();
      for (const q of qs) {
        const b = q.byClass?.[classId];
        if (!(b?.answered > 0)) continue;
        const k = isMult(mode) ? q.key : `${q._s.id}:${q.key}`;
        const r = sum.get(k) || { text: q.text, match: isMult(mode) ? "" : q._s.name || "", answered: 0, correct: 0 };
        r.answered += b.answered;
        r.correct += b.correct;
        sum.set(k, r);
      }
      const svar = [...sum.values()].filter((x) => x.answered >= 2 && x.correct / x.answered < 0.75)
        .sort((a, b) => a.correct / a.answered - b.correct / b.answered || b.answered - a.answered).slice(0, 5);
      if (!tab && !svar.length) continue;
      parts.push(`<div class="grh-klass"><h4>${T.summaryTitle} – ${esc(mode ? mode.displayName : modeId)}</h4>
      ${tab}
      ${svar.length ? `<h5>Klassens svåraste ${isMult(mode) ? "uppgifter" : "frågor"}</h5><table class="live-table"><thead><tr><th>${isMult(mode) ? "Uppgift" : "Fråga"}</th>${isMult(mode) ? "" : "<th>Match</th>"}<th class="num">Svar</th><th>Andel rätt</th></tr></thead>
        <tbody>${svar.map((x) => `<tr><th scope="row">${esc(x.text)}</th>${isMult(mode) ? "" : `<td>${esc(x.match)}</td>`}
          <td class="num">${x.answered}</td><td class="grh-andel">${bar(x.correct / x.answered)}</td></tr>`).join("")}</tbody></table>` : ""}</div>`);
    }
    return parts.join("");
  }

  return {
    winnerText,
    detailHtml,
    ownPlayerTable: true,
    playerCounts: (_s, result) => counts(result),
    classStats,
    classSummaryHtml,
  };
}

function fragorHtml(perQuestion, mode) {
  if (!perQuestion?.length) return `<p class="hint">Inga svar sparades.</p>`;
  const svar = hardestQuestions(perQuestion, 3);
  const svarSet = new Set(svar.map((q) => q.key));
  const rows = perQuestion.map((q) => `<tr${svarSet.has(q.key) ? ` class="grh-svar"` : ""}><th scope="row">${esc(q.text)}${svarSet.has(q.key) ? ` <span class="grh-tagg">svår</span>` : ""}</th>
      <td class="num">${q.answered}</td><td class="num">${q.correct}</td><td class="grh-andel">${bar(q.answered ? q.correct / q.answered : null)}</td></tr>`).join("");
  const tips = svar.length
    ? `<p class="hint">Svårast för klassen: ${svar.map((q) => `<b>${esc(q.text)}</b> (${procent(q.rate)})`).join(", ")}</p>`
    : "";
  return `${tips}<details class="grh-fragor"${perQuestion.length <= 15 ? " open" : ""}><summary>${isMult(mode) ? "Alla uppgifter" : "Alla frågor"} (${perQuestion.length})</summary>
    <div class="grh-scroll"><table class="live-table"><thead><tr><th>${isMult(mode) ? "Uppgift" : "Fråga"}</th><th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows}</tbody></table></div></details>`;
}

function kategorierHtml(mode, perQuestions, classId = null, tag = "h3") {
  const rows = categoryRates(perQuestions, mode?.statCategories, { classId });
  if (!rows.length) return "";
  return `<${tag}>${isMult(mode) ? "Andel rätt per tabell" : "Andel rätt per kategori"}</${tag}>
    <table class="live-table grh-kat"><thead><tr><th>${isMult(mode) ? "Tabell" : "Kategori"}</th>
      <th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="num">${r.answered}</td><td class="num">${r.correct}</td>
      <td class="grh-andel">${bar(r.rate)}</td></tr>`).join("")}</tbody></table>`;
}
