// ============================================================================
// Pluggportalen – lärarsidan: vy-mallar för Innehållsstudion (teacher-content-view.js)
// ----------------------------------------------------------------------------
// Innehållssidan (#/larare/innehall) är ombyggd (issue #303) till en STUDIO med
// två lägen:
//   1) BIBLIOTEK (landningsvyn)  – buildLibraryView(): ämnesflikar + kort per
//      arbetsområde + "Skapa nytt område". Korten byggs i teacher-content-list.js.
//   2) FOKUSERAD KOMPOSITÖR      – buildComposerView(): en overlay som dimmar
//      biblioteket och öppnas vid skapa/redigera. Metod-växel mellan "Skapa
//      guidat" och "Klistra in / ladda upp material" – båda mynnar i samma
//      validering (src/validate.js) + "Det här skapas"-sammanfattning + Spara.
//
// Rena mall-funktioner utan sidoeffekter – ALL wiring (händelser, data, öppna/
// stänga overlay) sker i teacher-content.js. INGEN funktion från gamla sidan är
// borttagen: övningstyper, räknegenerator, årskurs, AI-prompt, klistra in/ladda
// upp/exempel/kontrollera/spara och synliga lägen finns kvar – bara omgrupperade.
// ============================================================================

import { EXERCISE_TYPES } from "./exercise-types.js";
import { GRADES } from "./grades.js";
import { listPairImageKeys } from "./pair-images.js";
import { el, esc } from "./teacher-shared.js";

const gradeOptions = () =>
  GRADES.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join("");

/**
 * BIBLIOTEK – landningsvyn. Ämnesflikarna (#subject-tabs) och korten (#area-cards)
 * fylls från teacher-content.js. Filter/sortering ligger kvar (issue #145).
 */
export function buildLibraryView() {
  return el(`<div class="studio">
    <div class="studio-toolbar panel">
      <div class="studio-subject-tabs" id="subject-tabs" role="tablist" aria-label="Ämnen"></div>
      <div class="studio-toolbar-actions">
        <button class="btn ghost" id="new-subject">➕ Nytt ämne</button>
        <button class="btn gron" id="create-new">✏️ Skapa nytt område</button>
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
      <label class="row-inline" style="gap:6px">Sortera:
        <select id="area-sort" class="select">
          <option value="order">Ordning</option>
          <option value="grade">Årskurs</option>
        </select>
      </label>
    </div>
    <div id="area-cards"><div class="spinner">Laddar…</div></div>
  </div>`);
}

/**
 * FOKUSERAD KOMPOSITÖR – en overlay (dölj/visa via hidden i teacher-content.js).
 * Backdrop-klick och stäng-knappen stänger; wiras i teacher-content.js.
 * Alla input-id:n är oförändrade mot förr (#json, #file, #example, #clear,
 * #ex-types, #generator-config, #area-grade, #area-onskemal, #copy-area-prompt,
 * #mode-visibility, #check, #save, #result) så wiringen kan återanvändas rakt av.
 */
