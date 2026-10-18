// ============================================================================
// Prov (#763, §2.3.1/§8.1): dra och släpp med mus och finger – alltid ett
// EXTRA sätt bredvid trycken/knapparna, aldrig det enda. Pekarhändelser, inga
// bibliotek. Används av ordna/para (eleven) och redigerarens handtag ⋮⋮.
//
//   dragbar(el, { onRor?, onSlapp, onSlut?, kopiaAv?, vantaMs? })
//     Mus/penna: dragningen börjar när pekaren flyttats 6 px.
//     Finger: håll kvar vantaMs (standard 250 ms) – ett kort tryck är ett
//     tryck och ett svep rullar sidan som vanligt. vantaMs: 0 = direkt
//     (handtag med CSS touch-action: none).
//     onRor({ x, y, mal })   under dragningen – mal = elementet under pekaren
//     onSlapp({ x, y, mal }) vid släppet; klicket efteråt sväljs, så ett
//                            släpp aldrig räknas som ett tryck
//     onSlut()               efter släpp eller avbrott (Esc, pointercancel)
//   Under dragningen har kopiaAv (standard el – redigeraren: hela kortet)
//   klassen "provv-drar" och en kopia av det följer pekaren ("provv-dra-kopia").
// ============================================================================

const ROR_PX = 6;
const SVEP_PX = 10;

export function dragbar(el, { onRor, onSlapp, onSlut, kopiaAv = el, vantaMs = 250 } = {}) {
  let start = null;
  let drar = false;
  let kopia = null;
  let timer = 0;
  let forskjut = { x: 0, y: 0 };

  const punkt = (e) => ({ x: e.clientX, y: e.clientY, mal: document.elementFromPoint(e.clientX, e.clientY) });

  function borja(x, y) {
    drar = true;
    clearTimeout(timer);
    const r = kopiaAv.getBoundingClientRect();
    forskjut = { x: x - r.left, y: y - r.top };
    kopia = kopiaAv.cloneNode(true);
    kopia.removeAttribute("id");
    kopia.classList.add("provv-dra-kopia");
    kopia.setAttribute("aria-hidden", "true");
    Object.assign(kopia.style, {
      position: "fixed", left: "0", top: "0", width: `${r.width}px`, margin: "0", zIndex: "1000", pointerEvents: "none",
      transform: `translate(${r.left}px, ${r.top}px)`,
    });
    (kopiaAv.closest(".provv-rot, .provl-redigera") || document.body).appendChild(kopia);
    kopiaAv.classList.add("provv-drar");
  }

  function flytta(e) {
    kopia.style.transform = `translate(${e.clientX - forskjut.x}px, ${e.clientY - forskjut.y}px)`;
    onRor?.(punkt(e));
  }

  function stada() {
    clearTimeout(timer);
    document.removeEventListener("pointermove", ror, true);
    document.removeEventListener("pointerup", upp, true);
    document.removeEventListener("pointercancel", avbryt, true);
    document.removeEventListener("keydown", esc, true);
    kopia?.remove();
    kopia = null;
    kopiaAv.classList.remove("provv-drar");
    const varDrag = drar;
    start = null;
    drar = false;
    if (varDrag) onSlut?.();
  }

  function ror(e) {
    if (!start || e.pointerId !== start.id) return;
    const avst = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (!drar) {
      if (start.finger && vantaMs > 0) {
        if (avst > SVEP_PX) stada(); // ett svep: låt sidan rulla
        return;
      }
      if (avst < ROR_PX) return;
      borja(start.x, start.y);
    }
    e.preventDefault();
    flytta(e);
  }

  function upp(e) {
    if (!start || e.pointerId !== start.id) return;
    if (drar) {
      const p = punkt(e);
      // Webbläsarens klick efter släppet ska inte bli ett tryck på saken.
      const svalj = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      const w = window;
      w.addEventListener("click", svalj, true);
      setTimeout(() => w.removeEventListener("click", svalj, true), 100);
      stada();
      onSlapp?.(p);
      return;
    }
    stada();
  }

  function avbryt(e) {
    if (start && e.pointerId === start.id) stada();
  }

  function esc(e) {
    if (e.key === "Escape" && drar) {
      e.preventDefault();
      stada();
    }
  }

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || start || el.disabled) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, finger: e.pointerType === "touch" };
    if (start.finger && vantaMs > 0) timer = setTimeout(() => start && borja(start.x, start.y), vantaMs);
    else if (vantaMs === 0 && start.finger) borja(start.x, start.y);
    document.addEventListener("pointermove", ror, true);
    document.addEventListener("pointerup", upp, true);
    document.addEventListener("pointercancel", avbryt, true);
    document.addEventListener("keydown", esc, true);
  });
  // Under en fingerdragning får sidan inte rulla (touchmove måste vara icke-passiv).
  el.addEventListener("touchmove", (e) => { if (drar && e.cancelable) e.preventDefault(); }, { passive: false });
  // Långtrycket öppnar annars webbläsarens meny på surfplattor.
  el.addEventListener("contextmenu", (e) => { if (start?.finger) e.preventDefault(); });
}
