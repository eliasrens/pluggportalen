// ============================================================================
// Hitta rätt! – Kartmästare-pokalerna (#610): ren logik + konst + bootgraf.
// Servern (ledarna i hittaRattMeta/ledare) testas i
// functions-hitta-ratt-pokal.test.mjs, reglerna i firestore-rules-hitta-ratt-pokal.test.js.
// Körs med: node --test test/hitta-ratt-pokal.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  arPokalNyckel, minaPokaler, packIdFranNyckel, pokalNamn, pokalNyckel, rensaPokaler,
} from "../src/hitta-ratt/hr-pokal.js";
import { kartmastareSvg, motivFor, POKAL_STORLEK } from "../src/hitta-ratt/hr-pokal-art.js";
import { ledare } from "../src/hitta-ratt/delat/rank.js";
import { KC_POKAL_STORLEK } from "../src/klasscenter/kc-pokal-placering.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const INDEX = JSON.parse(readFileSync(join(SRC, "hitta-ratt/content/packs/index.json"), "utf8"));

const META = {
  packs: {
    "sverige-stader": { uids: ["omar", "clara"], titel: "Sveriges städer", typ: "point" },
    "sverige-landskap": { uids: ["alma"], titel: "Sveriges landskap", typ: "area" },
    "europa-huvudstader-20": { uids: ["omar"], titel: "Europas huvudstäder – 20", typ: "point" },
    "eget-pack": { uids: ["omar"], titel: "Klassens kartor", typ: "point", av: true },
    "tomt": { uids: [], titel: "Tomt", typ: "point" },
  },
};

describe("vilka pokaler en elev har", () => {
  it("bara pack där eleven leder – sorterade på titel, med pokalens namn", () => {
    const p = minaPokaler(META, "omar");
    assert.deepEqual(p.map((x) => x.packId), ["europa-huvudstader-20", "sverige-stader"]);
    assert.equal(p[0].nyckel, "hrpokal-europa-huvudstader-20");
    assert.equal(p[0].namn, "Kartmästare – Skolrekord Europas huvudstäder – 20");
    assert.equal(p[1].typ, "point");
    assert.deepEqual(minaPokaler(META, "alma").map((x) => [x.packId, x.typ]), [["sverige-landskap", "area"]]);
  });

  it("delad etta: alla ettor har pokalen samtidigt (ledarna ur rank.js)", () => {
    const entries = { omar: { s: 1943 }, clara: { s: 1943 }, alma: { s: 1928 } };
    const uids = ledare(entries, "point");
    assert.deepEqual(uids, ["clara", "omar"]);
    const meta = { packs: { "sverige-stader": { uids, titel: "Sveriges städer", typ: "point" } } };
    assert.equal(minaPokaler(meta, "omar").length, 1);
    assert.equal(minaPokaler(meta, "clara").length, 1);
    assert.equal(minaPokaler(meta, "alma").length, 0);
  });

  it("ledarbyte: den gamla ledaren har ingen pokal kvar, den nya har den", () => {
    const fore = { packs: { p1: { uids: ["omar"], titel: "P", typ: "point" } } };
    const efter = { packs: { p1: { uids: ["alma"], titel: "P", typ: "point" } } };
    assert.equal(minaPokaler(fore, "omar").length, 1);
    assert.equal(minaPokaler(efter, "omar").length, 0);
    assert.equal(minaPokaler(efter, "alma").length, 1);
  });

  it("avstängd topplista (av), tom lista, okänd/trasig data → ingen pokal", () => {
    assert.equal(minaPokaler(META, "nobody").length, 0);
    assert.ok(!minaPokaler(META, "omar").some((p) => p.packId === "eget-pack"));
    for (const m of [null, {}, { packs: null }, { packs: { "../x": { uids: ["omar"] } } }, { packs: { a: { uids: "omar" } } }]) {
      assert.deepEqual(minaPokaler(m, "omar"), []);
    }
    assert.deepEqual(minaPokaler(META, ""), []);
    assert.equal(minaPokaler({ packs: { p2: { uids: ["omar"] } } }, "omar")[0].titel, "p2");
  });

  it("nycklar och namn", () => {
    assert.equal(pokalNyckel("sverige-lan"), "hrpokal-sverige-lan");
    assert.equal(packIdFranNyckel("hrpokal-sverige-lan"), "sverige-lan");
    assert.equal(packIdFranNyckel("soffa"), null);
    assert.ok(arPokalNyckel("hrpokal-x") && !arPokalNyckel("pokal-x") && !arPokalNyckel(null));
    assert.equal(pokalNamn("Sveriges landskap"), "Kartmästare – Skolrekord Sveriges landskap");
  });
});

