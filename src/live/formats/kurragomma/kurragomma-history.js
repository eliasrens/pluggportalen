// ============================================================================
// Kurragömma 🙈 – HISTORIKEN och Statistik → Live (#840, spec §11.3). Laddas
// LATT av teacher-live-history.js via historyRenderer(). Allt ur serverns
// result (kgAvsluta, docs/KURRAGOMMA.md §10.3) – utom "varav utlösta av
// läraren": result ligger på sessionen som eleverna läser, så den summan
// skrivs aldrig dit (#840 F1). Historiken räknar i stället kgEvents med
// larare: true (EN räknefråga = 1 läsning per öppnad match; bara lärare får
// läsa kgEvents – elever nekas av reglerna).
//
// En match, som Guldrushens: pallplats (delad placering), topplista med
// pluggmynt, andel rätt per uppgift/fråga och per tabell/kategori (statKeys)
// – plus hur många som klarade sig, antal visslingar (varav utlösta av
// läraren – BARA här, aldrig på projektorn eller elevens skärm) och den som
// hittade flest. Statistik → Live: klassens rad Rätt · Klarade sig · Hittade ·
// Visslingar + sammanfattning per tabell/kategori och klassens svåraste frågor.
//
// API (historyRenderer-kontraktet, teacher-live-history.js)
//   winnerText(s, result) · detailHtml(s, result, deps?) → Promise<html>
//     deps.visslingarLarare: färdig summa (testerna); annars kurragomma-data
//     antalLarareVisslingar(s.id) – misslyckas läsningen visas "–"
//   ownPlayerTable · playerCounts(s, result) · classStats · classSummaryHtml(entries, classId)
//   settle(s)  → kgAvsluta + pluggmynten om lärarfliken stängdes vid slutet
//   + utfallText(result, uid), summorHtml(result, visslingarLarare), pallHtml,
//     topplistaHtml, fragorHtml (exporterade för testerna)
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { coinIcon } from "../../../icons.js";
import { getGameMode } from "../../modes/index.js";
import { ensureLiveCss } from "../../live-css.js";
import { categoryRates } from "../snilleblixt/sb-historik-data.js";
import { hardestQuestions, podiumGroups } from "../../kistspel/ks-historik-data.js";
import { lugnRad } from "./kgp-logik.js";
import { avslutaOchBetala } from "./kg-avslut.js";

const CSS = "src/live/formats/kurragomma/kurragomma-historik.css";
const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const procent = (r) => (r == null ? "–" : `${Math.round(r * 100)} %`);
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const className = (s, id) => s?.classNames?.[id] || id || "";
const isMult = (mode) => !!mode?.id?.startsWith("multiplication");
const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };

function bar(r) {
  const p = r == null ? 0 : Math.round(r * 100);
  const ton = r == null ? "" : r < 0.5 ? " kgh-lag" : r < 0.75 ? " kgh-mellan" : "";
  return `<span class="kgh-bar${ton}" role="img" aria-label="${procent(r)}"><i style="width:${p}%"></i></span> <b>${procent(r)}</b>`;
}

export function winnerText(_s, result) {
  if (!result?.ranking) return "–";
  const k = int(result.klaradeSig);
  return k ? `🙈 ${k} klarade sig` : "🔎 Sökarna hittade alla";
}

/** Elevens utfall: klarade sig gömd, hittad (blev sökare) eller sökare från start. */
export function utfallText(result, uid) {
  const r = (result?.ranking || []).find((p) => p.uid === uid);
  if (!r) return "–";
  if (r.klaradeSig) return "🙈 Klarade sig";
  const g = (result?.gomstallen || []).find((x) => x.uid === uid);
  if (g?.hittad) return "🔎 Hittad";
  return "🔦 Sökare";
}

/** Rutorna: klarade sig, hittade, visslingar (varav läraren – ur kgEvents, null = kunde inte läsas), den som hittade flest. */
export function summorHtml(result, visslingarLarare = null) {
  const n = (result?.ranking || []).length;
  const larare = visslingarLarare == null ? null : int(visslingarLarare);
  const flest = result?.flestHittade;
  const varav = larare == null ? "varav läraren: –" : larare ? `varav ${tal(larare)} av läraren` : "ingen av läraren";
  return `<ul class="kgh-summor" aria-label="Matchen i siffror">
      <li><span>🙈 Klarade sig</span><b>${tal(result?.klaradeSig)}</b><small>av ${tal(n)} elever</small></li>
      <li><span>🔎 Hittade</span><b>${tal(result?.hittade)}</b><small>gömmare</small></li>
      <li><span>🎵 Visslingar</span><b>${tal(result?.visslingar)}</b><small>${varav}</small></li>
      <li><span>🏅 Hittade flest</span><b>${flest ? esc(flest.name || "Någon") : "–"}</b><small>${flest ? `${tal(flest.antal)} st` : "ingen hittade någon"}</small></li>
    </ul>`;
}

