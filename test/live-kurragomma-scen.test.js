// Enhetstester: Kurragömma B – 3D-scenen (#837, spec §3, §4, §13.4).
//   • rörelsen (kg-rorelse.js): yaw-kontraktet, kollisionen ur motorn, "gå dit", interpoleringen ~150 ms
//   • kameran (kg-kamera.js): 8,5 m bakom / 4,5 m upp, aldrig inne i ett träd eller en vägg, glidningen, reduced motion
//   • nivåerna (kg-niva.js): Låg/Mellan/Hög, automatisk sänkning < 24 fps i 3 s, localStorage i try/catch
//   • 2D-reserven startar när WebGL saknas (§13.4) – valet, nivåvakten och hela kg-scen.js mot en mini-DOM
//   • modellerna täcker alla typer i kartan, färgerna är palettens
//   • filerna: three.js bara via import(), ≤ 400 rader, inga emojier från Emoji 13+
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { KAMERA, MAX_FART, POS_INTERPOLERING_MS } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { stegaJag, skapaInterpolering, vridMot, normVinkel, vinkelMot } from "../src/live/formats/kurragomma/scen/kg-rorelse.js";
import { kameraHinder, placeraKamera, projektorKamera, skapaGlid, KAMERA_MIN_M } from "../src/live/formats/kurragomma/scen/kg-kamera.js";
import {
  NIVAER, valjRitare, skapaNivavakt, lasSparadNiva, sparaNiva, pixelfaktor, SANK_FPS, RESERV_FPS,
} from "../src/live/formats/kurragomma/scen/kg-niva.js";
import { delarFor, onDelar, TYPER, F } from "../src/live/formats/kurragomma/scen/kg-modeller.js";

const SCEN = "src/live/formats/kurragomma/scen";
const lada = ON.foremal.find((f) => f.id === "lada");
const trad = ON.foremal.find((f) => f.id === "trad-1");

