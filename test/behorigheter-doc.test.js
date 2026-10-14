// ============================================================================
// Kontrolltest: docs/BEHORIGHETER.md täcker reglerna och funktionerna (#681).
// ----------------------------------------------------------------------------
// Fäller om
//   • en samling i en `match /…`-rad i firestore.rules saknas i tabellen
//     "Samlingar" (namnet inom backticks på någon rad),
//   • en callable som exporteras från functions/index.js saknas i tabellen
//     "Cloud Functions",
//   • en rad saknar en testnyckel, eller nyckeln saknas i "Testerna",
//   • en testfil i "Testerna" inte finns eller inte körs av test:rules /
//     test:functions i package.json.
// Ren Node, ingen emulator: node --test test/behorigheter-doc.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const doc = read("docs/BEHORIGHETER.md");
const rules = read("firestore.rules");
const fnIndex = read("functions/index.js");
const scripts = JSON.parse(read("package.json")).scripts;

/** Raderna (cellerna) i tabellen under rubriken `## {title}`, utan rubrikrad. */
function table(title) {
  const start = doc.indexOf(`\n## ${title}\n`);
  assert.ok(start >= 0, `rubriken "## ${title}" saknas i docs/BEHORIGHETER.md`);
  const rest = doc.slice(start + title.length + 5);
  const section = rest.slice(0, rest.search(/\n## |$/));
  const rows = section.split("\n").filter((l) => l.startsWith("|"))
    .map((l) => l.slice(1, -1).split("|").map((c) => c.trim()));
  return rows.slice(2); // rubrik + avdelare
}

/** Alla ord inom backticks i en cell ("`a/{x}/b`, `c`" → a, b, c). */
const names = (cell) => [...cell.matchAll(/`([^`]+)`/g)]
  .flatMap((m) => m[1].split(/[/,\s]+/)).filter((n) => /^[A-Za-z]\w*$/.test(n));

/** Samlingarna i reglerna: de bokstavliga segmenten i varje match-väg. */
function ruleCollections() {
  const out = new Set();
  for (const [, path] of rules.matchAll(/match\s+(\/[^\s{]*(?:\{[^}]*\}[^\s{]*)*)\s*\{/g)) {
    for (const seg of path.split("/")) {
      if (seg && !seg.startsWith("{") && seg !== "databases" && seg !== "documents") out.add(seg);
    }
  }
  return [...out];
}

const keys = new Map(table("Testerna").map(([k, file]) => [k, file.replace(/`/g, "")]));
const samlingar = table("Samlingar");
const funktioner = table("Cloud Functions");

test("varje samling i firestore.rules står i tabellen Samlingar", () => {
  const listed = new Set(samlingar.flatMap((r) => names(r[0])));
  const found = ruleCollections();
  assert.ok(found.length > 40, `för få samlingar hittades i reglerna (${found.length})`);
  const missing = found.filter((c) => !listed.has(c));
  assert.deepEqual(missing, [], `saknas i docs/BEHORIGHETER.md: ${missing.join(", ")}`);
});

test("varje callable i functions/index.js står i tabellen Cloud Functions", () => {
  const listed = new Set(funktioner.flatMap((r) => names(r[0])));
  const exported = [...fnIndex.matchAll(/^export const (\w+)\s*=/gm)].map((m) => m[1]);
  assert.ok(exported.includes("updateStudentLogin"));
  const missing = exported.filter((f) => !listed.has(f));
  assert.deepEqual(missing, [], `saknas i docs/BEHORIGHETER.md: ${missing.join(", ")}`);
});

test("varje rad har en testreferens med en känd nyckel", () => {
  for (const r of [...samlingar, ...funktioner]) {
    assert.equal(r.length, 4, `raden "${r[0]}" ska ha fyra kolumner`);
    const used = r[3].match(/\b[A-Z]{2}\b/g) || [];
    assert.ok(used.length, `raden "${r[0]}" saknar test`);
    for (const k of used) assert.ok(keys.has(k), `okänd testnyckel ${k} på raden "${r[0]}"`);
  }
});

test("varje testfil finns och körs av test:rules eller test:functions", () => {
  assert.ok(keys.size >= 5);
  const suites = `${scripts["test:rules"]} ${scripts["test:functions"]}`;
  for (const [k, file] of keys) {
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${k}: ${file} finns inte`);
    assert.ok(suites.includes(file), `${k}: ${file} körs inte av test:rules/test:functions`);
  }
});
