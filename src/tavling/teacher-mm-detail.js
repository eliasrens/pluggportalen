// ============================================================================
// Mattematchen – en tävlings detaljvy för läraren (#459)
// ----------------------------------------------------------------------------
// #/larare/mattematchen?id=<cid>:
//   • huvud: namn, statusbricka, period, deltagande klasser
//   • kontroller per läge (mm-teacher-core.phaseActions): Starta nu, Stoppa,
//     Fortsätt, Avsluta (sparar historik), Ändra (namn/klasser/tider)
//   • Följ tävlingen (pågående/kommande) ELLER sparat resultat (avslutad)
//   • Elevresultat per klass (sorterbar tabell → elevdetalj per tabell 0–10)
//   • Nollställ/teståterställ – bara efter att läraren SKRIVIT tävlingsnamnet
// En tävling som tagit slut av sig själv arkiveras (result sparas) första
// gången den öppnas här (archiveIfEnded).
// ============================================================================

import { el, esc, icon } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { competitionPhase, toMs } from "./mm-core.js";
import { formatPeriod, phaseActions, resetConfirmOk } from "./mm-teacher-core.js";
import { phaseChip, classList } from "./teacher-mattematchen.js";
import { renderFollow, renderHistoryResult, renderStudentResults } from "./teacher-mm-results.js";

const HASH = "#/larare/mattematchen";

const KNAPPAR = {
  start: { label: "Starta nu", icon: "check", cls: "gron" },
  stop: { label: "Stoppa", icon: "lock", cls: "ghost" },
  resume: { label: "Fortsätt", icon: "check", cls: "gron" },
  finish: { label: "Avsluta", icon: "x", cls: "ghost" },
  edit: { label: "Ändra", icon: "pencil", cls: "ghost" },
};

const KLART = {
  start: "Tävlingen är igång – eleverna i de valda klasserna ser den nu.",
  stop: "Tävlingen är stoppad – eleverna ser den inte och svar godtas inte.",
  resume: "Tävlingen fortsätter.",
  finish: "Tävlingen är avslutad och resultatet sparat i historiken.",
};

/** Nollställnings-rutan: knappen låses upp först när namnet skrivits exakt. */
function resetBox(comp, api, onDone) {
  const box = el(`<section class="mmt-kort mmt-farlig">
    <h3>${icon("trash", 16)} Nollställ / teståterställ</h3>
    <p class="hint">Raderar <b>alla</b> svar, all statistik, topplistan och klasskampen för den här
      tävlingen (även ett sparat historikresultat). Tävlingen, namnet och perioden finns kvar.
      <b>Det går inte att ångra.</b></p>
    <label class="field">Skriv tävlingens namn <b>${esc(comp.name)}</b> för att bekräfta
      <input type="text" class="mmt-reset-in" autocomplete="off" aria-label="Tävlingens namn" />
    </label>
    <div class="row-inline">
      <button type="button" class="btn small danger" data-reset="1" disabled>${icon("trash", 16)}<span>Nollställ tävlingen</span></button>
      <span class="mmt-reset-msg hint"></span>
    </div>
  </section>`);
  const input = box.querySelector(".mmt-reset-in");
  const btn = box.querySelector("[data-reset]");
  const msg = box.querySelector(".mmt-reset-msg");
  input.addEventListener("input", () => (btn.disabled = !resetConfirmOk(input.value, comp.name)));
  btn.addEventListener("click", async () => {
    if (!resetConfirmOk(input.value, comp.name)) return;
    btn.disabled = true;
    input.disabled = true;
    msg.textContent = "Nollställer…";
    try {
      const n = await api.resetCompetition(comp.id, (sub, count) => (msg.textContent = `Raderar ${sub}: ${count}…`));
      msg.textContent = `✓ Nollställd (${n.answers} svar raderade).`;
      setTimeout(onDone, 900);
    } catch (err) {
      msg.innerHTML = `<span class="err-inline">Kunde inte nollställa: ${esc(err.message)}</span>`;
      input.disabled = false;
      btn.disabled = !resetConfirmOk(input.value, comp.name);
    }
  });
  return box;
}

