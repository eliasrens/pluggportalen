// ============================================================================
// Pluggporten – Visuella renderare per ämne för mattegeneratorn (issue #321)
// ----------------------------------------------------------------------------
// Klocka=urtavla, sannolikhet=kulpåse, statistik=stapeldiagram,
// koordinatsystem=rutnät. Samma rena mönster som renderBildstod (array/rutnät i
// matte-bildstod.js): ett virtuellt SVG-träd byggs EN gång ur problem-objektets
// PRESENTATIONS-fält (som adaptern/plugins-visual.js redan sätter) och
// serialiseras till SVGElement (opts.document) eller markup-sträng. Ingen
// matematik/facit ändras här – vi ritar bara.
//
// BOOT-SÄKERHET (jfr #271/#290): filen nås BARA dynamiskt (games-rakna.js gör
// `await import("./matte-visuals.js")`). Uppåt beror den bara på de import-fria
// matte-svg.js (primitiver) och matte-bildstod.js (array/rutnäts-fallback för
// multiplikation/division). Får ALDRIG statiskt importeras av en bootnådd fil.
// ============================================================================

import { SVG_NS, el, txt, finish, posInt, r2 } from "./matte-svg.js";
import { renderBildstod } from "./matte-bildstod.js";

/** Punkt på en urtavla: `deg` grader medurs från 12, radie `r` runt (cx,cy). */
function clockPoint(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// ── Urtavla (klocka) ─────────────────────────────────────────────────────────
// Läser problem.hours (1–12) och problem.minutes (0–59). Ritar tavla, 12
// siffror, minutmarkeringar samt tim- och minutvisare i rätt vinkel.
export function renderKlocka(problem, opts = {}) {
  if (!problem || problem.type !== "klocka") return null;
  const hours = ((Number(problem.hours) % 12) + 12) % 12;
  const minutes = ((Number(problem.minutes) % 60) + 60) % 60;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const SZ = 200, C = SZ / 2, R = 90;
  const faceColor = opts.faceColor || "#ffffff";
  const rimColor = opts.rimColor || "#4c6ef5";
  const handColor = opts.handColor || "#2a2a35";

  const children = [];
  children.push(el("circle", { class: "clock-face", cx: C, cy: C, r: R, fill: faceColor, stroke: rimColor, "stroke-width": 4 }));

  // Minutmarkeringar (60 st, längre var femte).
  for (let m = 0; m < 60; m++) {
    const outer = clockPoint(C, C, R - 4, m * 6);
    const inner = clockPoint(C, C, R - (m % 5 === 0 ? 12 : 7), m * 6);
    children.push(el("line", { class: "clock-tick", x1: r2(inner.x), y1: r2(inner.y), x2: r2(outer.x), y2: r2(outer.y), stroke: rimColor, "stroke-width": m % 5 === 0 ? 2 : 1 }));
  }

  // Timsiffror 1–12.
  for (let h = 1; h <= 12; h++) {
    const p = clockPoint(C, C, R - 24, h * 30);
    children.push(txt("text", { class: "clock-num", x: r2(p.x), y: r2(p.y), "text-anchor": "middle", "dominant-baseline": "central", "font-size": 15, "font-weight": 600, fill: handColor }, h));
  }

  // Visare: timme (kort/tjock) + minut (lång/smal).
  const hourDeg = hours * 30 + minutes * 0.5;
  const minDeg = minutes * 6;
  const hp = clockPoint(C, C, R * 0.5, hourDeg);
  const mp = clockPoint(C, C, R * 0.78, minDeg);
  children.push(el("line", { class: "clock-hand-hour", x1: C, y1: C, x2: r2(hp.x), y2: r2(hp.y), stroke: handColor, "stroke-width": 5, "stroke-linecap": "round" }));
  children.push(el("line", { class: "clock-hand-min", x1: C, y1: C, x2: r2(mp.x), y2: r2(mp.y), stroke: handColor, "stroke-width": 3, "stroke-linecap": "round" }));
  children.push(el("circle", { class: "clock-center", cx: C, cy: C, r: 4, fill: handColor }));

  const pad = (n) => String(n).padStart(2, "0");
  const shown = (hours === 0 ? 12 : hours);
  const tree = el("svg", {
    xmlns: SVG_NS, class: "bildstod bildstod-klocka", viewBox: `0 0 ${SZ} ${SZ}`,
    width: "100%", role: "img",
    "aria-label": `Urtavla som visar ${pad(shown)}:${pad(minutes)}`,
    "data-hours": shown, "data-minutes": minutes,
  }, children);
  return finish(tree, opts);
}

// ── Kulpåse (sannolikhet) ────────────────────────────────────────────────────
// Frac-varianten: en påse med `red` röda + `blue` blå kulor. Compare-varianten:
// två små påsar (a/b) sida vid sida. Word-varianten saknar kuldata → null.
export function renderKulpase(problem, opts = {}) {
  if (!problem || problem.type !== "sannolikhet") return null;
  const red = opts.redColor || "#e8590c";
  const blue = opts.blueColor || "#1c7ed6";

  if (problem.questionType === "compare" && problem.a && problem.b) {
    const bagA = bagTree(problem.a.red, problem.a.total, 0, red, blue);
    const bagB = bagTree(problem.b.red, problem.b.total, bagA.w + 24, red, blue);
    const w = bagA.w + 24 + bagB.w;
    const h = Math.max(bagA.h, bagB.h);
    const tree = el("svg", {
      xmlns: SVG_NS, class: "bildstod bildstod-kulpase", viewBox: `0 0 ${w} ${h}`,
      width: "100%", role: "img",
      "aria-label": `Två kulpåsar att jämföra`,
      "data-total": (problem.a.total || 0) + (problem.b.total || 0),
    }, [bagA.node, bagB.node]);
    return finish(tree, opts);
  }

  const total = posInt(problem.total);
  if (!total) return null;
  const bag = bagTree(problem.red, total, 0, red, blue);
  const tree = el("svg", {
    xmlns: SVG_NS, class: "bildstod bildstod-kulpase", viewBox: `0 0 ${bag.w} ${bag.h}`,
    width: "100%", role: "img",
    "aria-label": `Kulpåse med ${posInt(problem.red)} röda och ${posInt(problem.blue)} blå kulor, totalt ${total}`,
    "data-red": posInt(problem.red), "data-blue": posInt(problem.blue), "data-total": total,
  }, [bag.node]);
  return finish(tree, opts);
}

// En påse-grupp (rundad "påse" + kulor i rutnät, `red` röda först) med offset x0.
function bagTree(redCount, total, x0, redColor, blueColor) {
  const t = posInt(total);
  const red = Math.max(0, Math.min(t, posInt(redCount)));
  const perRow = Math.min(t, 4);
  const rows = Math.max(1, Math.ceil(t / perRow));
  const cell = 26, r = 9, pad = 12;
  const innerW = perRow * cell;
  const w = innerW + pad * 2;
  const h = rows * cell + pad * 2 + 14; // 14 = plats för påsöppning upptill
  const top = 14;

  const kids = [];
  kids.push(el("rect", { class: "kulpase-bag", x: 3, y: top - 6, width: w - 6, height: h - top, rx: 16, fill: "#f1f3f5", stroke: "#adb5bd", "stroke-width": 2 }));
  for (let i = 0; i < t; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    kids.push(el("circle", {
      class: i < red ? "kul kul-rod" : "kul kul-bla",
      cx: pad + col * cell + cell / 2, cy: top + pad + row * cell + cell / 2, r,
      fill: i < red ? redColor : blueColor, stroke: "#00000022", "stroke-width": 1,
    }));
  }
  return { node: el("g", { transform: `translate(${x0},0)` }, kids), w, h };
}

// ── Stapeldiagram (statistik) ────────────────────────────────────────────────
// Läser problem.items = [{label, value}]. Ritar staplar med värdesiffra ovanför
// och kategori-etikett under, samt en baslinje. Skalar efter största värdet.
export function renderStapeldiagram(problem, opts = {}) {
  if (!problem || problem.type !== "statistik") return null;
  const items = Array.isArray(problem.items) ? problem.items : [];
  if (!items.length) return null;
  const barColor = opts.barColor || "#4c6ef5";

  const n = items.length;
  const barW = 46, gap = 20, leftPad = 24, topPad = 22, chartH = 150, labelH = 30;
  const width = leftPad * 2 + n * barW + (n - 1) * gap;
  const height = topPad + chartH + labelH;
  const baseY = topPad + chartH;
  const maxV = Math.max(1, ...items.map((d) => Number(d.value) || 0));

  const children = [];
  children.push(el("line", { class: "chart-axis", x1: leftPad - 8, y1: baseY, x2: width - leftPad + 8, y2: baseY, stroke: "#adb5bd", "stroke-width": 2 }));

  items.forEach((d, i) => {
    const v = Number(d.value) || 0;
    const barH = (v / maxV) * chartH;
    const x = leftPad + i * (barW + gap);
    const y = baseY - barH;
    children.push(el("rect", { class: "chart-bar", x, y: r2(y), width: barW, height: r2(barH), rx: 4, fill: barColor }));
    children.push(txt("text", { class: "chart-value", x: x + barW / 2, y: r2(y - 6), "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: "#2a2a35" }, v));
    children.push(txt("text", { class: "chart-label", x: x + barW / 2, y: baseY + 18, "text-anchor": "middle", "font-size": 12, fill: "#495057" }, d.label));
  });

  const tree = el("svg", {
    xmlns: SVG_NS, class: "bildstod bildstod-diagram", viewBox: `0 0 ${width} ${height}`,
    width: "100%", role: "img",
    "aria-label": `Stapeldiagram: ${items.map((d) => `${d.label} ${d.value}`).join(", ")}`,
    "data-bars": n,
  }, children);
  return finish(tree, opts);
}

// ── Koordinat-rutnät (koordinatsystem) ───────────────────────────────────────
// Läser problem.points ([{x,y}]), problem.range, problem.allQuadrants,
// problem.targetIdx. Ritar rutnät, axlar, ticksiffror och punkter A/B/C…
export function renderKoordinatsystem(problem, opts = {}) {
  if (!problem || problem.type !== "koordinatsystem") return null;
  const points = Array.isArray(problem.points) ? problem.points : [];
  if (!points.length) return null;
  const range = posInt(problem.range) || 5;
  const min = problem.allQuadrants ? -range : 0;
  const max = range;
  const span = max - min;
  if (span <= 0) return null;

  const cell = 22, pad = 18;
  const plot = span * cell;
  const size = plot + pad * 2;
  const mapX = (x) => pad + (x - min) * cell;
  const mapY = (y) => pad + (max - y) * cell;
  const gridColor = "#dee2e6", axisColor = "#868e96", ptColor = opts.pointColor || "#e8590c";

  const children = [];
  // Rutnätslinjer.
  for (let i = 0; i <= span; i++) {
    const gx = pad + i * cell, gy = pad + i * cell;
    children.push(el("line", { class: "grid-line", x1: gx, y1: pad, x2: gx, y2: pad + plot, stroke: gridColor, "stroke-width": 1 }));
    children.push(el("line", { class: "grid-line", x1: pad, y1: gy, x2: pad + plot, y2: gy, stroke: gridColor, "stroke-width": 1 }));
  }
  // Axlar (x=0 / y=0).
  children.push(el("line", { class: "axis axis-x", x1: pad, y1: r2(mapY(0)), x2: pad + plot, y2: r2(mapY(0)), stroke: axisColor, "stroke-width": 2 }));
  children.push(el("line", { class: "axis axis-y", x1: r2(mapX(0)), y1: pad, x2: r2(mapX(0)), y2: pad + plot, stroke: axisColor, "stroke-width": 2 }));
  // Ticksiffror längs axlarna (hoppa över 0 för att inte krocka i origo).
  for (let v = min; v <= max; v++) {
    if (v === 0) continue;
    children.push(txt("text", { class: "tick tick-x", x: r2(mapX(v)), y: r2(mapY(0) + 12), "text-anchor": "middle", "font-size": 9, fill: axisColor }, v));
    children.push(txt("text", { class: "tick tick-y", x: r2(mapX(0) - 8), y: r2(mapY(v) + 3), "text-anchor": "middle", "font-size": 9, fill: axisColor }, v));
  }
  // Punkter med bokstavsetikett (A, B, C…).
  points.forEach((p, i) => {
    const cx = r2(mapX(Number(p.x))), cy = r2(mapY(Number(p.y)));
    const isTarget = i === problem.targetIdx;
    children.push(el("circle", { class: isTarget ? "coord-pt coord-pt-target" : "coord-pt", cx, cy, r: isTarget ? 6 : 5, fill: ptColor, stroke: "#ffffff", "stroke-width": 1.5 }));
    children.push(txt("text", { class: "coord-label", x: cx + 8, y: cy - 7, "font-size": 12, "font-weight": 700, fill: "#2a2a35" }, String.fromCharCode(65 + i)));
  });

  const tree = el("svg", {
    xmlns: SVG_NS, class: "bildstod bildstod-koordinat", viewBox: `0 0 ${size} ${size}`,
    width: "100%", role: "img",
    "aria-label": `Koordinatsystem med ${points.length} markerade punkter`,
    "data-points": points.length,
  }, children);
  return finish(tree, opts);
}

// ---------------------------------------------------------------------------
//  Dispatcher – välj rätt visuellt stöd för ett problem
// ---------------------------------------------------------------------------
// Räkna-läget (games-rakna.js) importerar detta dynamiskt och matar in problem-
// objektet. Returnerar null när inget visuellt stöd passar (t.ex. sannolikhet
// 'ord' utan kuldata) – då visas bara frågetexten.
export function renderTopicVisual(problem, opts = {}) {
  if (!problem) return null;
  switch (problem.type) {
    case "klocka": return renderKlocka(problem, opts);
    case "sannolikhet": return renderKulpase(problem, opts);
    case "statistik": return renderStapeldiagram(problem, opts);
    case "koordinatsystem": return renderKoordinatsystem(problem, opts);
    case "multiplikation":
    case "division": return renderBildstod(problem, opts);
    default: return null;
  }
}
