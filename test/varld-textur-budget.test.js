// Textur-budget + pyramid-planering för Pixi-rörelsen (#396, F3 #417).
// Ren logik: varld-textur-budget.js + de DOM-fria hjälparna i varld-textur.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enhetsKlass, budget, nivaer, texturBytes, forstoringVid, maxForstoring, TexturLRU,
} from "../src/varld-textur-budget.js";
import { planeraNiva, byggOrdning, koa, koStats, nollstallKoStats } from "../src/varld-textur.js";

const MB = 1024 * 1024;
const nara = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

test("nivaer(0.2, 5, 1.5): 1 ingår, ändpunkter exakta, kvot ≤ 1.5, färsta antal", () => {
  const z = nivaer(0.2, 5, 1.5);
  assert.deepEqual(z, [0.2, 0.2991, 0.4472, 0.6687, 1, 1.4953, 2.2361, 3.3437, 5]);
  for (let i = 1; i < z.length; i++) assert.ok(z[i] / z[i - 1] <= 1.5 + 1e-3, `kvot ${z[i] / z[i - 1]}`);
  // §6: ytter 1→5 = 5 nivåer, inre 0.2→0.67 = 4 nivåer (+ delad 1:a).
  assert.equal(z.filter((v) => v >= 1).length, 5);
  assert.equal(z.filter((v) => v < 1).length, 4);
});

test("nivaer: ytter-/innerroll för T3 (zoom 6) och T2 (zoom 5)", () => {
  assert.deepEqual(nivaer(1, 6, 1.5), [1, 1.431, 2.0477, 2.9302, 4.193, 6]); // log1.5(6) = 4.4 → 5 steg
  assert.deepEqual(nivaer(1 / 5, 1, 1.5), [0.2, 0.2991, 0.4472, 0.6687, 1]);
  assert.deepEqual(nivaer(1, 1, 1.5), [1]);
  assert.deepEqual(nivaer(5, 1, 1.5), nivaer(1, 5, 1.5)); // ordningen spelar ingen roll
  assert.deepEqual(nivaer(1, 1.5, 1.5), [1, 1.5]);
  assert.deepEqual(nivaer(1, 1.51, 1.5), [1, 1.2288, 1.51]);
  assert.throws(() => nivaer(0, 5, 1.5), RangeError);
  assert.throws(() => nivaer(1, 5, 1), RangeError);
});

test("texturBytes räknar med mip-kedjan (×4/3)", () => {
  assert.equal(texturBytes(1, 3), 16);
  assert.equal(texturBytes(2048, 2048), Math.ceil((2048 * 2048 * 4 * 4) / 3));
  // §6: Chromebook 1366×768 dpr 1 ≈ 5.6 MB per skärmstor nivå.
  assert.ok(nara(texturBytes(1366, 768) / MB, 5.34, 0.01));
  assert.equal(texturBytes(-5, 10), 0);
});

test("enhetsKlass för representativa navigator-värden", () => {
  // Chromebook (4 GB, 4 kärnor)
  assert.equal(enhetsKlass({ deviceMemory: 4, hardwareConcurrency: 4 }, 8192), "svag");
  // Billig Chromebook med 8 kärnor men 4 GB
  assert.equal(enhetsKlass({ deviceMemory: 4, hardwareConcurrency: 8 }, 16384), "svag");
  // 2 kärnor, okänt minne (Firefox)
  assert.equal(enhetsKlass({ hardwareConcurrency: 2 }, 16384), "svag");
  // Svag GPU (maxTex 4096) på annars stark maskin
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 4096), "svag");
  // Laptop 8 GB / 8 kärnor / 16384
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 16384), "normal");
  // MacBook Safari: ingen deviceMemory, 8 kärnor, maxTex okänd ännu
  assert.equal(enhetsKlass({ hardwareConcurrency: 8 }), "normal");
  // Inget alls → inget talar emot
  assert.equal(enhetsKlass(undefined), "normal");
  assert.equal(enhetsKlass({ deviceMemory: 0.5, hardwareConcurrency: 16 }, 16384), "svag");
});

test("budget(klass) = §6-värden (G1-kalibrerade), okänd → svag, kopia", () => {
  assert.deepEqual(budget("svag"), { maxBytes: 112 * MB, dprTak: 1, steg: 1.5, tegel: 2048, under1Upplosning: 0.5, maxPar: 2 }); // G1 #425-kalibrerad
  assert.deepEqual(budget("normal"), { maxBytes: 256 * MB, dprTak: 1.5, steg: 1.5, tegel: 2048, under1Upplosning: 1, maxPar: 3 });
  assert.deepEqual(budget("okänd"), budget("svag"));
  const b = budget("normal");
  b.tegel = 1;
  assert.equal(budget("normal").tegel, 2048);
});

