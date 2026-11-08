// ============================================================================
// Slut-QA Meteorstormen (#825, TESTAREN): Statistik → Live i 375 px.
// Kärnans tabeller i lärarens Live-historik (teacher-live-history.js – alla
// format) fick sidan att scrolla i sidled på en telefon: "Matcher"-tabellen
// har formatets kolumner (Meteorstormen: Rätt · Skrov · Utfall) och blev
// 538 px bred. Varje tabell ligger nu i .table-scroll (overflow-x: auto),
// som formatets egna tabeller i .msh-scroll (#824).
// ============================================================================
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const kod = readFileSync(new URL("../src/live/teacher-live-history.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const preview = readFileSync(new URL("../preview/preview-meteorstorm-historik.html", import.meta.url), "utf8");

describe("Live-historiken i 375 px (testaren #825)", () => {
  it("varje live-table i kärnans historik ligger i en .table-scroll", () => {
    const tabeller = [...kod.matchAll(/<table class="live-table"/g)];
    assert.ok(tabeller.length >= 3, "matchdetaljens elevtabell + Matcher + Elever");
    for (const m of tabeller) {
      assert.match(kod.slice(m.index - 40, m.index), /<div class="table-scroll">\s*$/, `tabellen vid tecken ${m.index}`);
    }
    assert.equal((kod.match(/<div class="table-scroll">/g) || []).length, tabeller.length);
  });

  it(".table-scroll scrollar i sidled (finns i den byggda styles.css)", () => {
    assert.match(css, /\.table-scroll\s*\{\s*overflow-x:\s*auto;/);
  });

  it("förhandsvisningen speglar kärnans Matcher-tabell", () => {
    assert.match(preview, /<div class="table-scroll"><table class="live-table"><thead><tr><th>Match<\/th>/);
  });
});
