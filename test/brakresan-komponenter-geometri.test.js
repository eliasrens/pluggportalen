// ============================================================================
// Bråkresan (#707): komponenternas geometri – spec §4 "Gemensamma visuella
// regler" och §15 "Visuell och pedagogisk granskning": exakta sektorvinklar,
// tallinjens x(v), fyra delar = fem markeringar, snäppning, 100 celler i
// hundrarutan, bevarad längd/area vid omdelning, lika stora regioner,
// överlappningen i produktmodellen, varje föremål exakt en gång.
// ============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  cirkelSektorer, sektorVinkel, stavDelar, omdela, andel, rutnatCeller, regionKontur, regionerLikaStora,
  hundraCeller, hundraRad, xAv, tallinjeMarkeringar, tallinjeDelstrackor, snappa, snappSteg, mangdLayout, areaModell,
  markeradeIds, MAX_CIRKEL_DELAR,
} from "../src/brakresan/komponenter/geometri.js";
import { q, eq, add, mul, sum } from "../src/brakresan/math/index.js";

const nara = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

describe("Bråkcirkel – exakt 360°/n", () => {
  test("varje sektor är exakt 360/n grader och de fyller hela varvet, n = 1 … 12", () => {
    for (let n = 1; n <= MAX_CIRKEL_DELAR; n++) {
      const sek = cirkelSektorer(n, 0, 0, 100);
      assert.equal(sek.length, n);
      for (const s of sek) assert.ok(eq(sektorVinkel(s), q(360, n)), `n=${n}`);
      assert.ok(eq(sum(sek.map(sektorVinkel)), q(360)), `n=${n} summa 360°`);
      assert.ok(eq(sek[0].a0, q(0)), "första sektorn börjar klockan 12");
      sek.forEach((s, i) => assert.equal(s.id, `p${i}`));
    }
  });
  test("bågarnas ändpunkter ligger på cirkeln, medurs från klockan 12", () => {
    const sek = cirkelSektorer(4, 100, 100, 50);
    const punkter = sek.map((s) => s.path.match(/L ([\d.-]+) ([\d.-]+)/).slice(1).map(Number));
    assert.deepEqual(punkter.map(([x, y]) => [Math.round(x), Math.round(y)]), [[100, 50], [150, 100], [100, 150], [50, 100]]);
    for (const [x, y] of punkter) nara(Math.hypot(x - 100, y - 100), 50, 0.01);
  });
  test("sju delar: ingen sektor är skev (alla mittvinklar 360/7 isär)", () => {
    const sek = cirkelSektorer(7, 0, 0, 1);
    for (let i = 1; i < 7; i++) assert.ok(eq(add(sek[i - 1].a1, q(0)), sek[i].a0));
  });
  test("fler än 12 delar eller 0 delar avvisas", () => {
    assert.throws(() => cirkelSektorer(13, 0, 0, 1), RangeError);
    assert.throws(() => cirkelSektorer(0, 0, 0, 1), RangeError);
  });
});

