// ============================================================================
// Pluggportalen – games-rakna.js (issue #280)
// ----------------------------------------------------------------------------
// Räkna-läget: generatorns naturliga hem. Uppgiften visas som ett A4-KORT –
// talet stort överst – med en STOR KLADDYTA (<canvas>) där eleven ritar sin
// uträkning för hand (penna/sudd/rensa, mus OCH touch via pointer-events, samma
// stöd som äventyrsmotorns touch-styrning, #248/#250). Kladdytan är HELT
// FLYKTIG: bara i klientens minne, nollställs mellan uppgifter, sparas ALDRIG
// (noll DB-kostnad – lärar-granskning av handritat är uttrycklig fas 2).
//
// Slutsvaret skrivs i ett fält och rättas mot generatorns facit. Uppgifterna
// byggs via matte-generator-adaptern (#278) för områdets generator-konfig (#279):
// area.generator = { topic, variants, grade? }. En hel runda dras DETERMINISTISKT
// ur ett per-session-frö (adapterns kontrakt), med upprepningsskydd.
//
// BELÖNING: rätt slutsvar ger coins/XP via den BEFINTLIGA game-shared-loopen
// (showResult → awardExercise), exakt som övriga grind-lägen. Ingen egen
// ekonomi, och grind-multiplikatorn rörs INTE (räkna ingår inte i
// FULL_REWARD_MODES → normalt grind-skydd vid omspel).
//
// All icke-DOM-logik (runda-bygge, seed, rättning, svensk taldisplay) bor i den
// rena, enhetstestade rakna-core.js. Själva kladd-KORTET (A4 + canvas + verktyg +
// FÖRSTORA-knapp, #296) bor i den delade scratchpad.js så det ser och beter sig
// likadant här som i äventyrens generator-utmaning. Här är bara render + svarsloop.
// ============================================================================

import { app, el } from "./ui.js";
import * as data from "./data.js";
import { sound } from "./fx.js";
import { gameFrame, showResult, starsFromRatio, esc } from "./game-shared.js";
import { normalizeGenerator } from "./exercise-types.js";
import { createScratchCard } from "./scratchpad.js";
import {
  ROUND_SIZE,
  sessionSeed,
  buildRound,
  problemDisplay,
  expectedAnswerText,
  checkAnswer,
} from "./rakna-core.js";

// --- Spelet -----------------------------------------------------------------

/**
 * Starta Räkna-läget för ett generator-område.
 * @param {{subj:string, area:string, areaData:object}} ctx
 */
