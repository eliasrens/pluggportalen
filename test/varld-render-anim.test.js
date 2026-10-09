// ============================================================================
// Kamera-matten för Pixi-rörelsen (#396, F1 #415) – varld-render-anim.js
//
//   • cubicBezier mot Chromes egna värden (WAAPI, getComputedStyle-opacitet,
//     uppmätta i desk-browsern 2026-10-06) för kamerans kurva och CSS "ease".
//   • lagerState mot den RIKTIGA kameran: createKamera ur varld-kamera.js körs
//     mot fejk-lager, och efter varje gaTill/hoppaTill jämförs lagrens inline-
//     stilar (transform/transform-origin/opacity), .varld-dold och inert med
//     lagerState/vilaState – för alla fyra kamerorna (T1–T8), inkl. rum-lagrets
//     avvikande box.
//   • interpolera följer CSS-timingen (900 ms bezier, opacitet 250 + 550 ease).
//   • Boot-säkerhet: inga varld-render*-filer i den statiska bootgrafen (133).
// ============================================================================

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KAMERA_TRANSFORM, KAMERA_OPACITY, KAMERA_TOTAL_MS, cubicBezier,
  lagerState, vilaState, interpolera, lagerMatris, lagerSyns,
} from "../src/varld-render-anim.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const nara = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);

// --- cubicBezier ---------------------------------------------------------------
const XS = [0.05, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95];
const CHROME = {
  kamera: [0.00299365, 0.013139, 0.0658491, 0.118385, 0.200606, 0.480594, 0.727824, 0.860356, 0.933627, 0.95707, 0.974243, 0.994254, 0.998635],
  ease: [0.0329515, 0.0947963, 0.295244, 0.408511, 0.513315, 0.68254, 0.802403, 0.885229, 0.940765, 0.960459, 0.975625, 0.994316, 0.998625],
};

test("KAMERA-konstanterna matchar .varld-lager i styles.css", () => {
  const css = readFileSync(resolve(SRC, "styles.css"), "utf8");
  assert.match(css, /\.varld-lager\s*\{[^}]*transition:\s*transform 0\.9s cubic-bezier\(0\.55, 0, 0\.2, 1\), opacity 0\.55s ease 0\.25s/);
  assert.deepEqual([...KAMERA_TRANSFORM.ease], [0.55, 0, 0.2, 1]);
  assert.equal(KAMERA_TRANSFORM.ms, 900);
  assert.deepEqual([KAMERA_OPACITY.ms, KAMERA_OPACITY.delay], [550, 250]);
  assert.deepEqual([...KAMERA_OPACITY.ease], [0.25, 0.1, 0.25, 1]); // CSS "ease"
  assert.equal(KAMERA_TOTAL_MS, 900);
  const kamera = readFileSync(resolve(SRC, "varld-kamera.js"), "utf8");
  assert.match(kamera, /export const KAMERA_MS = 900;/);
});

test("cubicBezier = Chromes kamera-kurva och CSS ease (±0.002)", () => {
  const kamera = cubicBezier(...KAMERA_TRANSFORM.ease);
  const ease = cubicBezier(...KAMERA_OPACITY.ease);
  XS.forEach((x, i) => {
    nara(kamera(x), CHROME.kamera[i], 0.002, `kamera(${x})`);
    nara(ease(x), CHROME.ease[i], 0.002, `ease(${x})`);
  });
  // Faktisk noggrannhet är långt bättre än kravet.
  XS.forEach((x, i) => nara(kamera(x), CHROME.kamera[i], 2e-5, `kamera(${x}) fin`));
  assert.equal(kamera(0), 0);
  assert.equal(kamera(1), 1);
  assert.equal(kamera(-0.5), 0);
  assert.equal(kamera(1.5), 1);
  const linjar = cubicBezier(0, 0, 1, 1);
  for (const x of XS) nara(linjar(x), x, 1e-6, "linjär");
  // Monoton.
  let forra = -1;
  for (let x = 0; x <= 1; x += 0.01) { const y = kamera(x); assert.ok(y >= forra - 1e-9); forra = y; }
});

