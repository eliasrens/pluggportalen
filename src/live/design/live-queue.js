// ============================================================================
// Live-design (#571): ANIMATIONSKÖN (designspec §9) – gemensam för de nya
// lägena (Snilleblixten, Guldrushen). Byggd som Trollkarlsduellens regi
// (trollkarl-regi.js) men med fler nivåer. Ingen DOM: vyn ger funktionerna
// som faktiskt spelar. Kön är en VISUALISERING – poäng, guld, placering och
// svar uppdateras alltid direkt i vyn, aldrig via kön.
//
// Prioritet: FINAL 5 > BANNER 4 > RANK 3 > REACTION 2 > IDLE 1.
//   • HUVUDSPÅRET (seriellt, ett jobb i taget): banderoller och topplisteflytt.
//     Banderoller går före flytt; inom samma nivå i tur och ordning.
//   • Flytt slås ihop: bara den SENASTE väntande flytten spelas (den visar
//     ändå nuvarande ställning) – äldre settle:as som överhoppade.
//   • Banderoller med samma mergeKey slås ihop medan de väntar (count +
//     items); fler än maxBanners väntande → de äldsta hoppas över; en
//     banderoll som väntat längre än maxAgeMs hoppas över när den står på tur.
//     Så ligger vyn aldrig efter verkligheten.
//   • REAKTIONER (små, per avatar) går PARALLELLT och väntar aldrig på
//     huvudspåret. Samma avatar: den nya ersätter den pågående (avbryts).
//     Högst maxReactions samtidigt – fler hoppas över (de är små).
//   • final(evt) körs EXAKT EN gång per kö: avbryter allt, tömmer kön, nekar
//     nya jobb och spelar finalen. (En gång per FÖNSTER även efter omladdning
//     sköts av live-events.js, som bara skickar final en gång.)
//   • settle(job, { aborted, skipped }) körs för VARJE jobb som tar slut,
//     avbryts eller hoppas över – vyn låter figurerna landa på rätt plats där.
//
// API
//   PRIORITY
//   rushFor(pending) → { speed, short }   tempo när kön växer (som Trollkarl)
//   createLiveQueue({ play(job, signal, { speed, short }), settle?, now?,
//                     maxBanners?, maxAgeMs?, maxReactions?, guardMs? }) → {
//     push(job) → bool     job = { kind: "banner"|"rank"|"reaction", … }
//                          banner: { mergeKey?, merge?(a, b) → job }
//                          reaction: { uid }
//     final(job) → bool    bara första anropet spelas
//     idle() → bool        inget i huvudspåret och ingen final (vyn kan visa idle)
//     priority() → 1–5, pending() → antal väntande i huvudspåret,
//     reactions() → antal pågående reaktioner, finalStarted(),
//     stats() → { played, merged, skipped }   (test/kontroll)
//     whenIdle() → Promise, destroy()
//   }
// ============================================================================

export const PRIORITY = { IDLE: 1, REACTION: 2, RANK: 3, BANNER: 4, FINAL: 5 };

const GUARD_MS = 15_000;
const MAX_BANNERS = 3;
const MAX_AGE_MS = 6_000;
const MAX_REACTIONS = 12;

/** Högre tempo när huvudspåret har väntande jobb (aldrig långsammare än 1). */
export function rushFor(pending) {
  const p = Math.max(0, Math.floor(Number(pending) || 0));
  return { speed: p <= 0 ? 1 : p === 1 ? 1.3 : p <= 3 ? 1.7 : 2.2, short: p >= 2 };
}

/** Standard-hopslagning av två banderoller: räkna upp och samla posterna. */
function defaultMerge(a, b) {
  const items = [...(a.items || [a]), ...(b.items || [b])];
  return { ...b, at: a.at, count: (a.count || 1) + (b.count || 1), items };
}

