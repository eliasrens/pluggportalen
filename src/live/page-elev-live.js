// ============================================================================
// Live – elevens sida #/elev/live[?id=<sid>] (#460)
// ----------------------------------------------------------------------------
// Extremt enkel: lobby ("4B MOT 5E – Väntar på start…") → gemensam 3-2-1-KÖR
// (server-tid) → bara fråga + svarsfält + snabb feedback → "Matchen är slut".
// Ingen timer och ingen stor statistik på elevskärmen (spec). Allt tillstånd
// kommer från Firestore, så omladdning/avbrott = samma session igen.
// Sen anslutning: är matchen redan LIVE går eleven direkt in i spelet.
// Laddas DYNAMISKT från app.js (#271).
// ============================================================================

import { app, el, go, renderTopbar, loading, getParams, escHtml } from "../ui.js";
import * as data from "../data.js";
import { requireGameMode } from "./modes/index.js";
import { mountFastAnswer } from "../mult/fast-answer.js";
import { watchActiveSessions, watchMyPlayer, joinLiveSession, heartbeat, submitLiveAnswer, getSession } from "./live-data.js";
import { subscribeLiveSession } from "./live-feed.js";
import { serverNow, syncLiveClock } from "./live-clock.js";
import { sessionTitle, sessionTimes, formatScore } from "./live-core.js";
import { relevantSessions } from "./live-watch.js";
import { ensureLiveCss, onLeaveRoute } from "./live-css.js";

const HEARTBEAT_MS = 25_000;
let activeCleanup = null;

export async function pageElevLive() {
  activeCleanup?.();
  activeCleanup = null;
  const uid = data.currentStudentId();
  if (!uid) return go("#/");
  renderTopbar();
  ensureLiveCss();
  loading("Letar efter Live-matcher…");
  syncLiveClock(uid);

  const myClassIds = (await data.getClasses().catch(() => []))
    .filter((c) => Array.isArray(c.studentIds) && c.studentIds.includes(uid))
    .map((c) => c.id);
  const cleanups = [];
  const cleanup = () => cleanups.splice(0).forEach((fn) => { try { fn(); } catch {} });
  activeCleanup = cleanup;
  cleanups.push(onLeaveRoute("/elev/live", () => { cleanup(); activeCleanup = null; }));

  const wantId = getParams().id;
  if (wantId) {
    const s = await getSession(wantId).catch(() => null);
    if (!s || !s.participatingClassIds?.some((id) => myClassIds.includes(id))) {
      return renderMessage("🤔", "Den här Live-matchen hittades inte", "Din klass är inte med i den matchen.");
    }
    return mountSession(s, { uid, myClassIds, cleanups });
  }

  // Ingen vald: välj automatiskt om det bara finns en för elevens klasser.
  let chosen = false;
  const unsub = watchActiveSessions((all) => {
    if (chosen) return;
    const mine = relevantSessions(all, myClassIds, serverNow());
    if (mine.length === 1) {
      chosen = true;
      history.replaceState(history.state, "", `#/elev/live?id=${mine[0].id}`);
      return mountSession(mine[0], { uid, myClassIds, cleanups });
    }
    if (!mine.length) return renderMessage("⚡", "Ingen Live-match just nu", "När din lärare startar en Live-match dyker den upp här.");
    renderList(mine);
  }, () => renderMessage("😕", "Kunde inte läsa Live-matcher", "Prova att ladda om sidan."));
  cleanups.push(() => unsub());
}

function renderMessage(emoji, title, text) {
  app.replaceChildren(el(`<div class="panel center live-elev-msg">
    <div class="big-emoji">${emoji}</div><h2>${escHtml(title)}</h2><p class="hint">${escHtml(text)}</p>
    <button class="btn" id="live-hem">Till Hem</button></div>`));
  app.querySelector("#live-hem").addEventListener("click", () => go("#/elev/hus"));
}

function renderList(list) {
  app.replaceChildren(el(`<div class="panel live-elev-list"><h2>⚡ Live-matcher</h2>
    ${list.map((s) => `<button class="btn stor live-elev-pick" data-id="${escHtml(s.id)}">${escHtml(sessionTitle(s))}
      <small>${s.status === "live" ? "Pågår – hoppa in!" : "Väntar på start"}</small></button>`).join("")}</div>`));
  app.querySelectorAll(".live-elev-pick").forEach((b) => b.addEventListener("click", () => go(`#/elev/live?id=${b.dataset.id}`)));
}