// --- Fejk-DOM för den riktiga kameran -----------------------------------------
function fejkLager(id) {
  const klasser = new Set();
  return {
    id,
    style: {},
    inert: false,
    offsetWidth: 100,
    classList: {
      add: (k) => klasser.add(k),
      remove: (k) => klasser.delete(k),
      contains: (k) => klasser.has(k),
    },
  };
}

// Geometri som på desktop (#373): stage 1280×760, lagren 1240×610 centrerade,
// by/skola förankrade i toppen, rum-lagret = HELA staget (avvikande box).
const STAGE = { w: 1280, h: 760 };
const BOX = { x: 20, y: 75, w: 1240, h: 610 };
const BOX_TOPP = { x: 20, y: 0, w: 1240, h: 610 };
const BOX_RUM = { x: 0, y: 0, w: STAGE.w, h: STAGE.h };

// De fyra kamerorna som i appen (pages-varld, varld-kompis, varld-grannby, varld-gard).
// Dynamiska fokus (skolans by-plats, egna/kamratens tomt) får representativa värden.
const KAMEROR = {
  huvud: { // T1 skola↔by, T2 by↔hus, T3 hus↔rum
    nivaer: [
      { id: "skola", fokus: { x: 31.25, y: 42 }, zoom: 5, box: BOX_TOPP },
      { id: "by", fokus: { x: 62.4, y: 57.5 }, zoom: 5, box: BOX_TOPP },
      { id: "hus", fokus: { x: 48.5, y: 52 }, zoom: 6, box: BOX },
      { id: "rum", fokus: { x: 50, y: 50 }, zoom: 6, box: BOX_RUM },
    ],
    resa: ["by", "hus", "rum", "hus", "by", "skola", "by", "hus", "rum", "hus", "by", "skola"],
    hopp: ["rum", "skola", "hus", "by", "rum"],
  },
  kompis: { // T4 by↔kompishus
    nivaer: [
      { id: "by", fokus: { x: 18.2, y: 71 }, zoom: 5, box: BOX_TOPP },
      { id: "kompishus", fokus: { x: 48.5, y: 52 }, zoom: 6, box: BOX },
    ],
    resa: ["kompishus", "by", "kompishus", "by"],
    hopp: ["kompishus", "by"],
  },
  grannby: { // T5 skola↔grannby, T6 grannby↔grannbyhus
    nivaer: [
      { id: "skola", fokus: { x: 77, y: 30 }, zoom: 5, box: BOX_TOPP },
      { id: "grannby", fokus: { x: 40, y: 64 }, zoom: 5, box: BOX_TOPP },
      { id: "grannbyhus", fokus: { x: 48.5, y: 52 }, zoom: 6, box: BOX },
    ],
    resa: ["grannby", "grannbyhus", "grannby", "skola", "grannby", "grannbyhus"],
    hopp: ["skola", "grannbyhus", "skola"],
  },
  gard: { // T7 hus↔gård, T8 gård↔laggård
    nivaer: [
      { id: "hus", fokus: { x: 50, y: 46 }, zoom: 5, box: BOX },
      { id: "gard", fokus: { x: 82, y: 74 }, zoom: 5, box: BOX },
      { id: "laggard", fokus: { x: 50, y: 50 }, zoom: 5, box: BOX },
    ],
    resa: ["gard", "laggard", "gard", "hus", "gard", "laggard"],
    hopp: ["laggard", "hus"],
  },
};

