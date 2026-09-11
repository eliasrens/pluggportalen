// ============================================================================
// Pluggportalen – lärarsidan: statisk vy-mall för innehållssidan (teacher-content-view.js)
// ----------------------------------------------------------------------------
// Bygger den tomma DOM-stommen för #/larare/innehall (ämnesväljare, lista med
// filter/sortering, AI-prompt-byggare, inmatningsruta). All wiring (händelser,
// data) sker i teacher-content.js. Utbrutet därifrån för att hålla den filen
// under radtaket – ren mall-funktion utan sidoeffekter.
// ============================================================================

import { EXERCISE_TYPES } from "./exercise-types.js";
import { GRADES } from "./grades.js";
import { listPairImageKeys } from "./pair-images.js";
import { el, esc } from "./teacher-shared.js";

/** Bygg den tomma vy-stommen. Returnerar en DOM-nod att wira upp. */
export function buildContentView() {
  return el(`<div>
    <div class="panel content-step content-step-subject">
      <h2 class="subhead" style="margin-top:0">1 · Välj ämne</h2>
      <p class="hint">Börja här: välj vilket <b>ämne</b> du vill jobba med. Allt nedanför –
        områdeslistan och inmatningen – gäller det ämne du väljer. Saknas ämnet? Skapa ett nytt.</p>
      <div class="field">
        <label for="subject">Ämne</label>
        <div class="row-inline">
          <select id="subject" class="select"></select>
          <button class="btn ghost" id="new-subject">➕ Nytt ämne</button>
        </div>
      </div>
      <div id="new-subject-form"></div>
    </div>

    <div class="panel">
      <h2 class="subhead" style="margin-top:0">2 · Områden i ämnet</h2>
      <p class="hint">Områdena i det valda ämnet. Klicka <b>Ersätt</b> på ett område (eller använd
        väljaren i steg 3) för att redigera det.</p>
      <div class="row-inline" id="area-controls" style="gap:16px;flex-wrap:wrap;margin-bottom:12px">
        <label class="row-inline" style="gap:6px">Visa årskurs:
          <select id="area-grade-filter" class="select">
            <option value="">Alla</option>
            <option value="ospecificerad">Ospecificerad</option>
            ${GRADES.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join("")}
          </select>
        </label>
        <label class="row-inline" style="gap:6px">Sortera:
          <select id="area-sort" class="select">
            <option value="order">Ordning</option>
            <option value="grade">Årskurs</option>
          </select>
        </label>
      </div>
      <div id="area-list"><div class="spinner">Laddar…</div></div>
    </div>

    <div class="panel">
      <h2 class="subhead" style="margin-top:0">3 · Lägg in / ersätt innehåll</h2>
      <p class="hint">Innehållet sparas i <b>ämnet du valde i steg 1</b>. Klistra in JSON nedan eller
        ladda upp en <b>.json</b>-fil. Ett befintligt arbetsområde med samma <b>id</b> ersätts.</p>

      <div class="field">
        <label for="edit-area-select">✏️ Redigera ett befintligt område</label>
        <p class="hint">Välj ett område så laddas det in i rutan nedan (JSON + synliga lägen). Ändra
          och klicka <b>Spara till databasen</b> så ersätts samma område – ingen JSON att klistra själv.</p>
        <select id="edit-area-select" class="select">
          <option value="">— Välj ett område att redigera —</option>
        </select>
      </div>

      <h3 style="margin:18px 0 4px">🤖 Skapa innehållet med AI (valfritt)</h3>
      <p class="hint">Kryssa i vilka övningstyper området ska ha, kopiera prompten och klistra in
        den i valfri AI (t.ex. ChatGPT, Claude eller Gemini) tillsammans med en PDF/lektionstext –
        eller skriv ett eget önskemål nedan. AI:n svarar med en JSON som du klistrar in i rutan
        längst ner. 📖 Quiz-frågor får automatiskt en egen källtext (<code>passage</code>) för
        läsförståelsen.</p>

      <div class="field">
        <label>Övningstyper på området</label>
        <p class="hint">Bara de <b>ikryssade</b> typerna kommer med – prompten (och det som sparas
          på området) anpassas efter dina val, så du tvingas inte ha med alla typer. Standard är
          Quiz; kryssa i fler bara när du behöver dem (t.ex. bildpar).</p>
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
        <label>🔢 Räknegenerator (matte)</label>
        <p class="hint">Alternativ till quiz/par: låt området <b>generera</b> räkneuppgifter automatiskt.
          Välj en tal-typ och kryssa i varianterna – inget innehåll klistras in, och området tänder
          då <b>räkna-läget</b> (inte Quiz/Para ihop/Memory, som kräver text/par). Ange bara ett
          <b>namn</b> i JSON-rutan nedan (t.ex. <code>{ "name": "Multiplikationsträning" }</code>).</p>
        <div id="generator-config"></div>
      </div>

      <div class="field">
        <label for="area-grade">Årskurs på området (valfritt)</label>
        <p class="hint">Styr AI-prompten (språk, svårighetsgrad och exempel anpassas till årskursen)
          och gör att du kan sortera/filtrera listan ovan per årskurs. Lämna <b>Ospecificerad</b> om
          området passar flera årskurser – det är en styrning, inget tvång.</p>
        <select id="area-grade" class="select">
          <option value="">Ospecificerad</option>
          ${GRADES.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join("")}
        </select>
      </div>

      <div class="field">
        <label for="area-onskemal">✍️ Eget önskemål till AI:n (valfritt)</label>
        <input id="area-onskemal" placeholder="T.ex. ämne, tema eller omfattning – vävs in i prompten" />
        <p class="hint">Har du ingen PDF/text? Beskriv ämne, årskurs och ev. omfattning här, så vävs
          det in i prompten i stället för platshållaren för bifogat material.</p>
      </div>
      <div class="row-inline" style="margin-bottom:16px">
        <button class="btn ghost" id="copy-area-prompt">📋 Kopiera AI-prompt för valda typer</button>
      </div>

      <p class="hint">🖼️ <b>Bildpar:</b> ett par (<code>pairs</code>) kan visa en färdig bild i
        stället för text – sätt <code>termImage</code> och/eller <code>defImage</code> till en
        <b>bildnyckel</b> nedan (ingen egen uppladdning). Inbyggda nycklar (partisymbol-paketet):
        ${listPairImageKeys().map((k) => `<code>${esc(k.key)}</code> (${esc(k.name)})`).join(", ")}.
        Fler bildpaket för andra ämnen kan tillkomma senare.</p>
      <div class="row-inline" style="margin-bottom:10px">
        <label class="btn ghost file-btn">
          📂 Ladda upp .json
          <input type="file" id="file" accept=".json,application/json" hidden />
        </label>
        <button class="btn ghost" id="example">Visa exempel-JSON</button>
        <button class="btn ghost" id="clear">Rensa</button>
      </div>
      <textarea id="json" class="json-input" spellcheck="false"
        placeholder='Klistra in JSON här, t.ex. { "name": "Vikingatiden", "quiz": [ ... ] }'></textarea>

      <div class="field" style="margin-top:16px">
        <label>👁️ Synliga lägen för eleverna</label>
        <p class="hint">Bocka i vilka spellägen som ska visas för det här arbetsområdet. Bara lägen
          området har innehåll för kan väljas. Klicka <b>Kontrollera</b> ovan (eller ladda ett
          befintligt område) för att uppdatera listan efter att du ändrat innehållet.</p>
        <div class="member-grid" id="mode-visibility"></div>
      </div>

      <div class="row-inline" style="margin-top:12px">
        <button class="btn" id="check">Kontrollera</button>
        <button class="btn gron" id="save">Spara till databasen</button>
      </div>
      <div id="result" style="margin-top:14px"></div>
    </div>
  </div>`);
}
