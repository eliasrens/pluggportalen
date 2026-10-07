// ============================================================================
// Klasscentret i byn (#480, epic #476): by-layouten med centret först i
// slingan, mätartexten och bootgrafen. Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { byParams, byLayout, byDekor, klasscenterSpan } from "../src/varld-by.js";
import { matarRad, matarMarkup, placeholderText } from "../src/klasscenter/kc-by.js";
import { progressTillNasta, troskelFor } from "../src/klasscenter/kc-niva.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const STORLEKAR = [0, 1, 5, 14, 23, 28, 40];
const EPS = 1e-6;

const tomtRuta = (t, l) => ({
  v: t.x - l.cellW / 2, h: t.x + l.cellW / 2, o: t.y - l.radHojd / 2, u: t.y + l.radHojd / 2,
});
const kcRuta = (c) => ({ v: c.x - c.bredd / 2, h: c.x + c.bredd / 2, o: c.topp, u: c.botten });
const overlapp = (a, b) => a.v < b.h - EPS && b.v < a.h - EPS && a.o < b.u - EPS && b.o < a.u - EPS;

describe("byLayout med Klasscentret", () => {
  for (const n of STORLEKAR) {
    it(`${n} elever: en tomt per elev, centret först, inga överlapp`, () => {
      const l = byLayout(byParams(n, { klasscenter: true }));
      const c = l.klasscenter;
      assert.equal(l.tomter.length, n, "antal elevtomter == antal elever");
      assert.ok(c, "centret finns");
      assert.equal(c.span, klasscenterSpan(n));
      assert.ok(c.span >= 2 && c.span <= 3);
      assert.equal(c.rad, 0, "centret ligger i första raden");
      assert.ok(Math.abs(c.bredd - c.span * l.cellW) < EPS, "tar span tomtbredder");
      assert.ok(c.hojd > l.radHojd, "högre än ett hus");

      // Först i slingan: rad 0 går vänster→höger, alla rad-0-hus till höger.
      for (const t of l.tomter.filter((t) => t.rad === 0)) assert.ok(t.x > c.x);

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

      // Centrets botten = radens marklinje (samma slinger som vägen vid x).
      assert.ok(Math.abs(c.botten - (l.vagY(0, c.x) - l.radHojd * 0.05)) < 1e-6);

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

  it("platserna räknas: elevhus + centrets platser fyller raderna i ordning", () => {
    const p = byParams(28, { klasscenter: true });
    const l = byLayout(p);
    const rad0 = l.tomter.filter((t) => t.rad === 0).length;
    assert.equal(rad0, p.husPerRad - p.kcSpan);
    assert.equal(l.rader, Math.ceil((28 + p.kcSpan) / p.husPerRad));
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
  it("nivå 10 visar Maxnivå och full stapel", () => {
    const p = progressTillNasta(troskelFor(10, 5) + 3, 5);
    assert.equal(p.niva, 10);
    assert.equal(matarRad(p), "Maxnivå");
    assert.match(matarMarkup(p), /width:100%/);
  });
  it("placeholder-texten vid klick", () => {
    const p = progressTillNasta(troskelFor(3, 10), 10);
    assert.equal(placeholderText(p), "Klasscentret – Nivå 3 Träkoja · inredning kommer snart");
    assert.match(placeholderText(p, { visaOnly: true, klassNamn: "6B" }), /^Klasscentret i 6B – Nivå 3/);
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
  ]) {
    assert.equal(g.has(join(SRC, f)), false, `${f} får inte ligga i bootgrafen`);
  }
});
