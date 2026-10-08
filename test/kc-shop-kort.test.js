// Klasscentret i shoppen (#488): beloppsgränser, snabbval, kortens HTML
// (mätare, Donera/Köpt, anonymitet), kroken i pages-shop.js och bootgrafen.
// Körs med: node --test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";
import {
  SNABBVAL, donationsGrans, klampaBelopp, snabbvalLista, kortHtml, matareHtml, handlingHtml, panelHtml,
} from "../src/klasscenter/kc-shop-kort.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const staty = kcShopItem("guldstaty");
const fund = (fundedAmount, extra = {}) => ({ itemId: "guldstaty", targetPrice: 5000, fundedAmount, isUnlocked: false, ...extra });
const nbsp = (s) => s.replace(/ /g, " ");

describe("donationsGrans + klampaBelopp", () => {
  it("max = min(saldo, det som saknas)", () => {
    assert.deepEqual(donationsGrans(fund(150), 1000), { saknas: 4850, max: 1000, kopt: false });
    assert.deepEqual(donationsGrans(fund(4970), 1000), { saknas: 30, max: 30, kopt: false });
    assert.deepEqual(donationsGrans(fund(0), 0), { saknas: 5000, max: 0, kopt: false });
  });
  it("köpt vid 100 % eller isUnlocked → max 0", () => {
    assert.equal(donationsGrans(fund(5000, { isUnlocked: true }), 900).kopt, true);
    assert.equal(donationsGrans(fund(5000), 900).max, 0);
  });
  it("fältet klampas till 1..max, skräp → 0", () => {
    assert.equal(klampaBelopp(80, 30), 30);
    assert.equal(klampaBelopp("12.7", 100), 12);
    assert.equal(klampaBelopp(0, 100), 0);
    assert.equal(klampaBelopp(-5, 100), 0);
    assert.equal(klampaBelopp("abc", 100), 0);
  });
});

describe("snabbval", () => {
  it("10/50/100/500, de över max avstängda", () => {
    assert.deepEqual(SNABBVAL, [10, 50, 100, 500]);
    const l = snabbvalLista({ saknas: 4850, max: 70 });
    assert.deepEqual(l.map((c) => [c.belopp, c.av]), [[10, false], [50, false], [100, true], [500, true]]);
  });
  it("lite kvar → 'Resten' så mätaren kan fyllas exakt", () => {
    const l = snabbvalLista({ saknas: 30, max: 30 });
    assert.equal(l.at(-1).belopp, 30);
    assert.match(l.at(-1).etikett, /Resten/);
    // har eleven inte råd med resten visas den inte
    assert.equal(snabbvalLista({ saknas: 30, max: 20 }).length, 4);
  });
});

describe("kortens HTML", () => {
  it("mätaren: '150 / 5 000 mynt insamlade' + bredd i procent", () => {
    const h = nbsp(matareHtml(fund(150)));
    assert.match(h, /<b>150<\/b> \/ 5 000 mynt insamlade/);
    assert.match(h, /width:3%/);
    assert.doesNotMatch(h, /bidragit/);
    assert.match(nbsp(matareHtml(fund(150), 100)), /Du har bidragit med 100 mynt/);
  });
  it("Donera-knapp, avstängd utan mynt, 'Köpt!' vid 100 %", () => {
    assert.match(handlingHtml(fund(150), 100), /kcs-donera/);
    assert.match(handlingHtml(fund(150), 0), /disabled/);
    const kopt = handlingHtml(fund(5000, { isUnlocked: true }), 100);
    assert.match(kopt, /Köpt! Finns i klassens möbellåda/);
    assert.doesNotMatch(kopt, /<button/);
  });
  it("panelen: 'bara X saknas', fältets max och skänk-knappen", () => {
    const h = nbsp(panelHtml({ saknas: 30, max: 30 }, 50));
    assert.match(h, /Bara <b>30<\/b> mynt saknas/);
    assert.match(h, /max="30"/);
    assert.match(h, /value="30"/); // 50 klampat till 30
    assert.match(h, /Skänk 30/);
    assert.match(panelHtml({ saknas: 30, max: 30 }, 0), /kcs-skank" disabled/);
  });
  it("kortet: konst eller emoji, namn, mål, data-kc; inga donatorer (anonymt)", () => {
    const h = nbsp(kortHtml(staty, fund(100), { coins: 50, bild: "<svg></svg>" }));
    assert.match(h, /data-kc="guldstaty"/);
    assert.match(h, /<svg><\/svg>/);
    assert.match(h, /Guldstaty/);
    assert.match(h, /Mål: 5 000 mynt/);
    assert.match(h, /<b>100<\/b> \/ 5 000/);
    assert.doesNotMatch(h, /uid|donator|topplista/i);
    assert.match(kortHtml(staty, fund(0)), /🗿/);
    assert.match(kortHtml(staty, fund(5000, { isUnlocked: true })), /is-owned/);
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

describe("kroken i shoppen (#271)", () => {
  it("vyn, korten och konsten ligger utanför bootgrafen", () => {
    const g = staticBootGraph();
    assert.ok(g.has(join(SRC, "pages-shop.js")), "BFS:en hittar shoppen");
    for (const f of ["klasscenter/kc-shop-vy.js", "klasscenter/kc-shop-kort.js", "art-klasscenter-inredning.js"]) {
      assert.equal(g.has(join(SRC, f)), false, `${f} får inte ligga i bootgrafen`);
    }
  });
  it("pages-shop.js laddar vyn med import() och håller sig under 400 rader", () => {
    const src = readFileSync(join(SRC, "pages-shop.js"), "utf8");
    assert.match(src, /import\("\.\/klasscenter\/kc-shop-vy\.js"\)/);
    assert.ok(src.split("\n").length <= 400);
    for (const f of ["kc-shop-vy.js", "kc-shop-kort.js"]) {
      assert.ok(readFileSync(join(SRC, "klasscenter", f), "utf8").split("\n").length <= 400, f);
    }
  });
});