describe("rörelsen (kg-rorelse.js)", () => {
  it("framåt är (sin yaw, cos yaw) med MAX_FART, och ökande yaw svänger vänster", () => {
    const a = stegaJag({ x: 0, z: 0, yaw: 0 }, { fram: 1, svang: 0 }, 0.5, ON);
    assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.z - MAX_FART * 0.5) < 1e-9);
    assert.equal(a.gar, true);
    const b = stegaJag({ x: 0, z: 0, yaw: Math.PI / 2 }, { fram: 1, svang: 0 }, 0.5, ON);
    assert.ok(Math.abs(b.x - 3) < 1e-9 && Math.abs(b.z) < 1e-9);
    const c = stegaJag({ x: 0, z: 0, yaw: 0 }, { fram: 0, svang: 1 }, 0.1, ON);
    assert.ok(c.yaw > 0 && !c.gar);
  });

  it("kolliderar med fasta föremål och stannar inom ön (motorns kollidera)", () => {
    // Rakt in i ladan från väster.
    let j = { x: lada.x - 6, z: lada.z, yaw: Math.PI / 2 };
    for (let i = 0; i < 40; i++) j = stegaJag(j, { fram: 1, svang: 0 }, 0.05, ON);
    assert.ok(Math.hypot(j.x - lada.x, j.z - lada.z) >= lada.fast - 1e-9, "utanför ladans fast-radie");
    let k = { x: 28, z: 0, yaw: Math.PI / 2 };
    for (let i = 0; i < 40; i++) k = stegaJag(k, { fram: 1, svang: 0 }, 0.05, ON);
    assert.ok(Math.hypot(k.x, k.z) <= ON.radie + 1e-9, "inom ön");
  });

  it("gömd (fast) kan bara vrida sig", () => {
    const j = stegaJag({ x: 5, z: 5, yaw: 0 }, { fram: 1, svang: 1, mal: { x: 0, z: 0 } }, 0.1, ON, { fast: true });
    assert.equal(j.x, 5); assert.equal(j.z, 5); assert.ok(j.yaw > 0); assert.equal(j.gar, false);
  });

  it("tryck på marken: går dit, är framme, och tangenterna tar över målet", () => {
    let j = { x: 0, z: 0, yaw: 0, mal: { x: 6, z: 0 } };
    for (let i = 0; i < 60 && j.mal; i++) j = stegaJag(j, { fram: 0, svang: 0, mal: j.mal }, 1 / 30, ON);
    assert.equal(j.mal, null, "framme → målet släpps");
    assert.ok(Math.hypot(j.x - 6, j.z) < 0.5);
    const k = stegaJag({ x: 0, z: 0, yaw: 0 }, { fram: 1, svang: 0, mal: { x: 6, z: 0 } }, 0.1, ON);
    assert.equal(k.mal, null, "manuell styrning avbryter 'gå dit'");
  });

  it("'gå dit' mot en vägg avbryts när figuren fastnat", () => {
    let j = { x: lada.x - 6, z: lada.z, yaw: 0, mal: { x: lada.x, z: lada.z } };
    for (let i = 0; i < 120 && j.mal; i++) j = stegaJag(j, { fram: 0, svang: 0, mal: j.mal }, 1 / 30, ON);
    assert.equal(j.mal, null);
  });

  it("vinklar: normVinkel, vinkelMot och vridMot kortaste vägen", () => {
    assert.ok(Math.abs(normVinkel(3 * Math.PI) - Math.PI) < 1e-9);
    assert.ok(Math.abs(vinkelMot({ x: 0, z: 0 }, { x: 1, z: 0 }) - Math.PI / 2) < 1e-9);
    const y = vridMot(-3, 3, 0.01, 1); // −3 → 3 är kortast via −π
    assert.ok(y < -3, "vrider åt det håll som är närmast");
  });

  it("interpoleringen ritar POS_INTERPOLERING_MS bakåt och glider mellan proverna", () => {
    const ip = skapaInterpolering(POS_INTERPOLERING_MS);
    ip.satt("a", { x: 0, z: 0, yaw: 0, t: 1000 });
    ip.satt("a", { x: 2, z: 0, yaw: 0, t: 1200 });
    const p = ip.lage("a", 1100 + POS_INTERPOLERING_MS); // ritar vid 1100 → halvvägs
    assert.ok(Math.abs(p.x - 1) < 1e-9 && p.gar);
    const q = ip.lage("a", 2000); // efter sista provet → står still på det
    assert.equal(q.x, 2); assert.equal(q.gar, false);
    ip.satt("a", { x: 5, z: 0, yaw: 0, t: 900 }); // gammalt prov ignoreras
    assert.equal(ip.lage("a", 2000).x, 2);
    assert.equal(ip.lage("b", 2000), null);
    ip.bort("a");
    assert.deepEqual(ip.alla(), []);
  });
});