export function startRakna(ctx) {
  const { subj, area, areaData } = ctx;
  const generator = normalizeGenerator(areaData?.generator);

  const view = gameFrame({ subj, area, title: "Räkna", emoji: "🔢" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // Skyddsnät: ett giltigt räkna-område har alltid en generator (#279 gate:ar
  // läget), men om något gått snett – visa en snäll rad i stället för krasch.
  if (!generator) {
    body.replaceChildren(
      el(`<div class="panel"><div class="msg error">Det här området har ingen räkne-generator ännu.</div></div>`)
    );
    return;
  }

  // Per-session-frö: elev-id (adapterns kontrakt om deterministisk seed per
  // elev/session) + en session-nonce (Date.now()) → nya tal varje ny runda men
  // reproducerbart inom sessionen. I preview utan inloggning faller vi till "anon".
  let uid = "anon";
  try { uid = data.currentStudentId() || "anon"; } catch {}
  const round = buildRound(generator, sessionSeed(uid, Date.now()), ROUND_SIZE);
  const total = round.length;

  let idx = 0;
  let correct = 0; // antal rätt (styr stjärnor)
  let scratch = null; // aktivt kladdkort (canvas + verktyg + förstora), destroyas mellan uppgifter
  let ended = false;

  // Städa upp aktiv rityta om eleven navigerar bort mitt i (annars ligger
  // resize-/pointer-lyssnare kvar). En gång räcker – renderProblem destroyar
  // sin egen pad innan nästa ritas.
  function teardown() {
    ended = true;
    if (scratch) { scratch.destroy(); scratch = null; }
    window.removeEventListener("hashchange", teardown);
  }
  window.addEventListener("hashchange", teardown, { once: true });

  function renderProblem() {
    if (ended) return;
    if (scratch) { scratch.destroy(); scratch = null; }
    const { problem, answer } = round[idx];
    let answered = false; // en rättning per uppgift (spärr mot dubbelsvar)

    const hint = problem.hasRemainder
      ? `Svara med kvot och rest, t.ex. <b>3 rest 1</b>.`
      : `Skriv ditt slutsvar. Använd komma för decimaler (t.ex. 3,5).`;

    // Delat kladdkort (A4 + canvas + verktyg + förstora): samma yta som äventyrens
    // generator-utmaning (#296). Kortet fälls ut till fullskärm via förstora-knappen.
    scratch = createScratchCard({
      taskHtml: `${esc(problemDisplay(problem))} <span class="a4-eq">=</span>`,
      onAction: () => sound.click(),
    });

    const wrap = el(`<div class="rakna">
      <div class="rakna-progress">Uppgift <b>${idx + 1}</b> av ${total}</div>
      <div class="rakna-stage"></div>
      <form class="rakna-answer" autocomplete="off">
        <label class="rakna-answer-label" for="rakna-svar">Ditt svar</label>
        <div class="rakna-answer-row">
          <input id="rakna-svar" class="rakna-input" type="text" inputmode="text"
                 autocomplete="off" autocorrect="off" spellcheck="false"
                 enterkeyhint="done" placeholder="Skriv slutsvaret" />
          <button type="submit" class="btn gron rakna-submit">Svara</button>
        </div>
        <p class="hint rakna-hint">${hint}</p>
        <div class="rakna-feedback" id="rakna-feedback" role="status" aria-live="polite"></div>
      </form>
    </div>`);
    wrap.querySelector(".rakna-stage").appendChild(scratch.card);
    body.replaceChildren(wrap);

    const form = wrap.querySelector(".rakna-answer");
    const input = wrap.querySelector(".rakna-input");
    const submitBtn = wrap.querySelector(".rakna-submit");
    const feedback = wrap.querySelector("#rakna-feedback");
    input.focus();

    function advance() {
      idx++;
      if (idx >= total) finish();
      else renderProblem();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (answered) return; // "Nästa"-knappen sköter framflyttet
      const ok = checkAnswer(problem, answer, input.value);
      answered = true;
      input.readOnly = true;
      submitBtn.hidden = true;
      const isLast = idx + 1 >= total;
      if (ok) {
        correct++;
        sound.correct();
        feedback.className = "rakna-feedback ratt";
        feedback.innerHTML = `✅ Rätt! Bra jobbat.`;
      } else {
        sound.wrong();
        feedback.className = "rakna-feedback fel";
        feedback.innerHTML = `❌ Inte riktigt. Rätt svar: <b>${esc(expectedAnswerText(problem, answer))}</b>`;
      }
      const nextBtn = el(
        `<button type="button" class="btn ${isLast ? "orange" : "gron"} rakna-next">${isLast ? "Se resultat 🎉" : "Nästa uppgift →"}</button>`
      );
      nextBtn.addEventListener("click", advance);
      feedback.appendChild(nextBtn);
      nextBtn.focus();
    });
  }

  function finish() {
    if (scratch) { scratch.destroy(); scratch = null; }
    ended = true;
    window.removeEventListener("hashchange", teardown);
    const stars = starsFromRatio(correct / total);
    // Coins i linje med quiz/läsförståelse (jämförbar runda): fast liten del + 2
    // per rätt + liten allt-rätt-bonus. Räkna är INTE ett full-reward-läge, så
    // omspel grind-skalas av awardExercise (samma trappa som para/memory) –
    // grind-multiplikatorn rörs inte här.
    const baseCoins = 2 * (3 + correct * 2 + (correct === total ? 2 : 0));
    showResult({
      container: body,
      subj, area, mode: "rakna",
      stars,
      scoreLine: `Du räknade rätt på ${correct} av ${total}.`,
      baseCoins,
      bestScore: correct,
      replay: () => startRakna(ctx),
    });
  }

  renderProblem();
}
