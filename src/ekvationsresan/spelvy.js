// ============================================================================
// Ekvationsresan – spelvyn (src/ekvationsresan/spelvy.js) · #618, spec E1.2
// ----------------------------------------------------------------------------
// Vänster: nivårubrik + mätare, ekvationen + vågen (vag.js), "GÖR SAMMA SAK PÅ
// BÅDA SIDOR", + − · ÷, talfältet, GÖR, 💡 Hjälp mig och Visa lösningen.
// Höger: MIN LÖSNING (min-losning.js), elevens operationer i rött.
//
// Flödet per uppgift (kärnan #615, hjälpen #616, vågen #617):
//   ENTER → playMove → invalid/blocked: vänlig rad, inget drag
//                     → move: vågen animeras, raderna läggs i häftet
//                     → löst: taskResult → resultatet → save (ekv-data.js)
//   💡 → nextHelp (steg 1–4, steg 2 visar bilden på vågen, steg 3 förslagsraden)
//   Visa lösningen → revealSolution: vågen + häftet steg för steg, ej löst
//   Resultat → NÄSTA (ev. nivå upp-skärm) eller FÖRSÖK IGEN FÖR ⭐⭐⭐
//   Nivåer → ✨ Extrautmaningar (#627, frivilligt): samma vy med task.extra,
//   ingen mätare, ingen nivåändring, "← Tillbaka till nivå N".
//
// Datalagret injiceras (save/retry), så vyn går att köra i en preview utan
// Firebase. Talfältet har fokus hela tiden (talfalt.js).
// ============================================================================

import { fromJSON } from "./equation.js";
import { rulesForTask, HELP, UI_TEXT, EXTRA } from "./config.js";
import { startRun, playMove } from "./losning.js";
import { moveEffect } from "./solver.js";
import { startHelp, nextHelp, revealSolution, shouldOfferHelp } from "./hjalp.js";
import { taskResult, moveFeedback } from "./resultat.js";
import { progressValue } from "./anpassning.js";
import { similarTask } from "./generator.js";
import { similarExtraTask, extraTitle, extraUnlocked } from "./extra.js";
import { createVag, DURATION } from "./vag.js";
import { levelOverview } from "./framsteg.js";
import { rowsHtml, rowHtml } from "./min-losning.js";
import { mountTalfalt } from "./talfalt.js";
import { shellHtml, levelTitle, resultHtml, levelUpHtml, overviewHtml, hintHtml, esc } from "./spelvy-html.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {HTMLElement} host
 * @param {object} opts
 *   opts.progress   framsteg.normalizeProgress-form
 *   opts.current    { id, at, task } – uppgiften eleven ska lösa nu
 *   opts.save(payload) → Promise<{progress, change, to, next, coins}>  (ekv-data.completeTask)
 *   opts.retry(task)   → Promise<{progress, current}>                 (ekv-data.startTask)
 *   opts.reenter()     → efter ett sparfel: börja om från datalagret
 *   opts.enterExtra()  → Promise<{progress, current}>  extrautmaningarna (ekv-data.enterExtra)
 *   opts.leaveExtra()  → Promise<{progress, current}>  tillbaka (ekv-data.enterEkvationsresan)
 *   opts.reducedMotion, opts.rng
 */
