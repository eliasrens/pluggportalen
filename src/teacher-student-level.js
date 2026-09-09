// ============================================================================
// Pluggportalen – lärarsidan: läsnivå per elev (teacher-student-level.js)
// ----------------------------------------------------------------------------
// Issue #154: läraren sätter en LÄSNIVÅ (1–3) per elev, så Läsuppdrag-läget
// (games-lastext.js) kan servera texterna på elevens nivå (svagare läsare →
// nivå 1, starkare → nivå 3, samma tema). Nivån bor i studentData.readingLevel
// (data.setReadingLevel/getReadingLevel).
//
// Issue #211: väljaren ligger nu DIREKT i elevlistan under Konton – en liten
// <select> per elevrad + en "Sätt för alla"-snabbknapp. Den här modulen håller
// den delade nivålogiken (batch-laddning, väljare, spar-feedback) så att
// teacher-class-accounts.js bara behöver leverera platshållar-element.
//
// OBS: separat från #155:s teacher-reading-level.js (nivå-/frågeredigerarna för
// SJÄLVA innehållet). Den här filen rör bara den PER-ELEV tilldelade nivån.
// ============================================================================

import * as data from "./data.js";
import { el, esc } from "./teacher-shared.js";
import { READING_LEVELS, READING_LEVEL_LABELS, normalizeReadingLevel } from "./reading-level.js";

/** <option>-lista för nivåväljaren, med `sel` förvald. */
export function levelOptions(sel) {
  const s = normalizeReadingLevel(sel);
  return READING_LEVELS.map(
    (n) => `<option value="${n}" ${n === s ? "selected" : ""}>${esc(READING_LEVEL_LABELS[n])}</option>`
  ).join("");
}

/**
 * Batch-läs medlemmarnas nuvarande läsnivåer (undviker att sprida N läsningar
 * över koden). Tolerant: en trasig elev faller tillbaka på default-nivån.
 * @param {object[]} members  klassens elever ({ id, ... })
 * @returns {Promise<Map<string, number>>} id → nivå (1–3)
 */
export async function loadMemberLevels(members) {
  const levels = await Promise.all(
    members.map((s) => data.getReadingLevel(s.id).catch(() => normalizeReadingLevel()))
  );
  const map = new Map();
  members.forEach((s, i) => map.set(s.id, normalizeReadingLevel(levels[i])));
  return map;
}

/** Spara en elevs nivå från en <select> och visa kort spar-feedback i `flash`. */
async function saveLevel(select, flash, studentId) {
  const level = normalizeReadingLevel(select.value);
  select.disabled = true;
  flash.innerHTML = `<span class="hint">Sparar…</span>`;
  try {
    const saved = await data.setReadingLevel(level, studentId);
    flash.innerHTML = `<span class="gc-ok">✓ Nivå ${normalizeReadingLevel(saved)}</span>`;
  } catch (err) {
    flash.innerHTML = `<span class="gc-err">${esc(err.message)}</span>`;
  } finally {
    select.disabled = false;
  }
}

/**
 * Koppla läsnivå-väljarna för en klass DIREKT i elevlistan (#211).
 *
 * teacher-class-accounts.js renderar en tom platshållare per elevrad och samlar
 * dem i `slots` (id → element). Här batch-laddas nivåerna en gång och en wired
 * <select> (autospar vid ändring) fylls in i varje slot. `bulkHost` fylls med en
 * "Sätt för alla"-snabbknapp för hela klassen.
 *
 * @param {HTMLElement} bulkHost  tom container för "Sätt för alla"-kontrollen
 * @param {Map<string, HTMLElement>} slots  elev-id → platshållarelement i raden
 * @param {object[]} members  klassens elever ({ id, namn, username, ... })
 */
export function mountMemberLevels(bulkHost, slots, members) {
  if (!Array.isArray(members) || members.length === 0) {
    if (bulkHost) bulkHost.replaceChildren();
    return;
  }

  // Laddnings-hint medan nivåerna hämtas.
  for (const slot of slots.values()) {
    if (slot) slot.replaceChildren(el(`<span class="hint">Läsnivå…</span>`));
  }

  const rowById = new Map(); // id → { select, flash }

  loadMemberLevels(members)
    .then((levelMap) => {
      members.forEach((s) => {
        const slot = slots.get(s.id);
        if (!slot) return;
        const name = s.namn || s.username || s.id;
        const cell = el(`<span class="rl-cell">
          <span class="rl-cell-label">📖 Läsnivå</span>
          <select class="select rl-sel" aria-label="Läsnivå för ${esc(name)}">${levelOptions(levelMap.get(s.id))}</select>
          <span class="rl-flash" aria-live="polite"></span>
        </span>`);
        const select = cell.querySelector(".rl-sel");
        const flash = cell.querySelector(".rl-flash");
        rowById.set(s.id, { select, flash });
        select.addEventListener("change", () => saveLevel(select, flash, s.id));
        slot.replaceChildren(cell);
      });
    })
    .catch((err) => {
      for (const slot of slots.values()) {
        if (slot) slot.replaceChildren(el(`<span class="gc-err">Kunde inte ladda läsnivå: ${esc(err.message)}</span>`));
      }
    });

  // "Sätt för alla": skriv den valda nivån till varje elev parallellt.
  if (!bulkHost) return;
  const bulk = el(`<div class="rl-bulk row-inline">
    <label for="rl-bulk-sel">📖 Läsnivå – sätt alla till:</label>
    <select id="rl-bulk-sel" class="select rl-bulk-sel">${levelOptions()}</select>
    <button class="btn small rl-bulk-btn">Sätt för alla (${members.length})</button>
    <span class="rl-bulk-flash" aria-live="polite"></span>
  </div>`);
  const bulkSel = bulk.querySelector(".rl-bulk-sel");
  const bulkBtn = bulk.querySelector(".rl-bulk-btn");
  const bulkFlash = bulk.querySelector(".rl-bulk-flash");
  bulkBtn.addEventListener("click", async () => {
    const level = normalizeReadingLevel(bulkSel.value);
    bulkBtn.disabled = true;
    bulkFlash.innerHTML = `<span class="hint">Sätter nivå ${level} för alla…</span>`;
    const results = await Promise.all(
      members.map((s) => data.setReadingLevel(level, s.id).then(() => true).catch(() => false))
    );
    const ok = results.filter(Boolean).length;
    // Spegla i varje väljare så vyn stämmer med det sparade.
    members.forEach((s, i) => {
      if (results[i]) {
        const r = rowById.get(s.id);
        if (r) {
          r.select.value = String(level);
          r.flash.innerHTML = `<span class="gc-ok">✓ Nivå ${level}</span>`;
        }
      }
    });
    bulkFlash.innerHTML =
      ok === members.length
        ? `<span class="gc-ok">✓ Satte nivå ${level} för ${ok} elev${ok === 1 ? "" : "er"}.</span>`
        : `<span class="gc-err">Sparade ${ok}/${members.length} – försök igen för de som misslyckades.</span>`;
    bulkBtn.disabled = false;
  });
  bulkHost.replaceChildren(bulk);
}
