// ============================================================================
// Pluggportalen – gamemodes.js
// Pluggdelens två sidor:
//   • pageElevOmrade – översikt för ett arbetsområde: välj gamemode, se
//     stjärnor per övning (framsteg ur Firestore).
//   • pageElevSpela  – startar rätt gamemode utifrån ?mode=.
//
// Själva spelen ligger i games-quiz.js, games-match.js och games-jakt.js, och
// det gemensamma verktyget (belöning, resultatskärm, frågemotor) i
// game-shared.js. Allt innehåll läses ur Firestore via data.js.
// ============================================================================

import * as data from "./data.js";
import { app, el, go, loading, renderTopbar, getParams } from "./ui.js";
import { GAMEMODES, starRow, enc } from "./game-shared.js";
import { startQuiz, startLasforstaelse } from "./games-quiz.js";
import { startPara, startMemory } from "./games-match.js";
import { startKunskapsjakt } from "./games-jakt.js";

// ---------------------------------------------------------------------------
// Områdesöversikt: välj gamemode (med stjärnor per övning)
// ---------------------------------------------------------------------------

export async function pageElevOmrade() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  const { subj, area } = getParams();
  if (!subj || !area) return go("#/elev/plugga");

  let areaData, progress;
  try {
    [areaData, progress] = await Promise.all([
      data.getArea(subj, area),
      data.getProgress(),
    ]);
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda området: ${err.message}</div></div>`)
    );
    return;
  }
  if (!areaData) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Området hittades inte.</div></div>`)
    );
    return;
  }

  const areaProgress = progress?.[area] || {};
  const has = {
    quiz: Array.isArray(areaData.quiz) && areaData.quiz.length > 0,
    pairs: Array.isArray(areaData.pairs) && areaData.pairs.length > 0,
  };

  const cards = GAMEMODES.map((gm) => {
    const available = has[gm.needs];
    const stars = areaProgress[gm.id]?.stars || 0;
    const starsHtml = available
      ? `<span class="card-stars${stars ? " won" : ""}">${starRow(stars)}</span>`
      : `<span class="card-lock">Inget innehåll än</span>`;
    return `<button class="big-card ${gm.color} gm-card" data-mode="${gm.id}" ${available ? "" : "disabled"}>
      <span class="emoji">${gm.emoji}</span>
      <span class="title">${gm.name}</span>
      <span class="sub">${gm.sub}</span>
      ${starsHtml}
    </button>`;
  }).join("");

  const view = el(`<div>
    <a class="back-link" id="back">← Till områdena</a>
    <div class="panel center">
      <div class="big-emoji">${areaData.coverEmoji || "📖"}</div>
      <h1>${areaData.name}</h1>
      <p class="hint">${areaData.description || "Välj en övning och samla pluggcoins!"}</p>
    </div>
    <div class="card-grid">${cards}</div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/plugga"));
  view.querySelectorAll(".gm-card").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      go(`#/elev/spela?subj=${enc(subj)}&area=${enc(area)}&mode=${enc(mode)}`);
    });
  });

  app.replaceChildren(view);
}

// ---------------------------------------------------------------------------
// Dispatcher: starta rätt gamemode
// ---------------------------------------------------------------------------

export async function pageElevSpela() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  const { subj, area, mode } = getParams();
  if (!subj || !area || !mode) return go("#/elev/plugga");

  let areaData;
  try {
    areaData = await data.getArea(subj, area);
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda övningen: ${err.message}</div></div>`)
    );
    return;
  }
  if (!areaData) return go("#/elev/plugga");

  const ctx = { subj, area, areaData };
  switch (mode) {
    case "quiz": return startQuiz(ctx);
    case "lasforstaelse": return startLasforstaelse(ctx);
    case "para": return startPara(ctx);
    case "kunskapsjakt": return startKunskapsjakt(ctx);
    case "memory": return startMemory(ctx);
    default: return go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`);
  }
}