describe("kameran (kg-kamera.js)", () => {
  const hinder = kameraHinder(ON);

  it("tredjeperson: 8,5 m bakom, 4,5 m upp, tittar på överkroppen (kg-config KAMERA)", () => {
    const k = placeraKamera({ jag: { x: 0, z: 0, yaw: 0 }, hinder });
    assert.ok(Math.abs(k.z + KAMERA.bakom) < 0.3 && Math.abs(k.x) < 1e-9);
    assert.ok(Math.abs(k.y - KAMERA.upp) < 0.2);
    assert.deepEqual(k.mal, { x: 0, y: KAMERA.tittaPaY, z: 0 });
  });

  it("hamnar aldrig inne i ladan eller ett träd (dras in / lyfts)", () => {
    const fall = [];
    for (const f of [lada, trad]) {
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 8) {
        for (const avst of [f.fast + 0.6, f.fast + 2, f.fast + 5]) {
          const x = f.x + Math.cos(a) * avst, z = f.z + Math.sin(a) * avst;
          for (const yaw of [0, 1, 2, 3, 4, 5, 6]) fall.push({ f, jag: { x, z, yaw } });
        }
      }
    }
    for (const { f, jag } of fall) {
      const k = placeraKamera({ jag, hinder });
      const h = hinder.find((x) => x.id === f.id);
      // Ladan är en låda (hx, hz), träden cirklar (r) – se också live-kurragomma-kamera.test.js mot modellerna.
      const ute = h.hx != null ? Math.abs(k.x - f.x) > h.hx || Math.abs(k.z - f.z) > h.hz : Math.hypot(k.x - f.x, k.z - f.z) > h.r;
      assert.ok(ute || k.y >= h.h, `kameran inne i ${f.id} vid ${JSON.stringify(jag)} → ${JSON.stringify(k)}`);
      assert.ok(k.avstand >= KAMERA_MIN_M - 1e-9 && k.avstand <= KAMERA.bakom + 1e-9);
    }
  });

  it("inne i ett lov-föremål (buskaget) dras kameran inte in – föremålet görs halvgenomskinligt i stället", () => {
    const buske = ON.foremal.find((f) => f.id === "buske-2");
    const jag = { x: buske.x, z: buske.z, yaw: Math.PI };
    assert.ok(placeraKamera({ jag, hinder, inneI: "buske-2" }).avstand > KAMERA.bakom - 0.5);
    // Utifrån hindrar buskaget: figuren vänd mot det, kameran skulle hamna inne i det.
    const utanfor = { x: buske.x, z: buske.z - buske.r - 1, yaw: 0 };
    assert.ok(placeraKamera({ jag: utanfor, hinder }).avstand < KAMERA.bakom - 2);
  });

  it("projektorn: snett ovanifrån, roterar långsamt, stilla med reduced motion", () => {
    const a = projektorKamera({ t: 0 }), b = projektorKamera({ t: 10_000 });
    assert.ok(a.y > 20 && Math.hypot(a.x, a.z) > 40);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1, "roterar");
    assert.deepEqual(projektorKamera({ t: 0, stilla: true }), projektorKamera({ t: 99_000, stilla: true }));
  });

  it("glidningen: in, håll, tillbaka på ~3 s, och flera händelser tätt efter varandra ger EN glidning", () => {
    const g = skapaGlid();
    assert.equal(g.starta({ x: 10, z: 0 }, 1000), true);
    assert.equal(g.starta({ x: -10, z: 0 }, 1500), false);
    assert.ok(g.lage(1500).k > 0.5 && g.lage(1500).x === 10);
    assert.equal(g.lage(2500).k, 1);
    assert.ok(g.lage(3900).k < 0.3);
    assert.equal(g.lage(4100), null);
    assert.equal(g.starta({ x: 0, z: 5 }, 4100), true);
    const k = projektorKamera({ t: 0, glid: { x: 10, z: 0, k: 1 } });
    assert.ok(k.mal.x === 10 && Math.hypot(k.x - 10, k.z) < 58, "zoomar mot platsen");
    assert.equal(projektorKamera({ t: 0, glid: { x: 10, z: 0, k: 1 }, stilla: true }).mal.x, 0, "ingen glidning med reduced motion");
  });
});

