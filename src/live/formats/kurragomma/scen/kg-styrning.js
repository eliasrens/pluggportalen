// ============================================================================
// Kurragömma (#837): STYRNINGEN (spec §3) – tangenter, dra för att titta,
// joystick på pekskärm och tryck på marken. Delad av 3D-scenen och 2D-reserven.
//
//   W/S, pil upp/ned      framåt/bakåt
//   A/D, pil vänster/höger svänger
//   dra på bilden         tittar runt (vrider yaw)
//   joystick              nere till vänster, visas på pekskärm (pointer: coarse)
//                         eller så fort någon rör bilden med fingret
//   tryck på marken       kort tryck utan drag → onTryck(sx, sy) i CSS-pixlar
//                         relativt ytan; ritaren räknar om till en punkt på ön
//
// Fokusregeln: när ett formulärfält har fokus (input/textarea/select/
// contenteditable) styr tangenterna inte figuren – "skriv själv" med siffror
// och pilar måste fungera i frågepanelen.
//
// API
//   skapaStyrning({ yta, onTryck, onDra }) → {
//     las() → { fram, svang }          (−1..1, tangenter + joystick)
//     aktiv(bool)                       (av = ingen styrning, joystick dold)
//     destroy()
//   }
// ============================================================================

const DRAG_PX = 8; // kortare rörelse än så räknas som ett tryck
const DRA_KANSLIGHET = 0.008; // rad per px

export function formularHarFokus(doc = document) {
  const el = doc.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/** Joysticken som DOM: en ring med en knopp. */
function skapaJoystick(yta) {
  const el = document.createElement("div");
  el.className = "kg-joystick";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<div class="kg-joystick-knopp"></div>';
  yta.appendChild(el);
  const knopp = el.firstElementChild;
  const st = { x: 0, y: 0, id: null };
  function flytta(e) {
    const r = el.getBoundingClientRect();
    const R = r.width / 2;
    let x = (e.clientX - (r.left + R)) / R;
    let y = (e.clientY - (r.top + R)) / R;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    st.x = x; st.y = y;
    knopp.style.transform = `translate(${(x * R * 0.6).toFixed(1)}px, ${(y * R * 0.6).toFixed(1)}px)`;
  }
  const slapp = () => { st.id = null; st.x = st.y = 0; knopp.style.transform = ""; };
  el.addEventListener("pointerdown", (e) => { st.id = e.pointerId; el.setPointerCapture(e.pointerId); flytta(e); e.preventDefault(); });
  el.addEventListener("pointermove", (e) => { if (e.pointerId === st.id) flytta(e); });
  el.addEventListener("pointerup", slapp);
  el.addEventListener("pointercancel", slapp);
  return { el, st, slapp };
}

export function skapaStyrning({ yta, onTryck = null, onDra = null } = {}) {
  const tangenter = new Set();
  let aktiv = true;
  const joy = skapaJoystick(yta);
  let pek = false;
  try { pek = window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch { /* ingen matchMedia */ }
  const visaJoystick = () => { joy.el.classList.toggle("kg-joystick-synlig", aktiv && pek); };
  visaJoystick();

  const KEYS = {
    w: "fram", arrowup: "fram", s: "bak", arrowdown: "bak",
    a: "vanster", arrowleft: "vanster", d: "hoger", arrowright: "hoger",
  };
  function keydown(e) {
    const k = KEYS[e.key.toLowerCase()];
    if (!k || !aktiv || formularHarFokus()) return;
    tangenter.add(k);
    if (e.key.startsWith("Arrow")) e.preventDefault();
  }
  function keyup(e) {
    const k = KEYS[e.key.toLowerCase()];
    if (k) tangenter.delete(k);
  }
  const slappAlla = () => tangenter.clear();

  // Dra för att titta / tryck på marken – på själva ytan (inte joysticken).
  let ner = null; // { x, y, sist, drog, id }
  function pointerdown(e) {
    if (!aktiv || e.target === joy.el || joy.el.contains(e.target)) return;
    if (e.pointerType === "touch" && !pek) { pek = true; visaJoystick(); }
    ner = { x: e.clientX, y: e.clientY, sist: e.clientX, drog: false, id: e.pointerId };
  }
  function pointermove(e) {
    if (!ner || e.pointerId !== ner.id) return;
    if (!ner.drog && Math.hypot(e.clientX - ner.x, e.clientY - ner.y) > DRAG_PX) ner.drog = true;
    if (ner.drog && onDra) onDra(-(e.clientX - ner.sist) * DRA_KANSLIGHET);
    ner.sist = e.clientX;
  }
  function pointerup(e) {
    if (!ner || e.pointerId !== ner.id) return;
    const n = ner;
    ner = null;
    if (n.drog || !onTryck) return;
    const r = yta.getBoundingClientRect();
    onTryck(e.clientX - r.left, e.clientY - r.top);
  }
  const pointercancel = () => { ner = null; };

  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", slappAlla);
  yta.addEventListener("pointerdown", pointerdown);
  yta.addEventListener("pointermove", pointermove);
  yta.addEventListener("pointerup", pointerup);
  yta.addEventListener("pointercancel", pointercancel);
  yta.addEventListener("pointerleave", pointercancel);

  return {
    las() {
      if (!aktiv) return { fram: 0, svang: 0 };
      const fram = (tangenter.has("fram") ? 1 : 0) - (tangenter.has("bak") ? 1 : 0) - joy.st.y;
      const svang = (tangenter.has("vanster") ? 1 : 0) - (tangenter.has("hoger") ? 1 : 0) - joy.st.x;
      return { fram: Math.max(-1, Math.min(1, fram)), svang: Math.max(-1, Math.min(1, svang)) };
    },
    aktiv(v) {
      aktiv = !!v;
      if (!aktiv) { slappAlla(); joy.slapp(); ner = null; }
      visaJoystick();
    },
    destroy() {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", slappAlla);
      yta.removeEventListener("pointerdown", pointerdown);
      yta.removeEventListener("pointermove", pointermove);
      yta.removeEventListener("pointerup", pointerup);
      yta.removeEventListener("pointercancel", pointercancel);
      yta.removeEventListener("pointerleave", pointercancel);
      joy.el.remove();
    },
  };
}