test("TexturLRU: eviction i LRU-ordning tills budgeten ryms, rör() flyttar fram", () => {
  const slappta = [];
  const lru = new TexturLRU(100);
  const s = (k) => () => slappta.push(k);
  assert.deepEqual(lru.lagg("a", 30, s("a")), []);
  lru.lagg("b", 30, s("b"));
  lru.lagg("c", 30, s("c"));
  assert.equal(lru.summa(), 90);
  assert.equal(lru.rör("a"), true); // ordning nu b, c, a
  assert.deepEqual(lru.lagg("d", 50, s("d")), ["b", "c"]);
  assert.deepEqual(slappta, ["b", "c"]);
  assert.deepEqual(lru.nycklar(), ["a", "d"]);
  assert.equal(lru.summa(), 80);
  assert.equal(lru.rör("finns-ej"), false);
});

test("TexturLRU: låst post och den nya evictas aldrig; uppdatering anropar inte slapp", () => {
  const slappta = [];
  const lru = new TexturLRU(100);
  lru.lagg("spelas", 60, () => slappta.push("spelas"));
  lru.las("spelas");
  lru.lagg("ny", 70, () => slappta.push("ny"));
  assert.deepEqual(slappta, []);
  assert.equal(lru.over(), true);
  lru.lasUpp("spelas"); // nu får den gå
  assert.deepEqual(slappta, ["spelas"]);
  assert.equal(lru.summa(), 70);
  // Strömmande pyramid växer under samma nyckel → ingen slapp på sig själv.
  lru.lagg("ny", 90);
  assert.deepEqual(slappta, ["spelas"]);
  assert.equal(lru.summa(), 90);
  lru.slapp("ny");
  assert.deepEqual(slappta, ["spelas", "ny"]);
  assert.equal(lru.summa(), 0);
});

test("TexturLRU: stallMax evictar, rensa släpper allt, fel i slapp stoppar inte", () => {
  const slappta = [];
  const lru = new TexturLRU(1000);
  const orig = console.warn;
  console.warn = () => {};
  try {
    lru.lagg("a", 400, () => { throw new Error("x"); });
    lru.lagg("b", 400, () => slappta.push("b"));
    assert.deepEqual(lru.stallMax(500), ["a"]);
    lru.rensa();
  } finally {
    console.warn = orig;
  }
  assert.deepEqual(slappta, ["b"]);
  assert.equal(lru.summa(), 0);
  assert.equal(lru.storlek, 0);
});

test("planeraNiva: regionen = det som syns i scale(z) kring origo, klippt mot fångsten", () => {
  const fangst = { x: -60, y: 0, w: 640, h: 400 }; // stage 640×400, lagerbox inset 0 60px
  const o = { x: 0.485 * 520, y: 0.52 * 400 };
  const p1 = planeraNiva(1, o, fangst, fangst, { dpr: 1, upp: 1, tegel: 2048 });
  assert.deepEqual(p1.region, fangst);
  assert.equal(p1.tegel.length, 1);
  assert.equal(p1.bytes, texturBytes(640, 400));
  const p6 = planeraNiva(6, o, fangst, fangst, { dpr: 1, upp: 1, tegel: 2048 });
  // ≈ stage/6 kring origo, rastrerad i full stagestorlek (±1 px avrundning).
  assert.ok(nara(p6.region.w, 640 / 6, 0.5) && nara(p6.region.h, 400 / 6, 0.5));
  assert.ok(p6.region.x <= o.x + (fangst.x - o.x) / 6 + 1e-9);
  const px = p6.tegel[0].px;
  assert.ok(Math.abs(px.w - 640) <= 1 && Math.abs(px.h - 400) <= 1);
  assert.equal(p6.skala, 6);
});

test("planeraNiva: tegelsättning ≤ tegel, täcker regionen exakt, bytes per tegel", () => {
  const fangst = { x: 0, y: 0, w: 1920, h: 1080 };
  const p = planeraNiva(1, { x: 960, y: 540 }, fangst, fangst, { dpr: 1.5, upp: 1, tegel: 2048 });
  assert.equal(p.tegel.length, 2); // 2880×1620 → 2048 + 832
  assert.deepEqual(p.tegel.map((t) => t.px.w), [2048, 832]);
  for (const t of p.tegel) assert.ok(t.px.w <= 2048 && t.px.h <= 2048);
  const sum = p.tegel.reduce((s, t) => s + t.w, 0);
  assert.ok(nara(sum, p.region.w, 1e-9));
  assert.equal(p.bytes, texturBytes(2048, 1620) + texturBytes(832, 1620));
});

