// ============================================================================
// Klasscentret – lärarsektionen (#491): urbockning → inredningSparr,
// donatorer per föremål, insamlings- och historiklistorna, bootgrafen.
// Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  elevNamn, sparrUrBockning, donatorerPerForemal, inredningHtml, insamlingHtml, historikHtml,
} from "../src/klasscenter/kc-larare.js";
import { KC_SHOP_ITEMS } from "../src/klasscenter/kc-shop-items.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const elever = [{ id: "a", namn: "Alva" }, { id: "b", username: "bosse" }, { id: "c" }];

describe("kc-larare", () => {
  it("elevNamn: namn → användarnamn → id", () => {
    assert.deepEqual(elever.map(elevNamn), ["Alva", "bosse", "c"]);
  });

  it("sparrUrBockning: urbockade klasselever, sorterade och unika", () => {
    assert.deepEqual(sparrUrBockning(elever, ["a", "b", "c"]), []);
    assert.deepEqual(sparrUrBockning(elever, ["b"]), ["a", "c"]);
    assert.deepEqual(sparrUrBockning(elever, new Set(["a", "x"])), ["b", "c"]);
    assert.deepEqual(sparrUrBockning([...elever, { id: "a" }], []), ["a", "b", "c"]);
  });

  it("donatorerPerForemal: summerar per elev, störst först, hoppar trasiga poster", () => {
    const m = donatorerPerForemal([
      { uid: "a", itemId: "lounge", amount: 50 },
      { uid: "b", itemId: "lounge", amount: 200 },
      { uid: "a", itemId: "lounge", amount: 300 },
      { uid: "b", itemId: "flygel", amount: 10 },
      { itemId: "lounge", amount: 999 },
      null,
    ]);
    assert.deepEqual(m.get("lounge"), [{ uid: "a", summa: 350, antal: 2 }, { uid: "b", summa: 200, antal: 1 }]);
    assert.deepEqual(m.get("flygel"), [{ uid: "b", summa: 10, antal: 1 }]);
    assert.equal(m.has("akvarium"), false);
  });

  it("inredningHtml: förifyllt utom bockade", () => {
    const h = inredningHtml(elever, ["b"]);
    assert.match(h, /data-kc-inreda="a" checked/);
    assert.match(h, /data-kc-inreda="b" \/>/);
    assert.match(h, /data-kc-inreda="c" checked/);
    assert.match(inredningHtml([], []), /inga elever/);
  });

  it("insamlingHtml: alla föremål, Köpt, namn och belopp", () => {
    const funds = {
      lounge: { itemId: "lounge", fundedAmount: 3000, targetPrice: 3000, isUnlocked: true },
      flygel: { itemId: "flygel", fundedAmount: 1500, targetPrice: 6000, isUnlocked: false },
    };
    const h = insamlingHtml(funds, [
      { uid: "a", itemId: "lounge", amount: 3000 },
      { uid: "b", itemId: "flygel", amount: 1000 },
      { uid: "b", itemId: "flygel", amount: 500 },
    ], (u) => (u === "a" ? "Alva <3" : "Bosse"));
    assert.equal((h.match(/data-kc-item=/g) || []).length, KC_SHOP_ITEMS.length);
    const rad = (id) => h.split(`data-kc-item="${id}"`)[1].split("</li>")[0];
    assert.match(rad("lounge"), /Köpt/);
    assert.match(rad("lounge"), /Alva &lt;3/);
    assert.match(rad("flygel"), /25 %/);
    assert.match(rad("flygel"), /Bosse <b>1\s500<\/b> mynt <span class="hint">\(2 gånger\)/);
    assert.match(rad("akvarium"), /Inga donationer än/);
    assert.match(rad("akvarium"), /ej påbörjad/);
  });

  it("historikHtml: vem/när, Återställ bara på de som inte visas nu", () => {
    const nu = new Date(2026, 9, 7, 15, 0);
    const poster = [
      { slot: 3, version: 3, savedBy: "a", savedAt: new Date(2026, 9, 7, 14, 5), placedItems: { lounge: {} } },
      { slot: 2, version: 2, savedBy: "t", savedAt: new Date(2026, 9, 6, 9, 30), placedItems: { lounge: {}, flygel: {} } },
    ];
    const h = historikHtml(poster, { aktuellVersion: 3, namnFor: (u) => (u === "a" ? "Alva" : "du (lärare)"), nu });
    assert.match(h, /idag 14:05/);
    assert.match(h, /igår 09:30/);
    assert.match(h, /Alva/);
    assert.match(h, /1 sak/);
    assert.match(h, /2 saker/);
    assert.match(h, /Visas nu/);
    assert.equal((h.match(/data-kc-aterstall=/g) || []).length, 1);
    assert.match(h, /data-kc-aterstall="2"/);
    assert.match(historikHtml([], {}), /Ingen har sparat/);
  });
});

it("bootgrafen: lärarsektionen bara dynamiskt (#271)", () => {
  const g = staticBootGraph();
  for (const f of ["teacher-class-klasscenter.js", join("klasscenter", "kc-larare.js")]) {
    assert.equal(g.has(join(SRC, f)), false, `${f} får inte ligga i bootgrafen`);
  }
  assert.ok(g.size > 50, "BFS hittade bootgrafen");
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
