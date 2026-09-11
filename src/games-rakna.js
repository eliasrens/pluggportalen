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
// rena, enhetstestade rakna-core.js. Här är bara render + rit-interaktion.
// ============================================================================

import { app, el } from "./ui.js";
import * as data from "./data.js";
import { sound } from "./fx.js";
import { gameFrame, showResult, starsFromRatio, esc } from "./game-shared.js";
import { normalizeGenerator } from "./exercise-types.js";
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
  let pad = null; // aktiv kladdyta-styrenhet (destroyas mellan uppgifter)
  let ended = false;

  // Städa upp aktiv rityta om eleven navigerar bort mitt i (annars ligger
  // resize-/pointer-lyssnare kvar). En gång räcker – renderProblem destroyar
  // sin egen pad innan nästa ritas.
  function teardown() {
    ended = true;
    if (pad) { pad.destroy(); pad = null; }
    window.removeEventListener("hashchange", teardown);
  }
  window.addEventListener("hashchange", teardown, { once: true });

  function renderProblem() {
    if (ended) return;
    if (pad) { pad.destroy(); pad = null; }
    const { problem, answer } = round[idx];
    let answered = false; // en rättning per uppgift (spärr mot dubbelsvar)

    const hint = problem.hasRemainder
      ? `Svara med kvot och rest, t.ex. <b>3 rest 1</b>.`
      : `Skriv ditt slutsvar. Använd komma för decimaler (t.ex. 3,5).`;

    const wrap = el(`<div class="rakna">
      <div class="rakna-progress">Uppgift <b>${idx + 1}</b> av ${total}</div>
      <div class="rakna-stage">
        <div class="a4-card">
          <div class="a4-task">${esc(problemDisplay(problem))} <span class="a4-eq">=</span></div>
          <canvas class="a4-scratch" aria-label="Kladdyta – rita din uträkning för hand"></canvas>
          <div class="a4-scratch-hint">✏️ Kladda din uträkning här – den sparas inte</div>
        </div>
        <div class="scratch-tools" role="toolbar" aria-label="Ritverktyg">
          <button type="button" class="tool-btn is-active" data-tool="pen" title="Penna">✏️ Penna</button>
          <button type="button" class="tool-btn" data-tool="eraser" title="Sudd">🧽 Sudd</button>
          <button type="button" class="tool-btn" data-clear title="Rensa kladdytan">🗑️ Rensa</button>
        </div>
      </div>
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
    body.replaceChildren(wrap);

    // Kladdyta
    pad = attachScratchpad(wrap.querySelector(".a4-scratch"));
    const toolBtns = wrap.querySelectorAll(".tool-btn[data-tool]");
    toolBtns.forEach((b) => {
      b.addEventListener("click", () => {
        pad.setTool(b.dataset.tool);
        toolBtns.forEach((x) => x.classList.toggle("is-active", x === b));
        sound.click();
      });
    });
    wrap.querySelector("[data-clear]").addEventListener("click", () => {
      pad.clear();
      sound.click();
    });

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
    if (pad) { pad.destroy(); pad = null; }
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

// --- Kladdyta (canvas) ------------------------------------------------------
// Flyktig rityta med penna/sudd/rensa. Pointer Events → funkar med BÅDE mus och
// touch/telefon (touch-action: none i CSS så sidan inte skrollar under ritandet,
// samma princip som touch-styrningen i äventyrsmotorn, #248/#250). Innehållet
// lever bara i canvasens pixelbuffert och slängs när uppgiften byts – aldrig sparat.

const PEN_COLOR = "#2a2a35";
const PEN_WIDTH = 3.2;
const ERASER_WIDTH = 26;

/**
 * Koppla rit-interaktion på ett <canvas>. Returnerar { setTool, clear, destroy }.
 * Skalar ritbufferten efter elementets faktiska storlek × devicePixelRatio så
 * strecket blir skarpt på mobil/retina.
 */
function attachScratchpad(canvas) {
  const ctx = canvas.getContext("2d");
  let tool = "pen"; // "pen" | "eraser"
  let drawing = false;
  let last = null;
  let activePointer = null;

  // Sätt canvasens pixelupplösning efter dess CSS-box (× dpr) så linjerna blir
  // skarpa och koordinaterna stämmer. Görs efter layout (rAF) + vid resize.
  function fit() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; // nollställer även bufferten – kladden är ändå flyktig
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  requestAnimationFrame(fit);

  function pointOf(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function stroke(a, b) {
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = tool === "eraser" ? ERASER_WIDTH : PEN_WIDTH;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function onDown(e) {
    if (activePointer !== null) return;
    activePointer = e.pointerId;
    drawing = true;
    last = pointOf(e);
    stroke(last, { x: last.x + 0.01, y: last.y + 0.01 }); // en tap ger en prick
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }
  function onMove(e) {
    if (!drawing || e.pointerId !== activePointer) return;
    const p = pointOf(e);
    stroke(last, p);
    last = p;
    e.preventDefault();
  }
  function onUp(e) {
    if (e.pointerId !== activePointer) return;
    drawing = false;
    last = null;
    activePointer = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", fit);

  return {
    setTool(t) { tool = t; },
    clear() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
    destroy() {
      window.removeEventListener("resize", fit);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    },
  };
}
