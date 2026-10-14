// ============================================================================
// Kistspel 🎁 – ISOLERAT DEMOLÄGE (#651, utbrutet ur Guldrushens gr-demo.js
// #566). En hel match i minnet, byggd på Snilleblixtens demoramverk (#560:
// samma 30 påhittade elever med olika djur + kläder). Svar strömmar in (rätt
// + fel), rätt svar öppnar en kista med formatets RIKTIGA regler (temats
// regler – samma som servern), händelserna och ledningsbytet skrivs som
// servern skriver dem (nyast först) och ställningen/resultatet ur formatets
// computeStandings/buildResult. Projektorn monteras med `deps`
// (mountProjector) – inget Firestore-lager laddas, inga Cloud Functions
// anropas, inget skrivs (sessionen har demo:true, som live-rewards aldrig
// betalar för).
//
// API
//   createKistDemo(theme, { sid?, classes?, showNames?, stealSwap?, screen?,
//                  now?, auto?, onLog?, rng? }) → demo
//     theme = {
//       format, displayName     sessionens format-id och namn ("Guldrushen")
//       regler                  formatets createKistRegler
//       computeStandings(s, { players, grPlayers }), buildResult(s, [], players,
//                               null, { grPlayers, answers })
//       milestone(total)        temats delmål (ks-proj-scen)
//       chests: { fallback, shield, lead, treasure }  kistornas id för
//                               fallback, skydd, ledningsbyte (stor saldokista)
//                               och delmålet (vanlig saldokista)
//       dataKey                 deps-nyckeln vyerna läser ("guldrush" →
//                               deps.guldrush.watchGrPlayers/watchEvents)
//       logs: { allReached, reached(next, name) }
//     }
//   demo = { deps, session, emit, answer(uid, correct, chestId?), join(n, staggerMs),
//     playHistory(n), setAuto(on), auto, chest(id), shield({ ms? }), protectedList(),
//     leadChange(), treasure(), storm(), soonOut(sek), jumpToFinal(tie, n?),
//     toggleFreeze(), state(), onChange(f), snapshotState(), load(data), destroy(),
//     event(e)  skriv en färdig händelse (nyast först) + ledningsbyte – för ett
//               demo som avgjort utfallet själv (Datakuppens kopplade elevskärm, #655)
//     skip      Set<uid> – elever som den automatiska strömmen aldrig svarar för
//               och aldrig slumpar som offer (eleven som styrs från elevskärmen) }
//   (detaljer: src/live/formats/guldrush/gr-demo.js)
// ============================================================================

import { phaseAt, formatClock } from "../live-core.js";
import { DEMO_NAMES, demoMembers } from "../formats/snilleblixt/sb-demo.js";

