// ============================================================================
// Enhetstest för Hitta rätt!-kartmotorns rena delar (#606). Ingen DOM.
// Körs med: node --test test/hitta-ratt-karta.test.js
// Täcker projektion lat/lon ↔ x/y tur och retur (alla tre scope), avstånd
// (haversine), kamerans gränser/zoom/inpassning, vägrutor och klick ≠ drag.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SCOPES, SIDA, byggProjektion, tillKarta, tillLatLon, rutaTillKarta, avstandKm,
} from "../src/hitta-ratt/karta/projektion.js";
import {
  tillTransform, skarmTillKarta, kartaTillSkarm, begransa, zoomaVid, panorera,
  passaIn, interpolera, lattnad, vagRuta,
} from "../src/hitta-ratt/karta/kamera.js";
import { arKlick, KLICK_TROSKEL, hjulFaktor, hjulMjukt } from "../src/hitta-ratt/karta/gester.js";

const nara = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (tol ${tol})`);

// --- Projektion -----------------------------------------------------------------

test("projektion: tur och retur lat/lon → karta → lat/lon för alla scope (< 1e-9°)", () => {
  for (const scope of Object.keys(SCOPES)) {
    const p = byggProjektion(scope);
    const [v, s, o, n] = SCOPES[scope].ruta;
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const lon = v + ((o - v) * i) / 10;
        const lat = s + ((n - s) * j) / 10;
        const [X, Y] = tillKarta(p, lon, lat);
        const [lon2, lat2] = tillLatLon(p, X, Y);
        nara(lon2, lon, 1e-9, `${scope} lon`);
        nara(lat2, lat, 1e-9, `${scope} lat`);
      }
    }
  }
});

test("projektion: tur och retur karta → lat/lon → karta (< 1e-6 enheter)", () => {
  for (const scope of Object.keys(SCOPES)) {
    const p = byggProjektion(scope);
    for (const [X, Y] of [[p.bredd * 0.3, p.hojd * 0.4], [p.bredd / 2, p.hojd / 2], [p.bredd * 0.8, p.hojd * 0.7]]) {
      const [lon, lat] = tillLatLon(p, X, Y);
      const [X2, Y2] = tillKarta(p, lon, lat);
      nara(X2, X, 1e-6, `${scope} X`);
      nara(Y2, Y, 1e-6, `${scope} Y`);
    }
  }
});

test("projektion: scope-rutans längsta sida = SIDA, Y nedåt, norr överst", () => {
  for (const scope of Object.keys(SCOPES)) {
    const p = byggProjektion(scope);
    assert.equal(Math.max(p.bredd, p.hojd), SIDA, scope);
  }
  const p = byggProjektion("sverige");
  const [, yKiruna] = tillKarta(p, 20.22, 67.86);
  const [, yMalmo] = tillKarta(p, 13.0, 55.6);
  assert.ok(yKiruna < yMalmo, "Kiruna ska ligga ovanför Malmö (mindre Y)");
  const [xGbg] = tillKarta(p, 11.97, 57.71);
  const [xSthlm] = tillKarta(p, 18.07, 59.33);
  assert.ok(xGbg < xSthlm, "Göteborg väster om Stockholm");
  // Hela Sverige ryms i kartan.
  for (const [lon, lat] of [[11.1, 58.9], [24.15, 65.8], [13.0, 55.34], [20.5, 69.06]]) {
    const [X, Y] = tillKarta(p, lon, lat);
    assert.ok(X >= 0 && X <= p.bredd && Y >= 0 && Y <= p.hojd, `${lon},${lat}`);
  }
});

test("projektion: geofilernas sparade parametrar ger samma resultat som byggProjektion", async () => {
  const { readFile } = await import("node:fs/promises");
  const geo = JSON.parse(await readFile(new URL("../preview/hitta-ratt-spik/geo-sverige.json", import.meta.url), "utf8"));
  const p = byggProjektion("sverige");
  const [a, b] = tillKarta(geo.proj, 17.1413, 60.6749);
  const [c, d] = tillKarta(p, 17.1413, 60.6749);
  nara(a, c, 0.01); nara(b, d, 0.01);
});

test("rutaTillKarta: omsluter alla kantpunkter, även böjda kanter (LAEA)", () => {
  const p = byggProjektion("europa");
  const ruta = [-10, 35, 30, 60];
  const [x0, y0, x1, y1] = rutaTillKarta(p, ruta);
  for (let i = 0; i <= 40; i++) {
    const lon = -10 + i;
    for (const lat of [35, 60]) {
      const [X, Y] = tillKarta(p, lon, lat);
      assert.ok(X >= x0 - 1e-6 && X <= x1 + 1e-6 && Y >= y0 - 1e-6 && Y <= y1 + 1e-6);
    }
  }
  assert.ok(x1 > x0 && y1 > y0);
});

// --- Avstånd ------------------------------------------------------------------------

test("avstandKm (haversine): kända avstånd", () => {
  const sthlm = [18.0686, 59.3293], gbg = [11.9746, 57.7089];
  nara(avstandKm(sthlm, gbg), 398, 3, "Stockholm–Göteborg");
  const paris = [2.3522, 48.8566], london = [-0.1276, 51.5072];
  nara(avstandKm(paris, london), 344, 3, "Paris–London");
  // En grad längs meridianen ≈ 111,2 km.
  nara(avstandKm([15, 60], [15, 61]), 111.19, 0.05, "1° lat");
  // Ekvatorn: halva jordens omkrets till antipoden.
  nara(avstandKm([0, 0], [180, 0]), Math.PI * 6371.0088, 0.01, "antipod");
});

test("avstandKm: symmetri, noll mot sig själv och datumgränsen", () => {
  const a = [17.1413, 60.6749], b = [20.263, 63.8258];
  assert.equal(avstandKm(a, a), 0);
  nara(avstandKm(a, b), avstandKm(b, a), 1e-9);
  // 179° och −179° på ekvatorn ligger 2° isär, inte 358°.
  nara(avstandKm([179, 0], [-179, 0]), 222.4, 0.2, "datumgräns");
});

test("avstånd räknas på lat/lon, inte i kartplanet (projektionen påverkar inte km)", () => {
  const gavle = [17.1413, 60.6749];
  for (const scope of ["sverige", "europa", "varlden"]) {
    const p = byggProjektion(scope);
    const [X, Y] = tillKarta(p, ...gavle);
    const tillbaka = tillLatLon(p, X, Y);
    nara(avstandKm(tillbaka, [18.0686, 59.3293]), avstandKm(gavle, [18.0686, 59.3293]), 1e-6, scope);
  }
});

// --- Kameran och gränser ------------------------------------------------------------

const GR = { kMin: 0.05, kMax: 1, ruta: [0, 0, 6000, 10000] };

test("kamera: skärm ↔ karta tur och retur", () => {
  const kam = { k: 0.37, cx: 2500, cy: 4200 };
  const [x, y] = skarmTillKarta(kam, 800, 600, 123, 456);
  const [sx, sy] = kartaTillSkarm(kam, 800, 600, [x, y]);
  nara(sx, 123, 1e-9); nara(sy, 456, 1e-9);
  // Vyns mitt visar (cx, cy).
  const t = tillTransform(kam, 800, 600);
  nara(2500 * t.k + t.tx, 400, 1e-9);
  nara(4200 * t.k + t.ty, 300, 1e-9);
});

test("bounds: zoomen kläms till kMin/kMax", () => {
  assert.equal(begransa({ k: 99, cx: 10, cy: 10 }, GR).k, 1);
  assert.equal(begransa({ k: 0.0001, cx: 10, cy: 10 }, GR).k, 0.05);
  assert.equal(begransa({ k: 0.3, cx: 10, cy: 10 }, GR).k, 0.3);
});

test("bounds: vyns mittpunkt stannar inom panoreringsrutan", () => {
  assert.deepEqual(begransa({ k: 0.3, cx: -500, cy: 20000 }, GR), { k: 0.3, cx: 0, cy: 10000 });
  assert.deepEqual(begransa({ k: 0.3, cx: 3000, cy: 4000 }, GR), { k: 0.3, cx: 3000, cy: 4000 });
  // Panorera långt bort → kläms vid kanten, kartan tappas aldrig bort.
  let kam = { k: 0.2, cx: 3000, cy: 5000 };
  for (let i = 0; i < 50; i++) kam = begransa(panorera(kam, 500, 0), GR);
  assert.equal(kam.cx, 0);
});

test("zoomaVid: kartpunkten under pekaren står still, även vid gränsen", () => {
  const W = 900, H = 600;
  const kam = { k: 0.2, cx: 3000, cy: 5000 };
  const fore = skarmTillKarta(kam, W, H, 700, 150);
  const ny = zoomaVid(kam, W, H, 700, 150, 2.5, GR);
  nara(ny.k, 0.5, 1e-12);
  const efter = skarmTillKarta(ny, W, H, 700, 150);
  nara(efter[0], fore[0], 1e-9); nara(efter[1], fore[1], 1e-9);
  // Vid maxzoom kläms faktorn men punkten står fortfarande still.
  const max = zoomaVid(ny, W, H, 700, 150, 100, GR);
  assert.equal(max.k, 1);
  const vidMax = skarmTillKarta(max, W, H, 700, 150);
  nara(vidMax[0], fore[0], 1e-9); nara(vidMax[1], fore[1], 1e-9);
});

test("panorera: kartan följer fingret", () => {
  const kam = { k: 0.5, cx: 1000, cy: 1000 };
  const ny = panorera(kam, 50, -20);
  const W = 400, H = 300;
  const p = [1100, 950];
  const [ax, ay] = kartaTillSkarm(kam, W, H, p);
  const [bx, by] = kartaTillSkarm(ny, W, H, p);
  nara(bx - ax, 50, 1e-9); nara(by - ay, -20, 1e-9);
});

test("passaIn: rutan ryms helt inom vyn minus luften, och fyller en led", () => {
  const ruta = [0, 0, 6125, 10000];
  const W = 1000, H = 700, luft = { v: 12, t: 12, h: 62, b: 22 };
  const kam = passaIn(ruta, W, H, luft);
  const [x0, y0] = kartaTillSkarm(kam, W, H, [ruta[0], ruta[1]]);
  const [x1, y1] = kartaTillSkarm(kam, W, H, [ruta[2], ruta[3]]);
  assert.ok(x0 >= luft.v - 1e-6 && y0 >= luft.t - 1e-6);
  assert.ok(x1 <= W - luft.h + 1e-6 && y1 <= H - luft.b + 1e-6);
  // Höjden är den begränsande leden (Sverige är högt).
  nara(y1 - y0, H - luft.t - luft.b, 1e-6);
});

test("interpolera: geometrisk zoom, ändpunkterna exakta", () => {
  const a = { k: 1, cx: 0, cy: 0 }, b = { k: 4, cx: 100, cy: 50 };
  assert.deepEqual(interpolera(a, b, 0), a);
  assert.deepEqual(interpolera(a, b, 1), b);
  nara(interpolera(a, b, 0.5).k, 2, 1e-12); // geometriskt mitt, inte 2,5
  assert.equal(lattnad(0), 0);
  assert.equal(lattnad(1), 1);
  nara(lattnad(0.5), 0.5, 1e-12);
});

test("vagRuta: omslutande ruta för förprojicerade relativa vägar", () => {
  assert.deepEqual(vagRuta("M10 20l5 0 0 5-5 0z"), [10, 20, 15, 25]);
  // Flera delvägar; z återgår till delvägens start, m är relativ.
  assert.deepEqual(vagRuta("M0 0l10 0 0 10zm-5-5l-1-1"), [-6, -6, 10, 10]);
  assert.deepEqual(vagRuta("M1 1H9V4h-10v-8"), [-1, -4, 9, 4]);
  assert.deepEqual(vagRuta("M-3188 12123l-61 12-25-8"), [-3274, 12123, -3188, 12135]);
  assert.deepEqual(vagRuta(""), [0, 0, 0, 0]);
});

// --- Klick ≠ drag ------------------------------------------------------------------

test("arKlick: stilla tryck är klick, rörelse över tröskeln är drag", () => {
  assert.equal(arKlick({ rorelse: 0, flera: false, ptyp: "mouse" }), true);
  assert.equal(arKlick({ rorelse: KLICK_TROSKEL.mouse, flera: false, ptyp: "mouse" }), true);
  assert.equal(arKlick({ rorelse: KLICK_TROSKEL.mouse + 0.1, flera: false, ptyp: "mouse" }), false);
  // Touch är förlåtande (darrigt finger), men ett riktigt drag är aldrig klick.
  assert.equal(arKlick({ rorelse: 9, flera: false, ptyp: "touch" }), true);
  assert.equal(arKlick({ rorelse: 11, flera: false, ptyp: "touch" }), false);
  assert.equal(arKlick({ rorelse: 6, flera: false, ptyp: "pen" }), true);
  assert.equal(arKlick({ rorelse: 7, flera: false, ptyp: "pen" }), false);
});

test("arKlick: två fingrar någon gång under gesten = aldrig klick", () => {
  assert.equal(arKlick({ rorelse: 0, flera: true, ptyp: "touch" }), false);
});

test("arKlick: rörelsen är STÖRSTA avståndet – ett drag som slutar stilla är inget klick", () => {
  // gester.js sparar max(avstånd från start) – drag 200 px och tillbaka.
  let rorelse = 0;
  for (const d of [3, 40, 200, 120, 2, 0]) rorelse = Math.max(rorelse, d);
  assert.equal(arKlick({ rorelse, flera: false, ptyp: "mouse" }), false);
});

test("hjul: mushjulets hack animeras, pekplattans strömmar och nyp gör det inte", () => {
  assert.ok(hjulFaktor({ deltaY: -100 }) > 1, "hjul upp = zooma in");
  assert.ok(hjulFaktor({ deltaY: 100 }) < 1, "hjul ner = zooma ut");
  nara(hjulFaktor({ deltaY: 100 }) * hjulFaktor({ deltaY: -100 }), 1, 1e-12);
  // Rad-läge (Firefox) ger ungefär samma steg som pixel-läge.
  nara(hjulFaktor({ deltaY: 3, deltaMode: 1 }), hjulFaktor({ deltaY: 94, deltaMode: 0 }), 0.01);
  assert.equal(hjulMjukt({ deltaY: 100 }), true);
  assert.equal(hjulMjukt({ deltaY: 3, deltaMode: 1 }), true);
  assert.equal(hjulMjukt({ deltaY: 4 }), false);
  assert.equal(hjulMjukt({ deltaY: 100, ctrlKey: true }), false);
  assert.ok(hjulFaktor({ deltaY: -10, ctrlKey: true }) > hjulFaktor({ deltaY: -10 }), "nyp på pekplatta är känsligare");
});

// --- Redigering (lärarvyn, #636) ------------------------------------------------
// redigering.js får motorns delar injicerade – här stubbar utan DOM.

import { skapaRedigering, ZOOM } from "../src/hitta-ratt/karta/redigering.js";

function redigeringsStub(scope = "sverige", ids = ["o1", "o2", "o3"]) {
  const p = byggProjektion(scope);
  const logg = { ritat: 0, rensat: 0, etikett: null, animera: null, ordning: [] };
  const klasser = () => {
    const s = new Set();
    return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) };
  };
  const forälder = { appendChild: (path) => logg.ordning.push(path.id) };
  const omraden = new Map(ids.map((id, i) => [id, { path: { id, classList: klasser(), parentNode: forälder }, c: [i * 10, i * 10] }]));
  const skarm = {
    giss: null,
    satGiss(pos) { this.giss = pos; },
    satEtikett(text, pos, vid) { logg.etikett = text ? { text, pos, vid } : null; },
  };
  const kam = { kam: { k: 2, cx: 0, cy: 0 }, kHem: 1, animera: (mal) => { logg.animera = mal; } };
  const red = skapaRedigering({ p, omraden, skarm, kam, rita: () => logg.ritat++, rensaVal: () => logg.rensat++ });
  const markerade = () => ids.filter((id) => omraden.get(id).path.classList.contains("markerad"));
  return { p, red, skarm, logg, markerade };
}

test("satGissning: lon/lat → nål → getGuess tur och retur (< 1e-9°), alla scope", () => {
  const platser = { sverige: [17.1413, 60.6749], europa: [2.2945, 48.8584], varlden: [-58.38, -34.6] };
  for (const [scope, [lon, lat]] of Object.entries(platser)) {
    const { p, red, skarm } = redigeringsStub(scope);
    red.satGissning({ lon, lat });
    // Samma omräkning som kartmotorns getGuess().
    const [lon2, lat2] = tillLatLon(p, ...skarm.giss);
    nara(lon2, lon, 1e-9, `${scope} lon`);
    nara(lat2, lat, 1e-9, `${scope} lat`);
  }
});

test("satGissning: zooma glider till platsen (minst ZOOM × helvyn), utan zooma står kameran still", () => {
  const { p, red, logg } = redigeringsStub();
  red.satGissning({ lon: 17.1413, lat: 60.6749 });
  assert.equal(logg.animera, null);
  red.satGissning({ lon: 17.1413, lat: 60.6749 }, { zooma: true });
  const [x, y] = tillKarta(p, 17.1413, 60.6749);
  assert.equal(logg.animera.k, ZOOM);
  nara(logg.animera.cx, x, 1e-9);
  nara(logg.animera.cy, y, 1e-9);
});

test("satGissning: null eller ogiltig plats tar bort nålen", () => {
  const { red, skarm } = redigeringsStub();
  red.satGissning({ lon: 17, lat: 60 });
  assert.ok(skarm.giss);
  red.satGissning(null);
  assert.equal(skarm.giss, null);
  red.satGissning({ lon: 17, lat: 60 });
  red.satGissning({ lon: NaN, lat: 60 });
  assert.equal(skarm.giss, null);
});

test("markera: lägger till och tar bort klassen, okända id ignoreras, valt område töms", () => {
  const { red, markerade, logg } = redigeringsStub();
  red.markera(["o1", "o3", "okänd"]);
  assert.deepEqual(markerade(), ["o1", "o3"]);
  assert.deepEqual(red.markerade, ["o1", "o3"]);
  assert.deepEqual(logg.ordning, ["o1", "o3"], "markerade ritas överst");
  red.markera(["o3", "o2"]);
  assert.deepEqual(markerade(), ["o2", "o3"]);
  red.markera([]);
  assert.deepEqual(markerade(), []);
  assert.equal(logg.rensat, 3, "motorns klickval (vald) töms varje gång");
  assert.ok(logg.ritat >= 3);
});

test("markera: etiketten bara vid det senast klickade området", () => {
  const { red, logg } = redigeringsStub();
  red.markera(["o2"], { etikett: { id: "o2", text: "Norge" } });
  assert.deepEqual(logg.etikett, { text: "Norge", pos: [10, 10], vid: "mitt" });
  red.markera([]);
  assert.equal(logg.etikett, null);
});