describe("prestandanivåerna och 2D-reserven (kg-niva.js, spec §4.4, §13.4)", () => {
  it("Låg/Mellan/Hög: ×0,6 utan kontur och dekor, ×1, upp till skärmen men högst ×2", () => {
    assert.deepEqual(NIVAER.map((n) => n.namn), ["Låg", "Mellan", "Hög"]);
    assert.equal(pixelfaktor(0, 3), 0.6); assert.equal(pixelfaktor(1, 3), 1); assert.equal(pixelfaktor(2, 3), 2); assert.equal(pixelfaktor(2, 1.5), 1.5);
    assert.equal(NIVAER[0].kontur, false); assert.equal(NIVAER[0].dekor, false); assert.equal(NIVAER[1].kontur, true);
  });

  it("2D-reserven väljs utan WebGL eller när den tvingas (?2d=1)", () => {
    assert.equal(valjRitare({ harWebGL: false }), "2d");
    assert.equal(valjRitare({ harWebGL: true, tvinga2d: true }), "2d");
    assert.equal(valjRitare({ harWebGL: true }), "3d");
  });

  it("automatisk sänkning: under 24 fps i 3 s → ett steg ned; Låg under 15 fps i 3 s → 2D", () => {
    const kor = (vakt, fps, sek, start) => {
      let h = null;
      for (let s = 0; s < sek; s++) for (let i = 0; i < fps; i++) h = vakt.bildruta(start + s * 1000 + (i * 1000) / fps + 1) || h;
      return h;
    };
    const v = skapaNivavakt({ niva: 1, nu: 0 });
    assert.equal(kor(v, 40, 5, 1000), null, "40 fps sänker inte");
    assert.equal(kor(v, SANK_FPS - 4, 2, 7000), null, "2 s räcker inte");
    const h = kor(v, SANK_FPS - 4, 3, 10_000);
    assert.deepEqual({ typ: h.typ, niva: h.niva }, { typ: "sankt", niva: 0 });
    assert.equal(v.niva(), 0);
    assert.equal(kor(v, SANK_FPS - 4, 5, 20_000), null, "20 fps på Låg är över reservgränsen");
    const r = kor(v, RESERV_FPS - 3, 5, 30_000);
    assert.equal(r.typ, "2d");
    assert.equal(skapaNivavakt({ niva: 1, nu: 0, auto: false }).bildruta(5000), null);
  });

  it("valet sparas i localStorage i try/catch – ett trasigt lager stoppar inget", () => {
    const lager = new Map();
    const storage = { getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => lager.set(k, v) };
    assert.equal(lasSparadNiva(storage), null);
    sparaNiva(storage, 2);
    assert.equal(lasSparadNiva(storage), 2);
    const trasigt = { getItem() { throw new Error("privat läge"); }, setItem() { throw new Error("fullt"); } };
    assert.equal(lasSparadNiva(trasigt), null);
    assert.doesNotThrow(() => sparaNiva(trasigt, 1));
    assert.equal(lasSparadNiva(null), null);
    assert.equal(lasSparadNiva({ getItem: () => "9" }), 1, "ogiltigt värde → standard");
  });
});

describe("modellerna (kg-modeller.js, spec §4.2)", () => {
  it("varje typ i kartan har en modell och ön har mark", () => {
    const typer = new Set(ON.foremal.map((f) => f.typ));
    for (const t of typer) assert.ok(TYPER.includes(t), `modell saknas för ${t}`);
    for (const f of ON.foremal) assert.ok(delarFor(f).length > 0, f.id);
    assert.ok(onDelar(ON).length > 3);
  });

  it("alla färger kommer ur paletten (art-style/art-gard) och konturen är #3B3350", () => {
    assert.equal(F.kontur, "#3B3350");
    const palett = new Set(Object.values(F));
    for (const f of ON.foremal) for (const d of delarFor(f)) assert.ok(palett.has(d.f), `${f.id}: ${d.f}`);
    for (const d of onDelar(ON)) assert.ok(palett.has(d.f));
  });
});

describe("filerna (bootgraf, storlek, emojier)", () => {
  const filer = readdirSync(SCEN).filter((n) => /\.(js|css)$/.test(n));

  it("three.js nås bara med import() – ingen statisk import av src/vendor/", () => {
    let dynamiska = 0;
    for (const n of filer) {
      const src = readFileSync(join(SCEN, n), "utf8");
      assert.ok(!/\bimport\s+[^(]*?from\s+["'][^"']*vendor\//.test(src), `${n}: statisk import av vendor/`);
      assert.ok(!/\bexport\s+[^(]*?from\s+["'][^"']*vendor\//.test(src), `${n}: statisk export från vendor/`);
      if (/import\(\s*["'][^"']*vendor\/three\//.test(src)) dynamiska++;
    }
    assert.equal(dynamiska, 1, "exakt en plats (kg-tre.js) laddar three lat");
  });

  it("ingen fil över 400 rader och inga emojier från Emoji 13+", () => {
    const ny = (cp) => cp >= 0x1fa70 && cp <= 0x1faff;
    for (const n of [...filer, "../../../../../preview/preview-kurragomma-scen.html", "../../../../../preview/preview-kurragomma-prestanda.html", "../../../../../preview/kurragomma-robotar.js"]) {
      const src = readFileSync(join(SCEN, n), "utf8");
      if (!n.startsWith("..")) assert.ok(src.split("\n").length <= 401, `${n} ≤ 400 rader`);
      assert.ok(![...src].some((c) => ny(c.codePointAt(0))), `${n}: Emoji 13+`);
    }
    assert.ok(readFileSync("src/vendor/three/LICENSE", "utf8").includes("MIT"));
  });
});
