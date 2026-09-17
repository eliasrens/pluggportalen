// ============================================================================
// Enhetstest för bildstöds-renderingsmodulen (issue #319, src/matte-bildstod.js)
// ----------------------------------------------------------------------------
// Verifierar:
//   1. ANTAL: renderar exakt rows × cols prickar (circle) för ett behörigt
//      array/rutnäts-problem, mot en minimal fejk-DOM.
//   2. VETO: bildstodEligible === false → inget renderas (null). Likaså saknade
//      rows/cols, fel type och orimligt stora rutnät.
//   3. DETERMINISM: samma problem → identisk markup, och sträng- och DOM-vägen
//      beskriver samma struktur.
//   4. GRUPP: division ritar en gruppram per rad (rows st).
//   5. BOOT-SÄKERHET: modulen ligger UTANFÖR den statiska bootgrafen från
//      src/app.js (reachability-scan över statiska import-satser).
//
// Körs med Node:s inbyggda testkörare:  node --test test/matte-bildstod.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { renderBildstod, isBildstodEligible } from "../src/matte-bildstod.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src");

// --- Minimal fejk-DOM -------------------------------------------------------
// Bara det renderBildstod faktiskt rör: createElementNS + setAttribute +
// appendChild. Elementen bokför sin tagName och sina barn så vi kan räkna dem.
class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.childNodes = [];
    this._attrs = {};
  }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(child) { this.childNodes.push(child); return child; }
  // Räkna alla ättlingar (inkl. sig själv) med en given tagg.
  count(tag) {
    let n = this.tagName === tag ? 1 : 0;
    for (const c of this.childNodes) n += c.count(tag);
    return n;
  }
}
const fakeDoc = { createElementNS: (_ns, tag) => new FakeEl(tag) };

// Bekväm problem-fabrik (matchar generatorns fältnamn).
function prob(over = {}) {
  return { type: "multiplikation", operator: "·", a: 3, b: 4, answer: 12, rows: 3, cols: 4, ...over };
}

// --- 1. Antal element -------------------------------------------------------
test("renderar exakt rows × cols prickar (circle) mot fejk-DOM", () => {
  for (const [rows, cols] of [[2, 2], [3, 4], [5, 7], [1, 9]]) {
    const svg = renderBildstod(prob({ rows, cols }), { document: fakeDoc });
    assert.ok(svg, `förväntade ett element för ${rows}×${cols}`);
    assert.equal(svg.tagName, "svg");
    assert.equal(svg.count("circle"), rows * cols, `fel antal prickar för ${rows}×${cols}`);
  }
});

test("sträng-vägen renderar lika många <circle> som DOM-vägen", () => {
  const p = prob({ rows: 4, cols: 6 });
  const markup = renderBildstod(p);
  assert.equal(typeof markup, "string");
  const circles = (markup.match(/<circle/g) || []).length;
  assert.equal(circles, 24);
  assert.ok(markup.startsWith("<svg"));
  assert.ok(markup.includes('width="100%"'));
});

// --- 2. Veto ----------------------------------------------------------------
test("bildstodEligible === false → inget renderas (null)", () => {
  assert.equal(renderBildstod(prob({ bildstodEligible: false }), { document: fakeDoc }), null);
  assert.equal(renderBildstod(prob({ bildstodEligible: false })), null);
  assert.equal(isBildstodEligible(prob({ bildstodEligible: false })), false);
});

test("saknade/ogiltiga rows|cols, fel type och för stort rutnät → null", () => {
  assert.equal(renderBildstod(prob({ rows: undefined })), null);
  assert.equal(renderBildstod(prob({ cols: 0 })), null);
  assert.equal(renderBildstod(prob({ rows: 2.5 })), null);
  assert.equal(renderBildstod(prob({ type: "addition" })), null);
  assert.equal(renderBildstod(prob({ rows: 20, cols: 20 })), null); // > MAX_DIM
  assert.equal(renderBildstod(null), null);
  assert.equal(renderBildstod(undefined), null);
});

test("bild-mult (bildstodEligible undefined) renderas ändå", () => {
  const p = { type: "multiplikation", operator: "·", a: 4, b: 5, answer: 20,
              questionType: "bild-mult", rows: 4, cols: 5 };
  const svg = renderBildstod(p, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(svg.count("circle"), 20);
});

// --- 3. Determinism ---------------------------------------------------------
test("deterministisk: samma problem → identisk markup", () => {
  const a = renderBildstod(prob({ rows: 3, cols: 5 }));
  const b = renderBildstod(prob({ rows: 3, cols: 5 }));
  assert.equal(a, b);
});

// --- 4. Gruppmodell för division -------------------------------------------
test("division ritar en gruppram (rect) per rad + rows×cols prickar", () => {
  // 12 ÷ 3 = 4 → rows(=divisor)=3 grupper om cols(=kvot)=4.
  const p = { type: "division", operator: "division", a: 12, b: 3, answer: 4,
              bildstodEligible: true, rows: 3, cols: 4 };
  const svg = renderBildstod(p, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(svg.count("circle"), 12);
  assert.equal(svg.count("rect"), 3, "en gruppram per rad");
});

test("multiplikation ritar INGA gruppramar (rena array-prickar)", () => {
  const svg = renderBildstod(prob({ rows: 3, cols: 4 }), { document: fakeDoc });
  assert.equal(svg.count("rect"), 0);
});

// --- 5. Boot-säkerhet: utanför statiska bootgrafen från app.js --------------
// Reachability-scan: följ BARA statiska `import ... from "..."`/bare-imports
// (inte dynamiska import()) från src/app.js och säkra att matte-bildstod.js
// aldrig nås. Skulle någon boot-nådd fil statiskt importera den faller det här
// (jfr #271/#290: nya filer i bootgrafen = risk för vit sida vid deploy).
test("matte-bildstod.js ligger UTANFÖR den statiska bootgrafen från app.js", () => {
  const staticImportRe = /^\s*import\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = readFileSync(resolve(SRC, rel), "utf8"); }
    catch { continue; }
    let m;
    while ((m = staticImportRe.exec(code))) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // skippa bara-namn / URL
      const target = resolve(dirname(resolve(SRC, rel)), spec);
      queue.push(target.slice(SRC.length + 1)); // relativt src/
    }
  }
  assert.ok(
    !seen.has("matte-bildstod.js"),
    "matte-bildstod.js får inte vara statiskt nåbar från src/app.js"
  );
});