/** Läs ett fejk-lagers inline-stil som stage-px-värden (som webbläsaren tolkar dem). */
function lasDom(el, box) {
  const tr = el.style.transform;
  const scale = tr == null ? null : Number(/^scale\(([^)]+)\)$/.exec(tr)[1]);
  let originPx = null;
  if (el.style.transformOrigin != null) {
    const [x, y] = el.style.transformOrigin.split(" ").map((v) => parseFloat(v));
    originPx = { x: box.x + (x / 100) * box.w, y: box.y + (y / 100) * box.h };
  }
  return {
    scale, originPx,
    opacity: el.style.opacity == null ? null : Number(el.style.opacity),
    synlig: !el.classList.contains("varld-dold"),
    inert: el.inert,
  };
}

/** Jämför DOM med förväntat; null i förväntat = "behåll" → jämför mot förra DOM-läget. */
function jamfor(namn, kam, els, forvantat, forra) {
  forvantat.forEach((f, j) => {
    const dom = lasDom(els[j], kam.nivaer[j].box);
    const msg = `${namn} lager ${f.id}`;
    const scale = f.scale ?? forra[j].scale;
    const origin = f.originPx ?? forra[j].originPx;
    if (scale == null) assert.equal(dom.scale, null, msg); else nara(dom.scale, scale, 1e-12, `${msg} scale`);
    if (origin == null) assert.equal(dom.originPx, null, msg);
    else {
      nara(dom.originPx.x, origin.x, 1e-9, `${msg} origo x`);
      nara(dom.originPx.y, origin.y, 1e-9, `${msg} origo y`);
    }
    assert.equal(dom.opacity, f.opacity, `${msg} opacity`);
    assert.equal(dom.synlig, f.synlig, `${msg} synlig`);
    assert.equal(dom.inert, f.inert, `${msg} inert`);
  });
  return els.map((el, j) => lasDom(el, kam.nivaer[j].box));
}

async function medKamera(fn) {
  const { createKamera } = await import("../src/varld-kamera.js");
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await fn(createKamera);
  } finally {
    mock.timers.reset();
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  }
}

for (const [namn, kam] of Object.entries(KAMEROR)) {
  test(`lagerState = varld-kamera apply() – kamera "${namn}" (alla övergångar + hopp)`, async () => {
    await medKamera(async (createKamera) => {
      const els = kam.nivaer.map((n) => fejkLager(n.id));
      const nivaer = kam.nivaer.map((n, j) => ({ id: n.id, el: els[j], fokus: n.fokus, zoom: n.zoom }));
      const geo = kam.nivaer;
      const idx = (id) => geo.findIndex((n) => n.id === id);
      const kamera = createKamera({ nivaer, startId: geo[0].id });
      let k = 0;
      let forra = jamfor(`${namn} start`, kam, els, lagerState(geo, 0), geo.map(() => ({})));
      mock.timers.tick(1000);
      forra = jamfor(`${namn} start vila`, kam, els, vilaState(geo, 0), forra);

      for (const mal of kam.resa) {
        const m = idx(mal);
        const origo = Math.min(m, k);
        kamera.gaTill(mal);
        forra = jamfor(`${namn} ${geo[k].id}→${mal}`, kam, els, lagerState(geo, m, origo), forra);
        mock.timers.tick(1000);
        forra = jamfor(`${namn} ${geo[k].id}→${mal} vila`, kam, els, vilaState(geo, m, origo), forra);
        k = m;
      }
      for (const mal of kam.hopp) {
        const m = idx(mal);
        kamera.hoppaTill(mal);
        forra = jamfor(`${namn} hopp→${mal}`, kam, els, lagerState(geo, m), forra);
        mock.timers.tick(1000);
        forra = jamfor(`${namn} hopp→${mal} vila`, kam, els, vilaState(geo, m), forra);
        k = m;
      }
    });
  });
}

