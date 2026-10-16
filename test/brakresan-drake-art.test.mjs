// Bråkdraken (#718): nivåberäkning enligt spec §9 + att alla 16 former ritas
// som giltig, självständig SVG med riggrupperna som animationen behöver.
//   node --test test/brakresan-drake-art.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { drakeNiva, drakeProgress, drakeSvg, drakeMatt, skalaFor, STADIER, husMatt, husPassning, arHusVikt, HUS_MIN_H } from "../src/brakresan/art-drake.js";

test("drakeNiva: 0–9 ägg, sedan floor(S/10) upp till 15", () => {
  assert.equal(drakeNiva(0), 0);
  assert.equal(drakeNiva(9), 0);
  assert.equal(drakeNiva(10), 1);
  assert.equal(drakeNiva(19), 1);
  assert.equal(drakeNiva(55), 5);
  assert.equal(drakeNiva(149), 14);
  assert.equal(drakeNiva(150), 15);
  assert.equal(drakeNiva(999), 15);
  assert.equal(drakeNiva(-3), 0);
  assert.equal(drakeNiva("abc"), 0);
});

test("drakeProgress: ägget räknar mot 10, 150 = fullt utvecklad", () => {
  assert.deepEqual(drakeProgress(4), { niva: 0, fran: 0, till: 10, kvar: 6, fullt: false });
  assert.deepEqual(drakeProgress(37), { niva: 3, fran: 30, till: 40, kvar: 3, fullt: false });
  assert.equal(drakeProgress(150).fullt, true);
  assert.equal(drakeProgress(150).kvar, 0);
});

test("stadietabellen följer spec-tabellen (stjärnor + faktor)", () => {
  const faktor = [0.35, 0.43, 0.5, 0.6, 0.72, 0.86, 1.02, 1.2, 1.4, 1.62, 1.85, 2.08, 2.31, 2.54, 2.77, 3];
  assert.equal(STADIER.length, 16);
  STADIER.forEach((st, n) => {
    assert.equal(st.niva, n);
    assert.equal(st.faktor, faktor[n]);
    assert.ok(st.gester.length > 0, `nivå ${n} saknar gester`);
  });
  assert.deepEqual(STADIER[1].stjarnor, [10, 19]);
  assert.deepEqual(STADIER[15].stjarnor, [150, 150]);
});

test("alla 16 former ger giltig SVG med rigg och unika id:n", () => {
  const sett = new Set();
  for (let n = 0; n <= 15; n++) {
    const s = drakeSvg(n, { stjarnor: 8 });
    assert.match(s, /^<svg [^>]*viewBox="[-\d. ]+"/);
    assert.ok(!/NaN|undefined/.test(s), `nivå ${n} innehåller NaN/undefined`);
    assert.ok(s.includes('class="bd-andas'), `nivå ${n} saknar andningsgrupp`);
    if (n > 0) for (const k of ["bd-huvud", "bd-oga", "bd-svans", "bd-vinge"]) assert.ok(s.includes(k), `nivå ${n} saknar ${k}`);
    // Riggrupper får inte ha transform-attribut (CSS-animationen skulle skriva över det).
    assert.ok(!/class="bd-(andas|huvud|svans|vinge)[^"]*"[^>]*\stransform=/.test(s), `nivå ${n}: rigg med transform-attribut`);
    const id = s.match(/id="(bd\d+x)/)[1];
    assert.ok(!sett.has(id));
    sett.add(id);
  }
});

test("ägget får sprickor först vid 5–9 stjärnor", () => {
  const sprickor = (st) => (drakeSvg(0, { stjarnor: st }).match(/bd-spricka/g) || []).length;
  assert.equal(sprickor(4), 0);
  assert.equal(sprickor(5), 1);
  assert.equal(sprickor(9), 5);
});

test("storleksrelation: nivå 1 ≈ 1/7 av nivå 15", () => {
  const k1 = skalaFor(1, 100) * drakeMatt(1).enhet, k15 = skalaFor(15, 100) * drakeMatt(15).enhet;
  assert.ok(Math.abs(k1 / k15 - 1 / 7) < 0.01);
  assert.equal(drakeMatt(15).pivot[1], 200);
});

// --- Draken i elevhuset (#714) ----------------------------------------------

test("huspose: vuxna (10–15) har hopvikta vingar, yngre ritas som vanligt", () => {
  for (let n = 1; n <= 15; n++) {
    const hus = drakeSvg(n, { hus: true });
    assert.match(hus, /data-hus="1"/);
    assert.equal(arHusVikt(n), n >= 10);
    // Samma rigg (tomgången behöver grupperna) och samma ruta som i Bråkresan.
    assert.match(hus, /class="bd-andas"/);
    assert.equal(hus.match(/viewBox="([^"]+)"/)[1], drakeSvg(n).match(/viewBox="([^"]+)"/)[1]);
    const lika = hus.replace(/bd\d+x/g, "u").replace(' data-hus="1"', "") === drakeSvg(n).replace(/bd\d+x/g, "u");
    assert.equal(lika, n < 10, `nivå ${n}: huspose ${n < 10 ? "ska" : "ska inte"} vara samma bild`);
  }
});

test("husMatt: storleken växer med nivån, nivå 1 klickbar, nivå 15 ≈ 7× nivå 1:s kropp", () => {
  // Logisk kroppsstorlek i huset (rums-enheter per "häst"-faktor) växer strikt.
  let forra = 0;
  for (let n = 1; n <= 15; n++) {
    const m = husMatt(n), { vb, enhet } = drakeMatt(n);
    assert.ok(m.h >= HUS_MIN_H - 0.05, `nivå ${n} för liten`);
    const kropp = (m.h / vb[3]) * enhet;
    assert.ok(kropp > forra, `nivå ${n} krymper`);
    forra = kropp;
  }
  assert.ok(husMatt(15).h > 5 * husMatt(1).h);
  // Ägget och skräpvärden faller på nivå 1 (ägget visas aldrig i huset).
  assert.deepEqual(husMatt(0), husMatt(1));
  assert.deepEqual(husMatt("x"), husMatt(1));
});

test("husPassning: krymper bara när draken inte ryms ovanför fötterna eller i bredd", () => {
  const scen = { enhetPx: 25, scenW: 1100, scenH: 760 };
  assert.equal(husPassning(husMatt(6), 90, scen), 1);
  const s = husPassning(husMatt(15), 67, { enhetPx: 25, scenW: 1100, scenH: 520 });
  assert.ok(s < 1 && s > 0.5);
  // Huvudet hamnar då precis under överkanten (2 % marginal).
  assert.ok(Math.abs(husMatt(15).h * 25 * s - (0.67 - 0.02) * 520) < 0.01);
  // Smal scen: bredden styr.
  assert.ok(husPassning({ w: 50, h: 2 }, 90, scen) < 1);
  // Okänd scen (dold) → ingen ändring.
  assert.equal(husPassning(husMatt(15), 67, { enhetPx: 25, scenW: 0, scenH: 0 }), 1);
});
