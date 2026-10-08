// ============================================================================
// Live – PROJEKTORVYN (#461), #/larare/live?id=<sid>. Skalet: helskärmsyta,
// verktygsrad (vyval, ljud, fullskärm), stor matchtimer, gemensam 3-2-1-KÖR!
// och fasväxling lobby → spelvy → vinnarskärm. Vyerna ligger i egna moduler:
//   proj-lobby.js   lobby + STARTA MATCH       proj-rocket.js  VY 1 Raketrace
//   proj-stats.js   VY 2 Statistik (exakt)     proj-tug.js     VY 3 Dragkamp
//   proj-winner.js  vinnarskärm + konfetti     proj-sound.js   ljud på/av
//   trollkarl/      VY 4 Trollkarlsduellen (#536) – laddas LATT (import()),
//                   äger sin egen final + resultatskärm (finale: true)
//
// GEMENSAMT (Firestore, live-feed.js): status, start, timer, poäng, avslut.
// LOKALT per webbläsare (localStorage): vyval pp:live:vy, ljud pp:live:ljud –
// Rasmus kan visa Raketrace samtidigt som Elias visar Statistik.
// Timern och nedräkningen räknas ur sessionens serverstämplar (startedAt →
// officiellt slut = endsAt) mot den server-korrigerade klockan, 10 ggr/s –
// aldrig en lokal nedräknare.
//
// UTVIDGAD SKÄRM (#533): "📺 Öppna elevskärm" (elevskarm-panel.js) öppnar ett
// eget fönster med screen: true (#/larare/live?id=<sid>&skarm=elev) – samma
// vyer men INGA kontroller (elevskarm-skarm.js). Det följer kontrollpanelens
// vyval och ljud via en BroadcastChannel (elevskarm-kanal.js) och hämtar
// matchen själv ur Firestore. Ljudet spelas där; panelen tystnar så länge en
// elevskärm är ansluten. Utan elevskärm: exakt som förut (duplicerad skärm).
//
// API: mountProjector(ctx, sid, { cleanups, uid, deps?, screen? }) → Promise
//   deps (för förhandsvisning/test; default = riktiga Firestore-lagret):
//     { subscribe(sid, cb, opts), now(), start(sid), finish(sid), setDivisor(sid, cid, n),
//       setWizards?(sid, map) }
// VIEWS-post: { id, label, create(host, { st, colors, sound }) → { update, destroy },
//   only2?: bara två klasser, finale?: vyn visar själv slutet (ingen proj-winner) }
//   screen: true = elevskärmen (inga kontroller, vyval/ljud från kanalen)
// ============================================================================

import { getGameMode } from "./modes/index.js";
import { phaseAt, formatClock, toMs } from "./live-core.js";
import { classColor } from "./proj-scale.js";
import { createSound } from "./proj-sound.js";
import { createLobby } from "./proj-lobby.js";
import { createRocketView } from "./proj-rocket.js";
import { createStatsView } from "./proj-stats.js";
import { createTugView } from "./proj-tug.js";
import { createWinner } from "./proj-winner.js";
import { ensureLiveCss } from "./live-css.js";
import { createScreenLink } from "./elevskarm-kanal.js";
import { createScreenControl } from "./elevskarm-panel.js";
import { createScreenChrome } from "./elevskarm-skarm.js";

const VIEW_KEY = "pp:live:vy";
const loadTrollkarl = () => import("./trollkarl/trollkarl-vy.js");

// Lat vy: modulen hämtas först när vyn väljs (inga nya filer i bootgrafen).
// Senaste st buffras medan den laddar.
function lazyView(load, name) {
  return (host, opts) => {
    let ui = null;
    let last = opts.st;
    let dead = false;
    host.innerHTML = `<div class="lp-wait">Laddar…</div>`;
    load().then((m) => {
      if (!dead) ui = m[name](host, { ...opts, st: last });
    }).catch((err) => {
      if (dead) return;
      const w = document.createElement("div");
      w.className = "lp-wait";
      w.textContent = `Vyn kunde inte laddas (${err?.message || err}). Välj en annan vy eller ladda om sidan.`;
      host.replaceChildren(w);
    });
    return {
      update(st) { last = st; ui?.update(st); },
      destroy() { dead = true; ui?.destroy(); },
    };
  };
}