export function createSpelvy(host, opts) {
  host.innerHTML = shellHtml();
  const $ = (s) => host.querySelector(s);
  const root = $(".ekv-sida");
  const ui = {
    niva: $(".ekv-niva"),
    matare: $(".ekv-matare"),
    fyll: $(".ekv-matare-fyll"),
    oversiktKnapp: $(".ekv-oversikt-knapp"),
    oversikt: $(".ekv-oversikt"),
    tillbaka: $(".ekv-extra-tillbaka"),
    styr: $(".ekv-styr"),
    form: $(".ekv-drag"),
    falt: $(".ekv-falt"),
    hjalp: $(".ekv-hjalp-knapp"),
    visa: $(".ekv-visa-knapp"),
    resultat: $(".ekv-resultat"),
    prat: $(".ekv-prat"),
    rader: $(".ekv-rader"),
    nivaupp: $(".ekv-nivaupp"),
  };

  let progress = opts.progress;
  let current = null;
  let task = null;
  let rules = null;
  let run = null;
  let help = startHelp();
  let blocked = 0;
  let ownMoves = null; // elevens drag före "Visa lösningen"
  let phase = "play"; // play | reveal | result | levelup
  let confirmReveal = 0;
  let vag = null;

  const falt = mountTalfalt(ui.form, ui.falt, {
    onSubmit: (text) => onMove(text),
    onChange: (op) => host.querySelectorAll(".ekv-op").forEach((b) => b.classList.toggle("is-vald", b.dataset.op === op)),
  });

  // --- rubrik, mätare, översikt ---------------------------------------------

  const isExtra = () => !!task?.extra;
  const overview = () => overviewHtml(levelOverview(progress), { extra: isExtra() ? null : { unlocked: extraUnlocked(progress) } });

  function renderHeader() {
    const extra = isExtra();
    ui.niva.textContent = extra ? extraTitle(task) : levelTitle(progress.level);
    ui.matare.hidden = extra; // extrautmaningar påverkar inte nivån – ingen mätare
    ui.oversiktKnapp.hidden = extra;
    ui.tillbaka.hidden = !extra;
    ui.tillbaka.disabled = false;
    ui.tillbaka.textContent = EXTRA.back(progress.level);
    const v = Math.round(progressValue(progress) * 100);
    ui.fyll.style.width = `${v}%`;
    ui.matare.setAttribute("aria-valuenow", String(v));
    if (!ui.oversikt.hidden) ui.oversikt.innerHTML = overview();
  }

  function toggleOverview(open = ui.oversikt.hidden) {
    ui.oversikt.hidden = !open;
    ui.oversiktKnapp.setAttribute("aria-expanded", String(open));
    if (open) ui.oversikt.innerHTML = overview();
  }

  /** Byt läge (extrautmaningar ↔ huvudprogressionen). Bara mellan uppgifter eller mitt i en – försöket sparas inte. */
  async function switchMode(enter, btn) {
    if (!enter || phase === "reveal" || phase === "levelup") return;
    if (btn) btn.disabled = true;
    try {
      const r = await enter();
      progress = r.progress;
      toggleOverview(false);
      loadTask(r.current);
    } catch (err) {
      console.warn("[Ekvationsresan] kunde inte byta läge:", err);
      if (btn) btn.disabled = false;
    }
  }

  // --- pratraden (spärrar, feedback, hjälp) ------------------------------------

  function say(html, kind = "info") {
    ui.prat.className = `ekv-prat ekv-prat--${kind}`;
    ui.prat.innerHTML = html;
  }
  const sayText = (text, kind) => say(text ? esc(text) : "", kind);

  // --- MIN LÖSNING -------------------------------------------------------------

  function renderRows(fromIndex = Infinity) {
    ui.rader.innerHTML = rowsHtml(run.rows, { fromIndex });
    const last = ui.rader.lastElementChild;
    if (last) ui.rader.parentElement.scrollTop = ui.rader.parentElement.scrollHeight;
  }

  // --- uppgiften ---------------------------------------------------------------

  function loadTask(cur, { animate = true } = {}) {
    current = cur;
    task = cur.task;
    rules = rulesForTask(task);
    run = startRun(fromJSON(task.equation), { rules });
    help = startHelp();
    blocked = 0;
    ownMoves = null;
    phase = "play";
    confirmReveal = 0;
    ui.visa.textContent = "Visa lösningen";
    if (!vag) vag = createVag($(".ekv-vag-plats"), { task, diskret: task.type === "B", reducedMotion: opts.reducedMotion });
    else {
      vag.el.classList.toggle("ekv-vag--diskret", task.type === "B");
      vag.setTask(task, { animate });
    }
    root.dataset.typ = task.type;
    root.dataset.niva = String(task.level);
    root.dataset.extra = task.extra ? "1" : "";
    renderHeader();
    renderRows();
    ui.resultat.hidden = true;
    ui.styr.hidden = false;
    sayText("");
    falt.setEnabled(true);
    falt.clear();
    falt.resumeFocus();
  }

  function onMove(text) {
    if (phase !== "play") return;
    confirmReveal = 0;
    ui.visa.textContent = "Visa lösningen";
    const before = run.current;
    const { run: next, outcome } = playMove(run, text);
    if (outcome.kind === "invalid") {
      sayText(outcome.message, "info");
      falt.select();
      return;
    }
    if (outcome.kind === "blocked") {
      blocked++;
      sayText(outcome.message, "sparr");
      falt.clear();
      return;
    }
    if (outcome.kind !== "move") return;
    const from = run.rows.length;
    run = next;
    vag.visa(run.current, { move: run.moves[run.moves.length - 1] });
    renderRows(from);
    falt.clear();
    if (run.solved) return finish();
    sayText(moveFeedback(moveEffect(before, run.current, rules)), "feedback");
    if (shouldOfferHelp(run, task.optimalMoves)) {
      say(`${esc(HELP.offerText)} <button type="button" class="ekv-lank" data-act="hjalp">💡 Hjälp mig</button>
        <button type="button" class="ekv-lank" data-act="visa">Visa lösningen</button>`, "erbjud");
    }
  }

  function onHelp() {
    if (phase !== "play") return;
    const r = nextHelp(help, run.current, rules);
    if (!r.hint) return;
    help = r.state;
    say(hintHtml(r.hint, rowHtml), "hjalp");
    if (r.hint.step === 2 && r.hint.scale) vag.visaHjalp(r.hint.scale);
    else vag.doljHjalp();
    falt.focus();
  }

  async function onReveal() {
    if (phase !== "play") return;
    if (!confirmReveal) {
      confirmReveal = 1;
      ui.visa.textContent = "Ja, visa lösningen";
      sayText(UI_TEXT.revealConfirm, "info");
      return;
    }
    phase = "reveal";
    ownMoves = run.moves.length;
    falt.setEnabled(false);
    sayText("Så här kan den lösas:", "info");
    const { run: done, steps } = revealSolution(run);
    for (const s of steps) {
      if (phase !== "reveal") return;
      const from = run.rows.length;
      run = { ...run, rows: [...run.rows, ...s.rows] };
      vag.visa(s.after, { move: s });
      renderRows(from);
      await wait((opts.reducedMotion ? 150 : DURATION) + 500);
    }
    run = done;
    renderRows(run.rows.length);
    finish();
  }

  // --- resultat, nivå upp, nästa ----------------------------------------------

  async function finish() {
    phase = "result";
    falt.setEnabled(false);
    falt.pauseFocus();
    vag.doljHjalp?.();
    const result = taskResult(task, run, help);
    sayText("");
    ui.styr.hidden = true;
    ui.resultat.hidden = false;
    ui.resultat.innerHTML = resultHtml(result, { saving: true });
    const payload = { current, run, help, result, blocked, ownMoves };
    let saved = null;
    try {
      saved = await opts.save(payload);
    } catch (err) {
      console.warn("[Ekvationsresan] kunde inte spara uppgiften:", err);
    }
    if (saved) {
      progress = saved.progress;
      renderHeader();
    }
    const levelChanged = !!saved && saved.change != null;
    ui.resultat.innerHTML = resultHtml(result, { coins: saved?.coins ?? result.coins, error: !saved, retry: !!saved && !levelChanged });
    ui.resultat.querySelector(".ekv-nasta").addEventListener("click", () => goNext(saved));
    ui.resultat.querySelector(".ekv-igen")?.addEventListener("click", (e) => onRetry(e.currentTarget));
    ui.resultat.querySelector(".ekv-nasta").focus();
  }

  function goNext(saved) {
    if (!saved) return opts.reenter?.();
    if (saved.change === "up") return showLevelUp(saved.to, () => loadTask(saved.next));
    loadTask(saved.next);
  }

  async function onRetry(btn) {
    btn.disabled = true;
    try {
      const similar = task.extra ? similarExtraTask(task, { rng: opts.rng }) : similarTask(task, { rng: opts.rng });
      const r = await opts.retry(similar);
      progress = r.progress;
      loadTask(r.current);
    } catch (err) {
      console.warn("[Ekvationsresan] kunde inte starta en ny liknande uppgift:", err);
      btn.disabled = false;
    }
  }

  function showLevelUp(level, then) {
    phase = "levelup";
    ui.nivaupp.innerHTML = levelUpHtml(level);
    ui.nivaupp.hidden = false;
    const btn = ui.nivaupp.querySelector(".ekv-fortsatt");
    btn.addEventListener("click", () => {
      ui.nivaupp.hidden = true;
      then();
    });
    btn.focus();
  }

  // --- händelser ---------------------------------------------------------------

  host.querySelectorAll(".ekv-op").forEach((b) => b.addEventListener("click", () => phase === "play" && falt.setOp(b.dataset.op)));
  ui.hjalp.addEventListener("click", onHelp);
  ui.visa.addEventListener("click", onReveal);
  ui.prat.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "hjalp") onHelp();
    if (act === "visa") onReveal();
  });
  ui.oversiktKnapp.addEventListener("click", () => toggleOverview());
  ui.oversikt.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act="extra"]');
    if (btn) switchMode(opts.enterExtra, btn);
  });
  ui.tillbaka.addEventListener("click", () => switchMode(opts.leaveExtra, ui.tillbaka));
  const onKey = (e) => {
    if (e.key === "Escape" && !ui.oversikt.hidden) toggleOverview(false);
  };
  document.addEventListener("keydown", onKey);

  loadTask(opts.current, { animate: false });

  return {
    el: root,
    get phase() {
      return phase;
    },
    get run() {
      return run;
    },
    get task() {
      return task;
    },
    destroy() {
      phase = "gone";
      falt.destroy();
      vag?.destroy();
      document.removeEventListener("keydown", onKey);
    },
  };
}
