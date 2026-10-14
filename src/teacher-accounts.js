// ============================================================================
// Pluggporten – lärarsidan: Lärarkonton (teacher-accounts.js, #677)
// ----------------------------------------------------------------------------
// #/larare/konton – BARA för admin (spec docs/UTVECKLINGSUPPDRAG_LARARKONTON.md §3):
//   * tabell över alla lärarkonton (namn, användarnamn, roll, klasser, status)
//   * "Nytt konto": visningsnamn + användarnamn (förslag ur namnet), roll,
//     lösenord eller "Skapa ett lösenord åt mig", klasser med "Välj klasser som
//     börjar på 4" → Cloud Functionen adminCreateTeacher
//   * "Hantera" på en rad → teacher-accounts-manage.js (namn, klasser, lösenord,
//     stäng av/aktivera, roll, radera)
// Registreras i TEACHER_TABS med admin: true (fliken syns bara för admin) och
// laddas DYNAMISKT (#271). Servern spärrar oavsett (functions + firestore.rules).
// ============================================================================

import { el, esc, icon, isTeacher, renderGate, teacherHead, teacherNav } from "./teacher-shared.js";
import { getClasses } from "./data-classes.js";
import {
  ROLE_LABEL, activeChip, classNames, classPicker, ensureAccountsCss, passwordField, roleChip, suggestUsername,
} from "./teacher-accounts-parts.js";

const HASH = "#/larare/konton";

/** Route-handler (TEACHER_TABS). */
export async function pageLarareKonton(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  ensureAccountsCss();
  const page = el(`<div class="teacher-page teacher-dark ta-page"></div>`);
  page.append(teacherNav(ctx, "konton"), teacherHead(ctx, "konton"));
  const body = el(`<div class="spinner">Laddar lärarkonton…</div>`);
  page.appendChild(body);
  ctx.app.replaceChildren(page);
  try {
    const api = await import("./data-teacher-accounts.js");
    // Färska claims: en nyss migrerad admin ska inte behöva logga ut och in.
    const claims = await api.refreshClaims().catch(() => ({}));
    if (window.location.hash.split("?")[0] !== HASH) return;
    body.remove();
    if (claims.admin !== true) {
      page.appendChild(el(`<div class="panel"><div class="msg error">Det här kan bara admin göra.</div></div>`));
      return;
    }
    const me = (await import("./firebase-config.js")).auth.currentUser?.uid || "";
    await renderAccounts(ctx, page, api, me);
  } catch (err) {
    body.remove();
    page.appendChild(el(`<div class="panel"><div class="msg error">Kunde inte ladda lärarkontona: ${esc(err.message)}</div></div>`));
  }
}

async function renderAccounts(ctx, page, api, me, flash = "") {
  const [accounts, classes] = await Promise.all([api.listTeacherAccounts(), getClasses().catch(() => [])]);
  const view = el(`<div class="ta-oversikt">
    <div class="row-inline ta-topp">
      <p class="hint">Admin kan allt. Ett <b>årskurskonto</b> delas av lärarna i en årskurs och arbetar bara
        med klasserna du ger det: statistik, material, vad klassen ser, fokusläge, elevlösenord och Live.</p>
      <button type="button" class="btn gron small" data-ny="1">${icon("plus", 16)}<span>Nytt konto</span></button>
    </div>
    <div class="ta-flash" role="status">${flash}</div>
    <div class="ta-form-host"></div>
    <div class="table-scroll"><table class="tbl ta-tbl">
      <thead><tr><th>Visningsnamn</th><th>Användarnamn</th><th>Roll</th><th>Klasser</th><th>Status</th><th><span class="sr-only">Hantera</span></th></tr></thead>
      <tbody>${accounts.length ? accounts.map((a) => rowHtml(a, classes, me)).join("")
        : `<tr><td colspan="6" class="hint">Inga lärarkonton ännu – kör migreringsskriptet (docs/ADMIN.md).</td></tr>`}</tbody>
    </table></div>
  </div>`);
  const host = view.querySelector(".ta-form-host");
  const nyBtn = view.querySelector("[data-ny]");
  const reload = (msg) => {
    view.remove();
    return renderAccounts(ctx, page, api, me, msg).catch((err) =>
      page.appendChild(el(`<div class="panel"><div class="msg error">${esc(err.message)}</div></div>`)));
  };
  const closeHost = () => {
    host.replaceChildren();
    nyBtn.hidden = false;
    view.querySelectorAll(".ta-rad.vald").forEach((r) => r.classList.remove("vald"));
  };
  nyBtn.addEventListener("click", () => {
    closeHost();
    nyBtn.hidden = true;
    host.appendChild(createForm(api, classes, { onDone: reload, onCancel: closeHost }));
    host.querySelector("input")?.focus();
  });
  view.querySelectorAll("[data-hantera]").forEach((b) =>
    b.addEventListener("click", async () => {
      closeHost();
      const acc = accounts.find((a) => a.uid === b.dataset.hantera);
      b.closest("tr").classList.add("vald");
      const { renderManage } = await import("./teacher-accounts-manage.js");
      host.appendChild(renderManage(api, acc, classes, { me, onDone: reload, onCancel: closeHost }));
      host.scrollIntoView({ block: "nearest", behavior: "smooth" });
    })
  );
  page.appendChild(view);
}

