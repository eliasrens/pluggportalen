// ============================================================================
// Snilleblixten – TV-STUDION (#559, designspec §5): projektorns huvudvy
// (views-posten "studio", finale: true – vyn spelar själv pallplatsen).
// Sätter ihop miljön (sb-miljo), klockan + frågeschaktet (sb-fraga),
// publiken (sb-publik), finalen (sb-pall), lärarkontrollerna (sb-kontroller)
// och den gemensamma regin (#571: händelser → animationskö → reaktioner/
// ljudkö).
//
// Scenen (sb-scen studioScene) räknas ur sessionens q-fas + serverns tid:
//   intro → fraga (landar med blixt, publiken lyser upp med bock när någon
//   svarat, "17 av 24 har svarat", sista 5 s röd puls + snabbare tick) →
//   stangd ("Alla har svarat!" / "Tiden är ute!", trumvirvel) → svar
//   (rätt alternativ + staplar / rätt svar + vanliga felsvar, ding) →
//   mellan (neutral mellanbild: "15 av 24 svarade rätt") → NÄSTA FRÅGA … →
//   final (pallplats EN gång – topp 3 är den ENDA namnlistan).
// INGEN UTHÄNGNING (Elias 2026-10-10): ingen topplista, ingen ledarbanderoll,
// inga poäng per elev och ingen reaktion som avslöjar vem som svarade rätt.
// Publiken visar bara vem som HAR svarat (bocken), aldrig rätt/fel.
// Omladdning: regins första sync hoppar till nuläget – inget spelas om,
// ställning/svar ritas direkt rätt.
//
// API: createStudioView(host, { st, sound, actions, screen, deps }) → { update(st), destroy() }
// ============================================================================

import { createAvatarPool } from "../../design/live-avatar-pool.js";
import { createLiveRegi } from "../../design/live-regi.js";
import { react, prefersReducedMotion } from "../../design/live-reactions.js";
import { sessionRewards, placementPrize } from "../../live-rewards.js";
import { toMs } from "../../live-time.js";
import { studioScene, questionClock, revealInfo, podiumGroups, classSummary } from "./sb-scen.js";
import { createSbKoppling, avatarRoster } from "./sb-koppling.js";
import { ensureStudioCss, miljoHtml, logoHtml, flash } from "./sb-miljo.js";
import { createKlocka, createSchakt } from "./sb-fraga.js";
import { createPublik } from "./sb-publik.js";
import { createFinal } from "./sb-pall.js";
import { createKontroller } from "./sb-kontroller.js";

const TICK_MS = 100;

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
  let lastTick = "";
  let introIx = null;
  const revealSeen = new Map(); // frågeindex → serverns tid när fönstret såg avslöjandet
  const seenOpen = new Set(); // frågor fönstret sett öppna (live, inte via omladdning)

  const roster = avatarRoster(sid, deps);
  roster.prefetch(s0?.participatingClassIds || []);
  const pool = createAvatarPool({ roster });
  const klocka = createKlocka($(".sb-klocka"));
  const schakt = createSchakt(mitt);
  const publik = createPublik($(".sb-fot"), { pool });
  const final = createFinal(root, { pool, sound, flashHost: root });
  const say = (t) => console.warn("Snilleblixten:", t);
  const koppling = createSbKoppling({ sid, st, deps, actions, screen, onChange: () => render(), say });
  const kontroll = screen ? null : createKontroller(root, { koppling });
  root.classList.toggle("sb-skarm", !!screen);

  const regi = createLiveRegi({
    sessionId: sid,
    pool,
    sound,
    // Inga ställningshändelser (rank/leader/correct) – bara anslutning,
    // "har svarat" och finalen.
    map(evt) {
      if (["correct", "wrong", "rank", "leader"].includes(evt.type)) return [];
      return undefined;
    },
    playFinal: (job, signal) => final.play(finalData(), signal).then(() => root.classList.add("sb-resultat")),
  });

  function finalData() {
    const sess = cur.session;
    const standing = koppling.standings();
    const rw = sessionRewards(sess);
    const res = cur.result?.rewards || null;
    const sum = classSummary(koppling.scores);
    return {
      groups: podiumGroups(standing.players),
      sub: sum.answered ? `Hela klassen: ${sum.share} % rätt svar – bra kämpat! 🎉` : "",
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
      revealSeen.set(q.index, scene && scene !== "mellan" && scene !== "final" && scene !== "intro" ? now : null);
    }
    const next = studioScene(cur, { now, revealSeenAt: q ? revealSeen.get(q.index) ?? null : null });
    const prev = scene;
    if (next !== prev) {
      root.dataset.scene = next;
      scene = next;
      if (prev !== null) enter(next, prev, q);
    }

    const answered = new Set(koppling.answers.filter((a) => a.q === q?.index).map((a) => a.uid));
    // "Har svarat"-händelser (bock + ljud) bara för en fråga fönstret sett
    // öppnas: efter en omladdning ritar publiken bockarna direkt ur datan.
    const liveAnswer = (uid) => (q && seenOpen.has(q.index) && (scene === "fraga" || scene === "stangd") && answered.has(uid) ? `q${q.index}` : null);
    // Regin får ALDRIG poäng/placering mellan frågorna (ingen klättring/ledare).
    regi.sync({
      phase: cur.phase === "finished" ? "finished" : cur.phase === "lobby" ? "lobby" : "live",
      players: (cur.players || []).map((p) => ({ uid: p.uid, name: p.name, answerKey: liveAnswer(p.uid) })),
      ranks: {},
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
    else if (scene === "mellan" && q) info(mellanHtml(s, q));
    else info("");
    if (q && (scene === "fraga" || scene === "stangd" || scene === "svar")) {
      schakt.show(q, { answerKind: s.answerKind, land: seenOpen.has(q.index) && scene === "fraga" });
      if (scene === "svar" && q.facit) {
        const sc = koppling.scores.find((x) => x.index === q.index) || null;
        schakt.reveal(revealInfo(q, sc, s.answerKind), { animate: prev !== null });
      }
    }

    // Finalen: spelas av regin (EN gång); annars direkt resultatet.
    if (scene === "final" && !regi.queue.finalStarted() && !root.classList.contains("sb-resultat")) {
      root.classList.add("sb-resultat");
      final.showResult(finalData());
    }
    kontroll?.update();
  }

  // Mellanbilden: neutral, utan namn – bara klassens resultat på frågan.
  function mellanHtml(s, q) {
    const nr = `Fråga ${q.index + 1} av ${s.questionCount}`;
    const last = q.index + 1 >= (Number(s.questionCount) || 0);
    const vidare = last ? "Snart dags för pallen …" : "Nästa fråga kommer snart …";
    if (q.phase === "skipped") return `<div class="sb-mellan"><p class="sb-mellan-nr">${nr}</p><p class="sb-mellan-stor">⏭ Hoppades över</p><p>${vidare}</p></div>`;
    const sc = koppling.scores.find((x) => x.index === q.index);
    const resultat = sc ? `<p class="sb-mellan-stor"><b>${Number(sc.correctCount) || 0}</b> av <b>${Number(sc.answered) || 0}</b> svarade rätt</p>` : "";
    return `<div class="sb-mellan"><p class="sb-mellan-nr">✔ ${nr} klar</p>${resultat}<p>${vidare}</p></div>`;
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
      final.destroy();
      pool.destroy();
      root.remove();
    },
  };
}
