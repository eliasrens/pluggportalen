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
import { GAMEMODES, starRow, enc, areaContentFlags, isModeHiddenForClassArea } from "./game-shared.js";
import { readingPrereqStatus } from "./reading-prereq.js";
import { startQuiz, startLasforstaelse } from "./games-quiz.js";
import { startLastext } from "./games-lastext.js";
import { startPara, startMemory } from "./games-match.js";
import { startKunskapsjakt } from "./games-jakt.js";
import { startSanningsjakt } from "./games-sanningsjakt.js";
// OBS: Räkna-läget (games-rakna.js → rakna-core.js) importeras DYNAMISKT i
// dispatchern nedan, inte statiskt här. Det håller de NYA filerna utanför den
// boot-kritiska statiska modulgrafen – exakt den försiktighet rotorsaksanalysen
// av live-bootkraschen 2026-09-10 (#271) slog fast: en ny fil i bootgrafen kan
// under GitHub Pages icke-atomära utrullning 404:a för en klient och fälla hela
// sidan. Samma mönster som äventyrsmotorn (await import("./adventure/index.js")).
import { THEMES } from "./adventure/themes/index.js";

// Vilket innehåll varje frågekälla i ett äventyrstema kräver (för kort-låset).
const KIND_NEEDS = { quiz: "quiz", lasforstaelse: "quiz", para: "pairs" };

/**
 * Bygg äventyrskorten generiskt ur tema-registret: varje tema med ett `oversikt`-
 * fält blir ett kort "Äventyr: <namn>". Nya teman (Spökjakten/Gruvan) behöver bara
 * lägga till en rad i THEMES – ingen ändring här. Kortet är låst tills området har
 * innehåll som temats frågekällor kan använda; annars visas stjärnor (mode "aventyr:<id>").
 *
 * Läraren kan dölja ett tema per område (#200), för hela klassen (#208) ELLER för
 * klassen på just det här området (#298), precis som övriga lägen: är "aventyr:<id>"
 * dolt (union område ∪ klass ∪ klass×område) byggs inget kort alls.
 */
