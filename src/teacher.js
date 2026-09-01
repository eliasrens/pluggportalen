// ============================================================================
// Pluggportalen – lärarsidan (teacher.js)
// ----------------------------------------------------------------------------
// Allt läraren gör:
//   * Enkel lärarspärr (lösenord) så att elever inte råkar in. EJ säkerhets-
//     kritiskt – bara en tröskel. Sparas i sessionStorage.
//   * Innehållsinmatning: klistra in / ladda upp JSON för ett arbetsområde,
//     validera (src/validate.js) och spara till Firestore (src/data.js).
//     Lista + ta bort/ersätt befintliga arbetsområden. Ämnesväljare.
//   * AI-prompter: färdiga, kopierbara prompter (src/prompts.js).
//   * Elevkontohantering: tabellvy för att snabbt mata in en hel klass.
//
// Sidorna anropas från app.js router med ett `ctx` som innehåller de delade
// hjälparna { app, go, renderTopbar }.
// ============================================================================

import * as data from "./data.js";
import { parseAndValidateArea, slugify } from "./validate.js";
import { PROMPTS, EXAMPLE_JSON } from "./prompts.js";
import { AVATARS } from "./avatars.js";

// --- Lärarspärr -------------------------------------------------------------
// Inte säkerhetskritiskt – bara så att elever inte klickar sig in av misstag.
const TEACHER_PASSWORD = "larare2026";
const TEACHER_KEY = "pluggportalen.teacher";

function isTeacher() {
  try {
    return sessionStorage.getItem(TEACHER_KEY) === "1";
  } catch {
    return false;
  }
}
function setTeacher(on) {
  try {
    if (on) sessionStorage.setItem(TEACHER_KEY, "1");
    else sessionStorage.removeItem(TEACHER_KEY);
  } catch {}
}

// --- Små hjälpare -----------------------------------------------------------

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Enkel HTML-escape för att lägga in text säkert i markup. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function copyText(text, btn) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = "✓ Kopierat!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = old;
      btn.classList.remove("copied");
    }, 1600);
  };
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    // Fallback för äldre webbläsare / osäker kontext.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
      alert("Kunde inte kopiera automatiskt – markera texten och kopiera manuellt.");
    }
    ta.remove();
  }
}

/** Gemensam lärar-toppnav (flikar) för lärarsidans undersidor. */
function teacherNav(ctx, active) {
  const tabs = [
    { hash: "#/larare", key: "hem", label: "🏠 Översikt" },
    { hash: "#/larare/innehall", key: "innehall", label: "📚 Innehåll" },
    { hash: "#/larare/prompter", key: "prompter", label: "🤖 AI-prompter" },
    { hash: "#/larare/elever", key: "elever", label: "🧑‍🎓 Elevkonton" },
  ];
  const nav = el(`<div class="teacher-nav">
    ${tabs
      .map(
        (t) =>
          `<a class="tnav ${t.key === active ? "active" : ""}" data-hash="${t.hash}">${t.label}</a>`
      )
      .join("")}
    <a class="tnav logout" data-logout="1">Lås lärarläge 🔒</a>
  </div>`);
  nav.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );
  nav.querySelector("[data-logout]").addEventListener("click", () => {
    setTeacher(false);
    ctx.go("#/");
  });
  return nav;
}

// ============================================================================
// Lärarspärr + översikt
// ============================================================================

export function pageLarare(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel">
      <h1>Lärarsida 👩‍🏫</h1>
      <p class="hint">Hantera kunskapsinnehåll, hämta AI-prompter och lägg in elevkonton.</p>
    </div>
    <div class="card-grid">
      <button class="big-card bla" data-hash="#/larare/innehall">
        <span class="emoji">📚</span>
        <span class="title">Innehåll</span>
        <span class="sub">Lägg in och hantera arbetsområden</span>
      </button>
      <button class="big-card lila" data-hash="#/larare/prompter">
        <span class="emoji">🤖</span>
        <span class="title">AI-prompter</span>
        <span class="sub">Färdiga prompter som skapar innehåll åt dig</span>
      </button>
      <button class="big-card gron" data-hash="#/larare/elever">
        <span class="emoji">🧑‍🎓</span>
        <span class="title">Elevkonton</span>
        <span class="sub">Lägg in en hel klass snabbt</span>
      </button>
    </div>
    <p class="hint" style="margin-top:18px">
      Vill du fylla databasen med färdig exempeldata? Använd
      <a href="./seed/seed.html">seed-sidan</a>.
    </p>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => ctx.go("#/"));
  view.querySelectorAll("[data-hash]").forEach((b) =>
    b.addEventListener("click", () => ctx.go(b.dataset.hash))
  );
  ctx.app.replaceChildren(view);
}

