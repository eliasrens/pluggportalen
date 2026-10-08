// ============================================================================
// Trollkarlsduellen (#536, epic #535) – Live-projektorvyn. Laddas BARA via
// import() från projector.js (VIEWS-posten "trollkarl", only2, finale).
// Sätter ihop: arena (trollkarl-arena) · HUD + magimätare (trollkarl-hud) ·
// två figurer (trollkarl-figurval) · MagicSystem (trollkarl-magi) · regin/kön
// (trollkarl-regi) · scenen attacker/finaler ritar i (trollkarl-scen).
//
// Flöde: update(st) → duelData (matchdata, ingen egen poänglogik) → HUD →
//   MagicSystem.sync (absoluta rätt) → ny attack? → regin köar → uppladdning
//   (charge) → attacken ur registret → återställning.
//   00:00 (ended) → stopp, inga nya attacker. finished + officiellt utfall →
//   finalen EN gång → resultatskärmen. Omladdning efter slutet (eller > 3 min
//   efter) → resultatskärmen direkt.
//
// API: createTrollkarlView(host, { st, colors, sound }) → { update(st), destroy() }
//   preload() – förladdar figurernas ansiktsbilder (lobbyn, §17)
//   trollkarlDemo.view – demolägets krokar (preview-trollkarlsduellen.html):
//     { attack(side, attackId?), director, tracker } – påverkar bara bilden.
// ============================================================================

import { ensureLiveCss } from "../live-css.js";
import { prizeText, toMs } from "../live-core.js";
import { esc } from "../../teacher-shared.js";
import { createWizard, preloadWizardFaces } from "./trollkarl-figurval.js";
import { createArena } from "./trollkarl-arena.js";
import { createHud } from "./trollkarl-hud.js";
import { createScene, W, H } from "./trollkarl-scen.js";
import { createDirector, rushFor } from "./trollkarl-regi.js";
import { createMagicTracker, attackSeed, seededRandom, ATTACK_THRESHOLD } from "./trollkarl-magi.js";
import { duelData } from "./trollkarl-data.js";
import { pickAttack, getAttack, pickFinale } from "./trollkarl-register.js";
import "./trollkarl-innehall.js";

const CSS = "src/live/trollkarl/trollkarl.css";
const ATTACK_CSS = "src/live/trollkarl/attacker/attacker.css";
// En final som skulle börja så här långt efter matchslut spelas inte (gammal match).
const STALE_FINALE_MS = 3 * 60_000;
const CHARGE_MAX_MS = 1300;
const RUN_PAD_MS = 4000;
const FINALE_MAX_MS = 25_000;

export const trollkarlDemo = { view: null };

/** Förladda figurernas ansiktslager (§17) – projektorn anropar i lobbyn. */
let preloaded = null;
export function preload() {
  if (!preloaded) preloaded = Promise.resolve(preloadWizardFaces?.()).catch(() => {});
  return preloaded;
}

const race = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

