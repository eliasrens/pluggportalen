// ============================================================================
// Prov (#748, spec §14): anpassningarnas rena logik – extra tid per elev,
// omprov för valda elever och flikbytena – och hur elevens läge, lärarens
// översikt och tidsgränsen räknar med dem. Reglerna: firestore-rules-prov-anpassningar.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arOmprov, elevProvNamn, extraMin, extraTidText, flikbyteText, gallerElev, omprovForval, rensaExtraTid, tidsgransFor, tillfalleNamn,
  tolkaFlikbyten,
} from "../src/prov/prov-anpassningar.js";
import { elevLage, oversiktRader, slutTid } from "../src/prov/prov-tillfalle-logik.js";

const MIN = 60_000;

describe("extra tid per elev", () => {
  const tf = { status: "oppet", tidsgransMin: 40, extraTid: { alva: 15, bo: 0, cleo: "10", dante: 999 } };
  it("bara heltal 1–240 räknas; utan tidsgräns finns ingen gräns alls", () => {
    assert.equal(extraMin(tf, "alva"), 15);
    assert.equal(extraMin(tf, "bo"), 0);
    assert.equal(extraMin(tf, "cleo"), 0, "sträng");
    assert.equal(extraMin(tf, "dante"), 0, "för mycket");
    assert.equal(extraMin(tf, "ingen"), 0);
    assert.equal(tidsgransFor(tf, "alva"), 55);
    assert.equal(tidsgransFor(tf, "ingen"), 40);
    assert.equal(tidsgransFor({ tidsgransMin: null, extraTid: { alva: 15 } }, "alva"), null);
    assert.equal(tidsgransFor(null, "alva"), null);
  });
  it("elevens läge och nedräkning följer hennes egen tid – inte klassens", () => {
    const svar = (uid) => ({ elevId: uid, startad: 0, inlamnad: false });
    assert.equal(elevLage(tf, svar("bo"), 41 * MIN), "tiden-slut");
    assert.equal(elevLage(tf, svar("alva"), 41 * MIN), "pagar");
    assert.equal(elevLage(tf, svar("alva"), 55 * MIN), "tiden-slut");
    assert.equal(elevLage(tf, { startad: 0, inlamnad: false }, 41 * MIN, "alva"), "pagar", "uid som argument");
    assert.equal(slutTid(0, tidsgransFor(tf, "alva")), 55 * MIN);
  });
  it("lärarens översikt: tid kvar med extra tiden, och hur mycket extra", () => {
    const elever = [{ id: "alva", namn: "Alva" }, { id: "bo", namn: "Bo" }];
    const rader = oversiktRader(elever, { alva: { startad: 0, inlamnad: false, svar: {} }, bo: { startad: 0, inlamnad: false, svar: {} } },
      { fragor: [], tidsgransMin: 40, extraTid: { alva: 15 } }, 30 * MIN);
    assert.equal(rader[0].kvarMs, 25 * MIN);
    assert.equal(rader[0].extraMin, 15);
    assert.equal(rader[1].kvarMs, 10 * MIN);
    assert.equal(rader[1].extraMin, 0);
    const utan = oversiktRader(elever, {}, { fragor: [], tidsgransMin: null, extraTid: { alva: 15 } }, 0);
    assert.equal(utan[0].extraMin, 0, "utan tidsgräns visas ingen extra tid");
  });
  it("lärarens val rensas: bara giltiga minuter och elever som finns", () => {
    assert.deepEqual(rensaExtraTid({ alva: "15", bo: "", cleo: 0, dante: 300, ebba: 2.5, filip: 10 }, ["alva", "bo", "cleo", "dante", "ebba"]),
      { alva: 15 });
    assert.deepEqual(rensaExtraTid({ filip: 10 }), { filip: 10 }, "utan lista godtas alla");
    assert.deepEqual(rensaExtraTid(null), {});
  });
  it("texten i översikten, i namnordning", () => {
    assert.equal(extraTidText({ bo: 10, alva: 15 }, { alva: "Alva", bo: "Bo" }), "Extra tid: Alva +15 min, Bo +10 min");
    assert.equal(extraTidText({}, {}), "");
    assert.equal(extraTidText({ x: 5 }), "Extra tid: Okänd elev +5 min");
  });
});

describe("omprov för valda elever", () => {
  const omprov = { provNamn: "Vikingaprovet", elevIds: ["alva", "bo", "cleo"] };
  it("namnet i listan: Vikingaprovet – omprov (3 elever)", () => {
    assert.equal(tillfalleNamn(omprov), "Vikingaprovet – omprov (3 elever)");
    assert.equal(tillfalleNamn({ provNamn: "Vikingaprovet", elevIds: ["alva"] }), "Vikingaprovet – omprov (1 elev)");
    assert.equal(tillfalleNamn({ provNamn: "Vikingaprovet" }), "Vikingaprovet");
    assert.equal(tillfalleNamn({}), "Prov");
    // Eleven och statistiken (#749 F2): utan antal, med "(omprov)".
    assert.equal(elevProvNamn(omprov), "Vikingaprovet (omprov)");
    assert.equal(elevProvNamn({ provNamn: "Vikingaprovet" }), "Vikingaprovet");
    assert.equal(elevProvNamn(null), "Prov");
  });
  it("gäller bara de valda; ett vanligt tillfälle gäller alla", () => {
    assert.equal(arOmprov(omprov), true);
    assert.equal(gallerElev(omprov, "bo"), true);
    assert.equal(gallerElev(omprov, "dante"), false);
    assert.equal(arOmprov({ provNamn: "x" }), false);
    assert.equal(gallerElev({ provNamn: "x" }, "dante"), true);
  });
  it("förvalet: de som inte skrev – inget svar, eller stängt utan ett enda svar", () => {
    const svar = {
      alva: { inlamnad: true, inlamnadNar: "elev", svar: { q1: 0 } },
      bo: { inlamnad: true, inlamnadNar: "stangt", svar: {} },
      cleo: { inlamnad: true, inlamnadNar: "stangt", svar: { q1: "Birka" } },
      ebba: { inlamnad: true, inlamnadNar: "elev", svar: {} },
    };
    assert.deepEqual(omprovForval(["alva", "bo", "cleo", "dante", "ebba"], svar), ["bo", "dante"]);
    assert.deepEqual(omprovForval(["alva"], null), ["alva"]);
  });
});

describe("flikbyten (bara information)", () => {
  it("texten till läraren", () => {
    assert.equal(flikbyteText(2), "Lämnade provet 2 gånger");
    assert.equal(flikbyteText(1), "Lämnade provet 1 gång");
    assert.equal(flikbyteText(0), "");
    assert.equal(flikbyteText(undefined), "");
    assert.equal(flikbyteText("3"), "", "bara heltal");
  });
  it("tolkas till ett rimligt heltal", () => {
    assert.equal(tolkaFlikbyten(4), 4);
    assert.equal(tolkaFlikbyten(-1), 0);
    assert.equal(tolkaFlikbyten(1.5), 0);
    assert.equal(tolkaFlikbyten(1e9), 10_000);
  });
});
