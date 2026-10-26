// ============================================================================
// Meteorstormen ☄️ – HISTORIKEN och Statistik → Live (#823, spec §6). Laddas
// LATT av teacher-live-history.js via historyRenderer(). Allt ur serverns
// result (msAvsluta, docs/METEORSTORMEN.md §8.4) – inga extra läsningar.
//
// En match: vinnaren (eller stjärnorna i En klass), stationerna (skrov kvar,
// nedskjutna, träffar, kastade meteorer, bästa ögonblicken), handlingar per
// sort (🛡️ 🔫 🌀 ⚡ + nekade), eleverna (rätt, svar, andel rätt, handlingar,
// nedskjutna, pluggmynt – ingen placeringskolumn) och andel rätt per fråga
// och per tabell/kategori (som kistspelets historik).
// Statistik → Live: klassens rad Rätt · Skrov · Utfall + sammanfattning per
// tabell/kategori och klassens svåraste frågor.
//
// API (historyRenderer-kontraktet, teacher-live-history.js)
//   winnerText(s, result) · detailHtml(s, result) · ownPlayerTable
//   playerCounts(s, result) · classStats · classSummaryHtml(entries, classId)
//   settle(s, deps?)  → Promise – klasspokalerna och Live-priset till klasskassan
//                     (idempotenta) när läraren (admin) öppnar matchen: täcker
//                     matcher där en elevs msAvsluta skrev result (#823 G1)
//   + utfallText(s, result, classId), stationerHtml, handlingarHtml, eleverHtml,
//     fragorHtml (exporterade för testerna)
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { coinIcon } from "../../../icons.js";
import { getGameMode } from "../../modes/index.js";
import { ensureLiveCss } from "../../live-css.js";
import { categoryRates } from "../snilleblixt/sb-historik-data.js";
import { hardestQuestions, playerCounts as counts } from "../../kistspel/ks-historik-data.js";

const CSS = "src/live/formats/meteorstorm/meteorstorm-historik.css";
const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const procent = (r) => (r == null ? "–" : `${Math.round(r * 100)} %`);
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const className = (s, id) => s?.classNames?.[id] || id || "";
const isMult = (mode) => !!mode?.id?.startsWith("multiplication");
const STJ = (n) => "⭐".repeat(int(n)) + "☆".repeat(Math.max(0, 3 - int(n)));
const KIND = { choice: "🔘 Flerval", free: "✍️ Skriv själv" };
const ATTACKER = { av: "attacker av", milda: "milda attacker", vilda: "vilda attacker" };
const OGONBLICK = {
  nedskjutna: (o) => `🔫 Flest nedskjutna: <b>${esc(o.namn)}</b> (${tal(o.antal)})`,
  sista: (o) => `⏱️ Räddade stationen i sista stund: <b>${esc(o.namn)}</b>`,
  skold: (o) => `🛡️ Flest sköldtryck: <b>${esc(o.namn)}</b> (${tal(o.antal)})`,
  kast: (o) => `🌀 Flest kastade meteorer: <b>${esc(o.namn)}</b> (${tal(o.antal)})`,
};

function bar(r) {
  const p = r == null ? 0 : Math.round(r * 100);
  const ton = r == null ? "" : r < 0.5 ? " msh-lag" : r < 0.75 ? " msh-mellan" : "";
  return `<span class="msh-bar${ton}" role="img" aria-label="${procent(r)}"><i style="width:${p}%"></i></span> <b>${procent(r)}</b>`;
}

export function winnerText(s, result) {
  if (!result?.placering?.length) return "–";
  if (result.lage === "en-klass") {
    const id = result.placering[0].classId;
    return result.overlevde === false || !int(result.stjarnor) ? `🛰️ ${esc(className(s, id))}` : `${STJ(result.stjarnor)} ${esc(className(s, id))}`;
  }
  if (result.draw || !result.winner) return "🤝 Oavgjort";
  return `☄️ ${esc(className(s, result.winner))}`;
}

/** Klassens utfall: "Vann" / "Oavgjort" / "2:a av 2" (lärarvyn) / "⭐⭐☆". */
export function utfallText(_s, result, classId) {
  if (!result?.placering?.length) return "–";
  if (result.lage === "en-klass") return int(result.stjarnor) ? STJ(result.stjarnor) : "🛰️";
  if (result.draw) return "Oavgjort";
  if (result.winner === classId) return "🏆 Vann";
  const p = result.placering.find((x) => x.classId === classId);
  return p ? `${p.plats}:a av ${result.placering.length}` : "–";
}

