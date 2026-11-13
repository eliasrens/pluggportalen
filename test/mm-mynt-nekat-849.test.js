// ============================================================================
// Mattematchen #849 – ett nekat mynt låser inte dagens mynt (F5 från #848).
// Rena tester (node --test, ingen emulator):
//   • myntEfterNekat: taket bara när dagsräknaren säger det; annars försöker
//     nästa rätt svar igen; ihållande nekanden → taket som förut (spärr)
//   • sidan: inget hårt "nekat = taket" kvar, räknaren läses bara i
//     nekat-grenen och bara för samma dag som svaret skickades med
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MYNT_TAK_PER_DAG, MYNT_NEKAT_SPARR, myntEfterNekat, myntForRatt } from "../src/tavling/mm-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("myntEfterNekat", () => {
  it("räknaren vid taket → taket (texten visas)", () => {
    assert.equal(myntEfterNekat({ myntIdag: 12, lasta: 50, nekadeIRad: 1 }), MYNT_TAK_PER_DAG);
    assert.equal(myntEfterNekat({ myntIdag: 49, lasta: 50, nekadeIRad: 1 }), MYNT_TAK_PER_DAG);
    assert.equal(myntForRatt(myntEfterNekat({ myntIdag: 0, lasta: 50, nekadeIRad: 1 })), 0);
  });
  it("fel dag-nyckel vid midnatt (räknaren under taket) → inget tak, nästa svar försöker igen", () => {
    const efter = myntEfterNekat({ myntIdag: 30, lasta: 30, nekadeIRad: 1 });
    assert.equal(efter, 30);
    assert.equal(myntForRatt(efter), 1);
    // klienten före servern: dokumentet för "nya" dagen finns inte än
    assert.equal(myntEfterNekat({ myntIdag: 0, lasta: 0, nekadeIRad: 1 }), 0);
  });
  it("annan flik har tjänat mer under taket → serverns tal (aldrig lägre än lokalt)", () => {
    assert.equal(myntEfterNekat({ myntIdag: 10, lasta: 37, nekadeIRad: 1 }), 37);
    assert.equal(myntEfterNekat({ myntIdag: 10, lasta: 4, nekadeIRad: 1 }), 10);
  });
  it("läsningen misslyckades → oförändrat (inget falskt tak)", () => {
    assert.equal(myntEfterNekat({ myntIdag: 17, lasta: null, nekadeIRad: 1 }), 17);
    assert.equal(myntEfterNekat({ myntIdag: 17, lasta: undefined, nekadeIRad: 1 }), 17);
  });
  it("skräpvärden tolkas som 0", () => {
    assert.equal(myntEfterNekat({ myntIdag: undefined, lasta: "x", nekadeIRad: 1 }), 0);
  });
  it("ihållande nekanden utan förklaring → taket efter spärren (som före #849)", () => {
    assert.ok(MYNT_NEKAT_SPARR >= 3, "spärren får inte slå till vid ett par midnattsnekanden");
    for (let n = 1; n < MYNT_NEKAT_SPARR; n++) {
      assert.equal(myntEfterNekat({ myntIdag: 5, lasta: 5, nekadeIRad: n }), 5, `n=${n}`);
    }
    assert.equal(myntEfterNekat({ myntIdag: 5, lasta: 5, nekadeIRad: MYNT_NEKAT_SPARR }), MYNT_TAK_PER_DAG);
    assert.equal(myntEfterNekat({ myntIdag: 5, lasta: null, nekadeIRad: MYNT_NEKAT_SPARR }), MYNT_TAK_PER_DAG);
  });
});

describe("page-mattematchen.js efter #849", () => {
  const src = readFileSync(join(ROOT, "src/tavling/page-mattematchen.js"), "utf8");
  it("inget hårt 'nekat = taket' kvar", () => {
    assert.ok(!/myntBetalt\s*\?\s*myntIdag\s*\+\s*1\s*:\s*MYNT_TAK_PER_DAG/.test(src));
    assert.ok(!/myntIdag\s*=\s*MYNT_TAK_PER_DAG/.test(src));
  });
  it("räknaren läses bara efter nekat mynt, för svarets dag, och beslutet tas av myntEfterNekat", () => {
    const anrop = src.match(/loadMyntIdag\(/g) || [];
    assert.equal(anrop.length, 2, "en gång när sidan öppnas + en gång i nekat-grenen");
    const gren = /\} else if \(mynt && mynt\.dag === dag\) \{([\s\S]*?)\n {8}\}/.exec(src);
    assert.ok(gren, "nekat-grenen finns och gäller bara samma dag");
    assert.ok(gren[1].includes("loadMyntIdag(uid, mynt.dag)"));
    assert.ok(gren[1].includes("myntEfterNekat({ myntIdag, lasta, nekadeIRad })"));
    assert.ok(gren[1].includes("if (mynt.dag !== dag) return;"), "dagbyte under läsningen ignoreras");
  });
  it("dagbyte nollar även nekat-räknaren", () => {
    assert.ok(src.includes("if (dagNu !== dag) { dag = dagNu; myntIdag = 0; nekadeIRad = 0; visaMynt(); }"));
  });
  it("filerna håller 400-radersgränsen", () => {
    for (const f of ["src/tavling/mm-config.js", "src/tavling/page-mattematchen.js", "src/tavling/mm-data.js",
      "test/mm-mynt-nekat-849.test.js"]) {
      assert.ok(readFileSync(join(ROOT, f), "utf8").split("\n").length <= 401, `${f} ≤ 400 rader`);
    }
  });
});
