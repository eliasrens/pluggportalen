// ============================================================================
// Bråkresan – komponenternas gemensamma bas (src/brakresan/komponenter/bas.js) · #707
// ----------------------------------------------------------------------------
// Det alla tolv komponenter delar (docs/BRAKRESAN.md §5):
//   h / s           DOM- och SVG-noder
//   ensureCss       komponenter.css laddas lat, en gång
//   skapaBas        gränssnittets gemensamma delar: onChange, setLocked,
//                   showResult (kontur + mönster + text – aldrig bara färg),
//                   highlight-rensning, destroy
//   malning         "paint"-läget: markera/avmarkera delar med klick, touch,
//                   svep och tangentbord (pilar + mellanslag/Enter)
//   svgBrak         ett bråk med vågrätt bråkstreck i SVG
// Komponenterna vet ingenting om facit: de ritar ur `view`, svarar elevens svar
// i bedomning.js-form och visar ett utfall först när sidan ger dem det.
// ============================================================================

import { fractionWords } from "../math/words.js";

const SVG = "http://www.w3.org/2000/svg";
let raknare = 0;

/** Unikt id-prefix per komponentinstans (SVG-mönster får inte krocka). */
export const uid = (p = "br") => `${p}-${++raknare}`;

function satt(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k === "class") el.setAttribute("class", v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  return el;
}

/** HTML-nod: h("button", { class: "x", onclick }, "text", barn …). */
export function h(tag, attrs, ...barn) {
  const el = satt(document.createElement(tag), attrs);
  for (const b of barn.flat()) if (b !== null && b !== undefined && b !== false) el.append(b);
  return el;
}

/** SVG-nod. */
export function s(tag, attrs, ...barn) {
  const el = satt(document.createElementNS(SVG, tag), attrs);
  for (const b of barn.flat()) if (b) el.append(b);
  return el;
}

/** Prickmönstret för valda delar – ett gemensamt mönster i dokumentet. */
function ensureMonster() {
  if (document.getElementById("br-prickar")) return;
  const defs = s("svg", { width: 0, height: 0, "aria-hidden": "true", style: "position:absolute;width:0;height:0;overflow:hidden" },
    s("defs", null, s("pattern", { id: "br-prickar", width: 14, height: 14, patternUnits: "userSpaceOnUse" },
      s("rect", { width: 14, height: 14, fill: "#13a39a" }),
      s("circle", { cx: 4, cy: 4, r: 2, fill: "#ffffff", "fill-opacity": ".55" }),
      s("circle", { cx: 11, cy: 11, r: 2, fill: "#ffffff", "fill-opacity": ".55" }))));
  document.body.prepend(defs);
}

