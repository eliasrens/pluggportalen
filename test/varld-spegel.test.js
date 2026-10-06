// Rena delar av världsspeglingen (#416, F2 i epic #396): CSS-parsning, filter,
// font-CSS, hash och granskning. DOM-delarna verifieras i preview-varld-spegel.html.
import { test } from "node:test";
import assert from "node:assert/strict";
import { delaKomma, tolkaSkugga, radie, filterPrimitiver } from "../src/varld-spegel-html.js";
import { tolkaFontCss } from "../src/varld-spegel-font.js";
import { hash, granska } from "../src/varld-spegel-ut.js";

test("delaKomma delar bara på toppnivå", () => {
  assert.deepEqual(delaKomma("rgba(0, 0, 0, 0.2) 0px 1px, red 2px 3px"), ["rgba(0, 0, 0, 0.2) 0px 1px", "red 2px 3px"]);
  assert.deepEqual(delaKomma("linear-gradient(color-mix(in srgb, red 50%, blue) 0%, red 100%)"), ["linear-gradient(color-mix(in srgb, red 50%, blue) 0%, red 100%)"]);
});

test("tolkaSkugga läser computed box-shadow/drop-shadow", () => {
  assert.deepEqual(tolkaSkugga("rgba(59, 51, 80, 0.18) 0px 4px 10px 0px"),
    { farg: "rgba(59, 51, 80, 0.18)", x: 0, y: 4, blur: 10, spread: 0, inset: false });
  assert.equal(tolkaSkugga("rgb(0, 0, 0) 1px 2px 3px 0px inset").inset, true);
});

test("radie klampas som i CSS (999px-piller, procent)", () => {
  assert.deepEqual(radie({ borderTopLeftRadius: "999px" }, 80, 20), { rx: 10, ry: 10 });
  assert.deepEqual(radie({ borderTopLeftRadius: "50%" }, 28, 28), { rx: 14, ry: 14 });
  assert.equal(radie({ borderTopLeftRadius: "0px" }, 10, 10), null);
});

test("filterPrimitiver: grayscale + brightness kedjas, none ger null", () => {
  const p = filterPrimitiver("grayscale(0.35) brightness(0.97)");
  assert.match(p, /^<feColorMatrix type="matrix" values="[^"]+"\/><feComponentTransfer>/);
  assert.match(p, /slope="0.97"/);
  assert.equal(filterPrimitiver("none"), null);
});

test("tolkaFontCss tar latin + latin-ext och hoppar över andra subset", () => {
  const css = `/* devanagari */
@font-face { font-family: 'Baloo 2'; font-weight: 400; src: url(https://x/dev.woff2) format('woff2'); unicode-range: U+0900-097F; }
/* latin-ext */
@font-face { font-family: 'Baloo 2'; font-weight: 400; src: url(https://x/ext.woff2) format('woff2'); unicode-range: U+0100-02BA; }
/* latin */
@font-face { font-family: 'Baloo 2'; font-weight: 800; src: url(https://x/lat.woff2) format('woff2'); unicode-range: U+0000-00FF; }`;
  assert.deepEqual(tolkaFontCss(css), [
    { url: "https://x/ext.woff2", vikt: 400, range: "U+0100-02BA" },
    { url: "https://x/lat.woff2", vikt: 800, range: "U+0000-00FF" },
  ]);
});

test("hash är stabil och skiljer innehåll", () => {
  assert.equal(hash("<svg/>"), hash("<svg/>"));
  assert.notEqual(hash('<rect fill="#F49E4C"/>'), hash('<rect fill="#58C6A9"/>'));
});

test("granska hittar foreignObject och externa URL:er, men inte data-URL:er", () => {
  assert.deepEqual(granska('<svg><image href="data:image/png;base64,AA"/></svg>'), { fo: 0, externa: 0 });
  assert.deepEqual(granska('<svg><foreignObject/><image href="https://x/a.png"/><rect fill="url(\'//x/y\')"/></svg>'), { fo: 1, externa: 2 });
});
