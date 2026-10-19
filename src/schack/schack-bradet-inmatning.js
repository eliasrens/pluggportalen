// ============================================================================
// Schackbrädet – mus, finger och tangentbord (#775, §2.2). Allt går genom
// pointer events (mus + touch + penna med samma kod): tryck-markera,
// tryck-flytta och dra-och-släpp. Tangentbordet: pilarna flyttar mellan
// rutorna (i den riktning eleven ser dem), Enter/mellanslag väljer, Escape
// avmarkerar. Själva besluten (lagligt? förvandling?) fattas i kontrollen.
// ============================================================================

const FILER = "abcdefgh";
const DRAG_GRANS = 6; // px innan ett tryck blir ett drag

/** Rutan på skärmens position (x, y) i ett bräde med `orientering`, eller null. */
export function rutaVid(rect, x, y, orientering) {
  const kol = Math.floor(((x - rect.left) / rect.width) * 8);
  const rad = Math.floor(((y - rect.top) / rect.height) * 8);
  if (kol < 0 || kol > 7 || rad < 0 || rad > 7) return null;
  return orientering === "w" ? FILER[kol] + (8 - rad) : FILER[7 - kol] + (rad + 1);
}

/** Rutan ett steg åt (dx, dy) som eleven ser brädet, eller samma ruta vid kanten. */
export function grannRuta(ruta, dx, dy, orientering) {
  const s = orientering === "w" ? 1 : -1;
  const fil = FILER.indexOf(ruta[0]) + dx * s;
  const rad = Number(ruta[1]) - dy * s;
  if (fil < 0 || fil > 7 || rad < 1 || rad > 8) return ruta;
  return FILER[fil] + rad;
}

const PILAR = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * @param {object} p
 * @param {HTMLElement} p.bradet      rutnätet (role="grid")
 * @param {object} p.k                kontrollen (schack-kontroll.js)
 * @param {(ruta: string) => HTMLElement} p.rutaEl
 * @param {(ruta: string) => void} p.fokusera   flytta tangentbordsfokus till rutan
 * @param {() => void} p.viaDrag      anropas innan ett släpp skickas (ingen glidanimation)
 * @returns {() => void} koppla bort
 */
export function kopplaInmatning({ bradet, k, rutaEl, fokusera, viaDrag }) {
  let d = null; // pågående tryck: { id, from, tap, x0, y0, aktiv, varVald, spoke, over }
  const orient = () => k.getState().orientering;
  const rutaFor = (e) => rutaVid(bradet.getBoundingClientRect(), e.clientX, e.clientY, orient());

  function stada() {
    if (!d) return;
    d.spoke?.remove();
    if (d.from) rutaEl(d.from).classList.remove("dras");
    if (d.over) rutaEl(d.over).classList.remove("over");
    try {
      bradet.releasePointerCapture(d.id);
    } catch { /* redan släppt */ }
    d = null;
  }

  function ned(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (d) stada();
    const ruta = rutaFor(e);
    if (!ruta) return;
    if (k.kanValja(ruta)) {
      const varVald = k.getState().vald === ruta;
      if (!varVald) k.valj(ruta);
      d = { id: e.pointerId, from: ruta, x0: e.clientX, y0: e.clientY, aktiv: false, varVald };
      e.preventDefault();
    } else {
      d = { id: e.pointerId, from: null, tap: ruta };
    }
    try {
      bradet.setPointerCapture(e.pointerId);
    } catch { /* syntetiska händelser */ }
  }

  function flytta(e) {
    if (!d || e.pointerId !== d.id || !d.from) return;
    if (!d.aktiv) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_GRANS) return;
      d.aktiv = true;
      const fran = rutaEl(d.from);
      const svg = fran.querySelector(".schack-pjas");
      const storlek = fran.getBoundingClientRect().width;
      d.spoke = document.createElement("div");
      d.spoke.className = "schack-spoke";
      d.spoke.style.width = d.spoke.style.height = `${storlek}px`;
      if (svg) d.spoke.appendChild(svg.cloneNode(true));
      // I helskärm syns bara helskärmselementet och det som ligger i det (#783).
      (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(d.spoke);
      fran.classList.add("dras");
    }
    d.spoke.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    const over = rutaFor(e);
    if (over !== d.over) {
      if (d.over) rutaEl(d.over).classList.remove("over");
      if (over) rutaEl(over).classList.add("over");
      d.over = over;
    }
  }

  function upp(e) {
    if (!d || e.pointerId !== d.id) return;
    const t = d;
    const till = rutaFor(e);
    stada();
    if (!t.from) {
      if (till && till === t.tap) k.tryck(till);
      return;
    }
    if (t.aktiv) {
      if (till && till !== t.from) viaDrag();
      k.slapp(t.from, till);
    } else if (t.varVald) {
      k.avmarkera();
    }
  }

  function tangent(e) {
    const ruta = e.target.closest?.("[data-ruta]")?.dataset.ruta;
    if (!ruta) return;
    if (PILAR[e.key]) {
      const [dx, dy] = PILAR[e.key];
      fokusera(grannRuta(ruta, dx, dy, orient()));
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      k.tryck(ruta);
      e.preventDefault();
    } else if (e.key === "Escape") {
      k.avmarkera();
    }
  }

  const avbryt = () => stada();
  bradet.addEventListener("pointerdown", ned);
  bradet.addEventListener("pointermove", flytta);
  bradet.addEventListener("pointerup", upp);
  bradet.addEventListener("pointercancel", avbryt);
  bradet.addEventListener("keydown", tangent);
  return () => {
    stada();
    bradet.removeEventListener("pointerdown", ned);
    bradet.removeEventListener("pointermove", flytta);
    bradet.removeEventListener("pointerup", upp);
    bradet.removeEventListener("pointercancel", avbryt);
    bradet.removeEventListener("keydown", tangent);
  };
}
