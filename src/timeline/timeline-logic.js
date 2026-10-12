// ============================================================================
// Tidsjakten (#597) – tidslinjens rena logik. Inga DOM-beroenden, testbar i node.
// Används av src/timeline/timeline-answer.js (komponenten) och av formaten när
// de räknar fram spannet för ett område.
// ----------------------------------------------------------------------------
// Begrepp
//   span  { min, max }  hela tidslinjen (heltalsår, min < max). Markören kan
//                        aldrig hamna utanför spannet.
//   view  { min, max }  den del av spannet som syns just nu (zoom/panorering).
//                        Samma form, alltid inom spannet, flyttal tillåtna.
//   frac  0–1           läge längs den synliga linjen (0 = vänster kant).
//
// Svarsskydd: spannet räknas ALLTID ur hela områdets händelser (eller lärarens
// timelineSpan) och aldrig ur den aktuella frågans svar – samma spann för varje
// fråga i området. Komponenten får inte ens veta rätt år förrän reveal().
// Startläget (ingen markör vald, helt utzoomat) är därför identiskt oavsett svar.
// ============================================================================

/** Marginal runt händelserna när spannet räknas ur dem (andel av bredden). */
export const SPAN_MARGIN = 0.15;
/** Minsta marginal i år på var sida. */
export const SPAN_MIN_MARGIN = 5;
/** Smalaste spann som räknas fram ur händelser (år). */
export const SPAN_MIN_WIDTH = 40;
/** Smalaste synliga fönster vid max zoom (år) – då syns varje enskilt år. */
export const VIEW_MIN_WIDTH = 16;
/** Zoomfaktor per steg (knapp/tangent). */
export const ZOOM_STEP = 2;

const NICE = [1, 2, 5];

/** Heltalsår begränsat till spannet. */
export function clampYear(year, span) {
  const y = Math.round(Number(year));
  if (!Number.isFinite(y)) return Math.round((span.min + span.max) / 2);
  return Math.min(span.max, Math.max(span.min, y));
}

/** Ett steg (−10/−1/+1/+10) från ett år, inom spannet. */
export function stepYear(year, delta, span) {
  return clampYear(Number(year) + Number(delta), span);
}

/** År → läge 0–1 i fönstret (kan hamna utanför 0–1 om året inte syns). */
export function yearToFrac(year, view) {
  return (year - view.min) / (view.max - view.min);
}

/** Läge 0–1 i fönstret → heltalsår inom spannet. */
export function fracToYear(frac, view, span) {
  return clampYear(view.min + frac * (view.max - view.min), span);
}

/** Minsta "snälla" steg (1, 2, 5, 10, 20, 50 …) som är ≥ raw. */
export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  let mag = 1;
  while (mag * 10 <= raw) mag *= 10;
  for (;;) {
    for (const n of NICE) if (n * mag >= raw) return n * mag;
    mag *= 10;
  }
}

/** Format för ett årtal: negativa år visas som "f.Kr.". */
export function formatYear(year) {
  const y = Math.round(year);
  return y < 0 ? `${-y} f.Kr.` : String(y);
}

/**
 * Skalstreck för fönstret. `px` = linjens bredd, `labelPx` = minsta avstånd
 * mellan två årtalsetiketter. Ger stora streck med etikett och små streck emellan.
 * @returns {{ major: number[], minor: number[], step: number }}
 */
export function ticks(view, px, labelPx = 72) {
  const width = view.max - view.min;
  const maxLabels = Math.max(2, Math.floor(px / labelPx));
  const step = niceStep(width / maxLabels);
  const sub = step === 1 ? 1 : String(step)[0] === "2" ? step / 2 : step / 5;
  const major = [];
  const minor = [];
  const first = Math.ceil(view.min / sub) * sub;
  for (let y = first; y <= view.max + 1e-9; y += sub) {
    const r = Math.round(y);
    if (r % step === 0) major.push(r);
    else if (sub >= 1) minor.push(r);
  }
  return { major, minor, step };
}

