// ============================================================================
// Pluggportalen – game-shared.js
// Gemensamt verktyg för alla gamemodes: metadata, små hjälpare, belöning
// (grind-skydd), övningsram, resultat-/firande-skärm och frågemotorn som
// Quiz och Läsförståelse delar. Själva spelen ligger i games-*.js.
// ============================================================================

import * as data from "./data.js";
import { app, el, go, renderTopbar } from "./ui.js";
import { confetti, sound, isMuted, toggleMuted } from "./fx.js";
import { addXp } from "./data-xp.js";
import { xpForExercise, xpIntoLevel } from "./leveling.js";
import { awardProjectionPatch, mirrorStudentProjection } from "./projection-sync.js";
import { coinIcon } from "./icons.js";
import {
  MAX_QUESTIONS_PER_SESSION,
  MAX_TEXTS_PER_SESSION,
  pickRotatingQuestions,
  textKey,
} from "./question-rotation.js";

export const enc = encodeURIComponent;

// Gamemode-katalogen och synlighets-hjälparna bor i gamemode-visibility.js
// (browser-fritt → enhetstestbart). Re-exporteras här för de många moduler som
// redan importerar { GAMEMODES } från game-shared.js.
export {
  GAMEMODES,
  ALL_MODES,
  areaContentFlags,
  availableGamemodes,
  visibleGamemodes,
  visibleGamemodesForStudent,
  visibleGamemodesForClassArea,
  normalizeHiddenModes,
  normalizeAreaModes,
  isModeHidden,
  isModeHiddenForClass,
  isModeHiddenForStudent,
  classAreaHiddenModes,
  effectiveHiddenModes,
  isModeHiddenForClassArea,
} from "./gamemode-visibility.js";

// ---------------------------------------------------------------------------
// Små hjälpare
// ---------------------------------------------------------------------------

/** Enkel HTML-escape för att lägga in text säkert i markup. */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Blanda en array (kopia, Fisher–Yates). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Max antal frågor per NY quiz-/läsförståelse-session (10). Själva taket + den
// roterande urvalslogiken bor i question-rotation.js (browser-fri → enhetstestbar).
export { MAX_QUESTIONS_PER_SESSION };

/**
 * Välj vilka frågor en NY session ska köra ur områdets pool, MED rotation:
 * varje session serverar osedda frågor tills poolen körts igenom (ett varv),
 * sedan nollställs spårningen och nästa varv slumpas om.
 *
 * @param {Array} pool  hela områdets fråge-pool (för läget)
 * @param {string[]} seen  nycklar som redan serverats i pågående varv (från
 *                          data.getQuestionRotation; saknas → slumpad start)
 * @returns {{questions: Array, seen: string[]}}  frågorna att köra + den
 *          uppdaterade listan sedda nycklar att spara (data.saveQuestionRotation).
 *
 * OBS: Detta gäller BARA när en ny session byggs. Omspel/retry av fel-svarade
 * frågor går inte via den här – de kör exakt sina specifika frågor (repetition
 * inom rundan sköts av runQuestions och rör inte det här urvalet).
 */
export function pickSessionQuestions(pool, seen) {
  return pickRotatingQuestions(pool, seen);
}

/**
 * Som pickSessionQuestions men för LÄS-TEXTER (issue #153): samma roterande motor
 * serverar max MAX_TEXTS_PER_SESSION osedda texter per session (nyckel = textKey),
 * så eleven får nya texter tills områdets alla körts igenom, inte samma om igen.
 * @param {Array} pool  områdets readingTexts
 * @param {string[]} seen  sedda text-nycklar i pågående varv
 * @returns {{questions: Array, seen: string[]}}  texterna att köra + sedda att spara.
 */
export function pickSessionTexts(pool, seen) {
  return pickRotatingQuestions(pool, seen, MAX_TEXTS_PER_SESSION, textKey);
}

/** Har frågan en icke-tom källtext ("passage")? En sådan fråga är en
 *  läsförståelse-fråga (visas med sin text ovanför i Läsförståelse-läget). */
export function hasPassage(q) {
  return !!(q && typeof q.passage === "string" && q.passage.trim());
}

/**
 * Pool för de frågelägen som INTE visar någon källtext (Quiz, Kunskapsjakt):
 * bara frågor UTAN passage. Läsförståelse-frågor (med passage) skulle annars
 * läcka in oläsbara ("enligt texten ..." utan synlig text). Läsförståelse gör
 * tvärtom och kör bara frågor MED passage (se startLasforstaelse).
 *
 * Faller tillbaka till hela poolen om ALLA frågor har passage (ett rent
 * läsförståelse-område), så Quiz/Kunskapsjakt aldrig blir tomma.
 * @param {Array} quiz  områdets quiz-lista
 * @returns {Array}
 */
export function plainQuizPool(quiz) {
  const arr = Array.isArray(quiz) ? quiz : [];
  const plain = arr.filter((q) => !hasPassage(q));
  return plain.length > 0 ? plain : arr;
}

