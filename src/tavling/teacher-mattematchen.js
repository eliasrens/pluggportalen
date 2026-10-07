// ============================================================================
// Pluggporten – lärarsidan: Mattematchen-fliken (#459, epic #456)
// ----------------------------------------------------------------------------
// #/larare/mattematchen            – översikt: Skapa Mattematch, pågående &
//                                    kommande tävlingar, historik
// #/larare/mattematchen?id=<cid>   – en tävlings detaljvy (teacher-mm-detail.js):
//                                    status, kontroller, följ, historik, elevresultat
// Registreras i TEACHER_TABS (teacher-shared.js) och laddas DYNAMISKT (#271).
// Status (kommande/aktiv/stoppad/avslutad) härleds ur tid + lärarens styrning
// – samma definition som elevsidan (mm-core.competitionPhase).
// ============================================================================

import { el, esc, icon, isTeacher, renderGate, teacherHead, teacherNav } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { ensureMmTeacherCss } from "./teacher-mm-stats.js";
import { PHASE_LABEL, formatPeriod, splitCompetitions } from "./mm-teacher-core.js";
import { formatScore } from "./mm-core.js";

const HASH = "#/larare/mattematchen";

/** Statusbricka (färg per läge i mm-larare.css). */
export function phaseChip(phase) {
  return `<span class="mmt-chip mmt-chip-${phase}">${PHASE_LABEL[phase] || phase}</span>`;
}

/** Klassnamn för en lista id:n ("4A, 4B, 5E"). */
export function classList(ids, classNames) {
  return (ids || []).map((id) => classNames.get(id) || id).join(", ");
}

function cardHtml(c, classNames) {
  const r = c.result;
  const extra = r
    ? `<span class="mmt-card-res">🥇 ${esc(r.winner?.name || "–")}${
        r.winnerClass ? ` · 🏆 ${esc(classNames.get(r.winnerClass) || r.winnerClass)} (${formatScore(
          (r.classes || []).find((k) => k.classId === r.winnerClass)?.score
        )})` : ""}</span>`
    : "";
  return `<button type="button" class="mmt-card" data-id="${esc(c.id)}">
    <span class="mmt-card-top"><b>${esc(c.name || "Mattematchen")}</b>${phaseChip(c.phase)}</span>
    <span class="mmt-card-meta">${esc(formatPeriod(c))}</span>
    <span class="mmt-card-meta">${esc(classList(c.participatingClassIds, classNames))}</span>
    ${extra}
  </button>`;
}

async function renderList(ctx, page, api) {
  const [comps, classes] = await Promise.all([api.listCompetitions(), getClasses().catch(() => [])]);
  const classNames = new Map(classes.map((k) => [k.id, k.name || k.id]));
  const { current, history } = splitCompetitions(comps, Date.now());
  const view = el(`<div class="mmt-oversikt">
    <div class="row-inline mmt-oversikt-topp">
      <p class="hint">Långa tävlingsperioder i multiplikation 0–10. Varje rätt svar = 1 poäng
        (inga pluggcoins). Eleverna ser tävlingen bara när den är aktiv.</p>
      <button type="button" class="btn gron small" data-ny="1">${icon("plus", 16)}<span>Skapa Mattematch</span></button>
    </div>
    <div class="mmt-form-host"></div>
    <section class="mmt-sektion">
      <h2 class="subhead">Pågående &amp; kommande</h2>
      ${current.length ? `<div class="mmt-cards">${current.map((c) => cardHtml(c, classNames)).join("")}</div>`
        : `<p class="hint">Ingen tävling är aktiv eller planerad.</p>`}
    </section>
    <section class="mmt-sektion">
      <h2 class="subhead">Historik</h2>
      ${history.length ? `<div class="mmt-cards">${history.map((c) => cardHtml(c, classNames)).join("")}</div>`
        : `<p class="hint">Avslutade tävlingar sparas här.</p>`}
    </section>
  </div>`);
  view.querySelectorAll(".mmt-card").forEach((b) => b.addEventListener("click", () => ctx.go(`${HASH}?id=${encodeURIComponent(b.dataset.id)}`)));
  const formHost = view.querySelector(".mmt-form-host");
  const nyBtn = view.querySelector("[data-ny]");
  nyBtn.addEventListener("click", async () => {
    nyBtn.hidden = true;
    const { renderCompetitionForm } = await import("./teacher-mm-form.js");
    renderCompetitionForm(formHost, {
      classes,
      api,
      onSaved: (cid) => ctx.go(`${HASH}?id=${encodeURIComponent(cid)}`),
      onCancel: () => {
        formHost.replaceChildren();
        nyBtn.hidden = false;
      },
    });
  });
  page.appendChild(view);
}

/** Route-handler (TEACHER_TABS). */
export async function pageLarareMattematchen(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  ensureMmTeacherCss();
  const startHash = window.location.hash;
  const id = new URLSearchParams(startHash.split("?")[1] || "").get("id");
  const page = el(`<div class="teacher-page teacher-dark mmt-page"></div>`);
  page.append(teacherNav(ctx, "mattematchen"), teacherHead(ctx, "mattematchen"));
  const body = el(`<div class="spinner">Laddar Mattematchen…</div>`);
  page.appendChild(body);
  ctx.app.replaceChildren(page);
  try {
    const api = await import("./mm-teacher-data.js");
    if (window.location.hash !== startHash) return;
    body.remove();
    if (id) {
      const { renderCompetitionDetail } = await import("./teacher-mm-detail.js");
      await renderCompetitionDetail(ctx, page, api, id);
    } else {
      await renderList(ctx, page, api);
    }
  } catch (err) {
    body.remove();
    page.appendChild(el(`<div class="panel"><div class="msg error">Kunde inte ladda Mattematchen: ${esc(err.message)}</div></div>`));
  }
}
