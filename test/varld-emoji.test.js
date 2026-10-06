// G1 (#425): emoji-reserven – osynliga emoji-glyfer i spegelns SVG (ren sträng).
import { test } from "node:test";
import assert from "node:assert/strict";

const satt = (v) => Object.defineProperty(globalThis, "localStorage", {
  configurable: true, value: { getItem: (k) => (k === "pp:pixi:emoji" ? v : null) },
});
const { doljEmoji, emojiLage, emojiNyckel } = await import("../src/varld-emoji.js");

test("emojiLage: flaggan styr, auto = svg tills detektionen sagt annat", () => {
  satt(null);
  assert.equal(emojiLage(), "svg");
  satt("text");
  assert.equal(emojiLage(), "text");
  assert.equal(emojiNyckel(), "|emoji-text");
  satt("svg");
  assert.equal(emojiNyckel(), "");
});

test("doljEmoji: bara textinnehåll i <text>, layouten kvar (tspan), ny nyckel", () => {
  satt("text");
  const s = { svg: '<svg><style>.a{}</style><text x="1" y="2" fill="#000">Hej 🍎 du 👩‍👩‍👧 🇸🇪<tspan dx="1">🔒</tspan> 1️⃣ ✨ ok</text><title>🍎</title></svg>', nyckel: "k", w: 1 };
  const d = doljEmoji(s);
  const D = (e) => `<tspan fill-opacity="0" stroke-opacity="0">${e}</tspan>`;
  assert.equal(d.svg, `<svg><style>.a{}</style><text x="1" y="2" fill="#000">Hej ${D("🍎")} du ${D("👩‍👩‍👧")} ${D("🇸🇪")}<tspan dx="1">${D("🔒")}</tspan> ${D("1️⃣")} ${D("✨")} ok</text><title>🍎</title></svg>`);
  assert.equal(d.nyckel, "k|emoji-text");
  assert.equal(d.w, 1);
  // Utan emoji / i svg-läge: samma objekt.
  const utan = { svg: "<svg><text>Hej</text></svg>", nyckel: "x" };
  assert.equal(doljEmoji(utan), utan);
  satt("svg");
  assert.equal(doljEmoji(s), s);
});
