// ============================================================================
// Trollkarlsduellen (#537): lagerriggade trollkarlsfigurer – Rasmus & Elias.
// Ansiktet är friskurna lager från referensbilderna (ref/*.webp, ett per
// uttryck); kropp/mantel/hatt/armar/stav/hals ritas i kod (trollkarl-delar).
// Varje kroppsdel är en egen <g> med pivot (transform-box:view-box) så poser
// blir riktiga kroppsrörelser, inte CSS-skak av en statisk bild (§4).
//
// API (kontrakt mot del A/C – ändra inte utan sign-off-notis):
//   createWizard(host, { who, facing, reducedMotion }) →
//     { el, setExpression, play, setIdle, idleEvents, anchor, layer,
//       transform, reset, destroy }
// ============================================================================

import { VIEW, PIVOT, ANCHOR, THEME, FACE, bodySvg, capeSvg, legsSvg, neckSvg, hatSvg, armLSvg, armRSvg } from "./trollkarl-delar.js";
import { POSES, PRIO, runPose } from "./trollkarl-poser.js";
import { startIdleLoops, createEventScheduler } from "./trollkarl-idle.js";

const EXPRESSIONS = ["neutral", "happy", "angry", "sad", "surprised"];
// Rasterlager finns för happy/angry/sad; neutral delar happy-lagret (det är
// personernas signaturmin) och surprised = happy + pop + tecknad "!"-överraskning.
const EXP_IMG = { neutral: "happy", happy: "happy", angry: "angry", sad: "sad", surprised: "happy" };

const BASE = new URL("./ref/", import.meta.url).href;
let uid = 0;

