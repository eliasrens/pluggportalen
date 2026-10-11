// Tidsjakten (#597) – tidslinjekomponenten med fejk-DOM: det årtal som visas är
// exakt det som skickas, lås kräver tydligt val, onLock exakt en gång,
// lock()/disable() för tid ute, avslöjande med två markörer, tangentbord,
// och att komponenten ligger utanför bootgrafen.
// Körs med: node --test test/timeline-answer.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeDoc } from "./helpers/fake-dom.js";
import { mountTimelineAnswer } from "../src/timeline/timeline-answer.js";

const SPAN = { min: 1500, max: 1700 };

function mount(opts = {}) {
  const doc = makeDoc();
  const ls = {};
  doc.addEventListener = (t, fn) => (ls[t] = ls[t] || []).push(fn);
  doc.removeEventListener = (t, fn) => (ls[t] = (ls[t] || []).filter((f) => f !== fn));
  const key = (k, extra = {}) => {
    const e = { key: k, target: null, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    (ls.keydown || []).forEach((fn) => fn(e));
    return e;
  };
  const root = doc.createElement("div");
  const locks = [];
  const h = mountTimelineAnswer(root, { span: SPAN, question: "Vilket år blev Gustav Vasa kung?", onLock: (y) => locks.push(y), ...opts });
  const q = (c) => root.querySelector(c);
  const yta = q("tl-yta");
  yta.rect = { left: 100, top: 0, right: 700, bottom: 100, width: 600, height: 100 };
  const tap = (x, id = 1) => {
    q("tl-linje").dispatch("pointerdown", { pointerId: id, clientX: x, pointerType: "touch" });
    q("tl-linje").dispatch("pointerup", { pointerId: id, clientX: x });
  };
  const steg = (d) => root.querySelectorAll("tl-steg").find((b) => b.dataset.steg === String(d));
  return { doc, root, h, q, locks, key, tap, steg, ls };
}

const shownYear = (q) => q("tl-valt-ar").textContent;

test("startläget: inget valt år, ? visas, lås-knappen är avstängd", () => {
  const { q, h, locks } = mount();
  assert.equal(shownYear(q), "?");
  assert.equal(q("tl-las").disabled, true);
  assert.equal(h.value(), null);
  assert.equal(h.lock(), null, "lock() utan val skickar inget");
  assert.deepEqual(locks, []);
  assert.ok(q("tl-gissning").classList.contains("tl-tom"));
});

test("klick på linjen flyttar markören och visar året direkt", () => {
  const { q, tap, h } = mount();
  tap(100 + 600 * 0.1); // 10 % in på 1500–1700 → 1520
  assert.equal(shownYear(q), "1520");
  assert.equal(h.value(), 1520);
  assert.equal(q("tl-gissning").style.left, "10.000%");
  assert.equal(q("tl-las").disabled, false);
  assert.match(q("tl-las").textContent, /1520/);
});

test("dra uppdaterar året under hela dragningen", () => {
  const { q, h } = mount();
  const linje = q("tl-linje");
  const seen = [];
  linje.dispatch("pointerdown", { pointerId: 3, clientX: 160, pointerType: "mouse", button: 0 });
  for (const x of [190, 220, 250]) {
    linje.dispatch("pointermove", { pointerId: 3, clientX: x });
    seen.push(shownYear(q));
  }
  linje.dispatch("pointerup", { pointerId: 3, clientX: 250 });
  assert.deepEqual(seen, ["1530", "1540", "1550"]);
  assert.equal(h.value(), 1550);
});

test("det årtal som visas är EXAKT det som skickas (klick + steg + lås)", () => {
  const { q, tap, steg, locks } = mount();
  tap(100 + 600 * 0.137); // 1527.4 → 1527
  for (const d of [10, -1, -1, 1, -10, 10, 1]) steg(d).click();
  const visat = shownYear(q);
  q("tl-las").click();
  assert.deepEqual(locks, [Number(visat)]);
  assert.equal(visat, "1537");
  assert.match(q("tl-las").textContent, /Låst: 1537/);
});

test("onLock anropas exakt en gång – dubbelklick, Enter och lock() efteråt gör inget", () => {
  const { q, tap, h, key, locks } = mount();
  tap(400);
  q("tl-las").click();
  q("tl-las").click();
  key("Enter");
  assert.equal(h.lock(), null);
  assert.equal(locks.length, 1);
  tap(600);
  assert.equal(h.value(), 1600 - 0, "låst går inte att flytta");
  assert.equal(h.value(), locks[0]);
});

test("tangentbord: ←/→ ±1, Shift ±10, Enter låser det visade året", () => {
  const { q, key, locks } = mount();
  key("ArrowRight"); // utan val: från mitten av det som syns (1600) → 1601
  assert.equal(shownYear(q), "1601");
  key("ArrowLeft", { shiftKey: true });
  key("ArrowLeft");
  assert.equal(shownYear(q), "1590");
  const e = key("Enter");
  assert.equal(e.defaultPrevented, true);
  assert.deepEqual(locks, [1590]);
});

test("Live: lock() låser valt år vid tid ute, disable() stänger av utan att skicka", () => {
  const a = mount();
  a.tap(250);
  assert.equal(a.h.lock(), 1550);
  assert.deepEqual(a.locks, [1550]);

  const b = mount();
  b.tap(250);
  b.h.disable();
  b.tap(400);
  b.steg(1).click();
  b.key("Enter");
  b.q("tl-las").click();
  assert.equal(b.h.value(), 1550, "inget ändras efter disable");
  assert.deepEqual(b.locks, []);
  assert.equal(b.q("tl-las").disabled, true);
  assert.ok(b.root.classList.contains("tl-av"));
});

test("avslöjande: två markörer, avvikelsen i år, ingen ändring efteråt", () => {
  const { q, tap, h, root, locks } = mount();
  tap(100 + 600 * 0.085); // 1517
  h.lock();
  const r = h.reveal(1520, { text: "Gustav Vasa valdes till kung i Strängnäs." });
  assert.deepEqual(r, { guess: 1517, correct: 1520, diff: 3 });
  assert.equal(q("tl-ratt").hidden, false);
  assert.equal(q("tl-gissning").hidden, false);
  assert.equal(q("tl-band").hidden, false);
  assert.match(q("tl-ratt").querySelector("tl-markor-text").textContent, /Rätt: 1520/);
  assert.match(q("tl-gissning").querySelector("tl-markor-text").textContent, /Du: 1517/);
  assert.equal(q("tl-resultat-rubrik").textContent, "3 år för tidigt");
  assert.equal(q("tl-resultat").hidden, false);
  assert.ok(root.classList.contains("tl-avslojad"));
  tap(600);
  assert.equal(h.value(), 1517);
  assert.deepEqual(locks, [1517]);
});

test("avslöjande exakt rätt: extra glädje, men inte med reducerad rörelse", () => {
  const a = mount();
  a.tap(100 + 600 * 0.1);
  a.h.lock();
  assert.equal(a.h.reveal(1520).diff, 0);
  assert.ok(a.root.classList.contains("tl-exakt"));
  assert.equal(a.q("tl-resultat-rubrik").textContent, "🎉 Exakt rätt!");
  assert.ok(a.q("tl-fest"), "fest-stjärnor");

  const b = mount();
  b.doc.defaultView = { matchMedia: () => ({ matches: true }) };
  b.h.setQuestion({ question: "Ny fråga" });
  b.tap(100 + 600 * 0.1);
  b.h.lock();
  b.h.reveal(1520);
  assert.ok(b.root.classList.contains("tl-exakt"));
  assert.equal(b.q("tl-fest"), null, "ingen rörelse-fest");
});

test("avslöjande utan svar (tid ute): bara rätt markör", () => {
  const { q, h } = mount();
  h.disable();
  const r = h.reveal(1611);
  assert.deepEqual(r, { guess: null, correct: 1611, diff: null });
  assert.equal(q("tl-gissning").hidden, true);
  assert.equal(q("tl-ratt").hidden, false);
  assert.equal(q("tl-resultat-rubrik").textContent, "Rätt år: 1611");
});

test("setQuestion nollställer – ny fråga börjar utan val och utan avslöjande", () => {
  const { q, h, tap, locks } = mount();
  tap(300);
  h.lock();
  h.reveal(1540);
  h.setQuestion({ question: "Vilket år var Stockholms blodbad?" });
  assert.equal(shownYear(q), "?");
  assert.equal(q("tl-ratt").hidden, true);
  assert.equal(q("tl-resultat").hidden, true);
  assert.equal(q("tl-fraga").textContent, "Vilket år var Stockholms blodbad?");
  tap(160);
  h.lock();
  assert.deepEqual(locks, [1567, 1520]);
});

test("showLocked visar ett redan inskickat år utan att anropa onLock", () => {
  const { q, h, locks } = mount();
  h.showLocked(1544);
  assert.equal(shownYear(q), "1544");
  assert.equal(h.locked(), 1544);
  assert.deepEqual(locks, []);
});

test("zoomknappar: in kring markören, översikten syns bara inzoomat", () => {
  const { q, tap } = mount();
  assert.equal(q("tl-oversikt").hidden, true);
  assert.equal(q("tl-zoom-ut").disabled, true);
  tap(160); // 1520
  q("tl-zoom-in").click();
  q("tl-zoom-in").click();
  assert.equal(q("tl-oversikt").hidden, false);
  assert.equal(q("tl-zoom-ut").disabled, false);
  assert.equal(q("tl-gissning").style.left, "20.000%", "1520 står kvar på samma ställe i fönstret 1505–1555");
});

test("stegknapp med pekare: ett steg på pointerdown, klicket efteråt dubblar inte", () => {
  const { steg, tap, h } = mount();
  tap(160);
  const b = steg(1);
  b.dispatch("pointerdown", { pointerId: 9 });
  b.dispatch("pointerup", { pointerId: 9 });
  b.dispatch("click", { detail: 1 });
  assert.equal(h.value(), 1521);
});

// --- Bootgrafen --------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

// Samma BFS som test/kc-pokal-placering.test.js.
function staticBootGraph() {
  const start = join(SRC, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

test("bootgrafen: 107 filer, tidslinjen bara dynamiskt (#271)", () => {
  const g = staticBootGraph();
  for (const f of ["timeline-answer.js", "timeline-logic.js", "timeline-dom.js", "timeline-gestures.js"]) {
    assert.equal(g.has(join(SRC, "timeline", f)), false, `${f} får inte ligga i bootgrafen`);
  }
  assert.equal(g.size, 107);
});