function asSpan(raw) {
  if (!raw) return null;
  let a;
  let b;
  if (Array.isArray(raw)) [a, b] = raw;
  else {
    a = raw.min ?? raw.start ?? raw.from;
    b = raw.max ?? raw.end ?? raw.to;
  }
  a = Math.round(Number(a));
  b = Math.round(Number(b));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return a < b ? { min: a, max: b } : { min: b, max: a };
}

/**
 * Tidslinjens spann för ett OMRÅDE (inte för en fråga).
 *   timelineSpan  lärarens/områdets spann: { from, to } (#596) | { min, max } | [a, b]
 *                 – används som det är om det är giltigt.
 *   years         ALLA händelseår i området (inte bara aktuell fråga).
 * Utan timelineSpan: händelsernas min–max + marginal, utvidgat till minst
 * SPAN_MIN_WIDTH och avrundat utåt till jämna årtal. Ett lärar-spann som inte
 * rymmer alla händelser vidgas så att varje händelse går att svara på.
 * @returns {{ min: number, max: number }}
 */
export function resolveSpan({ timelineSpan, years = [] } = {}) {
  const ys = years.map(Number).filter(Number.isFinite).map(Math.round);
  const lo = ys.length ? Math.min(...ys) : null;
  const hi = ys.length ? Math.max(...ys) : null;
  const given = asSpan(timelineSpan);
  if (given) {
    if (lo === null || (lo >= given.min && hi <= given.max)) return given;
    return widen({ min: Math.min(given.min, lo), max: Math.max(given.max, hi) });
  }
  if (lo === null) return { min: 1500, max: 2000 };
  const margin = Math.max(SPAN_MIN_MARGIN, Math.round((hi - lo) * SPAN_MARGIN));
  return widen({ min: lo - margin, max: hi + margin }, ys);
}

/**
 * Spannet för ett område i #596:s form: area.timeline[] = { year, … } och
 * area.timelineSpan? = { from, to }. Samma spann för varje fråga i området.
 */
export function areaSpan(area) {
  return resolveSpan({
    timelineSpan: area?.timelineSpan,
    years: (Array.isArray(area?.timeline) ? area.timeline : []).map((e) => e?.year),
  });
}

/**
 * Avrundar utåt till ett jämnt rutnät och ser till minsta bredd. För mycket små
 * mängder (1–2 distinkta år) får spannet inte råka hamna mitt på ett år – det
 * vore samma sak som att centrera på svaret – så fönstret vidgas åt höger tills
 * inget av dem ligger nära mitten.
 */
function widen(span, ys = []) {
  let { min, max } = span;
  if (max - min < SPAN_MIN_WIDTH) {
    const extra = SPAN_MIN_WIDTH - (max - min);
    min -= Math.floor(extra / 2);
    max += Math.ceil(extra / 2);
  }
  const g = niceStep((max - min) / 8);
  min = Math.floor(min / g) * g;
  max = Math.ceil(max / g) * g;
  const distinct = [...new Set(ys)];
  const near = () => distinct.some((y) => Math.abs(y - (min + max) / 2) < (max - min) * 0.1);
  if (distinct.length > 0 && distinct.length <= 2) while (near()) max += g;
  return { min, max };
}

/** Fönstret flyttat så att det ligger helt inom spannet (bredden behålls). */
export function clampView(view, span) {
  const full = span.max - span.min;
  const w = Math.min(full, Math.max(Math.min(VIEW_MIN_WIDTH, full), view.max - view.min));
  let min = Math.min(Math.max(view.min, span.min), span.max - w);
  return { min, max: min + w };
}

/** Hela spannet synligt (startläget). */
export function fullView(span) {
  return { min: span.min, max: span.max };
}

/** Är fönstret inzoomat (syns inte hela spannet)? */
export function isZoomed(view, span) {
  return view.max - view.min < span.max - span.min - 1e-6;
}

/**
 * Zooma kring ett ankarår (det året står kvar på samma ställe på skärmen).
 * factor > 1 zoomar in, < 1 zoomar ut.
 */