describe("Bråkstav – exakt helhet/n och omdelning", () => {
  test("delarna är lika långa och fyller exakt helheten", () => {
    for (const n of [1, 2, 3, 5, 7, 12, 24]) {
      const d = stavDelar(n, 10, 600);
      d.forEach((x) => nara(x.w, 600 / n));
      nara(d.reduce((a, x) => a + x.w, 0), 600);
      nara(d[0].x, 10);
      nara(d.at(-1).x + d.at(-1).w, 610);
    }
  });
  test("omdelning 1/2 → 2/4 → 4/8 behåller den markerade längden", () => {
    let parts = 2;
    let mark = ["p0"];
    for (const k of [2, 2]) {
      const fore = andel(mark.length, parts);
      const r = omdela(parts, mark, k);
      assert.ok(eq(andel(r.markerade.length, r.parts), fore), `${mark.length}/${parts} → ${r.markerade.length}/${r.parts}`);
      parts = r.parts;
      mark = r.markerade;
    }
    assert.equal(parts, 8);
    assert.deepEqual(mark, ["p0", "p1", "p2", "p3"]);
  });
  test("omdelning: varje gammal del blir k nya på samma ställe, gamla gränser kvar", () => {
    const r = omdela(3, ["p1"], 4);
    assert.deepEqual(r.markerade, ["p4", "p5", "p6", "p7"]);
    assert.deepEqual(r.gamlaGranser, [0, 4, 8, 12]);
    // Markerad sträcka i pixlar är densamma före och efter (samma helhet och nollpunkt).
    const fore = stavDelar(3, 0, 600)[1];
    const efter = stavDelar(12, 0, 600).slice(4, 8);
    nara(efter[0].x, fore.x);
    nara(efter.reduce((a, x) => a + x.w, 0), fore.w);
  });
  test("markeradeIds: antal → de första delarna, lista → som den är", () => {
    assert.deepEqual(markeradeIds(3, 5), ["p0", "p1", "p2"]);
    assert.deepEqual(markeradeIds(9, 4), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(markeradeIds(["p4", "p1"], 5), ["p4", "p1"]);
    assert.deepEqual(markeradeIds(undefined, 5), []);
  });
});

describe("Rutnät – lika stor area", () => {
  test("alla celler har samma area och täcker ytan exakt", () => {
    const c = rutnatCeller(3, 4, 480, 300);
    assert.equal(c.length, 12);
    c.forEach((x) => nara(x.w * x.h, (480 * 300) / 12));
    nara(c.reduce((a, x) => a + x.w * x.h, 0), 480 * 300);
    assert.deepEqual(c.slice(0, 5).map((x) => [x.r, x.c]), [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]], "rad för rad");
  });
  test("regioner med olika form men lika area godkänns, ojämna eller överlappande inte", () => {
    const olikaForm = [{ cells: [0, 1, 2, 3] }, { cells: [4, 5, 8, 9] }, { cells: [6, 7, 10, 11] }, { cells: [12, 13, 14, 15] }];
    assert.ok(regionerLikaStora(olikaForm, 4, 4));
    assert.ok(!regionerLikaStora([{ cells: [0, 1, 2] }, { cells: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }], 4, 4));
    assert.ok(!regionerLikaStora([{ cells: [0, 1] }, { cells: [1, 2] }], 1, 4));
  });
  test("regionens kontur: en 2×2-ruta har åtta yttre kanter, inga inre", () => {
    const k = regionKontur([4, 5, 8, 9], 4, 4);
    assert.equal(k.length, 8);
    assert.ok(!k.some((e) => (e.x1 === 1 && e.x2 === 1) || (e.y1 === 2 && e.y2 === 2)), "inga inre kanter");
  });
});

describe("Hundraruta – exakt 100 celler", () => {
  test("100 unika celler p0 … p99, 10 × 10, rad för rad", () => {
    const c = hundraCeller(1);
    assert.equal(c.length, 100);
    assert.equal(new Set(c.map((x) => x.id)).size, 100);
    assert.equal(c[37].id, "p37");
    assert.deepEqual([c[37].r, c[37].c], [3, 7]);
  });
  test("två helheter = 200 celler, andra helheten p100 … p199", () => {
    const c = hundraCeller(2);
    assert.equal(c.length, 200);
    assert.equal(c[100].w, 1);
    assert.equal(c[100].id, "p100");
  });
  test("en rad = 10 celler = 1/10 = 0,1", () => {
    assert.deepEqual(hundraRad(0, 3), ["p30", "p31", "p32", "p33", "p34", "p35", "p36", "p37", "p38", "p39"]);
    assert.ok(eq(q(hundraRad(1, 0).length, 100), q(1, 10)));
  });
});

