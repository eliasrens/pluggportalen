// ============================================================================
// Bråkdraken – tomgång, kläckning och evolution (#718, spec §9)
// ----------------------------------------------------------------------------
//   startaTomgang(svg, opts)  → stopp(). Blinkar var 3–7 s och gör en av
//        nivåns gester var 8–20 s. Pausar när fliken är dold, draken är
//        utanför skärmen (IntersectionObserver) eller opts.vy (t.ex. husets
//        rumslager) är inert/.varld-dold. Huspose (data-hus) byter vinggester
//        mot lugnare huvudgester – vingarna är hopvikta där (#714).
//   spelaGest(svg, namn)      → spelar en gest en gång (för förhandsvisning).
//   spelaKlackning(värd, o)   → ägg → nivå 1 på ~4 s, med "Hoppa över".
//   spelaEvolution(värd, från, till, o) → ~3 s glöd/silhuettbyte + nivåtext.
//
// Animationen är ren presentation: anroparen SPARAR progressionen FÖRE
// effekten (spec §9) – ett avbrott här kan aldrig kosta belöning eller drake.
// Reducerad rörelse (prefers-reduced-motion eller opts.lugn) ersätter
// effekterna med en lugn tonad övergång.
// ============================================================================

import { drakeSvg, STADIER } from "./art-drake.js";
import { installeraDrakeCss } from "./art-drake-css.js";

const lugnSystem = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const slump = (a, b) => a + Math.random() * (b - a);

/** Spelar gesten `namn` en gång på en drak-svg. */
export function spelaGest(svg, namn) {
  if (!svg) return;
  const k = `bd-gest-${namn}`;
  svg.classList.remove(k);
  void svg.getBoundingClientRect(); // starta om animationen om samma gest upprepas
  svg.classList.add(k);
  clearTimeout(svg._bdGest?.[namn]);
  svg._bdGest = { ...(svg._bdGest || {}), [namn]: setTimeout(() => svg.classList.remove(k), 4200) };
}

// Gester som fäller ut vingarna → lugnare motsvarighet med hopvikta vingar.
const HUS_GEST = { svav: "huvudlyft", vingoppning: "huvudlyft" };
const vyDold = (vy) => !!vy && (vy.inert || vy.classList.contains("varld-dold"));

/** Tomgångsrörelser för en draksvg. Returnerar stoppfunktion. */
export function startaTomgang(svg, { min = 8000, max = 20000, blink = [3000, 7000], vy = null } = {}) {
  installeraDrakeCss(svg.ownerDocument);
  const niva = Number(svg.dataset.niva) || 0;
  const hus = svg.dataset.hus === "1";
  const gester = STADIER[niva].gester.filter((g) => g !== "blink").map((g) => (hus && HUS_GEST[g]) || g);
  let synlig = true, timers = [], stoppad = false;
  const aktiv = () => !stoppad && synlig && !svg.ownerDocument.hidden && !vyDold(vy);
  const schema = (fn, ms) => timers.push(setTimeout(fn, ms));
  const gest = () => {
    if (aktiv() && gester.length) spelaGest(svg, gester[Math.floor(Math.random() * gester.length)]);
    if (!stoppad) schema(gest, slump(min, max));
  };
  const blinka = () => {
    if (aktiv() && niva > 0) spelaGest(svg, "blink");
    if (!stoppad) schema(blinka, slump(...blink));
  };
  schema(gest, slump(min * 0.4, max * 0.5));
  schema(blinka, slump(...blink));
  // Pausa andningen när draken inte syns.
  const paus = () => svg.classList.toggle("bd-lugn", !aktiv() || svg.dataset.lugn === "1");
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(([e]) => { synlig = e.isIntersecting; paus(); })
    : null;
  io?.observe(svg);
  // Vyn (husets rumslager) göms med inert/.varld-dold när kameran lämnar den.
  const mo = vy && typeof MutationObserver === "function" ? new MutationObserver(paus) : null;
  mo?.observe(vy, { attributes: true, attributeFilter: ["inert", "class"] });
  paus();
  svg.ownerDocument.addEventListener("visibilitychange", paus);
  return () => {
    stoppad = true;
    timers.forEach(clearTimeout);
    io?.disconnect();
    mo?.disconnect();
    svg.ownerDocument.removeEventListener("visibilitychange", paus);
  };
}

// --- Kläckning & evolution --------------------------------------------------

function scen(vard, lugn) {
  installeraDrakeCss(vard.ownerDocument);
  vard.classList.add("bd-scen");
  vard.innerHTML =
    `<div class="bd-scen-lager" style="position:relative;width:100%;height:100%"></div>` +
    `<div class="bd-scen-text" aria-live="polite" style="position:absolute;left:0;right:0;top:12px;text-align:center;font-weight:800;font-size:1.3rem;opacity:0"></div>` +
    `<button type="button" class="bd-hoppa" style="position:absolute;top:8px;right:8px">Hoppa över</button>`;
  const lager = vard.firstElementChild;
  const text = vard.querySelector(".bd-scen-text");
  const knapp = vard.querySelector(".bd-hoppa");
  return { lager, text, knapp, lugn: lugn ?? lugnSystem() };
}