export function buildComposerView() {
  return el(`<div class="studio-composer-overlay" id="composer-overlay" hidden>
    <div class="studio-composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <button class="cx-modal-close" id="composer-close" aria-label="Stäng kompositören">✕</button>
      <header class="composer-head">
        <span class="composer-icon" id="composer-icon">✏️</span>
        <div>
          <h2 id="composer-title" class="composer-title">Nytt arbetsområde</h2>
          <p class="composer-sub" id="composer-sub"></p>
        </div>
      </header>

      <div class="composer-basics">
        <div class="field">
          <label for="area-name">Namn på området</label>
          <input id="area-name" placeholder="T.ex. Vikingatiden eller Multiplikationsträning" />
        </div>
        <div class="field">
          <label for="area-grade">Årskurs (valfritt)</label>
          <select id="area-grade" class="select">
            <option value="">Ospecificerad</option>
            ${gradeOptions()}
          </select>
          <p class="hint">Styr AI-prompten (språk och svårighetsgrad) och gör att du kan
            sortera/filtrera biblioteket per årskurs. Lämna <b>Ospecificerad</b> om området passar
            flera årskurser.</p>
        </div>
      </div>

      <div class="method-switch" role="tablist" aria-label="Sätt att lägga in material">
        <button type="button" class="method-tab active" data-method="guidat" role="tab" aria-selected="true">
          ✨ Skapa guidat
        </button>
        <button type="button" class="method-tab" data-method="material" role="tab" aria-selected="false">
          📋 Klistra in / ladda upp material
        </button>
      </div>

      <!-- ===== METOD: Skapa guidat ============================================ -->
      <div class="composer-method" data-method="guidat">
        <p class="hint">Välj vad området ska innehålla, så anpassar sig formuläret. Du behöver inte
          tänka på något format – vi sätter ihop materialet åt dig.</p>

        <div class="ctype-switch" id="ctype-switch" role="tablist" aria-label="Innehållstyp">
          <button type="button" class="ctype-tab active" data-ctype="quiz">❓ Quiz &amp; läsförståelse</button>
          <button type="button" class="ctype-tab" data-ctype="pairs">🧩 Para ihop</button>
          <button type="button" class="ctype-tab" data-ctype="generator">🔢 Räkna (generator)</button>
        </div>

        <!-- Färdigt material (quiz / para ihop): övningstyper + AI-hjälp -->
        <div class="ctype-pane" data-ctype-pane="text">
          <div class="field">
            <label>Övningstyper på området</label>
            <p class="hint">Bara de <b>ikryssade</b> typerna kommer med. Standard är Quiz; kryssa i
              fler bara när du behöver dem (t.ex. bildpar).</p>
            <div class="member-grid" id="ex-types">
              ${EXERCISE_TYPES.filter((t) => !t.generated)
                .map(
                  (t) => `<label class="member-row">
                  <input type="checkbox" value="${esc(t.id)}"${t.id === "quiz" ? " checked" : ""} />
                  <span class="member-avatar">${esc(t.emoji)}</span>
                  <span class="member-name">${esc(t.label)}<br><span class="hint">${esc(t.hint)}</span></span>
                </label>`
                )
                .join("")}
            </div>
          </div>

          <div class="field">
            <label for="area-onskemal">✍️ Eget önskemål till AI:n (valfritt)</label>
            <input id="area-onskemal" placeholder="T.ex. ämne, tema eller omfattning – vävs in i prompten" />
            <p class="hint">Har du ingen PDF/text? Beskriv ämne, årskurs och ev. omfattning här, så
              vävs det in i prompten i stället för platshållaren för bifogat material.</p>
          </div>

          <div class="composer-callout">
            <p class="hint" style="margin:0">🤖 <b>Så gör du:</b> kopiera prompten nedan och klistra in
              den i valfri AI (ChatGPT, Claude, Gemini …) tillsammans med din PDF/lektionstext. Klistra
              sedan in AI:ns svar under <b>Klistra in / ladda upp material</b> – du får granska och
              ändra utkastet innan du sparar (inget sparas automatiskt).</p>
          </div>
          <div class="row-inline" style="margin-top:10px">
            <button class="btn ghost" id="copy-area-prompt">📋 Kopiera AI-prompt för valda typer</button>
          </div>

          <p class="hint" style="margin-top:12px">🖼️ <b>Bildpar:</b> ett par kan visa en färdig bild i
            stället för text – sätt <code>termImage</code>/<code>defImage</code> till en bildnyckel:
            ${listPairImageKeys().map((k) => `<code>${esc(k.key)}</code> (${esc(k.name)})`).join(", ")}.</p>
        </div>

        <!-- Räknegenerator (matte) -->
        <div class="ctype-pane" data-ctype-pane="generator" hidden>
          <div class="field">
            <label>🔢 Räknegenerator</label>
            <p class="hint">Låt området <b>generera</b> räkneuppgifter automatiskt – välj en tal-typ
              och kryssa i varianterna. Inget material behöver klistras in; området tänder
              <b>räkna-läget</b>. Ge bara området ett namn ovan.</p>
            <div id="generator-config"></div>
          </div>
        </div>
      </div>

      <!-- ===== METOD: Klistra in / ladda upp material ========================= -->
      <div class="composer-method" data-method="material" hidden>
        <p class="hint">Den snabba vägen: klistra in färdigt material (eller ladda upp en fil). Du
          behöver inte tänka på formatet – klicka <b>Kontrollera</b> så säger vi till om något ser
          konstigt ut.</p>
        <div class="row-inline" style="margin-bottom:10px">
          <label class="btn ghost file-btn">
            📂 Ladda upp fil
            <input type="file" id="file" accept=".json,application/json" hidden />
          </label>
          <button class="btn ghost" id="example">Infoga exempel</button>
          <button class="btn ghost" id="clear">Rensa</button>
        </div>
        <textarea id="json" class="json-input" spellcheck="false"
          placeholder='Klistra in material här, t.ex. { "name": "Vikingatiden", "quiz": [ ... ] }'></textarea>
      </div>

      <!-- ===== Delat: synliga lägen + kontrollera/spara ======================= -->
      <div class="field" style="margin-top:8px">
        <label>👁️ Synliga lägen för eleverna</label>
        <p class="hint">Bocka i vilka spellägen som ska visas för det här arbetsområdet. Bara lägen
          området har innehåll för kan väljas.</p>
        <div class="member-grid" id="mode-visibility"></div>
      </div>

      <div id="result" class="composer-result"></div>

      <div class="composer-actions">
        <button class="btn ghost" id="check">Kontrollera</button>
        <button class="btn gron" id="save">Spara</button>
      </div>
    </div>
  </div>`);
}
