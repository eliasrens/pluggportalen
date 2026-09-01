// ============================================================================
// Pluggportalen – lärarsidan: elevkontohantering (teacher-students.js)
// ----------------------------------------------------------------------------
// #/larare/elever: tabellvy för att snabbt mata in en hel klass – lägg till/
// redigera/ta bort rader, användarnamnsförslag, dubblett-/validering och
// "Spara alla" (src/data.js). Avatarer från src/avatars.js.
// ============================================================================

import * as data from "./data.js";
import { slugify } from "./validate.js";
import { AVATARS } from "./avatars.js";
import { el, esc, isTeacher, teacherNav, renderGate } from "./teacher-shared.js";

export async function pageLarareElever(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar elever…</div>`));

  let students = [];
  try {
    students = await data.getStudents();
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda elever: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  const avatarOptions = Object.entries(AVATARS)
    .map(([id, emoji]) => ({ id, emoji }));

  const view = el(`<div>
    <div class="panel">
      <h1>Elevkonton 🧑‍🎓</h1>
      <p class="hint">Skriv in eleverna i tabellen – namn, användarnamn och lösenord.
        Lägg till rader för en hel klass och klicka <b>Spara alla</b>. Användarnamn skrivs
        automatiskt om till gemener. Eleverna loggar in på elevsidan med användarnamn + lösenord.</p>
      <div class="table-scroll">
        <table class="tbl student-tbl">
          <thead>
            <tr>
              <th style="width:26%">Namn</th>
              <th style="width:24%">Användarnamn</th>
              <th style="width:22%">Lösenord</th>
              <th style="width:16%">Avatar</th>
              <th style="width:12%"></th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="row-inline" style="margin-top:14px">
        <button class="btn ghost" id="add-row">➕ Lägg till rad</button>
        <button class="btn ghost" id="add-five">➕ 5 rader</button>
        <button class="btn gron" id="save-all">💾 Spara alla</button>
      </div>
      <div id="result" style="margin-top:14px"></div>
    </div>
  </div>`);

  const rowsEl = view.querySelector("#rows");
  const resultEl = view.querySelector("#result");

  function avatarSelectHtml(sel) {
    return `<select class="select avatar-sel">${avatarOptions
      .map((a) => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${a.emoji}</option>`)
      .join("")}</select>`;
  }

  function addRow(student = null) {
    const isExisting = !!student;
    const row = el(`<tr class="student-row" ${isExisting ? `data-id="${esc(student.id)}"` : ""}>
      <td><input class="cell namn" value="${esc(student?.namn || "")}" placeholder="Elevens namn" /></td>
      <td><input class="cell username" value="${esc(student?.username || "")}" placeholder="användarnamn" autocapitalize="none" /></td>
      <td><input class="cell password" value="${esc(student?.password || "")}" placeholder="lösenord" /></td>
      <td>${avatarSelectHtml(student?.avatarId || "fox")}</td>
      <td class="row-actions">
        <button class="btn ghost small danger" data-act="del">Ta bort</button>
      </td>
    </tr>`);

    // Föreslå användarnamn från namnet (bara för nya rader utan username).
    if (!isExisting) {
      const namnInput = row.querySelector(".namn");
      const userInput = row.querySelector(".username");
      namnInput.addEventListener("input", () => {
        if (!userInput.dataset.touched && !userInput.value) {
          userInput.value = slugify(namnInput.value);
        }
      });
      userInput.addEventListener("input", () => (userInput.dataset.touched = "1"));
    }

    row.querySelector('[data-act="del"]').addEventListener("click", async () => {
      const id = row.dataset.id;
      if (id) {
        const namn = row.querySelector(".namn").value || id;
        if (!confirm(`Ta bort eleven "${namn}"? Detta tar även bort elevens speldata och går inte att ångra.`))
          return;
        try {
          await data.deleteStudent(id);
        } catch (err) {
          alert("Kunde inte ta bort: " + err.message);
          return;
        }
      }
      row.remove();
    });

    rowsEl.appendChild(row);
    return row;
  }

  // Fyll tabellen med befintliga elever, sorterade på namn.
  students
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"))
    .forEach((s) => addRow(s));
  if (students.length === 0) addRow();

  view.querySelector("#add-row").addEventListener("click", () => {
    const r = addRow();
    r.querySelector(".namn").focus();
  });
  view.querySelector("#add-five").addEventListener("click", () => {
    for (let i = 0; i < 5; i++) addRow();
  });

  view.querySelector("#save-all").addEventListener("click", async () => {
    resultEl.innerHTML = "";
    const rows = [...rowsEl.querySelectorAll(".student-row")];
    const errors = [];
    const toSave = [];
    const seenUsernames = new Map(); // username -> radnr

    rows.forEach((row, i) => {
      const nr = i + 1;
      const namn = row.querySelector(".namn").value.trim();
      const username = row.querySelector(".username").value.trim().toLowerCase();
      const password = row.querySelector(".password").value;
      const avatarId = row.querySelector(".avatar-sel").value;
      const existingId = row.dataset.id || null;

      // Helt tom rad? Hoppa tyst över.
      if (!namn && !username && !password) return;

      if (!namn) errors.push(`Rad ${nr}: namn saknas.`);
      if (!username) errors.push(`Rad ${nr}: användarnamn saknas.`);
      if (!password) errors.push(`Rad ${nr}: lösenord saknas.`);
      if (username && !/^[a-z0-9._-]+$/.test(username))
        errors.push(`Rad ${nr}: användarnamnet "${username}" får bara innehålla a–z, 0–9, punkt, streck.`);
      if (username) {
        if (seenUsernames.has(username))
          errors.push(`Rad ${nr}: användarnamnet "${username}" används redan på rad ${seenUsernames.get(username)}.`);
        else seenUsernames.set(username, nr);
      }

      if (namn && username && password) {
        const id = existingId || slugify(username) || `elev-${Date.now()}-${i}`;
        toSave.push({ id, namn, username, password, avatarId, row });
      }
    });

    if (errors.length > 0) {
      resultEl.innerHTML = `<div class="msg error">
        <div style="margin-bottom:6px">Rätta det här innan du sparar:</div>
        <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      </div>`;
      return;
    }
    if (toSave.length === 0) {
      resultEl.innerHTML = `<div class="msg error">Inga ifyllda rader att spara.</div>`;
      return;
    }

    const saveBtn = view.querySelector("#save-all");
    saveBtn.disabled = true;
    const old = saveBtn.textContent;
    saveBtn.textContent = "Sparar…";
    let saved = 0;
    try {
      for (const s of toSave) {
        await data.upsertStudent(s.id, {
          namn: s.namn,
          username: s.username,
          password: s.password,
          avatarId: s.avatarId,
        });
        // Märk raden som befintlig så nästa spar inte skapar dubbletter.
        s.row.dataset.id = s.id;
        saved++;
      }
      resultEl.innerHTML = `<div class="msg ok">✓ Sparade ${saved} elevkonto${saved === 1 ? "" : "n"} till databasen. Eleverna kan nu logga in på elevsidan.</div>`;
    } catch (err) {
      resultEl.innerHTML = `<div class="msg error">Sparade ${saved} av ${toSave.length} innan ett fel uppstod: ${esc(err.message)}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = old;
    }
  });

  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "elever"));
  container.appendChild(view);
  ctx.app.replaceChildren(container);
}
