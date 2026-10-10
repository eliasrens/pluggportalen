// ============================================================================
// Snilleblixten – ISOLERAT DEMOLÄGE (#560, funktionsspec §7.7, designspec §13).
// En hel match i minnet: 30 påhittade elever (olika djur + kläder), svar som
// strömmar in, lärarens övergångar med formatets RIKTIGA planer (planStep →
// scoreQuestion) och ställningen ur computeStandings/buildResult. Projektorn
// monteras med `deps` (mountProjector) – inget Firestore-lager laddas, inget
// skrivs: inga sessioner, resultat eller pluggmynt (sessionen har dessutom
// demo:true, som live-rewards aldrig betalar för). Sidan:
// preview-snilleblixt-demo.html. Testas i test/live-snilleblixt-demo.test.js.
//
// API
//   DEMO_NAMES / demoMembers()      30 elever → klassprojektionens members
//   demoOutfit(i)                   elev i:s kläder (unika kombinationer)
//   demoSnapshot(kind)              10 multiplikationsfrågor (fråga 1 = 7 × 8)
//   createSbDemo({ kind, sid, screen?, now?, auto?, onLog? }) → demo
//     demo.deps                     mountProjector-deps (subscribe, now, start,
//                                   finish, remove, loadProjection, snilleblixt)
//     demo.join(n, staggerMs)       n elever ansluter (lobbyn)
//     demo.setAuto(on)              svar strömmar in vid varje ny fråga
//     demo.allAnswer(p)             alla svarar nu (rätt med sannolikhet p)
//     demo.test7b()                 skriv själv: 5 × "54", 3 × "64", resten rätt
//     demo.revealNow()              stäng frågan → trumvirvel → avslöjande
//     demo.soonOut(sek)             frågan har sek sekunder kvar
//     demo.playQuestions(k)         spela k frågor direkt (mellanbild/final)
//     demo.jumpToFinal(tie)         hoppa till pallplatsen; tie null | "forsta"
//                                   (oavgjort om 1:a) | "andra" (delad 2:a)
//     demo.toggleFreeze()           serverns tid står still (skärmdumpar)
//     demo.state()                  { session, players, answers, scores }
//   forceReducedMotion(on)          webbläsarens "reducerad rörelse" på/av
//                                   (matchMedia + @media-regler) – bara demot
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import { planStep } from "./snilleblixt-flode.js";
import { computeStandings, buildResult } from "./snilleblixt-poang.js";

export const DEMO_NAMES = ["Alma", "Omar", "Ines", "Leo", "Clara", "Sam", "Ella", "Noah", "Maja", "Elias", "Wilma", "Adam", "Saga",
  "Hugo", "Freja", "Liam", "Alva", "Ali", "Signe", "Vera", "Otto", "Nora", "Ebbe", "Selma", "Malte", "Tove", "Isak", "Lova", "Arvid", "Juni"];
const DJUR = ["fox", "owl", "cat", "dog", "panda", "frog", "unicorn", "dragon", "lion", "penguin", "koala", "robot", "bjorn",
  "tiger", "rabbit", "pig", "cow", "monkey", "hamster", "mouse", "chick", "sheep", "hedgehog", "wolf", "deer", "raccoon",
  "turtle", "bee", "elephant", "goat"];
const HATT = ["trollkarlshatt", "krona", "keps", "cowboyhatt", "partyhatt", "vikinghjalm", "tomtemossa", "strahatt",
  "kockmossa", "riddarhjalm", "vintermossa", "djuroron", "", "keps"];
const ANSIKTE = ["", "glasogon", "mustasch", "monokel", "pilotglasogon", "ogonlapp", "hjartglasogon", "", "glad-mask"];
const HALS = ["medalj", "", "halsduk", "fluga", "slips", "parlhalsband", "", "amulett", "fjaderboa"];
const HAND = ["svard", "ballong", "trollstav", "blomma", "glasstrut", "bok", "", "paraply", "gitarr", "fiskespo", "godisklubba", "", "ballong"];

/** Elev i:s kläder – (hatt, hand) ger 30 olika kombinationer, några med cape. */
export function demoOutfit(i) {
  const items = [HATT[i % HATT.length], ANSIKTE[(i * 5) % ANSIKTE.length], HALS[(i * 7) % HALS.length], HAND[i % HAND.length]];
  if (i % 4 === 0) items.push("cape");
  return items.filter(Boolean);
}

export function demoMembers() {
  const members = {};
  DEMO_NAMES.forEach((n, i) => { members[`e${i + 1}`] = { namn: n, avatarId: DJUR[i], avatarItems: demoOutfit(i), husLast: i === 5 }; });
  return members;
}

