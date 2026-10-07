// ============================================================================
// Klasscentret i byn (#480, epic #476): byggnad + mätare + placeholder-klick.
// ----------------------------------------------------------------------------
// Laddas ALLTID DYNAMISKT från varld-by-scen.js (import("./klasscenter/kc-by.js"))
// när byn har en klass – aldrig i den statiska bootgrafen (#271). Rutan
// (.by-klasscenter) är redan placerad av by-layouten (varld-by.js); här fylls den:
//
//   1. Klassens EXP hämtas (egna byn: subscribeClassExp i realtid; grannby:
//      getClassExp en gång, view-only) → progressTillNasta (kc-niva.js) →
//      rätt nivå-SVG ur art-klasscenter.js. Byggnaden byts automatiskt när
//      tröskeln nås (nästa snapshot ritar om).
//   2. Mätaren ovanför: "Nivå 3 · Träkoja" + stapel + "50 / 200 övningar till
//      Nivå 4" (högsta nivån: "Maxnivå"). Dold tills hovring/tangentbordsfokus (#484,
//      ren CSS-opacity) men uppdateras live ändå; aria-label bär samma text.
//   3. Klick/Enter → liten pratbubbla "Klasscentret – Nivå 3 Träkoja ·
//      inredning kommer snart" (rummet byggs i epic 2). Pekskärm (hover: none)
//      saknar hovring → bubblan får även mätarraden (#484).
//
// Byggnaden ritas UTAN ambient-animation (animera:false): CSS-animationer på
// SVG-barn är inte kompositerbara och kostar under kamerazoomen (#374).
//
// Källan för EXP kan injiceras (o.kalla) – preview-sidan matar in EXP/elevantal
// utan Firestore. kalla(classId, cb, onErr) → avregistrera; cb({ exp, antalElever }).
// ============================================================================

import { klasscenterSvg, KLASSCENTER_MATT } from "../art-klasscenter.js";
import { progressTillNasta } from "./kc-niva.js";

