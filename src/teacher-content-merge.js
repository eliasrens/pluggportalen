// ============================================================================
// Pluggporten – lärarsidan: "lägg till nytt innehåll" i ett befintligt område
// (teacher-content-merge.js, issue #40)
// ----------------------------------------------------------------------------
// Inline-formuläret som öppnas under en områdesrad i #/larare/innehall. Läraren
// klistrar in BARA det nya innehållet (fler texts/quiz/pairs); det mergas in via
// parseAndMergeArea (src/merge-area.js) så befintligt behålls och dubbletter
// hoppas över. UI-delen är utbruten hit för att hålla teacher-content.js liten.
// Issue #453: överst en "Kopiera AI-prompt för mer innehåll"-knapp (+ valfritt
// önskemål) som bygger prompten med buildMorePrompt (prompts.js) – områdets typer,
// årskurs och HELA det befintliga innehållet (#471). Merge-logiken är orörd.
// Tidsjakten (#598): har området Tidsjakten kan läraren välja antal nya händelser
// till prompten, och Kontrollera visar de nya händelserna (minitidslinje) innan
// de läggs till.
// ============================================================================

import * as data from "./data.js";
import { parseAndMergeArea } from "./merge-area.js";
import { buildMorePrompt } from "./prompts.js";
import { el, esc, icon, copyText, warningsHtml } from "./teacher-shared.js";
import { areaExerciseTypes } from "./exercise-types.js";
import { TIMELINE_COUNTS, normalizeTimelineCount } from "./validate-timeline.js";
import { timelineReviewHtml } from "./teacher-timeline-mini.js";

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

// Med Tidsjakten (#598) visar exemplet även en tidslinjehändelse.
const MERGE_EXAMPLE_TIMELINE = JSON.stringify(
  {
    ...JSON.parse(MERGE_EXAMPLE),
    timeline: [
      {
        event: "Ny händelse",
        question: "Vilket år hände det?",
        year: 1523,
        description: "Kort om vad som hände – utan årtalet.",
        explanation: "Förklaring som visas efter svaret.",
      },
    ],
  },
  null,
  2
);

/** De nya händelserna efter en lyckad mergning (sist i den mergade listan). */
function addedTimeline(res) {
  const n = res.added?.timeline || 0;
  return n ? (res.value.timeline || []).slice(-n) : [];
}

/** Bygg svenska text-bitar om vad mergningen lade till/hoppade över. */
function mergeSummaryHtml(res) {
  const a = res.added;
  const parts = [];
  if (a.texts) parts.push(`${a.texts} text${a.texts > 1 ? "er" : ""}`);
  if (a.quiz) parts.push(`${a.quiz} fråg${a.quiz > 1 ? "or" : "a"}`);
  if (a.pairs) parts.push(`${a.pairs} par`);
  if (a.timeline) parts.push(`${a.timeline} tidslinjehändelse${a.timeline > 1 ? "r" : ""}`);
  if (a.readingTexts) parts.push(`${a.readingTexts} ämnestext${a.readingTexts > 1 ? "er" : ""}`);
  const nAdded = a.texts + a.quiz + a.pairs + a.timeline + (a.readingTexts || 0);
  const s = res.skipped;
  const nSkip = s.texts + s.quiz + s.pairs + s.timeline;
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
  const hasTimeline = areaExerciseTypes(area).includes("tidsjakt");
  const f = el(`<div class="subpanel merge-panel">
    <div class="merge-ai">
      <div class="merge-ai-row">
        <label class="merge-wish">
          <span>Eget önskemål (valfritt)</span>
          <input type="text" data-act="m-wish" autocomplete="off"
            placeholder="t.ex. fler svåra frågor om handel" />
        </label>
        ${hasTimeline ? `<label class="merge-wish merge-tl-count">
          <span>⏳ Nya händelser</span>
          <select class="select" data-act="m-tl-count">
            <option value="">AI:n väljer</option>
            ${TIMELINE_COUNTS.map((n) => `<option value="${n}">${n}</option>`).join("")}
          </select>
        </label>` : ""}
        <button type="button" class="btn gron merge-copy" data-act="m-copy">${icon("copy")}<span>Kopiera AI-prompt för mer innehåll</span></button>
      </div>
      <p class="merge-instr">Klistra in prompten i Claude, och klistra sedan in svaret nedan.
        Det läggs till utan dubbletter.</p>
    </div>
    <p class="hint">Klistra in <b>bara det nya</b> innehållet att lägga till i
      "${esc(area.name)}" – t.ex. fler <code>quiz</code>-frågor${hasTimeline ? ", <code>pairs</code> eller <code>timeline</code>-händelser" : " eller <code>pairs</code>"}.
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

  f.querySelector('[data-act="m-copy"]').addEventListener("click", (e) => {
    const count = normalizeTimelineCount(f.querySelector('[data-act="m-tl-count"]')?.value);
    copyText(
      buildMorePrompt(area, f.querySelector('[data-act="m-wish"]').value, undefined, { timelineCount: count }),
      e.currentTarget
    );
  });

  f.querySelector('[data-act="m-example"]').addEventListener("click", () => {
    ta.value = hasTimeline ? MERGE_EXAMPLE_TIMELINE : MERGE_EXAMPLE;
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
      "${esc(area.name)}".${skipTxt} Klicka <b>Lägg till i området</b> för att spara.</div>${warningsHtml(res.warnings)}${timelineReviewHtml(
      addedTimeline(res),
      res.value.timelineSpan
    )}`;
  });

  f.querySelector('[data-act="m-save"]').addEventListener("click", async () => {
    const saveBtn = f.querySelector('[data-act="m-save"]');
    saveBtn.disabled = true;
    const old = saveBtn.innerHTML;
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
        mResult.innerHTML = `<div class="msg ok">✓ La till ${addTxt} i "${esc(area.name)}".${skipTxt}</div>${warningsHtml(res.warnings)}`;
        ta.value = "";
      }
      // Uppdatera listans räknare. Byggs om helt, så slotten stängs automatiskt.
      onSaved();
    } catch (err) {
      mResult.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = old;
    }
  });

  f.querySelector('[data-act="m-cancel"]').addEventListener("click", () => {
    slot.hidden = true;
    slot.innerHTML = "";
  });

  return f;
}
