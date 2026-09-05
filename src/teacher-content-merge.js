// ============================================================================
// Pluggportalen – lärarsidan: "lägg till nytt innehåll" i ett befintligt område
// (teacher-content-merge.js, issue #40)
// ----------------------------------------------------------------------------
// Inline-formuläret som öppnas under en områdesrad i #/larare/innehall. Läraren
// klistrar in BARA det nya innehållet (fler texts/quiz/pairs); det mergas in via
// parseAndMergeArea (src/merge-area.js) så befintligt behålls och dubbletter
// hoppas över. UI-delen är utbruten hit för att hålla teacher-content.js liten.
// ============================================================================

import * as data from "./data.js";
import { parseAndMergeArea } from "./merge-area.js";
import { el, esc } from "./teacher-shared.js";

const MERGE_EXAMPLE = JSON.stringify(
  {
    quiz: [
      { question: "En ny fråga?", options: ["Rätt svar", "Fel svar", "Fel svar"], answerIndex: 0 },
    ],
    pairs: [{ term: "Nytt begrepp", definition: "Förklaring av begreppet" }],
  },
  null,
  2
);

/** Bygg svenska text-bitar om vad mergningen lade till/hoppade över. */
function mergeSummaryHtml(res) {
  const a = res.added;
  const parts = [];
  if (a.texts) parts.push(`${a.texts} text${a.texts > 1 ? "er" : ""}`);
  if (a.quiz) parts.push(`${a.quiz} fråg${a.quiz > 1 ? "or" : "a"}`);
  if (a.pairs) parts.push(`${a.pairs} par`);
  const nAdded = a.texts + a.quiz + a.pairs;
  const nSkip = res.skipped.texts + res.skipped.quiz + res.skipped.pairs;
  const addTxt = nAdded ? `<b>${parts.join(", ")}</b>` : "<b>inget nytt</b> (allt fanns redan)";
  const skipTxt = nSkip ? ` ${nSkip} dubblett${nSkip > 1 ? "er" : ""} hoppades över.` : "";
  return { addTxt, skipTxt, nAdded };
}

/**
 * Bygg inline-formuläret för att lägga till nytt innehåll i ett område.
 * @param {object} area   områdesdokumentet från listan (med texts/quiz/pairs)
 * @param {HTMLElement} slot  behållaren formuläret ligger i (för "Stäng")
 * @param {{ subjectId: string, onSaved: () => void }} deps
 * @returns {HTMLElement}
 */
export function buildMergeForm(area, slot, { subjectId, onSaved }) {
  const f = el(`<div class="subpanel">
    <p class="hint">Klistra in <b>bara det nya</b> innehållet att lägga till i
      "${esc(area.name)}" – t.ex. fler <code>quiz</code>-frågor eller <code>pairs</code>.
      Befintligt innehåll behålls och dubbletter hoppas över – du behöver alltså
      inte skriva om hela JSON:en.</p>
    <div class="row-inline" style="margin-bottom:10px">
      <label class="btn ghost small file-btn">📂 Ladda upp .json
        <input type="file" accept=".json,application/json" hidden /></label>
      <button class="btn ghost small" data-act="m-example">Visa exempel</button>
    </div>
    <textarea class="json-input" spellcheck="false"
      placeholder='{ "quiz": [ { "question": "…", "options": ["…","…"], "answerIndex": 0 } ] }'></textarea>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn" data-act="m-check">Kontrollera</button>
      <button class="btn gron" data-act="m-save">Lägg till i området</button>
      <button class="btn ghost" data-act="m-cancel">Stäng</button>
    </div>
    <div class="m-result" style="margin-top:12px"></div>
  </div>`);

  const ta = f.querySelector("textarea");
  const mResult = f.querySelector(".m-result");
  const showMergeErrors = (errors) => {
    mResult.innerHTML = `<div class="msg error">
      <div style="margin-bottom:6px">Det nya innehållet kunde inte läggas till. Rätta det här:</div>
      <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
  };

  f.querySelector('[data-act="m-example"]').addEventListener("click", () => {
    ta.value = MERGE_EXAMPLE;
  });

  f.querySelector('input[type="file"]').addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ta.value = String(reader.result || "");
      mResult.innerHTML = `<div class="msg ok">Laddade filen "${esc(file.name)}". Klicka Kontrollera eller Lägg till.</div>`;
    };
    reader.onerror = () => {
      mResult.innerHTML = `<div class="msg error">Kunde inte läsa filen.</div>`;
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  f.querySelector('[data-act="m-check"]').addEventListener("click", () => {
    const res = parseAndMergeArea(ta.value, area);
    if (!res.ok) {
      showMergeErrors(res.errors);
      return;
    }
    const { addTxt, skipTxt } = mergeSummaryHtml(res);
    mResult.innerHTML = `<div class="msg ok">✓ Ser bra ut! Detta lägger till ${addTxt} i
      "${esc(area.name)}".${skipTxt} Klicka <b>Lägg till i området</b> för att spara.</div>`;
  });

  f.querySelector('[data-act="m-save"]').addEventListener("click", async () => {
    const saveBtn = f.querySelector('[data-act="m-save"]');
    saveBtn.disabled = true;
    const old = saveBtn.textContent;
    saveBtn.textContent = "Sparar…";
    try {
      // Hämta färskt område så vi inte skriver över ändringar gjorda under tiden.
      const fresh = (await data.getArea(subjectId, area.id)) || area;
      const res = parseAndMergeArea(ta.value, fresh);
      if (!res.ok) {
        showMergeErrors(res.errors);
        return;
      }
      await data.saveArea(subjectId, res.value.id, res.value);
      const { addTxt, skipTxt, nAdded } = mergeSummaryHtml(res);
      if (nAdded === 0) {
        mResult.innerHTML = `<div class="msg ok">Inget nytt lades till – ${addTxt.replace(/<\/?b>/g, "")} fanns redan.${skipTxt}</div>`;
      } else {
        mResult.innerHTML = `<div class="msg ok">✓ La till ${addTxt} i "${esc(area.name)}".${skipTxt}</div>`;
        ta.value = "";
      }
      // Uppdatera listans räknare. Byggs om helt, så slotten stängs automatiskt.
      onSaved();
    } catch (err) {
      mResult.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = old;
    }
  });

  f.querySelector('[data-act="m-cancel"]').addEventListener("click", () => {
    slot.hidden = true;
    slot.innerHTML = "";
  });

  return f;
}