const PAR = [[7, 8], [6, 7], [9, 4], [8, 8], [3, 9], [7, 7], [6, 9], [4, 8], [9, 9], [5, 7]];

/** Ögonblicksbilden (som sbPrivate/snapshot) – statKeys som multiplikationsläget. */
export function demoSnapshot(kind) {
  const snapshot = { questions: [], facit: [] };
  PAR.forEach(([a, b], i) => {
    const pub = { key: `${i}:${a}x${b}`, text: `${a} × ${b}`, statKeys: [...new Set([`t${a}`, `t${b}`])] };
    const ans = a * b;
    const f = { correctAnswer: String(ans) };
    if (kind === "choice") {
      const opts = [ans, ans + b, ans - a, ans + 10].map(String);
      const order = [0, 1, 2, 3].sort((x, y) => ((x * 7 + i * 3) % 4) - ((y * 7 + i * 3) % 4));
      pub.options = order.map((k) => opts[k]);
      f.answerIndex = order.indexOf(0);
    }
    snapshot.questions.push(pub);
    snapshot.facit.push(f);
  });
  return snapshot;
}

export function createSbDemo({ kind = "choice", sid = "demo-snilleblixt", screen = false, now: clock = Date.now, auto = true, onLog = () => {}, rng = Math.random } = {}) {
  const KIND = kind === "free" ? "free" : "choice";
  const snapshot = demoSnapshot(KIND);
  const members = demoMembers();
  let reads = 0;
  let offset = 0;
  let frozen = null;
  const now = () => frozen ?? clock() + offset;
  const fv = { serverTimestamp: () => now() };
  const session = {
    id: sid, name: "Snilleblixten 4B (demo)", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: KIND,
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, countdownSeconds: 4,
    questionSeconds: KIND === "free" ? 20 : 10, questionCount: snapshot.questions.length, shuffleQuestions: true,
    showQuestionOnStudent: true, status: "lobby", createdBy: "demo-larare", demo: true,
    rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
  };
  let players = [];
  let answers = [];
  let scores = [];
  let timers = [];
  let plan = null; // nästa frågas styrda svar (t.ex. test 7b)
  let cb = null;
  let lastKey = "";
  let resultTimer = null;
  const scoreCbs = new Set();
  const ansCbs = new Set();
  const listeners = new Set();

  function addPlayer(i, joinedAt = now()) {
    if (i >= DEMO_NAMES.length || players.some((p) => p.uid === `e${i + 1}`)) return;
    players = [...players, { uid: `e${i + 1}`, name: DEMO_NAMES[i], classId: "4b", correct: 0, incorrect: 0, joinedAt, lastSeenAt: now() }];
  }
  function applyPatch(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (k.startsWith("q.")) session.q = { ...session.q, [k.slice(2)]: v };
      else session[k] = v;
    }
  }
  function step(action, fromIndex) {
    if (screen) return { done: false };
    const p = planStep(session, action, { fromIndex, snapshot, answers: answers.filter((a) => a.q === fromIndex), fv });
    if (p.noop) return { done: false, reason: p.noop };
    applyPatch(p.patch);
    if (p.scores) scores = [...scores.filter((s) => s.index !== p.scores.index), p.scores].sort((a, b) => a.index - b.index);
    if (action === "open") scheduleAnswers();
    onLog(`${action} ${action === "open" ? fromIndex + 2 : fromIndex + 1}`);
    emit(true);
    return { done: true };
  }

  /** Ett svar på pågående fråga. Fel i skriv själv = vanliga felsvar. */
  function answer(uid, { correct, choice, text, at } = {}) {
    if (session.q?.phase !== "open" || answers.some((a) => a.q === session.q.index && a.uid === uid)) return;
    const f = snapshot.facit[session.q.index];
    const a = { uid, classId: "4b", q: session.q.index, answerKind: KIND, at: at ?? now() };
    if (KIND === "choice") a.choiceIndex = choice ?? (correct ? f.answerIndex : (f.answerIndex + 1 + (uid.length % 3)) % 4);
    else a.answer = text ?? (correct ? f.correctAnswer : String(Number(f.correctAnswer) + (uid.charCodeAt(1) % 2 ? -2 : 8)));
    answers.push(a);
    emit(true);
  }
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const standings = () => computeStandings(session, { scores, players });

  function scheduleAnswers() {
    clearTimers();
    const p = plan;
    plan = null;
    if (p) return p();
    if (!auto) return;
    const total = session.questionSeconds * 1000;
    for (const pl of players) {
      if (rng() < 0.08) continue; // några hinner inte
      later(() => answer(pl.uid, { correct: rng() < 0.62 }), 1200 + rng() * total * 0.62);
    }
  }

  /** Kör nästa fråga med styrda svar (eller pågående, om den är öppen). */
  function steer(fn) {
    if (session.status !== "live") return onLog("starta matchen först");
    if (session.q?.phase === "open") { clearTimers(); return fn(); }
    if (session.q && session.q.phase === "closed") return onLog("vänta på avslöjandet");
    if (session.q && session.q.index + 1 >= session.questionCount) return onLog("sista frågan är spelad");
    plan = fn;
    step("open", session.q ? session.q.index : -1);
  }

  /** Spela k frågor direkt (tidigare frågor i matchen, för mellanbild/final). */
  function playQuestions(k) {
    if (session.status === "lobby") { session.status = "live"; session.startedAt = now() - 600_000; }
    const startIx = session.q ? session.q.index + 1 : 0;
    const was = auto;
    auto = false;
    for (let i = startIx; i < Math.min(startIx + k, session.questionCount); i++) {
      const t0 = clock() - (startIx + k - i) * 40_000;
      offset = t0 - clock();
      if (!step("open", i - 1).done) break;
      clearTimers();
      players.forEach((p, j) => {
        if ((j * 7 + i) % 11 === 0) return;
        const at = t0 + 900 + ((j * 397 + i * 131) % (session.questionSeconds * 700));
        const good = (j * 5 + i * 3) % 7 < 4 + (j < 6 ? 2 : 0);
        const f = snapshot.facit[i];
        answers.push({ uid: p.uid, classId: "4b", q: i, answerKind: KIND, at,
          ...(KIND === "choice" ? { choiceIndex: good ? f.answerIndex : (f.answerIndex + 1) % 4 } : { answer: good ? f.correctAnswer : "54" }) });
      });
      offset = t0 + session.questionSeconds * 1000 + 500 - clock();
      step("close", i);
      step("reveal", i);
    }
    offset = 0;
    auto = was;
    emit(true);
  }

  /** Delad placering: ge eleven på plats `to` exakt samma poäng som plats `from`. */
  function tie(from, to) {
    const st = standings();
    const a = st.players[from - 1], b = st.players[to - 1];
    if (!a || !b) return;
    const sc = [...scores].reverse().find((s) => !s.skipped && b.uid in (s.points || {})) || scores[scores.length - 1];
    sc.points = { ...sc.points, [b.uid]: (sc.points[b.uid] || 0) + a.points - b.points };
    sc.correct = { ...sc.correct, [b.uid]: sc.correct?.[b.uid] ?? true };
  }

  function join(n = DEMO_NAMES.length, staggerMs = 140, joinedAt = null) {
    for (let i = 0; i < n; i++) {
      if (!staggerMs) addPlayer(i, joinedAt ?? now());
      else setTimeout(() => { addPlayer(i); emit(true); }, i * staggerMs);
    }
    emit(true);
  }

  // --- Realtidsflödet (som live-feed.js, men i minnet) ---
  function compute() {
    const t = now();
    const ph = phaseAt(session, t);
    return {
      sessionId: sid, session: { ...session }, status: session.status, phase: ph.phase, countdown: ph.countdown,
      msLeft: ph.msLeft, clock: formatClock(ph.msLeft), ...computeStandings(session, { scores: [], players }), top: [],
      players: players.map((p) => ({ ...p, answerKey: null })), result: session.result || null, now: t,
    };
  }
  function emit(force) {
    scoreCbs.forEach((f) => f(scores.slice()));
    ansCbs.forEach((x) => x.cb(answers.filter((a) => a.q === x.i)));
    listeners.forEach((f) => f());
    if (!screen && session.status === "finished" && !session.result && !resultTimer) {
      resultTimer = setTimeout(() => {
        session.result = buildResult(session, [], players, null, { scores, questions: snapshot.questions });
        emit(true);
      }, 2500);
    }
    if (!cb) return;
    const st = compute();
    const key = JSON.stringify([st.status, st.phase, st.countdown, session.q, players.length, !!st.result]);
    if (!force && key === lastKey) return;
    lastKey = key;
    cb(st);
  }
  const ticker = setInterval(() => emit(false), 250);

  const deps = {
    subscribe(_sid, fn) { cb = fn; lastKey = ""; emit(true); return () => { if (cb === fn) cb = null; }; },
    now,
    async start() {
      await new Promise((r) => setTimeout(r, 200));
      if (session.status === "lobby") { session.status = "live"; session.startedAt = now(); }
      emit(true);
    },
    async finish() {
      if (["lobby", "live"].includes(session.status)) { session.status = "finished"; session.finishedAt = now(); clearTimers(); }
      emit(true);
    },
    async remove() { onLog("radera (demo – ingenting raderas)"); },
    async loadProjection() { reads++; await new Promise((r) => setTimeout(r, 80)); return { members: { ...members } }; },
    snilleblixt: {
      watchScores(_s, f) { scoreCbs.add(f); f(scores.slice()); return () => scoreCbs.delete(f); },
      watchQuestionAnswers(_s, i, f) { const x = { i, cb: f }; ansCbs.add(x); f(answers.filter((a) => a.q === i)); return () => ansCbs.delete(x); },
      openQuestion: async (_s, i) => step("open", i),
      closeQuestion: async (_s, i) => step("close", i),
      revealQuestion: async (_s, i) => step("reveal", i),
      skipQuestion: async (_s, i) => step("skip", i),
    },
  };

  return {
    deps,
    session,
    snapshot,
    step,
    answer,
    emit,
    state: () => ({ session, players, answers, scores, reads }),
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** Elevskärmsfönstret: ta över hela tillståndet från lärarfliken. */
    load(data) {
      for (const k of Object.keys(session)) delete session[k];
      Object.assign(session, data.session);
      ({ players, answers, scores, offset } = data);
    },
    snapshotState: () => ({ session, players, answers, scores, offset }),
    get auto() { return auto; },
    join,
    setAuto(on) { auto = !!on; if (auto && session.q?.phase === "open" && !answers.some((a) => a.q === session.q.index)) scheduleAnswers(); },
    allAnswer(p = 0.6) {
      if (session.q?.phase !== "open") return onLog("ingen öppen fråga");
      clearTimers();
      players.forEach((pl, i) => later(() => answer(pl.uid, { correct: rng() < p }), i * 40));
    },
    test7b() {
      if (KIND !== "free") return onLog("test 7b gäller Skriv själv");
      steer(() => players.forEach((p, i) => later(() => answer(p.uid, { text: i < 5 ? "54" : i < 8 ? "64" : undefined, correct: true }), i * 50)));
    },
    revealNow() {
      if (session.q?.phase !== "open") return onLog("ingen öppen fråga att avslöja");
      step("close", session.q.index);
    },
    soonOut(sek = 6) {
      if (session.q?.phase !== "open") return onLog("ingen öppen fråga");
      session.q = { ...session.q, openedAt: now() - (session.questionSeconds - sek) * 1000 };
      emit(true);
    },
    playQuestions,
    jumpToFinal(tieKind = null) {
      if (!players.length) join(DEMO_NAMES.length, 0, now() - 900_000);
      clearTimers();
      if (session.q?.phase === "open") step("close", session.q.index);
      if (session.q?.phase === "closed") step("reveal", session.q.index);
      playQuestions(session.questionCount);
      if (tieKind === "forsta") tie(1, 2);
      if (tieKind === "andra") tie(2, 3);
      if (session.status !== "finished") { session.status = "finished"; session.finishedAt = now(); }
      emit(true);
    },
    toggleFreeze() { frozen = frozen == null ? now() : null; return frozen != null; },
    destroy() { clearInterval(ticker); clearTimers(); clearTimeout(resultTimer); },
  };
}