function rowHtml(a, classes, me) {
  const klasser = a.role === "admin" ? `<span class="hint">Alla klasser</span>`
    : esc(classNames(a.classIds, classes).join(", ")) || `<span class="hint">Inga klasser</span>`;
  return `<tr class="ta-rad${a.active === false ? " ta-av" : ""}">
    <td><b>${esc(a.displayName || a.username)}</b>${a.uid === me ? ` <small class="hint">(du)</small>` : ""}</td>
    <td><code>${esc(a.username || "")}</code></td>
    <td>${roleChip(a.role)}</td>
    <td class="ta-klass-cell">${klasser}</td>
    <td>${activeChip(a.active)}</td>
    <td class="ta-handling"><button type="button" class="btn ghost small" data-hantera="${esc(a.uid)}">${icon("pencil", 15)}<span>Hantera</span></button></td>
  </tr>`;
}

/** "Nytt konto" (§3.2). Skapar inloggning, claims och dokument via adminCreateTeacher. */
function createForm(api, classes, { onDone, onCancel }) {
  const form = el(`<form class="panel ta-form" novalidate>
    <h2 class="subhead">${icon("plus", 18)}<span>Nytt lärarkonto</span></h2>
    <div class="ta-rad2">
      <div class="field"><label for="ta-namn">Visningsnamn</label>
        <input id="ta-namn" type="text" maxlength="60" placeholder="Årskurs 4" autocomplete="off" /></div>
      <div class="field"><label for="ta-user">Användarnamn <small>(för inloggningen)</small></label>
        <input id="ta-user" type="text" maxlength="40" placeholder="arskurs4" autocomplete="off" spellcheck="false" /></div>
    </div>
    <div class="field ta-roll"><span class="ta-label">Roll</span>
      <label><input type="radio" name="ta-roll" value="arskurs" checked /> ${ROLE_LABEL.arskurs} – bara valda klasser</label>
      <label><input type="radio" name="ta-roll" value="admin" /> ${ROLE_LABEL.admin} – full behörighet</label>
    </div>
    <div class="ta-losen-host"></div>
    <div class="ta-klass-host"></div>
    <div class="ta-fel" role="alert"></div>
    <div class="row-inline">
      <button type="submit" class="btn gron small">${icon("check", 16)}<span>Spara</span></button>
      <button type="button" class="btn ghost small" data-avbryt="1">Avbryt</button>
    </div>
  </form>`);
  const $ = (s) => form.querySelector(s);
  const namn = $("#ta-namn");
  const user = $("#ta-user");
  const pw = passwordField("ta-pw");
  $(".ta-losen-host").appendChild(pw.node);
  const picker = classPicker(classes, [], { digitFrom: () => namn.value || user.value });
  $(".ta-klass-host").appendChild(picker.node);
  const role = () => form.querySelector('input[name="ta-roll"]:checked').value;
  const syncRole = () => ($(".ta-klass-host").hidden = role() === "admin");
  form.querySelectorAll('input[name="ta-roll"]').forEach((r) => r.addEventListener("change", syncRole));

  // Användarnamnet följer visningsnamnet tills läraren skriver ett eget.
  let egetNamn = false;
  user.addEventListener("input", () => (egetNamn = user.value !== ""));
  namn.addEventListener("input", () => {
    if (!egetNamn) user.value = suggestUsername(namn.value);
    picker.refresh();
  });
  $("[data-avbryt]").addEventListener("click", onCancel);

  let saving = false;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (saving) return;
    const fel = $(".ta-fel");
    const data = {
      displayName: namn.value.trim(),
      username: user.value.trim().toLowerCase(),
      password: pw.value(),
      role: role(),
      classIds: role() === "arskurs" ? picker.selected() : [],
    };
    const problem = !data.displayName ? "Skriv ett visningsnamn."
      : !/^[a-z0-9._-]{3,40}$/.test(data.username) ? "Användarnamnet ska vara 3–40 tecken: a–z, 0–9, . _ -"
      : data.password.length < 6 ? "Lösenordet måste vara minst 6 tecken – eller tryck Skapa ett lösenord åt mig."
      : "";
    if (problem) {
      fel.innerHTML = `<div class="msg error">${esc(problem)}</div>`;
      return;
    }
    saving = true;
    fel.innerHTML = `<div class="msg">Skapar kontot…</div>`;
    try {
      await api.createTeacher(data);
      onDone(`<div class="msg ok">✓ ${esc(data.displayName)} är skapat. Inloggning: <b>${esc(data.username)}</b>
        · lösenord <b>${esc(data.password)}</b> – skriv upp det nu, det sparas inte.</div>`);
    } catch (err) {
      saving = false;
      fel.innerHTML = `<div class="msg error">${esc(err.message)}</div>`;
    }
  });
  return form;
}
