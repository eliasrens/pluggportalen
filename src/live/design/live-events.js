// ============================================================================
// Live-design (#571): HÄNDELSESYSTEMET (designspec §9) – ren logik, ingen DOM.
// Vyn räknar aldrig själv ut vad som hänt: den ger trackern Lives data (det
// live-feed.js redan levererar: fas, spelare, formatets ställning och ev.
// serverhändelser) och får tillbaka en lista händelser att visualisera.
//
// Omladdning/återanslutning (spec §9, designtest 10): FÖRSTA sync efter
// laddning hoppar till nuläget utan händelser – gamla händelser spelas aldrig
// igen, vyn ritar bara rätt ställning direkt. "Finalen visad" sparas per
// session i sessionStorage = per FÖNSTER (som Trollkarlsduellen), så
// kontrollpanel och elevskärm i samma webbläsare inte stör varandra. Finalen
// spelas exakt en gång; en omladdning efter finalen visar bara resultatet.
// Ett nytt fönster som öppnas långt efter slutet (> staleFinalMs) spelar
// inte heller finalen.
//
// Händelser (type → typisk visualisering)
//   join      { uid }                     Ankomst
//   answered  { uid }                     Har svarat (svarsnyckeln ändrades)
//   correct   { uid, delta }              Glad
//   wrong     { uid, delta }              – (vyn väljer)
//   rank      { moves: [{ uid, from, to }], order: [uid…] }  topplisteflytt
//   leader    { uid, prev }               Ny ledare (banderoll + Jubel)
//   server    { …serverhändelsen, type } formatets egna (kista, stöld, byte, sköld)
//   final     { outcome }                 pallplats/final – EN gång
//
// Indata till sync (allt valfritt utom phase):
//   { phase,                         live-core phaseAt ("lobby"|"countdown"|"live"|"ended"|"finished")
//     players: [{ uid, score?, correct?, incorrect?, answerKey? }],
//     ranks?:  { uid: plats }        formatets placering (saknas → efter score, delad plats vid lika)
//     events?: [{ id, type, … }]     serverns händelser (dedupliceras på id)
//     outcome?, finishedAt? (ms), now? (ms) }
//
// API
//   sessionStore(storage?) → { get, set }   (återanvänds från Trollkarlsduellen)
//   rankPlayers(players)   → { uid: plats } (lika poäng = samma plats, 1,2,2,4)
//   createLiveEventTracker({ sessionId, store?, staleFinalMs? }) → {
//     sync(input) → events[]
//     finalSeen() → bool, baseline() → bool (första sync gjord)
//   }
// ============================================================================

import { sessionStore } from "../trollkarl/trollkarl-magi.js";

export { sessionStore };

export const STALE_FINAL_MS = 3 * 60_000;
const SEEN_CAP = 500;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const scoreOf = (p) => (p.score != null ? num(p.score) : num(p.correct));

/** Placering efter poäng (bara poäng > 0). Lika poäng delar plats: 1, 2, 2, 4. */
export function rankPlayers(players = []) {
  const list = (players || []).filter((p) => p && p.uid && scoreOf(p) > 0)
    .sort((a, b) => scoreOf(b) - scoreOf(a) || String(a.uid).localeCompare(String(b.uid)));
  const ranks = {};
  let place = 0;
  let prev = null;
  list.forEach((p, i) => {
    const s = scoreOf(p);
    if (s !== prev) { place = i + 1; prev = s; }
    ranks[p.uid] = place;
  });
  return ranks;
}

/** Ensam ledare (plats 1 och ingen annan på plats 1) eller null. */
function soleLeader(ranks) {
  const top = Object.keys(ranks).filter((u) => ranks[u] === 1);
  return top.length === 1 ? top[0] : null;
}

export function createLiveEventTracker({ sessionId, store = sessionStore(), staleFinalMs = STALE_FINAL_MS } = {}) {
  const key = `pp:live:handelser:${sessionId}`;
  const saved = store.get(key) || {};
  const rec = { final: !!saved.final };
  const save = () => store.set(key, rec);
  let first = true;
  let players = new Map(); // uid → { score, correct, incorrect, answerKey }
  let ranks = {};
  let leader = null;
  const seen = new Set();
  const seenOrder = [];

  function markSeen(id) {
    if (seen.has(id)) return;
    seen.add(id);
    seenOrder.push(id);
    if (seenOrder.length > SEEN_CAP) seen.delete(seenOrder.shift());
  }

  function snapshot(list) {
    const m = new Map();
    for (const p of list) {
      if (!p || !p.uid) continue;
      m.set(p.uid, { score: scoreOf(p), correct: num(p.correct), incorrect: num(p.incorrect), answerKey: p.answerKey ?? null });
    }
    return m;
  }

  function finalEvent(input) {
    if (input.phase !== "finished" || rec.final) return null;
    rec.final = true;
    save();
    return { type: "final", outcome: input.outcome ?? null };
  }

  function sync(input = {}) {
    const list = Array.isArray(input.players) ? input.players : [];
    const next = snapshot(list);
    const nextRanks = input.ranks && typeof input.ranks === "object" ? { ...input.ranks } : rankPlayers(list);
    const nextLeader = soleLeader(nextRanks);
    const serverEvents = Array.isArray(input.events) ? input.events : [];

    if (first) {
      // Hoppa till nuläget: inget gammalt spelas. Finalen: bara om matchen
      // precis tog slut och det här fönstret inte redan visat den.
      first = false;
      players = next;
      ranks = nextRanks;
      leader = nextLeader;
      for (const e of serverEvents) if (e && e.id != null) markSeen(e.id);
      const fin = input.phase === "finished" && !rec.final;
      const stale = input.finishedAt != null && num(input.now) - num(input.finishedAt) > staleFinalMs;
      if (fin && stale) { rec.final = true; save(); return []; }
      const f = finalEvent(input);
      return f ? [f] : [];
    }

    const events = [];
    const playing = input.phase !== "finished";
    for (const [uid, p] of next) {
      const before = players.get(uid);
      if (!before) { events.push({ type: "join", uid }); continue; }
      if (!playing) continue;
      if (p.answerKey != null && p.answerKey !== before.answerKey) events.push({ type: "answered", uid });
      if (p.correct > before.correct) events.push({ type: "correct", uid, delta: p.correct - before.correct });
      if (p.incorrect > before.incorrect) events.push({ type: "wrong", uid, delta: p.incorrect - before.incorrect });
    }
    if (playing) {
      const moves = [];
      for (const uid of Object.keys(nextRanks)) {
        if (ranks[uid] !== nextRanks[uid]) moves.push({ uid, from: ranks[uid] ?? null, to: nextRanks[uid] });
      }
      if (moves.length) {
        const order = Object.keys(nextRanks).sort((a, b) => nextRanks[a] - nextRanks[b]);
        events.push({ type: "rank", moves, order });
      }
      if (nextLeader && nextLeader !== leader) events.push({ type: "leader", uid: nextLeader, prev: leader });
    }
    for (const e of serverEvents) {
      if (!e || e.id == null || seen.has(e.id)) continue;
      markSeen(e.id);
      if (playing) events.push({ ...e, type: "server", serverType: e.type });
    }
    const f = finalEvent(input);
    if (f) events.push(f);

    players = next;
    ranks = nextRanks;
    // Ny ledare räknas först när någon faktiskt leder ensam (oavgjort i
    // toppen behåller den förra, så samma ledare inte "tar ledningen" igen).
    if (nextLeader) leader = nextLeader;
    return events;
  }

  return {
    sync,
    finalSeen: () => rec.final,
    baseline: () => !first,
  };
}