/** Stjärnor (1–3) ur en andel rätt (0–1). Den som klarar övningen får minst 1. */
export function starsFromRatio(ratio) {
  if (ratio >= 0.99) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}

/** Rita stjärnrad, t.ex. ★★☆. */
export function starRow(stars, max = 3) {
  let s = "";
  for (let i = 0; i < max; i++) s += i < stars ? "★" : "☆";
  return s;
}

/** Uppmuntrande slutmening – aldrig skamsen, även vid få rätt. */
export function cheer(stars) {
  if (stars >= 3) return "Fantastiskt jobbat! Du är en stjärna! 🌟";
  if (stars >= 2) return "Bra kämpat! Du kan det här! 💪";
  return "Bra att du övar – du blir bättre för varje gång! 🚀";
}

/** Yttre ram för en pågående övning: tillbaka-länk + titel + kropp (#game-body). */
export function gameFrame({ subj, area, title, emoji, right = "" }) {
  const view = el(`<div>
    <a class="back-link" id="back">← Till området</a>
    <div class="game-head">
      <div class="game-title"><span class="game-emoji">${emoji}</span> ${title}</div>
      <div class="game-head-right">${right}</div>
    </div>
    <div id="game-body"></div>
  </div>`);
  view.querySelector("#back").addEventListener("click", () =>
    go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`)
  );
  return view;
}

/** Liten mute-knapp (delas av Kunskapsjakt m.fl.). */
export function muteButton() {
  const b = el(
    `<button class="mute-btn" title="Ljud på/av">${isMuted() ? "🔇" : "🔊"}</button>`
  );
  b.addEventListener("click", () => {
    const muted = toggleMuted();
    b.textContent = muted ? "🔇" : "🔊";
    if (!muted) sound.click();
  });
  return b;
}

// ---------------------------------------------------------------------------
// Belöning + framsteg
// ---------------------------------------------------------------------------

// Lägen som bygger en HELT NY session vid varje omspel: de serverar ett nytt,
// roterande urval på max 10 osedda frågor (se pickSessionQuestions), så ett omspel
// är i praktiken en ny övning – inte samma runda igen. Därför räknas de som full
// övning varje gång och slipper grind-reduktionen (full pott coins + XP alltid).
// Övriga lägen (kunskapsjakt = tidsloop på hela poolen, para/memory = par) kör
// oförändrat grind-skydd. Rör inte de par-baserade lägena.
const FULL_REWARD_MODES = new Set(["quiz", "lasforstaelse", "lastext"]);

// Grind-trappa för omspel i icke-quiz/läsförståelse-lägen: belöningen skalas ned
// steg för steg ju fler gånger samma övning körts i samma läge, med ett golv på
// 20 %. n = antal TIDIGARE avklarade körningar (0 = första gången).
//   n=0 → 100 %, 1 → 80 %, 2 → 60 %, 3 → 40 %, 4 → 20 %, 5+ → 20 % (golv).
const GRIND_STEP = 0.2; // hur mycket varje omspel drar av
const GRIND_FLOOR = 0.2; // lägsta andel man kan sjunka till
/** max(0.2, 1 − 0.2·n) – andelen av full pott vid n tidigare körningar. */
function grindMultiplier(prevPlays) {
  return Math.max(GRIND_FLOOR, 1 - GRIND_STEP * prevPlays);
}

/**
 * Dela ut belöning (coins + XP) + spara framsteg för en avklarad övning.
 * Grind-skydd (trappa): första gången ger full pott, därefter skalas coins och
 * XP ned med grindMultiplier() baserat på antalet TIDIGARE körningar av samma
 * övning i samma läge (100 → 80 → 60 → 40 → 20 % golv). Räknaren lagras per
 * (elev, område, läge) i studentData.progress[area][mode].plays (se data.js) och
 * höjs varje gång en övning slutförs. UNDANTAG: FULL_REWARD_MODES (quiz +
 * läsförståelse) ger full pott varje gång eftersom varje omspel är en ny slumpad
 * session. XP-potten (basXP + stjärnor × perStar) definieras i leveling.js.
 * @returns {Promise<{coins:number, xp:number, totalXp:number, firstTime:boolean, reduced:boolean, pct:number}>}
 */
export async function awardExercise(area, mode, { stars, bestScore, baseCoins }) {
  let firstTime = true;
  let prevPlays = 0; // antal tidigare avklarade körningar (n i trappan)
  try {
    const progress = await data.getProgress();
    const node = progress?.[area]?.[mode];
    firstTime = !node?.completed;
    // Bakåtkompatibel räknare: saknas plays → 0. Har en äldre elev redan klarat
    // övningen (completed) men inget plays-fält, räkna det som (minst) en tidigare
    // körning så omspel skalas som förr i stället för att nollställas till full pott.
    prevPlays =
      typeof node?.plays === "number" ? node.plays : node?.completed ? 1 : 0;
  } catch {}
  let coins = Math.max(1, Math.round(baseCoins));
  let xp = xpForExercise(stars);
  const reduced = !firstTime && !FULL_REWARD_MODES.has(mode);
  let mult = 1;
  if (reduced) {
    mult = grindMultiplier(prevPlays);
    // Coins avrundas ALLTID uppåt (Math.ceil) – hellre ett mynt för mycket än
    // för lite, så en udda baspott inte blir orättvist nedåt-avrundad vid
    // grind-nedskalning. Gäller alla grind-lägen. XP avrundas som förr.
    coins = Math.max(1, Math.ceil(baseCoins * mult));
    xp = Math.max(1, Math.round(xp * mult));
  }
  const pct = Math.round(mult * 100); // andel av full pott den här körningen, för hinten
  let totalXp = 0;
  try {
    await data.addCoins(coins);
  } catch {}
  try {
    totalXp = await addXp(xp);
  } catch {}
  try {
    // Höj räknaren för nästa gång (prevPlays var värdet FÖRE denna körning).
    await data.saveProgress(area, mode, {
      completed: true,
      stars,
      bestScore,
      plays: prevPlays + 1,
    });
  } catch {}
  // Håll klass-projektionen färsk (#233): spegla elevens nya totaler in i alla
  // dess klassers projektioner. Läs elevens FÄRSKA studentData EN gång (efter
  // att coins/xp/progress sparats) och härled stars/xp/completed EXAKT som
  // by-översikten (awardProjectionPatch → progressTotals/xpFromStudentData).
  // Aldrig kastande: en misslyckad projektions-skrivning – eller läsning – får
  // inte fälla själva belöningen (self-heal täcker upp).
  try {
    const uid = data.currentStudentId();
    if (uid) {
      const sd = await data.getStudentData(uid);
      await mirrorStudentProjection(
        data.updateStudentProjectionAllClasses,
        uid,
        awardProjectionPatch(sd)
      );
    }
  } catch {}
  return { coins, xp, totalXp, firstTime, reduced, pct };
}

/**
 * Gemensam resultat-/firande-skärm. Delar ut belöning och visar konfetti.
 * @param {object} opts
 * @param {function} opts.replay  startar om samma övning
 * @param {boolean} [opts.noStars]  turbaserade lägen (t.ex. Memory) har inga
 *   stjärnor: dölj stjärnraden och ersätt med neutral uppmuntran. Övriga lägen
 *   (para-ihop/quiz m.fl.) skickar inte flaggan och är helt oförändrade.
 */
export async function showResult({ container, subj, area, mode, stars, scoreLine, baseCoins, bestScore, replay, noStars = false }) {
  container.innerHTML = `<div class="spinner">Sparar…</div>`;
  const { coins, xp, totalXp, reduced, pct } = await awardExercise(area, mode, { stars, bestScore, baseCoins });
  await renderTopbar(); // uppdatera coins-saldo + nivå i sidhuvudet

  // Levlade eleven upp av den här övningen? (jämför nivå före/efter XP-potten)
  const after = xpIntoLevel(totalXp);
  const before = xpIntoLevel(Math.max(0, totalXp - xp));
  const leveledUp = after.level > before.level;

  const view = el(`<div class="result-card panel center">
    <div class="result-emoji">${noStars || stars >= 2 ? "🎉" : "😀"}</div>
    <h1>Bra jobbat!</h1>
    ${noStars ? "" : `<div class="result-stars">${starRow(stars)}</div>`}
    ${scoreLine ? `<p class="result-score">${scoreLine}</p>` : ""}
    <div class="coin-pop">${coinIcon(22)} +${coins} pluggcoins</div>
    <div class="xp-pop">⭐ +${xp} XP</div>
    ${leveledUp ? `<div class="levelup-pop">🎉 Ny nivå – du är nu <b>nivå ${after.level}</b>!</div>` : ""}
    ${reduced ? `<p class="hint">Du har spelat den här övningen förut, så du får färre coins och XP den här gången (${pct} % av full pott).</p>` : ""}
    <p class="cheer">${noStars ? "Alla par hittade – vilket minne du har! 🧠" : cheer(stars)}</p>
    <div class="result-actions">
      <button class="btn gron" id="again">Spela igen</button>
      <button class="btn ghost" id="more">Till området</button>
    </div>
  </div>`);
  container.replaceChildren(view);
  if (noStars || stars >= 2) confetti();
  sound.finish();

  view.querySelector("#again").addEventListener("click", () => replay());
  view.querySelector("#more").addEventListener("click", () =>
    go(`#/elev/omrade?subj=${enc(subj)}&area=${enc(area)}`)
  );
}

// ---------------------------------------------------------------------------
// Frågemotor (delas av Quiz och Läsförståelse)
// ---------------------------------------------------------------------------
// Själva frågemotorn bor numera i game-questions.js (utbruten för radgränsen +
// för att äventyrsmotorns frågeadapter ska kunna dela den enskilda fråge-
// renderingen). Re-exporteras här så befintliga importvägar är oförändrade.
export { renderQuestionCard, runQuestions } from "./game-questions.js";
