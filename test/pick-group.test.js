// ============================================================================
// Enhetstest för pickOnePerGroup (src/pick-group.js) och "group"-fältet i
// validateArea (src/validate.js). Körs med Node:s inbyggda testkörare: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { pickOnePerGroup } from "../src/pick-group.js";
import { validateArea } from "../src/validate.js";

// --- pickOnePerGroup -------------------------------------------------------

test("par utan group är alltid med som kandidater (oförändrat antal)", () => {
  const pairs = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ];
  const out = pickOnePerGroup(pairs);
  assert.equal(out.length, 3);
  assert.deepEqual(new Set(out.map((p) => p.id)), new Set(["a", "b", "c"]));
});

test("högst ett par per group kommer med", () => {
  const pairs = [
    { id: "bild-s", group: "parti-s" },
    { id: "text-s", group: "parti-s" },
    { id: "bild-m", group: "parti-m" },
    { id: "text-m", group: "parti-m" },
  ];
  // Kör många gånger eftersom valet är slumpat.
  for (let i = 0; i < 200; i++) {
    const out = pickOnePerGroup(pairs);
    assert.equal(out.length, 2, "en per group → 2 par");
    const groups = out.map((p) => p.group);
    assert.deepEqual(new Set(groups), new Set(["parti-s", "parti-m"]));
    // Aldrig två från samma group.
    assert.equal(new Set(groups).size, groups.length);
  }
});

test("blandat: grupper + grupplösa – totalen = antal grupper + antal grupplösa", () => {
  const pairs = [
    { id: "bild-s", group: "parti-s" },
    { id: "text-s", group: "parti-s" },
    { id: "bild-sd", group: "parti-sd" },
    { id: "text-sd", group: "parti-sd" },
    { id: "unik1" },
    { id: "unik2" },
  ];
  for (let i = 0; i < 100; i++) {
    const out = pickOnePerGroup(pairs);
    // 2 grupper (parti-s, parti-sd) + 2 grupplösa = 4
    assert.equal(out.length, 4);
    assert.ok(out.some((p) => p.id === "unik1"));
    assert.ok(out.some((p) => p.id === "unik2"));
    const grouped = out.filter((p) => p.group);
    assert.equal(new Set(grouped.map((p) => p.group)).size, grouped.length);
  }
});

test("över tillräckligt många körningar plockas båda medlemmarna ur en group ibland", () => {
  const pairs = [
    { id: "bild-s", group: "parti-s" },
    { id: "text-s", group: "parti-s" },
  ];
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickOnePerGroup(pairs)[0].id);
  assert.deepEqual(seen, new Set(["bild-s", "text-s"]), "valet ska variera slumpmässigt");
});

test("tål tom lista, null och trimmar group-namn", () => {
  assert.deepEqual(pickOnePerGroup([]), []);
  assert.deepEqual(pickOnePerGroup(null), []);
  const out = pickOnePerGroup([
    { id: "a", group: " parti-s " },
    { id: "b", group: "parti-s" },
  ]);
  assert.equal(out.length, 1, "trimmad group räknas som samma group");
});

test("muterar inte indata-arrayen", () => {
  const pairs = [{ id: "a", group: "g" }, { id: "b", group: "g" }];
  const copy = pairs.slice();
  pickOnePerGroup(pairs);
  assert.deepEqual(pairs, copy);
});

// --- validateArea: "group"-fältet ------------------------------------------

test('validateArea tar med "group" (trimmad) när den finns', () => {
  const res = validateArea({
    name: "Demokrati",
    pairs: [{ term: "S", defImage: "partier/s", group: "  parti-s  " }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.pairs[0].group, "parti-s");
});

test('validateArea utelämnar "group" när den saknas eller är tom (bakåtkompatibelt)', () => {
  const res = validateArea({
    name: "Vikingatiden",
    pairs: [
      { term: "Oden", definition: "Gud" },
      { term: "Tor", definition: "Gud", group: "   " },
    ],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal("group" in res.value.pairs[0], false);
  assert.equal("group" in res.value.pairs[1], false);
});
