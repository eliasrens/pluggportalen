// ============================================================================
// Pluggporten – lärarsidan: Plugga-djupdykning per elev (teacher-plugga-elev.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #446: modal som öppnas från "Per område"-tabellen
// (teacher-plugga.js). För det valda urvalet (ett område eller hela ämnet):
//   * nyckeltal: klarade övningar, rätt-%, stjärnor av möjliga, senast aktiv
//   * rätt-% PER FRÅGEKATEGORI (Begreppsförståelse, Fakta, Analys…) som staplar
//     med rådata (r/t) – svagaste kategorin markeras "Behöver stöd", starkaste
//     "Starkast", och en rad överst säger var stödet behövs
//   * per spelläge: stjärnor (uppdelade ★★☆), klarad, omgångar och rätt-% där
//     läget har kategoriserade frågor
//   * fallback för områden utan kategorier: per spelläge + diskret notis
// Allt ur raden som summarizeClass (plugga-stats.js) redan räknat – inga nya
// läsningar. Samma modal-skal (.cx-modal) och mörka tema som Läsresan-detaljen
// (teacher-lasresan-elev.js). All elevdata escapas.
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc, icon } from "./teacher-shared.js";
import { ALL_MODES } from "./gamemode-visibility.js";
import { MAX_STARS_PER_MODE } from "./plugga-stats.js";
import { lastActiveText, pctLevel, weakStrong } from "./plugga-teacher-rows.js";

const dash = `<span class="lrt-dash">–</span>`;

/** Nyckeltalskort (samma som Läsresan-detaljen). */
const stat = (num, lbl, extra = "") =>
  `<div class="cx-stat ${extra}"><div class="cx-stat-num">${num}</div><div class="cx-stat-lbl">${lbl}</div></div>`;

/** Lägets namn + emoji ur katalogen (okänt läge → id:t). */
function modeMeta(id) {
  const m = ALL_MODES.find((x) => x.id === id);
  return m ? { name: m.name, emoji: m.emoji } : { name: id, emoji: "🎮" };
}

/** "★★☆" – fyllda + tomma stjärnor (ett lägets max är 3). */
function starRow(stars, max) {
  const on = Math.max(0, Math.min(stars, max));
  return `<span class="pp-starrow" aria-label="${stars} av ${max} stjärnor">${"★".repeat(on)}<span class="off">${"★".repeat(max - on)}</span></span>`;
}

function statsGridHtml(row) {
  const lp = row.lastPlayed;
  return `<div class="cx-stat-grid lrt-stat-grid">
    ${stat(row.active ? `${row.completed}<span class="cx-stat-of">/${row.played}</span>` : dash, "klarade övningar")}
    ${stat(row.pct == null ? dash : `${row.pct}%`, row.answered ? `rätt (${row.correct}/${row.answered} frågor)` : "rätt", `lrt-pct ${pctLevel(row.pct)}`)}
    ${stat(`${row.stars}<span class="cx-stat-of">/${row.possibleStars}</span> ★`, `stjärnor${row.possibleStarPct == null ? "" : ` (${row.possibleStarPct}% av möjliga)`}`)}
    ${stat(`<span class="cx-stat-when">${lp ? esc(lastActiveText(lp)) : "aldrig"}</span>`, "senast aktiv")}
  </div>`;
}

/**
 * Staplar per kategori med svagast/starkast-markering. Tom-tillstånd när
 * eleven saknar kategoriserade svar i urvalet.
 * @param {object} row  rad ur pluggaTeacherRows
 * @param {string} name  elevens namn (för stöd-raden)
 */