function adventureCards(has, areaProgress, areaData, studentClass) {
  return Object.values(THEMES)
    .filter((t) => t && t.oversikt)
    .filter((t) => !isModeHiddenForClassArea(areaData, studentClass, `aventyr:${t.id}`))
    .map((t) => {
      const kinds = t.questionKinds || ["quiz"];
      const available = kinds.some((k) => has[KIND_NEEDS[k]]);
      const stars = areaProgress[`aventyr:${t.id}`]?.stars || 0;
      const starsHtml = available
        ? `<span class="card-stars${stars ? " won" : ""}">${starRow(stars)}</span>`
        : `<span class="card-lock">Inget innehåll än</span>`;
      return `<button class="big-card ${t.oversikt.color || "orange"} adv-card" data-tema="${t.id}" ${available ? "" : "disabled"}>
      <span class="emoji">${t.progressIcon || "🗺️"}</span>
      <span class="title">Äventyr: ${t.namn}</span>
      <span class="sub">${t.oversikt.sub || "Ett äventyr på området"}</span>
      ${starsHtml}
    </button>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Områdesöversikt: välj gamemode (med stjärnor per övning)
// ---------------------------------------------------------------------------

export async function pageElevOmrade() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  const { subj, area } = getParams();
  if (!subj || !area) return go("#/elev/plugga");

  let areaData, progress, studentClass;
  try {
    [areaData, progress, studentClass] = await Promise.all([
      data.getArea(subj, area),
      data.getProgress(),
      data.getClassForStudent().catch(() => null),
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
  const has = areaContentFlags(areaData);

  // Läsförståelse-förkrav (issue #155): läraren kan kräva att eleven klarar
  // läsförståelsen (godkänt, inte bara påbörjad) innan ÖVRIGA övningar låses upp.
  // Fail-safe: bara ett förkrav när läsförståelsen faktiskt går att spela – annars
  // skulle området kunna deadlocka. Bakåtkompatibelt (inget förkrav → allt öppet).
  const prereq = readingPrereqStatus(areaData, areaProgress);
  // Läsförståelse går att spela om området har nivåtexter (Läsuppdrag/lastext)
  // ELLER quiz-innehåll (gamla lasforstaelse). Utan något av dem finns ingen
  // uppgift att låsa upp med → lås inget (annars deadlock).
  const readingPlayable = has.readingTexts || has.quiz;
  const lockOthers = prereq.enabled && !prereq.met && readingPlayable;

  // Läraren kan dölja lägen per område (#200), för hela klassen (#208) OCH för
  // klassen på just detta område (#298): avbockade lägen (på någon av nivåerna)
  // visas inte alls som kort. Lägen UTAN underlag visas fortfarande som låsta
  // ("Inget innehåll än"), precis som förr – det är bara de urbockade (union
  // område ∪ klass ∪ klass×område) som filtreras bort.
  const cards = GAMEMODES.filter((gm) => !isModeHiddenForClassArea(areaData, studentClass, gm.id)).map((gm) => {
    const available = has[gm.needs];
    const stars = areaProgress[gm.id]?.stars || 0;
    // Själva läslägena låses aldrig – de är ju det eleven ska göra först.
    // (både gamla "lasforstaelse" och nya "lastext"/Läsuppdrag).
    const locked =
      lockOthers && gm.id !== "lasforstaelse" && gm.id !== "lastext" && available;
    let statusHtml;
    if (locked) {
      statusHtml = `<span class="card-lock">🔒 Gör läsförståelsen först</span>`;
    } else if (available) {
      statusHtml = `<span class="card-stars${stars ? " won" : ""}">${starRow(stars)}</span>`;
    } else {
      statusHtml = `<span class="card-lock">Inget innehåll än</span>`;
    }
    const disabled = !available || locked;
    return `<button class="big-card ${gm.color} gm-card${locked ? " locked" : ""}" data-mode="${gm.id}" ${disabled ? "disabled" : ""}>
      <span class="emoji">${gm.emoji}</span>
      <span class="title">${gm.name}</span>
      <span class="sub">${gm.sub}</span>
      ${statusHtml}
    </button>`;
  }).join("");

  const advCards = adventureCards(has, areaProgress, areaData, studentClass);

  // Tydlig hint ovanför korten när förkravet ännu inte är uppfyllt.
  const prereqBanner = lockOthers
    ? `<div class="panel prereq-note" role="status">🔒 <b>Gör läsförståelsen först.</b>
        Klara läsförståelsen med godkänt resultat${prereq.required > 1 ? ` (${prereq.passed}/${prereq.required} klara)` : ""}
        för att låsa upp de andra övningarna i området.</div>`
    : "";

  const view = el(`<div>
    <div class="panel center">
      <div class="big-emoji">${areaData.coverEmoji || "📖"}</div>
      <h1>${areaData.name}</h1>
      <p class="hint">${areaData.description || "Välj en övning och samla pluggcoins!"}</p>
    </div>
    ${prereqBanner}
    <div class="card-grid">${cards}${advCards}</div>
  </div>`);

  view.querySelectorAll(".gm-card").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      go(`#/elev/spela?subj=${enc(subj)}&area=${enc(area)}&mode=${enc(mode)}`);
    });
  });
  view.querySelectorAll(".adv-card").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const tema = btn.dataset.tema;
      go(`#/elev/aventyr?subj=${enc(subj)}&area=${enc(area)}&tema=${enc(tema)}`);
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

  let areaData, studentClass;
  try {
    [areaData, studentClass] = await Promise.all([
      data.getArea(subj, area),
      data.getClassForStudent().catch(() => null),
    ]);
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda övningen: ${err.message}</div></div>`)
    );
    return;
  }
  if (!areaData) return go("#/elev/plugga");

  // Ett läge som läraren bockat ur (på område-, klass- eller klass×område-nivå)
  // ska inte gå att starta direkt via URL heller.
  if (isModeHiddenForClassArea(areaData, studentClass, mode)) {
    return go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`);
  }

  const ctx = { subj, area, areaData };
  switch (mode) {
    case "quiz": return startQuiz(ctx);
    case "lasforstaelse": return startLasforstaelse(ctx);
    case "lastext": return startLastext(ctx);
    case "para": return startPara(ctx);
    case "kunskapsjakt": return startKunskapsjakt(ctx);
    case "sanningsjakt": return startSanningsjakt(ctx);
    case "memory": return startMemory(ctx);
    // Dynamisk import (se noten vid importerna): håller games-rakna.js +
    // rakna-core.js ur den statiska bootgrafen.
    case "rakna": return import("./games-rakna.js").then((m) => m.startRakna(ctx));
    default: return go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`);
  }
}