const VIEWS = [
  { id: "raket", label: "🚀 Raketrace", create: createRocketView },
  { id: "statistik", label: "📊 Statistik", create: createStatsView },
  { id: "dragkamp", label: "🪢 Dragkamp", create: createTugView, only2: true },
  { id: "trollkarl", label: "🧙 Trollkarlsduellen", create: lazyView(loadTrollkarl, "createTrollkarlView"), only2: true, finale: true },
];
// En vinnarskärm som visas inom så här lång tid efter slutet får konfetti.
const CELEBRATE_MS = 3 * 60_000;

async function realDeps() {
  const [feed, data, clock] = await Promise.all([import("./live-feed.js"), import("./live-data.js"), import("./live-clock.js")]);
  return {
    subscribe: feed.subscribeLiveSession,
    now: clock.serverNow,
    start: data.startLiveSession,
    finish: data.finishLiveSession,
    setDivisor: data.setClassDivisor,
    setWizards: data.setLiveWizards,
  };
}

function readView() {
  try { return localStorage.getItem(VIEW_KEY) || "raket"; } catch { return "raket"; }
}

export async function mountProjector(ctx, sid, { cleanups, uid, deps, screen = false }) {
  ensureLiveCss(["src/live/projector.css", "src/live/projector-views.css", "src/live/elevskarm.css"]);
  const d = deps || await realDeps();
  const root = document.createElement("div");
  root.className = screen ? "lp lp-elevskarm" : "lp";
  root.innerHTML = `
    <div class="lp-bar"${screen ? " hidden" : ""}>
      <button class="lp-btn" data-back>← Live</button>
      <div class="lp-brand">⚡ MATTEMATCH LIVE <span data-name></span></div>
      <div class="lp-es-host"></div>
      <div class="lp-views" role="tablist" hidden>${VIEWS.map((v) => `<button class="lp-btn lp-vbtn" role="tab" data-view="${v.id}">${v.label}</button>`).join("")}</div>
      <button class="lp-btn" data-sound></button>
      <button class="lp-btn" data-fs>⛶ Fullskärm</button>
      <button class="lp-btn lp-danger" data-end hidden>Avsluta</button>
    </div>
    <div class="lp-stage"><div class="lp-wait">Ansluter till matchen…</div></div>
    <div class="lp-timer" hidden><b data-clock>00:00</b><span>kvar</span></div>
    <div class="lp-overlay" aria-live="assertive"></div>
    <div class="lp-msg" role="status" hidden></div>`;
  ctx.app.replaceChildren(root);
  const $ = (s) => root.querySelector(s);
  const stage = $(".lp-stage");
  const overlay = $(".lp-overlay");

  const sound = createSound();
  let st = null;
  let colors = {};
  let current = null; // { kind, view, key, ui }
  let viewId = readView();
  let shownCount = null;
  let clockText = "";
  let sawLive = false;
  let prevPhase = "";
  let prevTotal = null;
  let prevLeader = null;
  let msgT = 0;

  const say = (text) => {
    const m = $(".lp-msg");
    m.textContent = text;
    m.hidden = !text;
    clearTimeout(msgT);
    if (text) msgT = setTimeout(() => { m.hidden = true; }, 8000);
  };
  const back = screen ? null : () => ctx.go("#/larare/live");
  const actions = {
    start: () => { sound.unlock(); return d.start(sid); },
    cancel: () => d.finish(sid),
    setDivisor: (cid, n) => d.setDivisor(sid, cid, n),
    setWizards: d.setWizards ? (map) => d.setWizards(sid, map) : null,
  };

  // --- Verktygsraden -------------------------------------------------------
  if (back) $("[data-back]").addEventListener("click", back);
  $("[data-fs]").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else root.requestFullscreen?.().catch(() => say("Webbläsaren tillät inte fullskärm."));
  });
  const onFs = () => {
    const fs = document.fullscreenElement === root;
    $("[data-fs]").textContent = fs ? "⛶ Lämna fullskärm" : "⛶ Fullskärm";
    root.classList.toggle("lp-fs", fs);
  };
  document.addEventListener("fullscreenchange", onFs);
  $("[data-sound]").addEventListener("click", () => { sound.toggle(); soundLabel(); es?.publish(); });
  $("[data-end]").addEventListener("click", () => {
    if (confirm("Avsluta matchen NU, före tiden? Resultatet räknas som det står.")) d.finish(sid).catch((e) => say(e.message));
  });
  root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => pickView(b.dataset.view)));
  const onKey = (e) => {
    if (e.target.closest?.("input, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    const v = VIEWS[Number(e.key) - 1];
    if (v && !$(".lp-views").hidden) pickView(v.id);
  };
  if (!screen) document.addEventListener("keydown", onKey);
  // I fullskärm göms raden när musen står still (projektorbilden blir ren).
  let idleT = 0;
  const onMove = () => {
    root.classList.remove("lp-idle");
    clearTimeout(idleT);
    idleT = setTimeout(() => root.classList.add("lp-idle"), 3500);
  };
  root.addEventListener("pointermove", onMove);

  // --- Elevskärmen (#533) ---------------------------------------------------
  // Panelen: knapp + status i raden, skickar vyval/ljud. Skärmen: följer dem.
  let es = null;
  let link = null;
  let chrome = null;
  if (screen) {
    chrome = createScreenChrome(root, { sound });
    link = createScreenLink(sid, {
      audio: () => sound.on && sound.unlocked(),
      onState: ({ view, sound: on }) => { sound.setOn(on); pickView(view); },
      onClose: () => window.close(),
    });
    onMove();
  } else {
    es = createScreenControl($(".lp-es-host"), {
      sid,
      say,
      state: () => ({ view: viewId, sound: sound.on }),
      // Inga dubbla ljud: tyst här bara när elevskärmen faktiskt kan spela (upplåst).
      onConnect: ({ connected, audio }) => { sound.mute(connected && audio); if (connected) es?.publish(); },
    });
    es.publish();
  }
  const onHide = () => link?.destroy();
  window.addEventListener("pagehide", onHide);

  function soundLabel() {
    const t = !sound.on ? "🔇 Ljud av" : sound.unlocked() ? "🔊 Ljud på" : "🔊 Klicka för ljud";
    const b = $("[data-sound]");
    if (b.textContent !== t) b.textContent = t;
    b.classList.toggle("lp-off", !sound.on);
  }

  function availableViews() {
    return VIEWS.filter((v) => !v.only2 || st?.classes.length === 2);
  }

  function pickView(id) {
    // Elevskärmen tar emot vyn även innan matchdatan kommit (st saknas än).
    if (screen && VIEWS.some((v) => v.id === id) && (!st || availableViews().some((v) => v.id === id))) {
      viewId = id;
      return draw();
    }
    if (!availableViews().some((v) => v.id === id)) return;
    viewId = id;
    try { localStorage.setItem(VIEW_KEY, id); } catch {}
    draw();
    es?.publish();
  }

  // --- Nedräkning + timer (10 ggr/s ur serverstämplarna) -------------------
  function showCount(n) {
    if (n === shownCount) return;
    shownCount = n;
    overlay.innerHTML = `<div class="lp-count lp-n${n}"><span>${n > 0 ? n : "KÖR!"}</span></div>`;
    if (n > 0) sound.tick(n);
    else sound.go();
  }

  function tick() {
    soundLabel();
    const s = st?.session;
    if (!s) return;
    const ph = phaseAt(s, d.now());
    if (ph.phase === "countdown") showCount(ph.countdown);
    else if (shownCount !== null) {
      shownCount = null;
      overlay.firstElementChild?.classList.add("ut");
      setTimeout(() => { if (shownCount === null && !overlay.querySelector(".lp-ended")) overlay.replaceChildren(); }, 600);
    }
    const t = formatClock(ph.msLeft);
    if (t !== clockText) {
      clockText = t;
      $("[data-clock]").textContent = t;
      $(".lp-timer").classList.toggle("lp-slut", ph.msLeft <= 60_000 && ph.phase !== "countdown");
    }
  }
  const iv = setInterval(tick, 100);

  // --- Faser ---------------------------------------------------------------
  function events() {
    const phase = st.phase;
    if (phase === "live" || phase === "countdown") sawLive = true;
    if (phase === "live") {
      if (prevTotal !== null && st.totalCorrect > prevTotal) sound.blip();
      const lead = st.leaderIds.length === 1 && st.totalCorrect > 0 ? st.leaderIds[0] : null;
      if (lead && prevLeader && lead !== prevLeader) sound.lead();
      prevLeader = lead || prevLeader;
    }
    prevTotal = st.totalCorrect;
    if ((phase === "ended" || phase === "finished") && prevPhase === "live") sound.end();
    if (phase === "finished" && prevPhase && prevPhase !== "finished" && sawLive && !ownsFinale()) setTimeout(() => sound.win(), 900);
    if (phase === "ended" && !overlay.querySelector(".lp-ended")) {
      overlay.innerHTML = `<div class="lp-ended">⏱ TIDEN ÄR UTE!</div>`;
    } else if (phase !== "ended") overlay.querySelector(".lp-ended")?.remove();
    prevPhase = phase;
  }

  // Vyn spelar själv matchslutet (Trollkarlsduellen) i stället för proj-winner.
  function ownsFinale() {
    return !!VIEWS.find((v) => v.id === viewId)?.finale && availableViews().some((v) => v.id === viewId);
  }

  function mountKind(kind, key, build) {
    current?.ui?.destroy();
    current = { kind, key, ui: build() };
  }

  function draw() {
    if (!st) return;
    const s = st.session;
    if (!s) {
      current?.ui?.destroy();
      current = null;
      stage.innerHTML = `<div class="lp-wait">Matchen finns inte (borttagen?).</div>`;
      return;
    }
    s.participatingClassIds.forEach((id, i) => { colors[id] = classColor(i); });
    $("[data-name]").textContent = `· ${s.name}`;
    const phase = st.phase;
    const playing = phase === "countdown" || phase === "live" || phase === "ended";
    const ownEnd = phase === "finished" && ownsFinale();
    const game = playing || ownEnd;
    const kind = phase === "lobby" ? "lobby" : phase === "finished" && !ownEnd ? "winner" : phase === "cancelled" ? "cancelled" : "game";
    if (playing && !availableViews().some((v) => v.id === viewId)) viewId = "raket";
    const key = game ? `${viewId}|${s.participatingClassIds.join(",")}` : kind;
    // Lobbyn med två klasser och Trollkarlsduellen vald: förladda vyn (§17).
    if (kind === "lobby" && viewId === "trollkarl" && st.classes.length === 2) loadTrollkarl().catch(() => {});

    // Efter slutet i en vy med egen final: vyflikarna kvar (annan vy = vanliga vinnarskärmen).
    $(".lp-views").hidden = !game;
    $("[data-end]").hidden = !playing;
    $(".lp-timer").hidden = !playing;
    root.dataset.kind = game ? viewId : kind;
    root.querySelectorAll("[data-view]").forEach((b) => {
      b.hidden = !availableViews().some((v) => v.id === b.dataset.view);
      b.setAttribute("aria-selected", String(b.dataset.view === viewId));
    });

    if (current?.key !== key) {
      if (kind === "lobby") {
        const mode = getGameMode(s.gameMode);
        mountKind(kind, key, () => createLobby(stage, { st, colors, modeName: mode ? mode.displayName : s.gameMode, actions, say, readonly: screen }));
      } else if (kind === "game") {
        const v = VIEWS.find((x) => x.id === viewId);
        mountKind(kind, key, () => v.create(stage, { st, colors, sound }));
      } else if (kind === "winner") {
        const fin = toMs(s.finishedAt);
        const celebrate = sawLive || (fin != null && d.now() - fin < CELEBRATE_MS);
        mountKind(kind, key, () => createWinner(stage, { st, colors, onBack: back, celebrate }));
      } else {
        mountKind(kind, key, () => {
          stage.innerHTML = `<div class="lp-wait">Matchen avbröts innan den startade.${back ? `<button class="lp-btn" data-back2>← Till Live</button>` : ""}</div>`;
          stage.querySelector("[data-back2]")?.addEventListener("click", back);
          return { update() {}, destroy() {} };
        });
      }
    } else current.ui.update(st);
    events();
    tick();
  }

  cleanups.push(d.subscribe(sid, (next) => { st = next; draw(); }, {
    teacher: true,
    uid,
    onError: (err) => say(`Anslutningen: ${err.message}`),
  }));
  cleanups.push(() => {
    clearInterval(iv);
    clearTimeout(idleT);
    clearTimeout(msgT);
    current?.ui?.destroy();
    es?.destroy();
    link?.destroy();
    chrome?.destroy();
    window.removeEventListener("pagehide", onHide);
    sound.destroy();
    document.removeEventListener("fullscreenchange", onFs);
    document.removeEventListener("keydown", onKey);
    if (document.fullscreenElement === root) document.exitFullscreen?.().catch(() => {});
  });
}
