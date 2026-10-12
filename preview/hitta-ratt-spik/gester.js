// ============================================================================
// Hitta rätt! – SPIKE (#604): gest-tolk för kartan (mus, touch, penna, hjul).
// ----------------------------------------------------------------------------
// Översätter råa pekar-händelser till kartans verb – vet inget om kameran,
// SVG eller geodata. Allt i lokala skärm-px (relativt värd-elementet).
//
//   kopplaGester(värd, {
//     start(),                    en gest börjar (stoppa animationer)
//     pan(dx, dy),                ett finger/musen drar
//     zoom(x, y, faktor),         hjul eller nyp, (x, y) står still
//     klick(x, y, mål),           kort tryck UTAN rörelse över tröskeln
//     arNal(mål) → bool,          trycket började på den egna nålen?
//     nalFlytt(x, y), nalSlapp(), nål-drag i stället för panorering
//     slut(),                     sista fingret släppt
//   }) → koppla loss-funktion
//
// Klick ≠ drag: rörelse över tröskeln (mus 5 px, touch 10 px) eller två
// fingrar någon gång under gesten gör den till panorering/zoom – aldrig ett
// klick. Därför kan ett "drag som råkade sluta stilla" aldrig sätta en nål.
// ============================================================================

export const KLICK_TROSKEL = { mouse: 5, pen: 6, touch: 10 };

/** Är gesten ett klick? (exporterad för enhetstest i #606) */
export function arKlick({ rorelse, flera, ptyp }) {
  return !flera && rorelse <= (KLICK_TROSKEL[ptyp] ?? 6);
}

export function kopplaGester(vard, h) {
  const pekare = new Map();
  let gest = null;

  const lokal = (e) => {
    const r = vard.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function ner(e) {
    if (e.target.closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { vard.setPointerCapture(e.pointerId); } catch { /* syntetisk/redan släppt pekare */ }
    const [x, y] = lokal(e);
    pekare.set(e.pointerId, { x, y });
    if (pekare.size === 1) {
      gest = { nal: h.arNal(e.target), sx: x, sy: y, rorelse: 0, flera: false, mal: e.target, ptyp: e.pointerType };
      h.start();
    } else if (gest) {
      gest.flera = true;
    }
  }

  function flytt(e) {
    const fore = pekare.get(e.pointerId);
    if (!fore || !gest) return;
    const [x, y] = lokal(e);
    if (pekare.size === 1) {
      gest.rorelse = Math.max(gest.rorelse, Math.hypot(x - gest.sx, y - gest.sy));
      if (gest.nal && !gest.flera) h.nalFlytt(x, y);
      else if (!arKlick(gest)) h.pan(x - fore.x, y - fore.y);
    } else if (pekare.size === 2) {
      const [a0, b0] = [...pekare.values()];
      pekare.set(e.pointerId, { x, y });
      const [a1, b1] = [...pekare.values()];
      const m0 = [(a0.x + b0.x) / 2, (a0.y + b0.y) / 2];
      const m1 = [(a1.x + b1.x) / 2, (a1.y + b1.y) / 2];
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
      const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
      h.pan(m1[0] - m0[0], m1[1] - m0[1]);
      if (d0 > 0) h.zoom(m1[0], m1[1], d1 / d0);
    }
    pekare.set(e.pointerId, { x, y });
  }

  function upp(e) {
    if (!pekare.has(e.pointerId)) return;
    const [x, y] = lokal(e);
    pekare.delete(e.pointerId);
    if (pekare.size > 0 || !gest) return;
    const g = gest;
    gest = null;
    h.slut();
    if (e.type === "pointercancel") return;
    if (g.nal && !g.flera) h.nalSlapp();
    else if (arKlick(g)) h.klick(x, y, g.mal);
  }

  function hjul(e) {
    e.preventDefault();
    h.start();
    const [x, y] = lokal(e);
    const per = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0016;
    h.zoom(x, y, Math.exp(-e.deltaY * per));
  }

  vard.addEventListener("pointerdown", ner);
  vard.addEventListener("pointermove", flytt);
  vard.addEventListener("pointerup", upp);
  vard.addEventListener("pointercancel", upp);
  vard.addEventListener("wheel", hjul, { passive: false });
  return () => {
    vard.removeEventListener("pointerdown", ner);
    vard.removeEventListener("pointermove", flytt);
    vard.removeEventListener("pointerup", upp);
    vard.removeEventListener("pointercancel", upp);
    vard.removeEventListener("wheel", hjul);
  };
}
