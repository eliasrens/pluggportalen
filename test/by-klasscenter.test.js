// ============================================================================
// Klasscentret i byn (#480, epic #476): by-layouten med centret först i
// slingan, mätartexten och bootgrafen. Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { byParams, byLayout, BY_SKYLT, klasscenterSpan, klasscenterRad0 } from "../src/varld-by.js";
import { byDekor } from "../src/art-by-dekor.js";
import { matarRad, matarMarkup, ariaText } from "../src/klasscenter/kc-by.js";
import { MAX_NIVA, progressTillNasta, troskelFor } from "../src/klasscenter/kc-niva.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const STORLEKAR = [0, 1, 2, 3, 4, 5, 14, 23, 28, 40];
const EPS = 1e-6;

const tomtRuta = (t, l) => ({
  v: t.x - l.cellW / 2, h: t.x + l.cellW / 2, o: t.y - l.radHojd / 2, u: t.y + l.radHojd / 2,
});
const kcRuta = (c) => ({ v: c.x - c.bredd / 2, h: c.x + c.bredd / 2, o: c.topp, u: c.botten });
const overlapp = (a, b) => a.v < b.h - EPS && b.v < a.h - EPS && a.o < b.u - EPS && b.o < a.u - EPS;

describe("byLayout med Klasscentret", () => {
  for (const n of STORLEKAR) {
    it(`${n} elever: en tomt per elev, centret mitt i översta raden, inga överlapp`, () => {
      const l = byLayout(byParams(n, { klasscenter: true }));
      const c = l.klasscenter;
      assert.equal(l.tomter.length, n, "antal elevtomter == antal elever");
      assert.ok(c, "centret finns");
      assert.equal(c.span, klasscenterSpan(n));
      assert.ok(c.span >= 2 && c.span <= 3);
      assert.equal(c.rad, 0, "centret ligger i översta raden");
      assert.equal(c.x, 50, "centret i mitten");
      assert.ok(Math.abs(c.bredd - c.span * l.cellW) < EPS, "tar span tomtbredder");
      assert.ok(c.hojd > l.radHojd, "högre än ett hus");

      // Översta raden: hus, hus, CENTRET, hus, hus (färre → jämnt, udda till vänster).
      const rad0 = l.tomter.filter((t) => t.rad === 0);
      const vanster = rad0.filter((t) => t.x < c.x).length;
      const hoger = rad0.filter((t) => t.x > c.x).length;
      assert.equal(rad0.length, Math.min(4, n));
      if (n >= 4) assert.deepEqual([vanster, hoger], [2, 2]);
      else assert.deepEqual([vanster, hoger], [Math.ceil(n / 2), Math.floor(n / 2)]);
      assert.deepEqual(klasscenterRad0(n), { vanster, hoger, sida: vanster });
      // Slingans ordning: tomterna i översta raden först, vänster→höger, sedan raderna under.
      l.tomter.slice(0, rad0.length).forEach((t, i) => assert.equal(t.rad, 0, `tomt ${i} i översta raden`));
      for (let i = 1; i < rad0.length; i++) assert.ok(l.tomter[i].x > l.tomter[i - 1].x);
      for (const t of l.tomter.slice(rad0.length)) assert.ok(t.rad >= 1);
      // Husen står tätt intill centret (en halv tomt från kanten).
      if (vanster) assert.ok(Math.abs(c.x - c.bredd / 2 - l.cellW / 2 - Math.max(...rad0.filter((t) => t.x < c.x).map((t) => t.x))) < EPS);
      if (hoger) assert.ok(Math.abs(c.x + c.bredd / 2 + l.cellW / 2 - Math.min(...rad0.filter((t) => t.x > c.x).map((t) => t.x))) < EPS);

      const kc = kcRuta(c);
      l.tomter.forEach((t, i) => {
        assert.equal(overlapp(tomtRuta(t, l), kc), false, `tomt ${i} krockar med centret`);
        for (let j = i + 1; j < l.tomter.length; j++) {
          assert.equal(overlapp(tomtRuta(t, l), tomtRuta(l.tomter[j], l)), false, `tomt ${i}/${j}`);
        }
        // Inom lagret (mitt-punkt + halva rutan).
        const r = tomtRuta(t, l);
        assert.ok(r.v >= 0 && r.h <= 100 && r.o >= 0 && r.u <= 100, `tomt ${i} utanför lagret`);
      });
      assert.ok(kc.v >= 0 && kc.h <= 100 && kc.o >= 6 && kc.u <= 100, "centret inom lagret, under himlen");

      // Vägen passerar FRAMFÖR centret: centrets botten = radens marklinje, strax
      // ovanför vägens mittlinje vid x (samma slinger).
      assert.ok(Math.abs(c.botten - (l.vagY(0, c.x) - l.radHojd * 0.05)) < 1e-6);
      assert.ok(l.vagY(0, c.x) > c.botten);

      // Ingen uppstående dekor med markpunkt i centrets ruta (eller luften ovanför).
      const d = byDekor(l);
      for (const u of d.uppst) {
        const inne = u.x > kc.v && u.x < kc.h && u.y > kc.o - 6 && u.y < kc.u;
        assert.equal(inne, false, `${u.typ} @${u.x.toFixed(1)},${u.y.toFixed(1)} står i centret`);
      }
      for (const p of d.platta) {
        assert.equal(p.x > kc.v && p.x < kc.h && p.y > kc.o && p.y < kc.u, false, `${p.typ} i centret`);
      }
    });
  }

  it("raderna under fylls i ordning: högst husPerRad per rad, alla elever med", () => {
    for (const n of [5, 14, 23, 28, 40]) {
      const p = byParams(n, { klasscenter: true });
      const l = byLayout(p);
      assert.ok(p.husPerRad >= 2 * 2 + p.kcSpan, "översta raden ryms");
      let summa = l.tomter.filter((t) => t.rad === 0).length;
      for (let rad = 1; rad < l.rader; rad++) {
        const iRad = l.tomter.filter((t) => t.rad === rad).length;
        assert.ok(iRad >= 1 && iRad <= p.husPerRad, `rad ${rad}: ${iRad}`);
        summa += iRad;
      }
      assert.equal(summa, n);
    }
  });

  it('"Andra byar"-skylten (#483): ingen tomt och inte centret i skyltens hörn, 0–40 elever', () => {
    const skylt = BY_SKYLT;
    assert.ok(skylt.v <= 0 && skylt.u >= 100, "skylten sitter nere i vänstra hörnet");
    for (let n = 0; n <= 40; n++) {
      const p = byParams(n, { klasscenter: true });
      const l = byLayout(p);
      assert.equal(l.tomter.length, n, `${n}: alla elever kvar`);
      l.tomter.forEach((t, i) => {
        assert.equal(overlapp(tomtRuta(t, l), skylt), false, `${n} elever: tomt ${i} under skylten`);
        const r = tomtRuta(t, l);
        assert.ok(r.v >= 0 && r.h <= 100 && r.o >= 0 && r.u <= 100, `${n}: tomt ${i} utanför lagret`);
      });
      assert.equal(overlapp(kcRuta(l.klasscenter), skylt), false, `${n} elever: centret under skylten`);
      // Mätaren svävar ovanför centret – rutan från lagrets topp ner till centret.
      const c = l.klasscenter;
      assert.equal(overlapp({ v: c.x - c.bredd / 2, h: c.x + c.bredd / 2, o: 0, u: c.botten }, skylt), false);
      for (let i = 0; i < l.tomter.length; i++) {
        for (let j = i + 1; j < l.tomter.length; j++) {
          assert.equal(overlapp(tomtRuta(l.tomter[i], l), tomtRuta(l.tomter[j], l)), false, `${n}: ${i}/${j}`);
        }
      }
    }
  });

  it("skylt-reservationen krymper husen bara när den måste", () => {
    for (let n = 0; n <= 40; n++) {
      const med = byParams(n, { klasscenter: true });
      const utan = byParams(n, { klasscenter: true, skylt: false });
      assert.ok(med.radHojd <= utan.radHojd + EPS);
      const krock = byLayout(utan).tomter.some((t) => overlapp(tomtRuta(t, byLayout(utan)), BY_SKYLT));
      if (!krock) assert.equal(med.radHojd, utan.radHojd, `${n}: oförändrad storlek utan krock`);
    }
  });

  it("utan klasscenter är byParams/byLayout oförändrade", () => {
    for (const n of [0, 1, 5, 14, 28]) {
      const p = byParams(n);
      const antal = Math.max(1, n);
      const hpr = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(antal * 1.9))));
      const rader = Math.ceil(antal / hpr);
      const cell = 84 / rader;
      const radHojd = Math.min(26, cell * 0.8);
      const vagHojd = Math.max(3, Math.min(7, cell - radHojd));
      assert.deepEqual(p, {
        antalHus: antal, husPerRad: hpr, radHojd, vagHojd, kcSpan: 0, kcExtra: 0,
        toppY: Math.max(8, 8 + (84 - rader * (radHojd + vagHojd)) / 2),
      });
      const l = byLayout(p);
      assert.equal(l.klasscenter, null);
      assert.equal(l.tomter.length, antal);
    }
  });
});

