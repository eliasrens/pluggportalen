// ============================================================================
// Pluggporten – lärarsidan: panelen "📖 Skapa ämnestexter"
// (teacher-amnes-create.js, issue #673, spec §6.2)
// ----------------------------------------------------------------------------
// Samma flöde som "Lägg till innehåll" (teacher-content-merge.js): kopiera en
// AI-prompt → klistra in AI:ns svar → kontrollera → spara. Här för områdets
// ämnestexter (area.readingTexts):
//   1. Antal texter per nivå (1–5, förval 3), önskemål och eget material (valfria).
//   2. "Kopiera AI-prompt" – buildAmnesPrompt (bilaga A) med befintliga titlar.
//   3. Läraren klistrar in svaret → validering (src/amneslasning/content.js) och
//      förhandsgranskning PER NIVÅ med varningar; fel stoppar bara sin text.
//      Läraren kan ta bort enskilda texter (och ångra) innan sparandet.
//   4. "Spara" – färsk kopia av området → addReadingTexts (bara tillägg, aldrig
//      överskrivning, id som krockar görs om) → validateArea som grind → saveArea.
// Laddas BARA via import() (#271) – aldrig i den statiska bootgrafen.
// ============================================================================

import * as data from "./data.js";
import { buildAmnesPrompt } from "./prompts.js";
import { validateArea } from "./validate.js";
import {
  AMNES_LEVELS,
  addReadingTexts,
  normalizeTextsPerLevel,
  parseReadingTextsPaste,
  readingTextsOf,
  validateReadingTexts,
} from "./amneslasning/content.js";
import { AMNES_TEXTS_PER_LEVEL_DEFAULT, AMNES_TEXTS_PER_LEVEL_RANGE } from "./lasresan/config.js";
import { openReaderPreview, textMetaHtml } from "./teacher-amnes-preview.js";
import { el, esc, icon, copyText, warningsHtml } from "./teacher-shared.js";

let seq = 0;

/** Felrutan (samma stil som Lägg till-panelen). */
function errorsHtml(intro, errors) {
  return `<div class="msg error">
    <div style="margin-bottom:6px">${esc(intro)}</div>
    <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
  </div>`;
}

/**
 * Bygg panelen.
 * @param {object} area – områdesdokumentet (från listan).
 * @param {{ subjectId:string, subjectName?:string, onSaved:(msg:string)=>void, onClose:()=>void }} deps
 * @returns {HTMLElement}
 */