// --- Reducerad rörelse (bara demot) ------------------------------------------
let rmOn = false;
let rmTimer = null;
const rmOrig = new WeakMap();

function patchSheets() {
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    walk(rules);
  }
  function walk(rules) {
    for (const r of rules || []) {
      if (r.media && (rmOrig.has(r) || /prefers-reduced-motion:\s*reduce/.test(r.media.mediaText))) {
        if (!rmOrig.has(r)) rmOrig.set(r, r.media.mediaText);
        r.media.mediaText = rmOn ? "all" : rmOrig.get(r);
      }
      if (r.cssRules) walk(r.cssRules);
    }
  }
}

/** Slå på/av "reducerad rörelse" som om webbläsaren bad om det (JS + CSS). */
export function forceReducedMotion(on) {
  if (typeof window === "undefined") return;
  rmOn = !!on;
  if (!window.matchMedia.__sbDemo) {
    const orig = window.matchMedia.bind(window);
    const mm = (q) => (rmOn && /prefers-reduced-motion:\s*reduce/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : orig(q));
    mm.__sbDemo = true;
    window.matchMedia = mm;
  }
  patchSheets();
  clearInterval(rmTimer);
  // Ark som laddas senare (formatets CSS när en vy monteras).
  if (rmOn) rmTimer = setInterval(patchSheets, 700);
}
