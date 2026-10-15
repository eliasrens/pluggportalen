// Områdessidan (#703): "Fortsätt här" (spec §3.3 / §3.7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { continueHereMode } from "../src/plugga-framsteg.js";

const ts = (h) => ({ seconds: Math.floor((Date.UTC(2026, 9, 14) - h * 36e5) / 1000) });
const kort = [{ id: "lasforstaelse" }, { id: "quiz" }, { id: "para" }, { id: "aventyr:skattjakten" }];

test("continueHereMode: senast spelade läget får markeringen", () => {
  const p = { quiz: { stars: 1, lastPlayed: ts(2) }, para: { stars: 2, lastPlayed: ts(30) } };
  assert.equal(continueHereMode(p, kort), "quiz");
});

test("continueHereMode: äventyr räknas också", () => {
  const p = { quiz: { stars: 1, lastPlayed: ts(5) }, "aventyr:skattjakten": { stars: 0, lastPlayed: ts(1) } };
  assert.equal(continueHereMode(p, kort), "aventyr:skattjakten");
});

test("continueHereMode: 3 stjärnor på senaste → ingen markering (ingen fallback)", () => {
  const p = { quiz: { stars: 3, lastPlayed: ts(1) }, para: { stars: 1, lastPlayed: ts(30) } };
  assert.equal(continueHereMode(p, kort), null);
});

test("continueHereMode: låst senaste → ingen markering", () => {
  const p = { quiz: { stars: 1, lastPlayed: ts(1) }, lasforstaelse: { stars: 0, lastPlayed: ts(5) } };
  const k = kort.map((c) => ({ ...c, locked: c.id !== "lasforstaelse" }));
  assert.equal(continueHereMode(p, k), null);
});

test("continueHereMode: inget spelat / tom progress → null", () => {
  assert.equal(continueHereMode({}, kort), null);
  assert.equal(continueHereMode(undefined, kort), null);
  assert.equal(continueHereMode({ quiz: { stars: 2 } }, kort), null);
});

test("continueHereMode: dolt läge (inte bland korten) ignoreras", () => {
  const p = { quiz: { stars: 1, lastPlayed: ts(1) }, para: { stars: 1, lastPlayed: ts(9) } };
  assert.equal(continueHereMode(p, kort.filter((c) => c.id !== "quiz")), "para");
});

test("continueHereMode: Date och millisekunder fungerar som lastPlayed", () => {
  const p = { quiz: { stars: 0, lastPlayed: new Date(2026, 0, 1) }, para: { stars: 0, lastPlayed: Date.UTC(2026, 5, 1) } };
  assert.equal(continueHereMode(p, kort), "para");
});