export function createKistDemo(theme, {
  sid = `demo-${theme.format}`, classes = 1, showNames = true, stealSwap = true, screen = false,
  now: clock = Date.now, auto = false, onLog = () => {}, rng = Math.random,
} = {}) {
  const { format, displayName, regler, computeStandings, buildResult, milestone, chests: ids, dataKey, logs } = theme;
  const {
    rollChest, chestById, applySelfEffect, resolveVictim, eligibleVictims, isVictimKind,
    shieldUntil, hitProtectionUntil, protectedLeftMs,
  } = regler;
  const TWO = classes === 2;
  const cls = (i) => (TWO && i % 2 ? "5e" : "4b");
  const all = demoMembers();
  const members = { "4b": {}, "5e": {} };
  Object.entries(all).forEach(([uid, m], i) => { members[cls(i)][uid] = m; });
  let reads = 0;
  let offset = 0;
  let frozen = null;
  const now = () => frozen ?? clock() + offset;
  const session = {
    id: sid, name: TWO ? `${displayName} 4B + 5E (demo)` : `${displayName} 4B (demo)`, format,
    gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: TWO ? ["4b", "5e"] : ["4b"], classNames: { "4b": "4B", "5e": "5E" }, countdownSeconds: 4,
    durationSeconds: 600, stealSwap, showNames, status: "lobby", createdBy: "demo-larare", demo: true,
    rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
  };
  let players = [];
  const gp = new Map(); // uid → spelardokumentet (som servern skriver det)
  let events = []; // nyast först, som watchEvents
  let answers = [];
  let evN = 0;
  let aN = 0;
  let leader = null;
  let cb = null;
  let lastKey = "";
  let resultTimer = null;
  let autoTimer = null;
  const gpCbs = new Set();
  const evCbs = new Set();
  const listeners = new Set();
  const skip = new Set(); // styrs av någon annan (#655) – inget autosvar, inget slumpat offer

  const pick = (list) => list[Math.floor(rng() * list.length)];
  const byGold = () => [...gp.values()].sort((a, b) => b.gold - a.gold || a.uid.localeCompare(b.uid));
  const isLive = () => session.status === "live" && phaseAt(session, now()).phase === "live";

  function addPlayer(i, joinedAt = now()) {
    const uid = `e${i + 1}`;
    if (i >= DEMO_NAMES.length || players.some((p) => p.uid === uid)) return;
    players = [...players, { uid, name: DEMO_NAMES[i], classId: cls(i), correct: 0, incorrect: 0, joinedAt, lastSeenAt: now() }];
    gp.set(uid, { uid, name: DEMO_NAMES[i], classId: cls(i), gold: 0, correct: 0, incorrect: 0, chests: 0,
      protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null });
  }
  function ev(e) {
    events = [{ id: `ev${++evN}`, at: now(), ...e }, ...events].slice(0, 60);
  }
  /** Som serverns noteLeader: ensam etta med saldo, ny jämfört med förra. */
  function noteLeader() {
    const [a, b] = byGold();
    if (!a || !(a.gold > 0) || (b && b.gold === a.gold) || a.uid === leader) return;
    ev({ type: "lead", uid: a.uid, name: a.name, classId: a.classId, gold: a.gold, previousUid: leader });
    leader = a.uid;
  }

  /** Kistan öppnas – samma regler som servern (openChest + chooseVictim). */
  function openChest(uid, chestId = null, victimUid = null) {
    const g = gp.get(uid);
    if (!g) return null;
    let chest = chestId ? chestById(chestId) : rollChest(session.stealSwap, rng);
    g.chests++;
    const t = now();
    if (isVictimKind(chest)) {
      const kind = chest.effect.kind;
      const cands = eligibleVictims(kind, g, [...gp.values()], t);
      const free = cands.filter((c) => !skip.has(c.uid));
      const v = cands.find((c) => c.uid === victimUid) || (free.length ? pick(free) : null);
      if (!v) {
        const fb = chestById(chest.fallback) || chestById(ids.fallback);
        const eff = applySelfEffect(fb, g.gold);
        g.gold = eff.gold;
        ev({ type: "chest", chest: fb.id, fallbackFrom: chest.id, uid, name: g.name, classId: g.classId, amount: eff.delta, gold: eff.gold });
        noteLeader();
        return { result: "fallback", chest: fb.id };
      }
      const res = resolveVictim(kind, g, v);
      const who = { victimUid: v.uid, victimName: v.name, victimClassId: v.classId };
      const lastHit = { kind, byUid: uid, byName: g.name, amount: res.amount, at: t };
      g.lastVictimUid = v.uid;
      g.gold = res.thiefGold;
      Object.assign(v, { gold: res.victimGold, protectedUntil: hitProtectionUntil(v, t), lastHit });
      ev({ type: kind, chest: chest.id, uid, name: g.name, classId: g.classId, ...who, amount: res.amount, gold: res.thiefGold,
        victimGold: res.victimGold, auto: false });
      noteLeader();
      return { result: kind, chest: chest.id, victimUid: v.uid };
    }
    const eff = applySelfEffect(chest, g.gold);
    g.gold = eff.gold;
    if (eff.protect) g.protectedUntil = shieldUntil(t);
    ev({ type: "chest", chest: chest.id, uid, name: g.name, classId: g.classId, amount: eff.delta, gold: eff.gold });
    noteLeader();
    return { result: "chest", chest: chest.id };
  }

  /** Ett svar (multiplikation, skriv själv) – som serverns answers-dokument. */
  function answer(uid, correct, chestId = null, victimUid = null) {
    const p = players.find((x) => x.uid === uid);
    const g = gp.get(uid);
    if (!p || !g) return null;
    const a = 2 + Math.floor(rng() * 9);
    const b = Math.floor(rng() * 11);
    const ok = !!correct;
    const given = ok ? a * b : a * b + (rng() < 0.5 ? a : -b || 1);
    answers.push({ id: `a${++aN}`, uid, classId: p.classId, format, mode: "multiplication_0_10",
      factorA: a, factorB: b, answer: given, correctAnswer: a * b, isCorrect: ok, at: now() });
    g[ok ? "correct" : "incorrect"]++;
    p.lastAttemptId = `a${aN}`;
    const out = ok ? openChest(uid, chestId, victimUid) : null;
    emit(true);
    return out;
  }

  // --- Realtidsflödet (som live-feed.js, men i minnet) ---
  function compute() {
    const t = now();
    const ph = phaseAt(session, t);
    return {
      sessionId: sid, session: { ...session }, status: session.status, phase: ph.phase, countdown: ph.countdown,
      msLeft: ph.msLeft, clock: formatClock(ph.msLeft), ...computeStandings(session, { players }), top: [],
      players: players.map((p) => ({ ...p, answerKey: p.lastAttemptId || null })), result: session.result || null, now: t,
    };
  }
  function finishNow() {
    if (!["lobby", "live"].includes(session.status)) return;
    session.status = "finished";
    session.finishedAt = now();
    setAuto(false);
  }
  function emit(force) {
    const gpList = [...gp.values()].map((x) => ({ ...x }));
    gpCbs.forEach((f) => f(gpList, { fromCache: false }));
    evCbs.forEach((f) => f(events.slice(0, 30), { fromCache: false }));
    listeners.forEach((f) => f());
    if (!screen && session.status === "finished" && !session.result && !resultTimer) {
      // Som live-feed: result en gång efter slut – här i minnet, aldrig sparat.
      resultTimer = setTimeout(() => {
        session.result = buildResult(session, [], players, null, { grPlayers: [...gp.values()], answers });
        onLog("resultat räknat (bara i minnet)");
        emit(true);
      }, 1500);
    }
    if (!cb) return;
    const st = compute();
    const key = JSON.stringify([st.status, st.phase, st.countdown, players.length, !!st.result, players.map((p) => p.lastAttemptId)]);
    if (!force && key === lastKey) return;
    lastKey = key;
    cb(st);
  }
  const ticker = setInterval(() => {
    if (!screen && session.status === "live" && phaseAt(session, now()).phase === "ended") finishNow();
    emit(false);
  }, 250);

  function setAuto(on) {
    clearInterval(autoTimer);
    autoTimer = null;
    if (!on || screen) return;
    autoTimer = setInterval(() => {
      const list = players.filter((p) => !skip.has(p.uid));
      if (!isLive() || !list.length) return;
      answer(pick(list).uid, rng() < 0.75);
    }, 300);
  }

  function join(n = DEMO_NAMES.length, staggerMs = 140, joinedAt = null) {
    for (let i = 0; i < n; i++) {
      if (!staggerMs) addPlayer(i, joinedAt ?? now());
      else setTimeout(() => { addPlayer(i); emit(true); }, i * staggerMs);
    }
    emit(true);
  }

  /** Starta (utan nedräkning) om matchen inte pågår – triggers kräver live. */
  function ensureLive() {
    if (!players.length) join(DEMO_NAMES.length, 0, now() - 120_000);
    if (session.status === "lobby") {
      session.status = "live";
      session.startedAt = now() - (session.countdownSeconds + 60) * 1000;
    }
    return session.status === "live";
  }

  /** n svar direkt – en match som pågått en stund (ingen händelse spelas upp). */
  function playHistory(n) {
    ensureLive();
    for (let k = 0; k < n; k++) {
      const i = (k * 7 + Math.floor(k / players.length)) % players.length;
      answer(players[i].uid, (k * 5 + i) % 4 !== 0);
    }
    session.startedAt = Math.min(session.startedAt, now() - (session.countdownSeconds + 300) * 1000);
    events = [];
    emit(true);
  }

  /** Delad placering: ge eleven på plats `to` exakt samma guld som plats `from`. */
  function tie(from, to) {
    const r = byGold();
    const a = r[from - 1];
    const b = r[to - 1];
    if (a && b) b.gold = a.gold;
  }

  const deps = {
    subscribe(_sid, fn) { cb = fn; lastKey = ""; emit(true); return () => { if (cb === fn) cb = null; }; },
    now,
    async start() {
      await new Promise((r) => setTimeout(r, 200));
      if (session.status === "lobby") { session.status = "live"; session.startedAt = now(); }
      onLog("STARTA (demo)");
      emit(true);
    },
    async finish() { finishNow(); onLog("Avsluta (demo)"); emit(true); },
    async remove() { onLog("radera (demo – ingenting raderas)"); },
    async loadProjection(cid) { reads++; await new Promise((r) => setTimeout(r, 80)); return { members: { ...members[cid] } }; },
    [dataKey]: {
      watchGrPlayers(_s, f) { gpCbs.add(f); setTimeout(() => f([...gp.values()].map((x) => ({ ...x })), { fromCache: false }), 120); return () => gpCbs.delete(f); },
      watchEvents(_s, f) { evCbs.add(f); setTimeout(() => f(events.slice(0, 30), { fromCache: false }), 200); return () => evCbs.delete(f); },
    },
  };

  /** En spelare som kan öppna `id` med ett tydligt utfall (byte: någon med mindre saldo). */
  function opener(id) {
    const r = byGold().filter((g) => !skip.has(g.uid));
    const kind = chestById(id)?.effect?.kind;
    if (kind === "swap") return r.slice(Math.floor(r.length / 2)).find((g) => eligibleVictims("swap", g, r, now()).length) || r[r.length - 1];
    if (kind === "steal") return r.slice(3).find((g) => eligibleVictims("steal", g, r, now()).length) || r[r.length - 1];
    return pick(r);
  }

  return {
    deps,
    session,
    emit,
    answer,
    join,
    playHistory,
    setAuto(on) { auto = !!on; setAuto(auto); },
    get auto() { return auto; },
    chest(id) {
      if (!chestById(id)) return onLog(`okänd kista ${id}`);
      if (!ensureLive()) return onLog("matchen är slut");
      const g = opener(id);
      // Stöld: från den rikaste som går att välja – ett tydligt belopp i flödet.
      const v = chestById(id).effect.kind === "steal" ? eligibleVictims("steal", g, byGold(), now()).find((c) => !skip.has(c.uid))?.uid : null;
      const out = answer(g.uid, true, id, v);
      onLog(`${chestById(id).label} – ${g.name}: ${out?.result}${out?.victimUid ? ` → ${gp.get(out.victimUid).name}` : ""}`);
    },
    shield({ ms = null } = {}) {
      if (!ensureLive()) return onLog("matchen är slut");
      // En av de tre rikaste (syns vid guldhögarna) som inte redan är skyddad.
      const r = byGold();
      const g = r.slice(0, 3).find((x) => !protectedLeftMs(x, now())) || r[0];
      answer(g.uid, true, ids.shield);
      if (ms != null) { g.protectedUntil = now() + ms; emit(true); }
      onLog(`🛡️ ${g.name} är skyddad ${Math.round(protectedLeftMs(g, now()) / 1000)} s`);
      return g.uid;
    },
    protectedList: () => byGold().map((g) => ({ uid: g.uid, name: g.name, leftMs: protectedLeftMs(g, now()) })).filter((x) => x.leftMs > 0),
    leadChange() {
      if (!ensureLive()) return onLog("matchen är slut");
      const r = byGold();
      const lo = r[Math.min(4, r.length - 1)];
      if (!lo) return;
      // + ids.lead (Skattkammaren 100) = leder med 40
      lo.gold = Math.max(0, r[0].gold - (Number(chestById(ids.lead)?.effect?.amount) || 0) + 40);
      const out = answer(lo.uid, true, ids.lead);
      onLog(`⭐ ${lo.name} tar ledningen (${out?.result})`);
    },
    treasure() {
      if (!ensureLive()) return onLog("matchen är slut");
      const total = [...gp.values()].reduce((n, x) => n + (x.gold || 0), 0);
      const next = milestone(total).next;
      if (!next) return onLog(logs.allReached);
      // Tyst påfyllning så att nästa ids.treasure-kista (Guld +25) tar totalen över delmålet.
      const g = byGold()[Math.min(6, players.length - 1)];
      g.gold += Math.max(0, next - total - (Number(chestById(ids.treasure)?.effect?.amount) || 0));
      answer(g.uid, true, ids.treasure);
      onLog(logs.reached(next, g.name));
    },
    storm() {
      if (!ensureLive()) return onLog("matchen är slut");
      players.forEach((p) => answer(p.uid, true));
      onLog(`storm: ${players.length} kistor`);
    },
    soonOut(sek = 12) {
      if (!ensureLive()) return onLog("matchen är slut");
      session.startedAt = now() - (session.durationSeconds - sek + session.countdownSeconds) * 1000;
      emit(true);
    },
    jumpToFinal(tieKind = null, n = DEMO_NAMES.length) {
      if (!players.length) join(Math.max(1, Math.min(DEMO_NAMES.length, n)), 0, now() - 900_000);
      if (session.status === "lobby") playHistory(260);
      if (tieKind === "forsta") tie(1, 2);
      if (tieKind === "andra") tie(2, 3);
      finishNow();
      emit(true);
    },
    skip,
    event(e) { ev(e); noteLeader(); emit(true); },
    toggleFreeze() { frozen = frozen == null ? now() : null; return frozen != null; },
    state: () => ({ session, players, grPlayers: [...gp.values()], events, answers, reads }),
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** Elevskärmsfönstret (#533): ta över hela tillståndet från lärarfliken. */
    snapshotState: () => ({ session, players, gp: [...gp.values()], events, offset }),
    load(data) {
      for (const k of Object.keys(session)) delete session[k];
      Object.assign(session, data.session);
      ({ players, events, offset } = data);
      gp.clear();
      for (const g of data.gp) gp.set(g.uid, g);
      emit(true);
    },
    destroy() { clearInterval(ticker); setAuto(false); clearTimeout(resultTimer); },
  };
}
