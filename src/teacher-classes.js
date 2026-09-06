// ============================================================================
// Pluggportalen – lärarsidan: klasser & elevkonton (teacher-classes.js)
// ----------------------------------------------------------------------------
// #/larare/klasser: den ENADE lärarsidan för klasser OCH elevkonton (den gamla
// #/larare/elever är sammanslagen hit och omdirigeras). Klass-centrerat:
//   * Skapa en klass + N elevkonton på en gång (auto-genererade användarnamn +
//     lösenord som visas för läraren att dela ut).
//   * Per klass: lägg till/ta bort elever, döp om, ge 🪙, ta bort konto,
//     tilldela arbetsområden.
// Skiljer sig från #/larare/klass (klassöversikt/framsteg, läs-endast).
// Kontoskapandet/medlemshanteringen bor i teacher-class-accounts.js (fil-cap).
// Data via src/data.js (classes-/students-collection).
// ============================================================================

import * as data from "./data.js";
import { slugify } from "./validate.js";
import {
  el,
  esc,
  isTeacher,
  teacherNav,
  teacherHead,
  emptyState,
  wireHashLinks,
  renderGate,
} from "./teacher-shared.js";
import {
  createAccounts,
  credentialsPanel,
  usernamePrefix,
  renderMemberManager,
} from "./teacher-class-accounts.js";

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
  // Delad, muterbar referens – medlemshanteraren pushar/plockar bort elever här
  // så alla klasskort ser samma lista utan omladdning.
  const state = { students };

  const container = el(`<div class="teacher-page"></div>`);
  container.appendChild(teacherNav(ctx, "klasser"));
  container.appendChild(
    teacherHead(ctx, {
      emoji: "🏫",
      title: "Klasser & elevkonton",
      lead: `Skapa en klass (t.ex. <b>6A</b>) och dess elevkonton på en gång. Du kan lägga
        till fler elever, döpa om, ge 🪙 och ta bort konton härifrån. Vill du i stället se hur
        långt eleverna kommit? Gå till <a data-hash="#/larare/klass">Klassöversikt</a>.`,
    })
  );

  const view = el(`<div>
    <div class="panel">
      <h2 class="subhead">➕ Skapa en ny klass</h2>
      <p class="hint">Ange klassnamn och antal elever. Vi skapar klassen och elevkontona på en
        gång – med auto-genererade användarnamn och lösenord som du får dela ut. (Sätt 0 elever
        om du bara vill skapa en tom klass.)</p>
      <form id="new-form" class="row-inline new-class">
        <input id="new-name" class="cell" placeholder="Ny klass, t.ex. 6A" autocomplete="off" />
        <input id="new-count" class="cell" type="number" min="0" max="40" step="1" value="0"
          aria-label="Antal elever" />
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
      const panel = el(`<div class="panel"></div>`);
      panel.appendChild(
        emptyState(ctx, {
          emoji: "🏫",
          title: "Inga klasser än",
          text: "Skapa din första klass i rutan ovan – t.ex. <b>6A</b> – så dyker den upp här.",
        })
      );
      classesEl.replaceChildren(panel);
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
          <button class="btn ghost small" data-act="areas">📌 Områden</button>
          <button class="btn ghost small danger" data-act="del">🗑 Ta bort</button>
        </div>
      </div>
      <div class="class-members" hidden></div>
      <div class="class-assign" hidden></div>
    </div>`);

    const membersEl = card.querySelector(".class-members");
    const assignEl = card.querySelector(".class-assign");
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
        assignEl.hidden = true;
        renderMemberManager(ctx, { cls, state, membersEl, countEl });
        membersEl.hidden = false;
      } else {
        membersEl.hidden = true;
      }
    });

    // Områden (visa/dölj tilldelning) ----------------------------------------
    card.querySelector('[data-act="areas"]').addEventListener("click", () => {
      if (assignEl.hidden) {
        membersEl.hidden = true;
        renderAssignments(cls, assignEl);
        assignEl.hidden = false;
      } else {
        assignEl.hidden = true;
      }
    });

    return card;
  }

  // --- Kryssrute-lista: vilka arbetsområden är AKTIVA för klassen ------------
  async function renderAssignments(cls, assignEl) {
    assignEl.replaceChildren(el(`<div class="spinner">Laddar arbetsområden…</div>`));

    // Ämnen + områden. Hämta bara en gång och cacha på funktionen.
    let library;
    try {
      library = await loadLibrary();
    } catch (err) {
      assignEl.replaceChildren(
        el(`<p class="err-inline">Kunde inte ladda arbetsområden: ${esc(err.message)}</p>`)
      );
      return;
    }

    if (library.length === 0) {
      assignEl.replaceChildren(
        emptyState(ctx, {
          emoji: "📚",
          title: "Inga arbetsområden än",
          text: "Lägg in innehåll först, så kan du välja vad klassen ska jobba med.",
          actionLabel: "Lägg in innehåll",
          actionHash: "#/larare/innehall",
        })
      );
      return;
    }

    const assigned = new Set(
      (Array.isArray(cls.assignedAreas) ? cls.assignedAreas : []).map(
        (a) => `${a.subjectId}/${a.areaId}`
      )
    );

    const groups = library
      .map((subj) => {
        const rows = subj.areas
          .map(
            (a) => `<label class="member-row">
              <input type="checkbox" data-subj="${esc(subj.id)}" data-area="${esc(a.id)}"
                ${assigned.has(`${subj.id}/${a.id}`) ? "checked" : ""} />
              <span class="member-avatar">${esc(a.coverEmoji || "📖")}</span>
              <span class="member-name">${esc(a.name || a.id)}</span>
            </label>`
          )
          .join("");
        return `<div class="assign-group">
          <div class="assign-subject">${esc(subj.icon || "📚")} ${esc(subj.name || subj.id)}</div>
          <div class="member-grid">${rows}</div>
        </div>`;
      })
      .join("");

    const box = el(`<div>
      <p class="hint">Kryssa i de arbetsområden klassen jobbar med <b>nu</b>. Eleverna
        ser då bara dem i Plugga. Lämnar du allt tomt ser eleverna hela biblioteket.</p>
      ${groups}
      <div class="row-inline" style="margin-top:12px">
        <button class="btn gron small" data-act="save-areas">💾 Spara områden</button>
        <button class="btn ghost small" data-act="clear-areas">Rensa (visa allt)</button>
        <span class="assign-result"></span>
      </div>
    </div>`);

    const resultEl = box.querySelector(".assign-result");

    box.querySelector('[data-act="clear-areas"]').addEventListener("click", () => {
      box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
    });

    box.querySelector('[data-act="save-areas"]').addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const picked = [...box.querySelectorAll('input[type="checkbox"]:checked')].map((c) => ({
        subjectId: c.dataset.subj,
        areaId: c.dataset.area,
      }));
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Sparar…";
      resultEl.innerHTML = "";
      try {
        await data.setClassAssignments(cls.id, picked);
        cls.assignedAreas = picked;
        resultEl.innerHTML = picked.length
          ? `<span class="ok-inline">✓ Sparat (${picked.length} område${picked.length === 1 ? "" : "n"})</span>`
          : `<span class="ok-inline">✓ Sparat – eleverna ser allt</span>`;
      } catch (err) {
        resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });

    assignEl.replaceChildren(box);
  }

  // Ämnen + deras områden, hämtas en gång och cachas (delas av alla klasskort).
  let libraryCache = null;
  async function loadLibrary() {
    if (libraryCache) return libraryCache;
    const subjects = await data.getSubjects();
    const withAreas = await Promise.all(
      subjects.map(async (subj) => ({ ...subj, areas: await data.getAreas(subj.id) }))
    );
    libraryCache = withAreas.filter((subj) => subj.areas.length > 0);
    return libraryCache;
  }

  // --- Skapa ny klass (+ N elevkonton) -------------------------------------
  view.querySelector("#new-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    newMsg.innerHTML = "";
    const input = view.querySelector("#new-name");
    const countInput = view.querySelector("#new-count");
    const name = input.value.trim();
    if (!name) {
      newMsg.innerHTML = `<div class="msg error">Skriv ett namn på klassen först.</div>`;
      return;
    }
    const count = Math.max(0, Math.floor(Number(countInput.value) || 0));
    const id = slugify(name) || `klass-${Date.now()}`;
    if (classes.some((c) => c.id === id)) {
      newMsg.innerHTML = `<div class="msg error">Det finns redan en klass som heter "${esc(name)}".</div>`;
      return;
    }
    const nextOrder = classes.reduce((m, c) => Math.max(m, Number(c.order) || 0), 0) + 1;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await data.upsertClass(id, { name, order: nextOrder });
      const cls = { id, name, order: nextOrder, studentIds: [] };

      let created = [];
      if (count > 0) {
        newMsg.innerHTML = `<div class="msg ok">Skapar ${count} elevkonto${count === 1 ? "" : "n"}…</div>`;
        const taken = new Set(
          state.students.map((s) => String(s.username || "").toLowerCase()).filter(Boolean)
        );
        created = await createAccounts({
          count,
          prefix: usernamePrefix(name),
          taken,
          onProgress: (done, total) => {
            newMsg.innerHTML = `<div class="msg ok">Skapar elevkonton… ${done}/${total}</div>`;
          },
        });
        created.forEach((c) =>
          state.students.push({ id: c.id, namn: c.namn, username: c.username, avatarId: "fox" })
        );
        cls.studentIds = created.map((c) => c.id);
        await data.setClassStudents(id, cls.studentIds);
      }

      classes.push(cls);
      input.value = "";
      countInput.value = "0";
      newMsg.replaceChildren(
        el(
          `<div class="msg ok">✓ Klassen "${esc(name)}" skapades${
            count > 0 ? ` med ${created.length} elevkonto${created.length === 1 ? "" : "n"}` : ""
          }. Klicka <b>Elever</b> på klasskortet för att hantera dem.</div>`
        )
      );
      if (created.length > 0) newMsg.appendChild(credentialsPanel(name, created));
      renderClasses();
    } catch (err) {
      newMsg.innerHTML = `<div class="msg error">Kunde inte skapa klassen: ${esc(err.message)}</div>`;
    } finally {
      submitBtn.disabled = false;
    }
  });

  renderClasses();
}
