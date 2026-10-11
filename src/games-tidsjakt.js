// ============================================================================
// Pluggporten – games-tidsjakt.js (issue #599, epic #595)
// ----------------------------------------------------------------------------
// Tidsjakten: eget träningsläge i arbetsområdet. Varje omgång = upp till 10
// händelser ur area.timeline (roterande urval, som Quiz). Per händelse: fråga +
// kort beskrivning, eleven drar på tidslinjen (#597-komponenten), låser, rätt år
// avslöjas med två markörer, avvikelsen och faktatexten – sedan nästa.
//
// FELPOÄNG: 1 per års avvikelse, lägst är bäst (tidsjakt-core.js). Resultatsidan
// visar antal händelser, felpoäng, exakt rätt och snittavvikelse + "Spela igen".
// Stjärnor/mynt/Klass-EXP går via den vanliga showResult → awardExercise
// (grind-skydd som övriga lägen); översättningen står i tidsjakt-core.js.
// Ingen topplista: Pluggportens topplistor finns bara i Live/Mattematchen, och
// rotationen gör att omgångarna inte bygger på samma händelser → vanlig träning.
//
// Laddas dynamiskt från dispatchern i gamemodes.js (#271), liksom komponenten.
// ============================================================================

import { app, el } from "./ui.js";
import * as data from "./data.js";
import { sound } from "./fx.js";
import { gameFrame, showResult, esc } from "./game-shared.js";
import { mountTimelineAnswer } from "./timeline/timeline-answer.js";
import { areaSpan } from "./timeline/timeline-logic.js";
import { arText, felpoang, myntAv, pickTidsjakt, stjarnorAv, summeraOmgang } from "./timeline/tidsjakt-core.js";

const MODE = "tidsjakt";
const CSS_HREF = new URL("./timeline/tidsjakt.css", import.meta.url).href;

function ensureCss() {
  if (document.querySelector("link[data-tidsjakt-css]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.dataset.tidsjaktCss = "";
  document.head.appendChild(link);
}

export async function startTidsjakt(ctx) {
  const { subj, area, areaData } = ctx;
  ensureCss();
  const seen = await data.getQuestionRotation(area, MODE);
  const { questions, seen: nextSeen } = pickTidsjakt(areaData, seen);
  data.saveQuestionRotation(area, MODE, nextSeen);
  // Samma spann för varje fråga i området – aldrig centrerat på ett svar.
  const span = areaSpan(areaData);

  const view = gameFrame({
    subj, area, title: "Tidsjakten", emoji: "⏳",
    right: `<span class="tj-fel-total" aria-live="polite">Felpoäng: <b>0</b></span>`,
  });
  const body = view.querySelector("#game-body");
  const totalEl = view.querySelector(".tj-fel-total b");
  app.replaceChildren(view);

  if (questions.length === 0) {
    body.replaceChildren(el(`<div class="panel"><p class="hint">Det finns inga händelser att spela än.</p></div>`));
    return;
  }

  const card = el(`<div class="quiz-wrap tj-wrap">
    <div class="quiz-progress"><div class="quiz-progress-bar"></div></div>
    <p class="quiz-count"></p>
    <div class="tj-handelse"></div>
    <div class="tj-tl"></div>
    <div class="tj-poang" aria-live="polite" hidden></div>
    <div class="quiz-next"></div>
  </div>`);
  body.replaceChildren(card);
  const bar = card.querySelector(".quiz-progress-bar");
  const count = card.querySelector(".quiz-count");
  const handelse = card.querySelector(".tj-handelse");
  const poang = card.querySelector(".tj-poang");
  const nextWrap = card.querySelector(".quiz-next");

  const svar = []; // { guess, correct } per händelse
  let pos = 0;
  let total = 0;

  const tl = mountTimelineAnswer(card.querySelector(".tj-tl"), {
    span,
    onLock(year) {
      const q = questions[pos];
      const d = felpoang(year, q.year);
      tl.reveal(q.year, { text: q.explanation });
      svar.push({ guess: year, correct: q.year });
      total += d;
      totalEl.textContent = String(total);
      poang.hidden = false;
      poang.className = `tj-poang ${d === 0 ? "tj-noll" : ""}`;
      poang.textContent = d === 0 ? "0 felpoäng – exakt rätt! 🎯" : `+${d} felpoäng`;
      if (d === 0) sound.correct();
      else sound.click();
      const last = pos >= questions.length - 1;
      const next = el(`<button class="btn gron">${last ? "Se resultat" : "Nästa händelse →"}</button>`);
      next.addEventListener("click", () => (last ? finish() : show(pos + 1)));
      nextWrap.replaceChildren(next);
      next.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      next.focus?.({ preventScroll: true });
    },
  });

  function show(i) {
    pos = i;
    const q = questions[i];
    bar.style.width = `${(i / questions.length) * 100}%`;
    count.textContent = `Händelse ${i + 1} av ${questions.length}`;
    handelse.textContent = q.event ? `📜 ${q.event}` : "";
    handelse.hidden = !q.event;
    poang.hidden = true;
    nextWrap.replaceChildren();
    tl.setQuestion({ question: q.question, context: q.description });
  }

  function finish() {
    tl.destroy();
    const sum = summeraOmgang(svar, span);
    showResult({
      container: body,
      subj, area, mode: MODE,
      stars: stjarnorAv(sum),
      scoreLine: `Du fick ${sum.felpoang} felpoäng på ${sum.antal} ${sum.antal === 1 ? "händelse" : "händelser"}.`,
      scoreHtml: resultatHtml(sum),
      baseCoins: myntAv(sum),
      // bestScore sparas som max (data-progress) → träffar, där högre är bättre.
      bestScore: sum.traffar,
      classResult: { ratt: sum.traffar, totalt: sum.antal },
      replay: () => startTidsjakt(ctx),
    });
  }

  show(0);
}

/** Resultatsidans nyckeltal (antal, felpoäng, exakt rätt, snitt). */
function resultatHtml(sum) {
  const ruta = (num, lbl) => `<div class="tj-stat"><b>${esc(num)}</b><span>${esc(lbl)}</span></div>`;
  return `<div class="tj-stats">
    ${ruta(sum.antal, sum.antal === 1 ? "händelse" : "händelser")}
    ${ruta(sum.felpoang, "felpoäng")}
    ${ruta(sum.exakt, "exakt rätt")}
    ${ruta(arText(sum.snitt), "i snitt fel")}
  </div>
  <p class="hint tj-regel">1 felpoäng per års avvikelse – ju lägre, desto bättre.
    Inom ${esc(arText(sum.tolerans))} räknas som träff (${sum.traffar} av ${sum.antal}).</p>`;
}
