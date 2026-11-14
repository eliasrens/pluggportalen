// Årskurs ur klassnamnet (#845) – arskursAvKlass + Klasskampens filterhjälpare.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OVRIGA, ALLA, arskursAvKlass, arskursLabel, arskurserIMatch, filtreraArskurs } from "../src/tavling/arskurs.js";

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
    assert.equal(arskursAvKlass(" 4B"), OVRIGA, "inledande blanksteg räknas inte");
    assert.equal(arskursAvKlass("0A"), OVRIGA, "0 är ingen årskurs");
    assert.equal(arskursAvKlass("2024A"), OVRIGA, "högst två siffror");
    assert.equal(arskursAvKlass("123"), OVRIGA);
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

describe("filtreraArskurs (Klasskampen)", () => {
  const klasser = [
    { rank: 1, classId: "4b", name: "4B", score: 200 },
    { rank: 2, classId: "3a", name: "3A", score: 150 },
    { rank: 2, classId: "3b", name: "3B", score: 150 },
    { rank: 4, classId: "fri", name: "Fritids", score: 46 },
    { rank: 5, classId: "k3", name: "Klass 3", score: 10 },
  ];
  it("Alla → oförändrat (samma objekt)", () => {
    assert.equal(filtreraArskurs(klasser, ALLA, NAMN), klasser);
    assert.equal(filtreraArskurs(klasser, null, NAMN), klasser);
  });
  it("Åk 3 → bara åk 3, omrankade med delade platser; originalet rörs inte", () => {
    assert.deepEqual(filtreraArskurs(klasser, 3, NAMN, "score").map((x) => [x.classId, x.rank]), [["3a", 1], ["3b", 1]]);
    assert.deepEqual(filtreraArskurs(klasser, 4, NAMN).map((x) => [x.classId, x.rank]), [["4b", 1]]);
    assert.equal(klasser[1].rank, 2);
  });
  it("Övriga samlar namn utan siffra; tom årskurs → []", () => {
    assert.deepEqual(filtreraArskurs(klasser, OVRIGA, NAMN).map((x) => [x.classId, x.rank]), [["fri", 1], ["k3", 2]]);
    assert.deepEqual(filtreraArskurs(klasser, 9, NAMN), []);
  });
});
