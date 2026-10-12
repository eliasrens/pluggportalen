// ============================================================================
// Tidslinjekomponent (#597) – DOM-bygget: skelettet, skalstrecken och festen
// vid exakt rätt. Bara createElement (ingen innerHTML), så att komponenten går
// att testa med test/helpers/fake-dom.js. Används av ./timeline-answer.js.
// ============================================================================

import { formatYear, ticks, yearToFrac } from "./timeline-logic.js";

export const STEPS = [-10, -1, 1, 10];

/** Liten elementfabrik bunden till ett dokument. */
export function elFactory(doc) {
  return (tag, cls, parent, text) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  };
}

function marker(el, parent, cls) {
  const m = el("div", `tl-markor ${cls}`, parent);
  el("span", "tl-markor-stav", m);
  el("span", "tl-markor-knopp", m);
  return { node: m, text: el("span", "tl-markor-text", m) };
}

/**
 * Bygger komponentens skelett i root (tömmer root först).
 * @returns referenser till delarna som komponenten uppdaterar
 */
export function buildTimelineDom(doc, root, { lockText }) {
  const el = elFactory(doc);
  const btn = (cls, text, label) => {
    const b = el("button", cls, null, text);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    return b;
  };
  while (root.firstChild) root.removeChild(root.firstChild);

  const ctxEl = el("p", "tl-kontext", root);
  const qEl = el("p", "tl-fraga", root);
  const valt = el("div", "tl-valt", root);
  valt.setAttribute("aria-live", "polite");
  el("span", "tl-valt-etikett", valt, "Ditt årtal");
  const yearEl = el("span", "tl-valt-ar", valt, "?");

  const linje = el("div", "tl-linje", root);
  const yta = el("div", "tl-yta", linje);
  el("div", "tl-bana", yta);
  const skala = el("div", "tl-skala", yta);
  skala.setAttribute("aria-hidden", "true");
  const band = el("div", "tl-band", yta);
  band.hidden = true;
  const ratt = marker(el, yta, "tl-ratt");
  ratt.node.hidden = true;
  const giss = marker(el, yta, "tl-gissning");
  giss.node.tabIndex = 0;
  giss.node.setAttribute("role", "slider");
  giss.node.setAttribute("aria-label", "Ditt årtal");
  const hint = el("p", "tl-hint", root, "Dra markören eller klicka på linjen");

  const oversikt = el("div", "tl-oversikt", root);
  oversikt.setAttribute("aria-label", "Översikt – dra för att flytta linjen");
  const ovBana = el("div", "tl-ov-bana", oversikt);
  const fonster = el("div", "tl-ov-fonster", ovBana);
  const ovPrick = el("div", "tl-ov-prick", ovBana);
  const ovStart = el("span", "tl-ov-ar tl-ov-start", oversikt);
  const ovSlut = el("span", "tl-ov-ar tl-ov-slut", oversikt);

  const knappar = el("div", "tl-knappar", root);
  const stepBtns = STEPS.map((d) => {
    const label = d > 0 ? `+${d}` : `−${-d}`;
    const b = btn(`btn ghost tl-steg tl-steg-${d < 0 ? "m" : "p"}${Math.abs(d)}`, label, `${label} år`);
    b.dataset.steg = String(d);
    return b;
  });
  const zoomUt = btn("btn ghost tl-zoom tl-zoom-ut", "🔍−", "Zooma ut");
  const zoomIn = btn("btn ghost tl-zoom tl-zoom-in", "🔍+", "Zooma in");
  for (const b of [stepBtns[0], stepBtns[1], zoomUt, zoomIn, stepBtns[2], stepBtns[3]]) knappar.appendChild(b);
  const lasBtn = btn("btn gron stor tl-las", lockText);
  root.appendChild(lasBtn);
  const resultat = el("div", "tl-resultat", root);
  resultat.setAttribute("role", "status");
  resultat.hidden = true;

  return {
    el, ctxEl, qEl, valt, yearEl, linje, yta, skala, band, ratt, giss, hint,
    oversikt, ovBana, fonster, ovPrick, ovStart, ovSlut, stepBtns, zoomIn, zoomUt, lasBtn, resultat,
  };
}

/** Sätter ett elements vänsterläge som andel (0–1) av föräldern. */
export function place(node, frac) {
  node.style.left = `${(frac * 100).toFixed(3)}%`;
}

/**
 * Ritar skalstrecken för fönstret. Hoppar över om inget ändrats sedan sist
 * (`cache.key`) – dragningen ritar bara om markören, inte skalan.
 */
export function renderScale(el, skala, view, span, px, compact, cache) {
  // Lite utanför fönstret också: linjens kantluft ska inte se tom ut.
  const w = view.max - view.min;
  const ext = { min: Math.max(span.min, view.min - w * 0.06), max: Math.min(span.max, view.max + w * 0.06) };
  const key = `${ext.min.toFixed(3)}|${ext.max.toFixed(3)}|${Math.round(px)}|${!!compact}`;
  if (key === cache.key) return;
  cache.key = key;
  while (skala.firstChild) skala.removeChild(skala.firstChild);
  const labelPx = compact ? 64 : 76;
  const t = ticks(ext, (px * (ext.max - ext.min)) / w, labelPx);
  if (t.step > 1) for (const y of t.minor) place(el("span", "tl-streck", skala), yearToFrac(y, view));
  for (const y of t.major) {
    const s = el("span", "tl-streck tl-streck-stor", skala);
    place(s, yearToFrac(y, view));
    el("span", "tl-etikett", s, formatYear(y));
  }
}

/** Liten stjärnfest kring rätt-markören (bara när rörelse är tillåten). */
export function celebrate(el, markerNode) {
  const fest = el("span", "tl-fest", markerNode);
  fest.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 12; i++) el("i", "", fest).style.setProperty?.("--i", String(i));
  setTimeout(() => fest.remove?.(), 1600);
}
