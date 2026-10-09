// ============================================================================
// Trollkarlsduellen (#536): MAGICSYSTEM (spec §7, §16) – ren logik, ingen DOM.
// Magipoäng = klassens ABSOLUTA antal rätt i matchen (inte snittet). De påverkar
// aldrig ställning eller vinnare – inget här skrivs någonstans utom i fönstrets
// egen sessionStorage.
//   attacker = floor(rätt / tröskel), mätare = rätt % tröskel (tröskel 100)
//   98 → 103 rätt = exakt EN ny attack och mätaren står på 3/100.
//
// Omladdning/återanslutning: trackerns FÖRSTA sync hoppar till nuvarande läge
// utan händelser (gamla attacker spelas aldrig igen). "Senast sedda
// attackindex" + "finalen visad" sparas per session i sessionStorage = per
// fönster, så kontrollpanel och elevskärm i samma webbläsare inte stör
// varandra (localStorage delas mellan fönstren).
//
// API
//   ATTACK_THRESHOLD                 100
//   CHARGE_NEAR                      0.9 – "nästan full" (glöd, fokuserad figur)
//   magicState(correct, threshold?)  → { correct, attacks, meter, fraction, near }
//   attackSeed(sessionId, classId, index) → uint32 (FNV-1a, deterministiskt)
//   seededRandom(seed)               → () => tal i [0, 1) (mulberry32)
//   sessionStore(storage?)           → { get(key), set(key, value) } (JSON, tål fel)
//   createMagicTracker({ sessionId, classIds, threshold?, store? }) → {
//     sync(correctByClass, { quiet? }) → { meters: { classId: magicState }, events: [
//                                         { classId, index, seed }] }
//     skipped()     → { classId: antal attacker som hoppades över vid start }
//     finaleSeen() / markFinale()      – finalen en gång per session och fönster
//   }
//     quiet: true = uppdatera "sett" utan händelser (matchen slut: inga nya attacker)
// ============================================================================

export const ATTACK_THRESHOLD = 100;
export const CHARGE_NEAR = 0.9;

export function magicState(correct, threshold = ATTACK_THRESHOLD) {
  const c = Math.max(0, Math.floor(Number(correct) || 0));
  const t = Math.max(1, Math.floor(Number(threshold) || ATTACK_THRESHOLD));
  const meter = c % t;
  return { correct: c, attacks: Math.floor(c / t), meter, fraction: meter / t, near: meter / t >= CHARGE_NEAR };
}

export function attackSeed(sessionId, classId, index) {
  let h = 0x811c9dc5;
  const s = `${sessionId}|${classId}|${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sessionStore(storage) {
  const s = storage !== undefined ? storage : (() => { try { return globalThis.sessionStorage || null; } catch { return null; } })();
  return {
    get(key) {
      try { return JSON.parse(s?.getItem(key) || "null"); } catch { return null; }
    },
    set(key, value) {
      try { s?.setItem(key, JSON.stringify(value)); } catch {}
    },
  };
}

export function createMagicTracker({ sessionId, classIds, threshold = ATTACK_THRESHOLD, store = sessionStore() }) {
  const key = `pp:trollkarl:${sessionId}`;
  const saved = store.get(key) || {};
  const rec = { seen: { ...(saved.seen || {}) }, finale: !!saved.finale };
  let first = true;
  const skippedBy = {};
  const save = () => store.set(key, rec);

  function sync(correctByClass = {}, { quiet = false } = {}) {
    const meters = {};
    const events = [];
    for (const cid of classIds) meters[cid] = magicState(correctByClass[cid], threshold);
    if (first) {
      // Första renderingen efter laddning: hoppa till nuläget, spela inget gammalt.
      first = false;
      for (const cid of classIds) {
        const prev = Number.isInteger(rec.seen[cid]) ? rec.seen[cid] : 0;
        skippedBy[cid] = Math.max(0, meters[cid].attacks - prev);
        rec.seen[cid] = meters[cid].attacks;
      }
      save();
      return { meters, events };
    }
    let changed = false;
    // Varannan klass per attacknummer, så två nästan samtidiga fulla mätare båda syns.
    const pending = classIds.map((cid) => {
      const from = rec.seen[cid] ?? 0;
      const to = meters[cid].attacks;
      if (to !== from) { rec.seen[cid] = to; changed = true; }
      return { cid, from, to: quiet ? from : to };
    });
    const most = Math.max(0, ...pending.map((p) => p.to - p.from));
    for (let k = 1; k <= most; k++) {
      for (const p of pending) {
        const index = p.from + k;
        if (index <= p.to) events.push({ classId: p.cid, index, seed: attackSeed(sessionId, p.cid, index) });
      }
    }
    if (changed) save();
    return { meters, events };
  }

  return {
    sync,
    skipped: () => ({ ...skippedBy }),
    finaleSeen: () => rec.finale,
    markFinale() { rec.finale = true; save(); },
  };
}