/** Tusentalsavgränsning ("12 345"), som kc-niva.js matarText. */
function tal(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/** Mätarens underrad: "50 / 200 övningar till Nivå 4" eller "Maxnivå". */
export function matarRad(p) {
  if (!p) return "";
  if (p.max) return "Maxnivå";
  return `${tal(p.nuvarande)} / ${tal(p.mal)} övningar till Nivå ${p.nasta}`;
}

/** Mätarens markup (ren sträng – testas i Node). */
export function matarMarkup(p) {
  const pct = Math.round((p.max ? 1 : p.andel) * 100);
  return `<div class="kc-matare${p.max ? " max" : ""}" aria-hidden="true">
    <b class="kc-matare-titel">Nivå ${p.niva} · ${esc(p.namn)}</b>
    <span class="kc-matare-bar"><i style="width:${pct}%"></i></span>
    <span class="kc-matare-text">${matarRad(p)}</span>
  </div>`;
}

/**
 * Placeholder-texten vid klick (rummet kommer i epic 2). medMatare (pekskärm,
 * #484): mätarraden läggs in eftersom hovringsmätaren inte går att nå där.
 */
export function placeholderText(p, { visaOnly = false, klassNamn = "", medMatare = false } = {}) {
  const vem = visaOnly && klassNamn ? `Klasscentret i ${klassNamn}` : "Klasscentret";
  const matare = medMatare && matarRad(p) ? ` · ${matarRad(p)}` : "";
  return `${vem} – Nivå ${p.niva} ${p.namn}${matare} · inredning kommer snart`;
}

/** Ingen hovring (iPad/Chromebook-touch) → mätaren visas i bubblan i stället. */
function utanHovring() {
  return typeof matchMedia === "function" && matchMedia("(hover: none)").matches;
}

/** Tillgänglig etikett för rutan. */
export function ariaText(p, { visaOnly = false, klassNamn = "" } = {}) {
  const vem = visaOnly && klassNamn ? `Klasscentret i ${klassNamn}` : "Klasscentret";
  return `${vem}, Nivå ${p.niva} ${p.namn}. ${matarRad(p)}`;
}

/**
 * Häng mätaren strax ovanför byggnadens TOPP (inte rutans) – en lägereld är
 * mycket lägre än ett kristallpalats. EN getBBox per nivåbyte (inte per frame).
 * Gömd ruta (bbox 0) → mätaren stannar vid rutans överkant (CSS-default).
 */
function ankraMatare(slot) {
  const svg = slot.querySelector("svg");
  const plats = slot.querySelector(".kc-matare-plats");
  const W = slot.clientWidth;
  const H = slot.clientHeight;
  let bb = null;
  try { bb = svg.getBBox(); } catch { /* ej renderad */ }
  if (!bb || !bb.height || !W || !H) return;
  // preserveAspectRatio xMidYMax meet: skala s, botten mot rutans botten.
  const s = Math.min(W / KLASSCENTER_MATT.bredd, H / KLASSCENTER_MATT.hojd);
  const toppPx = H - (KLASSCENTER_MATT.hojd - Math.max(0, bb.y)) * s;
  plats.style.bottom = `calc(${(100 * (1 - toppPx / H)).toFixed(2)}% + 4px)`;
}

// Standardkällor (Firestore, dynamiskt): egen klass i realtid, grannby en gång.
function standardKalla(visaOnly) {
  return (classId, cb, onErr) => {
    let stopp = null;
    let aktiv = true;
    import("./kc-exp-data.js")
      .then((m) => {
        if (!aktiv) return;
        if (visaOnly) m.getClassExp(classId).then((k) => aktiv && cb(k), onErr);
        else stopp = m.subscribeClassExp(classId, cb, onErr);
      })
      .catch(onErr);
    return () => {
      aktiv = false;
      stopp?.();
    };
  };
}

/**
 * Fyll en .by-klasscenter-ruta. Returnerar en stad-funktion (avregistrerar).
 * Ritas om i samma ruta → tidigare prenumeration stängs först.
 * @param {HTMLElement} slot
 * @param {{classId:string, visaOnly?:boolean, klassNamn?:string, kalla?:Function}} o
 */
export function mountKlasscenterIBy(slot, o = {}) {
  if (!slot || !o.classId) return () => {};
  slot._kcStad?.();
  const opts = { visaOnly: !!o.visaOnly, klassNamn: String(o.klassNamn || "") };
  let p = null;
  let ritadNiva = 0;

  const rita = (exp, antalElever) => {
    p = progressTillNasta(exp, antalElever);
    if (p.niva !== ritadNiva) {
      const forsta = ritadNiva === 0;
      ritadNiva = p.niva;
      slot.innerHTML = `${klasscenterSvg(p.niva, { animera: false })}<div class="kc-matare-plats"></div>`;
      ankraMatare(slot);
      // Nivåbyte (inte första ritningen) → liten "pop" på rutan (HTML-transform).
      if (!forsta) {
        slot.classList.remove("kc-nyniva");
        void slot.offsetWidth;
        slot.classList.add("kc-nyniva");
      }
    }
    slot.querySelector(".kc-matare-plats").innerHTML = matarMarkup(p);
    slot.dataset.niva = String(p.niva);
    slot.setAttribute("aria-label", ariaText(p, opts));
    slot.classList.add("redo");
  };

  const kalla = typeof o.kalla === "function" ? o.kalla : standardKalla(opts.visaOnly);
  let avreg = null;
  const stad = () => {
    clearInterval(vakt);
    avreg?.();
    avreg = null;
    if (slot._kcStad === stad) delete slot._kcStad;
  };
  // Byn byggs om (innerHTML) eller sidan lämnas → rutan lossnar → stäng.
  const vakt = setInterval(() => { if (!slot.isConnected) stad(); }, 20000);
  slot._kcStad = stad;

  avreg = kalla(
    o.classId,
    (k) => {
      if (!slot.isConnected) return stad();
      rita(k?.exp, k?.antalElever);
    },
    (err) => {
      // Regler ej deployade / offline: visa nivå 1 utan siffror hellre än ett hål.
      console.warn("[klasscenter] EXP kunde inte läsas", err);
      if (!ritadNiva && slot.isConnected) {
        rita(0, 1);
        slot.querySelector(".kc-matare-plats").innerHTML = "";
      }
    }
  );

  const oppna = (e) => {
    e.stopPropagation();
    // Bara på by-/grannby-nivån (lagret ligger kvar under andra nivåer).
    const niva = slot.closest(".varld-stage")?.dataset.niva;
    if (niva && niva !== "by" && niva !== "grannby") return;
    visaBubbla(slot, placeholderText(p || progressTillNasta(0, 1), { ...opts, medMatare: utanHovring() }));
  };
  slot.addEventListener("click", oppna);
  slot.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      oppna(e);
    }
  });
  return stad;
}

// Pratbubbla ovanför byggnaden (samma stil-familj som .by-last-bubbla). En i taget;
// stängs efter en stund, vid klick utanför eller Escape.
let bubblaStad = null;
function visaBubbla(slot, text) {
  bubblaStad?.();
  const bubbla = document.createElement("div");
  bubbla.className = "kc-bubbla";
  bubbla.setAttribute("role", "status");
  bubbla.textContent = text;
  slot.appendChild(bubbla);
  slot.classList.add("kc-bubbla-oppen");
  requestAnimationFrame(() => bubbla.classList.add("show"));

  const stang = () => {
    if (bubblaStad !== stang) return;
    bubblaStad = null;
    clearTimeout(timer);
    document.removeEventListener("pointerdown", utanfor, true);
    document.removeEventListener("keydown", vidEsc, true);
    bubbla.classList.remove("show");
    slot.classList.remove("kc-bubbla-oppen");
    setTimeout(() => bubbla.remove(), 300);
  };
  const utanfor = (ev) => { if (!slot.contains(ev.target)) stang(); };
  const vidEsc = (ev) => { if (ev.key === "Escape") stang(); };
  bubblaStad = stang;
  const timer = setTimeout(stang, 4000);
  setTimeout(() => {
    document.addEventListener("pointerdown", utanfor, true);
    document.addEventListener("keydown", vidEsc, true);
  }, 0);
}