export function buildAmnesCreatePanel(area, { subjectId, subjectName, onSaved, onClose }) {
  const id = `amn-c${++seq}`;
  const [min, max] = AMNES_TEXTS_PER_LEVEL_RANGE;
  const counts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const nOld = readingTextsOf(area).length;
  const p = el(`<section class="amn-create" aria-labelledby="${id}-h">
    <h4 class="amn-create-h" id="${id}-h">📖 Skapa ämnestexter till "${esc(area.name)}"</h4>
    <p class="amn-step"><span class="amn-step-nr">1</span> Beställ texterna av AI:n</p>
    <div class="amn-create-grid">
      <label class="amn-field amn-count">
        <span>Antal texter per nivå</span>
        <select class="select" name="count">
          ${counts.map((n) => `<option value="${n}"${n === AMNES_TEXTS_PER_LEVEL_DEFAULT ? " selected" : ""}>${n}</option>`).join("")}
        </select>
        <span class="amn-total" aria-live="polite"></span>
      </label>
      <label class="amn-field amn-wish">
        <span>Önskemål (valfritt)</span>
        <input type="text" name="wish" autocomplete="off" placeholder="t.ex. fokusera på vikingarnas handel" />
      </label>
      <label class="amn-field amn-material">
        <span>Eget material (valfritt) – AI:n utgår från det</span>
        <textarea name="material" rows="3" placeholder="Klistra in t.ex. ett stycke ur läroboken"></textarea>
      </label>
    </div>
    <div class="amn-copy-row">
      <button type="button" class="btn gron" data-act="copy">${icon("copy")}<span>Kopiera AI-prompt</span></button>
      <span class="hint">Klistra in prompten i Claude (eller en annan AI)${nOld ? `. De ${nOld} texter som redan finns följer med, så att AI:n inte skriver samma igen` : ""}.</span>
    </div>
    <p class="amn-step"><span class="amn-step-nr">2</span> Klistra in AI:ns svar</p>
    <textarea class="json-input amn-paste" name="paste" spellcheck="false" aria-label="AI:ns svar"
      placeholder='{ "readingTexts": [ { "title": "…", "level": 1, "body": "…", "questions": [ … ] } ] }'></textarea>
    <div class="row-inline amn-check-row">
      <button type="button" class="btn" data-act="check">${icon("check")}<span>Kontrollera</span></button>
    </div>
    <div class="amn-result" aria-live="polite"></div>
    <div class="amn-save-row" hidden>
      <button type="button" class="btn gron" data-act="save">${icon("save")}<span>Spara</span></button>
      <span class="hint amn-save-hint"></span>
    </div>
    <div class="amn-save-msg" role="status"></div>
    <div class="row-inline"><button type="button" class="btn ghost small" data-act="close">Stäng</button></div>
  </section>`);

  const $ = (sel) => p.querySelector(sel);
  const countEl = p.querySelector('[name="count"]');
  const pasteEl = p.querySelector('[name="paste"]');
  const result = $(".amn-result");
  const saveRow = $(".amn-save-row");
  const saveBtn = p.querySelector('[data-act="save"]');
  const saveMsg = $(".amn-save-msg");

  /** Senaste kontrollen: { items, warnings } och vilka index läraren tagit bort. */
  let checked = null;
  const removed = new Set();

  const showTotal = () => {
    const n = normalizeTextsPerLevel(countEl.value);
    $(".amn-total").textContent = `= ${n * AMNES_LEVELS.length} texter totalt`;
  };
  countEl.addEventListener("change", showTotal);
  showTotal();

  p.querySelector('[data-act="copy"]').addEventListener("click", (e) =>
    copyText(
      buildAmnesPrompt({
        area,
        subjectName,
        count: countEl.value,
        onskemal: p.querySelector('[name="wish"]').value,
        material: p.querySelector('[name="material"]').value,
      }),
      e.currentTarget
    )
  );

  /** Texterna som sparas: utan fel och inte borttagna av läraren. */
  const keptTexts = () => (checked ? checked.items.filter((it) => !it.errors.length && !removed.has(it.index)).map((it) => it.text) : []);

  function itemHtml(it) {
    const off = removed.has(it.index);
    const bad = it.errors.length > 0;
    const state = bad ? "bad" : off ? "off" : "ok";
    const status = bad
      ? `<span class="amn-badge bad">Sparas inte – rätta felen</span>`
      : off
        ? `<span class="amn-badge off">Borttagen</span>`
        : it.warnings.length
          ? `<span class="amn-badge warn">⚠️ ${it.warnings.length} varning${it.warnings.length > 1 ? "ar" : ""}</span>`
          : `<span class="amn-badge ok">✓ OK</span>`;
    const notes = [...it.errors.map((m) => ["bad", m]), ...it.warnings.map((m) => ["warn", m])];
    return `<li class="amn-item ${state}" data-index="${it.index}">
      <div class="amn-item-main">
        <div class="amn-item-title">${esc(it.text?.title || "(utan rubrik)")} ${status}</div>
        <div class="amn-item-meta">${textMetaHtml(it.text)}${it.renamedFrom ? ` · id ändrat till <code>${esc(it.text.id)}</code> (fanns redan)` : ""}</div>
        ${notes.length ? `<ul class="amn-notes">${notes.map(([k, m]) => `<li class="${k}">${esc(m)}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="amn-item-acts">
        ${bad ? "" : `<button type="button" class="btn ghost small" data-it="preview">${icon("eye", 15)}<span>Förhandsgranska</span></button>`}
        ${bad ? "" : off
          ? `<button type="button" class="btn ghost small" data-it="undo">Ångra</button>`
          : `<button type="button" class="btn ghost small amn-del" data-it="remove">${icon("trash", 15)}<span>Ta bort</span></button>`}
      </div>
    </li>`;
  }

  /** Förhandsgranskningen per nivå + sammanfattning och Spara-raden. */
  function renderChecked() {
    const { items, warnings, errors } = checked;
    const byLevel = new Map(AMNES_LEVELS.map((l) => [l, []]));
    const other = [];
    for (const it of items) (byLevel.get(it.text?.level) || other).push(it);
    const kept = keptTexts();
    const groups = [...byLevel.entries()]
      .map(([level, list]) => {
        const nKept = list.filter((it) => !it.errors.length && !removed.has(it.index)).length;
        return `<section class="amn-level">
          <h5 class="amn-level-h">Nivå ${level} <span class="amn-level-n">${nKept} text${nKept === 1 ? "" : "er"}</span></h5>
          ${list.length ? `<ol class="amn-list">${list.map(itemHtml).join("")}</ol>` : `<p class="amn-empty">Inga texter på nivå ${level} i svaret.</p>`}
        </section>`;
      })
      .join("");
    const otherHtml = other.length
      ? `<section class="amn-level"><h5 class="amn-level-h">Okänd nivå</h5><ol class="amn-list">${other.map(itemHtml).join("")}</ol></section>`
      : "";
    // Per-text-meddelandena står vid texten; här bara de som gäller helheten.
    const textMsgs = new Set(items.flatMap((it) => it.warnings));
    const global = warnings.filter((w) => !textMsgs.has(w));
    const head = errors.length
      ? errorsHtml(`${items.filter((it) => it.errors.length).length} text(er) har fel och sparas inte. Rätta i AI-svaret (eller be AI:n rätta) och kontrollera igen:`, errors)
      : `<div class="msg ok">✓ Ser bra ut! ${items.length} text${items.length === 1 ? "" : "er"} kontrollerade.</div>`;
    result.innerHTML = `${head}${warningsHtml(global)}<div class="amn-levels">${groups}${otherHtml}</div>`;
    saveRow.hidden = kept.length === 0;
    saveBtn.querySelector("span").textContent = `Spara ${kept.length} text${kept.length === 1 ? "" : "er"}`;
    $(".amn-save-hint").textContent = nOld
      ? `Läggs till efter de ${nOld} som redan finns – inget skrivs över.`
      : "Läggs till i området.";
  }

  function check() {
    saveMsg.innerHTML = "";
    const parsed = parseReadingTextsPaste(pasteEl.value);
    removed.clear();
    if (!parsed.ok) {
      checked = null;
      saveRow.hidden = true;
      result.innerHTML = errorsHtml("Svaret kunde inte läsas:", parsed.errors);
      return;
    }
    checked = validateReadingTexts(parsed.list, {
      existing: area.readingTexts || [],
      expectedPerLevel: normalizeTextsPerLevel(countEl.value),
    });
    renderChecked();
  }

  p.querySelector('[data-act="check"]').addEventListener("click", check);
  // Inklistrat svar kontrolleras direkt (samma som att klicka Kontrollera).
  pasteEl.addEventListener("paste", () => setTimeout(check, 0));

  result.addEventListener("click", (e) => {
    const b = e.target.closest("[data-it]");
    if (!b || !checked) return;
    const index = Number(b.closest("[data-index]").dataset.index);
    const it = checked.items.find((x) => x.index === index);
    if (b.dataset.it === "preview") openReaderPreview(it.text, { returnFocus: b });
    else {
      if (b.dataset.it === "remove") removed.add(index);
      else removed.delete(index);
      renderChecked();
      result.querySelector(`[data-index="${index}"] [data-it="${b.dataset.it === "remove" ? "undo" : "remove"}"]`)?.focus();
    }
  });

  saveBtn.addEventListener("click", async () => {
    const texts = keptTexts();
    if (!texts.length) return;
    saveBtn.disabled = true;
    saveMsg.innerHTML = `<div class="hint">Sparar…</div>`;
    try {
      // Färsk kopia så inget som ändrats under tiden skrivs över.
      const fresh = await data.getArea(subjectId, area.id);
      if (!fresh) throw new Error("Området finns inte längre. Ladda om sidan.");
      const recheck = validateReadingTexts(texts, { existing: fresh.readingTexts || [] });
      if (!recheck.ok) {
        saveMsg.innerHTML = errorsHtml("Kunde inte spara:", recheck.errors);
        return;
      }
      const next = addReadingTexts(fresh, recheck.valid);
      const gate = validateArea(next);
      if (!gate.ok) {
        saveMsg.innerHTML = errorsHtml("Kunde inte spara – området har fel:", gate.errors);
        return;
      }
      await data.saveArea(subjectId, area.id, next);
      onSaved(`${texts.length} ämnestext${texts.length === 1 ? "" : "er"} lades till i "${area.name}".`);
    } catch (err) {
      saveMsg.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      if (saveBtn.isConnected) saveBtn.disabled = false;
    }
  });

  p.querySelector('[data-act="close"]').addEventListener("click", onClose);
  return p;
}
