// ============================================================================
// Pluggportalen – lärarsidan: klasshantering (teacher-classes.js)
// ----------------------------------------------------------------------------
// #/larare/klasser: läraren SKAPAR egna klasser (t.ex. "6A") och lägger elever
// i dem. Grunden för att senare kunna tilldela uppgifter per klass. Skiljer sig
// från #/larare/klass (klassöversikt/framsteg, läs-endast) – här ändrar man.
//
// Vyn: skapa klass · lista klasser · döp om · ta bort · lägg till/ta bort
// elever (kryssrutor mot data.getStudents()). Enkel lärarvy i stil med
// teacher-students.js. Data via src/data.js (classes-collection).
// ============================================================================

import * as data from "./data.js";
import { slugify } from "./validate.js";
import { avatarEmoji } from "./avatars.js";
import { el, esc, isTeacher, teacherNav, renderGate } from "./teacher-shared.js";

export async function pageLarareKlasser(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar klasser…</div>`));

  // Klasser + elever parallellt (elever behövs för kryssrutorna).
  let classes = [];
  let students = [];
  try {
    [classes, students] = await Promise.all([data.getClasses(), data.getStudents()]);
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda klasser: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  students = students
    .slice()
    .sort((a, b) => String(a.namn || "").localeCompare(String(b.namn || ""), "sv"));
  const studentById = new Map(students.map((s) => [s.id, s]));

  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "klasser"));

  const view = el(`<div>
    <div class="panel">
      <h1>Klasser 🏫</h1>
      <p class="hint">Skapa egna klasser (t.ex. <b>6A</b>) och lägg elever i dem. Det här är
        grunden för att senare kunna tilldela uppgifter per klass. Vill du i stället se hur
        långt eleverna kommit? Gå till <a data-hash="#/larare/klass">Klassöversikt</a>.</p>
      <form id="new-form" class="row-inline new-class">
        <input id="new-name" class="cell" placeholder="Ny klass, t.ex. 6A" autocomplete="off" />
        <button class="btn gron" type="submit">➕ Skapa klass</button>
      </form>
      <div id="new-msg"></div>
    </div>
    <div id="classes"></div>
  </div>`);

  container.appendChild(view);
  ctx.app.replaceChildren(container);
  wireHashLinks(ctx, view);

  const classesEl = view.querySelector("#classes");
  const newMsg = view.querySelector("#new-msg");

  // --- Rendera hela klasslistan från in-memory `classes` -------------------
  function renderClasses() {
    if (classes.length === 0) {
      classesEl.replaceChildren(
        el(`<div class="panel"><p class="hint">Inga klasser än. Skapa din första klass ovan.</p></div>`)
      );
      return;
    }
    classesEl.replaceChildren();
    classes
      .slice()
      .sort(
        (a, b) =>
          (Number(a.order) || 0) - (Number(b.order) || 0) ||
          String(a.name || "").localeCompare(String(b.name || ""), "sv")
      )
      .forEach((cls) => classesEl.appendChild(classCard(cls)));
  }

  // --- Ett klasskort --------------------------------------------------------
  function classCard(cls) {
    const ids = Array.isArray(cls.studentIds) ? cls.studentIds : [];
    const count = ids.length;
    const card = el(`<div class="panel class-card" data-id="${esc(cls.id)}">
      <div class="class-head">
        <div class="class-title">
          <span class="class-emoji">🏫</span>
          <span class="class-name">${esc(cls.name || cls.id)}</span>
          <span class="class-count">${count} elev${count === 1 ? "" : "er"}</span>
        </div>
        <div class="row-inline">
          <button class="btn ghost small" data-act="rename">✏️ Döp om</button>
          <button class="btn ghost small" data-act="toggle">🧑‍🎓 Elever</button>
          <button class="btn ghost small danger" data-act="del">🗑 Ta bort</button>
        </div>
      </div>
      <div class="class-members" hidden></div>
    </div>`);

    const membersEl = card.querySelector(".class-members");
    const nameEl = card.querySelector(".class-name");
    const countEl = card.querySelector(".class-count");

    // Döp om -----------------------------------------------------------------
    card.querySelector('[data-act="rename"]').addEventListener("click", async () => {
      const next = prompt("Nytt namn på klassen:", cls.name || "");
      if (next === null) return;
      const name = next.trim();
      if (!name) return;
      try {
        await data.upsertClass(cls.id, { name });
        cls.name = name;
        nameEl.textContent = name;
      } catch (err) {
        alert("Kunde inte döpa om: " + err.message);
      }
    });

    // Ta bort ----------------------------------------------------------------
    card.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm(`Ta bort klassen "${cls.name || cls.id}"? Elevkontona finns kvar – bara grupperingen försvinner.`))
        return;
      try {
        await data.deleteClass(cls.id);
        classes = classes.filter((c) => c.id !== cls.id);
        renderClasses();
      } catch (err) {
        alert("Kunde inte ta bort: " + err.message);
      }
    });

    // Elever (visa/dölj kryssrutor) ------------------------------------------
    card.querySelector('[data-act="toggle"]').addEventListener("click", () => {
      if (membersEl.hidden) {
        renderMembers(cls, membersEl, countEl);
        membersEl.hidden = false;
      } else {
        membersEl.hidden = true;
      }
    });

    return card;
  }

  // --- Kryssrute-lista för en klass ----------------------------------------
  function renderMembers(cls, membersEl, countEl) {
    if (students.length === 0) {
      membersEl.replaceChildren(
        el(`<p class="hint">Det finns inga elevkonton än. Lägg in en klass under
          <a data-hash="#/larare/elever">Elevkonton</a> först.</p>`)
      );
      wireHashLinks(ctx, membersEl);
      return;
    }

    const selected = new Set(Array.isArray(cls.studentIds) ? cls.studentIds : []);
    const rows = students
      .map(
        (s) => `<label class="member-row">
          <input type="checkbox" value="${esc(s.id)}" ${selected.has(s.id) ? "checked" : ""} />
          <span class="member-avatar">${avatarEmoji(s.avatarId)}</span>
          <span class="member-name">${esc(s.namn || s.username || s.id)}</span>
        </label>`
      )
      .join("");

    const box = el(`<div>
      <div class="member-grid">${rows}</div>
      <div class="row-inline" style="margin-top:12px">
        <button class="btn gron small" data-act="save">💾 Spara elever</button>
        <span class="member-result"></span>
      </div>
    </div>`);

    const resultEl = box.querySelector(".member-result");
    box.querySelector('[data-act="save"]').addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const picked = [...box.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Sparar…";
      try {
        await data.setClassStudents(cls.id, picked);
        cls.studentIds = picked;
        countEl.textContent = `${picked.length} elev${picked.length === 1 ? "" : "er"}`;
        resultEl.innerHTML = `<span class="ok-inline">✓ Sparat</span>`;
      } catch (err) {
        resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    membersEl.replaceChildren(box);
  }

  // --- Skapa ny klass -------------------------------------------------------
  view.querySelector("#new-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    newMsg.innerHTML = "";
    const input = view.querySelector("#new-name");
    const name = input.value.trim();
    if (!name) {
      newMsg.innerHTML = `<div class="msg error">Skriv ett namn på klassen först.</div>`;
      return;
    }
    const id = slugify(name) || `klass-${Date.now()}`;
    if (classes.some((c) => c.id === id)) {
      newMsg.innerHTML = `<div class="msg error">Det finns redan en klass som heter "${esc(name)}".</div>`;
      return;
    }
    const nextOrder = classes.reduce((m, c) => Math.max(m, Number(c.order) || 0), 0) + 1;
    try {
      await data.upsertClass(id, { name, order: nextOrder });
      classes.push({ id, name, order: nextOrder, studentIds: [] });
      input.value = "";
      newMsg.innerHTML = `<div class="msg ok">✓ Klassen "${esc(name)}" skapades. Klicka <b>Elever</b> för att lägga in elever.</div>`;
      renderClasses();
    } catch (err) {
      newMsg.innerHTML = `<div class="msg error">Kunde inte skapa klassen: ${esc(err.message)}</div>`;
    }
  });

  renderClasses();
}

/** Koppla data-hash-länkar (interna navigeringar) i ett element. */
function wireHashLinks(ctx, root) {
  root.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.go(a.dataset.hash);
    })
  );
}
