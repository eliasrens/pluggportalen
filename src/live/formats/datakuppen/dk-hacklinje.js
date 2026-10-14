// ============================================================================
// Datakuppen – Nätverket (#654, spec §4.2): HACK-LJUSLINJEN. Ett lyckat hack
// = en kort ljuslinje (≈ 1 s) som löper längs en kretsbana från hackarens
// server till målets, en liten ring vid målet, sedan tonar den bort.
// Linjen får ALDRIG skymma timer, topplista eller text (spec test 21):
//   • lagret ligger INNE i golvet (under den fredade översta raden, vid
//     sidan av terminalen) och klipps av golvets kant
//   • lagret ligger UNDER serverplatserna (avatarer, skåp och skyltarna,
//     som har egen mörk platta) – linjen syns bara i mellanrummen
// Står bara en av eleverna i topp 10 går linjen till/från golvets högra kant
// (mot terminalen, där raden står); ingen av dem → ingen linje.
// Högst MAX linjer samtidigt – fler hoppas över (terminalen har ändå raden).
// Reducerad rörelse: hela banan tonar in och ut, inget som rör sig.
//
// API
//   createHacklinje(golv, { point(uid) → { x, y } | null, lift?() → px }) → {
//     lift = hur högt över skåpets mitt banan går tvärs (figurens höjd: ovanför
//     avatarerna i översta raden, i glappet mellan raderna i den nedersta)
//     play(fromUid, toUid) → bool   (false = ingen linje ritades)
//     active(), el, destroy()
//   }
// ============================================================================

import { prefersReducedMotion } from "../../design/live-reactions.js";
import { circuitPath } from "./dk-proj-scen.js";

const NS = "http://www.w3.org/2000/svg";
const MAX = 3;
const DRAW_MS = 650;
const HOLD_MS = 200;
const FADE_MS = 350;

export function createHacklinje(golv, { point, lift = () => 0 }) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "dknh");
  svg.setAttribute("aria-hidden", "true");
  golv.prepend(svg);
  const live = new Set();

  function edge() {
    const r = golv.getBoundingClientRect();
    return { x: r.width - 4, y: r.height * 0.42 };
  }

  function play(fromUid, toUid) {
    if (live.size >= MAX) return false;
    const a0 = point(fromUid);
    const b0 = point(toUid);
    if (!a0 && !b0) return false;
    const r = golv.getBoundingClientRect();
    if (!r.width) return false;
    svg.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
    const a = a0 || edge();
    const b = b0 || edge();
    // Banan går tvärs ovanför figurerna men aldrig ut ur golvet (klipps annars).
    const hojd = Math.min(Math.max(24, Number(lift()) || 0), Math.min(a.y, b.y) - 6);
    const d = circuitPath(a, b, { lift: Math.max(0, hojd) });
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "dknh-linje");
    g.innerHTML = `<path class="dknh-glod" d="${d}"/><path class="dknh-karna" d="${d}"/><circle class="dknh-ring" cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="18"/>`;
    svg.appendChild(g);
    live.add(g);
    const done = () => { g.remove(); live.delete(g); };
    const total = DRAW_MS + HOLD_MS + FADE_MS;
    if (prefersReducedMotion()) {
      g.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }], { duration: total, fill: "forwards" })
        .finished.catch(() => {}).finally(done);
      return true;
    }
    const paths = [...g.querySelectorAll("path")];
    const len = paths[0].getTotalLength?.() || 1000;
    for (const p of paths) {
      p.style.strokeDasharray = `${len} ${len}`;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: DRAW_MS, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" });
    }
    g.querySelector(".dknh-ring").animate(
      [{ opacity: 0, transform: "scale(.4)" }, { opacity: 0, transform: "scale(.4)", offset: DRAW_MS / total },
        { opacity: 1, transform: "scale(1)", offset: (DRAW_MS + HOLD_MS) / total }, { opacity: 0, transform: "scale(1.5)" }],
      { duration: total, fill: "forwards" });
    g.animate([{ opacity: 1 }, { opacity: 1, offset: (DRAW_MS + HOLD_MS) / total }, { opacity: 0 }], { duration: total, fill: "forwards" })
      .finished.catch(() => {}).finally(done);
    return true;
  }

  return {
    el: svg,
    play,
    active: () => live.size,
    destroy() {
      live.clear();
      svg.remove();
    },
  };
}
