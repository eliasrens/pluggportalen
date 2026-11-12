// ============================================================================
// Kurragömma 🙈 (#839, spec §11.4, LIVE-FORMAT §8): ISOLERAT DEMOLÄGE – en hel
// match i minnet för projektorn OCH elevskärmen: 30 påhittade elever (robotar,
// kg-demo-robotar.js) mot låtsasservern (kg-demo-server.js, de riktiga reglerna)
// över den lokala rörelsekanalen (kg-kanal.js skapaLokalBuss). Ingen Firestore,
// inga Cloud Functions, inga pluggmynt (sessionen är demo: true). Projektorn
// monteras med `deps` (mountProjector), elevskärmen (kge-elev-vy.js) med `api`
// – samma match, så det eleven gör syns på projektorn. Sidorna:
// preview/preview-kurragomma-demo.html (projektorn), -elev.html (elevskärmen),
// -demolage.html (båda sida vid sida).
//
//   createKgDemo({ sid?, antal = 30, me?, gomtid = 30, minuter = 8, seed = 839, quiz?,
//                  answerKind?, latens?, roster?, screen?, now?, onLog?, jagSokare? }) → demo
//     demo.session      sessionsdokumentet (muteras av låtsasservern)
//     demo.deps         mountProjector-deps: subscribe, now, start, finish, remove,
//                       kurragomma: { kanal, starta, tick, roster }
//     demo.api          elevskärmens api: anslut, las, svara, leta, avsluta, getQuestions, watchMe, kanal
//     demo.st()         live-feed-liknande tillstånd (elevsidan: stage.update(st, player))
//     demo.join(n, staggerMs)   n elever ansluter (lobbyn) · demo.start(sekIn?) KÖR!
//     demo.hoppa(ms) · gaTill(sek) · soonOut(sek) · jumpToFinal()   klockan (robotarna spelar ikapp)
//     demo.tystnad() · sokareBorta(v) · allaHittade() · hittad(uid?) · vissling() · sokning()   demoknapparna (§11.4)
//     demo.setAuto(on) · toggleFreeze() · state() · destroy()
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import { DEMO_NAMES } from "../snilleblixt/sb-demo.js";
import { skapaPrng } from "./delat/kg-prng.js";
import { TICK_MS } from "./delat/kg-config.js";
import { skapaLokalBuss } from "./kg-kanal.js";
import { skapaKgServer } from "./kg-demo-server.js";
import { skapaDemoRobotar } from "./kg-demo-robotar.js";
import { computeStandings } from "./kg-setup.js";
import { hamtaKarta } from "./delat/kg-karta.js";

const KLASS = "4b";
const STEG_MS = 250;

