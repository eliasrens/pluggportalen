// ============================================================================
// Pluggporten – Lärarkonton: hantera ett konto (teacher-accounts-manage.js, #677)
// ----------------------------------------------------------------------------
// Spec §3.3. En panel under tabellen med fyra delar, var och en ett eget anrop:
//   Namn och klasser   adminUpdateTeacher { displayName, classIds }
//   Lösenord           adminSetTeacherPassword
//   Roll               adminUpdateTeacher { role } (med bekräftelse)
//   Stäng av/aktivera  adminSetTeacherActive
//   Radera             adminDeleteTeacher (tydlig bekräftelse – materialet blir admins)
// På sitt EGET konto visas inte roll, stäng av eller radera (servern nekar också).
// Bara dynamiskt laddad från teacher-accounts.js (#271).
// ============================================================================

import { el, esc, icon } from "./teacher-shared.js";
import { ROLE_LABEL, activeChip, classPicker, passwordField, roleChip } from "./teacher-accounts-parts.js";

/**
 * @param {object} api  data-teacher-accounts.js
 * @param {object} acc  { uid, displayName, username, role, classIds, active }
 * @param {object[]} classes
 * @param {{ me:string, onDone:(flashHtml:string)=>void, onCancel:()=>void }} opts
 */
export function renderManage(api, acc, classes, { me, onDone, onCancel }) {
  const self = acc.uid === me;
  const name = acc.displayName || acc.username;
  const arskurs = acc.role === "arskurs";
  const panel = el(`<section class="panel ta-hantera" aria-label="Hantera ${esc(name)}">
    <div class="ta-hantera-topp">
      <h2 class="subhead">${icon("pencil", 18)}<span>${esc(name)}</span></h2>
      ${roleChip(acc.role)} ${activeChip(acc.active)}
      <button type="button" class="btn ghost small ta-stang" data-stang="1">${icon("x", 15)}<span>Stäng</span></button>
    </div>
    <p class="hint">Inloggning: <code>${esc(acc.username || "")}</code>${self ? " · det här är ditt eget konto" : ""}</p>

    <form class="ta-del" data-del="namn" novalidate>
      <h3 class="ta-del-rubrik">Namn${arskurs ? " och klasser" : ""}</h3>
      <div class="field"><label for="tah-namn">Visningsnamn</label>
        <input id="tah-namn" type="text" maxlength="60" value="${esc(acc.displayName || "")}" autocomplete="off" /></div>
      <div class="ta-klass-host"></div>
      <div class="ta-fel" role="alert"></div>
      <button type="submit" class="btn gron small">${icon("save", 16)}<span>Spara</span></button>
    </form>

    <form class="ta-del" data-del="losen" novalidate>
      <h3 class="ta-del-rubrik">Byt lösenord</h3>
      <div class="ta-losen-host"></div>
      <div class="ta-fel" role="alert"></div>
      <button type="submit" class="btn small">${icon("key", 16)}<span>Byt lösenord</span></button>
    </form>

    ${self ? "" : `<div class="ta-del ta-del-knappar">
      <h3 class="ta-del-rubrik">Konto</h3>
      <div class="row-inline">
        <button type="button" class="btn ghost small" data-roll="1">${icon("shuffle", 15)}<span>Gör till ${
          arskurs ? "admin" : "årskurskonto"}</span></button>
        <button type="button" class="btn ghost small" data-aktiv="1">${icon(acc.active === false ? "check" : "lock", 15)}<span>${
          acc.active === false ? "Aktivera kontot" : "Stäng av kontot"}</span></button>
        <button type="button" class="btn danger small" data-radera="1">${icon("trash", 15)}<span>Radera kontot</span></button>
      </div>
      <div class="ta-fel" role="alert"></div>
    </div>`}
  </section>`);

  const $ = (s) => panel.querySelector(s);
  $("[data-stang]").addEventListener("click", onCancel);
  const namnInput = $("#tah-namn");
  const picker = arskurs ? classPicker(classes, acc.classIds || [], { digitFrom: () => namnInput.value || acc.username }) : null;
  if (picker) {
    $(".ta-klass-host").appendChild(picker.node);
    namnInput.addEventListener("input", picker.refresh);
  }
  const pw = passwordField("tah-pw", "Nytt lösenord");
  $(".ta-losen-host").appendChild(pw.node);

  /** Kör ett anrop med låst knapp och felruta i delen. */
  const run = async (part, fn) => {
    const fel = part.querySelector(".ta-fel");
    const btns = [...part.querySelectorAll("button")];
    btns.forEach((b) => (b.disabled = true));
    fel.innerHTML = `<div class="msg">Sparar…</div>`;
    try {
      onDone(await fn());
    } catch (err) {
      fel.innerHTML = `<div class="msg error">${esc(err.message)}</div>`;
      btns.forEach((b) => (b.disabled = false));
    }
  };
  const ok = (text) => `<div class="msg ok">✓ ${esc(text)}</div>`;

  const namnForm = $('[data-del="namn"]');
  namnForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const displayName = namnInput.value.trim();
    if (!displayName) {
      namnForm.querySelector(".ta-fel").innerHTML = `<div class="msg error">Skriv ett visningsnamn.</div>`;
      return;
    }
    run(namnForm, async () => {
      await api.updateTeacher({ uid: acc.uid, displayName, ...(picker ? { classIds: picker.selected() } : {}) });
      return ok(`${displayName} är sparat.${picker ? " Klasserna gäller direkt – läraren behöver inte logga ut." : ""}`);
    });
  });

  const losenForm = $('[data-del="losen"]');
  losenForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const password = pw.value();
    if (password.length < 6) {
      losenForm.querySelector(".ta-fel").innerHTML = `<div class="msg error">Lösenordet måste vara minst 6 tecken.</div>`;
      return;
    }
    run(losenForm, async () => {
      await api.setTeacherPassword(acc.uid, password);
      return `<div class="msg ok">✓ Nytt lösenord för <b>${esc(acc.username)}</b>: <b>${esc(password)}</b> – skriv upp det nu, det sparas inte.</div>`;
    });
  });

  const knappar = $(".ta-del-knappar");
  if (!knappar) return panel;
  $("[data-roll]").addEventListener("click", () => {
    const nyRoll = arskurs ? "admin" : "arskurs";
    const text = nyRoll === "admin"
      ? `Göra ${name} till ADMIN?\n\nKontot får då full behörighet: lärarkonton, klasser, elevkonton, ekonomi och allt material.`
      : `Göra ${name} till ÅRSKURSKONTO?\n\nKontot förlorar adminbehörigheten och får bara arbeta med de klasser du väljer (inga klasser just nu – välj dem efteråt).`;
    if (!confirm(text)) return;
    run(knappar, async () => {
      await api.updateTeacher({ uid: acc.uid, role: nyRoll });
      return ok(`${name} är nu ${ROLE_LABEL[nyRoll].toLowerCase()}. Ändringen gäller när kontot loggar in nästa gång.`);
    });
  });
  $("[data-aktiv]").addEventListener("click", () => {
    const aktivera = acc.active === false;
    if (!aktivera && !confirm(`Stänga av ${name}?\n\nKontot kan inte logga in förrän du aktiverar det igen.`)) return;
    run(knappar, async () => {
      await api.setTeacherActive(acc.uid, aktivera);
      return ok(aktivera ? `${name} är aktiverat igen.` : `${name} är avstängt.`);
    });
  });
  $("[data-radera]").addEventListener("click", () => {
    const svar = prompt(
      `Radera ${name} för alltid?\n\nInloggningen tas bort. Material som kontot skapat raderas INTE – det blir admins.\n\nSkriv användarnamnet (${acc.username}) för att bekräfta:`
    );
    if (svar == null) return;
    if (svar.trim().toLowerCase() !== String(acc.username).toLowerCase()) {
      knappar.querySelector(".ta-fel").innerHTML = `<div class="msg error">Användarnamnet stämde inte – inget raderades.</div>`;
      return;
    }
    run(knappar, async () => {
      await api.deleteTeacher(acc.uid);
      return ok(`${name} är raderat. Materialet finns kvar och ägs nu av admin.`);
    });
  });
  return panel;
}