export function createTrollkarlView(host, { st, sound }) {
  ensureLiveCss([CSS, ATTACK_CSS]);
  preload();
  const reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const root = document.createElement("div");
  root.className = "tk";
  root.style.opacity = "0"; // trollkarl.css visar vyn först när arket laddats
  root.innerHTML = `
    <div class="tk-stage">
      <div class="tk-fxback"></div>
      <div class="tk-slot" data-side="left" data-state="IDLE"></div>
      <div class="tk-slot" data-side="right" data-state="IDLE"></div>
      <div class="tk-fx"></div>
      <div class="tk-banner" aria-live="polite"></div>
      <div class="tk-result" hidden></div>
    </div>`;
  host.replaceChildren(root);
  const stage = root.querySelector(".tk-stage");
  const arena = createArena();
  stage.prepend(arena.el);
  const hud = createHud(stage);
  stage.appendChild(root.querySelector(".tk-banner"));
  stage.appendChild(root.querySelector(".tk-result"));
  const resultEl = root.querySelector(".tk-result");

  // Designrummet 1600 × 900 skalas in (letterbox) – inget klipps i andra format.
  function fit() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    const k = Math.min(w / W, h / H);
    stage.style.transform = `translate(${(w - W * k) / 2}px, ${(h - H * k) / 2}px) scale(${k})`;
  }
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  ro?.observe(root);
  fit();

  const sid = st.sessionId || st.session?.id || "lokal";
  const slots = Object.fromEntries([...root.querySelectorAll(".tk-slot")].map((s) => [s.dataset.side, s]));
  const sides = { left: { side: "left", slot: slots.left }, right: { side: "right", slot: slots.right } };
  const classIds = (st.classes || []).slice(0, 2).map((c) => c.classId);
  const tracker = createMagicTracker({ sessionId: sid, classIds });
  const lastAttack = {};
  let lastD = null;
  let lastSt = st;
  let finishedSeen = null;
  let finaleBegun = false;
  let resultShown = false;
  let pendingRemount = false;
  let pollT = 0;
  let dead = false;

  const bySide = (cid) => (sides.left.classId === cid ? sides.left : sides.right);
  const other = (s) => (s === sides.left ? sides.right : sides.left);
  const pub = (s) => (s ? { classId: s.classId, who: s.who, side: s.side, name: s.name, wizard: s.wizard } : null);
  const ended = () => !!lastD?.ended;

  function idleAll(on) {
    for (const s of Object.values(sides)) {
      s.wizard?.setIdle(on);
      s.wizard?.idleEvents(on);
    }
  }

  const director = createDirector({
    async runAttack(evt, signal) {
      const from = bySide(evt.from);
      const to = other(from);
      const def = (evt.attackId && getAttack(evt.attackId)) || pickAttack(evt.seed, lastAttack[from.classId]);
      if (!def || !from.wizard || !to.wizard) return;
      lastAttack[from.classId] = def.id;
      for (const s of [from, to]) s.wizard.idleEvents(false);
      // Burst (§11): lång kö = högre tempo och överhoppad uppladdning, inget tappas.
      const rush = rushFor(director.pending());
      // §7.1: mätaren lyser, staven glöder, kort uppladdningsrörelse – sedan attacken.
      scene.state(from.side, "CHARGING");
      from.slot.classList.add("tk-charging");
      from.wizard.setExpression("happy");
      if (!rush.skipCharge) {
        scene.sound("uppladdning");
        await race(from.wizard.play("charge"), CHARGE_MAX_MS);
        if (signal.aborted) return;
      }
      scene.banner(def.name, from.side);
      await race(Promise.resolve(def.run(scene, {
        from: pub(from), to: pub(to), index: evt.index, seed: evt.seed, rng: seededRandom(evt.seed),
        signal, attack: def, speed: rush.speed, wait: (ms) => scene.wait(ms / rush.speed, signal),
      })), (def.durationMs || 6000) / rush.speed + RUN_PAD_MS);
    },
    async runFinale(o, signal) {
      root.classList.add("tk-finale");
      arena.setMood("finale");
      for (const s of Object.values(sides)) { s.wizard?.reset(); s.wizard?.idleEvents(false); s.wizard?.setIdle(false); }
      const winner = o.draw ? null : sides.left.classId === o.winnerId ? sides.left : sides.right.classId === o.winnerId ? sides.right : null;
      const def = pickFinale(attackSeed(sid, "final", 0), winner ? "win" : "draw");
      if (!def) return;
      await race(Promise.resolve(def.run(scene, {
        winner: pub(winner), loser: winner ? pub(other(winner)) : null, draw: !winner,
        sides: [pub(sides.left), pub(sides.right)], rng: seededRandom(attackSeed(sid, "final", 1)), signal, outcome: o,
      })), FINALE_MAX_MS);
    },
    settle(kind) {
      if (kind === "finale") {
        tracker.markFinale();
        if (!dead) showResult();
        return;
      }
      scene.clear();
      for (const s of Object.values(sides)) {
        s.slot.classList.remove("tk-charging");
        scene.state(s.side, "IDLE");
        // Attacker byter basuttryck (sad/happy) – tillbaka till neutral efteråt (#538).
        s.wizard?.setExpression(ended() ? "surprised" : "neutral");
        s.wizard?.reset();
        s.wizard?.setIdle(true);
        s.wizard?.idleEvents(!ended());
      }
      if (pendingRemount && director.pending() === 0) queueMicrotask(() => lastD && mountWizards(lastD));
    },
  });

  const scene = createScene({
    stage, fx: root.querySelector(".tk-fx"), fxBack: root.querySelector(".tk-fxback"),
    bannerEl: root.querySelector(".tk-banner"), slots, sound, reducedMotion, director,
  });

  function mountWizards(d) {
    const busy = !director.idle() || finaleBegun;
    for (const s of d.sides) {
      const ui = sides[s.side];
      ui.classId = s.classId;
      ui.name = s.name;
      if (ui.who === s.who && ui.wizard) continue;
      if (busy && ui.wizard) { pendingRemount = true; continue; }
      ui.wizard?.destroy();
      ui.who = s.who;
      ui.slot.dataset.who = s.who;
      ui.wizard = createWizard(ui.slot, { who: s.who, facing: s.side === "left" ? "right" : "left", reducedMotion });
      ui.wizard.setIdle(true);
      ui.wizard.idleEvents(!d.ended);
    }
    if (!busy) pendingRemount = false;
  }

  function showResult() {
    const d = lastD;
    if (!d?.outcome) return;
    resultShown = true;
    const o = d.outcome;
    const w = o.draw ? null : d.sides.find((s) => s.classId === o.winnerId);
    for (const s of Object.values(sides)) {
      if (!s.wizard) continue;
      const won = w && s.classId === w.classId;
      scene.state(s.side, !w ? "IDLE" : won ? "VICTORY" : "DEFEAT");
      if (!finaleBegun || !director.finaleStarted()) s.wizard.setExpression(!w ? "happy" : won ? "happy" : "sad");
    }
    resultEl.innerHTML = `
      <div class="tk-result-title">${w ? `🏆 ${esc(w.name)} VINNER!` : "OAVGJORT!"}</div>
      <div class="tk-result-sub">${w ? `${esc(w.wizardName)} vinner trollkarlsduellen!` : "Lika starka trollkarlar – ingen vinnare den här gången."}</div>
      <div class="tk-result-scores">${d.sides.map((s) => `<div class="tk-result-row${w && s.classId === w.classId ? " vinnare" : ""}" data-who="${s.who}">
        <b>${esc(s.name)}</b><span>🧙 ${esc(s.wizardName)}</span><strong>${s.scoreText}</strong><small>poäng/elev · ${s.correct} rätt</small></div>`).join("")}</div>
      <div class="tk-result-prize" data-prize></div>`;
    resultEl.hidden = false;
    refreshPrize();
  }

  function refreshPrize() {
    const p = resultEl.querySelector("[data-prize]");
    if (!p) return;
    const t = lastSt.result ? prizeText(lastSt.session, lastSt.result) : "";
    p.textContent = t ? `🪙 ${t}` : "";
  }

  function startFinale(d) {
    finaleBegun = true;
    const fin = toMs(lastSt.session?.finishedAt);
    const now = Number(lastSt.now) || Date.now();
    if (tracker.finaleSeen() || (fin != null && now - fin > STALE_FINALE_MS)) {
      // Redan sedd i det här fönstret (omladdning) eller gammal match: bara resultatet.
      director.stop();
      root.classList.add("tk-finale");
      arena.setMood("finale");
      idleAll(false);
      showResult();
      return;
    }
    director.finale({ winnerId: d.outcome.winnerId, draw: d.outcome.draw });
  }

  function update(next) {
    if (dead || !next) return;
    lastSt = next;
    const now = Date.now();
    if (next.phase === "finished" && finishedSeen == null) finishedSeen = now;
    const d = duelData(next, finishedSeen, now);
    lastD = d;
    mountWizards(d);
    hud.update(d);
    const correct = Object.fromEntries(d.sides.map((s) => [s.classId, s.correct]));
    const { meters, events } = tracker.sync(correct, { quiet: d.phase !== "live" });
    for (const s of d.sides) {
      hud.meters[s.side].update(meters[s.classId], ATTACK_THRESHOLD);
      sides[s.side].slot.classList.toggle("tk-near", !!meters[s.classId]?.near && director.idle() && !d.ended);
    }
    for (const e of events) director.attack({ ...e, from: e.classId, to: other(bySide(e.classId)).classId });
    root.dataset.tension = d.tension;
    if (!finaleBegun) arena.setMood(d.tension);
    if (d.ended && !director.stopped()) {
      // §14.1: 00:00 – inga nya attacker, pågående avbryts kontrollerat, alla stannar upp.
      director.stop();
      for (const s of Object.values(sides)) { s.wizard?.idleEvents(false); s.wizard?.setExpression("surprised"); }
    }
    if (d.phase === "finished") {
      clearTimeout(pollT);
      if (!d.outcome) pollT = setTimeout(() => update(lastSt), 400); // väntar in historikens result
      else if (!finaleBegun) startFinale(d);
      else if (resultShown) refreshPrize();
    }
  }

  update(st);
  const api = {
    update,
    destroy() {
      dead = true;
      clearTimeout(pollT);
      ro?.disconnect();
      director.destroy();
      scene.destroy();
      for (const s of Object.values(sides)) s.wizard?.destroy();
      hud.destroy();
      arena.destroy();
      if (trollkarlDemo.view?.owner === api) trollkarlDemo.view = null;
    },
  };
  trollkarlDemo.view = {
    owner: api,
    director,
    tracker,
    /** Demoläget: tvinga en attack (påverkar bara bilden, aldrig poäng). */
    attack(side, attackId = null) {
      const from = sides[side];
      if (!from?.classId) return false;
      return director.attack({
        from: from.classId, to: other(from).classId, index: 0, seed: Math.floor(Math.random() * 2 ** 32) >>> 0, attackId, demo: true,
      });
    },
  };
  return api;
}
