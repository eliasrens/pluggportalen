// ============================================================================
// Pluggporten – säsongsläget i minnet (issue #690, epic #689)
// ----------------------------------------------------------------------------
// Ren tillståndsmaskin utan Firebase (season.js kopplar in Firestore, klockan
// och localStorage) så att logiken testas i node (test/season.test.js):
//   • startläge = localStorage-cachen (rätt tema direkt, utan blink) eller
//     sommar om den saknas
//   • snapshot(doc|null) från EN onSnapshot-lyssnare på config/season
//   • en timer till närmaste slutdatum (halloweenUntil, julUntil – alla
//     tillägg i TILLAGG) → tillägget slår av utan omladdning;
//     recheck() vid flik-återkomst och när server-klockan synkats
//   • lyssnare får (nytt, förra) bara när läget faktiskt ändras
// Tiden kommer ALLTID från deps.now() (server-korrigerad), aldrig Date.now().
// ============================================================================

import { TILLAGG, aktivaTillagg, nextSeasonBoundary, normalizeSeason, seasonConfig } from "./season-config.js";

// setTimeout tål högst ~24,8 dygn; längre bort = väck och räkna om.
const MAX_TIMEOUT = 2_000_000_000;

/**
 * @param {{now:()=>number, load?:()=>any, save?:(s:object)=>void,
 *          setTimeout?:Function, clearTimeout?:Function}} deps
 */
export function createSeasonStore(deps) {
  const st = deps.setTimeout || setTimeout;
  const ct = deps.clearTimeout || clearTimeout;
  const listeners = new Set();
  let raw = normalizeSeason(safe(deps.load));
  let state = view(raw, deps.now());
  let key = keyOf(state);
  let timer = null;
  let fromServer = false;

  /** Läget + `{id}Active` per tillägg (halloweenActive, julActive) + `tillagg` (aktiva id:n). */
  function view(r, now) {
    const aktiva = aktivaTillagg(r, now);
    const v = { ...r, tillagg: aktiva, config: seasonConfig(r.season) };
    for (const t of TILLAGG) v[`${t.id}Active`] = aktiva.includes(t.id);
    return v;
  }

  function schedule() {
    ct(timer);
    timer = null;
    const now = deps.now();
    const t = nextSeasonBoundary(raw, now);
    if (t == null) return;
    // +200 ms så vi garanterat landar EFTER slutdatumet.
    timer = st(recheck, Math.min(Math.max(0, t - now + 200), MAX_TIMEOUT));
  }

  function recheck() {
    const next = view(raw, deps.now());
    schedule();
    const k = keyOf(next);
    if (k === key) return;
    const prev = state;
    state = next;
    key = k;
    for (const fn of listeners) {
      try {
        fn(next, prev);
      } catch (err) {
        console.error("Säsongen: lyssnare kastade", err);
      }
    }
  }

  schedule(); // ett cachat slutdatum gäller redan innan servern svarat

  return {
    /** Nuvarande läge: { season, halloween, halloweenUntil, halloweenActive, jul, julUntil, julActive, tillagg, config }. */
    get: () => state,
    /** Har servern svarat minst en gång (annars är läget cachat/förvalt)? */
    get fromServer() {
      return fromServer;
    },
    /** Nytt innehåll i config/season (null = dokumentet saknas). */
    snapshot(doc) {
      fromServer = true;
      raw = normalizeSeason(doc);
      try {
        deps.save?.(raw);
      } catch {}
      recheck();
    },
    recheck,
    /** fn(nytt, förra) vid varje ändring. Returnerar avregistrering. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    stop() {
      ct(timer);
      timer = null;
      listeners.clear();
    },
  };
}

function keyOf(s) {
  return [s.season, ...TILLAGG.flatMap((t) => [s[t.falt], s[t.tillFalt], s[`${t.id}Active`]])].join("|");
}

function safe(fn) {
  try {
    return fn ? fn() : null;
  } catch {
    return null;
  }
}
