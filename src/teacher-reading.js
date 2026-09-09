// ============================================================================
// Pluggportalen – lärarsidan: redigera läsförståelse-texter i 3 nivåer
// (teacher-reading.js, issue #152)
// ----------------------------------------------------------------------------
// Inline-editorn som öppnas under en områdesrad i #/larare/innehall. Läraren kan
//   • kopiera en AI-prompt som skapar en läs-text i tre svårighetsnivåer,
//   • klistra in AI:ns JSON och lägga till den,
//   • se/redigera VARJE nivå för sig (egen brödtext + egna kryssfrågor),
//   • lägga till/ta bort texter, frågor och svarsalternativ.
// All inmatning skrivs in säkert (esc / .value-property, aldrig rå HTML).
// Sparas genom att skriva tillbaka hela readingTexts-listan på området och
// slutvalidera med validateArea (samma väg som resten av innehållsflödet).
// UI-delen är utbruten hit för att hålla teacher-content.js liten.
// ============================================================================

import * as data from "./data.js";
import { validateArea } from "./validate.js";
import { READING_LEVELS } from "./validate-reading.js";
import { normalizeReadingPrereq } from "./reading-prereq.js";
import { buildReadingPrompt } from "./prompts.js";
import { el, esc, copyText } from "./teacher-shared.js";
import { blankQuestion, levelPane } from "./teacher-reading-level.js";

// --- Editor-state (djupkopior så området inte muteras förrän man sparar) ------

function blankLevel() {
  return { body: "", questions: [blankQuestion(), blankQuestion(), blankQuestion()] };
}
function blankText() {
  const levels = {};
  READING_LEVELS.forEach((l) => (levels[l] = blankLevel()));
  return { id: "", title: "", levels, _active: "1" };
}

/** Normalisera en (ev. ofullständig) läs-text till editorns arbetsform. */
function normText(rt) {
  const t = { id: rt?.id || "", title: rt?.title || "", levels: {}, _active: "1" };
  READING_LEVELS.forEach((l) => {
    const L = rt?.levels?.[l] || {};
    const questions = Array.isArray(L.questions) ? L.questions : [];
    t.levels[l] = {
      body: typeof L.body === "string" ? L.body : "",
      questions: questions.length
        ? questions.map((q) => ({
            question: q?.question || "",
            options: Array.isArray(q?.options) && q.options.length ? q.options.map((o) => String(o ?? "")) : ["", ""],
            answerIndex: Number.isInteger(q?.answerIndex) ? q.answerIndex : 0,
            explanation: q?.explanation || "",
          }))
        : [blankQuestion()],
    };
  });
  return t;
}

/** Rensa editor-statet till spar-form (utan _active, tomma frågor bort). */
function toSaveForm(texts) {
  return texts.map((t) => {
    const levels = {};
    READING_LEVELS.forEach((l) => {
      const L = t.levels[l];
      levels[l] = {
        body: L.body,
        questions: L.questions.map((q) => {
          const out = { question: q.question, options: q.options, answerIndex: q.answerIndex };
          if (q.explanation && q.explanation.trim()) out.explanation = q.explanation;
          return out;
        }),
      };
    });
    const out = { title: t.title, levels };
    if (t.id) out.id = t.id;
    return out;
  });
}

// --- Editorns skal ----------------------------------------------------------

/**
 * Bygg läsförståelse-editorn för ett arbetsområde.
 * @param {object} area  områdesdokumentet (med ev. readingTexts)
 * @param {HTMLElement} slot  behållaren editorn ligger i (för "Stäng")
 * @param {{ subjectId: string, onSaved: () => void }} deps
 * @returns {HTMLElement}
 */
