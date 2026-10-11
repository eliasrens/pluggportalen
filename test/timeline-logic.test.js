// Tidsjakten (#597) – tidslinjens rena logik: år ↔ läge, steg, gränser, zoom,
// spann som inte avslöjar svaret, och "visat år = skickat år" i tillståndet.
// Körs med: node --test test/timeline-logic.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampView,
  clampYear,
  createTimelineState,
  diffText,
  followYear,
  formatYear,
  fracToYear,
  fullView,
  isZoomed,
  niceStep,
  panView,
  resolveSpan,
  stepYear,
  ticks,
  VIEW_MIN_WIDTH,
  viewShowing,
  yearDiff,
  yearToFrac,
  zoomView,
} from "../src/timeline/timeline-logic.js";

const SPAN = { min: 1500, max: 1700 };

test("år ↔ läge: ändpunkter, mitt och tur-och-retur", () => {
  const v = fullView(SPAN);
  assert.equal(yearToFrac(1500, v), 0);
  assert.equal(yearToFrac(1700, v), 1);
  assert.equal(yearToFrac(1600, v), 0.5);
  assert.equal(fracToYear(0, v, SPAN), 1500);
  assert.equal(fracToYear(1, v, SPAN), 1700);
  for (let y = 1500; y <= 1700; y += 7) assert.equal(fracToYear(yearToFrac(y, v), v, SPAN), y);
  // Inzoomat fönster
  const z = { min: 1520, max: 1540 };
  assert.equal(fracToYear(0.5, z, SPAN), 1530);
  assert.equal(fracToYear(yearToFrac(1523, z), z, SPAN), 1523);
});

test("gränser: år utanför spannet klämms, även via läge utanför linjen", () => {
  const v = fullView(SPAN);
  assert.equal(clampYear(1400, SPAN), 1500);
  assert.equal(clampYear(1800, SPAN), 1700);
  assert.equal(clampYear(1523.4, SPAN), 1523);
  assert.equal(clampYear("x", SPAN), 1600);
  assert.equal(fracToYear(-0.3, v, SPAN), 1500);
  assert.equal(fracToYear(1.4, v, SPAN), 1700);
});

test("steg −10/−1/+1/+10 inom spannet", () => {
  assert.equal(stepYear(1520, -10, SPAN), 1510);
  assert.equal(stepYear(1520, -1, SPAN), 1519);
  assert.equal(stepYear(1520, 1, SPAN), 1521);
  assert.equal(stepYear(1520, 10, SPAN), 1530);
  assert.equal(stepYear(1505, -10, SPAN), 1500);
  assert.equal(stepYear(1695, 10, SPAN), 1700);
  assert.equal(stepYear(1700, 1, SPAN), 1700);
});

test("zoom: in/ut kring ankare, minsta fönster, aldrig utanför spannet", () => {
  const v = fullView(SPAN);
  const z = zoomView(v, SPAN, 2, 1550);
  assert.equal(z.max - z.min, 100);
  // Ankaret står kvar på samma ställe på skärmen
  assert.ok(Math.abs(yearToFrac(1550, z) - yearToFrac(1550, v)) < 1e-9);
  assert.ok(isZoomed(z, SPAN));
  // Max zoom
  let m = v;
  for (let i = 0; i < 20; i++) m = zoomView(m, SPAN, 2, 1690);
  assert.equal(m.max - m.min, VIEW_MIN_WIDTH);
  assert.ok(m.min >= SPAN.min && m.max <= SPAN.max);
  // Ut igen till hela spannet, inte längre
  let u = m;
  for (let i = 0; i < 20; i++) u = zoomView(u, SPAN, 0.5);
  assert.deepEqual(u, fullView(SPAN));
  assert.equal(isZoomed(u, SPAN), false);
  // Ankare nära kanten → fönstret skjuts in i spannet
  const k = zoomView({ min: 1500, max: 1520 }, SPAN, 0.25, 1501);
  assert.deepEqual(k, { min: 1500, max: 1580 });
});

test("panorering och följ-markör håller fönstret inom spannet", () => {
  const z = { min: 1550, max: 1600 };
  assert.deepEqual(panView(z, SPAN, -100), { min: 1500, max: 1550 });
  assert.deepEqual(panView(z, SPAN, 500), { min: 1650, max: 1700 });
  assert.deepEqual(clampView({ min: 1680, max: 1730 }, SPAN), { min: 1650, max: 1700 });
  const f = followYear(z, SPAN, 1640);
  assert.ok(f.max >= 1640 && f.max - f.min === 50);
  assert.deepEqual(followYear(z, SPAN, 1575), z);
});

test("avslöjande: fönstret vidgas så att båda markörerna syns", () => {
  const z = { min: 1510, max: 1530 };
  const v = viewShowing(z, SPAN, 1520, 1600);
  assert.ok(v.min < 1520 && v.max > 1600);
  assert.deepEqual(viewShowing(fullView(SPAN), SPAN, 1520, 1600), fullView(SPAN));
});

test("skalstreck: snälla steg, etiketter får plats, år inom fönstret", () => {
  assert.deepEqual([1, 2, 3, 7, 12, 30, 70, 120].map(niceStep), [1, 2, 5, 10, 20, 50, 100, 200]);
  const t = ticks({ min: 1500, max: 1700 }, 800, 76);
  assert.ok(t.major.length >= 2 && t.major.length <= 800 / 76 + 1);
  assert.ok(t.major.every((y) => y % t.step === 0 && y >= 1500 && y <= 1700));
  const fine = ticks({ min: 1520, max: 1536 }, 900, 50);
  assert.equal(fine.step, 1);
  assert.equal(fine.minor.length, 0);
  assert.equal(formatYear(-300), "300 f.Kr.");
  assert.equal(formatYear(1520), "1520");
});