test("rum-lagrets avvikande box: hus-fokus i % räknas mot RUMMETS box (som CSS)", () => {
  const geo = KAMEROR.huvud.nivaer;
  const inne = lagerState(geo, 3, 2); // hus → rum
  const rum = inne[3];
  const hus = inne[2];
  // Rummet: origo = husets fokus-% mot hela staget.
  assert.deepEqual(rum.originPx, { x: 0.485 * 1280, y: 0.52 * 760 });
  // Huset: samma % mot sin egen (mindre, centrerade) box → en ANNAN stage-punkt.
  assert.deepEqual(hus.originPx, { x: 20 + 0.485 * 1240, y: 75 + 0.52 * 610 });
  assert.notDeepEqual(rum.originPx, hus.originPx);
  assert.equal(hus.scale, 6);
  assert.equal(rum.scale, 1);
  // Vila på hus: rummet står nedkrympt 1/6 kring hus-fokus-% i sin egen box.
  const ute = lagerState(geo, 2, 2)[3];
  assert.equal(ute.scale, 1 / 6);
  assert.deepEqual(ute.originPx, rum.originPx);
  // Övriga lager (skolan) lämnas orörda och göms.
  assert.equal(inne[0].scale, null);
  assert.equal(inne[0].synlig, false);
});

// --- interpolera --------------------------------------------------------------
test("interpolera: transform 900 ms kamera-bezier, opacitet 250 ms paus + 550 ms ease", () => {
  const geo = KAMEROR.huvud.nivaer;
  const fran = vilaState(geo, 2); // står på hus
  const till = lagerState(geo, 3, 2); // går in i rummet
  const kamera = cubicBezier(...KAMERA_TRANSFORM.ease);
  const ease = cubicBezier(...KAMERA_OPACITY.ease);
  const vid = (t) => interpolera(fran, till, t);

  // t=0 = startbilden (inget hopp), t≥900 = slutbilden.
  const s0 = vid(0);
  assert.equal(s0[2].scale, 1); assert.equal(s0[2].opacity, 1);
  assert.equal(s0[3].scale, 1 / 6); assert.equal(s0[3].opacity, 0);
  const s9 = vid(900);
  assert.equal(s9[2].scale, 6); assert.equal(s9[2].opacity, 0);
  assert.equal(s9[3].scale, 1); assert.equal(s9[3].opacity, 1);
  assert.deepEqual(vid(5000), s9);

  // Opaciteten står still de första 250 ms.
  for (const t of [0, 100, 249, 250]) {
    assert.equal(vid(t)[2].opacity, 1, `hus opacitet vid ${t}`);
    assert.equal(vid(t)[3].opacity, 0, `rum opacitet vid ${t}`);
  }
  // …sedan CSS ease över 550 ms och klar vid 800 ms (före transformen).
  for (const t of [300, 400, 525, 600, 700, 799]) {
    const p = ease((t - 250) / 550);
    nara(vid(t)[3].opacity, p, 1e-12, `rum opacitet vid ${t}`);
    nara(vid(t)[2].opacity, 1 - p, 1e-12, `hus opacitet vid ${t}`);
  }
  assert.equal(vid(800)[3].opacity, 1);
  nara(vid(525)[3].opacity, CHROME.ease[XS.indexOf(0.5)], 0.002, "Chrome ease(0.5)");

  // Skalan följer kamerakurvan linjärt i scale-värdet (CSS interpolerar scale()).
  for (const t of [90, 225, 450, 675, 810]) {
    const p = kamera(t / 900);
    nara(vid(t)[2].scale, 1 + (6 - 1) * p, 1e-12, `hus scale vid ${t}`);
    nara(vid(t)[3].scale, 1 / 6 + (1 - 1 / 6) * p, 1e-12, `rum scale vid ${t}`);
  }
  // Origo slår om direkt (inte transitionerat): hela vägen = till-origot.
  for (const t of [0, 450, 900]) {
    assert.deepEqual(vid(t)[3].originPx, till[3].originPx);
    assert.deepEqual(vid(t)[2].originPx, till[2].originPx);
  }
  // Synlighet: rum-lagret syns direkt, avlägsna lager göms direkt.
  assert.equal(fran[3].synlig, false);
  assert.equal(vid(0)[3].synlig, true);
  assert.equal(vid(0)[0].synlig, false);
});