export function createWizard(host, { who = "rasmus", facing = "right", reducedMotion = false } = {}) {
  const t = THEME[who] || THEME.rasmus;
  const face = FACE[who] || FACE.rasmus;
  const id = "tkf" + ++uid;

  // Ansiktslagrets geometri: bilden (höjd 380) skalas till bredd 224 och
  // placeras så hakan möter halsen vid y≈244.
  const FW = 224;
  const FH = Math.round(380 * (FW / face.w));
  const FX = 200 - FW / 2;
  const FY = 244 - Math.round(FH * 0.875);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.setAttribute("class", "tkf tkf-" + who);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", who === "rasmus" ? "Trollkarlen Rasmus" : "Trollkarlen Elias");
  svg.style.overflow = "visible";

  const fscale = FW / face.w;
  const faceImgs = ["happy", "angry", "sad"]
    .map((n) => {
      const [dx, dy, s] = face[n] || [0, 0, 1];
      return `<image data-exp="${n}" href="${BASE}${who}-${n}.webp" x="${Math.round(dx * fscale)}" y="${Math.round(dy * fscale)}" width="${Math.round(FW * s)}" height="${Math.round(FH * s)}" style="display:${n === "happy" ? "" : "none"}"/>`;
    })
    .join("");

  svg.innerHTML = `
  <defs>
    <clipPath id="${id}-chin"><path d="M-20 -20 H${FW + 20} V${FH * 0.72} Q${FW} ${FH * 0.93} ${FW / 2} ${FH * 0.96} Q0 ${FH * 0.93} -20 ${FH * 0.72} Z"/></clipPath>
  </defs>
  <g data-part="flip">
    <g data-part="fig">
      ${legsSvg(t)}
      <g data-part="cape">${capeSvg(t)}</g>
      <g data-part="armL">${armLSvg(t)}</g>
      <g data-part="body">${bodySvg(t, who)}</g>
      <g data-part="head">
        ${neckSvg(t)}
        <g data-part="face" clip-path="url(#${id}-chin)" transform="translate(${FX} ${FY})">${faceImgs}</g>
        <g data-part="hat">${hatSvg(t, who)}</g>
        <g data-part="wow" style="display:none" aria-hidden="true">
          <text x="318" y="140" font-size="52" font-weight="900" fill="${t.trim}" stroke="#3b2a12" stroke-width="1.5" transform="rotate(12 318 140)">!</text>
          <path transform="translate(344 168) scale(1.1)" fill="#fff" d="M0 -7 1.8 -1.8 7 0 1.8 1.8 0 7 -1.8 1.8 -7 0 -1.8 -1.8Z"/>
        </g>
      </g>
      <g data-part="armR">${armRSvg(t)}</g>
    </g>
    <g data-part="overlay" style="display:none"></g>
  </g>`;
  host.appendChild(svg);

  const q = (sel) => svg.querySelector(sel);
  const parts = {
    flip: q('[data-part="flip"]'), fig: q('[data-part="fig"]'),
    cape: q('[data-part="cape"]'), body: q('[data-part="body"]'),
    head: q('[data-part="head"]'), hat: q('[data-part="hat"]'),
    face: q('[data-part="face"]'), armL: q('[data-part="armL"]'),
    armR: q('[data-part="armR"]'), forearmR: q('[data-part="forearmR"]'),
    wand: q('[data-part="wand"]'), overlay: q('[data-part="overlay"]'),
  };

  // Pivoter: transform-box:view-box gör origin-koordinaterna till viewBox-enheter.
  const origins = {
    flip: [200, 280], fig: PIVOT.body, cape: PIVOT.cape, body: PIVOT.body,
    head: PIVOT.head, hat: PIVOT.hat, armL: PIVOT.armL, armR: PIVOT.armR,
    forearmR: PIVOT.elbowR, wand: PIVOT.wand,
    face: [FX + FW / 2, FY + FH * 0.45],
  };
  for (const [name, [ox, oy]] of Object.entries(origins)) {
    const el = parts[name];
    if (!el) continue;
    el.style.transformBox = "view-box";
    el.style.transformOrigin = `${ox}px ${oy}px`;
  }
  let mirrored = facing === "left";
  const applyFacing = () => { parts.flip.style.transform = mirrored ? "scale(-1,1)" : ""; };
  applyFacing();

  // --- uttryck -------------------------------------------------------------
  let baseExp = "neutral";
  let shownExp = "neutral";
  const imgs = [...parts.face.querySelectorAll("image")];
  function setExpression(name) {
    if (!EXPRESSIONS.includes(name)) name = "neutral";
    shownExp = name;
    const imgName = EXP_IMG[name];
    for (const im of imgs) im.style.display = im.dataset.exp === imgName ? "" : "none";
    q('[data-part="wow"]').style.display = name === "surprised" ? "" : "none";
    if (name === "surprised" && !reducedMotion) {
      parts.face.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.07)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "cubic-bezier(.34,1.56,.64,1)" });
    }
  }

  // --- stavglöd ------------------------------------------------------------
  const glowEls = [q(".tkf-glow"), q(".tkf-glow2")];
  let glowAnims = [];
  function setGlow(on) {
    for (const a of glowAnims) a.cancel();
    glowAnims = [];
    glowEls.forEach((el, i) => {
      if (!el) return;
      if (on && !reducedMotion) {
        glowAnims.push(el.animate(
          [{ opacity: i ? 0.9 : 0.4 }, { opacity: i ? 0.6 : 0.7 }, { opacity: i ? 0.9 : 0.4 }],
          { duration: 700, iterations: Infinity, easing: "ease-in-out" }));
      }
      el.setAttribute("opacity", on ? (i ? "0.85" : "0.5") : "0");
    });
  }

  const poseApi = { setExpression, setGlow, baseExpression: () => baseExp };

  // --- idle + småhändelser ---------------------------------------------------
  let loops = null;
  let idleOn = false;
  let current = null; // { name, prio, handle }
  const scheduler = createEventScheduler(parts, poseApi, { reducedMotion, busy: () => !!current });
  function setIdle(on) {
    idleOn = !!on;
    if (idleOn && !loops) loops = startIdleLoops(parts, reducedMotion);
    else if (!idleOn && loops) { loops.stop(); loops = null; }
  }

  // --- poser -----------------------------------------------------------------
  function play(pose, opts = {}) {
    const def = POSES[pose];
    if (!def) return Promise.reject(new Error("okänd pos: " + pose));
    if (current) {
      if (def.prio < current.prio) return Promise.resolve({ skipped: true });
      current.handle.cancel();
      current = null;
    }
    if (reducedMotion) {
      // Reducerad rörelse: visa bara uttrycket en stund – ingen rörelse.
      const exp = def.steps.find((s) => s.exp);
      if (exp) setExpression(exp.exp);
      return new Promise((res) => setTimeout(() => {
        if (!def.steps.find((s) => s.exp && s.keep)) setExpression(baseExp);
        res();
      }, 350));
    }
    loops?.pause();
    const handle = runPose(parts, poseApi, pose, opts);
    const me = { name: pose, prio: def.prio, handle };
    current = me;
    return handle.done.then(() => {
      if (current === me) current = null;
      if (!current && idleOn) loops?.resume();
    });
  }

  // --- förvandling / overlay ---------------------------------------------------
  let transformed = false;
  function transform(contentEl) {
    transformed = true;
    current?.handle.cancel();
    current = null;
    loops?.pause();
    parts.fig.style.display = "none";
    parts.overlay.style.display = "";
    if (contentEl !== undefined) {
      parts.overlay.replaceChildren();
      if (typeof contentEl === "string") parts.overlay.innerHTML = contentEl;
      else if (contentEl) parts.overlay.appendChild(contentEl);
    }
    return parts.overlay;
  }

  function reset() {
    current?.handle.cancel();
    current = null;
    transformed = false;
    for (const a of svg.getAnimations({ subtree: true })) a.cancel();
    glowAnims = [];
    parts.fig.style.display = "";
    parts.overlay.style.display = "none";
    parts.overlay.replaceChildren();
    applyFacing();
    setGlow(0);
    setExpression(baseExp);
    if (idleOn) { loops?.stop(); loops = startIdleLoops(parts, reducedMotion); }
  }

  // --- ankare -----------------------------------------------------------------
  // Returnerar VIEWPORT-px (som getBoundingClientRect) enligt del A:s kontrakt;
  // arenans scene.point() räknar om till designrummet 1600×900.
  function anchor(name) {
    const [ax, ay] = ANCHOR[name] || ANCHOR.body;
    const x = mirrored ? VIEW.w - ax : ax;
    const r = svg.getBoundingClientRect();
    return {
      x: r.left + (x / VIEW.w) * r.width,
      y: r.top + (ay / VIEW.h) * r.height,
    };
  }

  const LAYERS = { hat: "hat", head: "head", body: "body", armL: "armL", armR: "armR", wand: "wand", cape: "cape" };
  return {
    el: svg,
    setExpression(name) { baseExp = EXPRESSIONS.includes(name) ? name : "neutral"; setExpression(baseExp); },
    play,
    setIdle,
    idleEvents(on) { scheduler.set(on); },
    anchor,
    layer(name) { return parts[LAYERS[name]] || null; },
    transform,
    reset,
    get transformed() { return transformed; },
    get expression() { return shownExp; },
    setFacing(dir) { mirrored = dir === "left"; applyFacing(); },
    destroy() {
      scheduler.stop();
      current?.handle.cancel();
      loops?.stop();
      for (const a of svg.getAnimations({ subtree: true })) a.cancel();
      svg.remove();
    },
  };
}

// Förladdning av ansiktslagren (anropas gärna före matchstart, §17).
export function preloadWizardFaces() {
  const urls = [];
  for (const who of ["rasmus", "elias"]) {
    for (const n of ["happy", "angry", "sad"]) urls.push(`${BASE}${who}-${n}.webp`);
  }
  return Promise.allSettled(urls.map((u) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = res;
    im.onerror = rej;
    im.src = u;
  })));
}

export { PRIO, POSES };
