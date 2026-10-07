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

// Ämnesflikarnas färgprick (issue #453): härleds deterministiskt ur ämnet – ingen
// ny datamodell. Kända ämnen får en fast färg (SO grön, Matematik blå …), övriga
// en färg ur paletten via en enkel hash av id:t, så samma ämne alltid får samma.
const SUBJECT_DOT_PALETTE = ["#2ec16e", "#4c9bff", "#f2a93b", "#b37dff", "#ff7a8a", "#2fc6c6", "#f06f3c"];
const SUBJECT_DOT_KNOWN = {
  so: 0, sv: 2, svenska: 2, no: 5, en: 3, engelska: 3,
  ma: 1, matte: 1, matematik: 1,
};

/** Färg för ett ämnes prick i flikraden. */
export function subjectColor(subject) {
  const id = String(subject?.id || "").toLowerCase();
  const name = String(subject?.name || "").toLowerCase();
  const known = SUBJECT_DOT_KNOWN[id] ?? SUBJECT_DOT_KNOWN[name];
  if (known !== undefined) return SUBJECT_DOT_PALETTE[known];
  let h = 0;
  for (const ch of id || name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return SUBJECT_DOT_PALETTE[h % SUBJECT_DOT_PALETTE.length];
}

/** En ämnesflik (understruken flikrad): färgprick + namn. Wiras i teacher-content.js. */
export function buildSubjectTab(subject, active) {
  return el(`<button type="button" class="subject-tab ${active ? "active" : ""}" role="tab"
    aria-selected="${active}"><span class="subject-dot" style="background:${subjectColor(subject)}"
    aria-hidden="true"></span><span>${esc(subject.name || subject.id)}</span></button>`);
}

/**
 * BIBLIOTEK – landningsvyn, allt i ETT kort (issue #453, Elias koncept): sidhuvud
 * (ikonruta + titel + undertitel), ämnesflikar som understruken flikrad med
 * "+ Nytt ämne" sist, verktygsrad (Visa årskurs till vänster, "+ Skapa nytt
 * område" till höger) och tabellen i en egen inramad behållare. Ämnesflikarna
 * (#subject-tabs) och tabellen (#area-cards) fylls från teacher-content.js.
 * Årskursfiltret ligger kvar (issue #145); sortering sker via tabellens
 * klickbara rubriker (issue #441).
 */
export function buildLibraryView() {
  return el(`<div class="studio">
    <section class="studio-card" aria-labelledby="studio-title">
      <header class="studio-head">
        <span class="teacher-page-ic" aria-hidden="true">${icon("book", 22)}</span>
        <div class="studio-head-txt">
          <h1 class="studio-title" id="studio-title">Innehållsstudion</h1>
          <p class="studio-sub">Hantera ämnen, arbetsområden och uppgifter för dina klasser</p>
        </div>
      </header>
      <div class="studio-tabs-row">
        <div class="studio-subject-tabs" id="subject-tabs" role="tablist" aria-label="Ämnen"></div>
        <button type="button" class="studio-new-subject" id="new-subject">${icon("plus", 14)}<span>Nytt ämne</span></button>
      </div>
      <div id="new-subject-form"></div>
      <div class="studio-lib-controls">
        <label class="studio-grade-filter">Visa årskurs:
          <select id="area-grade-filter" class="select">
            <option value="">Alla</option>
            <option value="ospecificerad">Ospecificerad</option>
            ${gradeOptions()}
          </select>
        </label>
        <button type="button" class="btn gron" id="create-new">${icon("plus")}<span>Skapa nytt område</span></button>
      </div>
      <div id="area-cards"><div class="spinner">Laddar…</div></div>
    </section>
  </div>`);
}
