// ============================================================================
// Matchdagen 1c (#869, spec §15 "3D"): 2D-reserven utan WebGL, lugnt läge och
// bootgrafen. Planen (plan/md-plan.js) körs mot en mini-DOM där
// canvas.getContext("webgl") ger null: den ska bli typ "2d", spela upp motorns
// händelser och aldrig röra three.js. Lugnt läge: inga animationer, spelarna
// och bollen hoppar direkt, korta pauser. Källkodstest: three.js och planen nås
// bara med import(), inga filer över 400 rader.
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANIM, kortNamn, skapaPlan, valjTyp } from "../src/matchdagen/plan/md-plan.js";
import { FART, stegaFigur } from "../src/matchdagen/plan/md-tre-figur.js";
import { andraHalvlek, lage, nyMatch, spela } from "../src/matchdagen/delat/md-motor.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

/** Ett element som tål allt planen gör med det (Proxy: okända metoder är no-op). */
function element(tag = "div") {
  const barn = [];
  const animationer = [];
  const hittade = new Map(); // samma selektor → samma element
  const bas = {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, innerHTML: "", textContent: "", clientWidth: 1100, clientHeight: 380,
    children: barn, animeringar: animationer,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(c) { barn.push(c); return c; },
    querySelector: (sel) => { if (!hittade.has(sel)) hittade.set(sel, element("g")); return hittade.get(sel); },
    querySelectorAll: () => [],
    getContext: (typ) => (typ === "2d" ? new Proxy({}, { get: () => () => {} }) : null), // ingen WebGL
    animate(kf, o) { animationer.push({ kf, o }); return { cancel() {} }; },
    getAnimations: () => [],
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1100, height: 380 }),
  };
  return new Proxy(bas, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
}

