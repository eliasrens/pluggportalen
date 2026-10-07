// ============================================================================
// Mattematchen – skapa/ändra-formuläret (#459)
// ----------------------------------------------------------------------------
// Tävlingsnamn, deltagande klasser (kryssrutor), startdatum + starttid,
// slutdatum + sluttid. Validering i mm-teacher-core.validateCompetition.
// renderCompetitionForm(host, { classes, competition?, onSaved, onCancel })
//   competition saknas → skapa; annars ändra (förifyllt).
// Laddas DYNAMISKT via teacher-mattematchen.js (#271).
// ============================================================================

import { el, esc, icon } from "../teacher-shared.js";
import { defaultPeriod, localMs, toInputs, validateCompetition, NAME_MAX } from "./mm-teacher-core.js";
import { toMs } from "./mm-core.js";

/**
 * @param {HTMLElement} host
 * @param {{ classes:object[], competition?:object, api:object,
 *   onSaved:(cid:string)=>void, onCancel:()=>void }} opts
 */
export function renderCompetitionForm(host, { classes, competition, api, onSaved, onCancel }) {
  const editing = !!competition;
  const period = editing
    ? { startMs: toMs(competition.startAt), endMs: toMs(competition.endAt) }
    : defaultPeriod(Date.now());
  const s = toInputs(period.startMs);
  const e = toInputs(period.endMs);
  const valda = new Set(editing ? competition.participatingClassIds || [] : []);
  const month = new Date(period.startMs).toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const name = editing ? competition.name : `Mattematchen ${month}`;

  const form = el(`<form class="panel mmt-form" novalidate>
    <h2 class="subhead">${icon(editing ? "pencil" : "plus", 18)}<span>${editing ? "Ändra Mattematch" : "Skapa Mattematch"}</span></h2>
    <div class="field">
      <label for="mmt-namn">Tävlingsnamn</label>
      <input id="mmt-namn" class="mmt-namn" type="text" maxlength="${NAME_MAX}" value="${esc(name)}" autocomplete="off" />
    </div>
    <fieldset class="mmt-klasser">
      <legend>Deltagande klasser</legend>
      ${classes.length ? `<div class="mmt-klass-lista">${classes.map((k) => `
        <label class="mmt-klass">
          <input type="checkbox" value="${esc(k.id)}"${valda.has(k.id) ? " checked" : ""} />
          <span>${esc(k.name || k.id)}</span>
          <small>${Array.isArray(k.studentIds) ? k.studentIds.length : 0} elever</small>
        </label>`).join("")}</div>
        <div class="row-inline mmt-klass-snabb">
          <button type="button" class="btn ghost small" data-alla="1">Välj alla</button>
          <button type="button" class="btn ghost small" data-alla="0">Inga</button>
        </div>`
        : `<p class="hint">Det finns inga klasser än – skapa en under Klasser & elever först.</p>`}
    </fieldset>
    <div class="mmt-tider">
      <div class="field"><label for="mmt-sd">Startdatum</label><input id="mmt-sd" type="date" value="${s.date}" /></div>
      <div class="field"><label for="mmt-st">Starttid</label><input id="mmt-st" type="time" step="300" value="${s.time}" /></div>
      <div class="field"><label for="mmt-ed">Slutdatum</label><input id="mmt-ed" type="date" value="${e.date}" /></div>
      <div class="field"><label for="mmt-et">Sluttid</label><input id="mmt-et" type="time" step="300" value="${e.time}" /></div>
    </div>
    <p class="hint">Tävlingen blir <b>aktiv</b> av sig själv vid starttiden och syns då för eleverna i de valda
      klasserna. Vid sluttiden försvinner den från elevmenyn och resultatet sparas i historiken.</p>
    <div class="mmt-fel" role="alert"></div>
    <div class="row-inline">
      <button type="submit" class="btn gron small">${icon(editing ? "save" : "check", 16)}<span>${editing ? "Spara ändringar" : "Skapa tävlingen"}</span></button>
      <button type="button" class="btn ghost small" data-avbryt="1">Avbryt</button>
    </div>
  </form>`);

  const boxes = () => [...form.querySelectorAll(".mmt-klass input")];
  form.querySelectorAll("[data-alla]").forEach((b) =>
    b.addEventListener("click", () => boxes().forEach((x) => (x.checked = b.dataset.alla === "1")))
  );
  form.querySelector("[data-avbryt]").addEventListener("click", () => onCancel?.());
  const felEl = form.querySelector(".mmt-fel");
  const v = (id) => form.querySelector(id).value;

  let saving = false; // dubbel-Enter/klick får inte skapa två tävlingar
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (saving) return;
    const res = validateCompetition({
      name: v("#mmt-namn"),
      classIds: boxes().filter((x) => x.checked).map((x) => x.value),
      startMs: localMs(v("#mmt-sd"), v("#mmt-st")),
      endMs: localMs(v("#mmt-ed"), v("#mmt-et")),
      editing,
    }, Date.now());
    if (!res.ok) {
      felEl.innerHTML = `<div class="msg error">${res.errors.map(esc).join("<br>")}</div>`;
      return;
    }
    felEl.innerHTML = "";
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    saving = true;
    try {
      const payload = { ...res.fields, startMs: localMs(v("#mmt-sd"), v("#mmt-st")), endMs: localMs(v("#mmt-ed"), v("#mmt-et")) };
      const cid = editing
        ? (await api.updateCompetition(competition.id, payload), competition.id)
        : await api.createCompetition(payload);
      onSaved?.(cid);
    } catch (err) {
      felEl.innerHTML = `<div class="msg error">Kunde inte spara: ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      saving = false;
    }
  });

  host.replaceChildren(form);
  form.querySelector("#mmt-namn").focus();
  return form;
}
