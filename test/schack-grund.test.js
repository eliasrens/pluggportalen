// ============================================================================
// Schack A (#775): bootgrafen (#271), den vendorade chess.js med licens,
// pjäserna (egna SVG, inga unicode-schacktecken), texterna och brädets
// koordinatberäkningar. Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { pjasSvg, PJAS_TYPER } from "../src/schack/schack-pjaser.js";
import { svenskSan, pjasText, rutaEtikett, dragLista } from "../src/schack/schack-text.js";
import { rutaVid, grannRuta } from "../src/schack/schack-bradet-inmatning.js";
import { rutaMitt } from "../src/schack/schack-bradet-delar.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const SCHACK = join(SRC, "schack");

function filerUnder(mapp) {
  return readdirSync(mapp).flatMap((f) => {
    const p = join(mapp, f);
    return statSync(p).isDirectory() ? filerUnder(p) : [p];
  });
}

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

describe("bootgrafen (#271): src/schack/ laddas bara med import()", () => {
  it("ingen fil i src/schack/ ligger i app.js statiska importgraf", () => {
    const g = staticBootGraph();
    const i = [...g].filter((f) => f.startsWith(SCHACK + "/"));
    assert.deepEqual(i, []);
    assert.ok(g.size > 50, "grafen hittades");
  });
  it("ingen fil utanför src/schack/ importerar schack statiskt", () => {
    for (const fil of filerUnder(SRC).filter((f) => f.endsWith(".js") && !f.startsWith(SCHACK + "/"))) {
      const src = readFileSync(fil, "utf8");
      assert.doesNotMatch(src, /^\s*(?:import|export)\s[^;]*?from\s+["'][^"']*schack\//m, relative(ROOT, fil));
    }
  });
  it("styles.css är byggd med schackdelen", () => {
    assert.match(readFileSync(join(SRC, "styles.css"), "utf8"), /src\/styles\/35-schack\.css/);
  });
});

describe("chess.js (§1) – fast version med licens, inget GPL", () => {
  const kod = readFileSync(join(SCHACK, "vendor/chess.js"), "utf8");
  it("versionen står i en kommentar och licensen (BSD-2) ligger bredvid", () => {
    assert.match(kod.split("\n")[0], /^\/\/ chess\.js 1\.4\.0 \(npm "chess\.js", BSD-2-Clause/);
    const lic = readFileSync(join(SCHACK, "vendor/LICENSE"), "utf8");
    assert.match(lic, /Copyright \(c\) 2025, Jeff Hlywa/);
    assert.match(lic, /Redistribution and use in source and binary forms/);
  });
  it("ESM utan egna importer och utan källkarta", () => {
    assert.doesNotMatch(kod, /^import /m);
    assert.match(kod, /^export \{[^}]*\bChess\b/m);
    assert.doesNotMatch(kod, /^\/\/# sourceMappingURL/m);
  });
  it("inga GPL-bibliotek i src/schack/", () => {
    for (const fil of filerUnder(SCHACK)) {
      const src = readFileSync(fil, "utf8");
      assert.doesNotMatch(src, /stockfish|chessground|GNU General Public/i, relative(ROOT, fil));
    }
  });
});

describe("pjäserna (§2.1)", () => {
  it("alla tolv pjäser är egna SVG:er med kontur och viewBox", () => {
    for (const f of ["w", "b"]) {
      for (const t of PJAS_TYPER) {
        const svg = pjasSvg(f, t, { storlek: 40 });
        assert.match(svg, /^<svg class="schack-pjas schack-pjas-[wb][kqrbnp]" viewBox="6 6 88 88" width="40px" height="40px"/);
        assert.match(svg, /stroke="#3B3350"/);
        assert.match(svg, /<\/svg>$/);
      }
    }
    assert.equal(new Set(PJAS_TYPER.map((t) => pjasSvg("w", t))).size, 6, "sex olika former");
    assert.equal(pjasSvg("x", "k"), "");
    assert.match(pjasSvg("b", "n", { titel: "svart springare" }), /role="img" aria-label="svart springare"/);
  });
  it("inga unicode-schacktecken (♔–♟) i schackmodulen", () => {
    for (const fil of filerUnder(SCHACK).filter((f) => !f.includes("/vendor/"))) {
      assert.doesNotMatch(readFileSync(fil, "utf8"), /[♔-♟]/u, relative(ROOT, fil));
    }
  });
});

describe("texterna", () => {
  it("svensk notation och etiketter", () => {
    assert.equal(svenskSan("Nf3"), "Sf3");
    assert.equal(svenskSan("Bxe5+"), "Lxe5+");
    assert.equal(svenskSan("exd8=Q#"), "exd8=D#");
    assert.equal(svenskSan("Rae1"), "Tae1");
    assert.equal(svenskSan("O-O-O"), "O-O-O");
    assert.equal(pjasText("w", "r"), "vitt torn");
    assert.equal(pjasText("b", "r"), "svart torn");
    assert.equal(rutaEtikett("e4", { color: "w", type: "n" }), "e4, vit springare");
    assert.equal(rutaEtikett("e5", null, ["möjligt drag"]), "e5, tom, möjligt drag");
  });
  it("draglistan börjar rätt även när svart drar först", () => {
    assert.equal(dragLista(["e4", "e5", "Nf3"]).text, "1. e4 e5 2. Sf3");
    assert.deepEqual(dragLista(["Kd7", "Rb1"], "8/8/8/8/8/8/8/k6K b - - 0 12").rader, ["12… Kd7", "13. Tb1"]);
    assert.equal(dragLista([]).text, "");
  });
});

describe("brädets geometri", () => {
  const rect = { left: 100, top: 50, width: 400, height: 400 };
  it("rutan under pekaren, vit och svart nederst", () => {
    assert.equal(rutaVid(rect, 101, 449, "w"), "a1");
    assert.equal(rutaVid(rect, 499, 51, "w"), "h8");
    assert.equal(rutaVid(rect, 101, 449, "b"), "h8");
    assert.equal(rutaVid(rect, 325, 275, "w"), "e4");
    assert.equal(rutaVid(rect, 99, 300, "w"), null);
  });
  it("pilarna går som eleven ser brädet", () => {
    assert.equal(grannRuta("e2", 0, -1, "w"), "e3");
    assert.equal(grannRuta("e2", 0, -1, "b"), "e1");
    assert.equal(grannRuta("a1", -1, 0, "w"), "a1");
    assert.equal(grannRuta("a1", 1, 0, "b"), "a1");
    assert.deepEqual(rutaMitt("a1", "w"), { x: 50, y: 750 });
    assert.deepEqual(rutaMitt("a1", "b"), { x: 750, y: 50 });
  });
});