export function categoryHtml(row, name) {
  if (!row.hasCategoryData) {
    return `<p class="pp-note">${icon("sparkle", 14)} ${
      row.active
        ? "Inga frågor med kategori besvarade här än – nyare innehåll ger statistik per kategori. Se resultatet per spelläge nedan."
        : "Eleven har inte spelat i det här urvalet än."
    }</p>`;
  }
  const { weakest, strongest } = weakStrong(row.perCategory);
  const weak = row.perCategory.find((c) => c.key === weakest);
  const callout = weak
    ? `<p class="pp-callout ${pctLevel(weak.pct)}">${weak.icon} <b>${esc(weak.label)}</b> är svagast (${weak.pct} %) –
        här behöver ${esc(name)} mest stöd.</p>`
    : "";
  const bars = row.perCategory
    .map((c) => {
      const has = c.t > 0;
      const badge =
        c.key === weakest
          ? `<span class="pp-badge weak">Behöver stöd</span>`
          : c.key === strongest
            ? `<span class="pp-badge strong">Starkast</span>`
            : "";
      return `<div class="lrt-cat ${has ? pctLevel(c.pct) : "tom"}${c.key === weakest ? " pp-weakest" : ""}" data-cat="${esc(c.key)}">
        <div class="lrt-cat-head">
          <span class="lrt-cat-name">${c.icon} ${esc(c.label)} ${badge}</span>
          <span class="lrt-cat-val">${
            has ? `<b>${c.pct}%</b> <span class="lrt-of">${c.r}/${c.t} rätt</span>` : `<span class="lrt-of">inga frågor än</span>`
          }</span>
        </div>
        <div class="lrt-bar" role="img" aria-label="${esc(c.label)}: ${has ? `${c.pct} procent rätt` : "inga frågor än"}">
          <span style="width:${has ? c.pct : 0}%"></span>
        </div>
      </div>`;
    })
    .join("");
  return `${callout}<div class="lrt-cats">${bars}</div>`;
}

/** Tabell per spelläge (även fallbacken för områden utan kategorier). */
export function modesHtml(row) {
  if (!row.perMode || row.perMode.length === 0) {
    return `<p class="hint lrt-empty">Inga spelade lägen i urvalet än.</p>`;
  }
  const rows = row.perMode
    .map((m) => {
      const meta = modeMeta(m.mode);
      const single = m.played === 1;
      return `<tr>
        <td class="lrt-att-title">${meta.emoji} ${esc(meta.name)}</td>
        <td class="lrt-num">${single ? starRow(m.stars, MAX_STARS_PER_MODE) : `${m.stars}<span class="lrt-of">/${m.maxStars}</span> ★`}</td>
        <td class="lrt-num">${m.completed}<span class="lrt-of">/${m.played}</span></td>
        <td class="lrt-num">${m.plays}</td>
        <td class="lrt-num lrt-pct ${pctLevel(m.pct)}" title="${m.answered ? `${m.correct}/${m.answered} rätt` : "inga kategoriserade frågor"}">${
          m.pct == null ? dash : `${m.pct}%`
        }</td>
        <td class="lrt-num lrt-date">${m.lastPlayed ? esc(lastActiveText(m.lastPlayed)) : "–"}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-scroll"><table class="tbl lrt-att-tbl pp-mode-tbl">
    <thead><tr><th>Spelläge</th><th class="lrt-num">Stjärnor</th><th class="lrt-num" title="Klarade av spelade">Klarade</th>
      <th class="lrt-num">Omgångar</th><th class="lrt-num">Rätt %</th><th class="lrt-num">Senast</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/**
 * Öppna djupdykningen för en elev.
 * @param {object} student  { id, namn, username, avatarId }
 * @param {{ row: object, scope: {label:string, emoji:string} }} opts
 *   `row` = elevens rad ur pluggaTeacherRows (redan beräknad i tabellen).
 */
export function openPluggaDetail(student, { row, scope }) {
  const name = student.namn || student.username || student.id;
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lrt-modal pp-modal" role="dialog" aria-modal="true"
      aria-label="Resultat per kategori – ${esc(name)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div>
          <h2 class="cx-modal-name">${esc(name)}</h2>
          <p class="cx-modal-sub">${esc(scope?.emoji || "📖")} ${esc(scope?.label || "")}${
            student.username ? " · " + esc(student.username) : ""
          }</p>
        </div>
      </div>
      <div class="cx-modal-body">
        ${statsGridHtml(row)}
        <div class="cx-detail-sec">
          <h3>Per kategori</h3>
          ${categoryHtml(row, name)}
        </div>
        <div class="cx-detail-sec">
          <h3>Per spelläge</h3>
          ${modesHtml(row)}
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
  return { close };
}