export function pallHtml(result) {
  const groups = podiumGroups((result?.ranking || []).map((p) => ({ ...p, gold: int(p.poang) })));
  if (!groups.length) return "";
  return `<ol class="kgh-pall" aria-label="Pallplats">${groups.map((g) => `<li class="kgh-pall-${g.rank}">
      <span class="kgh-medalj" aria-hidden="true">${MEDALJ[g.rank]}</span>
      <b>${g.players.map((p) => esc(p.name || "?")).join(" & ")}</b>
      <small>${g.players.length > 1 ? `delad ${g.rank}:a · ` : `${g.rank}:a · `}${tal(g.players[0].poang)} p</small></li>`).join("")}</ol>`;
}

export function topplistaHtml(s, result) {
  const rw = result?.rewards;
  const flera = (s?.participatingClassIds || []).length > 1;
  const rader = (result?.ranking || []).map((p) => `<tr${p.rank === 1 && int(p.poang) > 0 ? ` class="live-win"` : ""}><td class="num">${int(p.poang) > 0 ? p.rank : "–"}</td>
      <th scope="row">${esc(p.name || "?")}</th>${flera ? `<td>${esc(className(s, p.classId))}</td>` : ""}
      <td>${utfallText(result, p.uid)}</td><td class="num"><b>${tal(p.poang)}</b></td>
      <td class="num">${tal(p.ratt)}</td><td class="num">${tal(p.besvarade)}</td><td class="num">${tal(p.hittade)}</td>
      ${rw ? `<td class="num">${rw[p.uid] ? tal(rw[p.uid].total) : "–"}</td>` : ""}</tr>`).join("");
  if (!rader) return `<p class="hint">Inga elever anslöt.</p>`;
  return `<div class="kgh-scroll"><table class="live-table"><thead><tr><th class="num">Plats</th><th>Elev</th>${flera ? "<th>Klass</th>" : ""}
      <th>Utfall</th><th class="num">Poäng</th><th class="num">Rätt</th><th class="num">Svar</th><th class="num">Hittade</th>
      ${rw ? `<th class="num">${coinIcon("1em")} Pluggmynt</th>` : ""}</tr></thead>
    <tbody>${rader}</tbody></table></div>`;
}

export function fragorHtml(perQuestion, mode) {
  if (!perQuestion?.length) return `<p class="hint">Inga svar sparades.</p>`;
  const svar = hardestQuestions(perQuestion, 3);
  const svarSet = new Set(svar.map((q) => q.key));
  const rows = perQuestion.map((q) => `<tr${svarSet.has(q.key) ? ` class="kgh-svar"` : ""}><th scope="row">${esc(q.text)}${svarSet.has(q.key) ? ` <span class="kgh-tagg">svår</span>` : ""}</th>
      <td class="num">${q.answered}</td><td class="num">${q.correct}</td><td class="kgh-andel">${bar(q.answered ? q.correct / q.answered : null)}</td></tr>`).join("");
  const tips = svar.length
    ? `<p class="hint">Svårast: ${svar.map((q) => `<b>${esc(q.text)}</b> (${procent(q.rate)})`).join(", ")}</p>`
    : "";
  return `${tips}<details class="kgh-fragor"${perQuestion.length <= 15 ? " open" : ""}><summary>${isMult(mode) ? "Alla uppgifter" : "Alla frågor"} (${perQuestion.length})</summary>
    <div class="kgh-scroll"><table class="live-table"><thead><tr><th>${isMult(mode) ? "Uppgift" : "Fråga"}</th><th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows}</tbody></table></div></details>`;
}

