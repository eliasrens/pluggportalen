// ============================================================================
// Pluggportalen – äventyrsmotorn: index.js  (pageElevAventyr)
// ----------------------------------------------------------------------------
// Route-ingången för äventyrsläget (#/elev/aventyr?subj=&area=&tema=). Laddar
// områdesinnehållet + elevens avatar (med köpt klädsel), bygger frågeadaptern för
// temats frågekällor och startar den tema-agnostiska motorn (engine.js). Själva
// spel-logiken finns i engine.js – den här filen är bara "sätt ihop och kör",
// i samma anda som pageElevSpela() i gamemodes.js.
// ============================================================================

import * as data from "./../data.js";
import { app, el, go, loading, renderTopbar, getParams } from "./../ui.js";
import { avatarMarkup, DEFAULT_AVATAR } from "./../avatars.js";
import { gameFrame } from "./../game-shared.js";
import { startAdventure } from "./engine.js";
import { makeQuestionAdapter } from "./question-adapter.js";
import { THEMES } from "./themes/index.js";
import { testTheme } from "./themes/test-tema.js";

/**
 * Elevens äventyrssida. Kräver ?subj=&area=; ?tema= väljer tema (default testbanan).
 */
export async function pageElevAventyr() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();

  const { subj, area, tema } = getParams();
  if (!subj || !area) return go("#/elev/plugga");

  const theme = THEMES[tema] || testTheme;

  let areaData, sd;
  try {
    [areaData, sd] = await Promise.all([data.getArea(subj, area), safeStudentData()]);
  } catch (err) {
    app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda äventyret: ${err.message}</div></div>`)
    );
    return;
  }
  if (!areaData) return go("#/elev/plugga");

  const view = gameFrame({ subj, area, title: theme.namn || "Äventyr", emoji: theme.progressIcon || "🗺️" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  const questions = makeQuestionAdapter({
    areaData,
    kinds: theme.questionKinds,
    host: document.body,
  });
  if (!questions.hasQuestions()) {
    body.replaceChildren(
      el(`<div class="panel center"><div class="big-emoji">🗺️</div>
        <h2>Äventyret är inte redo än</h2>
        <p class="hint">Det här området saknar frågor/par som äventyret kan använda. Be din lärare lägga till innehåll så öppnas banan!</p></div>`)
    );
    return;
  }

  const avatarHtml = avatarMarkup(sd.avatarId || DEFAULT_AVATAR, sd.avatarItems || []);

  startAdventure({
    mount: body,
    theme,
    questions,
    player: { avatarHtml },
    subj,
    area,
    onReplay: () => pageElevAventyr(),
  });
}

/** Läs elevens avatar-data men fall aldrig på det (preview/mock kan sakna det). */
async function safeStudentData() {
  try {
    return await data.getStudentData();
  } catch {
    return {};
  }
}