test("avvikelse i år och text", () => {
  assert.equal(yearDiff(1520, 1520), 0);
  assert.equal(yearDiff(1517, 1520), 3);
  assert.equal(yearDiff(1528, 1520), 8);
  assert.equal(diffText(1520, 1520), "Exakt rätt!");
  assert.equal(diffText(1519, 1520), "1 år för tidigt");
  assert.equal(diffText(1528, 1520), "8 år för sent");
});

// --- Spannet avslöjar inte svaret -------------------------------------------

const VASA = [1520, 1523, 1527, 1541, 1544, 1560];

test("spann ur områdets händelser: samma för varje fråga, med marginal", () => {
  const span = resolveSpan({ years: VASA });
  assert.ok(span.min < 1520 && span.max > 1560, "marginal på båda sidor");
  assert.ok(span.min % 5 === 0 && span.max % 5 === 0, "jämna årtal");
  // Varje fråga i området får exakt samma spann – ingen fråga påverkar det.
  for (const answer of VASA) {
    const s = resolveSpan({ years: [...VASA].sort(() => answer - 1540) });
    assert.deepEqual(s, span, `spannet ändras inte för fråga ${answer}`);
  }
});

test("resolveSpan tar inte emot svaret – API:t kan inte centrera på det", () => {
  // Bara timelineSpan och years läses; ett "answer"-fält ignoreras helt.
  const a = resolveSpan({ years: VASA, answer: 1520 });
  const b = resolveSpan({ years: VASA, answer: 1560 });
  assert.deepEqual(a, b);
});

test("lärarens timelineSpan används som det är (alla format), vidgas om händelse ligger utanför", () => {
  assert.deepEqual(resolveSpan({ timelineSpan: { start: 1500, end: 1600 }, years: VASA }), { min: 1500, max: 1600 });
  assert.deepEqual(resolveSpan({ timelineSpan: { min: 1600, max: 1500 } }), { min: 1500, max: 1600 });
  assert.deepEqual(resolveSpan({ timelineSpan: [1450, 1650] }), { min: 1450, max: 1650 });
  const w = resolveSpan({ timelineSpan: { start: 1530, end: 1550 }, years: VASA });
  assert.ok(w.min <= 1520 && w.max >= 1560, "varje händelse går att svara på");
  // Ogiltigt spann → räknas ur händelserna
  assert.deepEqual(resolveSpan({ timelineSpan: { start: 1500, end: 1500 }, years: VASA }), resolveSpan({ years: VASA }));
});

test("få händelser: spannet hamnar aldrig mitt på ett svar", () => {
  for (let y = 1480; y <= 1620; y++) {
    for (const ys of [[y], [y, y + 3]]) {
      const s = resolveSpan({ years: ys });
      const mid = (s.min + s.max) / 2;
      for (const a of ys) {
        assert.ok(Math.abs(a - mid) >= (s.max - s.min) * 0.1, `år ${a} (mängd ${ys}) ligger inte mitt i ${s.min}–${s.max}`);
        assert.ok(a >= s.min && a <= s.max);
      }
    }
  }
});

test("startläget avslöjar ingenting: inget valt år, hela spannet, lika för alla svar", () => {
  const span = resolveSpan({ years: VASA });
  const starts = VASA.map(() => {
    const st = createTimelineState(span).get();
    return JSON.stringify({ view: st.view, year: st.year, locked: st.locked });
  });
  assert.equal(new Set(starts).size, 1);
  const st = createTimelineState(span).get();
  assert.equal(st.year, null);
  assert.deepEqual(st.view, span);
});

test("tillstånd: lås kräver tydligt val, låser exakt valt år, en gång", () => {
  const s = createTimelineState(SPAN);
  assert.equal(s.canLock(), false);
  assert.equal(s.lock(), null, "inget val → inget lås");
  s.step(1); // stegknapp utan val utgår från mitten av det som syns
  assert.equal(s.get().year, 1601);
  s.choose(1517.6);
  s.step(-10);
  s.step(1);
  assert.equal(s.get().year, 1509);
  assert.equal(s.lock(), 1509);
  assert.equal(s.get().locked, 1509);
  assert.equal(s.lock(), null, "andra låset gör inget");
  assert.equal(s.choose(1600), false, "låst går inte att ändra");
  assert.equal(s.get().year, 1509);
});

test("tillstånd: avstängd (tid ute) kan varken ändras eller låsas", () => {
  const s = createTimelineState(SPAN);
  s.choose(1550);
  s.disable();
  assert.equal(s.step(1), false);
  assert.equal(s.lock(), null);
  assert.equal(s.get().year, 1550);
  s.enable();
  assert.equal(s.lock(), 1550);
});

test("tillstånd: valt år följs av fönstret när man zoomat in", () => {
  const s = createTimelineState(SPAN);
  s.choose(1520);
  s.zoom(8);
  s.step(10);
  s.step(10);
  s.step(10);
  const { view, year } = s.get();
  assert.equal(year, 1550);
  assert.ok(year >= view.min && year <= view.max);
});
