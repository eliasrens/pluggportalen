// ============================================================================
// Live: elevens synlighets-bevakare (#460). "Live" syns i elevmenyn BARA när
// det finns en lobby eller pågående match som elevens klass är inbjuden till.
// En onSnapshot på pågående sessioner (status lobby|live) → menyn ritas om
// direkt när en lärare skapar/avslutar en match, utan omladdning.
// Laddas DYNAMISKT av ui.js (getLiveVisible) – aldrig i bootgrafen (#271).
//
// Menyns "Live pågår!" (#824) följer bannerSessions: bara lobby eller en match
// vars klocka går – borta vid 00:00 (fas "ended") och när status blir
// finished/raderas, för alla format. Sidan #/elev/live använder
// relevantSessions (+ marginal), så en elev som laddar om just efter 00:00
// ändå ser slutet.
//
// API
//   relevantSessions(all, myClassIds, now) → sessioner eleven ska se
//   bannerSessions(all, myClassIds, now) → sessioner som gör att menyn visar Live
//   liveVisibleFor(meId)  → Promise<boolean> (startar bevakningen första gången)
//   onLiveVisibleChange(fn) → fn(visible, sessions) vid ändring
//   stopLiveWatch()
// ============================================================================

import { getClasses } from "../data-classes.js";
import { watchActiveSessions } from "./live-data.js";
import { serverNow } from "./live-clock.js";
import { sessionTimes } from "./live-core.js";

// En "live"-session vars tid gått ut (ingen har hunnit markera slut) döljs
// efter den här marginalen så menyn inte hänger kvar.
const GRACE_MS = 2 * 60_000;

/** Sessioner som eleven (via sina klasser) ska se just nu. */
export function relevantSessions(all, myClassIds, now) {
  return (all || []).filter((s) => {
    if (!s || !["lobby", "live"].includes(s.status)) return false;
    if (!(s.participatingClassIds || []).some((id) => myClassIds.includes(id))) return false;
    const { endMs } = sessionTimes(s);
    return s.status === "lobby" || endMs == null || now < endMs + GRACE_MS;
  });
}

/** Sessioner som gör att menyn visar "Live pågår!": lobby, eller live med klockan kvar. */
export function bannerSessions(all, myClassIds, now) {
  return relevantSessions(all, myClassIds, now).filter((s) => {
    const { endMs } = sessionTimes(s);
    return s.status === "lobby" || endMs == null || now < endMs;
  });
}

/** Ms till nästa matchslut (00:00) bland sessionerna, eller null. */
export function msTillNastaSlut(sessions, now) {
  const slut = (sessions || []).map((s) => sessionTimes(s).endMs).filter((e) => e != null && e > now);
  return slut.length ? Math.min(...slut) - now : null;
}

let watch = null; // { meId, unsub, iv, slutT, ready, sessions, myClassIds }
let visible = false;
const lyssnare = new Set();

export function onLiveVisibleChange(fn) {
  lyssnare.add(fn);
  return () => lyssnare.delete(fn);
}

function recompute() {
  if (!watch) return;
  const now = serverNow();
  const mine = bannerSessions(watch.sessions, watch.myClassIds, now);
  // Rita om precis vid 00:00 – inte först vid nästa 20 s-tick.
  clearTimeout(watch.slutT);
  const kvar = msTillNastaSlut(mine, now);
  watch.slutT = kvar == null ? 0 : setTimeout(recompute, kvar + 250);
  const next = mine.length > 0;
  if (next === visible) return;
  visible = next;
  lyssnare.forEach((fn) => { try { fn(visible, mine); } catch (e) { console.warn(e); } });
}

export function stopLiveWatch() {
  if (!watch) return;
  watch.unsub?.();
  clearInterval(watch.iv);
  clearTimeout(watch.slutT);
  watch = null;
  visible = false;
}

/** Ska Live synas för eleven? Första anropet startar bevakningen. */
export async function liveVisibleFor(meId) {
  if (!meId) {
    stopLiveWatch();
    return false;
  }
  if (watch?.meId === meId) {
    await watch.ready;
    return visible;
  }
  stopLiveWatch();
  const w = { meId, sessions: [], myClassIds: [], unsub: null, iv: null, slutT: 0 };
  watch = w;
  w.ready = (async () => {
    const klasser = await getClasses().catch(() => []);
    if (watch !== w) return;
    w.myClassIds = klasser.filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(meId)).map((c) => c.id);
    if (!w.myClassIds.length) return;
    // Sidomenyn väntar på svaret – häng aldrig mer än 4 s (offline o.d.).
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    await Promise.race([timeout, new Promise((resolve) => {
      w.unsub = watchActiveSessions((list) => {
        if (watch !== w) return;
        w.sessions = list;
        recompute();
        resolve();
      }, (err) => {
        console.warn("Live: kunde inte bevaka sessioner", err);
        resolve();
      });
    })]);
    w.iv = setInterval(recompute, 20_000);
  })();
  await w.ready;
  return visible;
}
