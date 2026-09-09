// ============================================================================
// Pluggportalen – lärarsidan: läsnivå per elev (teacher-reading-level.js)
// ----------------------------------------------------------------------------
// Issue #154: läraren sätter en LÄSNIVÅ (1–3) per elev, så läsförståelse-läget
// kan servera texterna/frågorna på elevens nivå (svagare läsare → nivå 1,
// starkare → nivå 3, samma tema). Panelen mountas under ett klasskort i
// klasshanteringen (teacher-class-accounts.js) som en egen <details>.
//
// Nivån bor i studentData.readingLevel (data.setReadingLevel/getReadingLevel).
// Panelen läser medlemmarnas nuvarande nivåer LATT (först när den öppnas) och
// sparar direkt vid ändring. "Sätt för alla" gör det smidigt för en hel klass.
// ============================================================================

import * as data from "./data.js";
import { avatarEmoji } from "./avatars.js";
import { el, esc } from "./teacher-shared.js";
import { READING_LEVELS, READING_LEVEL_LABELS, normalizeReadingLevel } from "./reading-level.js";

/** <option>-lista för nivåväljaren, med `sel` förvald. */
function levelOptions(sel) {
  const s = normalizeReadingLevel(sel);
  return READING_LEVELS.map(
    (n) => `<option value="${n}" ${n === s ? "selected" : ""}>${esc(READING_LEVEL_LABELS[n])}</option>`
  ).join("");
}

/**
 * Koppla en <details>-panel så att läsnivåerna laddas LATT först när läraren
 * öppnar den (undviker N studentData-läsningar per klass man inte tittar på).
 * @param {HTMLDetailsElement} details  <details>-elementet
 * @param {HTMLElement} body            container inuti details att fylla
 * @param {object[]} members            klassens elever
 */
export function mountReadingLevelDetails(details, body, members) {
  if (!details || !body) return;
  let loaded = false;
  details.addEventListener("toggle", () => {
    if (details.open && !loaded) {
      loaded = true;
      renderReadingLevelPanel(body, members);
    }
  });
}

/**
 * Rendera läsnivå-panelen för EN klass in i `host`.
 * @param {HTMLElement} host   container att fylla
 * @param {object[]} members   klassens elever ({ id, namn, username, avatarId })
 */
export function renderReadingLevelPanel(host, members) {
  if (!Array.isArray(members) || members.length === 0) {
    host.replaceChildren(el(`<p class="hint">Inga elever i klassen än – skapa konton ovan först.</p>`));
    return;
  }

  host.replaceChildren(el(`<div class="spinner">Laddar läsnivåer…</div>`));

  // Läs varje elevs nuvarande nivå lazily (tolerant – en trasig elev → default).
  Promise.all(
    members.map((s) => data.getReadingLevel(s.id).catch(() => normalizeReadingLevel()))
  ).then((levels) => {
    const wrap = el(`<div class="reading-level-panel">
      <p class="hint">Sätt elevens <b>läsnivå</b> (1 lättast – 3 svårast). Eleven får sedan
        läsförståelse-texterna på sin nivå – samma tema, olika svårighet.</p>
      <div class="rl-bulk row-inline">
        <label for="rl-bulk-sel">Sätt alla till:</label>
        <select id="rl-bulk-sel" class="select rl-bulk-sel">${levelOptions()}</select>
        <button class="btn small rl-bulk-btn">Sätt för alla (${members.length})</button>
        <span class="rl-bulk-flash" aria-live="polite"></span>
      </div>
      <div class="rl-list"></div>
    </div>`);

    const listEl = wrap.querySelector(".rl-list");
    const rowById = new Map(); // id → { select, flash }

    members.forEach((s, i) => {
      const row = el(`<div class="rl-row" data-id="${esc(s.id)}">
        <span class="rl-avatar">${avatarEmoji(s.avatarId)}</span>
        <span class="rl-name">${esc(s.namn || s.username || s.id)}</span>
        <select class="select rl-sel" aria-label="Läsnivå för ${esc(s.namn || s.username || s.id)}">${levelOptions(levels[i])}</select>
        <span class="rl-flash" aria-live="polite"></span>
      </div>`);
      const select = row.querySelector(".rl-sel");
      const flash = row.querySelector(".rl-flash");
      rowById.set(s.id, { select, flash });

      select.addEventListener("change", async () => {
        const level = Number(select.value);
        select.disabled = true;
        flash.innerHTML = `<span class="hint">Sparar…</span>`;
        try {
          await data.setReadingLevel(level, s.id);
          flash.innerHTML = `<span class="gc-ok">✓ Nivå ${normalizeReadingLevel(level)}</span>`;
        } catch (err) {
          flash.innerHTML = `<span class="gc-err">${esc(err.message)}</span>`;
        } finally {
          select.disabled = false;
        }
      });
      listEl.appendChild(row);
    });

    // "Sätt för alla": skriv den valda nivån till varje elev parallellt.
    const bulkSel = wrap.querySelector(".rl-bulk-sel");
    const bulkBtn = wrap.querySelector(".rl-bulk-btn");
    const bulkFlash = wrap.querySelector(".rl-bulk-flash");
    bulkBtn.addEventListener("click", async () => {
      const level = Number(bulkSel.value);
      bulkBtn.disabled = true;
      bulkFlash.innerHTML = `<span class="hint">Sätter nivå ${normalizeReadingLevel(level)} för alla…</span>`;
      const results = await Promise.all(
        members.map((s) => data.setReadingLevel(level, s.id).then(() => true).catch(() => false))
      );
      const ok = results.filter(Boolean).length;
      // Spegla i varje väljare så vyn stämmer med det sparade.
      members.forEach((s, i) => {
        if (results[i]) {
          const r = rowById.get(s.id);
          if (r) {
            r.select.value = String(normalizeReadingLevel(level));
            r.flash.innerHTML = `<span class="gc-ok">✓ Nivå ${normalizeReadingLevel(level)}</span>`;
          }
        }
      });
      bulkFlash.innerHTML =
        ok === members.length
          ? `<span class="gc-ok">✓ Satte nivå ${normalizeReadingLevel(level)} för ${ok} elev${ok === 1 ? "" : "er"}.</span>`
          : `<span class="gc-err">Sparade ${ok}/${members.length} – försök igen för de som misslyckades.</span>`;
      bulkBtn.disabled = false;
    });

    host.replaceChildren(wrap);
  }).catch((err) => {
    host.replaceChildren(el(`<div class="msg error">Kunde inte ladda läsnivåer: ${esc(err.message)}</div>`));
  });
}
