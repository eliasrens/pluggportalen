// ============================================================================
// Ekvationsresan – den grafiska vågen (src/ekvationsresan/vag.js) · #617, E1.5
// ----------------------------------------------------------------------------
// Komponenten som spelvyn monterar. Vågen visas ALLTID ihop med den riktiga
// ekvationen (rubriken ovanför, kan stängas av om spelvyn ritar den själv).
//
//   const vag = createVag(host, { task, theme?, view?, showEquation?, diskret? })
//   vag.visa(eq, { move })   nytt tillstånd; move = {op, value} | {op, n, d, x}
//                            animeras (< 1 s) – ett nytt anrop under en animation
//                            hoppar direkt till slutet, så nästa drag väntar aldrig
//   vag.setTask(task)        ny uppgift: nytt tema/grundvisning, lugn övertoning
//   vag.visaHjalp(scale)     hjälpens bild (#616 hjalp.js steg 2):
//                            {action:"groups", count} visar grupperna,
//                            "remove"/"add"/"copies" markerar/föreslår → boolean;
//                            Etapp 2: {action, operand:{n,d,x}} (−x, ÷2,5)
//   vag.doljHjalp()          tillbaka till vila
//   vag.spelaLosning(steps)  "Visa lösningen": revealSolution().steps i följd
//   vag.destroy()
//
// Rörelse: Web Animations på transform/opacity (kompositerbart). Reducerad
// rörelse (prefers-reduced-motion eller opts.reducedMotion) → inga animationer,
// vågen byter direkt. Byte av visning (föremål → block) = lugn övertoning.
// ============================================================================

import { fromJSON, term } from "./equation.js";
import { q } from "./rational.js";
import { BASE_RULES } from "./config.js";
import { applyOperation } from "./operations.js";
import { equationRow } from "./notation.js";
import { optimalPath } from "./solver.js";
import { chooseView, statesAlong, taskView, viewDuring, viewForEquation, moreAbstract, themeFor, themeById } from "./vag-visning.js";
import { SIDES, restScene, movePhases, helpScene, SCALE_ACTIONS, scaleOperand } from "./vag-scen.js";
import { layoutSide } from "./vag-layout.js";
import { VIEWBOX, PAN_AT, standSvg, beamSvg, plateSvg, pieceSvg } from "./vag-konst.js";

export const DURATION = 900; //  ett drag (spec: under ca 1 s)
const FADE = 420; //             byte av visning / ny uppgift
const HELP_MS = 520;
const EASE = "cubic-bezier(.45,0,.25,1)";
/** Hjälpens provräkning ska kunna visa även drag som spärras senare. */
const LOOSE_RULES = Object.freeze({ ...BASE_RULES, allowNegative: true, allowFractions: true, maxAbs: 1e6 });

let cssP = null;
/** Ladda vag.css en gång (spelvyn behöver inte vänta – vågen ritas ändå). */
export function ensureVagCss() {
  if (cssP || typeof document === "undefined") return cssP || Promise.resolve();
  if (document.querySelector("link[data-ekv-vag-css]")) return (cssP = Promise.resolve());
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./vag.css", import.meta.url).href;
  link.dataset.ekvVagCss = "1";
  cssP = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return cssP;
}