function renderGate(ctx) {
  const view = el(`<div>
    <a class="back-link" id="back">← Tillbaka</a>
    <div class="panel">
      <h1 class="center">Lärarläge 🔐</h1>
      <p class="hint center">Ange lärarlösenordet för att komma vidare. (Bara en spärr så att
        elever inte råkar in – inte säkerhetskritiskt.)</p>
      <div id="msg"></div>
      <form id="form">
        <div class="field">
          <label for="p">Lärarlösenord</label>
          <input id="p" type="password" autocomplete="off" placeholder="Lösenord" />
        </div>
        <button class="btn stor" type="submit">Lås upp</button>
      </form>
      <p class="hint center" style="margin-top:14px">Standardlösenord: <b>larare2026</b></p>
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => ctx.go("#/"));
  view.querySelector("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = view.querySelector("#p").value;
    if (pw === TEACHER_PASSWORD) {
      setTeacher(true);
      pageLarare(ctx);
    } else {
      view.querySelector("#msg").innerHTML =
        `<div class="msg error">Fel lösenord. Försök igen.</div>`;
    }
  });
  ctx.app.replaceChildren(view);
}

// ============================================================================
// Innehållsinmatning
// ============================================================================

export async function pageLarareInnehall(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar ämnen…</div>`));

  let subjects = [];
  try {
    subjects = await data.getSubjects();
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda ämnen: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  // Valt ämne: SO först om det finns, annars första.
  let selected = subjects.find((s) => s.id === "so")?.id || subjects[0]?.id || null;

  const view = el(`<div>
    <div class="panel">
      <div class="panel-head">
        <h1>Innehåll 📚</h1>
      </div>
      <p class="hint">Välj ämne, klistra in eller ladda upp en arbetsområdes-JSON, kontrollera
        att den är giltig och spara till databasen. Behöver du en JSON? Hämta en färdig
        <a data-hash="#/larare/prompter">AI-prompt</a> som skapar den åt dig.</p>

      <div class="field">
        <label for="subject">Ämne</label>
        <div class="row-inline">
          <select id="subject" class="select"></select>
          <button class="btn ghost" id="new-subject">➕ Nytt ämne</button>
        </div>
      </div>
      <div id="new-subject-form"></div>

      <h2 style="margin-top:22px">Befintliga arbetsområden</h2>
      <div id="area-list"><div class="spinner">Laddar…</div></div>
    </div>

    <div class="panel">
      <h2>Lägg in / ersätt arbetsområde</h2>
      <p class="hint">Klistra in JSON nedan eller ladda upp en <b>.json</b>-fil. Ett befintligt
        arbetsområde med samma <b>id</b> ersätts.</p>
      <div class="row-inline" style="margin-bottom:10px">
        <label class="btn ghost file-btn">
          📂 Ladda upp .json
          <input type="file" id="file" accept=".json,application/json" hidden />
        </label>
        <button class="btn ghost" id="example">Visa exempel-JSON</button>
        <button class="btn ghost" id="clear">Rensa</button>
      </div>
      <textarea id="json" class="json-input" spellcheck="false"
        placeholder='Klistra in JSON här, t.ex. { "name": "Vikingatiden", "quiz": [ ... ] }'></textarea>
      <div class="row-inline" style="margin-top:12px">
        <button class="btn" id="check">Kontrollera</button>
        <button class="btn gron" id="save">Spara till databasen</button>
      </div>
      <div id="result" style="margin-top:14px"></div>
    </div>
  </div>`);

  // --- Ämnesväljare ---------------------------------------------------------
  const subjectSel = view.querySelector("#subject");
  function fillSubjectOptions() {
    subjectSel.innerHTML = subjects
      .map((s) => `<option value="${esc(s.id)}">${esc(s.icon || "")} ${esc(s.name)} (${esc(s.id)})</option>`)
      .join("");
    if (selected) subjectSel.value = selected;
  }
  fillSubjectOptions();

  subjectSel.addEventListener("change", () => {
    selected = subjectSel.value;
    refreshAreaList();
  });

  view.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );

  // --- Nytt ämne ------------------------------------------------------------
  const newSubjBtn = view.querySelector("#new-subject");
  const newSubjForm = view.querySelector("#new-subject-form");
  newSubjBtn.addEventListener("click", () => {
    if (newSubjForm.firstChild) {
      newSubjForm.innerHTML = "";
      return;
    }
    const f = el(`<div class="subpanel">
      <div class="grid-2">
        <div class="field"><label>Id (kort, t.ex. "ma")</label><input id="ns-id" placeholder="ma" /></div>
        <div class="field"><label>Namn</label><input id="ns-name" placeholder="Matematik" /></div>
        <div class="field"><label>Ikon (emoji)</label><input id="ns-icon" placeholder="➗" /></div>
        <div class="field"><label>Beskrivning</label><input id="ns-desc" placeholder="Kort beskrivning" /></div>
      </div>
      <div id="ns-msg"></div>
      <button class="btn gron" id="ns-save">Skapa ämne</button>
    </div>`);
    f.querySelector("#ns-name").addEventListener("input", (e) => {
      const idInput = f.querySelector("#ns-id");
      if (!idInput.dataset.touched) idInput.value = slugify(e.target.value);
    });
    f.querySelector("#ns-id").addEventListener("input", (e) => {
      e.target.dataset.touched = "1";
    });
    f.querySelector("#ns-save").addEventListener("click", async () => {
      const id = slugify(f.querySelector("#ns-id").value || f.querySelector("#ns-name").value);
      const name = f.querySelector("#ns-name").value.trim();
      const msg = f.querySelector("#ns-msg");
      if (!id || !name) {
        msg.innerHTML = `<div class="msg error">Fyll i både id och namn.</div>`;
        return;
      }
      if (subjects.some((s) => s.id === id)) {
        msg.innerHTML = `<div class="msg error">Det finns redan ett ämne med id "${esc(id)}".</div>`;
        return;
      }
      try {
        const order = subjects.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0) + 1;
        await data.upsertSubject(id, {
          name,
          order,
          icon: f.querySelector("#ns-icon").value.trim() || "📘",
          description: f.querySelector("#ns-desc").value.trim() || "",
        });
        subjects.push({ id, name, order });
        selected = id;
        fillSubjectOptions();
        newSubjForm.innerHTML = "";
        refreshAreaList();
      } catch (err) {
        msg.innerHTML = `<div class="msg error">Kunde inte spara: ${esc(err.message)}</div>`;
      }
    });
    newSubjForm.replaceChildren(f);
  });

  // --- Lista befintliga arbetsområden --------------------------------------
  const areaListEl = view.querySelector("#area-list");
  const jsonEl = view.querySelector("#json");

  async function refreshAreaList() {
    if (!selected) {
      areaListEl.innerHTML = `<p class="hint">Inget ämne valt.</p>`;
      return;
    }
    areaListEl.innerHTML = `<div class="spinner">Laddar…</div>`;
    let areas = [];
    try {
      areas = await data.getAreas(selected);
    } catch (err) {
      areaListEl.innerHTML = `<div class="msg error">Kunde inte ladda arbetsområden: ${esc(err.message)}</div>`;
      return;
    }
    if (areas.length === 0) {
      areaListEl.innerHTML = `<p class="hint">Inga arbetsområden i det här ämnet ännu.</p>`;
      return;
    }
    const list = el(`<div class="area-rows"></div>`);
    for (const a of areas) {
      const row = el(`<div class="area-row">
        <div class="area-info">
          <span class="area-emoji">${esc(a.coverEmoji || "📖")}</span>
          <div>
            <div class="area-name">${esc(a.name)} <span class="badge">${esc(a.id)}</span></div>
            <div class="hint">${(a.texts?.length || 0)} texter · ${(a.quiz?.length || 0)} frågor · ${(a.pairs?.length || 0)} par</div>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn ghost small" data-act="edit">Ersätt</button>
          <button class="btn ghost small danger" data-act="del">Ta bort</button>
        </div>
      </div>`);
      row.querySelector('[data-act="edit"]').addEventListener("click", () => {
        // Ladda in i textrutan för redigering/ersättning.
        const { id, ...rest } = a;
        jsonEl.value = JSON.stringify({ id, ...rest }, null, 2);
        jsonEl.scrollIntoView({ behavior: "smooth", block: "center" });
        view.querySelector("#result").innerHTML =
          `<div class="msg ok">Laddade "${esc(a.name)}" i rutan. Ändra och spara för att ersätta.</div>`;
      });
      row.querySelector('[data-act="del"]').addEventListener("click", async () => {
        if (!confirm(`Ta bort arbetsområdet "${a.name}"? Detta går inte att ångra.`)) return;
        try {
          await data.deleteArea(selected, a.id);
          refreshAreaList();
        } catch (err) {
          alert("Kunde inte ta bort: " + err.message);
        }
      });
      list.appendChild(row);
    }
    areaListEl.replaceChildren(list);
  }

  // --- Filuppladdning / exempel / rensa ------------------------------------
  view.querySelector("#file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      jsonEl.value = String(reader.result || "");
      view.querySelector("#result").innerHTML =
        `<div class="msg ok">Laddade filen "${esc(file.name)}". Klicka Kontrollera eller Spara.</div>`;
    };
    reader.onerror = () => {
      view.querySelector("#result").innerHTML =
        `<div class="msg error">Kunde inte läsa filen.</div>`;
    };
    reader.readAsText(file);
    e.target.value = ""; // så samma fil kan väljas igen
  });

  view.querySelector("#example").addEventListener("click", () => {
    jsonEl.value = EXAMPLE_JSON;
  });
  view.querySelector("#clear").addEventListener("click", () => {
    jsonEl.value = "";
    view.querySelector("#result").innerHTML = "";
  });

  // --- Kontrollera / spara --------------------------------------------------
  const resultEl = view.querySelector("#result");

  function showErrors(errors) {
    resultEl.innerHTML = `<div class="msg error">
      <div style="margin-bottom:6px">JSON:en kunde inte sparas. Rätta det här:</div>
      <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
  }

  function showValidSummary(value) {
    resultEl.innerHTML = `<div class="msg ok">
      ✓ Giltig JSON! <b>${esc(value.name)}</b> (id: <code>${esc(value.id)}</code>) –
      ${value.texts.length} texter, ${value.quiz.length} frågor, ${value.pairs.length} par.
      Klicka <b>Spara till databasen</b> för att lägga in den i ämnet.
    </div>`;
  }

  view.querySelector("#check").addEventListener("click", () => {
    const res = parseAndValidateArea(jsonEl.value);
    if (res.ok) showValidSummary(res.value);
    else showErrors(res.errors);
  });

  view.querySelector("#save").addEventListener("click", async () => {
    if (!selected) {
      resultEl.innerHTML = `<div class="msg error">Välj ett ämne först.</div>`;
      return;
    }
    const res = parseAndValidateArea(jsonEl.value);
    if (!res.ok) {
      showErrors(res.errors);
      return;
    }
    const saveBtn = view.querySelector("#save");
    saveBtn.disabled = true;
    const old = saveBtn.textContent;
    saveBtn.textContent = "Sparar…";
    try {
      // Sätt order om det saknades: nästa lediga i ämnet.
      if (typeof res.value.order !== "number" || res.value.order === 1) {
        // Behåll uttryckligt order om användaren angav ett annat än standard.
      }
      const value = { ...res.value };
      await data.saveArea(selected, value.id, value);
      resultEl.innerHTML = `<div class="msg ok">✓ Sparat! "${esc(value.name)}" finns nu i ämnet
        ${esc(subjects.find((s) => s.id === selected)?.name || selected)}.</div>`;
      refreshAreaList();
    } catch (err) {
      resultEl.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = old;
    }
  });

  ctx.app.replaceChildren(el(`<div></div>`));
  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "innehall"));
  container.appendChild(view);
  ctx.app.replaceChildren(container);
  refreshAreaList();
}

// ============================================================================
// AI-prompter
// ============================================================================

export function pageLararePrompter(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  const view = el(`<div>
    <div class="panel">
      <h1>AI-prompter 🤖</h1>
      <p class="hint">Kopiera en prompt, klistra in den i valfri AI (t.ex. ChatGPT, Claude eller
        Gemini) och bifoga en PDF eller klistra in din lektionstext. AI:n svarar då med en JSON
        som du kan klistra in under <a data-hash="#/larare/innehall">Innehåll</a>. Prompterna
        innehåller schemat och ett exempel så att resultatet passerar valideringen direkt.</p>
    </div>
    <div id="prompts"></div>
  </div>`);

  view.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );

  const wrap = view.querySelector("#prompts");
  for (const p of PROMPTS) {
    const card = el(`<div class="panel prompt-card">
      <div class="panel-head">
        <h2>${esc(p.emoji)} ${esc(p.title)}</h2>
        <button class="btn small copy-btn">📋 Kopiera prompt</button>
      </div>
      <p class="hint">${esc(p.desc)}</p>
      <pre class="code-block">${esc(p.text)}</pre>
    </div>`);
    card.querySelector(".copy-btn").addEventListener("click", (e) =>
      copyText(p.text, e.currentTarget)
    );
    wrap.appendChild(card);
  }

  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "prompter"));
  container.appendChild(view);
  ctx.app.replaceChildren(container);
}

// ============================================================================
// Elevkontohantering
// ============================================================================

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