describe("Tallinje – linjär skala, delsträckor och markeringar", () => {
  test("x(v) = x0 + (v − min)/(max − min) · bredd: 1/4 ligger på 25 %", () => {
    nara(xAv(q(1, 4), 0, 1, 40, 560), 40 + 140);
    nara(xAv(0, 0, 1, 40, 560), 40);
    nara(xAv(1, 0, 1, 40, 560), 600);
    nara(xAv(q(9, 4), 0, 3, 0, 300), 225);
    nara(xAv(q(3, 2), q(1, 2), q(5, 2), 0, 200), 100);
  });
  test("fyra delar = fem markeringar; 0–3 i fjärdedelar = 12 delar och 13 streck", () => {
    assert.equal(tallinjeMarkeringar(0, 1, 4).length, 5);
    assert.equal(tallinjeDelstrackor(0, 1, 4), 4);
    assert.equal(tallinjeMarkeringar(0, 3, 4).length, 13);
    assert.equal(tallinjeDelstrackor(0, 3, 4), 12);
    const m = tallinjeMarkeringar(0, 2, 3);
    assert.deepEqual(m.filter((x) => x.hel).map((x) => x.value.n), [0, 1, 2]);
    assert.ok(eq(m[4].value, q(4, 3)));
  });
  test("markeringarna ligger på lika avstånd", () => {
    const xs = tallinjeMarkeringar(0, 1, 8).map((m) => xAv(m.value, 0, 1, 0, 560));
    for (let i = 1; i < xs.length; i++) nara(xs[i] - xs[i - 1], 70);
  });
  test("snäppning: klick nära ett streck ger exakt värde k/snap, aldrig utanför", () => {
    assert.ok(eq(snappa(40 + 0.62 * 560, 0, 1, 40, 560, 8), q(5, 8)));
    assert.ok(eq(snappa(40 + 0.6 * 560, 0, 1, 40, 560, 8), q(5, 8)));
    assert.ok(eq(snappa(-50, 0, 1, 40, 560, 8), q(0)));
    assert.ok(eq(snappa(9999, 0, 1, 40, 560, 8), q(1)));
    assert.ok(eq(snappa(0.76 * 300, 0, 3, 0, 300, 4), q(9, 4)));
  });
  test("piltangenter: ett snäppsteg i taget, stannar vid ändarna", () => {
    assert.ok(eq(snappSteg(q(5, 8), 1, 0, 1, 8), q(3, 4)));
    assert.ok(eq(snappSteg(q(1), 1, 0, 1, 8), q(1)));
    assert.ok(eq(snappSteg(q(0), -1, 0, 1, 8), q(0)));
    let v = q(0);
    for (let i = 0; i < 9; i++) v = snappSteg(v, 1, 0, 3, 4);
    assert.ok(eq(v, q(9, 4)));
  });
  test("ett intervall som inte går jämnt ut avvisas", () => {
    assert.throws(() => tallinjeMarkeringar(0, q(1, 2), 3), RangeError);
  });
});

describe("Mängdbild – varje föremål exakt en gång", () => {
  test("utan och med grupper: count föremål, unika id, lika stora grupper", () => {
    for (const [count, groups] of [[4, 0], [12, 4], [24, 6], [30, 0], [18, 3], [20, 5], [7, 0]]) {
      const l = mangdLayout(count, groups);
      assert.equal(l.items.length, count);
      assert.equal(new Set(l.items.map((x) => x.id)).size, count);
      assert.equal(new Set(l.items.map((x) => `${x.x},${x.y}`)).size, count, "inga föremål på samma plats");
      if (groups) {
        assert.equal(l.grupper.length, groups);
        for (let g = 0; g < groups; g++) assert.equal(l.items.filter((x) => x.g === g).length, count / groups);
      }
    }
  });
});

describe("Areamodell – överlappning mot ursprunglig helhet", () => {
  test("1/2 · 3/4 = 3/8 och 2/3 · 3/4 = 6/12", () => {
    const a = areaModell(q(1, 2), q(3, 4));
    assert.equal(a.celler.length, 8);
    assert.equal(a.overlapp, 3);
    assert.ok(eq(a.andel, mul(q(1, 2), q(3, 4))));
    const b = areaModell({ n: 2, d: 3 }, { n: 3, d: 4 });
    assert.equal(b.overlapp, 6);
    assert.ok(eq(b.andel, q(1, 2)));
  });
  test("för alla par med nämnare ≤ 10 är överlappningen produkten", () => {
    for (let d1 = 1; d1 <= 10; d1++) for (let n1 = 0; n1 <= d1; n1++) {
      for (let d2 = 1; d2 <= 10; d2++) for (let n2 = 0; n2 <= d2; n2++) {
        const a = areaModell({ n: n1, d: d1 }, { n: n2, d: d2 });
        assert.equal(a.celler.length, d1 * d2);
        assert.ok(eq(q(a.overlapp, d1 * d2), mul(q(n1, d1), q(n2, d2))));
      }
    }
  });
});

describe("Komponentbiblioteket – lat laddning", () => {
  test("ingen komponentfil importeras statiskt från appen (bootgrafen)", () => {
    const appen = readdirSync(new URL("../src/", import.meta.url)).filter((f) => f.endsWith(".js"));
    for (const f of appen) {
      const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
      assert.ok(!/^\s*import[^;]*["'][^"']*brakresan\/komponenter/m.test(src), `${f} importerar komponenterna statiskt`);
    }
  });
});
