// ============================================================================
// Live-design (#571): REGIN – kopplar ihop händelsesystemet (live-events.js),
// animationskön (live-queue.js), avatarreaktionerna (live-reactions.js),
// banderollen (live-banner.js) och ljudkön (proj-sound.js cue). De nya
// lägenas projektorvyer anropar bara sync(st-utdrag) vid varje tillstånd och
// ritar själva poäng/ställning direkt (aldrig via kön).
//
// Standardkoppling (formatet kan ersätta per händelse via map):
//   join     → reaktion "ankomst" + ljud pling
//   answered → reaktion "svarat" (bock-tillstånd) + ljud bock
//   correct  → reaktion "glad"
//   leader   → banderoll "Ny ledare!" + "jubel" på ledaren + ljud swoosh
//   rank     → jobb till playRank (vyns FLIP-flytt), annars inget
//   server   → bara via map (formatets kista/stöld/byte/sköld)
//   final    → kön.final → playFinal (EN gång – även efter omladdning)
//
// API
//   createLiveRegi({ sessionId, pool, banner?, sound?, store?, map?, playRank?,
//                    playFinal?, playJob?, settle?, queueOpts? }) → {
//     sync(input) → events   input: se live-events.js (players behöver name för banderoller)
//     push(job) → bool       egna jobb direkt i kön
//     queue, tracker, destroy()
//   }
//   map(evt, { nameOf }) → job[] | undefined   (undefined = standardkopplingen)
//   jobb: { kind: "reaction", uid, reaction, big?, cue? } | { kind: "banner",
//         banner: { icon, title, sub, tone }, mergeKey?, cue?, then?: job[] } |
//         { kind: "rank", … } | egna (playJob)
// ============================================================================

import { createLiveEventTracker } from "./live-events.js";
import { createLiveQueue } from "./live-queue.js";
import { react, setAvatarState } from "./live-reactions.js";

function defaultJobs(evt, { nameOf }) {
  switch (evt.type) {
    case "join": return [{ kind: "reaction", uid: evt.uid, reaction: "ankomst", cue: "pling" }];
    case "answered": return [{ kind: "reaction", uid: evt.uid, reaction: "svarat", cue: "bock" }];
    case "correct": return [{ kind: "reaction", uid: evt.uid, reaction: "glad" }];
    case "leader": return [{
      kind: "banner",
      mergeKey: "leader",
      // Flera ledarbyten i kö: bara den senaste ledaren är sann.
      merge: (a, b) => b,
      banner: { icon: "👑", title: "Ny ledare!", sub: nameOf(evt.uid), tone: "gold" },
      cue: "swoosh",
      then: [{ kind: "reaction", uid: evt.uid, reaction: "jubel" }],
    }];
    case "rank": return [{ kind: "rank", moves: evt.moves, order: evt.order }];
    default: return [];
  }
}

export function createLiveRegi({
  sessionId, pool, banner = null, sound = null, store, map, playRank, playFinal, playJob, settle, queueOpts = {},
}) {
  const tracker = createLiveEventTracker(store ? { sessionId, store } : { sessionId });
  const names = new Map();
  const nameOf = (uid) => names.get(uid) || "";
  let queue = null;

  async function play(job, signal, opts) {
    if (job.kind === "reaction") {
      return react(pool.el(job.uid), job.reaction, { signal, big: !!job.big, speed: opts.speed });
    }
    if (job.kind === "banner") {
      if (job.cue) sound?.cue?.(job.cue);
      for (const r of job.then || []) queue.push(r);
      return banner?.show(job.count > 1 && job.bannerMany ? job.bannerMany(job) : job.banner, signal, opts);
    }
    if (job.kind === "rank") return playRank?.(job, signal, opts);
    if (job.kind === "final") return playFinal?.(job, signal);
    return playJob?.(job, signal, opts);
  }

  queue = createLiveQueue({ play, settle, ...queueOpts });

  function push(job) {
    if (job.kind === "reaction" && job.cue) sound?.cue?.(job.cue);
    return queue.push(job);
  }

  function sync(input = {}) {
    for (const p of input.players || []) if (p?.uid && p.name) names.set(p.uid, p.name);
    const events = tracker.sync(input);
    for (const evt of events) {
      if (evt.type === "final") { queue.final(evt); continue; }
      const jobs = map?.(evt, { nameOf }) ?? defaultJobs(evt, { nameOf });
      for (const j of jobs || []) push(j);
    }
    return events;
  }

  return {
    sync,
    push,
    queue,
    tracker,
    /** Släck "Har svarat"-bockarna (t.ex. ny fråga i Snilleblixten). */
    clearAnswered(uids) {
      for (const uid of uids) setAvatarState(pool.el(uid), "svarat", false);
    },
    destroy() { queue.destroy(); },
  };
}
