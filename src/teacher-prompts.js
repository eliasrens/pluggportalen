// ============================================================================
// Pluggportalen – lärarsidan: AI-prompter (teacher-prompts.js)
// ----------------------------------------------------------------------------
// #/larare/prompter: färdiga, kopierbara prompter (src/prompts.js) som skapar
// arbetsområdes-JSON åt läraren.
// ============================================================================

import { PROMPTS } from "./prompts.js";
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
        innehåller schemat och ett exempel så att resultatet passerar valideringen direkt.</p>
    </div>
    <div id="prompts"></div>
  </div>`);

  view.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", () => ctx.go(a.dataset.hash))
  );

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
      copyText(p.text, e.currentTarget)
    );
    wrap.appendChild(card);
  }

  const container = el(`<div></div>`);
  container.appendChild(teacherNav(ctx, "prompter"));
  container.appendChild(view);
  ctx.app.replaceChildren(container);
}
