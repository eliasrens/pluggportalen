// ============================================================================
// Rörelse-motorns koppling i kameran (#396, F4 #418)
//   • Utan motor och med en motor som säger nej (pp:pixi:av, ej klar …) är
//     kameran BIT-FÖR-BIT dagens: samma inline-stilar, samma timer (900 ms).
//   • Med en motor som säger ja: spela(spec) med rätt yttre/inre/riktning, DOM
//     till samma slutläge via tillampaDom, onNiva när motorns promise löser.
//   • Alla kameror registreras – även de som skapats före setRorelseMotor.
//   • lagerSyns respekterar pyramidnivåns zFran.
//   • Boot-säkerhet: inga motor-/vila-/profil-filer i den statiska bootgrafen.
//   • F4b (#428): omspegling bara för levande ambient UTANFÖR sprites; målens
//     scen-API (forvarmMal/forvarmLager) säger nej utan mål/fokus; profilformatet.
// ============================================================================

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lagerSyns } from "../src/varld-render-anim.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// --- Minimal miljö för varld-kamera.js -------------------------------------------
globalThis.window ??= {};
window.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);

function lager(id, stage) {
  const cls = new Set();
  return {
    id,
    parentElement: stage,
    style: {},
    inert: false,
    offsetWidth: 100,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    get klasser() { return [...cls].sort().join(" "); },
  };
}
function scen() {
  const stage = { id: "stage" };
  const by = { id: "by", el: lager("by-lager", stage), fokus: { x: 30, y: 40 }, zoom: 5 };
  const hus = { id: "hus", el: lager("ute-lager", stage), fokus: { x: 48.5, y: 52 }, zoom: 6 };
  const rum = { id: "rum", el: lager("rum-lager", stage), fokus: { x: 50, y: 50 }, zoom: 6 };
  return { stage, nivaer: [by, hus, rum] };
}
const bild = (nivaer) => nivaer.map((n) => ({ ...n.el.style, inert: n.el.inert, klasser: n.el.klasser }));

const K = await import("../src/varld-kamera.js");

async function kor(motor, t) {
  K.setRorelseMotor(motor);
  const { stage, nivaer } = scen();
  const niva = [];
  const kam = K.createKamera({ nivaer, startId: "hus", onNiva: (id) => niva.push([id, Date.now()]) });
  t.mock.timers.tick(20); // startlägets rAF
  const t0 = Date.now();
  const p = kam.gaTill("by");
  const direkt = bild(nivaer);
  t.mock.timers.tick(899);
  const fore = niva.length;
  t.mock.timers.tick(1);
  await p;
  t.mock.timers.tick(100);
  K.setRorelseMotor(null);
  return { stage, nivaer, niva, direkt, slut: bild(nivaer), fore, t0, aktiv: kam.aktivId };
}

test("utan motor = med motor som säger nej: samma inline-stilar och samma 900 ms-timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const utan = await kor(null, t);
  const nej = await kor({ registrera() {}, kanSpela: () => false, spela: () => assert.fail("ska inte spela"), avbryt() {} }, t);
  assert.deepEqual(nej.direkt, utan.direkt);
  assert.deepEqual(nej.slut, utan.slut);
  assert.equal(utan.fore, 0, "onNiva inte före 900 ms");
  assert.deepEqual(utan.niva.map(([id, ts]) => [id, ts - utan.t0]), [["by", 900]]);
  assert.deepEqual(nej.niva.map(([id, ts]) => [id, ts - nej.t0]), [["by", 900]]);
  // Korszoomens semantik: by aktivt, hus nedkrympt kring byns fokus.
  assert.equal(utan.direkt[0].transform, "scale(1)");
  assert.equal(utan.direkt[1].transform, "scale(0.2)");
  assert.equal(utan.direkt[1].transformOrigin, "30% 40%");
});

test("motor som säger ja: spela(spec) + tillampaDom ger samma slutläge, onNiva när motorn löser", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const utan = await kor(null, t);
  const anrop = [];
  const motor = {
    registrera() {},
    kanSpela: (spec) => { anrop.push(["kan", spec.yttre.id, spec.inre.id, spec.riktning, spec.stage.id]); return true; },
    spela(spec, tillampaDom) {
      anrop.push(["spela"]);
      tillampaDom();
      return new Promise((r) => setTimeout(r, 900));
    },
    avbryt() { anrop.push(["avbryt"]); },
  };
  const ja = await kor(motor, t);
  assert.deepEqual(anrop, [["kan", "by", "hus", "ut", "stage"], ["spela"]]);
  assert.deepEqual(ja.direkt, utan.direkt, "tillampaDom = apply(mål, origo)");
  assert.deepEqual(ja.slut, utan.slut);
  assert.deepEqual(ja.niva.map(([id, ts]) => [id, ts - ja.t0]), [["by", 900]]);
  assert.equal(ja.aktiv, "by");
});

test("alla kameror registreras (även retroaktivt) och hoppaTill avbryter motorn", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  K.setRorelseMotor(null);
  const a = scen(), b = scen();
  K.createKamera({ nivaer: a.nivaer, startId: "hus" });
  const reg = [];
  let avbrutna = 0;
  const motor = { registrera: (n) => reg.push(n), kanSpela: () => false, spela() {}, avbryt: () => avbrutna++ };
  K.setRorelseMotor(motor);
  assert.ok(reg.includes(a.nivaer), "kamera skapad före motorn registreras när motorn kopplas in");
  const kb = K.createKamera({ nivaer: b.nivaer, startId: "hus" });
  assert.ok(reg.includes(b.nivaer), "kamera skapad efter motorn registreras direkt");
  kb.hoppaTill("rum");
  assert.equal(avbrutna, 1);
  t.mock.timers.tick(2000);
  K.setRorelseMotor(null);
});

