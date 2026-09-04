// ============================================================================
// Pluggportalen – lärarsidan: innehållsinmatning (teacher-content.js)
// ----------------------------------------------------------------------------
// #/larare/innehall: ämnesväljare, skapa ämne, klistra in/ladda upp JSON,
// kontrollera/spara (src/validate.js + src/data.js), lista/ersätt/ta bort
// arbetsområden.
// ============================================================================

import * as data from "./data.js";
import { parseAndValidateArea, slugify } from "./validate.js";
import { EXAMPLE_JSON } from "./prompts.js";
import { listPairImageKeys } from "./pair-images.js";
import { el, esc, isTeacher, teacherNav, renderGate } from "./teacher-shared.js";

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
      <p class="hint">🖼️ <b>Bildpar:</b> ett par (<code>pairs</code>) kan visa en färdig bild i
        stället för text – sätt <code>termImage</code> och/eller <code>defImage</code> till en
        <b>bildnyckel</b> nedan (ingen egen uppladdning). Inbyggda nycklar (partisymbol-paketet):
        ${listPairImageKeys().map((k) => `<code>${esc(k.key)}</code> (${esc(k.name)})`).join(", ")}.
        Fler bildpaket för andra ämnen kan tillkomma senare.</p>
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
