// ============================================================================
// Pluggporten – gamemodes.js
// Pluggdelens två sidor:
//   • pageElevOmrade – översikt för ett arbetsområde: välj gamemode, se
//     stjärnor per övning + "Ditt framsteg" per kategori (#447, framsteg ur
//     Firestore; panelen byggs i plugga-framsteg.js, dynamiskt importerad).
//   • pageElevSpela  – startar rätt gamemode utifrån ?mode=.
//
// Själva spelen ligger i games-quiz.js, games-match.js och games-jakt.js, och
// det gemensamma verktyget (belöning, resultatskärm, frågemotor) i
// game-shared.js. Allt innehåll läses ur Firestore via data.js.
// ============================================================================

import * as data from "./data.js";
import { app, el, go, loading, renderTopbar, getParams, escHtml } from "./ui.js";
import { starIcon } from "./icons.js";
import { GAMEMODES, starRow, enc, areaContentFlags, isModeHiddenForClassArea, areaStarModes } from "./game-shared.js";
import { readingPrereqStatus } from "./reading-prereq.js";
import { startQuiz, startLasforstaelse } from "./games-quiz.js";
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
// "generator" (#296): äventyr på ett generator-område låses upp av generator-underlag.
const KIND_NEEDS = { quiz: "quiz", lasforstaelse: "quiz", para: "pairs", generator: "generator" };

/**
 * Bygg äventyrskorten generiskt ur tema-registret: varje tema med ett `oversikt`-
 * fält blir ett kort "Äventyr: <namn>". Nya teman (Spökjakten/Gruvan) behöver bara
 * lägga till en rad i THEMES – ingen ändring här. Kortet är låst tills området har
 * innehåll som temats frågekällor kan använda; annars visas stjärnor (mode "aventyr:<id>").
 *
 * Läraren kan dölja ett tema per område (#200), för hela klassen (#208) ELLER för
 * klassen på just det här området (#298), precis som övriga lägen: är "aventyr:<id>"
 * dolt (union område ∪ klass ∪ klass×område) byggs inget kort alls.
 *
 * Ett tema vars frågekällor saknar underlag på området renderas INTE alls i
 * elevvyn (#311) – tidigare visades det som ett låst "Inget innehåll än"-kort.
 */
function visibleThemes(has, areaData, studentClass) {
  return Object.values(THEMES)
    .filter((t) => t && t.oversikt)
    .filter((t) => (t.questionKinds || ["quiz"]).some((k) => has[KIND_NEEDS[k]]))
    .filter((t) => !isModeHiddenForClassArea(areaData, studentClass, `aventyr:${t.id}`));
}

/**
 * Bilden överst på äventyrskortet (#703/#704): temats `oversikt.scen()` (SVG,
 * viewBox 320×140) om den finns, annars reservläget – en färgad yta med temats
 * emoji stor i mitten. Ett fel i bilden ger reservläget, aldrig en trasig sida.
 */
function adventureScene(t) {
  try {
    const svg = typeof t.oversikt.scen === "function" ? t.oversikt.scen() : "";
    if (svg) return `<span class="scen" aria-hidden="true">${svg}</span>`;
  } catch {}
  return `<span class="scen scen-reserv" aria-hidden="true">${t.progressIcon || "🗺️"}</span>`;
}

function adventureCards(themes, areaProgress, fortsattId) {
  return themes
    .map((t) => {
      const mode = `aventyr:${t.id}`;
      const stars = areaProgress[mode]?.stars || 0;
      const starsHtml = `<span class="card-stars${stars ? " won" : ""}" aria-label="${stars} av 3 stjärnor">${starRow(stars)}</span>`;
      const fortsatt = mode === fortsattId;
      // Namnet utan "Äventyr:" – sektionsrubriken säger redan det (spec §3.4).
      return `<button class="big-card ${t.oversikt.color || "orange"} adv-liten adv-card${fortsatt ? " fortsatt-har" : ""}" data-tema="${t.id}">
      ${fortsatt ? `<span class="nymarke">Fortsätt här</span>` : ""}${adventureScene(t)}
      <span class="adv-rad">
        <span class="txt">
          <span class="title">${t.namn}</span>
          <span class="sub">${t.oversikt.sub || "Ett äventyr på området"}</span>
        </span>
        ${starsHtml}
      </span>
    </button>`;
    })
    .join("");
}

