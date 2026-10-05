// ============================================================================
// Pluggporten – lärarsidan: Läsresan-elevdetalj (teacher-lasresan-elev.js)
// ----------------------------------------------------------------------------
// Modal som öppnas från Läsresan-tabellen (teacher-lasresan.js, spec §19):
//   * aktuell DOLD läsnivå (1–7) – bara läraren ser den
//   * lästa texter, frågor, rätt, fel, rätt %, värld + steg, pluggcoins
//   * statistik per frågetyp (Fakta, Ordförståelse, Mellan raderna,
//     Helhet/slutsats) som staplar – ur studentData.lasresa.catStats, så den
//     täcker ALLA elevens texter, inte bara de senaste försöken
//   * senaste genomförda texterna med resultat per text – här (och bara här)
//     läses försöken: listAttempts läser lasresaAttempts + fallback-fältet och
//     tål permission-denied (regeln är inte deployad överallt).
// Samma modal-skal (.cx-modal) och mörka tema som teacher-class-detail.js.
// All elevdata (namn, texttitlar) escapas.
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc, icon } from "./teacher-shared.js";
import { LEVEL_MAX } from "./lasresan/config.js";
import { categoryBreakdown, percent } from "./lasresan/stats.js";
import { pctLevel } from "./lasresan/teacher-rows.js";

/** Så många senaste texter visas i detaljen. */
export const RECENT_TEXTS = 10;

