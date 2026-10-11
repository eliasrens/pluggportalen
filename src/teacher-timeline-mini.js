// ============================================================================
// Pluggporten – lärarsidan: minitidslinje + granskning av tidslinjefrågor
// (teacher-timeline-mini.js, issue #598, epic #595 Tidsjakten)
// ----------------------------------------------------------------------------
// Läraren ser områdets historiska händelser (area.timeline) som prickar på en
// liten, ICKE-interaktiv tidslinje över områdets tidsspann – samma bild i
// granskningen före sparande (wizarden/"Lägg till innehåll") och i underradens
// Tidsjakten-flik, där den även förhandsvisar ett ändrat spann direkt.
//
// Spannet: lärarens/AI:ns timelineSpan om det finns, annars samma automatiska
// regel som elevens tidslinje (#597, timeline-logic.js resolveSpan): händelsernas
// min–max + 15 % marginal (minst 5 år), minst 40 år brett. Härleds här i stället
// för att importeras så lärarsidan inte drar in elevkomponenten.
//
// Rena HTML-byggare (ingen DOM-wiring, ingen firebase via teacher-shared.js) så
// de kan enhetstestas i Node. BOOT-SÄKERT (#271): importeras bara av lat
// laddade lärarmoduler.
// ============================================================================

import { formatYear, parseYear } from "./validate-timeline.js";

const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MARGIN = 0.15;
const MIN_MARGIN = 5;
const MIN_WIDTH = 40;

/** Heltalsåren ur en lista händelser (ogiltiga hoppas över). */
function yearsOf(events) {
  return (Array.isArray(events) ? events : []).map((e) => parseYear(e?.year)).filter((y) => y !== null);
}

/**
 * Spannet minitidslinjen ritas över.
 * @param {object[]} events
 * @param {{from:*, to:*}|null|undefined} span – lärarens spann (kan vara ogiltigt/tomt).
 * @returns {{from:number, to:number, auto:boolean}|null} null = inget att rita.
 */
export function previewSpan(events, span) {
  const from = parseYear(span?.from);
  const to = parseYear(span?.to);
  if (from !== null && to !== null && from < to) return { from, to, auto: false };
  const years = yearsOf(events);
  if (!years.length) return null;
  let lo = Math.min(...years);
  let hi = Math.max(...years);
  const pad = Math.max(MIN_MARGIN, Math.round((hi - lo) * MARGIN));
  lo -= pad;
  hi += pad;
  if (hi - lo < MIN_WIDTH) {
    const mid = (lo + hi) / 2;
    lo = Math.floor(mid - MIN_WIDTH / 2);
    hi = lo + MIN_WIDTH;
  }
  return { from: lo, to: hi, auto: true };
}

/** "Snygga" skalstreck (1/2/5 · 10^n) så att det blir högst ~6 delar. */
function tickYears(from, to) {
  const raw = (to - from) / 6;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) || pow * 10;
  const out = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) out.push(y);
  return out;
}

const pct = (y, s) => (((y - s.from) / (s.to - s.from)) * 100).toFixed(2);

/**
 * Minitidslinjen som HTML: skalstreck med årtal + en prick per händelse (titel =
 * händelse + år). Händelser utanför spannet markeras (rött) vid kanten.
 * @param {object[]} events
 * @param {{from:*, to:*}|null} [span]
 * @returns {string} tom sträng om det inte finns något att rita.
 */
export function miniTimelineHtml(events, span) {
  const s = previewSpan(events, span);
  if (!s) return "";
  const ticks = tickYears(s.from, s.to)
    .map((y) => `<span class="tl-mini-tick" style="left:${pct(y, s)}%"><span>${esc(formatYear(y))}</span></span>`)
    .join("");
  const dots = (Array.isArray(events) ? events : [])
    .map((e) => {
      const y = parseYear(e?.year);
      if (y === null) return "";
      const out = y < s.from || y > s.to;
      const left = out ? (y < s.from ? 0 : 100) : pct(y, s);
      const title = `${e.event || "Händelse"} – ${formatYear(y)}${out ? " (utanför spannet!)" : ""}`;
      return `<span class="tl-mini-dot${out ? " out" : ""}" style="left:${left}%" title="${esc(title)}"></span>`;
    })
    .join("");
  return `<div class="tl-mini" role="img" aria-label="Tidslinje ${esc(formatYear(s.from))}–${esc(formatYear(s.to))}">
    <div class="tl-mini-track">${dots}</div>
    <div class="tl-mini-ticks">${ticks}</div>
    <div class="tl-mini-cap">${esc(formatYear(s.from))}–${esc(formatYear(s.to))}${
      s.auto ? ` <span class="tl-mini-auto">(automatiskt efter händelserna)</span>` : ""
    }</div>
  </div>`;
}

/**
 * Granskning av tidslinjefrågorna (läraren ser ALLT eleven inte ser förrän efter
 * svaret: årtalet och förklaringen) + minitidslinjen. Används före sparande.
 * @param {object[]} timeline – validerade händelser.
 * @param {{from:number,to:number}|null} [span]
 * @returns {string}
 */
export function timelineReviewHtml(timeline, span) {
  const list = Array.isArray(timeline) ? timeline : [];
  if (!list.length) return "";
  const items = [...list]
    .sort((a, b) => a.year - b.year)
    .map(
      (e) => `<li class="tl-rv-item">
        <span class="tl-rv-year">${esc(formatYear(e.year))}</span>
        <div class="tl-rv-main">
          <div class="tl-rv-event">${esc(e.event)}</div>
          <div class="tl-rv-q">${esc(e.question)}</div>
          ${e.description ? `<div class="tl-rv-desc"><span class="rv-tag">Före svaret</span> ${esc(e.description)}</div>` : ""}
          ${e.explanation ? `<div class="tl-rv-desc"><span class="rv-tag">💡 Efter svaret</span> ${esc(e.explanation)}</div>` : ""}
        </div>
      </li>`
    )
    .join("");
  return `<section class="tl-review" aria-label="Tidsjakten – granska händelserna">
    <h4 class="tl-review-h">⏳ Tidsjakten <span class="badge">${list.length}</span></h4>
    ${miniTimelineHtml(list, span)}
    <ol class="tl-rv-list">${items}</ol>
  </section>`;
}