test("planeraNiva: z<1 i halv upplösning (svag) + inget syns → null", () => {
  const fangst = { x: 0, y: 0, w: 640, h: 400 };
  const p = planeraNiva(0.2, { x: 320, y: 200 }, fangst, fangst, { dpr: 1, upp: 0.5, tegel: 2048 });
  assert.deepEqual(p.region, fangst); // hela fångsten (vyn är större än lagret)
  assert.equal(p.tegel[0].px.w, 64);
  assert.equal(p.tegel[0].px.h, 40);
  assert.equal(planeraNiva(4, { x: 5000, y: 5000 }, { x: 4000, y: 4000, w: 100, h: 100 }, fangst, { dpr: 1, upp: 1, tegel: 2048 }), null);
});

test("pyramiden förstoras aldrig mer än steg (normal), z<1 halv upplösning på svag", () => {
  const fangst = { x: 0, y: 0, w: 1366, h: 768 };
  const o = { x: 683, y: 400 };
  const bygg = (zMin, zMax, b) => nivaer(zMin, zMax, b.steg).map((z) =>
    planeraNiva(z, o, fangst, fangst, { dpr: 1, upp: z < 1 ? b.under1Upplosning : 1, tegel: b.tegel }));
  const normal = budget("normal");
  const t3 = bygg(1, 6, normal);
  assert.ok(maxForstoring(t3) <= 1.5 + 1e-3, `T3 ${maxForstoring(t3)}`);
  assert.ok(nara(forstoringVid(t3, 6), 1));
  assert.ok(nara(forstoringVid(t3, 1), 1));
  const inre = bygg(0.2, 1, normal);
  assert.ok(maxForstoring(inre) <= 1.5 + 1e-3);
  const svag = bygg(0.2, 1, budget("svag"));
  assert.ok(nara(forstoringVid(svag, 0.2), 2)); // medvetet: inkommande lagret i ½ upplösning
  // §6: svag ytter 1→5 + inre 0.2→0.67 på 1366×768 ≈ 34 MB.
  const total = [...bygg(1, 5, budget("svag")), ...svag.filter((p) => p.z < 1)].reduce((s, p) => s + p.bytes, 0);
  assert.ok(total / MB > 25 && total / MB < 36, `${(total / MB).toFixed(1)} MB`);
});

test("byggOrdning: grovaste + nivå 1 först, sedan stigande", () => {
  assert.deepEqual(byggOrdning([1, 1.5, 2.25, 5]), { min: [1], ordning: [1, 1.5, 2.25, 5] });
  assert.deepEqual(byggOrdning([0.2, 0.3, 0.45, 0.67, 1]), { min: [0.2, 1], ordning: [0.2, 1, 0.3, 0.45, 0.67] });
});

// Köns MessagePort är unref:ad (håller inte node vid liv) → testerna håller loopen.
const medLoop = (fn) => async () => {
  const vakt = setInterval(() => {}, 1000);
  try { await fn(); } finally { clearInterval(vakt); }
};

test("koa: \"nu\" före \"idle\", forst först i sin kö, fel propageras, statistik", medLoop(async () => {
  nollstallKoStats();
  const ordning = [];
  const p = [
    koa(() => ordning.push("idle1")),
    koa(() => ordning.push("idle2")),
    koa(() => ordning.push("nu1"), "nu"),
    koa(() => ordning.push("idle0"), "idle", true),
    koa(() => { throw new Error("pang"); }, "nu"),
    koa(() => 42),
  ];
  await assert.rejects(p[4], /pang/);
  assert.equal(await p[5], 42);
  await Promise.allSettled(p);
  assert.deepEqual(ordning, ["nu1", "idle0", "idle1", "idle2"]);
  const st = koStats();
  assert.equal(st.jobb, 6);
  assert.equal(st.vantar, 0);
  assert.ok(st.rutor >= 1 && st.langstaJobbMs >= 0);
}));

test("koa: en lång uppgift får egen tidsruta (rutor ≤ ~RUTA_MS + en uppgift)", medLoop(async () => {
  nollstallKoStats();
  const spinn = (ms) => () => { const t = performance.now(); while (performance.now() - t < ms); };
  await Promise.all([koa(spinn(6)), koa(spinn(6)), koa(spinn(6)), koa(spinn(6))]);
  const st = koStats();
  assert.equal(st.jobb, 4);
  assert.ok(st.rutor >= 2, `rutor ${st.rutor}`); // aldrig alla fyra (24 ms) i samma ruta
  assert.ok(st.langstaRutaMs < 16, `ruta ${st.langstaRutaMs}`);
}));
