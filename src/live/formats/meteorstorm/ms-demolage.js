// ============================================================================
// Meteorstormen ☄️ (#824, LIVE-FORMAT §8): KOPPLAT DEMOLÄGE – projektorn och
// elevskärmen i SAMMA match. Elevdemots låtsasserver (ms-elev-demo.js: den
// riktiga motorn, 4B och 4D med simulerade elever, elevens egna anrop) är
// matchen; den här modulen gör om den till projektorns `deps`
// (mountProjector) – sessionen som live-feed, loggen som msEvents och
// msAvsluta-resultatet. Det eleven trycker (🛡️/🔫/🌀) syns alltså på
// projektorn efter renderingsbufferten, och slutrutan, elevens slutskärm och
// pluggmynten kommer ur samma resultat. Ingen Firestore, inga Cloud Functions,
// inga pluggmynt (sessionen har demo: true).
// Bara preview/preview-meteorstorm-demolage.html (två iframes) och testerna
// laddar den.
//
//   projektorDeps(E, { onLog? }) → { deps, stop() }
//     E = createMsElevDemo(...) (elevskärmens demo, kan bo i ett annat fönster)
//   eventsUr(E) → loggen i msEvents-form { id, uid, classId, namn, t, typ, nr, mal? }
//   sessionUr(E) → sessionsdokumentet som projektorn ser det (status live/finished)
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import METEORSTORM from "./index.js";

/** Stationernas aktiva elever – samma som demots motor (alla anslutna). */
function stationerUr(E) {
  const spelare = E.spelare();
  return E.session.participatingClassIds.map((classId) => ({
    classId, aktiva: spelare.filter((p) => p.classId === classId).length,
  }));
}

export function sessionUr(E) {
  const s = E.session;
  const slut = s.startedAt + (Number(s.countdownSeconds) || 0) * 1000 + s.durationSeconds * 1000;
  const result = E.result();
  const klar = !!result || E.now() >= slut;
  return {
    ...s, status: klar ? "finished" : "live", msStationer: stationerUr(E), showNames: true,
    createdBy: "demo-larare", ...(result ? { result } : {}),
  };
}

export function eventsUr(E) {
  const namn = new Map(E.spelare().map((p) => [p.uid, p.name]));
  return E.handlingar().map((h) => ({
    id: h.id, uid: h.uid, classId: h.classId, namn: namn.get(h.uid) || h.uid, t: h.t, typ: h.typ,
    nr: Number(String(h.id).split("_").pop()) || 0, ...(h.mal ? { mal: h.mal } : {}),
  }));
}

export function projektorDeps(E, { onLog = () => {} } = {}) {
  let cb = null;
  let lastKey = "";
  let antal = -1;
  const evCbs = new Set();

  function state() {
    const session = sessionUr(E);
    const t = E.now();
    const ph = phaseAt(session, t);
    const players = E.spelare().map((p) => ({ uid: p.uid, name: p.name, classId: p.classId, answerKey: null }));
    return {
      sessionId: session.id, session, status: session.status, phase: ph.phase, countdown: ph.countdown, msLeft: ph.msLeft,
      clock: formatClock(ph.msLeft), ...METEORSTORM.computeStandings(session, { players }), top: [],
      players, result: session.result || null, now: t,
    };
  }
  function emit(force) {
    if (!cb) return;
    const st = state();
    const key = JSON.stringify([st.status, st.phase, st.clock, st.players.length, !!st.result]);
    if (!force && key === lastKey) return;
    lastKey = key;
    cb(st);
  }
  function events(force) {
    const ev = eventsUr(E);
    if (!force && ev.length === antal) return;
    antal = ev.length;
    evCbs.forEach((f) => f(ev));
  }
  async function avsluta() {
    const redan = !!E.result();
    const result = E.avsluta();
    if (!redan) onLog("msAvsluta (demo) – resultatet räknat i minnet");
    events(true);
    emit(true);
    return { result, redan };
  }
  const ticker = setInterval(() => {
    E.tick();
    events(false);
    // Som skalet vid 00:00: kärnan avslutar och resultInputs = msAvsluta.
    if (sessionUr(E).status === "finished" && !E.result()) avsluta();
    emit(false);
  }, 250);

  const deps = {
    subscribe(_sid, fn) { cb = fn; lastKey = ""; emit(true); return () => { if (cb === fn) cb = null; }; },
    now: () => E.now(),
    async start() { onLog("STARTA (demo) – stormen går redan"); },
    finish: () => avsluta(),
    async remove() { onLog("radera (demo – ingenting raderas)"); },
    meteorstorm: {
      watchEvents(_s, f) { evCbs.add(f); setTimeout(() => f(eventsUr(E)), 150); return () => evCbs.delete(f); },
      avsluta,
    },
  };
  return { deps, stop() { clearInterval(ticker); evCbs.clear(); cb = null; } };
}