const sparat = {};
before(() => {
  for (const k of ["document", "requestAnimationFrame", "cancelAnimationFrame"]) sparat[k] = globalThis[k];
  globalThis.document = { createElement: (t) => element(t), createElementNS: (_, t) => element(t) };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
after(() => { for (const [k, v] of Object.entries(sparat)) globalThis[k] = v; });

const LAG = { vi: { troja: "#2f6fe8", byxor: "#fff", mv: "#ffd23f", kapten: 3 }, dem: { troja: "#e8473f", byxor: "#1c2433", mv: "#1b1b1b" } };

/** En hel match med motorn – alla händelser spelas upp på planen. */
async function spelaUpp(plan, { lagen = 400 } = {}) {
  const r = skapaPrng("plan").tal;
  let m = nyMatch({ mot: { namn: "Ekebacka IF", styrka: 0.2 } });
  plan.stall(m, { avspark: true });
  const typer = new Set();
  for (let i = 0; i < lagen && !m.slut; i++) {
    if (m.halvtid) { m = andraHalvlek(m); plan.stall(m, { avspark: true }); continue; }
    const l = lage(m);
    const v = l.val.find((x) => !x.av && (x.id !== "skjut" || r() < 0.6)) || l.val.find((x) => !x.av);
    const n = v ? v.fragor : l.fragor;
    const ut = spela(m, v ? v.id : null, Array.from({ length: n }, () => r() < 0.7), r);
    typer.add(`${ut.h.typ}:${ut.h.utfall}`);
    await plan.spela(ut.h, ut.m);
    m = ut.m;
  }
  return { m, typer };
}

describe("2D-reserven (§4)", () => {
  it("valjTyp: utan WebGL eller med ?2d=1 blir det 2D", () => {
    assert.equal(valjTyp({ webgl: false }), "2d");
    assert.equal(valjTyp({ webgl: true, tvinga2d: true }), "2d");
    assert.equal(valjTyp({ webgl: true }), "3d");
  });
  it("utan WebGL startar planen som 2D och spelar en hel match (samma händelser)", async () => {
    const utrop = [];
    const plan = await skapaPlan({ yta: element(), lugnt: true, vi: LAG.vi, dem: LAG.dem, hooks: { utrop: (t) => utrop.push(t) } });
    assert.equal(plan.typ, "2d");
    const { m, typer } = await spelaUpp(plan);
    assert.ok(m.slut, "matchen spelades klart");
    assert.ok(typer.size >= 6, `många slags händelser: ${[...typer].join(", ")}`);
    if (m.oss) assert.ok(utrop.includes("MÅÅÅL!"));
    assert.ok(utrop.every((t) => !/dålig|usel|pinsam/i.test(t)));
    plan.dispose();
  });
  it("2D-reservens boll animeras (Web Animations) – men inte i lugnt läge", async () => {
    const h = { typ: "anfall", val: "kort", fran: { x: 50, y: 34 }, till: { x: 70, y: 30 }, boll: "oss", hojd: "mark", utfall: "ok" };
    const animationer = async (lugnt) => {
      const yta = element();
      const plan = await skapaPlan({ yta, lugnt, vi: LAG.vi, dem: LAG.dem });
      await plan.spela(h, {});
      plan.dispose();
      return yta.children[0].querySelector(".md2-boll").animeringar.length;
    };
    assert.ok((await animationer(false)) > 0);
    assert.equal(await animationer(true), 0);
  });
});

describe("lugnt läge och prefers-reduced-motion (§4)", () => {
  it("spelarna hoppar direkt till sina platser i lugnt läge, springer annars", () => {
    const figur = () => ({
      position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 },
      userData: { mal: { x: 20, z: 10 }, placerad: true, fas: 0, hopp: 0, bv: { rotation: {} }, bh: { rotation: {} }, av: { rotation: {} }, ah: { rotation: {} } },
    });
    const lugn = figur();
    stegaFigur(lugn, 1 / 60, { direkt: true });
    assert.deepEqual([lugn.position.x, lugn.position.z], [20, 10]);
    assert.equal(lugn.userData.bv.rotation.x, 0, "inga svängande ben");
    const vanlig = figur();
    stegaFigur(vanlig, 1 / 60, {});
    const flytt = Math.hypot(vanlig.position.x, vanlig.position.z);
    assert.ok(flytt > 0 && flytt <= FART * 1.6 / 60 + 1e-9, "springer en bit per bildruta");
    lugn.userData.hopp = 1;
    stegaFigur(lugn, 1 / 60, { direkt: true, tid: 1 });
    assert.equal(lugn.position.y, 0, "inget studsande firande i lugnt läge");
  });
  it("en hel match i lugnt läge går fort – inga långa animationer", async () => {
    const plan = await skapaPlan({ yta: element(), lugnt: true, vi: LAG.vi, dem: LAG.dem });
    const t0 = Date.now();
    const r = skapaPrng("lugn").tal;
    let m = nyMatch({ mot: { namn: "X", styrka: 0.2 } });
    for (let i = 0; i < 6 && !m.slut; i++) {
      const l = lage(m);
      const v = l.val.find((x) => !x.av);
      const ut = spela(m, v ? v.id : null, Array.from({ length: v ? v.fragor : l.fragor }, () => true), r);
      await plan.spela(ut.h, ut.m);
      m = ut.m;
    }
    assert.ok(Date.now() - t0 < 6 * 2 * 360 + 400, "pauserna är högst 0,35 s i lugnt läge");
    assert.ok(ANIM.mal > 2000, "utan lugnt läge får målet sin tid");
    plan.dispose();
  });
  it("3D-ritaren: fast kamera och ingen zoom i lugnt läge (källkod)", () => {
    const src = readFileSync("src/matchdagen/plan/md-tre-ritare.js", "utf8");
    assert.match(src, /if \(lugnt\) \{ \/\/ fast vy över hela planen/);
    assert.match(src, /zoomTill = pa && !lugnt/);
    assert.match(readFileSync("src/matchdagen/md-app.js", "utf8"), /prefers-reduced-motion: reduce/);
  });
  it("kortNamn för skylten och utropet", () => {
    assert.equal(kortNamn("Ekebacka IF"), "EI");
    assert.equal(kortNamn("Björkhagen United FC Extra"), "BUF");
  });
});

describe("källkod: bootgrafen och three.js (§0, §4)", () => {
  const filer = [];
  const ga = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) ga(p); else if (/\.js$/.test(n)) filer.push(p);
    }
  };
  ga("src/matchdagen");
  const statiska = (src) => [...src.replace(/\/\/.*$/gm, "").matchAll(/^\s*(?:import|export)\s+[^;(]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  it("three.js laddas bara i src/tre/tre-ladda.js, och planen bara med import()", () => {
    for (const f of filer) {
      const src = readFileSync(f, "utf8");
      assert.ok(!/vendor\/three/.test(src), `${f}: rör inte vendor/three direkt`);
      for (const s of statiska(src)) {
        assert.ok(!/tre-ladda|md-tre-|md-plan-2d|md-ljud/.test(s) || f.includes("/plan/"), `${f}: statisk import av ${s}`);
      }
    }
    const plan = readFileSync("src/matchdagen/plan/md-plan.js", "utf8");
    assert.match(plan, /await import\("\.\.\/\.\.\/tre\/tre-ladda\.js"\)/);
    assert.match(plan, /import\("\.\/md-tre-ritare\.js"\)/);
    assert.match(plan, /import\("\.\/md-plan-2d\.js"\)/);
    assert.ok(!statiska(plan).some((s) => /tre-ritare|plan-2d|tre-ladda/.test(s)));
    const spel = readFileSync("src/matchdagen/vy/md-match-spel.js", "utf8");
    assert.match(spel, /import\("\.\.\/plan\/md-plan\.js"\)/, "planen laddas först när matchen startar");
  });
  it("elevens sida och lärarens flik laddas med import() (inte i bootgrafen)", () => {
    const app = readFileSync("src/app.js", "utf8");
    assert.match(app, /import\("\.\/matchdagen\/page-matchdagen\.js"\)/);
    const tc = readFileSync("src/teacher-class.js", "utf8");
    assert.match(tc, /import\("\.\/matchdagen\/larare\/md-larare-stat\.js"\)/);
    assert.ok(!statiska(tc).some((s) => s.includes("matchdagen/")));
  });
  it("inga filer över 400 rader och inga emojier från Emoji 13+", () => {
    const ny = (cp) => cp >= 0x1fa70 && cp <= 0x1faff;
    for (const f of [...filer, "src/tre/tre-ladda.js", "src/styles/49-matchdagen-match.css", "preview/preview-matchdagen.html"]) {
      const src = readFileSync(f, "utf8");
      assert.ok(src.split("\n").length <= 401, `${f} ≤ 400 rader`);
      assert.ok(![...src].some((c) => ny(c.codePointAt(0))), `${f}: Emoji 13+`);
    }
  });
});