let cssLaddad = null;
/** komponenter.css laddas lat (aldrig i styles.css eller bootgrafen). */
export function ensureCss() {
  if (cssLaddad) return cssLaddad;
  if (typeof document !== "undefined") ensureMonster();
  if (typeof document === "undefined" || document.querySelector("link[data-br-komponenter-css]")) {
    cssLaddad = Promise.resolve();
    return cssLaddad;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./komponenter.css", import.meta.url).href;
  link.dataset.brKomponenterCss = "";
  cssLaddad = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return cssLaddad;
}

/** Reducerad rörelse: uttryckligt val i opts vinner, annars användarens inställning. */
export function reduceradRorelse(opts = {}) {
  if (typeof opts.reducedMotion === "boolean") return opts.reducedMotion;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Bråk med vågrätt streck i SVG, centrerat på (x, y). */
export function svgBrak(x, y, n, d, storlek = 18, attrs = {}) {
  const g = s("g", { class: "br-svgbrak", "aria-hidden": "true", ...attrs });
  const bredd = Math.max(String(n).length, String(d).length) * storlek * 0.62 + 6;
  g.append(
    s("text", { x, y: y - storlek * 0.22, "text-anchor": "middle", "font-size": storlek, text: String(n) }),
    s("line", { x1: x - bredd / 2, x2: x + bredd / 2, y1: y, y2: y, "stroke-width": Math.max(1.5, storlek / 10) }),
    s("text", { x, y: y + storlek * 0.92, "text-anchor": "middle", "font-size": storlek, text: String(d) }),
  );
  return g;
}

/** "Hela staven = 1"-etiketten (spec §4: helheten märks uttryckligen). */
export function helhetsEtikett(text) {
  return h("div", { class: "br-helhet" }, text);
}

const RESULTAT = {
  ratt: { ikon: "✓", text: "Rätt!" },
  fel: { ikon: "↻", text: "Inte riktigt ännu" },
};

/**
 * Det gemensamma gränssnittet. Komponenten lägger till getAnswer/setAnswer/
 * reset/highlight och anropar `andrat()` vid varje ändring.
 * @param {HTMLElement} host  där komponenten monteras
 * @param {HTMLElement} rot   komponentens rotnod (klass br-k)
 */
export function skapaBas(host, rot, view, opts = {}) {
  const lyssnare = new Set();
  const stad = [];
  let last = false;
  rot.classList.add("br-k", `br-k--${opts.size || "stor"}`);
  if (opts.interactive === false) rot.classList.add("br-k--visning");
  if (reduceradRorelse(opts)) rot.classList.add("br-k--stilla");
  if (opts.label) rot.setAttribute("aria-label", opts.label);
  const markor = h("div", { class: "br-utfall", role: "status", "aria-live": "polite" });
  rot.append(markor);
  host.append(rot);
  ensureCss();

  const bas = {
    el: rot,
    interaktiv: opts.interactive !== false,
    get last() { return last; },
    andrat() { for (const cb of lyssnare) cb(bas.api.getAnswer()); },
    stad(fn) { stad.push(fn); },
    api: {
      el: rot,
      getAnswer: () => null,
      setAnswer() {},
      reset() {},
      setLocked(l) {
        last = !!l;
        rot.classList.toggle("br-k--last", last);
        rot.toggleAttribute("aria-disabled", last);
        for (const k of rot.querySelectorAll("button, input, [tabindex]")) {
          if (k.closest(".br-utfall")) continue;
          if (k.tagName === "INPUT") k.readOnly = last;
          else k.setAttribute("aria-disabled", String(last));
        }
      },
      showResult(result) {
        rot.classList.remove("br-k--ratt", "br-k--fel");
        markor.textContent = "";
        if (!result || result.status === "invalid") return;
        const r = result.correct ? RESULTAT.ratt : RESULTAT.fel;
        rot.classList.add(result.correct ? "br-k--ratt" : "br-k--fel");
        markor.append(h("span", { class: "br-utfall-ikon", "aria-hidden": "true" }, r.ikon), r.text);
      },
      highlight() {},
      onChange(cb) { lyssnare.add(cb); return () => lyssnare.delete(cb); },
      destroy() {
        for (const fn of stad) fn();
        lyssnare.clear();
        rot.remove();
      },
    },
  };
  return bas;
}

/** Läsbar text för ett bråk utan facit: "en del av fyra" → används i aria. */
export const brakOrd = (n, d) => fractionWords(n, d);

/**
 * Målning ("paint"): delarna är element med data-del="pN". Klick/touch växlar,
 * svep med nedtryckt pekare målar likadant som första delen, pilar flyttar
 * fokus (rutnät om `kolumner`), mellanslag/Enter växlar. Svarar
 * { valda: Set, satt(ids), rensa(), fokusera(id) }.
 */
export function malning(bas, startDelar, { kolumner = 0, etikett = (i, n) => `Del ${i + 1} av ${n}`, namn = null } = {}) {
  const valda = new Set();
  let delar = [];
  const visa = (el) => {
    const pa = valda.has(el.dataset.del);
    el.classList.toggle("br-vald", pa);
    if (bas.interaktiv) el.setAttribute("aria-checked", String(pa));
  };
  const forbered = () => {
    delar.forEach((el, i) => {
      el.classList.add("br-del");
      if (!bas.interaktiv) return; // visningsläge (kort, hjälp, miniatyr): bara bild
      el.setAttribute("role", "checkbox");
      el.setAttribute("aria-label", etikett(i, delar.length));
      el.setAttribute("tabindex", i === 0 ? "0" : "-1");
      if (bas.last) el.setAttribute("aria-disabled", "true");
    });
    delar.forEach(visa);
    beskriv();
  };
  // Visningsläget är en bild: skärmläsaren får en beskrivning av den (inte av facit –
  // en bild i ett kort eller en läsuppgift ÄR det eleven ska tolka).
  const beskriv = () => {
    if (bas.interaktiv) return;
    bas.el.setAttribute("role", "img");
    bas.el.setAttribute("aria-label", `${namn || `${delar.length} lika delar`}, ${valda.size} markerade`);
  };
  const andra = (el, pa) => {
    if (bas.last || !bas.interaktiv) return false;
    const id = el.dataset.del;
    if (pa === valda.has(id)) return false;
    if (pa) valda.add(id); else valda.delete(id);
    visa(el);
    return true;
  };
  const flytta = (el) => {
    for (const d of delar) d.setAttribute("tabindex", d === el ? "0" : "-1");
  };
  let svep = null;
  const ner = (e) => {
    const el = e.target.closest?.("[data-del]");
    if (!el || !delar.includes(el) || bas.last || !bas.interaktiv) return;
    e.preventDefault();
    svep = { pa: !valda.has(el.dataset.del), id: e.pointerId };
    if (andra(el, svep.pa)) bas.andrat();
    el.focus({ preventScroll: true });
    flytta(el);
  };
  const drag = (e) => {
    if (!svep || e.pointerId !== svep.id) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-del]");
    if (el && delar.includes(el) && andra(el, svep.pa)) bas.andrat();
  };
  const upp = () => { svep = null; };
  const tangent = (e) => {
    const el = e.target.closest?.("[data-del]");
    const i = delar.indexOf(el);
    if (i < 0) return;
    const n = delar.length;
    let j = null;
    if (e.key === "ArrowRight") j = i + 1;
    else if (e.key === "ArrowLeft") j = i - 1;
    else if (e.key === "ArrowDown") j = kolumner ? i + kolumner : i + 1;
    else if (e.key === "ArrowUp") j = kolumner ? i - kolumner : i - 1;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (andra(el, !valda.has(el.dataset.del))) bas.andrat();
      return;
    }
    if (j === null) return;
    e.preventDefault();
    j = Math.max(0, Math.min(n - 1, j));
    flytta(delar[j]);
    delar[j].focus();
  };
  if (bas.interaktiv) {
    const yta = bas.el;
    yta.addEventListener("pointerdown", ner);
    yta.addEventListener("pointermove", drag);
    window.addEventListener("pointerup", upp);
    window.addEventListener("pointercancel", upp);
    yta.addEventListener("keydown", tangent);
    bas.stad(() => {
      window.removeEventListener("pointerup", upp);
      window.removeEventListener("pointercancel", upp);
    });
  }
  const m = {
    valda,
    get delar() { return delar; },
    /** Nya delar efter omritning (omdelning); valen med samma id behålls. */
    byt(nya) { delar = nya; forbered(); },
    satt(ids) {
      valda.clear();
      for (const id of ids || []) valda.add(String(id));
      delar.forEach(visa);
      beskriv();
    },
    rensa() { valda.clear(); delar.forEach(visa); },
    svar: () => (bas.interaktiv && valda.size ? { selected: delar.map((d) => d.dataset.del).filter((id) => valda.has(id)) } : null),
  };
  m.byt(startDelar);
  return m;
}

/**
 * Hjälpens pekningar (highlight) för delbaserade modeller:
 *   { whole: true }   helheten får en tydlig kontur och etiketten lyfts
 *   { count: true }   delarna numreras 1, 2, 3 … (hur delarna räknas)
 *   { marked: true }  de redan markerade delarna konturmarkeras
 *   { ids: [...] }    vissa delar konturmarkeras
 *   null              rensa
 */
export function pekaPaDelar(bas, delar, target, numrera) {
  const rot = bas.el;
  rot.classList.toggle("br-pekar-helhet", !!target?.whole);
  for (const d of delar) d.classList.remove("br-pekad");
  rot.querySelectorAll(".br-nummer").forEach((x) => x.remove());
  if (!target) return;
  if (target.count && numrera) delar.forEach((d, i) => numrera(d, i));
  const ids = target.ids ? new Set(target.ids.map(String)) : null;
  for (const d of delar) {
    if ((ids && ids.has(d.dataset.del)) || (target.marked && d.classList.contains("br-vald"))) d.classList.add("br-pekad");
  }
}
