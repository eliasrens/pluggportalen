// ============================================================================
// Pluggportalen – lärarsidan: lista befintliga arbetsområden (teacher-content-list.js)
// ----------------------------------------------------------------------------
// Renderar en rad per arbetsområde med knapparna Granska / Lägg till / Ersätt /
// Ta bort, samt visar årskurs-etiketten (issue #145). Utbrutet ur
// teacher-content.js för att hålla den filen under radtaket; anropas därifrån
// med redan filtrerade/sorterade områden och ett par handler-callbacks.
// ============================================================================

import * as data from "./data.js";
import { buildMergeForm } from "./teacher-content-merge.js";
import { buildReviewPanel } from "./teacher-content-review.js";
import { normalizeGrade, gradeLabel } from "./grades.js";
import { el, esc } from "./teacher-shared.js";

/**
 * Bygg en DOM-nod med en rad per arbetsområde.
 * @param {object[]} areas – redan filtrerade/sorterade områden att visa.
 * @param {object} opts
 * @param {object} opts.ctx        – sidkontext (router m.m.), vidare till delformulär.
 * @param {string} opts.subjectId  – valt ämne (för spara/ta bort).
 * @param {(area:object)=>void} opts.onEdit    – ladda området i redigeringsrutan.
 * @param {()=>void} opts.onRefresh – ladda om listan efter ändring (merge/ta bort).
 * @returns {HTMLElement}
 */
export function buildAreaList(areas, { ctx, subjectId, onEdit, onRefresh }) {
  const list = el(`<div class="area-rows"></div>`);
  for (const a of areas) {
    const wrap = el(`<div class="area-row-wrap"></div>`);
    const grade = normalizeGrade(a.grade);
    // Årskurs-etikett: bara utskriven när den är satt (ospecificerad döljs för att
    // inte klottra raderna). Etiketten kommer från en fast lista → säker att skriva
    // in, men esc() ändå för konsekvens.
    const gradeBadge = grade ? `<span class="badge grade-badge">${esc(gradeLabel(grade))}</span>` : "";
    const row = el(`<div class="area-row">
      <div class="area-info">
        <span class="area-emoji">${esc(a.coverEmoji || "📖")}</span>
        <div>
          <div class="area-name">${esc(a.name)} <span class="badge">${esc(a.id)}</span>${gradeBadge}</div>
          <div class="hint">${(a.texts?.length || 0)} texter · ${(a.quiz?.length || 0)} frågor · ${(a.pairs?.length || 0)} par</div>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn ghost small" data-act="review">👁️ Granska</button>
        <button class="btn ghost small gron" data-act="add">➕ Lägg till</button>
        <button class="btn ghost small" data-act="edit">Ersätt</button>
        <button class="btn ghost small danger" data-act="del">Ta bort</button>
      </div>
    </div>`);

    // Inline-slot för read-only "granska"-vy (issue #66) – öppnas under raden.
    const reviewSlot = el(`<div class="area-review" hidden></div>`);
    const reviewBtn = row.querySelector('[data-act="review"]');
    reviewBtn.addEventListener("click", () => {
      if (!reviewSlot.hidden) {
        reviewSlot.hidden = true;
        reviewSlot.innerHTML = "";
        reviewBtn.classList.remove("active");
        return;
      }
      reviewSlot.replaceChildren(buildReviewPanel(a));
      reviewSlot.hidden = false;
      reviewBtn.classList.add("active");
      reviewSlot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    // Inline-slot för "lägg till nytt innehåll" (issue #40) – öppnas under raden.
    const mergeSlot = el(`<div class="area-merge" hidden></div>`);
    row.querySelector('[data-act="add"]').addEventListener("click", () => {
      if (!mergeSlot.hidden) {
        mergeSlot.hidden = true;
        mergeSlot.innerHTML = "";
        return;
      }
      mergeSlot.replaceChildren(
        buildMergeForm(a, mergeSlot, { subjectId, onSaved: onRefresh })
      );
      mergeSlot.hidden = false;
      mergeSlot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    row.querySelector('[data-act="edit"]').addEventListener("click", () => onEdit(a));

    row.querySelector('[data-act="del"]').addEventListener("click", async () => {
      if (!confirm(`Ta bort arbetsområdet "${a.name}"? Detta går inte att ångra.`)) return;
      try {
        await data.deleteArea(subjectId, a.id);
        onRefresh();
      } catch (err) {
        alert("Kunde inte ta bort: " + err.message);
      }
    });

    wrap.appendChild(row);
    wrap.appendChild(reviewSlot);
    wrap.appendChild(mergeSlot);
    list.appendChild(wrap);
  }
  return list;
}