/** Själva matchvyn för en session. */
function mountSession(initial, { uid, myClassIds, cleanups }) {
  const classId = initial.participatingClassIds.find((id) => myClassIds.includes(id));
  let mode;
  try {
    mode = requireGameMode(initial.gameMode);
  } catch {
    return renderMessage("🧩", "Okänt spelläge", "Den här matchen använder ett spelläge som inte finns i din version – ladda om sidan.");
  }
  const view = el(`<div class="live-elev">
    <header class="live-elev-head"><span class="live-elev-badge">⚡ LIVE</span>
      <h1 class="live-elev-title">${escHtml(sessionTitle(initial))}</h1>
      <span class="live-elev-me"></span></header>
    <div class="live-elev-stage">
      <div class="live-elev-lobby" hidden>
        <p class="live-elev-wait">Väntar på start…</p>
        <button class="btn stor gron live-elev-join" hidden>Gå med i Live-match</button>
        <p class="live-elev-ready hint" hidden>✅ Du är redo! Matchen startar automatiskt.</p>
      </div>
      <div class="live-elev-count" hidden aria-live="assertive"></div>
      <div class="live-elev-play" hidden><div class="live-elev-fa"></div></div>
      <div class="live-elev-end" hidden></div>
    </div></div>`);
  app.replaceChildren(view);
  const $ = (s) => view.querySelector(s);

  let player = null;
  let joining = null;
  let st = null;
  let lastAnswerAt = 0;
  let fa = null;

  const join = () => {
    joining ||= joinLiveSession(initial.id, { uid, classId })
      .catch((err) => {
        joining = null;
        console.warn("Live: kunde inte gå med", err);
        $(".live-elev-wait").textContent = "Kunde inte gå med – försöker igen…";
        setTimeout(render, 3000);
      });
    return joining;
  };
  $(".live-elev-join").addEventListener("click", () => join());

  function ensureFa() {
    if (fa) return fa;
    fa = mountFastAnswer($(".live-elev-fa"), {
      source: mode.createSource(),
      check: mode.checkAnswer,
      inputMode: mode.inputMode,
      enabled: false,
      idleText: "Väntar…",
      onAnswer: (attempt) => {
        const { endMs } = sessionTimes(st?.session);
        // Svar efter officiell sluttid räknas inte (reglerna nekar också).
        if (endMs == null || serverNow() >= endMs) return;
        lastAnswerAt = Date.now();
        return submitLiveAnswer({ session: st.session, uid, classId, mode, attempt });
      },
    });
    cleanups.push(() => fa?.destroy());
    return fa;
  }

  function show(part) {
    for (const k of ["lobby", "count", "play", "end"]) $(`.live-elev-${k}`).hidden = k !== part;
  }

  function render() {
    if (!st) return;
    const s = st.session;
    if (!s) return renderMessage("🤔", "Matchen finns inte längre", "Läraren har tagit bort den.");
    $(".live-elev-me").textContent = player && st.phase !== "lobby" ? `${player.correct || 0} rätt` : "";
    // Sen anslutning: matchen har startat → gå med automatiskt.
    if (!player && (st.phase === "countdown" || st.phase === "live")) join();
    if (st.phase === "lobby") {
      show("lobby");
      $(".live-elev-join").hidden = !!player;
      $(".live-elev-ready").hidden = !player;
      $(".live-elev-wait").textContent = "Väntar på start…";
      return;
    }
    if (st.phase === "countdown") {
      show("count");
      const c = $(".live-elev-count");
      const txt = st.countdown > 0 ? String(st.countdown) : "KÖR!";
      if (c.textContent !== txt) {
        c.textContent = txt;
        c.classList.remove("pop");
        void c.offsetWidth;
        c.classList.add("pop");
      }
      ensureFa().setEnabled(false, "Snart…");
      return;
    }
    if (st.phase === "live") {
      show("play");
      ensureFa().setEnabled(!!player, player ? undefined : "Ansluter…");
      return;
    }
    fa?.setEnabled(false, "Matchen är slut!");
    show("end");
    $(".live-elev-end").innerHTML = endHtml(st, player, classId);
  }

  cleanups.push(subscribeLiveSession(initial.id, (next) => { st = next; render(); }, { teacher: false, uid }));
  cleanups.push(watchMyPlayer(initial.id, uid, (p) => {
    player = p;
    if (p) joining = null;
    render();
  }, (e) => console.warn("Live: spelardokumentet", e)));
  const hb = setInterval(() => {
    if (!player || !st) return;
    const lobbyish = st.phase === "lobby" || st.phase === "countdown";
    const idle = st.phase === "live" && Date.now() - lastAnswerAt > HEARTBEAT_MS;
    if (lobbyish || idle) heartbeat(initial.id, uid).catch(() => {});
  }, HEARTBEAT_MS);
  cleanups.push(() => clearInterval(hb));
}

function endHtml(st, player, classId) {
  if (st.phase === "cancelled") return `<div class="big-emoji">🛑</div><h2>Matchen avbröts</h2>`;
  const mine = player ? `<p class="live-elev-mine">Du fick <b>${player.correct || 0}</b> rätt! 🎉</p>` : "";
  const r = st.result;
  if (!r) return `<div class="big-emoji">⏱️</div><h2>Matchen är slut!</h2>${mine}<p class="hint">Resultatet räknas ihop…</p>`;
  const names = st.session.classNames || {};
  const rows = Object.entries(r.perClass || {})
    .sort((a, b) => b[1].score - a[1].score)
    .map(([id, c]) => `<li class="${id === classId ? "mig" : ""}"><b>${escHtml(names[id] || id)}</b> ${formatScore(c.score)} poäng/elev</li>`)
    .join("");
  const head = r.winner === "draw"
    ? `<h2>🤝 OAVGJORT!</h2>`
    : `<h2>🏆 VINNARE – ${escHtml(names[r.winner] || r.winner)}!</h2>`;
  return `${head}<ul class="live-elev-result">${rows}</ul>${mine}`;
}
