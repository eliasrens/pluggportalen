// ============================================================================
// Enhetstest för de nya bild-reglerna i validateArea (par + bildpaket).
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateArea } from "../src/validate.js";
import { resolvePairImage, listPairImageKeys, isKnownPairImage } from "../src/pair-images.js";

// --- Bildpaketet (pair-images.js) ------------------------------------------

test("bildpaketet har alla 8 riksdagspartier med korrekt nyckelformat", () => {
  const keys = listPairImageKeys();
  assert.equal(keys.length, 8);
  const set = new Set(keys.map((k) => k.key));
  for (const k of ["s", "m", "sd", "c", "v", "kd", "l", "mp"]) {
    assert.ok(set.has(`partier/${k}`), `saknar partier/${k}`);
  }
});

test("resolvePairImage ger markup + alt för en känd nyckel", () => {
  const img = resolvePairImage("partier/s");
  assert.ok(img);
  assert.match(img.markup, /<svg/);
  assert.equal(img.alt, "Socialdemokraternas partisymbol");
});

test("resolvePairImage tål versaler/mellanslag och okänd nyckel ger null", () => {
  assert.ok(resolvePairImage("  Partier/SD "));
  assert.equal(resolvePairImage("partier/xyz"), null);
  assert.equal(resolvePairImage(""), null);
  assert.equal(isKnownPairImage("partier/kd"), true);
  assert.equal(isKnownPairImage("partier/nope"), false);
});

// --- validateArea: nya par-regler ------------------------------------------

test("bild på ena sidan + text på andra validerar rent (bild↔text)", () => {
  const res = validateArea({
    name: "Demokrati",
    pairs: [{ term: "Socialdemokraterna", defImage: "partier/s" }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  const p = res.value.pairs[0];
  assert.equal(p.term, "Socialdemokraterna");
  assert.equal(p.defImage, "partier/s");
  assert.equal(p.definition, "");
});

test("bild↔bild validerar rent", () => {
  const res = validateArea({
    name: "Demokrati",
    pairs: [{ termImage: "partier/v", defImage: "partier/mp" }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.pairs[0].termImage, "partier/v");
  assert.equal(res.value.pairs[0].defImage, "partier/mp");
});

test("okänd bildnyckel ger tydligt fel som listar giltiga nycklar", () => {
  const res = validateArea({
    name: "Demokrati",
    pairs: [{ term: "Foo", defImage: "partier/xyz" }],
  });
  assert.equal(res.ok, false);
  const msg = res.errors.join(" | ");
  assert.match(msg, /okänd bildnyckel "partier\/xyz"/);
  assert.match(msg, /partier\/s/); // listar giltiga nycklar
});

test("sida utan både text och bild ger fel med par-nummer", () => {
  const res = validateArea({
    name: "Demokrati",
    pairs: [{ term: "Bara term" }], // definition-sidan tom, ingen defImage
  });
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /Par 1: definition-sidan är tom/);
});

test("rena text-par fungerar exakt som förut (inga bildfält i value)", () => {
  const res = validateArea({
    name: "Vikingatiden",
    pairs: [{ term: "Oden", definition: "Gudarnas kung" }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  const p = res.value.pairs[0];
  assert.equal(p.term, "Oden");
  assert.equal(p.definition, "Gudarnas kung");
  assert.equal("termImage" in p, false);
  assert.equal("defImage" in p, false);
});
