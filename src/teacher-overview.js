// ============================================================================
// Pluggporten – lärarsidan: Översikt (teacher-overview.js, #679)
// ----------------------------------------------------------------------------
// #/larare/hem (Hem sedan #803; gamla #/larare/oversikt omdirigeras) – spec §5.1:
//   * Mina klasser: ett kort per klass (årskurskonto: bara kontots) med elevantal,
//     fokusläge-status och snabbval till Fokusläge, Inloggning och Statistik.
//   * Pågående Live: matcher i lobby/pågående (årskurskonto: där en av kontots
//     klasser deltar) med knapp till projektorvyn.
// Inga nya funktioner – bara genvägar in i Klasser, Statistik och Live.
// Laddas med import() ur TEACHER_TABS – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import * as data from "./data.js";
import { el, esc, icon, isTeacher, renderGate, teacherHead, teacherNav } from "./teacher-shared.js";
import { filterClasses, myRole } from "./teacher-role.js";
import { activeLock } from "./class-lock.js";
import { serverNow } from "./data-class-lock.js";

const klassHash = (base, id, sektion) =>
  `${base}?${new URLSearchParams(sektion ? { klass: id, sektion } : { klass: id })}`;

export async function pageLarareOversikt(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  ctx.app.replaceChildren(el(`<div class="spinner">Laddar översikten…</div>`));
  const startHash = window.location.hash;

  let classes = [];
  let role;
  try {
    [classes, role] = await Promise.all([data.getClasses(), myRole()]);
  } catch (err) {
    ctx.app.replaceChildren(el(`<div class="panel"><div class="msg error">Kunde inte ladda klasser: ${esc(err.message)}</div></div>`));
    return;
  }
  if (window.location.hash !== startHash) return;
  classes = filterClasses(classes, role);

  const page = el(`<div class="teacher-page teacher-dark ov-page">
    <section class="panel ov-block" aria-labelledby="ov-klasser">
      <h2 class="subhead ov-h" id="ov-klasser">${icon("users", 18)}<span>Mina klasser</span></h2>
      <div class="ov-classes"></div>
    </section>
    <section class="panel ov-block" aria-labelledby="ov-live">
      <h2 class="subhead ov-h" id="ov-live">${icon("bolt", 18)}<span>Pågående Live</span></h2>
      <div class="ov-live"><div class="spinner">Laddar…</div></div>
      <button type="button" class="btn ghost small" data-hash="#/larare/live">${icon("plus", 16)}<span>Skapa Live-match</span></button>
    </section>
  </div>`);
  page.prepend(teacherNav(ctx, "hem"), teacherHead(ctx, "hem"));

  const grid = page.querySelector(".ov-classes");
  const drawClasses = () => {
    const now = serverNow();
    grid.replaceChildren(
      ...(classes.length
        ? classes.map((c) => {
            const n = Array.isArray(c.studentIds) ? c.studentIds.length : 0;
            const lock = activeLock(c, now);
            return el(`<article class="ov-class">
              <header class="ov-class-head">
                <button type="button" class="ov-class-name" data-hash="${esc(klassHash("#/larare/klasser", c.id))}">${esc(c.name || c.id)}</button>
                <span class="class-count">${n} elev${n === 1 ? "" : "er"}</span>
              </header>
              <p class="ov-lock ${lock ? "on" : ""}">${icon("lock", 14)}<span>${lock ? "Fokusläge på" : "Fokusläge av"}</span></p>
              <div class="ov-quick">
                <button type="button" class="btn ghost small" data-hash="${esc(klassHash("#/larare/klasser", c.id, "fokus"))}">${icon("lock", 16)}<span>Fokusläge</span></button>
                <button type="button" class="btn ghost small" data-hash="${esc(klassHash("#/larare/klasser", c.id, "inloggning"))}">${icon("key", 16)}<span>Inloggning</span></button>
                <button type="button" class="btn ghost small" data-hash="${esc(klassHash("#/larare/statistik", c.id))}">${icon("chart", 16)}<span>Statistik</span></button>
              </div>
            </article>`);
          })
        : [el(`<p class="hint">${role.admin ? "Inga klasser än – skapa dem under Admin → Klasser &amp; elevkonton."
            : "Kontot har inga klasser än – admin väljer dem under Lärarkonton."}</p>`)])
    );
    wire(grid);
  };
  const wire = (root) =>
    root.querySelectorAll("[data-hash]").forEach((b) => b.addEventListener("click", () => ctx.go(b.dataset.hash)));
  drawClasses();
  wire(page.querySelector(".ov-live").parentElement);
  ctx.app.replaceChildren(page);

  // Pågående Live i realtid; lyssnaren stängs när sidan lämnas (rutan ur DOM:en).
  const liveHost = page.querySelector(".ov-live");
  const mine = (s) =>
    role.admin || (s.participatingClassIds || []).some((id) => role.classIds.has(id));
  let unsub = () => {};
  try {
    const { watchActiveSessions } = await import("./live/live-data.js");
    unsub = watchActiveSessions(
      (list) => drawLive(ctx, liveHost, list.filter(mine)),
      () => liveHost.replaceChildren(el(`<p class="hint">Kunde inte läsa Live-matcher just nu.</p>`))
    );
  } catch {
    liveHost.replaceChildren(el(`<p class="hint">Kunde inte läsa Live-matcher just nu.</p>`));
  }
  const tick = setInterval(() => {
    if (!page.isConnected) return void (clearInterval(tick), unsub());
    drawClasses(); // ett passerat klockslag släcker fokusläget
  }, 15000);
}

function drawLive(ctx, host, list) {
  if (!host.isConnected) return;
  if (!list.length) {
    host.replaceChildren(el(`<p class="hint">Inga pågående matcher.</p>`));
    return;
  }
  const ul = el(`<ul class="ov-live-list">${list
    .map((s) => `<li class="ov-live-item"><span><b>${esc(s.name || "Live-match")}</b>
        <span class="hint">${s.status === "lobby" ? "Lobby" : "Pågår"}${s.createdByName ? ` · ${esc(s.createdByName)}` : ""}</span></span>
        <button type="button" class="btn small" data-hash="${esc(`#/larare/live?id=${s.id}`)}">Öppna projektorvy</button></li>`)
    .join("")}</ul>`);
  ul.querySelectorAll("[data-hash]").forEach((b) => b.addEventListener("click", () => ctx.go(b.dataset.hash)));
  host.replaceChildren(ul);
}
