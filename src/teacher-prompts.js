// ============================================================================
// Pluggportalen – lärarsidan: AI-prompter (teacher-prompts.js)
// ----------------------------------------------------------------------------
// #/larare/prompter: färdiga, kopierbara prompter (src/prompts.js) som skapar
// arbetsområdes-JSON åt läraren.
// ============================================================================

import { PROMPTS, buildPromptWith } from "./prompts.js";
import { listPairImageKeys } from "./pair-images.js";
import { el, esc, isTeacher, teacherNav, renderGate, copyText } from "./teacher-shared.js";

export function pageLararePrompter(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  const view = el(`<div>
    <div class="panel">
      <h1>AI-prompter 🤖</h1>
      <p class="hint">Kopiera en prompt, klistra in den i valfri AI (t.ex. ChatGPT, Claude eller
        Gemini) och bifoga en PDF eller klistra in din lektionstext. AI:n svarar då med en JSON
        som du kan klistra in under <a data-hash="#/larare/innehall">Innehåll</a>. Prompterna
        innehåller schemat och ett exempel så att resultatet passerar valideringen direkt.
        <b>Har du ingen PDF?</b> Skriv ett önskemål i fältet nedan så vävs det in i prompten
        du kopierar.</p>
      <p class="hint">📖 <b>Läsförståelse:</b> varje quizfråga behöver en egen källtext
        (<code>passage</code>) som frågan kan besvaras utifrån. Prompterna skapar detta
        automatiskt – saknar en fråga källtext får du ett tydligt felmeddelande när du
        sparar innehållet.</p>
      <p class="hint">🖼️ <b>Bildpar:</b> ett fakta-par kan visa en färdig bild i stället för
        (eller utöver) text – t.ex. matcha en partisymbol mot partinamnet. Sätt
        <code>termImage</code>/<code>defImage</code> i paret till en <b>bildnyckel</b> (ladda
        inte upp egna bilder). Nycklar som finns just nu (partisymbol-paketet):
        ${listPairImageKeys().map((k) => `<code>${esc(k.key)}</code>`).join(", ")}.
        Fler bildpaket för andra ämnen kan tillkomma senare.</p>
    </div>
    <div class="panel">
      <div class="field">
        <label for="onskemal">✍️ Eget önskemål (valfritt)</label>
        <textarea id="onskemal" class="json-input" spellcheck="false" rows="2"
          placeholder="Vill ha uppgifter för politik som passar åk 4."></textarea>
      </div>
      <p class="hint">Skriv här om du <b>inte</b> vill bifoga en PDF eller lektionstext –
        beskriv ämne, årskurs och ev. omfattning, så vävs det in i prompten du kopierar.
        Lämnar du fältet tomt fungerar allt precis som idag (platshållaren för PDF/text är kvar).</p>
    </div>
    <div id="prompts"></div>
  </div>`);

  view.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );

  const onskemalEl = view.querySelector("#onskemal");

  const wrap = view.querySelector("#prompts");
  for (const p of PROMPTS) {
    const card = el(`<div class="panel prompt-card">
      <div class="panel-head">
        <h2>${esc(p.emoji)} ${esc(p.title)}</h2>
        <button class="btn small copy-btn">📋 Kopiera prompt</button>
      </div>
      <p class="hint">${esc(p.desc)}</p>
      <pre class="code-block">${esc(p.text)}</pre>
    </div>`);
    card.querySelector(".copy-btn").addEventListener("click", (e) =>
      copyText(buildPromptWith(p.text, onskemalEl.value), e.currentTarget)
    );
    wrap.appendChild(card);
  }

  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "prompter"));
  container.appendChild(view);
  ctx.app.replaceChildren(container);
}