describe("placeringen städas när ledningen tappas", () => {
  it("bara pokaler eleven inte längre har tas bort – möbler och giltiga pokaler står kvar", () => {
    const pl = {
      soffa: { x: 10, y: 80 }, "lampa#2": { x: 20, y: 80 },
      "hrpokal-sverige-stader": { x: 40, y: 80 }, "hrpokal-europa-lander-20": { x: 60, y: 80 },
    };
    const n = rensaPokaler(pl, new Set(["hrpokal-sverige-stader"]));
    assert.equal(n, 1);
    assert.deepEqual(Object.keys(pl).sort(), ["hrpokal-sverige-stader", "lampa#2", "soffa"]);
    assert.equal(rensaPokaler(pl, new Set(["hrpokal-sverige-stader"])), 0, "idempotent");
    assert.equal(rensaPokaler({}, new Set()), 0);
  });
});

describe("konsten", () => {
  const svgs = INDEX.map((p) => kartmastareSvg({ packId: p.id, typ: p.type }));

  it("en EGEN pokal per officiellt pack (12 olika SVG:er)", () => {
    assert.equal(INDEX.length, 12);
    assert.equal(new Set(svgs).size, INDEX.length);
    assert.deepEqual([...new Set(INDEX.map((p) => motivFor(p.id)))].sort(), ["europa", "platser", "sverige", "varlden"]);
  });

  it("något mindre än Klasscentrets (Live-)pokaler men samma proportioner", () => {
    assert.ok(POKAL_STORLEK.w < KC_POKAL_STORLEK.w, `${POKAL_STORLEK.w} < ${KC_POKAL_STORLEK.w}`);
    assert.ok(POKAL_STORLEK.w >= KC_POKAL_STORLEK.w * 0.8, "fortfarande tydlig");
  });

  it("platt projektstil: inga id/defs/gradienter, kontur #3B3350, giltig aria", () => {
    for (const s of svgs) {
      assert.doesNotMatch(s, /\sid=|<defs|Gradient|<script|<foreignObject/);
      assert.match(s, /#3B3350/);
      assert.match(s, /^<svg class="hr-pokal-svg"[^>]*viewBox="0 0 100 140"/);
    }
    const a = kartmastareSvg({ packId: "x", typ: "point" }, { aria: 'Kartmästare <"b">' });
    assert.match(a, /role="img" aria-label="Kartmästare &#60;&#34;b&#34;&#62;"/);
    assert.doesNotMatch(kartmastareSvg({ packId: "x" }, { animera: false }), /kc-glitter/);
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

it("bootgrafen: pokalmodulerna laddas bara dynamiskt (#271), grafen är kvar på 107", () => {
  const g = staticBootGraph();
  assert.ok(g.has(join(SRC, "varld-rum.js")) && g.has(join(SRC, "pages-klasskamrat.js")), "husen är statiska – pokalerna inte");
  for (const f of ["hitta-ratt/hr-pokal.js", "hitta-ratt/hr-pokal-art.js", "hitta-ratt/hr-pokal-rum.js"]) {
    assert.equal(g.has(join(SRC, f)), false, `${f} får inte ligga i bootgrafen`);
  }
  assert.equal(g.size, 107);
});