export function createLiveQueue({
  play,
  settle = () => {},
  now = () => Date.now(),
  maxBanners = MAX_BANNERS,
  maxAgeMs = MAX_AGE_MS,
  maxReactions = MAX_REACTIONS,
  guardMs = GUARD_MS,
}) {
  const banners = [];
  let rankJob = null;
  let running = null; // { job, ac, done }
  const reacting = new Map(); // uid → { job, ac }
  let finalOn = false;
  let dead = false;
  let pumping = false;
  let idleWaiters = [];
  const counts = { played: 0, merged: 0, skipped: 0 };

  function safeSettle(job, info) {
    try { settle(job, info); } catch (e) { console.warn("Live-kön: settle", e); }
  }
  function skip(job) {
    counts.skipped++;
    safeSettle(job, { aborted: false, skipped: true });
  }

  function notifyIdle() {
    if (running || banners.length || rankJob) return;
    const w = idleWaiters;
    idleWaiters = [];
    w.forEach((r) => r());
  }

  /** Kör ett jobb med AbortSignal och skyddsnät; settle alltid till slut. */
  async function runJob(job, ac, opts) {
    let guardT = 0;
    let crashed = false;
    try {
      await Promise.race([
        Promise.resolve().then(() => play(job, ac.signal, opts)),
        new Promise((r) => { guardT = setTimeout(() => { ac.abort(); r(); }, guardMs); }),
        new Promise((r) => ac.signal.addEventListener("abort", r, { once: true })),
      ]);
    } catch (e) {
      crashed = true;
      if (!ac.signal.aborted) console.warn(`Live-kön: ${job.kind} kraschade`, e);
    } finally {
      clearTimeout(guardT);
      if (!ac.signal.aborted && !crashed) counts.played++;
      safeSettle(job, { aborted: ac.signal.aborted, skipped: false });
    }
  }

  function nextMain() {
    // Banderoller först; för gamla hoppas över när de står på tur.
    while (banners.length) {
      const b = banners.shift();
      if (now() - (b.at ?? now()) > maxAgeMs) { skip(b); continue; }
      return b;
    }
    const r = rankJob;
    rankJob = null;
    return r;
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        if (dead || finalOn) break;
        const job = nextMain();
        if (!job) break;
        const ac = new AbortController();
        const opts = rushFor(banners.length + (rankJob ? 1 : 0));
        running = { job, ac };
        running.done = runJob(job, ac, opts);
        const cur = running;
        await cur.done;
        if (running === cur) running = null;
      }
    } finally {
      pumping = false;
      notifyIdle();
    }
  }

  function pushBanner(job) {
    const b = { ...job, at: job.at ?? now() };
    if (b.mergeKey != null) {
      const same = banners.find((x) => x.mergeKey === b.mergeKey);
      if (same) {
        const merged = (b.merge || defaultMerge)(same, b);
        banners[banners.indexOf(same)] = { ...merged, kind: "banner", mergeKey: b.mergeKey, at: same.at };
        counts.merged++;
        return true;
      }
    }
    banners.push(b);
    while (banners.length > maxBanners) skip(banners.shift());
    return true;
  }

  function pushReaction(job) {
    const uid = job.uid;
    const prev = reacting.get(uid);
    if (prev) prev.ac.abort(); // nyast vinner för samma avatar
    else if (reacting.size >= maxReactions) { skip(job); return false; }
    const ac = new AbortController();
    const entry = { job, ac };
    reacting.set(uid, entry);
    runJob(job, ac, { speed: 1, short: false }).finally(() => {
      if (reacting.get(uid) === entry) reacting.delete(uid);
    });
    return true;
  }

  return {
    push(job) {
      if (!job || dead || finalOn) return false;
      if (job.kind === "reaction") return pushReaction(job);
      if (job.kind === "banner") pushBanner(job);
      else if (job.kind === "rank") {
        if (rankJob) skip(rankJob);
        rankJob = job;
      } else return false;
      pump();
      return true;
    },
    final(job = {}) {
      if (finalOn || dead) return false;
      finalOn = true;
      const prev = running?.done;
      running?.ac.abort();
      for (const b of banners.splice(0)) skip(b);
      if (rankJob) { skip(rankJob); rankJob = null; }
      for (const r of reacting.values()) r.ac.abort();
      const fin = { ...job, kind: "final" };
      Promise.resolve(prev).then(async () => {
        if (dead) return;
        const ac = new AbortController();
        const cur = { job: fin, ac };
        running = cur;
        cur.done = runJob(fin, ac, { speed: 1, short: false });
        await cur.done;
        if (running === cur) running = null;
      }).finally(notifyIdle);
      return true;
    },
    idle: () => !running && !banners.length && !rankJob && !finalOn,
    priority() {
      if (finalOn) return PRIORITY.FINAL;
      if (running?.job.kind === "banner" || banners.length) return PRIORITY.BANNER;
      if (running || rankJob) return PRIORITY.RANK;
      return reacting.size ? PRIORITY.REACTION : PRIORITY.IDLE;
    },
    pending: () => banners.length + (rankJob ? 1 : 0),
    reactions: () => reacting.size,
    finalStarted: () => finalOn,
    stats: () => ({ ...counts }),
    whenIdle() {
      if (!running && !banners.length && !rankJob) return Promise.resolve();
      return new Promise((r) => idleWaiters.push(r));
    },
    destroy() {
      dead = true;
      banners.length = 0;
      rankJob = null;
      running?.ac.abort();
      for (const r of reacting.values()) r.ac.abort();
      reacting.clear();
      notifyIdle();
    },
  };
}
