// ============================================================================
// Meteorstormen – ISOLERAT DEMOLÄGE för projektorn (#822, LIVE-FORMAT §8, spec
// §8). En hel match i minnet: 1 eller 2 påhittade klasser (Snilleblixtens 30
// demoelever) som svarar i olika takt och olika bra, energin räknas som på
// servern (energiEffekt: Solstorm ×2, Kometsvans +1, tak 5) och varje rätt svar
// blir en händelse i loggen med samma form som msEvents (id {uid}_{nr}, t, typ,
// namn – och ibland en "fel"-länk som projektorn ska hoppa över). Stormen,
// stationerna och slutet räknas av den RIKTIGA motorn; slutresultatet byggs i
// samma form som serverns msAvsluta-result (perClass med bästa ögonblicken).
// Projektorn monteras med `deps` (mountProjector) – inget Firestore-lager
// laddas, inga Cloud Functions anropas, inget skrivs (demo: true).
// Elevdelen av demot gör D (#823). Sidan: preview/preview-meteorstorm-demo.html.
//
// API
//   createMsDemo({ sid?, klasser = 2, attacker = "milda", minuter = 10, seed = 819,
//                  ratt = [0.75, 0.6], screen?, now?, onLog? }) → demo
//     demo.deps          mountProjector-deps (subscribe, now, start, finish, remove,
//                        meteorstorm: { watchEvents, avsluta })
//     demo.join(n, staggerMs)  n elever ansluter (lobbyn)
//     demo.setAuto(on)   eleverna svarar i realtid
//     demo.gaTill(sekunder)    matchen har pågått så länge (historiken räknas fram)
//     demo.soonOut(sek)  sek sekunder kvar
//     demo.nastaHandelse(typ?) hoppa till strax före nästa händelse (banderollen)
//     demo.kasta(i)      klass i slungar en meteor nu (dragstrålen)
//     demo.jumpToFinal() hoppa till slutet → msAvsluta-resultatet
//     demo.toggleFreeze() tiden står still (skärmdumpar)
//     demo.state()       { session, players, events }
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import { DEMO_NAMES } from "../snilleblixt/sb-demo.js";
import { skapaPrng } from "./delat/ms-prng.js";
import { simulera } from "./delat/ms-motor.js";
import { energiEffekt, stormPlan } from "./delat/ms-agera.js";
import { ATTACKER, ENERGI_TAK, DRAG_STOPP_FORE_SLUT_MS, RENDER_FORDROJNING_MS } from "./delat/ms-balans.js";
import { motorIndata, handlingarUr } from "./msp-scen.js";
import METEORSTORM from "./index.js";

const KLASSER = ["4b", "4d"];
const NAMN = { "4b": "4B", "4d": "4D" };

