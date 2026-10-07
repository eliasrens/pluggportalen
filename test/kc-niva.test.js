// Klasscentret nivåtrappa (#477): trösklar, normalisering per elev, mätartext.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NIVAER, MAX_NIVA, TROSKLAR_PER_ELEV, troskelFor, nivaFor, progressTillNasta, matarText,
} from "../src/klasscenter/kc-niva.js";

describe("nivåerna", () => {
  it("10 nivåer i specens ordning, unika id:n", () => {
    assert.equal(MAX_NIVA, 10);
    assert.deepEqual(NIVAER.map((n) => n.namn), [
      "Lägereld", "Tält", "Träkoja", "Timmerstuga", "Stenbyhus",
      "Rådhus", "Borg", "Slott", "Högkvarter", "Kristallpalats",
    ]);
    assert.deepEqual(NIVAER.map((n) => n.niva), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(new Set(NIVAER.map((n) => n.id)).size, 10);
  });
});

describe("trösklarna", () => {
  it("börjar på 0 och är strikt växande", () => {
    assert.equal(TROSKLAR_PER_ELEV[0], 0);
    for (let i = 1; i < TROSKLAR_PER_ELEV.length; i++) {
      assert.ok(TROSKLAR_PER_ELEV[i] > TROSKLAR_PER_ELEV[i - 1], `nivå ${i + 1}`);
    }
  });

  it("stegen växer exponentiellt (varje steg ~1,5× förra, sista ≥ 20× första)", () => {
    const steg = TROSKLAR_PER_ELEV.slice(1).map((t, i) => t - TROSKLAR_PER_ELEV[i]);
    for (let i = 1; i < steg.length; i++) {
      const kvot = steg[i] / steg[i - 1];
      assert.ok(kvot > 1.35 && kvot < 1.7, `steg ${i}: kvot ${kvot}`);
    }
    assert.ok(steg.at(-1) >= 20 * steg[0]);
  });

  it("brant trappa: 8 övningar/elev/vecka → Nivå 2 efter vecka 1, Nivå 7–8 under läsåret, Nivå 10 först efter läsåret", () => {
    const elever = 25;
    const veckaFor = (niva) => {
      for (let v = 1; v <= 60; v++) if (nivaFor(8 * v * elever, elever) >= niva) return v;
      return Infinity;
    };
    assert.equal(veckaFor(2), 1);
    assert.ok(veckaFor(8) <= 36, `nivå 8 vecka ${veckaFor(8)}`);
    assert.ok(veckaFor(10) > 36, `nivå 10 vecka ${veckaFor(10)}`);
  });

  it("nivå 10 nås inte trivialt: halva takten (4/vecka) ett helt läsår räcker inte", () => {
    assert.ok(nivaFor(4 * 36 * 20, 20) < 10);
    assert.deepEqual([...TROSKLAR_PER_ELEV], [0, 7, 17, 32, 55, 90, 141, 219, 335, 509]);
    assert.equal(nivaFor(troskelFor(10, 20) - 1, 20), 9);
    assert.equal(nivaFor(troskelFor(10, 20), 20), 10);
  });

  it("nivåFor är monoton i EXP och klamrar skräp", () => {
    let forra = 1;
    for (let exp = 0; exp <= 600 * 24; exp += 7) {
      const n = nivaFor(exp, 24);
      assert.ok(n >= forra);
      forra = n;
    }
    assert.equal(nivaFor(-50, 20), 1);
    assert.equal(nivaFor("skräp", 20), 1);
    assert.equal(nivaFor(1e9, 20), 10);
  });
});

describe("normalisering per elev", () => {
  it("14 och 28 elever i samma takt per elev har samma nivå och samma andel", () => {
    for (const perElev of [0, 3, 7, 20, 50, 100, 150, 200, 269, 270, 400, 508, 509, 700]) {
      const a = progressTillNasta(perElev * 14, 14);
      const b = progressTillNasta(perElev * 28, 28);
      assert.equal(a.niva, b.niva, `${perElev}/elev`);
      assert.ok(Math.abs(a.andel - b.andel) < 0.02, `${perElev}/elev andel`);
    }
  });

  it("dubbla klassen behöver dubbelt så många övningar till samma nivå", () => {
    assert.equal(troskelFor(5, 28), 2 * troskelFor(5, 14));
    assert.equal(nivaFor(troskelFor(3, 14), 28), 2);
  });

  it("elevantal 0/okänt räknas som 1", () => {
    assert.equal(troskelFor(2, 0), troskelFor(2, 1));
    assert.equal(nivaFor(7, undefined), 2);
  });
});

describe("progress-mätaren", () => {
  it("50 / 175 övningar till Nivå 2 (25 elever)", () => {
    const p = progressTillNasta(50, 25);
    assert.deepEqual(
      { niva: p.niva, nuvarande: p.nuvarande, mal: p.mal, kvar: p.kvar, nasta: p.nasta, max: p.max },
      { niva: 1, nuvarande: 50, mal: 175, kvar: 125, nasta: 2, max: false }
    );
    assert.equal(p.nastaNamn, "Tält");
    assert.equal(matarText(p), "50 / 175 övningar till Nivå 2");
  });

  it("precis på tröskeln → nästa nivå, mätaren räknar mot nästa", () => {
    const p = progressTillNasta(175, 25);
    assert.equal(p.niva, 2);
    assert.equal(p.andel, 0);
    assert.equal(matarText(p), "175 / 425 övningar till Nivå 3");
  });

  it("andel inom nivån för stapeln", () => {
    const p = progressTillNasta(175 + 250 / 2, 25);
    assert.ok(Math.abs(p.andel - 0.5) < 0.01);
  });

  it("högsta nivån: inget mål, tusental med hårt mellanslag", () => {
    const p = progressTillNasta(20_000, 30);
    assert.equal(p.niva, 10);
    assert.equal(p.max, true);
    assert.equal(p.mal, null);
    assert.equal(p.kvar, 0);
    assert.equal(matarText(p), "20 000 övningar – högsta nivån nådd!");
    assert.equal(matarText(progressTillNasta(1200, 30)), "1 200 / 1 650 övningar till Nivå 5");
  });
});
