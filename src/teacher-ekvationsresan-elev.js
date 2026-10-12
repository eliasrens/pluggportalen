// ============================================================================
// Pluggporten – lärarsidan: Ekvationsresan-elevdetalj (teacher-ekvationsresan-elev.js)
// ----------------------------------------------------------------------------
// Modal från klassöversikten (teacher-ekvationsresan.js, #619, spec E1.12):
//   * nyckeltal: nivå, uppgifter, stjärnor, lösta %, hjälp %, drag, mynt
//   * "Ändra nivå" för eleven (Läsresans UX, #506) – nollställer fönstret
//   * nivå och utveckling över tid (kurva ur de senaste försöken)
//   * de senaste uppgifterna (stjärnor, drag, optimalt, hjälp) – klick på en
//     rad visar ELEVENS RÄKNEGÅNG som MIN LÖSNING (samma renderare som
//     spelvyn: min-losning.rowsHtml(replayRows(...))).
// Här (och bara här) läses försöken – för EN elev (#231).
// Samma modal-skal (.cx-modal, teacher-dark) som Läsresans elevdetalj.
// ============================================================================

import { avatarEmoji } from "./avatars.js";
import { el, esc, icon } from "./teacher-shared.js";
import { LEVEL_MAX } from "./ekvationsresan/config.js";
import { NIVAER, NIVA_FEL, TREND, dragText, elevSparadText, forsokRader, hjalpText, ms, nivaKurva,
  nivaNamn, nivaStatus, rakneGang, tolkaNiva } from "./ekvationsresan/larare.js";
import { rowsHtml } from "./ekvationsresan/min-losning.js";

/** Så många senaste uppgifter läses och visas. */
export const RECENT_TASKS = 20;

const dash = `<span class="lrt-dash">–</span>`;
const stat = (num, lbl, extra = "") =>
  `<div class="cx-stat ${extra}"><div class="cx-stat-num">${num}</div><div class="cx-stat-lbl">${lbl}</div></div>`;
const starsTxt = (n) => (n > 0 ? "⭐".repeat(n) : "–");

function dateText(v) {
  const t = ms(v);
  if (!Number.isFinite(t) || t <= 0) return "–";
  return new Date(t).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statsGridHtml(r) {
  const s = r.started && r.tasks > 0;
  const t = TREND[r.trend] || TREND.flat;
  const drag = dragText(r.extraMoves);
  return `<div class="cx-stat-grid lrt-stat-grid ekt-stat-grid">
    ${stat(`${r.level}<span class="cx-stat-of">/${LEVEL_MAX}</span>`, esc(nivaNamn(r.level)) || "nivå", "lrt-stat-level")}
    ${stat(s ? `<span class="ekt-trend ekt-trend--${r.trend}">${t.sym}</span>` : dash, s ? `trend: ${t.text}` : "trend")}
    ${stat(r.started ? r.tasks : dash, "uppgifter")}
    ${stat(s ? `${r.stars.three} / ${r.stars.two} / ${r.stars.one}` : dash, "⭐⭐⭐ / ⭐⭐ / ⭐")}
    ${stat(r.solvedPct == null ? dash : `${r.solvedPct}%`, "lösta")}
    ${stat(r.helpPct == null ? dash : `${r.helpPct}%`, "med hjälp")}
    ${stat(drag == null ? dash : esc(drag), "drag jämfört med optimalt")}
    ${stat(r.started ? r.coins : dash, "mynt i Ekvationsresan")}
  </div>`;
}

/** Nivåkurvan: en punkt per uppgift (äldst först), färgad efter stjärnor. */
export function curveHtml(attempts) {
  const pts = nivaKurva(attempts);
  if (pts.length < 2) return `<p class="hint lrt-empty">Kurvan visas när eleven har gjort minst två uppgifter.</p>`;
  const W = 560, H = 140, pad = 22;
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (l) => H - pad - ((l - 1) * (H - 2 * pad)) / Math.max(1, LEVEL_MAX - 1);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.level).toFixed(1)}`).join(" ");
  const grid = NIVAER.map((n) => `<line x1="${pad}" x2="${W - pad}" y1="${y(n.level)}" y2="${y(n.level)}" class="ekt-kurva-grid"/>
    <text x="4" y="${y(n.level) + 4}" class="ekt-kurva-txt">${n.level}</text>`).join("");
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.level).toFixed(1)}" r="4.5" class="ekt-dot ekt-dot--${p.stars}"><title>Nivå ${p.level}, ${p.stars} stjärnor</title></circle>`).join("");
  const first = pts[0].level;
  const last = pts[pts.length - 1].level;
  const label = `Nivå över de senaste ${pts.length} uppgifterna: från ${first} till ${last}.`;
  return `<figure class="ekt-kurva"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}
    <path d="${line}" class="ekt-kurva-linje"/>${dots}</svg>
    <figcaption class="hint">${esc(label)} Prickarna: <span class="ekt-dot-key ekt-dot--3"></span>⭐⭐⭐
      <span class="ekt-dot-key ekt-dot--2"></span>⭐⭐ <span class="ekt-dot-key ekt-dot--1"></span>⭐
      <span class="ekt-dot-key ekt-dot--0"></span>ej löst</figcaption></figure>`;
}