export function createMsDemo({
  sid = "demo-meteorstorm", klasser = 2, attacker = "milda", minuter = 10, seed = 819,
  ratt = [0.75, 0.6], screen = false, now: klocka = Date.now, onLog = () => {},
} = {}) {
  const ids = KLASSER.slice(0, klasser === 1 ? 1 : 2);
  const kmk = ids.length > 1;
  let frys = null;
  const now = () => frys ?? klocka();
  const session = {
    id: sid, name: kmk ? "Meteorstormen 4B mot 4D (demo)" : "Meteorstormen 4B (demo)", format: "meteorstorm",
    gameMode: "multiplication_0_10", answerKind: "free", participatingClassIds: ids, classNames: { ...NAMN },
    countdownSeconds: 4, durationSeconds: minuter * 60, status: "lobby", createdBy: "demo-larare", demo: true,
    showNames: true, msSeed: seed, msInstallningar: { lage: kmk ? "klass-mot-klass" : "en-klass", attacker: kmk ? attacker : "av" },
    rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
  };
  let players = [];
  let events = [];
  let cb = null;
  let lastKey = "";
  let auto = false;
  const evCbs = new Set();
  let resultTimer = 0;

  const cls = (i) => ids[i % ids.length];
  function addPlayer(i, joinedAt = now()) {
    const uid = `e${i + 1}`;
    if (i >= DEMO_NAMES.length || players.some((p) => p.uid === uid)) return;
    players = [...players, { uid, name: DEMO_NAMES[i], classId: cls(i), correct: 0, incorrect: 0, joinedAt, lastSeenAt: now() }];
  }

  // --- eleverna: en deterministisk ström ur fröet ------------------------------------
  let gen = null;
  function nyGen() {
    const rng = skapaPrng(seed, "demo");
    const cfg = motorIndata(session);
    const elev = new Map(players.map((p) => [p.uid, { nasta: cfg.startMs + rng.mellan(500, 8000), energi: 0, nr: 0, fel: 0 }]));
    return { rng, cfg, elev, senastDrag: new Map(), T: cfg.startMs };
  }
  /** Räkna fram svaren fram till T (i tidsordning). */
  function framTill(T) {
    if (session.status !== "live" || session.startedAt == null) return;
    if (!gen) gen = nyGen();
    const { rng, cfg, elev, senastDrag } = gen;
    const slut = cfg.startMs + cfg.varaktighetMs;
    const att = ATTACKER[cfg.installningar.attacker] || ATTACKER.av;
    const nya = [];
    for (;;) {
      let p = null;
      for (const q of players) if (elev.has(q.uid) && (!p || elev.get(q.uid).nasta < elev.get(p.uid).nasta)) p = q;
      if (!p) break;
      const e = elev.get(p.uid);
      const t = Math.round(e.nasta);
      if (t > T || t >= slut) break;
      e.nasta += rng.mellan(6000, 10000);
      const k = ids.indexOf(p.classId);
      if (rng.tal() >= (ratt[k] ?? 0.6)) {
        if (++e.fel >= 25) { e.fel = 0; nya.push({ id: `${p.uid}_${++e.nr}`, uid: p.uid, classId: p.classId, namn: p.name, t, typ: "fel", nr: e.nr, energi: e.energi }); }
        continue;
      }
      e.energi = Math.min(ENERGI_TAK, e.energi + energiEffekt(cfg, t).energi);
      const kanDra = kmk && att.drag && t - (senastDrag.get(p.classId) ?? -Infinity) > att.vantetidMs + 4000 && t < slut - DRAG_STOPP_FORE_SLUT_MS - 200;
      let typ = rng.tal() < (k === 0 ? 0.55 : 0.45) ? "laser" : "skold";
      if (kanDra && e.energi >= att.kostnad && rng.tal() < 0.35) { typ = "drag"; e.energi -= att.kostnad; senastDrag.set(p.classId, t); }
      else e.energi -= 1;
      nya.push({ id: `${p.uid}_${++e.nr}`, uid: p.uid, classId: p.classId, namn: p.name, t, typ, nr: e.nr, energi: e.energi });
      p.correct++;
    }
    gen.T = T;
    if (!nya.length) return;
    if (!session.msStationer) {
      session.msStationer = ids.map((classId) => ({ classId, aktiva: Math.max(1, players.filter((q) => q.classId === classId).length) }));
    }
    events = [...events, ...nya];
    evCbs.forEach((f) => f(events.slice()));
  }
  function omStart() {
    gen = null;
    events = [];
    delete session.msStationer;
    framTill(now());
    evCbs.forEach((f) => f(events.slice()));
  }

  // --- slutet: samma form som msAvsluta ----------------------------------------------
  function resultat() {
    const cfg = motorIndata(session);
    const f = session.finishedAt;
    const slut = f != null && f < cfg.startMs + cfg.varaktighetMs ? Math.max(cfg.startMs, f) : cfg.startMs + cfg.varaktighetMs;
    const handlingar = handlingarUr(events).filter((h) => h.t <= slut);
    const s = simulera({ ...cfg, handlingar }, slut);
    const res = s.resultat || simulera({ ...cfg, handlingar }, cfg.startMs + cfg.varaktighetMs).resultat;
    const placering = s.stationer
      .map((st) => ({ classId: st.classId, skrov: st.skrov, nedskjutna: st.nedskjutna }))
      .sort((a, b) => b.skrov - a.skrov || b.nedskjutna - a.nedskjutna)
      .map((p, i, l) => ({ ...p, plats: i && l[i - 1].skrov === p.skrov && l[i - 1].nedskjutna === p.nedskjutna ? i : i + 1 }));
    const namn = (uid) => players.find((p) => p.uid === uid)?.name || uid;
    const perClass = {};
    s.stationer.forEach((st) => {
      const uids = players.filter((p) => p.classId === st.classId).map((p) => p.uid);
      const bast = (k) => uids.map((u) => [u, s.bidrag[u]?.[k] || 0]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      const ogonblick = [];
      const ned = bast("nedskjutna");
      if (ned?.[1]) ogonblick.push({ typ: "nedskjutna", uid: ned[0], namn: namn(ned[0]), antal: ned[1] });
      const sista = st.skrov > 0 && handlingar.filter((h) => h.classId === st.classId && (h.typ === "skold" || h.typ === "laser") && h.t >= slut - 30_000).pop();
      if (sista) ogonblick.push({ typ: "sista", uid: sista.uid, namn: namn(sista.uid), t: sista.t });
      const sk = bast("skold");
      if (sk?.[1]) ogonblick.push({ typ: "skold", uid: sk[0], namn: namn(sk[0]), antal: sk[1] });
      const ka = bast("kast");
      if (ka?.[1]) ogonblick.push({ typ: "kast", uid: ka[0], namn: namn(ka[0]), antal: ka[1] });
      perClass[st.classId] = { name: NAMN[st.classId], players: uids.length, aktiva: st.aktiva, skrov: st.skrov, skold: st.skold,
        nedskjutna: st.nedskjutna, traffar: st.traffar, kastade: st.kastade, ogonblick };
    });
    const enKlass = !kmk;
    const vinnare = enKlass || (placering[1] && placering[1].plats === 1) ? null : placering[0].classId;
    return {
      format: "meteorstorm", lage: enKlass ? "en-klass" : "klass-mot-klass", winner: vinnare, draw: !enKlass && !vinnare,
      placering, ...(enKlass ? { stjarnor: res?.stjarnor ?? 0, overlevde: placering[0].skrov > 0 } : {}),
      startMs: cfg.startMs, slutMs: slut, perClass, demo: true, computedAt: { seconds: Math.floor(now() / 1000) },
    };
  }
  async function avsluta() {
    if (session.result) return { result: session.result, redan: true };
    if (session.status === "lobby") throw new Error("Stormen har inte startat.");
    if (session.status !== "finished") { session.status = "finished"; session.finishedAt = now(); }
    framTill(Math.min(now(), session.finishedAt));
    await new Promise((r) => setTimeout(r, 600));
    session.result = resultat();
    onLog("msAvsluta (demo) – resultatet räknat i minnet");
    emit(true);
    return { result: session.result, redan: false };
  }

  // --- tillståndet till projektorskalet (som live-feed) ---------------------------------
  function compute() {
    const t = now();
    const ph = phaseAt(session, t);
    return {
      sessionId: sid, session, status: session.status, phase: ph.phase, countdown: ph.countdown, msLeft: ph.msLeft,
      clock: formatClock(ph.msLeft), ...METEORSTORM.computeStandings(session, { players }), top: [],
      players: players.map((p) => ({ ...p, answerKey: null })), result: session.result || null, now: t,
    };
  }
  function emit(force) {
    if (!cb) return;
    const st = compute();
    const key = JSON.stringify([st.status, st.phase, st.countdown, st.clock, players.length, !!st.result, !!session.msStationer]);
    if (!force && key === lastKey) return;
    lastKey = key;
    cb({ ...st, session: { ...session } });
  }
  const ticker = setInterval(() => {
    if (screen) return emit(false);
    if (auto) framTill(now());
    if (session.status === "live" && phaseAt(session, now()).phase === "ended") {
      session.status = "finished";
      session.finishedAt = now();
      onLog("00:00 – stormen är över");
    }
    if (session.status === "finished" && session.startedAt != null && !session.result && !resultTimer) {
      resultTimer = setTimeout(() => { avsluta(); }, 1500);
    }
    emit(false);
  }, 250);

  function startaOm(sekunderIn) {
    if (!players.length) join(DEMO_NAMES.length, 0, now() - 120_000);
    session.status = "live";
    session.startedAt = now() - (session.countdownSeconds + sekunderIn) * 1000;
    delete session.finishedAt;
    delete session.result;
    clearTimeout(resultTimer);
    resultTimer = 0;
    omStart();
    emit(true);
  }

  function join(n = DEMO_NAMES.length, staggerMs = 140, joinedAt = null) {
    for (let i = 0; i < n; i++) {
      if (!staggerMs) addPlayer(i, joinedAt ?? now());
      else setTimeout(() => { addPlayer(i); emit(true); }, i * staggerMs);
    }
    emit(true);
  }

  const deps = {
    subscribe(_sid, fn) { cb = fn; lastKey = ""; emit(true); return () => { if (cb === fn) cb = null; }; },
    now,
    async start() {
      await new Promise((r) => setTimeout(r, 200));
      if (session.status === "lobby") { session.status = "live"; session.startedAt = now(); omStart(); }
      onLog("STARTA (demo)");
      emit(true);
    },
    finish: () => avsluta(),
    async remove() { onLog("radera (demo – ingenting raderas)"); },
    meteorstorm: {
      watchEvents(_s, f) { evCbs.add(f); setTimeout(() => f(events.slice()), 150); return () => evCbs.delete(f); },
      avsluta: () => avsluta(),
    },
  };

  return {
    deps,
    session,
    join,
    setAuto(on) { auto = !!on; if (auto) framTill(now()); },
    get auto() { return auto; },
    gaTill(sek) { startaOm(sek); auto = true; },
    soonOut(sek = 15) { startaOm(session.durationSeconds - sek); auto = true; },
    nastaHandelse(typ = null) {
      const plan = stormPlan(motorIndata(session));
      const forbi = session.startedAt == null ? 0 : (now() - RENDER_FORDROJNING_MS - motorIndata(session).startMs);
      const h = plan.handelser.find((x) => (!typ || x.typ === typ) && x.startMs > forbi + 3000) || plan.handelser.find((x) => !typ || x.typ === typ);
      if (!h) return onLog("ingen sådan händelse i den här stormen");
      startaOm(h.startMs / 1000 - 2.5 + RENDER_FORDROJNING_MS / 1000);
      auto = true;
      onLog(`hoppar till ${h.typ} (${Math.round(h.startMs / 1000)} s)`);
    },
    kasta(i = 0) {
      if (session.status !== "live") startaOm(90);
      const p = players.find((q) => q.classId === ids[i]);
      if (!p || !kmk) return onLog("ingen dragstråle i En klass");
      framTill(now());
      const t = now();
      events = [...events, { id: `${p.uid}_k${t}`, uid: p.uid, classId: p.classId, namn: p.name, t, typ: "drag", nr: 0, energi: 0 }];
      evCbs.forEach((f) => f(events.slice()));
      onLog(`🌀 ${NAMN[ids[i]]} slungar en meteor (syns om ${RENDER_FORDROJNING_MS / 1000} s)`);
    },
    jumpToFinal() {
      startaOm(session.durationSeconds + 3);
      framTill(now());
      session.status = "finished";
      session.finishedAt = now();
      avsluta();
    },
    toggleFreeze() { frys = frys == null ? klocka() : null; return frys != null; },
    state: () => ({ session, players, events }),
    destroy() { clearInterval(ticker); clearTimeout(resultTimer); evCbs.clear(); },
  };
}
