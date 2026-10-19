// ============================================================================
// Ekvationsresan – lärarens testläge (src/ekvationsresan/larare-testlage.js) · #806
// ----------------------------------------------------------------------------
// Material → Ekvationsresan: läraren provar uppgifterna som en elev, på vald nivå.
// Samma spelvy (spelvy.js), generator och bedömning som eleven har; datalagret är
// ersatt av ett MINNESLAGER (nedan) som bygger försöket och framsteget med samma rena
// funktioner som ekv-data.js – men utan Firebase: inga anrop, inga skrivningar,
// inga mynt. Elevernas framsteg kan därför aldrig ändras härifrån.
// Ritas av Material (teacher-material.js) i sub.app och returnerar { destroy }.
// ============================================================================

import { el, esc, icon } from "../teacher-shared.js";
import { newAttemptId } from "../mult/attempt-id.js";
import { LEVELS, LEVEL_MAX } from "./config.js";
import { applyCompletion, applyExtraCompletion, buildAttempt, currentExtra, currentTask, normalizeProgress, withCurrent } from "./framsteg.js";
import { nastaUppgift } from "./nasta-uppgift.js";
import { generateExtraTask } from "./extra.js";

/**
 * Framsteg i minnet på vald nivå (maxLevel högst, så att extrautmaningarna går att prova).
 * Samma gränssnitt som spelvyn får av ekv-data.js: enter/enterExtra/save/retry.
 */
export function minneslager(level, { rng = Math.random } = {}) {
  let progress = normalizeProgress({ level, maxLevel: LEVEL_MAX });
  const pagaende = (task) => {
    const current = { id: newAttemptId(), at: Date.now(), task };
    progress = withCurrent(progress, task, current);
    return { progress, current };
  };
  const nasta = (task, p) => (task.extra ? generateExtraTask({ rng, level: p.level, previous: task }) : nastaUppgift(p, { rng, previous: task }));
  return {
    enter: () => (currentTask(progress) ? { progress, current: currentTask(progress) } : pagaende(nastaUppgift(progress, { rng }))),
    enterExtra: () => (currentExtra(progress) ? { progress, current: currentExtra(progress) } : pagaende(generateExtraTask({ rng, level: progress.level }))),
    retry: (task) => pagaende(task),
    save: async ({ current, run, help, result, blocked = 0, ownMoves = null }) => {
      const now = Date.now();
      const attempt = buildAttempt({ id: current.id, task: current.task, run, help, result, blocked, ownMoves, startedAt: current.at, completedAt: now });
      const r = current.task.extra ? applyExtraCompletion(progress, attempt, { now }) : applyCompletion(progress, attempt, { now });
      const next = { id: newAttemptId(), at: now, task: nasta(current.task, r.progress) };
      progress = withCurrent(r.progress, next.task, next);
      return { ok: true, created: true, attempt, progress, change: r.change, from: r.from, to: r.to, next, coins: 0, balance: null };
    },
  };
}

const BANNER = `<p class="mat-testbanner" role="note">${icon("eye", 16)}
  <span><b>Testläge.</b> Inget sparas: elevernas nivåer, stjärnor och mynt ändras aldrig, och du får inga mynt.</span></p>`;

export async function renderEkvationsTestlage(sub) {
  const [{ createSpelvy }, { ensureStyles }, { ensureVagCss }] = await Promise.all([
    import("./spelvy.js"), import("./page-ekvationsresan.js"), import("./vag.js"),
  ]);
  await Promise.all([ensureStyles(), ensureVagCss()]);
  const sida = el(`<div class="mat-ekv">${BANNER}
    <div class="mat-ekv-val"><label for="mat-ekv-niva">Nivå</label>
      <select id="mat-ekv-niva" class="input">${LEVELS.map((l) => `<option value="${l.level}">${l.level}. ${esc(l.name)}</option>`).join("")}</select>
      <button type="button" class="btn small ghost mat-ekv-om">Börja om</button></div>
    <div class="ekv-rot"></div></div>`);
  sub.app.replaceChildren(sida);
  const host = sida.querySelector(".ekv-rot");
  const val = sida.querySelector("#mat-ekv-niva");
  let vy = null;
  const starta = () => {
    vy?.destroy();
    const lager = minneslager(Number(val.value));
    const forsta = lager.enter();
    vy = createSpelvy(host, {
      progress: forsta.progress, current: forsta.current,
      save: lager.save, retry: async (task) => lager.retry(task),
      reenter: starta, enterExtra: async () => lager.enterExtra(), leaveExtra: async () => lager.enter(),
    });
  };
  val.addEventListener("change", starta);
  sida.querySelector(".mat-ekv-om").addEventListener("click", starta);
  starta();
  return { destroy: () => { vy?.destroy(); vy = null; } };
}
