// ============================================================================
// Snilleblixten – TV-studion (#559): KOPPLINGEN mellan Live-flödet och
// projektorvyerna. En per monterad vy (studion eller statistiken):
//   • lyssnar på sbScores (poängen, skrivs vid avslöjandet) och på svaren
//     för PÅGÅENDE fråga ("17 av 24 har svarat", bockarna i publiken) –
//     bara lärare får läsa dem; svarslyssnaren byts när frågan byts
//   • ställningen = formatets computeStandings(s, { scores, players })
//   • lärarens automatik (choreFor i sb-scen.js): första frågan efter KÖR!,
//     stäng när tiden är ute/alla svarat, avslöja efter trumvirveln. Varje
//     steg är en transaktion ur aktuellt index (snilleblixt-data.js), så
//     kontrollpanel + elevskärm + en andra lärare ger ändå exakt ett steg.
//   • lärarknapparna (§5.6): NÄSTA FRÅGA, Avsluta frågan nu, Hoppa över,
//     Avsluta spelet – samma transaktioner.
//
// Datalagret: deps.snilleblixt (förhandsvisningens låtsasdata) eller
// snilleblixt-data.js (laddas latt). Avatarernas projektion: deps.loadProjection
// eller klassprojektionen (live-avatars.js) – EN roster per session, delad
// mellan lobbyn och spelvyerna (projektionen läses en gång).
//
// API
//   avatarRoster(sid, deps?) → roster (live-avatars.js), cachad per session
//   createSbKoppling({ sid, st, deps, actions, screen, onChange, say? }) → {
//     update(st)                 nytt Live-tillstånd (från skalet)
//     scores, answers            senaste sbScores[] / svaren på pågående fråga
//     progress()                 → answerProgress för pågående fråga
//     standings(scores?)         → computeStandings (default alla poäng)
//     now()                      server-korrigerad tid
//     next(), closeNow(), skip(), endGame() → Promise (knapparna)
//     controls()                 → controlsFor(session)
//     destroy()
//   }
// ============================================================================

import { createAvatarRoster } from "../../design/live-avatars.js";
import { answerProgress } from "./snilleblixt-flode.js";
import { computeStandings } from "./snilleblixt-poang.js";
import { choreFor, controlsFor } from "./sb-scen.js";

// Ett misslyckat/ofarligt steg (annan lärare hann före) försöks inte om förrän efter så här länge.
const RETRY_MS = 2500;

let rosterCache = null; // { sid, roster }

/** Avatarlistan för sessionen – samma instans för lobby och spelvyer. */
export function avatarRoster(sid, deps = null) {
  if (rosterCache?.sid === sid) return rosterCache.roster;
  rosterCache?.roster.destroy();
  const roster = createAvatarRoster(deps?.loadProjection ? { load: deps.loadProjection } : {});
  rosterCache = { sid, roster };
  roster.prefetch([]);
  return roster;
}

export function createSbKoppling({ sid, st, deps = null, actions = {}, screen = false, onChange = () => {}, say = () => {} }) {
  let cur = st;
  let api = deps?.snilleblixt || null;
  let dead = false;
  let scores = [];
  let answers = [];
  let answersIx = null;
  let unAnswers = null;
  let unScores = null;
  const tried = new Map(); // "action|index" → ms
  let busy = false;
  const now = () => (deps?.now ? deps.now() : cur?.now ?? Date.now());

  const ready = (api ? Promise.resolve(api) : import("./snilleblixt-data.js")).then((m) => {
    if (dead) return null;
    api = m;
    unScores = api.watchScores(sid, (list) => { scores = list || []; onChange("scores"); }, (e) => say(`Poängen: ${e.message}`));
    watchAnswers();
    return api;
  }).catch((e) => { say(`Snilleblixten kunde inte laddas: ${e?.message || e}`); return null; });

  function watchAnswers() {
    const q = cur?.session?.q;
    const ix = q && cur.session.status === "live" ? q.index : null;
    if (!api || ix === answersIx) return;
    unAnswers?.();
    unAnswers = null;
    answersIx = ix;
    answers = [];
    if (ix == null) return;
    unAnswers = api.watchQuestionAnswers(sid, ix, (list) => {
      if (answersIx !== ix) return;
      answers = list || [];
      onChange("answers");
      chores();
    }, (e) => say(`Svaren: ${e.message}`));
  }

  function progress() {
    const s = cur?.session;
    if (!s?.q) return { answered: 0, eligible: 0, all: false };
    return answerProgress(s, { answers, players: cur.players || [], now: now() });
  }

  async function step(action, fromIndex) {
    const fn = { open: api?.openQuestion, close: api?.closeQuestion, reveal: api?.revealQuestion, skip: api?.skipQuestion }[action];
    if (!fn) return { done: false };
    return fn(sid, fromIndex);
  }

  // Automatiken: ett försök per steg och fönster åt gången, omförsök efter RETRY_MS.
  function chores() {
    const s = cur?.session;
    if (!api || !s || busy) return;
    const c = choreFor(s, { phase: cur.phase, now: now(), progress: s.q?.phase === "open" ? progress() : null });
    if (!c) return;
    const key = `${c.action}|${c.fromIndex}`;
    const t = Date.now();
    if (t - (tried.get(key) || 0) < RETRY_MS) return;
    tried.set(key, t);
    busy = true;
    step(c.action, c.fromIndex)
      .catch((e) => console.warn(`Snilleblixten: ${c.action}`, e))
      .finally(() => { busy = false; });
  }
  const iv = setInterval(chores, 250);

  async function manual(action) {
    await ready;
    const s = cur?.session;
    const ctl = controlsFor(s);
    try {
      if (action === "next") {
        if (ctl.next === "finish") return await actions.finish?.();
        if (ctl.next === "open") return await step("open", ctl.index);
        return null;
      }
      if (action === "close" && ctl.closeNow) return await step("close", ctl.index);
      if (action === "skip" && ctl.skip) return await step("skip", ctl.index);
    } catch (e) {
      say(e?.message || String(e));
    }
    return null;
  }

  return {
    update(next) {
      cur = next;
      watchAnswers();
      chores();
    },
    get scores() { return scores; },
    get answers() { return answers; },
    get screen() { return screen; },
    progress,
    standings(list = scores) {
      return computeStandings(cur?.session, { scores: list, players: cur?.players || [] });
    },
    now,
    next: () => manual("next"),
    closeNow: () => manual("close"),
    skip: () => manual("skip"),
    endGame: () => Promise.resolve(actions.finish?.()).catch((e) => say(e?.message || String(e))),
    controls: () => controlsFor(cur?.session),
    destroy() {
      dead = true;
      clearInterval(iv);
      unAnswers?.();
      unScores?.();
    },
  };
}
