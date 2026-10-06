// ============================================================================
// Pluggporten – lärarsidan: vy-mallar för Innehållsstudion (teacher-content-view.js)
// ----------------------------------------------------------------------------
// Innehållssidan (#/larare/innehall) är ombyggd (issue #303) till en STUDIO med
// två lägen:
//   1) BIBLIOTEK (landningsvyn)  – buildLibraryView(): ämnesflikar + sorterbar
//      tabell med arbetsområden + "Skapa nytt område". Tabellen byggs i
//      teacher-content-list.js (issue #441).
//   2) SKAPA/REDIGERA – 4-stegs wizarden (issue #442) bygger sin egen DOM i
//      teacher-wizard.js + teacher-wizard-steg1–4.js (laddas dynamiskt). Härifrån
//      lånar den bara COVER_EMOJI_CHOICES (emojiväljarens snabbval).
//
// Rena mall-funktioner utan sidoeffekter – ALL wiring sker i teacher-content.js.
// ============================================================================

import { GRADES } from "./grades.js";
import { el, esc, icon } from "./teacher-shared.js";

const gradeOptions = () =>
  GRADES.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join("");

// Curerat rutnät av skol-relevanta emojis för områdets omslags-symbol (issue #307).
// Bara ett snabbval – läraren kan skriva in vilken emoji som helst i fältet bredvid.
export const COVER_EMOJI_CHOICES = [
  "📖", "📚", "✏️", "📝", "🔢", "➗", "🧮", "📐",
  "🔬", "🧪", "🌍", "🗺️", "🏛️", "⚔️", "🛶", "📜",
  "⏳", "🎨", "🎵", "🎭", "⚽", "🏃", "🌱", "🌳",
  "🐛", "🦋", "🦕", "🐬", "🌊", "☀️", "🌙", "🔭",
  "🌋", "💡", "🧩", "❓", "🔤", "🗣️", "💬", "🧠",
];

/**
 * BIBLIOTEK – landningsvyn. Ämnesflikarna (#subject-tabs) och tabellen (#area-cards)
 * fylls från teacher-content.js. Årskursfiltret ligger kvar (issue #145); sortering
 * sker via tabellens klickbara rubriker (issue #441).
 */
export function buildLibraryView() {
  return el(`<div class="studio">
    <div class="studio-toolbar panel">
      <div class="studio-subject-tabs" id="subject-tabs" role="tablist" aria-label="Ämnen"></div>
      <div class="studio-toolbar-actions">
        <button class="btn ghost" id="new-subject">${icon("plus")}<span>Nytt ämne</span></button>
        <button class="btn gron" id="create-new">${icon("pencil")}<span>Skapa nytt område</span></button>
      </div>
    </div>
    <div id="new-subject-form"></div>
    <div class="studio-lib-controls">
      <label class="row-inline" style="gap:6px">Visa årskurs:
        <select id="area-grade-filter" class="select">
          <option value="">Alla</option>
          <option value="ospecificerad">Ospecificerad</option>
          ${gradeOptions()}
        </select>
      </label>
    </div>
    <div id="area-cards"><div class="spinner">Laddar…</div></div>
  </div>`);
}
