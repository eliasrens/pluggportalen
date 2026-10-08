// ============================================================================
// Live – lärarmodulen #/larare/live (#460)
// ----------------------------------------------------------------------------
//   #/larare/live              skapa match + Aktiva Live-sessioner (ALLA lärares,
//                              realtid) + historik
//   #/larare/live?id=<sid>     projektorvyn (projector.js, #461)
//   #/larare/live?id=<sid>&skarm=elev  elevskärmen: utvidgad skärm utan
//                              kontroller, styrs från projektorvyn (#533)
//   #/larare/live?historik=<sid>  en avslutad matchs resultat + elevresultat
// Sessionerna lever i Firestore – vilken lärare som helst kan öppna/starta
// vilken session som helst, och en omladdning hittar tillbaka till samma läge.
// Laddas DYNAMISKT via TEACHER_TABS (#271).
// ============================================================================

import { el, esc, isTeacher, renderGate, teacherNav, teacherHead } from "../teacher-shared.js";
import { getParams } from "../ui.js";
import { auth } from "../firebase-config.js";
import * as data from "../data.js";
import { getGameMode } from "./modes/index.js";
import { watchActiveSessions, autoFinish } from "./live-data.js";
import { serverNow, syncLiveClock } from "./live-clock.js";
import { phaseAt, formatClock } from "./live-core.js";
import { renderCreateForm } from "./teacher-live-form.js";
import { renderHistoryList, renderHistoryDetail } from "./teacher-live-history.js";
import { ensureLiveCss, onLeaveRoute } from "./live-css.js";

let activeCleanup = null;

export async function pageLarareLive(ctx) {
  activeCleanup?.();
  activeCleanup = null;
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  ensureLiveCss();
  const uid = auth.currentUser?.uid || "larare";
  syncLiveClock(uid);
  const cleanups = [];
  const cleanup = () => cleanups.splice(0).forEach((fn) => { try { fn(); } catch {} });
  activeCleanup = cleanup;
  cleanups.push(onLeaveRoute("/larare/live", () => { cleanup(); activeCleanup = null; }));

  const params = getParams();
  if (params.id) {
    const { mountProjector } = await import("./projector.js");
    return mountProjector(ctx, params.id, { cleanups, uid, screen: params.skarm === "elev" });
  }

  const page = el(`<div class="teacher-page teacher-dark live-teacher"></div>`);
  page.appendChild(teacherNav(ctx, "live"));
  page.appendChild(teacherHead(ctx, "live"));
  ctx.app.replaceChildren(page);

  if (params.historik) {
    const host = el(`<div></div>`);
    page.appendChild(host);
    return renderHistoryDetail(ctx, host, params.historik);
  }

  const grid = el(`<div class="live-teacher-grid">
    <div class="live-col-create"></div>
    <div class="live-col-side">
      <section class="panel live-active"><h2 class="live-h2">Aktiva Live-sessioner</h2><div class="live-active-list"><div class="spinner">Laddar…</div></div></section>
      <section class="panel live-history"><h2 class="live-h2">Historik</h2><div class="live-history-list"></div></section>
    </div></div>`);
  page.appendChild(grid);

  const classes = await data.getClasses().catch(() => []);
  const email = auth.currentUser?.email || "";
  renderCreateForm(grid.querySelector(".live-col-create"), {
    classes,
    uid,
    createdByName: email.split("@")[0] || "",
    onCreated: (sid) => ctx.go(`#/larare/live?id=${sid}`),
  });

  // Aktiva sessioner (alla lärares) i realtid + klocka per sekund.
  const listHost = grid.querySelector(".live-active-list");
  let active = [];
  const draw = () => drawActive(ctx, listHost, active);
  const unsub = watchActiveSessions((list) => { active = list; draw(); }, (err) => {
    listHost.replaceChildren(el(`<p class="err-inline">Kunde inte läsa sessioner: ${esc(err.message)}</p>`));
  });
  const iv = setInterval(draw, 1000);
  cleanups.push(unsub, () => clearInterval(iv));

  renderHistoryList(ctx, grid.querySelector(".live-history-list"));
}

function statusText(s) {
  const ph = phaseAt(s, serverNow());
  if (ph.phase === "lobby") return { cls: "lobby", txt: "Lobby – väntar på start" };
  if (ph.phase === "countdown") return { cls: "live", txt: "Startar…" };
  if (ph.phase === "live") return { cls: "live", txt: `Pågår · ${formatClock(ph.msLeft)} kvar` };
  return { cls: "ended", txt: "Tiden är ute" };
}

// En match vars tid gått ut utan att någon projektor var öppen markeras klar
// härifrån (vilken klient som helst får, reglerna kollar tiden).
const finishTried = new Set();

function drawActive(ctx, host, list) {
  for (const s of list) {
    if (phaseAt(s, serverNow()).phase === "ended" && !finishTried.has(s.id)) {
      finishTried.add(s.id);
      autoFinish(s.id);
    }
  }
  if (!list.length) {
    host.replaceChildren(el(`<p class="hint">Inga pågående matcher. Skapa en till vänster.</p>`));
    return;
  }
  const html = list.map((s) => {
    const st = statusText(s);
    const mode = getGameMode(s.gameMode);
    return `<li class="live-active-item">
      <div><b>${esc(s.name)}</b> <span class="live-status ${st.cls}">${esc(st.txt)}</span>
        <div class="hint">${esc(mode ? mode.displayName : s.gameMode)} · ${Math.round((s.durationSeconds || 0) / 60)} min${
          s.createdByName ? ` · skapad av ${esc(s.createdByName)}` : ""}</div></div>
      <button class="btn small" data-open="${esc(s.id)}">Öppna projektorvy</button></li>`;
  }).join("");
  const ul = el(`<ul class="live-active-ul">${html}</ul>`);
  ul.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => ctx.go(`#/larare/live?id=${b.dataset.open}`)));
  host.replaceChildren(ul);
}