test("interpolera ut (rum → hus): origo-tricket ger ingen hoppande startbild", () => {
  const geo = KAMEROR.huvud.nivaer;
  const fran = vilaState(geo, 3, 2);
  const till = lagerState(geo, 2, 2);
  const s0 = interpolera(fran, till, 0);
  // Rummet står i scale(1) vid start → bytt origo syns inte (matrisen = identitet).
  assert.deepEqual(lagerMatris(s0[3]), { s: 1, tx: 0, ty: 0 });
  // Huset börjar uppförstorat ×6 kring sitt eget fokus och tonar in.
  assert.equal(s0[2].scale, 6);
  assert.equal(s0[2].opacity, 0);
  nara(interpolera(fran, till, 900)[3].scale, 1 / 6, 1e-12);
});

test("interpolera fyller 'behåll'-fält (null) från fran", () => {
  const geo = KAMEROR.huvud.nivaer;
  const fran = vilaState(geo, 1);
  const till = lagerState(geo, 2, 1); // by → hus: skolan blir 'orörd'
  assert.equal(till[0].scale, null);
  const mitt = interpolera(fran, till, 450);
  assert.equal(mitt[0].scale, fran[0].scale);
  assert.deepEqual(mitt[0].originPx, fran[0].originPx);
  assert.equal(lagerSyns(mitt[0]), false);
});

// --- lagerMatris ---------------------------------------------------------------
test("lagerMatris = CSS scale kring transform-origin (stage-px)", () => {
  const l = { id: "x", box: { x: 20, y: 75, w: 1240, h: 610 }, scale: 6, originPx: { x: 621.4, y: 392.2 }, opacity: 1, synlig: true };
  const m = lagerMatris(l);
  // Origo står still; lagrets hörn (lokal 0,0) flyttas bort från origo ×6.
  const tillStage = (px, py) => ({ x: m.s * px + m.tx, y: m.s * py + m.ty });
  const o = tillStage(l.originPx.x - l.box.x, l.originPx.y - l.box.y);
  nara(o.x, l.originPx.x, 1e-9); nara(o.y, l.originPx.y, 1e-9);
  const h = tillStage(0, 0);
  nara(h.x, l.originPx.x + 6 * (l.box.x - l.originPx.x), 1e-9);
  nara(h.y, l.originPx.y + 6 * (l.box.y - l.originPx.y), 1e-9);
  assert.deepEqual(lagerMatris({ ...l, scale: 1 }), { s: 1, tx: 20, ty: 75 });
});

// --- Boot-säkerhet --------------------------------------------------------------
test("varld-render*.js ligger UTANFÖR den statiska bootgrafen (133 filer)", () => {
  // Statiska import- OCH re-export-satser (export … from) – inte import().
  const staticImportRe = /^\s*(?:import|export)\s+(?:[^'"`;()]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = readFileSync(resolve(SRC, rel), "utf8"); } catch { continue; }
    let m;
    while ((m = staticImportRe.exec(code))) {
      if (!m[1].startsWith(".")) continue;
      queue.push(resolve(dirname(resolve(SRC, rel)), m[1]).slice(SRC.length + 1));
    }
  }
  assert.equal(seen.size, 133, "bootgrafen ska vara oförändrad");
  for (const f of ["varld-render.js", "varld-render-worker.js", "varld-render-anim.js"]) {
    assert.ok(!seen.has(f), `${f} får inte vara statiskt nåbar från app.js`);
  }
  // Ingen fil i src/ importerar renderaren statiskt (den nås bara via import()/Worker).
  const kamera = readFileSync(resolve(SRC, "varld-kamera.js"), "utf8");
  assert.ok(!/varld-render/.test(kamera));
});