export function buildReadingEditor(area, slot, { subjectId, onSaved }) {
  const initPrereq = normalizeReadingPrereq(area.readingPrereq);
  const state = {
    texts: (Array.isArray(area.readingTexts) ? area.readingTexts : []).map(normText),
    // Förkrav (issue #155): on/av + hur många godkända läsförståelser som krävs.
    prereqOn: !!initPrereq,
    prereqRequired: initPrereq ? initPrereq.required : 1,
  };

  const root = el(`<div class="subpanel rt-editor">
    <p class="hint">Läsförståelse-texter i <b>tre nivåer</b>: samma tema och samma fakta, men olika
      språklig svårighet (nivå 1 lättast, 3 svårast). Varje nivå har en egen text och egna
      kryssfrågor. Redigera nivåerna var för sig nedan.</p>

    <div class="rt-prereq">
      <label class="rt-prereq-toggle">
        <input type="checkbox" data-act="rt-prereq-on" />
        <span><b>🔒 Obligatoriskt förkrav:</b> eleven måste klara läsförståelsen (godkänt resultat,
          inte bara påbörjad) innan de andra övningarna i området låses upp.</span>
      </label>
      <div class="rt-prereq-count" hidden>
        <label class="rt-lbl hint" for="rt-prereq-n">Antal läsförståelser som måste klaras:</label>
        <input id="rt-prereq-n" class="rt-input rt-prereq-n" type="number" min="1" step="1" />
      </div>
    </div>

    <div class="rt-ai">
      <label class="rt-lbl hint" for="rt-onskemal">🤖 Skapa med AI (valfritt)</label>
      <input id="rt-onskemal" class="rt-input" placeholder="Tema/önskemål – t.ex. 'Vikingarnas resor'. Lämna tomt för att bifoga egen text/PDF." />
      <div class="row-inline" style="margin-top:8px">
        <button type="button" class="btn ghost small" data-act="rt-prompt">📋 Kopiera AI-prompt (3 nivåer)</button>
      </div>
      <label class="rt-lbl hint" style="margin-top:10px" for="rt-json">Klistra in AI:ns JSON och lägg till:</label>
      <textarea id="rt-json" class="rt-input" rows="3" spellcheck="false"
        placeholder='{ "title": "…", "levels": { "1": { "body": "…", "questions": [ … ] }, "2": {…}, "3": {…} } }'></textarea>
      <div class="row-inline" style="margin-top:8px">
        <button type="button" class="btn ghost small" data-act="rt-import">➕ Lägg till från JSON</button>
        <button type="button" class="btn ghost small" data-act="rt-blank">➕ Ny tom läs-text</button>
      </div>
    </div>

    <div class="rt-list"></div>

    <div class="rt-msg" style="margin-top:10px"></div>
    <div class="row-inline" style="margin-top:12px">
      <button type="button" class="btn gron" data-act="rt-save">💾 Spara läs-texterna</button>
      <button type="button" class="btn ghost" data-act="rt-close">Stäng</button>
    </div>
  </div>`);

  const listEl = root.querySelector(".rt-list");
  const msgEl = root.querySelector(".rt-msg");
  const onskemal = root.querySelector("#rt-onskemal");
  const jsonEl = root.querySelector("#rt-json");

  // --- Förkrav-kontroller (issue #155) --------------------------------------
  const prereqOnEl = root.querySelector('[data-act="rt-prereq-on"]');
  const prereqCountWrap = root.querySelector(".rt-prereq-count");
  const prereqNEl = root.querySelector("#rt-prereq-n");
  prereqOnEl.checked = state.prereqOn;
  prereqNEl.value = String(state.prereqRequired);

  // Övre gräns för "hur många": så många läs-texter som finns (minst 1). Fler går
  // inte att klara, så vi tillåter inte att kräva fler än vad som är skapat.
  function prereqMax() {
    return Math.max(1, state.texts.length);
  }
  function syncPrereqUI() {
    prereqCountWrap.hidden = !state.prereqOn;
    prereqNEl.max = String(prereqMax());
    if (state.prereqRequired > prereqMax()) {
      state.prereqRequired = prereqMax();
      prereqNEl.value = String(state.prereqRequired);
    }
  }
  prereqOnEl.addEventListener("change", () => {
    state.prereqOn = prereqOnEl.checked;
    syncPrereqUI();
  });
  prereqNEl.addEventListener("input", () => {
    const n = parseInt(prereqNEl.value, 10);
    state.prereqRequired = Number.isFinite(n) && n >= 1 ? n : 1;
  });
  prereqNEl.addEventListener("blur", () => {
    // Klamma till [1, antal texter] när fältet lämnas.
    state.prereqRequired = Math.min(prereqMax(), Math.max(1, state.prereqRequired || 1));
    prereqNEl.value = String(state.prereqRequired);
  });
  syncPrereqUI();

  function renderList() {
    syncPrereqUI(); // antal texter kan ha ändrats → uppdatera taket för förkravet
    listEl.replaceChildren();
    if (state.texts.length === 0) {
      listEl.appendChild(
        el(`<p class="hint">Inga läs-texter ännu. Skapa en med AI-prompten ovan, klistra in JSON, eller lägg till en tom.</p>`)
      );
      return;
    }
    state.texts.forEach((t, ti) => listEl.appendChild(textCard(t, ti)));
  }

  function textCard(t, ti) {
    const card = el(`<div class="rt-card"></div>`);
    const head = el(`<div class="rt-card-head"></div>`);
    const titleIn = el(`<input type="text" class="rt-input rt-title" placeholder="Tema/rubrik, t.ex. 'Vikingarnas resor'" />`);
    titleIn.value = t.title;
    titleIn.addEventListener("input", () => (t.title = titleIn.value));
    const delT = el(`<button type="button" class="btn ghost small danger" title="Ta bort hela läs-texten">🗑️</button>`);
    delT.addEventListener("click", () => {
      if (!confirm(`Ta bort läs-texten "${t.title || "(utan titel)"}"? Alla tre nivåerna försvinner.`)) return;
      state.texts.splice(ti, 1);
      renderList();
    });
    head.append(el(`<span class="rt-num badge">Läs-text ${ti + 1}</span>`), titleIn, delT);

    const tabs = el(`<div class="rt-tabs"></div>`);
    READING_LEVELS.forEach((lvl) => {
      const btn = el(`<button type="button" class="btn ghost small rt-tab">Nivå ${lvl}</button>`);
      if (t._active === lvl) btn.classList.add("active");
      btn.addEventListener("click", () => {
        t._active = lvl;
        // Rita bara om detta kort (behåll övriga korts fokus/läge).
        const fresh = textCard(t, ti);
        card.replaceWith(fresh);
      });
      tabs.appendChild(btn);
    });

    card.append(head, tabs, levelPane(t));
    return card;
  }

  // --- AI-prompt / import / lägg till ---------------------------------------
  root.querySelector('[data-act="rt-prompt"]').addEventListener("click", (e) =>
    copyText(buildReadingPrompt(onskemal.value), e.currentTarget)
  );

  root.querySelector('[data-act="rt-blank"]').addEventListener("click", () => {
    state.texts.push(blankText());
    renderList();
  });

  root.querySelector('[data-act="rt-import"]').addEventListener("click", () => {
    const raw = jsonEl.value.trim();
    if (!raw) {
      msgEl.innerHTML = `<div class="msg error">Klistra in JSON från AI:n först.</div>`;
      return;
    }
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (err) {
      msgEl.innerHTML = `<div class="msg error">Texten är inte giltig JSON: ${esc(err.message)}</div>`;
      return;
    }
    // Acceptera en ensam läs-text, en lista, eller ett objekt med readingTexts.
    let incoming = [];
    if (Array.isArray(obj)) incoming = obj;
    else if (Array.isArray(obj.readingTexts)) incoming = obj.readingTexts;
    else if (obj.levels || obj.title) incoming = [obj];
    if (incoming.length === 0) {
      msgEl.innerHTML = `<div class="msg error">Hittade ingen läs-text i JSON:en. Förväntar { "title": …, "levels": { "1":…, "2":…, "3":… } }.</div>`;
      return;
    }
    incoming.forEach((rt) => state.texts.push(normText(rt)));
    jsonEl.value = "";
    msgEl.innerHTML = `<div class="msg ok">La till ${incoming.length} läs-text${incoming.length > 1 ? "er" : ""}. Granska nedan och klicka Spara.</div>`;
    renderList();
  });

  // --- Spara ----------------------------------------------------------------
  root.querySelector('[data-act="rt-save"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Sparar…";
    try {
      const fresh = (await data.getArea(subjectId, area.id)) || area;
      const readingTexts = toSaveForm(state.texts);
      // Förkrav (issue #155): PÅ → { required } (klamma till antal texter), AV → null
      // så fältet tas bort ur dokumentet. validateArea normaliserar slutligt.
      const readingPrereq = state.prereqOn
        ? { required: Math.min(prereqMax(), Math.max(1, state.prereqRequired || 1)) }
        : null;
      const res = validateArea({ ...fresh, id: fresh.id, readingTexts, readingPrereq });
      if (!res.ok) {
        msgEl.innerHTML = `<div class="msg error">
          <div style="margin-bottom:6px">Läs-texterna kunde inte sparas. Rätta det här:</div>
          <ul class="error-list">${res.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>`;
        return;
      }
      await data.saveArea(subjectId, res.value.id, res.value);
      area.readingTexts = res.value.readingTexts;
      msgEl.innerHTML = `<div class="msg ok">✓ Sparade ${res.value.readingTexts.length} läs-text${res.value.readingTexts.length === 1 ? "" : "er"} i "${esc(area.name)}".</div>`;
      onSaved();
    } catch (err) {
      msgEl.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  root.querySelector('[data-act="rt-close"]').addEventListener("click", () => {
    slot.hidden = true;
    slot.innerHTML = "";
  });

  renderList();
  return root;
}