/** Ämnesläsningens diskreta rad på kortet. Ett fel ger en tom rad, aldrig en trasig sida. */
async function amnesReadLine(areaData, areaId) {
  try {
    const [picker, sd] = await Promise.all([import("./amneslasning/picker.js"), data.getStudentData()]);
    const state = sd?.amneslasning?.areas?.[areaId] || null;
    return picker.readProgressLine(picker.readProgress(areaData.readingTexts, state));
  } catch {
    return "";
  }
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

  // "Ditt framsteg" per kategori (#447): NY fil → dynamisk import (#271),
  // parallellt med datan. Misslyckas den visas sidan som förr, utan panelen.
  const framstegMod = import("./plugga-framsteg.js").catch(() => null);

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
  // Ämnesläsning (#672): kortet visar "Du har läst X av Y texter i området" i
  // stället för stjärnor. Textvalet är en NY fil → dynamisk import (#271).
  const amnesRad = has.readingTexts ? amnesReadLine(areaData, area) : Promise.resolve("");

  // Läsförståelse-förkrav (issue #155): läraren kan kräva att eleven klarar
  // läsförståelsen (godkänt, inte bara påbörjad) innan ÖVRIGA övningar låses upp.
  // Fail-safe: bara ett förkrav när läsförståelsen faktiskt går att spela – annars
  // skulle området kunna deadlocka. Bakåtkompatibelt (inget förkrav → allt öppet).
  const prereq = readingPrereqStatus(areaData, areaProgress);
  // Läsförståelse går att spela om området har quiz-innehåll. Utan det finns
  // ingen uppgift att låsa upp med → lås inget (annars deadlock).
  const lockOthers = prereq.enabled && !prereq.met && has.quiz;

  // Läraren kan dölja lägen per område (#200), för hela klassen (#208) OCH för
  // klassen på just detta område (#298): avbockade lägen (på någon av nivåerna)
  // visas inte alls som kort. Lägen UTAN underlag renderas INTE heller i elevvyn
  // (#311): tidigare visades de som låsta "Inget innehåll än"-kort, men ett rent
  // generator-område fick då gråa quiz/läs/para/memory-kort trots att det bara
  // har räkne-innehåll. Nu visas exakt de lägen området faktiskt har underlag för
  // OCH som är synliga för elevens klass×område – samma gate som #308
  // (availableGamemodes + effektiv synlighet). Ett läge som HAR underlag men är
  // låst av läsförståelse-förkravet (#155) visas fortfarande som ett låst kort.
  const amnesText = await amnesRad;
  const visibleModes = GAMEMODES
    .filter((gm) => has[gm.needs])
    .filter((gm) => !isModeHiddenForClassArea(areaData, studentClass, gm.id));
  // Själva läsläget låses aldrig – det är ju det eleven ska göra först.
  const isLocked = (gm) => lockOthers && gm.id !== "lasforstaelse";
  const themes = visibleThemes(has, areaData, studentClass);

  // plugga-framsteg.js (dynamisk, se ovan) räknar pillret "X av Y", väljer
  // "Fortsätt här" och bygger "Ditt framsteg". Saknas den visas sidan ändå –
  // bara utan pillret, markeringen och panelen.
  const mod = await framstegMod;
  // Stjärn-lägena är EN gemensam definition (areaStarModes, #467) – samma som
  // lärarvyerna och startsidans kort (#702), så alla siffror stämmer överens.
  const starModes = areaStarModes(areaData, studentClass).map((gm) => gm.id);
  let fortsattId = null;
  let pill = "";
  let framsteg = "";
  try {
    if (mod) {
      fortsattId = mod.continueHereMode(areaProgress, [
        ...visibleModes.map((gm) => ({ id: gm.id, locked: isLocked(gm) })),
        ...themes.map((t) => ({ id: `aventyr:${t.id}` })),
      ]);
      const { stars, maxStars } = mod.areaStarCount({ areaId: area, progress, starModes });
      if (maxStars) {
        pill = `<span class="omr-pill" aria-label="${stars} av ${maxStars} stjärnor">${starIcon(22)}<span aria-hidden="true">${stars} av ${maxStars}</span></span>`;
      }
      // Framstegspanelen: stjärnor av möjliga + rätt per kategori. Inga stjärn-
      // lägen (t.ex. ett rent Ämnesläsning-område, #672) → ingen panel.
      if (starModes.length) framsteg = mod.areaProgressHtml({ areaId: area, areaData, progress, starModes });
    }
  } catch {}

  const cards = visibleModes
    .map((gm) => {
      const stars = areaProgress[gm.id]?.stars || 0;
      const locked = isLocked(gm);
      const fortsatt = gm.id === fortsattId;
      // Låset ersätter stjärnorna; Ämnesläsning har sin läst-rad och Memory
      // (noStars) ingen rad alls.
      const statusHtml = locked
        ? `<span class="card-lock">🔒 Gör läsförståelsen först</span>`
        : gm.id === "amneslasning"
          ? `<span class="card-rad" data-amnes-rad>${amnesText}</span>`
          : gm.noStars
            ? ""
            : `<span class="card-stars${stars ? " won" : ""}" aria-label="${stars} av 3 stjärnor">${starRow(stars)}</span>`;
      return `<button class="big-card ${gm.color} kompakt gm-card${locked ? " locked" : ""}${fortsatt ? " fortsatt-har" : ""}" data-mode="${gm.id}" ${locked ? "disabled" : ""}>
      ${fortsatt ? `<span class="nymarke">Fortsätt här</span>` : ""}<span class="emoji" aria-hidden="true">${gm.emoji}</span>
      <span class="txt">
        <span class="title">${gm.name}</span>
        <span class="sub">${gm.sub}</span>
        ${statusHtml}
      </span>
    </button>`;
    }).join("");

  const advCards = adventureCards(themes, areaProgress, fortsattId);

  // Tydlig hint ovanför korten när förkravet ännu inte är uppfyllt.
  const prereqBanner = lockOthers
    ? `<div class="panel prereq-note" role="status">🔒 <b>Gör läsförståelsen först.</b>
        Klara läsförståelsen med godkänt resultat${prereq.required > 1 ? ` (${prereq.passed}/${prereq.required} klara)` : ""}
        för att låsa upp de andra övningarna i området.</div>`
    : "";

  // Rubrikrad utan panel (#703): tillbaka-knapp, emoji, titel + beskrivning och
  // stjärnpillret längst till höger. På mobil bryts den (31-plugga.css).
  const view = el(`<div>
    <div class="omr-huvud">
      <button class="btn ghost liten omr-tillbaka" type="button">← Plugga</button>
      <span class="emoji" aria-hidden="true">${areaData.coverEmoji || "📖"}</span>
      <div class="txt">
        <h1>${escHtml(areaData.name)}</h1>
        <p>${escHtml(areaData.description || "Välj en övning och samla pluggcoins!")}</p>
      </div>
      ${pill}
    </div>
    ${prereqBanner}
    ${cards ? `<div class="sektion-rubrik"><h2>Öva</h2><span>Lär dig fakta och begrepp</span></div>
    <div class="kompakt-grid">${cards}</div>` : ""}
    ${advCards ? `<div class="sektion-rubrik"><h2>Äventyr</h2><span>Spela med det du har lärt dig</span></div>
    <div class="kompakt-grid aventyr-grid">${advCards}</div>` : ""}
    ${cards || advCards ? "" : `<p class="hint">Här finns inget att öva på än. Be din lärare fylla på innehåll.</p>`}
    ${framsteg}
  </div>`);

  view.querySelector(".omr-tillbaka").addEventListener("click", () => go("#/elev/plugga"));
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
    case "para": return startPara(ctx);
    case "kunskapsjakt": return startKunskapsjakt(ctx);
    case "sanningsjakt": return startSanningsjakt(ctx);
    case "memory": return startMemory(ctx);
    // Dynamisk import (se noten vid importerna): håller games-rakna.js +
    // rakna-core.js ur den statiska bootgrafen.
    case "rakna": return import("./games-rakna.js").then((m) => m.startRakna(ctx));
    // Tidsjakten (#599): samma dynamiska mönster.
    case "tidsjakt": return import("./games-tidsjakt.js").then((m) => m.startTidsjakt(ctx));
    // Ämnesläsning (#672): Läsresans läsvy på områdets texter – samma mönster.
    case "amneslasning": return import("./amneslasning/page-amneslasning.js").then((m) => m.startAmneslasning(ctx));
    default: return go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`);
  }
}
