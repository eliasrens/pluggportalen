// ============================================================================
// Pluggportalen – lärarsidan: bibliotekskort för arbetsområden (teacher-content-list.js)
// ----------------------------------------------------------------------------
// Innehållsstudions BIBLIOTEK (issue #303): ett KORT per arbetsområde i det valda
// ämnet. Kortet visar ärlig status – namn, typ (quiz/par/generator med ikon),
// årskurs och en riktig mängd-indikator (antal frågor/par eller "genererat ·
// oändligt"). Klick på kortet öppnar området i kompositören (onEdit); en fotrad
// bevarar alla gamla funktioner: Granska (#66), Lägg till (#40), Nivåtexter (#152)
// och Ta bort. Utbrutet ur teacher-content.js för att hålla den under radtaket;
// anropas med redan filtrerade/sorterade områden.
// ============================================================================

import * as data from "./data.js";
import { buildMergeForm } from "./teacher-content-merge.js";
import { buildReviewPanel } from "./teacher-content-review.js";
import { buildReadingEditor } from "./teacher-reading.js";
import { areaExerciseTypes, hasGeneratorContent, EXERCISE_TYPES } from "./exercise-types.js";
import { normalizeGrade, gradeLabel } from "./grades.js";
import { el, esc } from "./teacher-shared.js";

const TYPE_BY_ID = new Map(EXERCISE_TYPES.map((t) => [t.id, t]));

/** Korta typ-etiketter för kortet (ikon + kort ord), i kanonisk ordning. */
const TYPE_SHORT = {
  quiz: "Quiz",
  pairs: "Para ihop",
  bildpar: "Bildpar",
  generator: "Räkna",
};

/** Bygg typ-badges ur områdets övningstyper (ärlig status – vad området FAKTISKT har). */
function typeBadges(a) {
  return areaExerciseTypes(a)
    .map((id) => {
      const t = TYPE_BY_ID.get(id);
      const emoji = t ? t.emoji : "•";
      return `<span class="badge type-badge">${esc(emoji)} ${esc(TYPE_SHORT[id] || id)}</span>`;
    })
    .join("");
}

/** Ärlig mängd-indikator: generator → oändligt, annars faktiska antal. */
function quantityText(a) {
  if (hasGeneratorContent(a)) {
    const variants = a.generator?.variants?.length || 0;
    return `🔢 genererat · oändligt${variants ? ` (${variants} varianter)` : ""}`;
  }
  const parts = [];
  if (a.quiz?.length) parts.push(`${a.quiz.length} frågor`);
  if (a.pairs?.length) parts.push(`${a.pairs.length} par`);
  if (a.texts?.length) parts.push(`${a.texts.length} texter`);
  if (a.readingTexts?.length) parts.push(`${a.readingTexts.length} nivåtexter`);
  return parts.length ? parts.join(" · ") : "Tomt – inget innehåll ännu";
}

/**
 * Bygg en DOM-nod med ett kort per arbetsområde.
 * @param {object[]} areas – redan filtrerade/sorterade områden att visa.
 * @param {object} opts
 * @param {string} opts.subjectId  – valt ämne (för spara/ta bort).
 * @param {(area:object)=>void} opts.onEdit – öppna området i kompositören.
 * @param {()=>void} opts.onRefresh – ladda om listan efter ändring.
 * @returns {HTMLElement}
 */
export function buildAreaCards(areas, { subjectId, onEdit, onRefresh }) {
  const grid = el(`<div class="area-cards-grid"></div>`);
  for (const a of areas) {
    const grade = normalizeGrade(a.grade);
    const gradeBadge = grade ? `<span class="badge grade-badge">${esc(gradeLabel(grade))}</span>` : "";
    const wrap = el(`<div class="area-card-wrap"></div>`);
    const card = el(`<div class="area-card" tabindex="0" role="button"
        aria-label="Redigera ${esc(a.name)}">
      <div class="area-card-top">
        <span class="area-card-emoji">${esc(a.coverEmoji || "📖")}</span>
        <div class="area-card-meta">
          <div class="area-card-name">${esc(a.name)}</div>
          <div class="area-card-badges">${typeBadges(a)}${gradeBadge}</div>
        </div>
      </div>
      <div class="area-card-count">${esc(quantityText(a))}</div>
      <div class="row-actions area-card-actions">
        <button class="btn ghost small" data-act="review">👁️ Granska</button>
        <button class="btn ghost small gron" data-act="add">➕ Lägg till</button>
        <button class="btn ghost small" data-act="reading">📖 Nivåtexter</button>
        <button class="btn ghost small danger" data-act="del">🗑️ Ta bort</button>
      </div>
    </div>`);

    // Klick/Enter på kortet (men inte på en åtgärdsknapp) öppnar kompositören.
    const openEdit = (e) => {
      if (e.target.closest("[data-act]")) return;
      onEdit(a);
    };
    card.addEventListener("click", openEdit);
    card.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.target.closest("[data-act]")) {
        e.preventDefault();
        onEdit(a);
      }
    });

    // Utfällbara slots under kortet (behåller alla gamla funktioner).
    const reviewSlot = el(`<div class="area-review" hidden></div>`);
    const mergeSlot = el(`<div class="area-merge" hidden></div>`);
    const readingSlot = el(`<div class="area-reading" hidden></div>`);

    const toggleSlot = (slot, build, btn) => {
      if (!slot.hidden) {
        slot.hidden = true;
        slot.innerHTML = "";
        btn?.classList.remove("active");
        return;
      }
      slot.replaceChildren(build());
      slot.hidden = false;
      btn?.classList.add("active");
      slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const reviewBtn = card.querySelector('[data-act="review"]');
    reviewBtn.addEventListener("click", () =>
      toggleSlot(reviewSlot, () => buildReviewPanel(a), reviewBtn)
    );
    card.querySelector('[data-act="add"]').addEventListener("click", () =>
      toggleSlot(mergeSlot, () => buildMergeForm(a, mergeSlot, { subjectId, onSaved: onRefresh }))
    );
    card.querySelector('[data-act="reading"]').addEventListener("click", () =>
      toggleSlot(readingSlot, () => buildReadingEditor(a, readingSlot, { subjectId, onSaved: onRefresh }))
    );
    card.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm(`Ta bort arbetsområdet "${a.name}"? Detta går inte att ångra.`)) return;
      try {
        await data.deleteArea(subjectId, a.id);
        onRefresh();
      } catch (err) {
        alert("Kunde inte ta bort: " + err.message);
      }
    });

    wrap.appendChild(card);
    wrap.appendChild(reviewSlot);
    wrap.appendChild(mergeSlot);
    wrap.appendChild(readingSlot);
    grid.appendChild(wrap);
  }
  return grid;
}
