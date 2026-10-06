// ============================================================================
// Live – FUNKTIONELL projektorvy (#460, placeholder tills #461:s grafiska vyer)
// ----------------------------------------------------------------------------
// Medvetet enkel: visar exakt det realtids-datalagret (live-feed.js) levererar
// så hela flödet kan testas end-to-end – lobby (redo per klass, nämnare,
// STARTA MATCH) → 3-2-1-KÖR → stor timer + poäng/elev + topplista →
// vinnarskärm. #461 byter ut renderingen; datat och knapparnas API är kvar:
//   startLiveSession(sid), finishLiveSession(sid), setClassDivisor(sid, id, n)
//   subscribeLiveSession(sid, cb)  (se live-feed.js)
//
// API: mountProjector(ctx, sid, { cleanups, uid })
// ============================================================================

import { el, esc } from "../teacher-shared.js";
import { getGameMode } from "./modes/index.js";
import { subscribeLiveSession } from "./live-feed.js";
import { startLiveSession, finishLiveSession, setClassDivisor } from "./live-data.js";
import { formatScore, sessionTitle } from "./live-core.js";

export function mountProjector(ctx, sid, { cleanups, uid }) {
  const view = el(`<div class="teacher-page teacher-dark live-proj">
    <div class="live-proj-bar">
      <a class="back-link" data-back>← Live</a>
      <span class="live-proj-mode"></span>
      <button class="btn small ghost" data-fs>⛶ Fullskärm</button>
    </div>
    <h1 class="live-proj-title">…</h1>
    <div class="live-proj-body"><div class="spinner">Ansluter till matchen…</div></div>
    <div class="live-proj-msg"></div>
  </div>`);
  ctx.app.replaceChildren(view);
  const $ = (s) => view.querySelector(s);
  $("[data-back]").addEventListener("click", () => ctx.go("#/larare/live"));
  $("[data-fs]").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else view.requestFullscreen?.().catch(() => {});
  });
  const say = (html) => ($(".live-proj-msg").innerHTML = html);

  let drawnPhase = "";
  let st = null;

  function lobbyHtml() {
    return `<div class="live-proj-classes">${st.classes.map((c) => `<div class="live-proj-class">
        <div class="live-proj-cname">${esc(c.name)}</div>
        <div class="live-proj-big" data-ready="${esc(c.classId)}">${c.ready}</div><div>elever redo</div>
        <label class="live-proj-div">Nämnare <input type="number" min="1" max="999" value="${c.divisor}" data-div="${esc(c.classId)}" /></label>
      </div>`).join("")}</div>
      <p class="live-proj-len">Matchtid: ${Math.round(st.session.durationSeconds / 60)} min · Väntar på start…</p>
      <div class="live-proj-actions"><button class="btn stor gron live-proj-start" data-start>STARTA MATCH</button>
        <button class="btn small danger" data-cancel>Avbryt matchen</button></div>`;
  }

  function liveHtml() {
    return `<div class="live-proj-clock" data-clock></div>
      <div class="live-proj-classes" data-scores></div>
      <div class="live-proj-top"><h3>Topplista</h3><ol data-top></ol></div>
      <div class="live-proj-actions"><button class="btn small danger" data-end>Avsluta matchen nu</button></div>`;
  }

  function wire() {
    view.querySelector("[data-start]")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await startLiveSession(sid);
      } catch (err) {
        say(`<div class="msg error">Kunde inte starta: ${esc(err.message)}</div>`);
        e.target.disabled = false;
      }
    });
    view.querySelector("[data-cancel]")?.addEventListener("click", () => {
      if (confirm("Avbryta matchen? Eleverna i lobbyn får se att den avbröts.")) finishLiveSession(sid).catch((err) => say(esc(err.message)));
    });
    view.querySelector("[data-end]")?.addEventListener("click", () => {
      if (confirm("Avsluta matchen NU, före tiden? Resultatet räknas som det står.")) finishLiveSession(sid).catch((err) => say(esc(err.message)));
    });
    view.querySelectorAll("[data-div]").forEach((inp) => inp.addEventListener("change", () => {
      setClassDivisor(sid, inp.dataset.div, inp.value).then(() => say(""))
        .catch((err) => say(`<div class="msg error">${esc(err.message)}</div>`));
    }));
  }

  function update() {
    const body = $(".live-proj-body");
    if (st.phase === "lobby") {
      // Rita inte om medan läraren skriver i ett nämnar-fält – uppdatera bara "redo".
      st.classes.forEach((c) => {
        const r = view.querySelector(`[data-ready="${CSS.escape(c.classId)}"]`);
        if (r) r.textContent = c.ready;
      });
    } else if (st.phase === "countdown") {
      body.querySelector(".live-proj-count").textContent = st.countdown > 0 ? st.countdown : "KÖR!";
    } else if (st.phase === "live" || st.phase === "ended") {
      $("[data-clock]").textContent = `${st.clock} kvar`;
      $("[data-scores]").innerHTML = st.classes.map((c) => `<div class="live-proj-class${st.leaderIds.length === 1 && st.leaderIds[0] === c.classId ? " leder" : ""}">
          <div class="live-proj-cname">${esc(c.name)}</div>
          <div class="live-proj-big">${formatScore(c.score)}</div>
          <div>${c.correct} rätt / ${c.divisor} elever</div><small>${c.joined} anslutna</small></div>`).join("");
      $("[data-top]").innerHTML = st.top.map((p) => `<li>${esc(p.name)} <small>(${esc(st.session.classNames?.[p.classId] || p.classId)})</small> – <b>${p.correct}</b></li>`).join("");
    }
  }

  function draw() {
    const s = st.session;
    if (!s) {
      $(".live-proj-body").replaceChildren(el(`<p class="msg error">Matchen finns inte (borttagen?).</p>`));
      return;
    }
    $(".live-proj-title").textContent = sessionTitle(s).replace(/ MOT /g, " VS ");
    const mode = getGameMode(s.gameMode);
    $(".live-proj-mode").textContent = `⚡ MATTEMATCH LIVE · ${mode ? mode.displayName : s.gameMode} · ${s.name}`;
    const phase = st.phase === "ended" ? "live" : st.phase;
    if (phase !== drawnPhase) {
      drawnPhase = phase;
      const body = $(".live-proj-body");
      if (phase === "lobby") body.innerHTML = lobbyHtml();
      else if (phase === "countdown") body.innerHTML = `<div class="live-proj-count"></div>`;
      else if (phase === "live") body.innerHTML = liveHtml();
      else if (phase === "cancelled") body.innerHTML = `<p class="live-proj-len">Matchen avbröts.</p>`;
      else body.innerHTML = `<div class="live-proj-winner"></div>`;
      wire();
    }
    if (phase === "finished") {
      const head = st.draw ? "🤝 OAVGJORT!" : `🏆 VINNARE – ${esc(st.classes.find((c) => c.classId === st.winnerId)?.name || "")}!`;
      $(".live-proj-winner").innerHTML = `<h2>${head}</h2>${st.classes.map((c) => `<p><b>${esc(c.name)}</b>: ${formatScore(c.score)} poäng/elev
        <small>(${c.correct} rätt / ${c.divisor})</small></p>`).join("")}
        <p class="hint">${st.result ? "Resultatet är sparat i historiken." : "Sparar resultatet…"}</p>`;
      return;
    }
    update();
  }

  cleanups.push(subscribeLiveSession(sid, (next) => { st = next; draw(); }, {
    teacher: true,
    uid,
    onError: (err) => say(`<div class="msg error">Anslutningen: ${esc(err.message)}</div>`),
  }));
}