test("lagerSyns: pyramidnivå med zFran ritas bara när lagret står i minst den skalan", () => {
  const l = { synlig: true, opacity: 1, scale: 1 };
  assert.equal(lagerSyns({ ...l, zFran: 1 }), true);
  assert.equal(lagerSyns({ ...l, zFran: 1.4953 }), false, "ingen nedskalad nivå i vila");
  assert.equal(lagerSyns({ ...l, scale: 1.5, zFran: 1.4953 }), true);
  assert.equal(lagerSyns({ ...l, scale: 1 / 6, zFran: 1 / 6 }), true, "inre rollens grovaste nivå vid start");
  assert.equal(lagerSyns({ ...l, scale: 0.3, zFran: 0.4472 }), false);
  assert.equal(lagerSyns(l), true, "utan zFran som förut");
});

test("motor/vila/profil ligger UTANFÖR den statiska bootgrafen (133 filer)", () => {
  const re = /^\s*(?:import|export)\s+(?:[^'"`;()]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = readFileSync(resolve(SRC, rel), "utf8"); } catch { continue; }
    let m;
    while ((m = re.exec(code))) {
      if (m[1].startsWith(".")) queue.push(resolve(dirname(resolve(SRC, rel)), m[1]).slice(SRC.length + 1));
    }
  }
  assert.equal(seen.size, 133);
  for (const f of ["varld-motor.js", "varld-motor-textur.js", "varld-motor-hud.js", "varld-vila.js", "varld-profil-standard.js",
    "varld-motor-mal.js", "varld-motor-forbered.js", "varld-motor-overlagg.js", "varld-spegel-neutral.js"]) {
    assert.ok(!seen.has(f), `${f} får inte vara statiskt nåbar`);
  }
  const kamera = readFileSync(resolve(SRC, "varld-kamera.js"), "utf8");
  assert.ok(!/^\s*import\s/m.test(kamera), "varld-kamera.js har ingen import");
  const pv = readFileSync(resolve(SRC, "pages-varld.js"), "utf8");
  assert.match(pv, /import\("\.\/varld-motor\.js"\)/);
});

// --- F4b (#428) ---------------------------------------------------------------------
const TX = await import("../src/varld-motor-textur.js");
const { skapaForvarmare } = await import("../src/varld-motor-mal.js");
const standard = (await import("../src/varld-profil-standard.js")).default;

/** Minimal nod: closest() mot en liten selektor-"matchare" (klassnamn). */
function nod(klass, forfader = null) {
  return {
    klass, forfader,
    closest(sel) {
      for (let n = this; n; n = n.forfader) if (sel.split(",").some((s) => s.trim() === `.${n.klass}`)) return n;
      return null;
    },
  };
}
function lagerMed(profilNamn, anims) {
  const l = nod("lager");
  l.dataset = { spegelProfil: profilNamn };
  l.contains = (t) => { for (let n = t; n; n = n.forfader) if (n === l) return true; return false; };
  l.getAnimations = () => anims(l);
  return l;
}

test("levandeBas: bara levande animationer UTANFÖR profilens sprites kräver omspegling", async () => {
  TX.registreraProfil("t428", { sprites: [".hus-rok"], ambient: [".hus-moln"] });
  await TX.laddaProfil({ dataset: { spegelProfil: "t428" } });
  const spelar = (target) => ({ playState: "running", effect: { target } });
  const baraRok = lagerMed("t428", (l) => [spelar(nod("hus-rok", nod("tomt", l)))]);
  assert.equal(TX.levandeBas(baraRok), false, "röken är sprite → förvärmd bas gäller");
  const moln = lagerMed("t428", (l) => [spelar(nod("hus-rok", l)), spelar(nod("hus-moln", l))]);
  assert.equal(TX.levandeBas(moln), true, "ambient (moln) bakas in → omspegling");
  const egen = lagerMed("t428", (l) => [spelar(l)]);
  assert.equal(TX.levandeBas(egen), false, "lagrets egen animation räknas inte");
  // Vilans pausade animationer (alla lager) → bara de i DETTA lager räknas.
  const annat = nod("hus-moln", nod("annat-lager"));
  assert.equal(TX.levandeBas(baraRok, [spelar(annat)]), false);
});

test("profilformatet: standardprofilen har sprites + malSelektor, ambient tom", () => {
  assert.deepEqual(standard.ambient, []);
  assert.deepEqual(standard.sprites, []);
  assert.equal(standard.malSelektor, null);
  assert.ok(standard.objekt);
});

test("målförvärmaren: forvarmMal/forvarmLager säger nej utan mål, fokus eller ledig motor", () => {
  const stage = {};
  const lager = { parentElement: stage, contains: () => true };
  const el = (ds) => ({ dataset: ds, closest: (s) => (s === ".varld-lager" ? lager : null) });
  let ledig = true;
  const F = skapaForvarmare({ stage: () => stage, yta: () => null, kameror: new Set(), ledig: () => ledig, logga() {} });
  assert.equal(F.forvarmLager(lager), false, "inget aktivt mål → inget byggs");
  assert.equal(F.forvarmMal(el({})), false, "utan data-fokus-x/y");
  ledig = false;
  assert.equal(F.forvarmMal(el({ fokusX: "30", fokusY: "40" })), false, "under rörelse");
  assert.equal(F.forvarmMal(null), false);
  assert.equal(F.mal, null);
});