export function zoomView(view, span, factor, anchor) {
  const a = anchor ?? (view.min + view.max) / 2;
  const w = view.max - view.min;
  const full = span.max - span.min;
  const nw = Math.min(full, Math.max(Math.min(VIEW_MIN_WIDTH, full), w / factor));
  const t = (a - view.min) / w;
  return clampView({ min: a - t * nw, max: a - t * nw + nw }, span);
}

/** Panorera fönstret ett antal år (negativt = bakåt i tiden). */
export function panView(view, span, years) {
  return clampView({ min: view.min + years, max: view.max + years }, span);
}

/** Flytta fönstret minsta möjliga så att året syns (med lite luft till kanten). */
export function followYear(view, span, year, pad = 0.08) {
  const w = view.max - view.min;
  const lo = view.min + w * pad;
  const hi = view.max - w * pad;
  if (year < lo) return panView(view, span, year - lo);
  if (year > hi) return panView(view, span, year - hi);
  return view;
}

/** Minsta fönster (från nuvarande) där båda åren syns – för avslöjandet. */
export function viewShowing(view, span, a, b, pad = 0.12) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const w = view.max - view.min;
  if (lo >= view.min + w * pad && hi <= view.max - w * pad) return view;
  const need = Math.max(w, (hi - lo) / (1 - 2 * pad));
  const mid = (lo + hi) / 2;
  return clampView({ min: mid - need / 2, max: mid + need / 2 }, span);
}

/** Avvikelse i år mellan gissning och rätt år. */
export function yearDiff(guess, correct) {
  return Math.abs(Math.round(guess) - Math.round(correct));
}

/** Text för avvikelsen: "Exakt rätt!", "1 år fel", "12 år för tidigt" … */
export function diffText(guess, correct) {
  const d = yearDiff(guess, correct);
  if (d === 0) return "Exakt rätt!";
  const ar = d === 1 ? "1 år" : `${d} år`;
  return guess < correct ? `${ar} för tidigt` : `${ar} för sent`;
}

/**
 * Tillståndet bakom komponenten – det komponenten visar och det den skickar
 * kommer härifrån, så "visat år = skickat år" går att testa utan DOM.
 *   year     valt år eller null (inget tydligt val än → kan inte låsas)
 *   locked   låst år eller null
 *   enabled  false = av (tid ute, avslöjande)
 */
export function createTimelineState(span) {
  const s = {
    span: { ...span },
    view: fullView(span),
    year: null,
    locked: null,
    enabled: true,
  };
  const canEdit = () => s.enabled && s.locked === null;
  const api = {
    get: () => s,
    /** Startår för stegknappar innan något valts: mitten av det som syns. */
    pivot: () => (s.year ?? clampYear((s.view.min + s.view.max) / 2, s.span)),
    choose(year) {
      if (!canEdit()) return false;
      s.year = clampYear(year, s.span);
      s.view = followYear(s.view, s.span, s.year);
      return true;
    },
    step(delta) {
      if (!canEdit()) return false;
      return api.choose(stepYear(api.pivot(), delta, s.span));
    },
    zoom(factor, anchor) {
      s.view = zoomView(s.view, s.span, factor, anchor ?? s.year ?? undefined);
    },
    pan(years) {
      s.view = panView(s.view, s.span, years);
    },
    setView(view) {
      s.view = clampView(view, s.span);
    },
    canLock: () => canEdit() && s.year !== null,
    /** Lås valt år. Returnerar året, eller null om inget tydligt val finns. */
    lock() {
      if (!canEdit() || s.year === null) return null;
      s.locked = s.year;
      return s.locked;
    },
    disable() {
      s.enabled = false;
    },
    enable() {
      s.enabled = true;
    },
    /** Återställ ett tidigare val (null = inget val) – t.ex. när en nypning börjar. */
    restore(year) {
      if (!canEdit()) return false;
      s.year = year === null || year === undefined ? null : clampYear(year, s.span);
      return true;
    },
    /** Visa ett redan inskickat år (omladdning) – låst, utan nytt anrop. */
    showLocked(year) {
      s.year = clampYear(year, s.span);
      s.locked = s.year;
      s.view = followYear(s.view, s.span, s.year);
    },
  };
  return api;
}