export function createKgDemo({
  sid = "demo-kurragomma", antal = 30, me = { uid: "jag", name: "Jag", classId: KLASS }, gomtid = 30, minuter = 8, seed = 839,
  quiz = null, answerKind = "free", latens = () => 0, roster = null, screen = false, now: klocka = Date.now, onLog = () => {}, jagSokare = false,
} = {}) {
  let hopp = 0;
  let frys = null;
  const now = () => frys ?? klocka() + hopp;
  const session = {
    id: sid, name: "Kurragömma 4B (demo)", format: "kurragomma", gameMode: quiz ? "plugga_quiz" : "multiplication_0_10",
    answerKind: quiz ? "choice" : answerKind, participatingClassIds: [KLASS], classNames: { [KLASS]: "4B" },
    countdownSeconds: 4, durationSeconds: gomtid + minuter * 60, status: "lobby", createdBy: "demo-larare", demo: true, showNames: true,
    kgInstallningar: { gomtid, startsokare: "auto", tystnad: true, karta: "on" }, rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
    ...(quiz ? { questionCount: quiz.length } : {}),
  };
  const prng = skapaPrng(seed, "demo");
  const buss = skapaLokalBuss({ nu: now });
  const server = skapaKgServer({ session, buss, now, rng: prng.tal, quiz, latens, tvingaSokare: jagSokare ? [me.uid] : [] });
  const karta = hamtaKarta("on");
  const alla = [me, ...DEMO_NAMES.slice(0, Math.max(0, antal - 1)).map((name, i) => ({ uid: `e${i + 1}`, name, classId: KLASS }))];
  const robotar = skapaDemoRobotar({ server, buss, uids: alla.slice(1).map((p) => p.uid), rng: prng.tal, karta, now });
  let players = [];
  let cb = null;
  let lastKey = "";
  let sistTick = 0;
  let tickar = false;

  function addPlayer(i, joinedAt = now()) {
    const p = alla[i];
    if (!p || players.some((q) => q.uid === p.uid)) return;
    server.laggTill(p);
    players = [...players, { ...p, correct: 0, incorrect: 0, joinedAt, lastSeenAt: joinedAt }];
  }
  function join(n = alla.length, staggerMs = 140, joinedAt = null) {
    for (let i = 0; i < Math.min(n, alla.length); i++) {
      if (!staggerMs) addPlayer(i, joinedAt ?? now());
      else setTimeout(() => { addPlayer(i); emit(true); }, i * staggerMs);
    }
    emit(true);
  }

  // --- tillståndet (som live-feed) ------------------------------------------------------
  function st() {
    const t = now();
    const ph = phaseAt(session, t);
    return {
      sessionId: sid, session: { ...session }, status: session.status, phase: ph.phase, countdown: ph.countdown, msLeft: ph.msLeft,
      clock: formatClock(ph.msLeft), ...computeStandings(session, { players }), top: [],
      players: players.map((p) => ({ ...p, answerKey: null })), result: session.result || null, now: t,
    };
  }
  function emit(force) {
    if (!cb) return;
    const s = st();
    const key = JSON.stringify([s.status, s.phase, s.countdown, s.clock, players.length, !!s.result, session.kgFas]);
    if (!force && key === lastKey) return;
    lastKey = key;
    cb(s);
  }

  // --- klockan: robotarna stegas, servern tickar var TICK_MS ---------------------------
  async function tick() {
    if (tickar || session.status !== "live") return null;
    tickar = true;
    try { return await server.tick(); } catch (e) { onLog(`kgTick (demo): ${e?.message || e}`); return null; } finally { tickar = false; }
  }
  function steg() {
    const t = now();
    robotar.steg(t);
    if (session.status === "live" && session.kgFas == null && t >= tider().t0) { try { server.starta().catch(() => null); } catch { /* lat start */ } }
    if (session.status === "live" && t - sistTick >= TICK_MS) { sistTick = t; tick(); }
  }
  const tider = () => {
    const t0 = session.startedAt + (Number(session.countdownSeconds) || 0) * 1000;
    return { t0, slut: t0 + session.durationSeconds * 1000 };
  };
  const ticker = setInterval(() => {
    if (!screen && frys == null) steg();
    emit(false);
  }, STEG_MS);
  const flush = () => new Promise((r) => setTimeout(r, 0));
  /** Spola fram klockan till T: robotarna spelar ikapp i steg om STEG_MS. */
  async function framTill(T) {
    frys = null;
    let n = 0;
    while (now() < T) {
      hopp += Math.min(STEG_MS, T - now());
      steg();
      if (++n % 8 === 0) await flush();
    }
    await flush();
    await flush();
    emit(true);
  }

  async function start(sekIn = 0) {
    if (!players.length) join(alla.length, 0, now() - 120_000);
    if (session.status === "lobby") {
      session.status = "live";
      session.startedAt = now() - (sekIn > 0 ? (session.countdownSeconds + sekIn) * 1000 : 0);
      onLog(sekIn > 0 ? `matchen har pågått ${sekIn} s (demo)` : "STARTA (demo)");
    }
    if (sekIn > 0) { await server.starta(); await framTill(now()); }
    emit(true);
  }

  // --- det projektorn och elevskärmen får --------------------------------------------------
  const kanal = ({ uid }) => buss.kanalFor(uid);
  const deps = {
    subscribe(_sid, fn) { cb = fn; lastKey = ""; emit(true); return () => { if (cb === fn) cb = null; }; },
    now,
    async start() { await new Promise((r) => setTimeout(r, 200)); await start(0); },
    finish: async () => { const r = await server.avsluta(); onLog("kgAvsluta (demo) – resultatet räknat i minnet"); emit(true); return r; },
    async remove() { onLog("radera (demo – ingenting raderas)"); },
    kurragomma: { kanal, starta: async () => server.starta(), tick: () => tick(), roster },
  };
  const api = {
    anslut: () => server.anslut(me.uid),
    las: (_s, p) => server.las(me.uid, p),
    svara: (_s, payload) => server.svara(me.uid, payload),
    leta: (_s, p) => server.leta(me.uid, p),
    avsluta: () => deps.finish(),
    getQuestions: () => server.getQuestions(),
    watchMe: (_s, uid, cb2) => server.watchMe(uid, cb2),
    kanal,
  };

  return {
    session, deps, api, st, join, start, now, server, robotar, buss, me,
    hoppa: (ms) => framTill(now() + ms),
    async gaTill(sek) { await start(0); await framTill(tider().t0 + sek * 1000); },
    async soonOut(sek = 20) { await start(0); await framTill(tider().slut - sek * 1000); },
    async jumpToFinal() { await start(0); await framTill(tider().slut + 500); await tick(); emit(true); },
    async tystnad() { const uid = server.tystnadNu(); const r = await tick(); onLog(uid ? `tystnadsregeln: ${uid} visslar (${r?.visslade ?? 0})` : "ingen gömd kvar"); return uid; },
    async sokareBorta(v = true) { robotar.borta(v); if (v) { const r = await tick(); onLog(r?.nySokare ? `ny sökare: ${r.nySokare}` : "sökarna borta – nästa tick drar en ny sökare"); } },
    async allaHittade() {
      const sokare = robotar.lista().find((r) => r.roll === "sokare")?.uid || me.uid; // en robot-sökare (jag kan vara gömd)
      const h = server.hittaNu(null, sokare);
      await tick(); onLog(`alla hittade (${h.length})`); emit(true); return h;
    },
    /** En robot-sökare hittar "jag" (eller en gömd robot) nu. */
    async hittad(uid = me.uid) { const h = server.hittaNu([uid]); onLog(h.length ? `${h[0].namn || uid} hittad` : "ingen att hitta"); return h; },
    /** En gömd robot svarar fel → vissling; en robot-sökare letar där den står. */
    vissling: () => { const [g] = robotar.gomda(); return g ? robotar.svara(g, false) : Promise.resolve(null); },
    sokning: () => { const r = robotar.lista().find((x) => x.roll === "sokare"); return r ? robotar.leta(r.uid) : Promise.resolve(null); },
    setAuto(on) { robotar.pa(on); },
    get auto() { return robotar.arPa; },
    toggleFreeze() { frys = frys == null ? now() : null; return frys != null; },
    state: () => ({ session, players, ...server.state(), robotar: robotar.lista() }),
    destroy() { clearInterval(ticker); cb = null; },
  };
}