function kategorierHtml(mode, perQuestions, classId = null, tag = "h3") {
  const rows = categoryRates(perQuestions, mode?.statCategories, { classId });
  if (!rows.length) return "";
  return `<${tag}>${isMult(mode) ? "Andel rätt per tabell" : "Andel rätt per kategori"}</${tag}>
    <div class="kgh-scroll"><table class="live-table kgh-kat"><thead><tr><th>${isMult(mode) ? "Tabell" : "Kategori"}</th>
      <th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="num">${r.answered}</td><td class="num">${r.correct}</td>
      <td class="kgh-andel">${bar(r.rate)}</td></tr>`).join("")}</tbody></table></div>`;
}

/** "Varav läraren" ur kgEvents (bara lärare får läsa) – null när läsningen misslyckas. */
async function larareVisslingar(s, deps) {
  if (deps?.visslingarLarare != null) return deps.visslingarLarare;
  try {
    return await (await import("./kurragomma-data.js")).antalLarareVisslingar(s.id);
  } catch {
    return null;
  }
}

export async function detailHtml(s, result, deps) {
  ensureLiveCss([CSS]);
  if (!result?.ranking) return `<p class="live-history-winner">🙈</p><p class="hint">Inget resultat ännu – servern räknar ihop matchen när den är slut.</p>`;
  const larare = await larareVisslingar(s, deps);
  const mode = getGameMode(s?.gameMode);
  const inst = s?.kgInstallningar || {};
  const info = `<small class="hint">${KIND[s?.answerKind] || ""} · gömtid ${tal(inst.gomtid)} s · startsökare ${inst.startsokare === "auto" || inst.startsokare == null ? "auto" : tal(inst.startsokare)}
    · tystnadsregeln ${inst.tystnad === false ? "av" : "på"} · totalt ${tal(result.totalCorrect)} rätt av ${tal(result.totalAnswered)} svar</small>`;
  return `<p class="live-history-winner">🙈 ${esc(lugnRad(result))} ${info}</p>
    ${summorHtml(result, larare)}
    ${pallHtml(result)}
    <h3>Topplista</h3>
    ${topplistaHtml(s, result)}
    <h3>Andel rätt per ${isMult(mode) ? "uppgift" : "fråga"}</h3>
    ${fragorHtml(result.perQuestion, mode)}
    ${result.perQuestion ? kategorierHtml(mode, result.perQuestion) : ""}`;
}

export const ownPlayerTable = true;

/** Historikens nya försök (lärarfliken stängdes vid slutet): kgAvsluta + pluggmynten (idempotent). */
export async function settle(s) {
  return avslutaOchBetala(s);
}

export function playerCounts(_s, result) {
  const out = new Map();
  for (const p of result?.ranking || []) out.set(p.uid, { correct: int(p.ratt), incorrect: Math.max(0, int(p.besvarade) - int(p.ratt)) });
  return out;
}

export const classStats = {
  cols: 4,
  head: `<th class="num">Rätt</th><th class="num">Klarade sig</th><th class="num">Hittade</th><th class="num">Visslingar</th>`,
  cells(_s, res, classId) {
    if (!res?.ranking) return `<td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td>`;
    const mine = res.ranking.filter((p) => p.classId === classId);
    const hittade = mine.filter((p) => (res.gomstallen || []).find((g) => g.uid === p.uid)?.hittad).length;
    // Visslingarna är matchens (en klass per match – ingen klass på händelserna).
    return `<td class="num">${tal(mine.reduce((n, p) => n + int(p.ratt), 0))}</td><td class="num">${tal(mine.filter((p) => p.klaradeSig).length)}</td>
      <td class="num">${tal(hittade)}</td><td class="num">${tal(res.visslingar)}</td>`;
  },
};

/** Klassens Kurragömma-matcher sammantaget (Statistik → Live). entries = [{ s, result }]. */
export function classSummaryHtml(entries, classId) {
  ensureLiveCss([CSS]);
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
    parts.push(`<div class="kgh-klass"><h4>🙈 Kurragömma – ${esc(mode ? mode.displayName : modeId)}</h4>
      ${tab}
      ${svar.length ? `<h5>Klassens svåraste ${isMult(mode) ? "uppgifter" : "frågor"}</h5><div class="kgh-scroll"><table class="live-table"><thead><tr><th>${isMult(mode) ? "Uppgift" : "Fråga"}</th>${isMult(mode) ? "" : "<th>Match</th>"}<th class="num">Svar</th><th>Andel rätt</th></tr></thead>
        <tbody>${svar.map((x) => `<tr><th scope="row">${esc(x.text)}</th>${isMult(mode) ? "" : `<td>${esc(x.match)}</td>`}
          <td class="num">${x.answered}</td><td class="kgh-andel">${bar(x.correct / x.answered)}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`);
  }
  return parts.join("");
}