export function stationerHtml(s, result) {
  const rader = (result?.placering || []).map((p) => {
    const c = result.perClass?.[p.classId] || {};
    const vann = result.lage !== "en-klass" && result.winner === p.classId;
    const ogon = (c.ogonblick || []).filter((o) => OGONBLICK[o.typ]).map((o) => `<li>${OGONBLICK[o.typ](o)}</li>`).join("");
    return `<li class="msh-station${vann ? " msh-vann" : ""}">
      <span class="msh-station-namn">${vann ? "🏆 " : ""}${esc(className(s, p.classId))}</span>
      <span class="msh-skrov"><span class="msh-bar${p.skrov <= 25 ? " msh-lag" : p.skrov <= 50 ? " msh-mellan" : ""}" role="img" aria-label="Skrov ${int(p.skrov)} av 100"><i style="width:${int(p.skrov)}%"></i></span> <b>${int(p.skrov)} %</b> skrov kvar</span>
      <small>☄️ ${tal(p.nedskjutna)} nedskjutna · 💥 ${tal(c.traffar)} träffar · 🌀 ${tal(c.kastade)} kastade · ${tal(c.players)} elever</small>
      ${ogon ? `<ul class="msh-ogonblick">${ogon}</ul>` : ""}</li>`;
  }).join("");
  return rader ? `<ul class="msh-stationer">${rader}</ul>` : "";
}

export function handlingarHtml(s, result) {
  const h = result?.handlingar || {};
  const ids = s?.participatingClassIds || [];
  const perKlass = ids.length > 1
    ? `<div class="msh-scroll"><table class="live-table msh-handl"><thead><tr><th>Klass</th><th class="num">🛡️ Sköld</th><th class="num">🔫 Laser</th><th class="num">🌀 Drag</th><th class="num">⚡ Sparat</th></tr></thead>
      <tbody>${ids.map((id) => {
        const k = result?.perClass?.[id]?.handlingar || {};
        return `<tr><th scope="row">${esc(className(s, id))}</th><td class="num">${tal(k.skold)}</td><td class="num">${tal(k.laser)}</td><td class="num">${tal(k.drag)}</td><td class="num">${tal(k.spara)}</td></tr>`;
      }).join("")}</tbody></table></div>`
    : "";
  return `<ul class="msh-summor" aria-label="Handlingar per sort">
      <li><span>🛡️ Sköld</span><b>${tal(h.skold)}</b></li>
      <li><span>🔫 Laser</span><b>${tal(h.laser)}</b></li>
      <li><span>🌀 Dragstråle</span><b>${tal(h.drag)}</b></li>
      <li><span>⚡ Sparad energi</span><b>${tal(h.spara)}</b><small>${tal(result?.nekade)} nekade val</small></li>
    </ul>${perKlass}`;
}

export function eleverHtml(s, result) {
  const rw = result?.rewards;
  const flera = (s?.participatingClassIds || []).length > 1;
  const rader = [...(result?.ranking || [])]
    .sort((a, b) => String(a.classId).localeCompare(String(b.classId)) || String(a.name || "").localeCompare(String(b.name || ""), "sv"))
    .map((p) => {
      const h = p.handlingar || {};
      const svar = int(p.answered);
      return `<tr><th scope="row">${esc(p.name || "?")}</th>${flera ? `<td>${esc(className(s, p.classId))}</td>` : ""}
        <td class="num">${tal(p.correct)}</td><td class="num">${tal(svar)}</td><td class="msh-andel">${bar(svar ? int(p.correct) / svar : null)}</td>
        <td class="num">${tal(h.skold)}</td><td class="num">${tal(h.laser)}</td><td class="num">${tal(h.drag)}</td><td class="num">${tal(p.bidrag?.nedskjutna)}</td>
        ${rw ? `<td class="num">${rw[p.uid] ? tal(rw[p.uid].total) : "–"}</td>` : ""}</tr>`;
    }).join("");
  if (!rader) return `<p class="hint">Inga elever anslöt.</p>`;
  return `<div class="msh-scroll"><table class="live-table"><thead><tr><th>Elev</th>${flera ? "<th>Klass</th>" : ""}
      <th class="num">Rätt</th><th class="num">Svar</th><th>Andel rätt</th><th class="num">🛡️</th><th class="num">🔫</th><th class="num">🌀</th>
      <th class="num">☄️ Nedskjutna</th>${rw ? `<th class="num">${coinIcon("1em")} Pluggmynt</th>` : ""}</tr></thead>
    <tbody>${rader}</tbody></table></div>`;
}

export function fragorHtml(perQuestion, mode) {
  if (!perQuestion?.length) return `<p class="hint">Inga svar sparades.</p>`;
  const svar = hardestQuestions(perQuestion, 3);
  const svarSet = new Set(svar.map((q) => q.key));
  const rows = perQuestion.map((q) => `<tr${svarSet.has(q.key) ? ` class="msh-svar"` : ""}><th scope="row">${esc(q.text)}${svarSet.has(q.key) ? ` <span class="msh-tagg">svår</span>` : ""}</th>
      <td class="num">${q.answered}</td><td class="num">${q.correct}</td><td class="msh-andel">${bar(q.answered ? q.correct / q.answered : null)}</td></tr>`).join("");
  const tips = svar.length
    ? `<p class="hint">Svårast: ${svar.map((q) => `<b>${esc(q.text)}</b> (${procent(q.rate)})`).join(", ")}</p>`
    : "";
  return `${tips}<details class="msh-fragor"${perQuestion.length <= 15 ? " open" : ""}><summary>${isMult(mode) ? "Alla uppgifter" : "Alla frågor"} (${perQuestion.length})</summary>
    <div class="msh-scroll"><table class="live-table"><thead><tr><th>${isMult(mode) ? "Uppgift" : "Fråga"}</th><th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows}</tbody></table></div></details>`;
}