function form(lager, html, hojd = 76) {
  const d = lager.ownerDocument.createElement("div");
  d.style.cssText = `position:absolute;left:0;right:0;bottom:5%;height:${hojd}%;display:flex;align-items:flex-end;justify-content:center`;
  d.innerHTML = html;
  const svg = d.firstElementChild;
  svg.style.cssText = "max-width:100%;max-height:100%;width:auto;height:100%";
  lager.appendChild(d);
  return d;
}

/** Små guldgnistor som sprider sig från mitten (kläckningens "poff"). */
function gnistregn(lager, delay) {
  const steg = [];
  for (let i = 0; i < 10; i++) {
    const g = lager.ownerDocument.createElement("div");
    const a = (i / 10) * Math.PI * 2, r = 90 + (i % 3) * 30;
    g.style.cssText = "position:absolute;left:50%;top:58%;width:14px;height:14px;margin:-7px;opacity:0;" +
      `background:${i % 2 ? "#FFE58A" : "#C9F6FF"};clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)`;
    lager.appendChild(g);
    steg.push([g, [{ opacity: 1, transform: "translate(0,0) scale(.4)" },
      { opacity: 0, transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r * 0.7}px) scale(1.2)` }], { duration: 900, delay, easing: "ease-out" }]);
  }
  return steg;
}

/** Kör en lista animationer [element, keyframes, options] och väntar in dem. */
function kor(steg, knapp) {
  const anim = steg.map(([el, kf, o]) => el.animate(kf, { fill: "forwards", easing: "ease-in-out", ...o }));
  let klar;
  const lova = new Promise((res) => { klar = res; });
  const avsluta = () => { anim.forEach((a) => a.finish()); klar(); };
  knapp.onclick = avsluta;
  Promise.all(anim.map((a) => a.finished)).then(klar, klar);
  return lova;
}

/** Ägget kläcks till nivå 1. Resolvar när scenen är klar eller hoppats över. */
export async function spelaKlackning(vard, { namn = "", lugn } = {}) {
  const s = scen(vard, lugn);
  const agg = form(s.lager, drakeSvg(0, { stjarnor: 9, klass: "bd-lugn" }), 52);
  const drake = form(s.lager, drakeSvg(1));
  drake.style.opacity = "0";
  s.text.textContent = namn ? `${namn} har kläckts!` : "Draken har kläckts!";
  if (s.lugn) {
    await kor([[agg, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 }],
      [drake, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 300 }],
      [s.text, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 600 }]], s.knapp);
  } else {
    const svg = agg.firstElementChild;
    await kor([
      [svg, [{ transform: "rotate(0)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(-9deg)" }, { transform: "rotate(9deg)" }, { transform: "rotate(0)" }],
        { duration: 1600, transformOrigin: "50% 95%" }],
      [svg, [{ filter: "brightness(1) saturate(1) drop-shadow(0 0 0px #FFE58A)" }, { filter: "brightness(1.4) saturate(1) drop-shadow(0 0 10px #FFE58A)" }, { filter: "brightness(4) saturate(0) drop-shadow(0 0 16px #FFE58A)" }], { duration: 900, delay: 1500 }],
      ...gnistregn(s.lager, 2350),
      [agg, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.35)" }], { duration: 500, delay: 2400 }],
      [drake, [{ opacity: 0, transform: "scale(.35)" }, { opacity: 1, transform: "scale(1.08)", offset: 0.7 }, { opacity: 1, transform: "scale(1)" }],
        { duration: 900, delay: 2450, transformOrigin: "50% 100%" }],
      [s.text, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 3200 }],
    ], s.knapp);
  }
  s.knapp.remove();
  agg.remove();
  drake.style.opacity = "1";
  return drake.firstElementChild;
}

/** Evolution från nivå `fran` till `till`. Resolvar med den nya svg:n. */
export async function spelaEvolution(vard, fran, till, { lugn } = {}) {
  const s = scen(vard, lugn);
  const gammal = form(s.lager, drakeSvg(fran, { klass: "bd-lugn" }));
  const ny = form(s.lager, drakeSvg(till));
  ny.style.opacity = "0";
  s.text.textContent = till >= 15 ? "Nivå 15 – fullt utvecklad!" : `Nivå ${till}!`;
  if (s.lugn) {
    await kor([[gammal, [{ opacity: 1 }, { opacity: 0 }], { duration: 800 }],
      [ny, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 200 }],
      [s.text, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 600 }]], s.knapp);
  } else {
    // Samma filterlista i alla steg så att webbläsaren tonar mjukt mellan dem.
    const f = (b, s, g) => `brightness(${b}) saturate(${s}) drop-shadow(0 0 ${g}px #FFE58A)`;
    const vit = f(4, 0, 14);
    await kor([
      [gammal.firstElementChild, [{ filter: f(1, 1, 0) }, { filter: f(1.25, 1, 10) }, { filter: vit }], { duration: 1100 }],
      [gammal, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.06)" }], { duration: 500, delay: 1100 }],
      [ny.firstElementChild, [{ filter: vit }, { filter: vit, offset: 0.35 }, { filter: f(1, 1, 0) }], { duration: 1300, delay: 1100 }],
      [ny, [{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "scale(1.03)", offset: 0.5 }, { opacity: 1, transform: "scale(1)" }],
        { duration: 1300, delay: 1100, transformOrigin: "50% 100%" }],
      [s.text, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: 2000 }],
    ], s.knapp);
  }
  s.knapp.remove();
  gammal.remove();
  ny.style.opacity = "1";
  return ny.firstElementChild;
}
