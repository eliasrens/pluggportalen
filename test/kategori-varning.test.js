// ============================================================================
// #467 F1: varningen för okänd frågekategori ska SYNAS för läraren (icke-
// blockerande). validateArea/mergeAreaContent ger `warnings`; wizardens steg 3/4
// och "Lägg till"-flödet ritar dem via warningsHtml (teacher-shared.js).
// teacher-*-modulerna drar in Firebase → kontrolleras på källnivå här.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateArea } from "../src/validate.js";
import { mergeAreaContent } from "../src/merge-area.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (f) => readFileSync(join(SRC, f), "utf8");

const PAIRS = [
  { term: "Sol", definition: "Stjärna", category: "fakta" },
  { term: "Måne", definition: "Följeslagare", category: "minne" },
];

test("okänd kategori → ok (spara går) men med varning", () => {
  const res = validateArea({ name: "Rymden", pairs: PAIRS });
  assert.equal(res.ok, true);
  assert.equal(res.warnings.length, 1);
  assert.match(res.warnings[0], /okänd kategori "minne"/);
  const merged = mergeAreaContent({ id: "r", name: "Rymden", pairs: [] }, { pairs: PAIRS });
  assert.equal(merged.ok, true);
  assert.equal(merged.warnings.length, 1);
});

test("varningarna ritas i wizarden (steg 3 + 4) och i Lägg till-flödet", () => {
  assert.match(read("teacher-shared.js"), /export function warningsHtml\(warnings\)/);
  assert.match(read("teacher-shared.js"), /class="msg warn"/);
  const s3 = read("teacher-wizard-steg3.js");
  assert.match(s3, /\$\{warningsHtml\(warnings\)\}/);
  assert.match(s3, /renderSummary\(resultEl, res\.value, [^)]*, res\.warnings\)/);
  assert.match(read("teacher-wizard-steg4.js"), /renderSummary\(resultEl, res\.value, [^)]*, res\.warnings\)/);
  assert.equal((read("teacher-content-merge.js").match(/warningsHtml\(res\.warnings\)/g) || []).length, 2);
});