const toModel = (eq) => (eq && Object.isFrozen(eq) && Array.isArray(eq.left) ? eq : fromJSON(eq));
const tf = (p) => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${p.s})`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Ekvationen som HTML, med bråkstreck för x/4 (notation.js-segment). */
export function equationHtml(eq) {
  return equationRow(eq, "start")
    .segments.map((s) =>
      s.num
        ? `<span class="ekv-frac"><span>${esc(s.num)}</span><span>${esc(s.den)}</span></span>`
        : `<span class="ekv-seg ekv-seg--${s.t}">${esc(s.text)}</span>`,
    )
    .join(" ");
}

function moveOperand(move) {
  if (move.operand) return move.operand;
  if ("n" in move) return term(q(move.n, move.d ?? 1), move.x || 0);
  return term(q(move.value), 0);
}

/** Saknas biten i en fas: ta närmaste fas där den finns, osynlig (in/ut-rörelse). */
function derive(frames, k, piece) {
  const present = frames.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  const first = present[0];
  const last = present[present.length - 1];
  if (k < first) {
    const b = frames[first];
    if (piece.enter === "drop") return { ...b, y: b.y - 46, o: 0 };
    if (piece.enter === "pop") return { ...b, s: 0.4, o: 0 };
    return { ...b, o: 0 };
  }
  const prev = frames[k > last ? last : present.filter((i) => i < k).pop()];
  if (piece.lift) return { ...prev, y: prev.y - 34, o: 0 };
  return { ...prev, o: 0 };
}

export function createVag(host, opts = {}) {
  ensureVagCss();
  const reduced = () =>
    opts.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const root = document.createElement("figure");
  root.className = `ekv-vag${opts.diskret ? " ekv-vag--diskret" : ""}`;
  root.innerHTML = `
    <div class="ekv-vag-ekvation"${opts.showEquation === false ? " hidden" : ""}></div>
    <svg class="ekv-vag-svg" viewBox="0 ${VIEWBOX.top} ${VIEWBOX.w} ${VIEWBOX.h - VIEWBOX.top}" role="img">
      <g class="ekv-stand">${standSvg()}</g>
      <g class="ekv-gung">
        <g>${beamSvg()}</g>
        ${SIDES.map((S) => `<g class="ekv-skal" data-side="${S}" transform="translate(${PAN_AT[S].x} ${PAN_AT[S].y})">${plateSvg()}<g class="ekv-lager"></g></g>`).join("")}
      </g>
    </svg>`;
  host.appendChild(root);
  const svg = root.querySelector("svg");
  const caption = root.querySelector(".ekv-vag-ekvation");
  const gung = root.querySelector(".ekv-gung");
  const skal = Object.fromEntries(SIDES.map((S) => [S, root.querySelector(`.ekv-skal[data-side="${S}"]`)]));

  let current = null;
  let base = "foremal";
  let view = "foremal";
  let theme = themeById(opts.theme);
  let anims = [];
  let pending = null; //   städning när en animation är klar/avbruten
  let helpOn = false;
  let playToken = 0;

  const layer = (S) => skal[S].querySelector(".ekv-lager:last-of-type");

  function viewFor(eq) {
    const v = viewDuring(base, eq);
    return opts.view ? moreAbstract(opts.view, viewForEquation(eq)) : v;
  }

  function pieceEl(p, pos, cls = "") {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `ekv-bit ekv-bit--${p.kind}${p.lift ? (helpOn ? " is-markerad" : " is-lyft") : ""}${p.ghost ? " is-forslag" : ""}${cls}`);
    g.dataset.key = p.key;
    g.innerHTML = pieceSvg(p, theme, pos);
    g.style.transform = tf(pos);
    g.style.opacity = pos.o;
    return g;
  }

  /** Rita en scen utan rörelse. */
  function drawStatic(scene, v, target = null) {
    for (const S of SIDES) {
      const lay = target?.[S] || layer(S);
      const pos = layoutSide(scene[S], v);
      lay.replaceChildren(...scene[S].pieces.filter((p) => pos.has(p.key)).map((p) => pieceEl(p, pos.get(p.key))));
    }
  }

  function setCaption(eq) {
    caption.innerHTML = equationHtml(eq);
    svg.setAttribute("aria-label", `Balansvåg: ${equationRow(eq).text}`);
    root.dataset.view = view;
    root.dataset.theme = theme.id;
  }

  /** Avsluta pågående rörelse direkt (nästa drag blockeras aldrig). */
  function finishNow() {
    const done = pending;
    pending = null;
    for (const a of anims) a.cancel();
    anims = [];
    if (done) done();
  }

  function track(list, cleanup) {
    anims = list;
    pending = cleanup;
    const all = list.map((a) => a.finished.catch(() => null));
    Promise.all(all).then(() => {
      if (pending === cleanup) finishNow();
    });
  }

  /** Lugn övertoning mellan två scener (byte av visning eller ny uppgift). */
  function crossfade(scene, v) {
    if (reduced()) return drawStatic(scene, v);
    const olds = SIDES.map((S) => layer(S));
    const fresh = {};
    for (const S of SIDES) {
      fresh[S] = document.createElementNS("http://www.w3.org/2000/svg", "g");
      fresh[S].setAttribute("class", "ekv-lager");
      skal[S].appendChild(fresh[S]);
    }
    drawStatic(scene, v, fresh);
    const list = [];
    for (const old of olds) list.push(old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: EASE, fill: "both" }));
    for (const S of SIDES) list.push(fresh[S].animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: EASE, fill: "both" }));
    track(list, () => {
      olds.forEach((o) => o.remove());
      for (const S of SIDES) fresh[S].getAnimations?.().forEach((a) => a.cancel());
    });
  }

  /** Spela faser (vag-scen.js) på bitarna, nyckel för nyckel. */
  function animatePhases(phases, offsets, pan, v, duration, end) {
    const list = [];
    for (const S of SIDES) {
      const lay = layer(S);
      const layouts = phases.map((ph) => layoutSide(ph[S], v));
      const byKey = new Map();
      phases.forEach((ph) => ph[S].pieces.forEach((p) => byKey.has(p.key) || byKey.set(p.key, p)));
      const els = [];
      for (const [key, piece] of byKey) {
        const frames = layouts.map((pos) => pos.get(key) || null);
        if (!frames.some(Boolean)) continue;
        const full = frames.map((f, k) => f || derive(frames, k, phases.map((ph) => ph[S].pieces.find((p) => p.key === key)).filter(Boolean).pop() || piece));
        const size = frames.find(Boolean);
        const el = pieceEl(piece, { ...full[0], w: size.w, h: size.h });
        els.push(el);
        const kf = full.map((f, k) => ({ offset: offsets[k], transform: tf(f), opacity: f.o, easing: "ease-in-out" }));
        list.push(el.animate(kf, { duration, fill: "both" }));
      }
      lay.replaceChildren(...els);
    }
    if (pan.some((d) => d)) {
      list.push(gung.animate(pan.map((d, k) => ({ offset: offsets[k], transform: `translateY(${d}px)` })), { duration, easing: EASE }));
    }
    track(list, end);
  }

  /** Nytt tillstånd, ev. med dragets animation. */
  function visa(eqIn, opt) {
    stopPlaying();
    show(eqIn, opt);
  }

  function show(eqIn, { move = null } = {}) {
    const eq = toModel(eqIn);
    finishNow();
    helpOn = false;
    const before = current;
    const vBefore = view;
    current = eq;
    view = viewFor(eq);
    setCaption(eq);
    const rest = restScene(eq, view);
    if (!before || reduced()) return drawStatic(rest, view);
    if (!move || vBefore !== view) return vBefore === view ? drawStatic(rest, view) : crossfade(rest, view);
    const { phases, offsets, pan } = movePhases(before, move.op, moveOperand(move), eq, view);
    animatePhases(phases, offsets, pan, view, opts.duration ?? DURATION, () => drawStatic(restScene(current, view), view));
  }

  function setTask(task, { animate = true } = {}) {
    const eq = toModel(task.equation || task);
    stopPlaying();
    finishNow();
    helpOn = false;
    base = task.equation ? taskView(task) : chooseView(statesAlong(eq, optimalPath(eq)?.path || []));
    if (!opts.theme) theme = themeFor(task.key ? task : { key: equationRow(eq).text });
    const had = current;
    current = eq;
    view = viewFor(eq);
    setCaption(eq);
    if (had && animate) crossfade(restScene(eq, view), view);
    else drawStatic(restScene(eq, view), view);
  }

  function visaHjalp(scale) {
    const op = SCALE_ACTIONS[scale?.action];
    const operand = scaleOperand(scale);
    if (!current || !op || !operand) return false;
    const r = applyOperation(current, op, operand, LOOSE_RULES);
    if (!r.ok) return false;
    const scene = helpScene(current, scale, r.after, view);
    if (!scene) return false;
    finishNow();
    helpOn = true;
    if (reduced()) {
      drawStatic(scene, view);
      return true;
    }
    animatePhases([restScene(current, view), scene], [0, 1], [0, 0], view, HELP_MS, () => drawStatic(scene, view));
    return true;
  }

  function doljHjalp() {
    if (!helpOn || !current) return;
    finishNow();
    helpOn = false;
    const rest = restScene(current, view);
    if (reduced()) return drawStatic(rest, view);
    crossfade(rest, view);
  }

  function stopPlaying() {
    playToken++;
  }

  /** "Visa lösningen": steps = [{op, value, after}] (hjalp.js revealSolution). */
  async function spelaLosning(steps, { paus = 650 } = {}) {
    const token = ++playToken;
    for (const s of steps) {
      if (token !== playToken) return false;
      show(s.after, { move: s });
      await new Promise((r) => setTimeout(r, (reduced() ? 0 : opts.duration ?? DURATION) + paus));
    }
    return token === playToken;
  }

  if (opts.task) setTask(opts.task, { animate: false });
  else if (opts.equation) setTask(opts.equation, { animate: false });

  return {
    el: root,
    visa,
    setTask,
    visaHjalp,
    doljHjalp,
    spelaLosning,
    finishNow,
    get view() {
      return view;
    },
    get baseView() {
      return base;
    },
    get theme() {
      return theme.id;
    },
    get equation() {
      return current;
    },
    destroy() {
      stopPlaying();
      finishNow();
      root.remove();
    },
  };
}