/** Rita detaljvyn för tävlingen `cid` sist i `page`. */
export async function renderCompetitionDetail(ctx, page, api, cid) {
  const host = el(`<div class="mmt-detalj"><div class="spinner">Laddar tävlingen…</div></div>`);
  page.appendChild(host);
  const startHash = window.location.hash;

  async function draw(flash = "") {
    const [comp, classes] = await Promise.all([api.getCompetition(cid), getClasses().catch(() => [])]);
    if (window.location.hash !== startHash) return;
    const back = el(`<a class="back-link mmt-tillbaka">← Alla Mattematcher</a>`);
    back.addEventListener("click", () => ctx.go(HASH));
    if (!comp) {
      host.replaceChildren(back, el(`<div class="panel"><p class="hint">Tävlingen finns inte (borttagen?).</p></div>`));
      return;
    }
    const classNames = new Map(classes.map((k) => [k.id, k.name || k.id]));
    const phase = competitionPhase(comp, Date.now());
    let archiveErr = "";
    if (phase === "avslutad" && !comp.result) {
      try {
        comp.result = await api.archiveIfEnded(comp);
      } catch (err) {
        archiveErr = err.message;
      }
    }
    const actions = phaseActions(phase);
    const view = el(`<div>
      <div class="panel mmt-huvud">
        <div class="mmt-huvud-rad"><h2>${esc(comp.name)}</h2>${phaseChip(phase)}</div>
        <p class="mmt-meta">${icon("pin", 14)} ${esc(formatPeriod(comp))}</p>
        <p class="mmt-meta">${icon("users", 14)} ${esc(classList(comp.participatingClassIds, classNames))}</p>
        <div class="row-inline mmt-kontroller">
          ${actions.filter((a) => KNAPPAR[a]).map((a) => `<button type="button" class="btn small ${KNAPPAR[a].cls}" data-act="${a}">${icon(KNAPPAR[a].icon, 16)}<span>${KNAPPAR[a].label}</span></button>`).join("")}
        </div>
        <div class="mmt-flash" role="status">${flash ? `<span class="ok-inline">✓ ${esc(flash)}</span>` : ""}</div>
        <div class="mmt-edit-host"></div>
      </div>
      <section class="mmt-sektion mmt-res-sek">
        <h2 class="subhead">${phase === "avslutad" ? "Resultat" : "Följ tävlingen"}</h2>
        <div class="mmt-res-host"></div>
      </section>
      <section class="mmt-sektion">
        <h2 class="subhead">Elevresultat</h2>
        <div class="mmt-elev-host"></div>
      </section>
    </div>`);
    host.replaceChildren(back, view, resetBox(comp, api, () => draw("Tävlingen är nollställd.")));

    const resHost = view.querySelector(".mmt-res-host");
    if (phase !== "avslutad") renderFollow(resHost, comp, classNames);
    else if (comp.result) renderHistoryResult(resHost, comp.result, classNames);
    else resHost.replaceChildren(el(`<div class="msg error">Kunde inte spara resultatet: ${esc(archiveErr || "okänt fel")}</div>`));
    renderStudentResults(ctx, view.querySelector(".mmt-elev-host"), comp, classes, api);

    const flashEl = view.querySelector(".mmt-flash");
    view.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", async () => {
        const act = b.dataset.act;
        if (act === "edit") {
          const { renderCompetitionForm } = await import("./teacher-mm-form.js");
          renderCompetitionForm(view.querySelector(".mmt-edit-host"), {
            classes, competition: comp, api,
            onSaved: () => draw("Ändringarna är sparade."),
            onCancel: () => view.querySelector(".mmt-edit-host").replaceChildren(),
          });
          return;
        }
        if (act === "finish" && !window.confirm(`Avsluta "${comp.name}" nu? Eleverna kan inte svara mer och resultatet sparas i historiken.`)) return;
        if (act === "start" && toMs(comp.endAt) <= Date.now()) return;
        b.disabled = true;
        flashEl.innerHTML = `<span class="hint">Sparar…</span>`;
        try {
          if (act === "start") await api.startNow(comp.id);
          else if (act === "stop") await api.stopCompetition(comp.id);
          else if (act === "resume") await api.resumeCompetition(comp.id);
          else if (act === "finish") await api.finishCompetition(comp);
          await draw(KLART[act]);
        } catch (err) {
          b.disabled = false;
          flashEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
        }
      })
    );
  }

  try {
    await draw();
  } catch (err) {
    host.replaceChildren(el(`<div class="panel"><div class="msg error">Kunde inte ladda tävlingen: ${esc(err.message)}</div></div>`));
  }
}
