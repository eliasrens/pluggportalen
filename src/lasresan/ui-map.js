// ============================================================================
// Läsresan – kartvyn (src/lasresan/ui-map.js)  ·  issue #400
// ----------------------------------------------------------------------------
// KONTRAKT (docs/LASRESAN.md §4):
//
//   renderJourneyMap(container, {
//     world,            // värld ur worlds/index.js (den som ska visas)
//     progress,         // { worldId, stepInWorld, completedWorlds } (ALDRIG nivån)
//     avatar,           // { avatarId, avatarItems } – ritas med avatarMarkup
//     animateFromStep,  // number|null: gå från detta steg till progress-läget
//     onStartNext,      // () => void: eleven klickar på nästa steg
//     // Valfria extrafält (#401-sidan): walk {worldId,fromStep,toStep},
//     // worldCompleted (bool). Okända fält tåls och ignoreras.
//   }) → { destroy() }
//
// Kartrenderaren är HELT världs-agnostisk: scenen ritas av world.scene.render
// och all geometri kommer ur världens config. Stegmarkörer, avatar,
// gånganimation, firande och världsväljaren är generiska.
// Ingen nivå visas någonsin. prefers-reduced-motion → hopp i stället för gång.
// ============================================================================

import { avatarMarkup } from "../avatars.js";
import { WORLDS, isWorldUnlocked, nextWorld } from "./worlds/index.js";
import { walkPoints } from "./worlds/stig.js";
import { ensureMapCss } from "./ui-map-stil.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const KONFETTI_FARGER = ["#F7C948", "#6FC66F", "#7FC7E8", "#F890B7", "#EF6F6C", "#B79BE0"];

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- SVG-byggdelar (generiska – färger ur världens palette) -----------------

/** Stegmarkör. status: "klar" | "nasta" | "last". */
function stegMarkup(pos, status, pal, nr) {
  const x = pos.x, y = pos.y;
  if (status === "klar") {
    return (
      `<g class="lr-steg lr-steg--klar" transform="translate(${x} ${y})">` +
      `<circle r="17" fill="${pal.stepDone}" stroke="#3B3350" stroke-width="3.5"/>` +
      `<path d="M-7 0 L-2 5.5 L8 -5" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</g>`
    );
  }
  if (status === "nasta") {
    return (
      `<g class="lr-steg lr-steg--nasta" data-lr-nasta tabindex="0" role="button" aria-label="Spela steg ${nr}" transform="translate(${x} ${y})">` +
      `<circle class="lr-puls" r="26" fill="none" stroke="${pal.stepNext}" stroke-width="5"/>` +
      `<circle class="lr-steg-ring" r="23" fill="${pal.stepNext}" stroke="#3B3350" stroke-width="4"/>` +
      `<path d="M-6 -10 L12 0 L-6 10 Z" fill="#3B3350"/>` +
      `<circle r="46" fill="transparent"/>` + // stor klickyta (surfplatta)
      `</g>`
    );
  }
  return (
    `<g class="lr-steg lr-steg--last" transform="translate(${x} ${y})">` +
    `<circle r="13" fill="${pal.stepLocked}" stroke="#3B3350" stroke-width="3" opacity="0.75"/>` +
    `<circle r="4" fill="#3B3350" opacity="0.45"/>` +
    `</g>`
  );
}

/** Avatar-gruppen: foreignObject med portalens vanliga avatar-markup.
 *  Fotpunkten ligger i gruppens origo, så translate(x y) ställer figuren på
 *  stigen. 110 världspixlar bred (figuren är 1em × 1.2em). */
function avatarGroup(avatar) {
  const inner = avatar ? avatarMarkup(avatar.avatarId, avatar.avatarItems || []) : "";
  return (
    `<g class="lr-avatar">` +
    `<ellipse cx="0" cy="2" rx="34" ry="10" fill="#3B3350" opacity="0.16"/>` +
    `<foreignObject x="-55" y="-128" width="110" height="134">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" class="lr-avatar-inner" style="font-size:110px">${inner}</div>` +
    `</foreignObject></g>`
  );
}

// --- Själva vyn --------------------------------------------------------------