/** Tabellen över de senaste uppgifterna (nyast först). Raderna är knappar. */
export function attemptsHtml(attempts) {
  const rows = forsokRader(attempts);
  if (!rows.length) return `<p class="hint lrt-empty">Inga genomförda uppgifter än.</p>`;
  return `<div class="table-scroll"><table class="tbl lrt-att-tbl ekt-att-tbl">
    <thead><tr><th>Ekvation</th><th class="lrt-num">Nivå</th><th class="lrt-num">Stjärnor</th>
      <th class="lrt-num">Drag</th><th class="lrt-num">Optimalt</th><th>Hjälp</th><th class="lrt-num">Datum</th></tr></thead>
    <tbody>${rows.map((r, i) => {
      const eq = rakneGang(attempts[i]).rows[0]?.text || "?";
      return `<tr class="ekt-att${i === 0 ? " is-vald" : ""}" data-i="${i}" tabindex="0" role="button" aria-pressed="${i === 0}"
          title="Visa räknegången">
        <td class="ekt-eq">${esc(eq)}</td>
        <td class="lrt-num">${r.level ?? "–"}</td>
        <td class="lrt-num ekt-stj">${r.solved ? starsTxt(r.stars) : `<span class="ekt-ej">ej löst</span>`}</td>
        <td class="lrt-num">${r.moves}${r.blocked ? `<span class="lrt-of" title="spärrade drag"> +${r.blocked}✋</span>` : ""}</td>
        <td class="lrt-num">${r.optimal ?? "–"}</td>
        <td>${esc(hjalpText(r))}</td>
        <td class="lrt-num lrt-date">${esc(dateText(r.at))}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

/** Elevens räknegång för ett försök, som MIN LÖSNING-häftet. */
export function haftHtml(attempt) {
  const g = rakneGang(attempt);
  if (g.error || !g.rows.length) return `<p class="msg error">Räknegången kunde inte visas${g.error ? `: ${esc(g.error)}` : "."}</p>`;
  const r = forsokRader([attempt])[0];
  const own = rowsHtml(g.rows.slice(0, g.ownRows));
  const shown = g.ownRows < g.rows.length ? rowsHtml(g.rows.slice(g.ownRows), { ghost: true }) : "";
  return `<div class="ekt-hafte" aria-label="Elevens räknegång">
    <p class="ekt-hafte-rubrik">MIN LÖSNING <span class="ekt-hafte-meta">nivå ${r.level} · ${r.solved ? starsTxt(r.stars) : "ej löst"} · ${r.moves} drag (optimalt ${r.optimal ?? "?"})</span></p>
    <ol class="ekv-rader">${own}</ol>
    ${shown ? `<p class="ekt-visad">Eleven valde ”Visa lösningen” – resten visades av spelet:</p><ol class="ekv-rader ekt-visad-rader">${shown}</ol>` : ""}
  </div>`;
}

/** "Ändra nivå" för eleven. */
function renderLevelControl(slot, { student, progress, api, reload, update }) {
  const name = student.namn || student.username || student.id;
  const cur = progress?.level || 1;
  slot.innerHTML = `<div class="lrn-student">
    <p class="hint lrn-status">${esc(nivaStatus(progress))}</p>
    <div class="lrn-row">
      <label for="ekt-elev-niva">Ny nivå</label>
      <select id="ekt-elev-niva" class="ekt-student-sel">${NIVAER.map((n) => `<option value="${n.level}"${n.level === cur ? " selected" : ""}>Nivå ${n.level} – ${esc(n.name)}</option>`).join("")}</select>
      <button type="button" class="btn small ekt-student-save">Spara nivå</button>
    </div>
    <p class="hint">Fönstret med senaste resultat nollställs och eleven får en ny uppgift på nivån.</p>
    <div class="lrn-msg" role="status" aria-live="polite"></div>
  </div>`;
  const msg = slot.querySelector(".lrn-msg");
  const btn = slot.querySelector(".ekt-student-save");
  btn.addEventListener("click", async () => {
    const level = tolkaNiva(slot.querySelector("select").value);
    if (level === null) return (msg.innerHTML = `<div class="msg error">${esc(NIVA_FEL)}</div>`);
    btn.disabled = true;
    btn.textContent = "Sparar…";
    try {
      await api.setStudentLevel(student.id, level);
      const fresh = await reload().catch(() => null);
      if (fresh) update(fresh);
      slot.querySelector(".lrn-status").textContent = nivaStatus(fresh?.progress || { level, window: [] });
      msg.innerHTML = `<div class="msg ok">${esc(elevSparadText(name, level))}</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="msg error">Kunde inte spara nivån: ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Spara nivå";
    }
  });
}

/**
 * Öppna elevdetaljen.
 * @param {object} student
 * @param {{ row, progress, api:{loadAttempts, setStudentLevel}, canSetLevel?:boolean,
 *   reload?: () => Promise<{row, progress}> }} opts
 */
export function openEkvationsresanDetail(student, { row, progress, api, canSetLevel = false, reload = async () => null }) {
  const name = student.namn || student.username || student.id;
  const overlay = el(`<div class="cx-modal-overlay teacher-dark lrt-modal ekt-modal" role="dialog" aria-modal="true"
      aria-label="Ekvationsresan – ${esc(name)}">
    <div class="cx-modal">
      <button class="cx-modal-close" aria-label="Stäng">✕</button>
      <div class="cx-modal-head">
        <span class="cx-modal-avatar">${avatarEmoji(student.avatarId)}</span>
        <div>
          <h2 class="cx-modal-name">${esc(name)}</h2>
          <p class="cx-modal-sub">${icon("sliders", 14)} Ekvationsresan${student.username ? " · " + esc(student.username) : ""}</p>
        </div>
      </div>
      <div class="cx-modal-body">
        ${statsGridHtml(row)}
        ${canSetLevel ? `<div class="cx-detail-sec lrn-sec"><h3>Ändra nivå</h3><div class="ekt-level-slot"></div></div>` : ""}
        <div class="cx-detail-sec"><h3>Nivå över tid</h3><div class="ekt-kurva-host">${row.started ? `<div class="spinner">Laddar…</div>` : `<p class="hint lrt-empty">Eleven har inte börjat Ekvationsresan än.</p>`}</div></div>
        <div class="cx-detail-sec"><h3>Senaste uppgifterna</h3><div class="ekt-attempts"></div></div>
        <div class="cx-detail-sec"><h3>Elevens räknegång</h3><div class="ekt-hafte-host"><p class="hint lrt-empty">Välj en uppgift ovan.</p></div></div>
      </div>
    </div>
  </div>`);
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", close);
  };
  const onKey = (e) => e.key === "Escape" && close();
  overlay.querySelector(".cx-modal-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => e.target === overlay && close());
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", close);
  document.body.appendChild(overlay);
  if (canSetLevel) {
    renderLevelControl(overlay.querySelector(".ekt-level-slot"), {
      student, progress, api, reload,
      update: (fresh) => fresh?.row && overlay.querySelector(".ekt-stat-grid").replaceWith(el(statsGridHtml(fresh.row))),
    });
  }
  overlay.querySelector(".cx-modal-close").focus();

  let attempts = [];
  const haft = overlay.querySelector(".ekt-hafte-host");
  const host = overlay.querySelector(".ekt-attempts");
  const pick = (tr) => {
    if (!tr) return;
    host.querySelectorAll("tr.ekt-att").forEach((t) => {
      t.classList.toggle("is-vald", t === tr);
      t.setAttribute("aria-pressed", String(t === tr));
    });
    haft.innerHTML = haftHtml(attempts[Number(tr.dataset.i)]);
  };
  host.addEventListener("click", (e) => pick(e.target.closest("tr.ekt-att")));
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("tr.ekt-att");
    if (!tr) return;
    e.preventDefault();
    pick(tr);
  });
  if (!row.started) {
    host.innerHTML = `<p class="hint lrt-empty">Inga genomförda uppgifter än.</p>`;
    return { close };
  }
  host.innerHTML = `<div class="spinner">Laddar uppgifter…</div>`;
  Promise.resolve()
    .then(() => api.loadAttempts(student.id, RECENT_TASKS))
    .then((list) => {
      if (!overlay.isConnected) return;
      attempts = (list || []).filter(Boolean);
      overlay.querySelector(".ekt-kurva-host").innerHTML = curveHtml(attempts);
      host.innerHTML = attemptsHtml(attempts);
      if (attempts.length) haft.innerHTML = haftHtml(attempts[0]);
    })
    .catch((err) => {
      console.warn("[Ekvationsresan] kunde inte läsa försök", err);
      if (!overlay.isConnected) return;
      overlay.querySelector(".ekt-kurva-host").innerHTML = "";
      host.replaceChildren(el(`<div class="msg error">Kunde inte ladda uppgifterna: ${esc(err.message)}</div>`));
    });
  return { close };
}