describe("mätaren", () => {
  it("visar klassens tal mot nästa nivå", () => {
    const p = progressTillNasta(50, 14);
    assert.equal(matarRad(p), `50 / ${troskelFor(p.nasta, 14)} övningar till Nivå ${p.nasta}`);
    const m = matarMarkup(p);
    assert.match(m, new RegExp(`Nivå ${p.niva} · ${p.namn}`));
    assert.match(m, /style="width:\d+%"/);
  });
  it("högsta nivån visar Maxnivå och full stapel", () => {
    const p = progressTillNasta(troskelFor(MAX_NIVA, 5) + 3, 5);
    assert.equal(p.niva, MAX_NIVA);
    assert.equal(matarRad(p), "Maxnivå");
    assert.match(matarMarkup(p), /width:100%/);
  });
  it("aria-label har nivå + mätartext även när mätaren är dold (#484)", () => {
    const p = progressTillNasta(50, 14);
    assert.equal(ariaText(p), `Klasscentret, Nivå ${p.niva} ${p.namn}. ${matarRad(p)}`);
    assert.match(ariaText(p, { visaOnly: true, klassNamn: "6B" }), new RegExp(`^Klasscentret i 6B, .*${matarRad(p)}$`));
  });
});

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

it("bootgrafen: by-scenen statisk, Klasscentret bara dynamiskt (#271)", () => {
  const g = staticBootGraph();
  assert.ok(g.has(join(SRC, "varld-by-scen.js")), "BFS:en hittar by-scenen");
  for (const f of [
    "klasscenter/kc-by.js", "klasscenter/kc-niva.js", "klasscenter/kc-exp-data.js",
    "art-klasscenter.js", "art-klasscenter-tidig.js", "art-klasscenter-mitt.js",
    "art-klasscenter-sen.js", "art-klasscenter-delar.js",
    // Rummet (#490): bara via import() vid klick på centret.
    "rum-inredning.js", "art-klasscenter-hall.js", "klasscenter/kc-rum-vy.js",
    "klasscenter/kc-rum-session.js", "klasscenter/kc-rum-tillstand.js", "klasscenter/kc-rum-historik.js",
    // Pokaler (#494): bara via import() från avslutsflödena/rummet.
    "klasscenter/kc-pokal-typer.js", "klasscenter/kc-pokal-data.js",
  ]) {
    assert.equal(g.has(join(SRC, f)), false, `${f} får inte ligga i bootgrafen`);
  }
});
