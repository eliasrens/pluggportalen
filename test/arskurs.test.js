// Årskurs ur klassnamnet (#845) – arskursAvKlass + filterhjälparna.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OVRIGA, ALLA, arskursAvKlass, arskursKod, arskursFranKod, arskursLabel, arskurserIMatch,
  arskursAvRad, filtreraArskurs,
} from "../src/tavling/arskurs.js";

const NAMN = new Map([["3a", "3A"], ["3b", "3B"], ["4b", "4B"], ["10a", "10A"], ["fri", "Fritids"], ["k3", "Klass 3"]]);

describe("arskursAvKlass", () => {
  it("inledande siffror ger årskursen", () => {
    assert.equal(arskursAvKlass("4B"), 4);
    assert.equal(arskursAvKlass("3A"), 3);
    assert.equal(arskursAvKlass("10A"), 10);
    assert.equal(arskursAvKlass("6"), 6);
    assert.equal(arskursAvKlass("7 Blå"), 7);
  });
  it("namn utan inledande siffra → Övriga", () => {
    assert.equal(arskursAvKlass("Klass 3"), OVRIGA);
    assert.equal(arskursAvKlass("Fritids"), OVRIGA);
    assert.equal(arskursAvKlass(""), OVRIGA);
    assert.equal(arskursAvKlass(null), OVRIGA);
    assert.equal(arskursAvKlass(undefined), OVRIGA);
    assert.equal(arskursAvKlass(" 4B"), OVRIGA, "inledande blanksteg räknas inte (samma som reglerna)");
    assert.equal(arskursAvKlass("0A"), OVRIGA, "0 är ingen årskurs");
  });
  it("kod ↔ årskurs: Övriga = 0", () => {
    assert.equal(arskursKod(4), 4);
    assert.equal(arskursKod(OVRIGA), 0);
    assert.equal(arskursFranKod(0), OVRIGA);
    assert.equal(arskursFranKod(10), 10);
    assert.equal(arskursFranKod("x"), OVRIGA);
    assert.equal(arskursFranKod(arskursKod(arskursAvKlass("Fritids"))), OVRIGA);
  });
  it("etiketter", () => {
    assert.equal(arskursLabel(3), "Åk 3");
    assert.equal(arskursLabel(OVRIGA), "Övriga");
    assert.equal(arskursLabel(ALLA), "Alla");
  });
});

describe("arskurserIMatch", () => {
  it("bara årskurser som finns i matchen, stigande, Övriga sist", () => {
    assert.deepEqual(arskurserIMatch(["fri", "4b", "3a", "3b", "10a"], NAMN), [3, 4, 10, OVRIGA]);
    assert.deepEqual(arskurserIMatch(["3a", "3b"], NAMN), [3]);
    assert.deepEqual(arskurserIMatch([], NAMN), []);
  });
  it("okänd klass (saknas i klasslistan) → Övriga; funktion som namnkälla", () => {
    assert.deepEqual(arskurserIMatch(["x", "4b"], NAMN), [4, OVRIGA]);
    assert.deepEqual(arskurserIMatch(["a", "b"], (id) => (id === "a" ? "5C" : "5D")), [5]);
  });
});

describe("arskursAvRad + filtreraArskurs", () => {
  const top = [
    { rank: 1, uid: "a", classId: "4b", correct: 50, arskurs: 4 },
    { rank: 2, uid: "b", classId: "3a", correct: 40 },             // post före #845: ur klassnamnet
    { rank: 3, uid: "c", classId: "3b", correct: 30, arskurs: 3 },
    { rank: 3, uid: "d", classId: "fri", correct: 30, arskurs: 0 },
    { rank: 5, uid: "e", classId: "3a", correct: 30, arskurs: 3 },
  ];
  it("lagrat arskurs vinner, annars klassnamnet", () => {
    assert.equal(arskursAvRad(top[0], NAMN), 4);
    assert.equal(arskursAvRad(top[1], NAMN), 3);
    assert.equal(arskursAvRad(top[3], NAMN), OVRIGA);
    assert.equal(arskursAvRad({ classId: "4b", arskurs: 7 }, NAMN), 7, "lagrat värde används rakt av");
  });
  it("Alla → oförändrat (samma objekt)", () => {
    assert.equal(filtreraArskurs(top, ALLA, NAMN), top);
    assert.equal(filtreraArskurs(top, null, NAMN), top);
  });
  it("Åk 3 → bara åk 3, omrankade med delade platser", () => {
    const r = filtreraArskurs(top, 3, NAMN, "correct");
    assert.deepEqual(r.map((x) => [x.uid, x.rank]), [["b", 1], ["c", 2], ["e", 2]]);
    assert.equal(top[2].rank, 3, "originalet rörs inte");
  });
  it("Övriga och tom årskurs", () => {
    assert.deepEqual(filtreraArskurs(top, OVRIGA, NAMN).map((x) => x.uid), ["d"]);
    assert.deepEqual(filtreraArskurs(top, 9, NAMN), []);
  });
  it("Klasskampen rankas på score", () => {
    const klasser = [
      { rank: 1, classId: "4b", score: 200 }, { rank: 2, classId: "3a", score: 150 }, { rank: 3, classId: "3b", score: 150 },
    ];
    assert.deepEqual(filtreraArskurs(klasser, 3, NAMN, "score").map((x) => [x.classId, x.rank]), [["3a", 1], ["3b", 1]]);
  });
});