function kategorierHtml(mode, perQuestions, classId = null, tag = "h3") {
  const rows = categoryRates(perQuestions, mode?.statCategories, { classId });
  if (!rows.length) return "";
  return `<${tag}>${isMult(mode) ? "Andel rätt per tabell" : "Andel rätt per kategori"}</${tag}>
    <div class="msh-scroll"><table class="live-table msh-kat"><thead><tr><th>${isMult(mode) ? "Tabell" : "Kategori"}</th>
      <th class="num">Svar</th><th class="num">Rätt</th><th>Andel rätt</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="num">${r.answered}</td><td class="num">${r.correct}</td>
      <td class="msh-andel">${bar(r.rate)}</td></tr>`).join("")}</tbody></table></div>`;
}

export function detailHtml(s, result) {
  ensureLiveCss([CSS]);
  if (!result?.placering?.length) return `<p class="live-history-winner">☄️</p><p class="hint">Inget resultat ännu – servern räknar fram stormen när matchen är slut.</p>`;
  const mode = getGameMode(s.gameMode);
  const inst = s.msInstallningar || {};
  const lage = result.lage === "en-klass" ? "En klass" : `Klass mot klass · ${ATTACKER[inst.attacker] || ""}`;
  const info = `<small class="hint">${KIND[s.answerKind] || ""} · ${lage} · totalt ${tal(result.totalCorrect)} rätt av ${tal(result.totalAnswered)} svar</small>`;
  const rubrik = result.lage === "en-klass"
    ? `${winnerText(s, result)} ${result.overlevde === false ? "Stationen flyter i rymden" : "Stationen överlevde!"}`
    : result.draw || !result.winner ? "🤝 Oavgjort" : `☄️ ${esc(className(s, result.winner))} vann Meteorstormen!`;
  return `<p class="live-history-winner">${rubrik} ${info}</p>
    ${stationerHtml(s, result)}
    <h3>Handlingar</h3>
    ${handlingarHtml(s, result)}
    <h3>Elever</h3>
    ${eleverHtml(s, result)}
    <h3>Andel rätt per ${isMult(mode) ? "uppgift" : "fråga"}</h3>
    ${fragorHtml(result.perQuestion, mode)}
    ${result.perQuestion ? kategorierHtml(mode, result.perQuestion) : ""}`;
}

export const ownPlayerTable = true;

/**
 * Klasscentret om ingen lärarflik fanns vid slutet (#823 G1): pokalerna och
 * Live-priset är idempotenta (deterministiska id) – samma anrop som
 * live-data.js writeResultIfMissing. Klassbonusen (inte idempotent) delas
 * inte ut här. Bara admin skriver klasscentret (#678). Aldrig kastande.
 */
export async function settle(s, deps = null) {
  if (!s?.id || !s.result || s.status !== "finished" || s.demo === true) return;
  try {
    const admin = deps?.admin || (await import("../../../auth.js")).isAdmin;
    if (!admin()) return;
    const m = deps?.klass ? await deps.klass() : await import("../../../klasscenter/kc-koppling.js");
    await m.pokalerEfterAvslut("live", s.id, s);
    await m.livePrisEfterAvslut(s.id, s);
  } catch (err) {
    console.warn("[meteorstorm] klasscentret i historiken hoppades över", s.id, err?.code || err);
  }
}

export function playerCounts(_s, result) {
  return counts(result);
}

export const classStats = {
  cols: 3,
  head: `<th class="num">Rätt</th><th class="num">Skrov</th><th>Utfall</th>`,
  cells(s, res, classId) {
    if (!res?.placering?.length) return `<td class="num">–</td><td class="num">–</td><td>–</td>`;
    const c = res.perClass?.[classId];
    const p = res.placering.find((x) => x.classId === classId);
    return `<td class="num">${tal(c?.correct)}</td><td class="num">${p ? `${int(p.skrov)} %` : "–"}</td><td>${utfallText(s, res, classId)}</td>`;
  },
};

/** Klassens Meteorstorm-matcher sammantaget (Statistik → Live). entries = [{ s, result }]. */
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
    parts.push(`<div class="msh-klass"><h4>☄️ Meteorstormen – ${esc(mode ? mode.displayName : modeId)}</h4>
      ${tab}
      ${svar.length ? `<h5>Klassens svåraste ${isMult(mode) ? "uppgifter" : "frågor"}</h5><div class="msh-scroll"><table class="live-table"><thead><tr><th>${isMult(mode) ? "Uppgift" : "Fråga"}</th>${isMult(mode) ? "" : "<th>Match</th>"}<th class="num">Svar</th><th>Andel rätt</th></tr></thead>
        <tbody>${svar.map((x) => `<tr><th scope="row">${esc(x.text)}</th>${isMult(mode) ? "" : `<td>${esc(x.match)}</td>`}
          <td class="num">${x.answered}</td><td class="msh-andel">${bar(x.correct / x.answered)}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`);
  }
  return parts.join("");
}