export function renderJourneyMap(container, opts = {}) {
  const { world, progress, avatar, onStartNext } = opts;
  ensureMapCss();
  const ac = new AbortController();
  const signal = ac.signal;
  let walkAnim = null;
  let visadVarldId = world ? world.id : null;

  const completed = (progress && progress.completedWorlds) || [];
  // Hur långt har eleven kommit i DEN VISADE världen?
  function lage(v) {
    if (progress && v.id === progress.worldId) return Math.min(progress.stepInWorld, v.steps);
    if (completed.includes(v.id)) return v.steps;
    // Världen som visas under en världsbytes-gång (#401 skickar gamla världen
    // med progress för den): allt klart utom det som animeras.
    if (world && v.id === world.id && progress && progress.worldId === world.id) return progress.stepInWorld;
    return -1; // låst/kommande värld: inga klara steg, inget klickbart
  }

  function rita() {
    const v = visadVarldId === world.id ? world : WORLDS.find((w) => w.id === visadVarldId) || world;
    const arAktiv = progress && v.id === (world && world.id) && v.id === progress.worldId;
    const at = lage(v);
    const pal = v.palette || { stepDone: "#6FC66F", stepNext: "#F7C948", stepLocked: "#E9DFC8" };
    const scen = v.scene && typeof v.scene.render === "function" ? v.scene.render(v) : "";
    const stegen = v.stepPositions
      .map((p, i) => {
        const nr = i + 1;
        const status = at >= nr ? "klar" : arAktiv && at >= 0 && nr === at + 1 && at < v.steps ? "nasta" : "last";
        return stegMarkup(p, status, pal, nr);
      })
      .join("");
    // Avataren står bara i världen vyn fick in (där eleven ÄR just nu).
    const medAvatar = v.id === world.id && avatar;
    container.innerHTML =
      `<div class="lr-karta" data-varld="${v.id}">` +
      `<svg class="lr-scen" viewBox="0 0 ${v.scene.width} ${v.scene.height}" role="img" aria-label="${v.name}">` +
      scen + stegen + (medAvatar ? avatarGroup(avatar) : "") +
      `</svg>` +
      varldsPills(v) +
      `</div>`;

    const nastaEl = container.querySelector("[data-lr-nasta]");
    if (nastaEl && onStartNext) {
      const start = (e) => { e.preventDefault(); onStartNext(); };
      nastaEl.addEventListener("click", start, { signal });
      nastaEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") start(e);
      }, { signal });
    }
    for (const btn of container.querySelectorAll("[data-lr-varld]")) {
      btn.addEventListener("click", () => {
        visadVarldId = btn.getAttribute("data-lr-varld");
        rita();
      }, { signal });
    }
    return { v, at, medAvatar };
  }

  /** Världsväljaren: en pill per värld (klara ✓, aktiv, låsta 🔒). Visas bara
   *  när det finns mer än en värld att titta på. */
  function varldsPills(visad) {
    if (WORLDS.length < 2) return "";
    const pills = WORLDS.map((v) => {
      const oppen = isWorldUnlocked(v, completed) || (progress && v.id === progress.worldId);
      const klar = completed.includes(v.id);
      const ikon = klar ? "✓ " : oppen ? "" : "🔒 ";
      return (
        `<button type="button" class="lr-varld-pill" data-lr-varld="${v.id}"` +
        ` aria-pressed="${v.id === visad.id}" ${oppen ? "" : "disabled"}>${ikon}${v.name}</button>`
      );
    }).join("");
    return `<div class="lr-varldar" role="group" aria-label="Världar">${pills}</div>`;
  }

  /** Ställ avataren på ett steg (0 = startpunkten). */
  function stall(g, v, steg) {
    const p = steg <= 0 ? v.start : v.stepPositions[Math.min(steg, v.steps) - 1];
    g.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  /** Gånganimationen: avataren vandrar längs stigens exakta kurva. */
  function ga(g, v, fran, till) {
    if (fran == null || fran === till) return Promise.resolve();
    if (reducedMotion() || typeof g.animate !== "function") {
      stall(g, v, till);
      return Promise.resolve();
    }
    const punkter = walkPoints(v, fran, till);
    const frames = punkter.map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` }));
    const dur = Math.min(3200, 600 + 1000 * Math.abs(till - fran));
    stall(g, v, fran);
    g.classList.add("lr-avatar--gar");
    walkAnim = g.animate(frames, { duration: dur, easing: "ease-in-out", fill: "forwards" });
    return walkAnim.finished
      .catch(() => {})
      .then(() => {
        g.classList.remove("lr-avatar--gar");
        if (!signal.aborted) stall(g, v, till);
      });
  }

  /** Firande när en värld är klar: konfetti + "nästa värld öppnas". */
  function fira(v) {
    const karta = container.querySelector(".lr-karta");
    if (!karta || karta.querySelector(".lr-firande")) return;
    const nasta = nextWorld(v.id);
    const bitar = reducedMotion()
      ? ""
      : Array.from({ length: 26 }, (_, i) => {
          const f = KONFETTI_FARGER[i % KONFETTI_FARGER.length];
          const left = (i * 137) % 100;
          const dur = 2.2 + ((i * 53) % 17) / 10;
          const delay = ((i * 31) % 12) / 10;
          return `<span class="lr-konfetti" style="left:${left}%;background:${f};animation-duration:${dur}s;animation-delay:${delay}s"></span>`;
        }).join("");
    const el = document.createElement("div");
    el.className = "lr-firande";
    el.innerHTML =
      bitar +
      `<div class="lr-firande-kort"><div class="lr-stor">🎉</div>` +
      `<h3>${v.name} är klar!</h3>` +
      (nasta ? `<p>🔓 ${nasta.name} öppnas!</p>` : `<p>Du har klarat hela resan! ⭐</p>`) +
      `</div>`;
    el.addEventListener("click", () => el.remove(), { signal });
    karta.appendChild(el);
  }

  // --- Körning ---------------------------------------------------------------
  const { v, at, medAvatar } = rita();
  const g = container.querySelector(".lr-avatar");
  if (g && medAvatar) {
    const fran = Number.isFinite(opts.animateFromStep) ? opts.animateFromStep : null;
    stall(g, v, fran == null ? at : fran);
    ga(g, v, fran, at).then(() => {
      // Fira bara i samband med en genomförd gång/världsbyte – inte varje
      // gång en redan klar värld ritas om.
      if (!signal.aborted && (fran != null || opts.worldCompleted) && at >= v.steps) fira(v);
    });
  } else if (!signal.aborted && opts.worldCompleted && v.id === world.id) {
    fira(v);
  }

  return {
    destroy() {
      if (walkAnim) walkAnim.cancel();
      ac.abort();
    },
  };
}
