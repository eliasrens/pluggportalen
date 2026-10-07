// Live-projektorn (#461): visuell komprimering – bara grafik, aldrig resultatet.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compressRatio, rocketHeights, tugShift, classColor, CLASS_COLORS, ROCKET_START, ROCKET_TOP, TUG_MAX,
} from "../src/live/proj-scale.js";

describe("Raketrace: komprimerade höjder", () => {
  it("ingen poäng än → alla på startplattan", () => {
    assert.deepEqual(rocketHeights([0, 0], 0.5), [0, 0]);
  });

  it("ledaren stiger med matchtiden och når toppen vid 00:00", () => {
    assert.equal(rocketHeights([5, 4], 0)[0], ROCKET_START);
    assert.equal(rocketHeights([5, 4], 1)[0], ROCKET_TOP);
    assert.ok(rocketHeights([5, 4], 0.5)[0] < ROCKET_TOP);
  });

  it("20 % högre poäng ger INTE 20 % högre raket (√-komprimering)", () => {
    const [lead, other] = rocketHeights([20.3 * 1.2, 20.3], 1);
    const gap = 1 - other / lead;
    assert.ok(gap > 0 && gap < 0.1, `gap ${gap}`);
  });

  it("ordningen bevaras: högre poäng → aldrig lägre raket", () => {
    const h = rocketHeights([10, 3, 7, 0], 0.7);
    assert.ok(h[0] > h[2] && h[2] > h[1] && h[1] > h[3]);
    assert.equal(h[3], 0);
  });

  it("tål trasiga värden", () => {
    assert.deepEqual(rocketHeights([NaN, -1, 2], 2).map((v) => v >= 0), [true, true, true]);
    assert.equal(compressRatio(4), 1);
    assert.equal(compressRatio(0.25), 0.5);
  });
});

describe("Dragkamp: mittmarkören", () => {
  it("lika = mitten, vänster leder = positiv", () => {
    assert.equal(tugShift(10, 10), 0);
    assert.equal(tugShift(0, 0), 0);
    assert.ok(tugShift(12, 10) > 0);
    assert.ok(tugShift(10, 12) < 0);
    assert.equal(tugShift(12, 10), -tugShift(10, 12));
  });

  it("stora ledningar komprimeras – markören når aldrig ända fram", () => {
    assert.ok(Math.abs(tugShift(100, 0) - TUG_MAX) < 1e-9);
    assert.ok(tugShift(30, 10) < TUG_MAX);
    assert.ok(tugShift(30, 10) - tugShift(20, 10) < tugShift(20, 10) - tugShift(10, 10));
  });
});

describe("klassfärger", () => {
  it("roterar och tål index utanför listan", () => {
    assert.equal(classColor(0), CLASS_COLORS[0]);
    assert.equal(classColor(CLASS_COLORS.length), CLASS_COLORS[0]);
    assert.equal(classColor(-1), CLASS_COLORS[CLASS_COLORS.length - 1]);
  });
});
