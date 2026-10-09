// ============================================================================
// Snilleblixten – TV-STUDION (#559, designspec §5): projektorns huvudvy
// (views-posten "studio", finale: true – vyn spelar själv pallplatsen).
// Sätter ihop miljön (sb-miljo), klockan + frågeschaktet (sb-fraga),
// topplistan (sb-topplista), publiken (sb-publik), finalen (sb-pall),
// lärarkontrollerna (sb-kontroller) och den gemensamma regin (#571:
// händelser → animationskö → reaktioner/banderoll/ljudkö).
//
// Scenen (sb-scen studioScene) räknas ur sessionens q-fas + serverns tid:
//   intro → fraga (landar med blixt, publiken lyser upp med bock när någon
//   svarat, "17 av 24 har svarat", sista 5 s röd puls + snabbare tick) →
//   stangd ("Alla har svarat!" / "Tiden är ute!", trumvirvel) → svar
//   (rätt alternativ + staplar / rätt svar + vanliga felsvar, ding, de som
//   svarade rätt gör Glad) → topplista (glider in, klättring, "Ny ledare")
//   → NÄSTA FRÅGA … → final (pallplats EN gång, sedan resultatet).
// Omladdning: regins första sync hoppar till nuläget – inget spelas om,
// ställning/svar ritas direkt rätt.
//
// API: createStudioView(host, { st, sound, actions, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createBanner } from "../../design/live-banner.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { react, prefersReducedMotion } from "../../design/live-reactions.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { toMs } from "../../live-time.js";
import { studioScene, questionClock, shownScores, revealInfo, streaks, podiumGroups } from "./sb-scen.js";
import { createSbKoppling, avatarRoster } from "./sb-koppling.js";
import { ensureStudioCss, miljoHtml, logoHtml, flash } from "./sb-miljo.js";
import { createKlocka, createSchakt } from "./sb-fraga.js";
import { createTopplista } from "./sb-topplista.js";
import { createPublik } from "./sb-publik.js";
import { createFinal } from "./sb-pall.js";
import { createKontroller } from "./sb-kontroller.js";

const TICK_MS = 100;
// Topplistan visar först ställningen FÖRE frågan, sedan klättringen.
const CLIMB_DELAY_MS = 900;

