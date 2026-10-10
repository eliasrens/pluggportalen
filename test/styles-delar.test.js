// ============================================================================
// #570: src/styles.css är uppdelad per område i src/styles/NN-*.css och
// byggs ihop av admin/bygg-styles.mjs. Testet fäller en styles.css som glidit
// isär från delarna, en del som klipper mitt i ett block, och en boot-kedja
// som plötsligt laddar delarna direkt (nya filer i boot = #271-risken).
// ============================================================================

import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DELAR, UT, byggStyles, delar } from "../admin/bygg-styles.mjs";

it("src/styles.css är byggd av src/styles/ (kör npm run build:css)", () => {
  assert.ok(delar().length >= 20, "delarna saknas");
  assert.equal(readFileSync(UT, "utf8"), byggStyles());
});

it("delarna har unika nummer så laddningsordningen är entydig", () => {
  const nr = delar().map((f) => f.slice(0, 2));
  assert.equal(new Set(nr).size, nr.length);
});

/** Djup-skanning som hoppar över kommentarer och strängar. */
function blockDjup(css) {
  let djup = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const slut = css.indexOf("*/", i + 2);
      assert.ok(slut > 0, "oavslutad kommentar");
      i = slut + 1;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (css[j] !== c) j += css[j] === "\\" ? 2 : 1;
      i = j;
    } else if (c === "{") djup++;
    else if (c === "}") {
      djup--;
      assert.ok(djup >= 0, "fler } än {");
    }
  }
  return djup;
}

it("varje del är fristående: inga block eller kommentarer delas över filgränser", () => {
  for (const f of delar()) {
    assert.equal(blockDjup(readFileSync(join(DELAR, f), "utf8")), 0, f);
  }
});

it("boot-kedjan är oförändrad: sidorna länkar bara src/styles.css, inga @import", () => {
  for (const sida of ["../index.html", "../seed/seed.html"]) {
    const html = readFileSync(new URL(sida, import.meta.url), "utf8");
    assert.match(html, /href="\.\.?\/src\/styles\.css"/, sida);
    assert.doesNotMatch(html, /src\/styles\//, sida);
  }
  assert.doesNotMatch(readFileSync(UT, "utf8"), /@import/);
});