/** Kort datum (sv-SE) ur epoch-ms / Firestore Timestamp, annars "–". */
function dateText(v) {
  const ms = typeof v === "number" ? v : v && typeof v.toMillis === "function" ? v.toMillis() : null;
  if (!Number.isFinite(ms) || ms <= 0) return "–";
  return new Date(ms).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

/** Nyckeltalskort. */
const stat = (num, lbl, extra = "") =>
  `<div class="cx-stat ${extra}"><div class="cx-stat-num">${num}</div><div class="cx-stat-lbl">${lbl}</div></div>`;

/** Nivåmätare: LEVEL_MAX prickar, de första `level` fyllda. */
function levelPips(level) {
  let out = "";
  for (let i = 1; i <= LEVEL_MAX; i++) out += `<span class="lrt-pip${i <= level ? " on" : ""}"></span>`;
  return `<span class="lrt-pips" aria-hidden="true">${out}</span>`;
}

/** Nyckeltalsrutnätet (8 kort, 2 rader). */
function statsGridHtml(row) {
  const s = row.started;
  const dash = `<span class="lrt-dash">–</span>`;
  const worlds = row.completedWorlds.length;
  return `<div class="cx-stat-grid lrt-stat-grid">
    ${stat(
      `${row.level}<span class="cx-stat-of">/${LEVEL_MAX}</span>${levelPips(row.level)}`,
      s ? "dold Läsresan-nivå" : "startnivå (ej börjat)",
      "lrt-stat-level"
    )}
    ${stat(s ? row.texts : dash, "lästa texter")}
    ${stat(s ? row.questions : dash, "frågor")}
    ${stat(row.pct == null ? dash : `${row.pct}%`, "rätt", `lrt-pct ${pctLevel(row.pct)}`)}
    ${stat(s ? row.correct : dash, "rätt svar")}
    ${stat(s ? row.incorrect : dash, "fel svar")}
    ${stat(
      `${esc(row.worldName)} <span class="cx-stat-of">${row.stepInWorld}/${row.steps}</span>`,
      worlds ? `värld · steg (${worlds} ${worlds === 1 ? "värld" : "världar"} klar${worlds === 1 ? "" : "a"})` : "värld · steg",
      "lrt-stat-world"
    )}
    ${stat(s ? row.money : dash, "pluggcoins via Läsresan")}
  </div>`;
}

/** Staplar per frågetyp. Tom-tillstånd när eleven inte svarat på något. */
export function categoryHtml(catStats) {
  const cats = categoryBreakdown(catStats);
  if (!cats.some((c) => c.q > 0)) {
    return `<p class="hint lrt-empty">Ingen statistik per frågetyp än – den fylls på när eleven läser texter.</p>`;
  }
  const rows = cats
    .map((c) => {
      const has = c.q > 0;
      const lvl = has ? pctLevel(c.pct) : "tom";
      return `<div class="lrt-cat ${lvl}">
        <div class="lrt-cat-head">
          <span class="lrt-cat-name">${esc(c.label)}</span>
          <span class="lrt-cat-val">${has ? `<b>${c.pct}%</b> <span class="lrt-of">${c.correct}/${c.q} rätt</span>` : `<span class="lrt-of">inga frågor än</span>`}</span>
        </div>
        <div class="lrt-bar" role="img" aria-label="${esc(c.label)}: ${has ? `${c.pct} procent rätt` : "inga frågor än"}">
          <span style="width:${has ? c.pct : 0}%"></span>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="lrt-cats">${rows}</div>`;
}

/** Tabell över senaste genomförda texter (nyast först). */
export function attemptsHtml(attempts) {
  const list = (attempts || []).filter(Boolean).slice(0, RECENT_TEXTS);
  if (list.length === 0) return `<p class="hint lrt-empty">Inga genomförda texter än.</p>`;
  const rows = list
    .map((a) => {
      const total = Number(a.totalQuestions) || 0;
      const correct = Number(a.correct) || 0;
      const pct = Number.isFinite(a.percentage) ? a.percentage : percent(correct, total);
      return `<tr>
        <td class="lrt-att-title">${esc(a.title || a.textId || "Okänd text")}</td>
        <td class="lrt-num">${Number.isFinite(a.textLevel) ? a.textLevel : "–"}</td>
        <td class="lrt-num">${correct}<span class="lrt-of">/${total}</span></td>
        <td class="lrt-num lrt-pct ${pctLevel(pct)}">${pct}%</td>
        <td class="lrt-num lrt-date">${esc(dateText(a.completedAt))}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-scroll"><table class="tbl lrt-att-tbl">
    <thead><tr><th>Text</th><th class="lrt-num">Nivå</th><th class="lrt-num">Rätt</th>
      <th class="lrt-num">%</th><th class="lrt-num">Datum</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/**
 * Öppna Läsresan-detaljen för en elev.
 * @param {object} student  { id, namn, username, avatarId }
 * @param {{ row: object, lasresa: (object|null),
 *   loadAttempts: (studentId:string, max:number) => Promise<object[]> }} opts
 *   `row` = elevens rad ur teacherClassRows (redan beräknad i tabellen).
 */
export function openLasresanDetail(student, { row, lasresa, loadAttempts }) {
  const name = student.namn || student.username || student.id;
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lrt-modal" role="dialog" aria-modal="true"
      aria-label="Läsresan – ${esc(name)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div>
          <h2 class="cx-modal-name">${esc(name)}</h2>
          <p class="cx-modal-sub">${icon("book", 14)} Läsresan${student.username ? " · " + esc(student.username) : ""}</p>
        </div>
      </div>
      <div class="cx-modal-body">
        ${statsGridHtml(row)}
        <p class="lrt-hidden-note">${icon("eye", 14)} Läsresan-nivån är dold för eleven – den styr bara vilka texter som väljs.</p>
        <div class="cx-detail-sec">
          <h3>Per frågetyp</h3>
          ${categoryHtml(lasresa && lasresa.catStats)}
        </div>
        <div class="cx-detail-sec">
          <h3>Senaste texterna</h3>
          <div class="lrt-attempts">${
            row.started ? `<div class="spinner">Laddar texter…</div>` : `<p class="hint lrt-empty">Eleven har inte börjat Läsresan än.</p>`
          }</div>
        </div>
      </div>
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
  overlay.querySelector(".cx-modal-close").focus();

  // Försöken läses bara för den här eleven, och bara om den har börjat.
  if (row.started) {
    const host = overlay.querySelector(".lrt-attempts");
    Promise.resolve()
      .then(() => loadAttempts(student.id, RECENT_TEXTS))
      .then((attempts) => {
        if (overlay.isConnected) host.innerHTML = attemptsHtml(attempts);
      })
      .catch((err) => {
        console.warn("[Läsresan] kunde inte läsa försök", err);
        if (overlay.isConnected) {
          host.replaceChildren(el(`<div class="msg error">Kunde inte ladda texterna: ${esc(err.message)}</div>`));
        }
      });
  }
  return { close };
}