export function createStudioView(host, { st, sound = null, actions = {}, screen = false, deps = null }) {
  ensureStudioCss();
  const s0 = st.session;
  const sid = st.sessionId || s0?.id;
  const root = document.createElement("div");
  root.className = "sb";
  root.innerHTML = `${miljoHtml()}
    <header class="sb-topp">${logoHtml({ size: "liten" })}<div class="sb-klocka"></div><div class="sb-klass"></div></header>
    <main class="sb-mitt"><div class="sb-info" hidden></div></main>
    <footer class="sb-fot"><div class="sb-svarat" hidden></div></footer>
    <div class="sb-utrop" aria-live="assertive" hidden></div>`;
  host.replaceChildren(root);
  const $ = (q) => root.querySelector(q);
  const mitt = $(".sb-mitt");

  let cur = st;
  let scene = null;
  let dead = false;
  let topEnterAt = 0;
  let lastTick = "";
  let gladDone = -1;
  let introIx = null;
  const revealSeen = new Map(); // frågeindex → serverns tid när fönstret såg avslöjandet
  const seenOpen = new Set(); // frågor fönstret sett öppna (live, inte via omladdning)

  const roster = avatarRoster(sid, deps);
  roster.prefetch(s0?.participatingClassIds || []);
  const pool = createAvatarPool({ roster });
  const klocka = createKlocka($(".sb-klocka"));
  const schakt = createSchakt(mitt);
  const topp = createTopplista(mitt, { pool });
  const publik = createPublik($(".sb-fot"), { pool });
  const final = createFinal(root, { pool, sound, flashHost: root });
  const realBanner = createBanner(root);
  const say = (t) => console.warn("Snilleblixten:", t);
  const koppling = createSbKoppling({ sid, st, deps, actions, screen, onChange: () => render(), say });
  const kontroll = screen ? null : createKontroller(root, { koppling });
  root.classList.toggle("sb-skarm", !!screen);

  // Banderollen: "⚡ Ny ledare: Clara!" + Claras avatar i topplistan jublar.
  const banner = {
    show(b, signal, opts) {
      if (b.jubelUid && pool.has(b.jubelUid, "topp")) react(pool.el(b.jubelUid, "topp"), "jubel", { signal });
      return realBanner.show(b, signal, opts);
    },
  };

  const regi = createLiveRegi({
    sessionId: sid,
    pool,
    banner,
    sound,
    map(evt, { nameOf }) {
      if (evt.type === "correct" || evt.type === "wrong") return [];
      if (evt.type === "rank") return scene === "topplista" ? [{ kind: "rank" }] : [];
      if (evt.type === "leader") {
        const name = nameOf(evt.uid) || "?";
        return [{
          kind: "banner",
          mergeKey: "leader",
          merge: (a, b) => b,
          banner: { icon: "⚡", title: evt.prev ? `Ny ledare: ${name}!` : `${name} tar ledningen!`, tone: "gold", jubelUid: evt.uid },
          cue: "swoosh",
          then: [{ kind: "reaction", uid: evt.uid, reaction: "jubel" }],
        }];
      }
      return undefined;
    },
    playRank: (job, signal, opts) => topp.play(signal, opts),
    playFinal: (job, signal) => final.play(finalData(), signal).then(() => root.classList.add("sb-resultat")),
    settle: (job) => { if (job.kind === "rank") topp.settle(); },
  });

  function finalData() {
    const sess = cur.session;
    const standing = koppling.standings();
    const rw = sessionRewards(sess);
    const res = cur.result?.rewards || null;
    return {
      ranking: standing.players,
      groups: podiumGroups(standing.players),
      title: `🏆 ${(sess?.participatingClassIds || []).map((id) => sess.classNames?.[id] || id).join(" + ")} – vilken final!`,
      prize: (rank) => {
        const p = res ? Object.values(res).find((r) => r.rank === rank) : null;
        return p ? p.prize : rw ? placementPrize(rw.firstPrize, rank) : 0;
      },
      cheer(winners) {
        const w = new Set(winners);
        (cur.players || []).filter((p) => !w.has(p.uid)).forEach((p, i) => setTimeout(() => !dead && react(pool.el(p.uid), "glad"), (i % 10) * 70));
        winners.forEach((u) => react(pool.el(u), "jubel", { big: true }));
      },
    };
  }

  function utrop(text, cls = "") {
    const u = $(".sb-utrop");
    u.className = `sb-utrop ${cls}`;
    u.innerHTML = text;
    u.hidden = false;
    u.getAnimations().forEach((a) => a.cancel());
    const frames = prefersReducedMotion()
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
      : [{ opacity: 0, transform: "scale(.7)" }, { opacity: 1, transform: "scale(1.05)", offset: 0.2 }, { opacity: 1, transform: "none", offset: 0.8 }, { opacity: 0 }];
    u.animate(frames, { duration: 1250, easing: "ease-out" }).finished.catch(() => {}).finally(() => { u.hidden = true; });
  }

  function info(html) {
    const el = $(".sb-info");
    el.hidden = !html;
    if (html && el.dataset.k !== html) { el.dataset.k = html; el.innerHTML = html; }
  }

  // Scenbyten som bara spelas när fönstret SER dem hända (aldrig efter omladdning).
  function enter(next, prev, q) {
    if (next === "fraga" && q && seenOpen.has(q.index)) {
      flash(root);
      sound?.cue?.("blixt");
    }
    if (next === "stangd" && prev === "fraga") {
      const all = lastProgress?.all;
      utrop(all ? "⚡ Alla har svarat!" : "⏱ Tiden är ute!", all ? "sb-utrop-alla" : "");
      if (all) flash(root);
      sound?.cue?.("trumvirvel");
    }
    if (next === "svar" && (prev === "stangd" || prev === "fraga")) {
      flash(root);
      sound?.cue?.("ding");
    }
    if (next === "topplista") {
      topEnterAt = Date.now();
    }
  }

  let lastProgress = null;

  function render() {
    if (dead) return;
    const s = cur.session;
    if (!s) return;
    const now = koppling.now();
    const q = s.q || null;
    // Fönstret ser frågan öppen/avslöjad "live" → animationerna får spelas.
    if (q && q.phase === "open" && scene !== null && !seenOpen.has(q.index)) seenOpen.add(q.index);
    if (q && ["revealed", "skipped"].includes(q.phase) && !revealSeen.has(q.index)) {
      revealSeen.set(q.index, scene && scene !== "topplista" && scene !== "final" && scene !== "intro" ? now : null);
    }
    const next = studioScene(cur, { now, revealSeenAt: q ? revealSeen.get(q.index) ?? null : null });
    const prev = scene;
    if (next !== prev) {
      root.dataset.scene = next;
      scene = next;
      if (prev !== null) enter(next, prev, q);
    }

    // Ställningen som visas: under frågan bara tidigare frågor; topplistan
    // visar först ställningen före frågan, sedan klättringen.
    let list = shownScores(koppling.scores, scene, q);
    if (scene === "topplista" && q && Date.now() - topEnterAt < CLIMB_DELAY_MS && topEnterAt) {
      const before = list.filter((sc) => sc.index < q.index);
      // Ingen hade poäng före frågan (första frågan): visa ställningen direkt.
      if (koppling.standings(before).players.some((p) => p.points > 0)) list = before;
    }
    const standing = koppling.standings(list);
    const answered = new Set(koppling.answers.filter((a) => a.q === q?.index).map((a) => a.uid));
    // "Har svarat"-händelser (bock + ljud) bara för en fråga fönstret sett
    // öppnas: efter en omladdning ritar publiken bockarna direkt ur datan.
    const liveAnswer = (uid) => (q && seenOpen.has(q.index) && (scene === "fraga" || scene === "stangd") && answered.has(uid) ? `q${q.index}` : null);
    const ranks = {};
    for (const p of standing.players) if (p.points > 0) ranks[p.uid] = p.rank;
    const events = regi.sync({
      phase: cur.phase === "finished" ? "finished" : cur.phase === "lobby" ? "lobby" : "live",
      players: standing.players.map((p) => ({ uid: p.uid, name: p.name, score: p.points, answerKey: liveAnswer(p.uid) })),
      ranks,
      finishedAt: toMs(s.finishedAt),
      now,
    });
    roster.ensure(cur.players || []);

    // Publiken + "17 av 24 har svarat".
    const asking = scene === "fraga" || scene === "stangd" || scene === "svar";
    publik.update(cur.players || [], { answered: asking ? answered : null });
    lastProgress = q?.phase === "open" ? koppling.progress() : lastProgress;
    const pill = $(".sb-svarat");
    pill.hidden = !(scene === "fraga" || scene === "stangd");
    if (!pill.hidden) {
      const p = q.phase === "open" ? koppling.progress() : lastProgress || koppling.progress();
      const t = `<b>${p.answered}</b> av <b>${p.eligible}</b> har svarat`;
      if (pill.innerHTML !== t) pill.innerHTML = t;
    }

    // Överst: frågenummer + nedräkning.
    const clock = scene === "fraga" || scene === "stangd" ? questionClock(s, now) : null;
    klocka.set({ index: q && scene !== "final" ? q.index : -1, count: s.questionCount, clock });
    ticks(clock);
    $(".sb-klass").textContent = (s.participatingClassIds || []).map((id) => s.classNames?.[id] || id).join(" + ");

    // Mitten.
    if (scene === "intro") {
      if (introIx !== "intro") { introIx = "intro"; schakt.clear(); }
      info(`<div class="sb-intro">${logoHtml({ size: "stor" })}<p>Gör er redo! Första frågan kommer …</p></div>`);
    } else if (scene === "hoppad") info(`<div class="sb-hoppad">⏭ Frågan hoppades över</div>`);
    else info("");
    if (q && (scene === "fraga" || scene === "stangd" || scene === "svar")) {
      schakt.show(q, { answerKind: s.answerKind, land: seenOpen.has(q.index) && scene === "fraga" });
      if (scene === "svar" && q.facit) {
        const sc = koppling.scores.find((x) => x.index === q.index) || null;
        schakt.reveal(revealInfo(q, sc, s.answerKind), { animate: prev !== null });
        if (sc && gladDone !== q.index) {
          gladDone = q.index;
          if (revealSeen.get(q.index) != null) {
            Object.entries(sc.correct || {}).filter(([, ok]) => ok)
              .forEach(([uid], i) => setTimeout(() => !dead && regi.push({ kind: "reaction", uid, reaction: "glad" }), 250 + (i % 12) * 60));
          }
        }
      }
    }
    if (scene === "topplista") {
      const title = q ? `🏆 Topplistan efter fråga ${q.index + 1} av ${s.questionCount}` : "🏆 Topplistan";
      const flip = events.some((e) => e.type === "rank");
      const wasHidden = topp.el.dataset.syns !== "1";
      topp.el.dataset.syns = "1";
      topp.render(standing.players.filter((p) => p.points > 0).slice(0, 5), { title, streaks: streaks(list), flip: flip && !wasHidden });
      if (wasHidden && prev !== null) topp.enter();
    } else topp.el.dataset.syns = "0";

    // Finalen: spelas av regin (EN gång); annars direkt resultatet.
    if (scene === "final" && !regi.queue.finalStarted() && !root.classList.contains("sb-resultat")) {
      root.classList.add("sb-resultat");
      final.showResult(finalData());
    }
    kontroll?.update();
  }

  // Sista 10 s: tick varje sekund; sista 5 s: två per sekund (snabbare).
  function ticks(clock) {
    if (!clock || !clock.msLeft || scene !== "fraga") { lastTick = ""; return; }
    const half = Math.ceil(clock.msLeft / 500);
    const key = clock.tension ? `h${half}` : `s${clock.secs}`;
    if (key === lastTick) return;
    const first = lastTick === "";
    lastTick = key;
    if (first || clock.secs > 10) return;
    sound?.cue?.(clock.tension ? "tickSnabb" : "tick");
  }

  const iv = setInterval(render, TICK_MS);
  render();

  return {
    update(next) {
      cur = next;
      koppling.update(next);
      render();
    },
    destroy() {
      dead = true;
      clearInterval(iv);
      regi.destroy();
      koppling.destroy();
      kontroll?.destroy();
      realBanner.destroy();
      final.destroy();
      pool.destroy();
      root.remove();
    },
  };
}
