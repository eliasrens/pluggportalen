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

// --- Bildstöd (issue #320) --------------------------------------------------
// Renderingsmodulen (matte-bildstod.js, #319) laddas BARA via denna DYNAMISKA
// import – aldrig statiskt – så den hålls UTANFÖR den statiska bootgrafen från
// app.js (jfr #271/#290, verifieras av test/matte-bildstod.test.js). Resultatet
// cachas: undefined = ej försökt, null = importen föll (degradera snällt och
// visa uppgiften utan bild), annars modulen. En misslyckad import stänger av
// bildstödet för resten av sessionen utan att spamma nya försök.
let bildstodMod; // undefined | null | { renderBildstod, ... }
async function loadBildstod() {
  if (bildstodMod === undefined) {
    try { bildstodMod = await import("./matte-bildstod.js"); }
    catch { bildstodMod = null; }
  }
  return bildstodMod;
}

// --- Spelet -----------------------------------------------------------------

/**
 * Starta Räkna-läget för ett generator-område.
 * @param {{subj:string, area:string, areaData:object}} ctx
 */
export function startRakna(ctx) {
  const { subj, area, areaData } = ctx;
  const generator = normalizeGenerator(areaData?.generator);

  // Lärar-inställning för bildstödet: läses från den RÅA områdes-konfigen (den
  // normaliserade generatorn bär inte fältet) och är PÅ som standard. Lärar-UI:t
  // som sätter `generator.bildstod=false` är en egen issue; tills dess visas
  // bildstödet för alla behöriga uppgifter. Bara ett uttryckligt false stänger av.
  const bildstodOn = areaData?.generator?.bildstod !== false;

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
  let keepEnlarged = false; // behåll förstora-läget mellan uppgifter (#312) – eleven slipper fälla ut varje gång
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
    // Kom ihåg om eleven valt förstorat innan vi river förra kortet, så nästa
    // uppgift startar i samma läge (#312 – slipp fälla ut ritytan varje gång).
    if (scratch) { keepEnlarged = scratch.enlarge.isFull(); scratch.destroy(); scratch = null; }
    const { problem, answer } = round[idx];
    let answered = false; // en rättning per uppgift (spärr mot dubbelsvar)

    // Svarstyp styr både hjälptexten och rättningen (rakna-core.js checkAnswer).
    // De visuella ämnena (#321) har icke-numeriskt svar OCH ett bildstöd (urtavla/
    // kulpåse/stapeldiagram/rutnät) som ritas överst i kortet i stället för "= ".
    const answerType = problem.answerType || "numeric";
    const isVisual = answerType !== "numeric";

    const hint = problem.hasRemainder
      ? `Svara med kvot och rest, t.ex. <b>3 rest 1</b>.`
      : answerType === "fraction"
        ? `Svara i bråkform, t.ex. <b>1/2</b>.`
        : answerType === "coord"
          ? `Svara med koordinater, t.ex. <b>(3, 4)</b>.`
          : answerType === "time"
            ? `Svara med klockslag, t.ex. <b>07:30</b>.`
            : answerType === "text"
              ? `Skriv ditt svar – ett ord eller en siffra.`
              : `Skriv ditt slutsvar. Använd komma för decimaler (t.ex. 3,5).`;

    // Delat kladdkort (A4 + canvas + verktyg + förstora): samma yta som äventyrens
    // generator-utmaning (#296). Kortet fälls ut till fullskärm via förstora-knappen.
    // Visuella ämnen: bildstödet ritas i en slot överst (fylls av dynamisk import
    // nedan), sedan frågetexten; numeriska ämnen behåller "a op b =".
    const taskHtml = isVisual
      ? `<div class="rakna-visual" data-visual-slot></div>` +
        `<div class="rakna-question">${esc(problemDisplay(problem))}</div>`
      : `${esc(problemDisplay(problem))} <span class="a4-eq">=</span>`;
    scratch = createScratchCard({
      taskHtml,
      onAction: () => sound.click(),
    });

    // Bildstöd (#320): array-/rutnätsstöd för behöriga numeriska uppgifter, INNE i
    // kortet (direkt under talet) så det följer med när kortet fälls ut till
    // fullskärm (#312-mönstret: allt som ska synas i fullskärm måste ligga IN i
    // kortet, inte som syskon). Värden fylls i asynkront efter dynamisk import;
    // en tom, dold platta reserveras nu så layouten inte hoppar. Behörigheten
    // avgör renderingsmodulen själv (isBildstodEligible) – vi visar bara om den
    // ger ett element tillbaka.
    if (bildstodOn) {
      const bildHost = el(`<div class="rakna-bildstod" hidden></div>`);
      scratch.card.querySelector(".a4-task").after(bildHost);
      const myCard = scratch.card;
      loadBildstod().then((mod) => {
        // Stale-skydd: eleven kan ha bytt uppgift (nytt kort) eller navigerat bort
        // medan importen laddade. Rendera bara om det här kortet fortfarande är aktivt.
        if (ended || !scratch || scratch.card !== myCard) return;
        if (!mod || typeof mod.renderBildstod !== "function") return;
        let svg = null;
        try { svg = mod.renderBildstod(problem, { document }); } catch { svg = null; }
        if (!svg) return; // inte behörig / fel → visa uppgiften utan bild
        bildHost.appendChild(svg);
        bildHost.hidden = false;
        // Kortet har nu en rad till – låt kladdytans buffert skala om efter layouten.
        if (scratch && scratch.pad && scratch.pad.resize) scratch.pad.resize();
      });
    }

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

    // Bildstöd för de visuella ämnena (#321). DYNAMISK import: matte-visuals.js
    // (och dess matte-svg.js/matte-bildstod.js) hålls UTANFÖR den statiska
    // bootgrafen (jfr #271/#290/#319). Frågan funkar även om importen fallerar –
    // då visas bara texten.
    if (isVisual) {
      import("./matte-visuals.js")
        .then((m) => {
          if (ended) return;
          const slot = wrap.querySelector("[data-visual-slot]");
          if (!slot) return;
          const svg = m.renderTopicVisual(problem);
          if (svg) slot.innerHTML = svg;
        })
        .catch(() => { /* utan bild funkar frågan ändå */ });
    }

    const form = wrap.querySelector(".rakna-answer");
    const input = wrap.querySelector(".rakna-input");
    const submitBtn = wrap.querySelector(".rakna-submit");
    const feedback = wrap.querySelector("#rakna-feedback");

    // Svarsrutan följer med in i det utfällda kortet i fullskärm (#312), så den
    // aldrig döljs. Registrera den och återställ ev. bevarat förstora-läge.
    scratch.enlarge.setAnswer(form);
    if (keepEnlarged) scratch.enlarge.setFull(true);

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
