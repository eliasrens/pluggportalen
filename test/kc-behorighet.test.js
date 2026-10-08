// ============================================================================
// Klasscentret – behörighet i rummet (#501, epic #473, spec §7): EN roll ur
// medlemslistan + spärrlistan styr verktyg, statusrad och rubrik; byte av
// användare (O4) och rubriken i realtid (O1).
// Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  kcRoll, rollKanInreda, rollArGast, arKlassmedlem, anvandarNyckel, KC_ROLLER,
} from "../src/klasscenter/kc-behorighet.js";
import { kanInredaFor } from "../src/klasscenter/kc-layout-plan.js";
import { rubrikText, statusHtml } from "../src/klasscenter/kc-rum-tillstand.js";
import { progressTillNasta, troskelFor } from "../src/klasscenter/kc-niva.js";
import { matarRad } from "../src/klasscenter/kc-by.js";

const klass = { studentIds: ["elev1", "elev3"], inredningSparr: ["elev3"] };

describe("kcRoll", () => {
  it("hemma / spärrad / gäst / lärare / utloggad", () => {
    assert.equal(kcRoll({ uid: "elev1", ...klass }), "hemma");
    assert.equal(kcRoll({ uid: "elev3", ...klass }), "sparrad");
    assert.equal(kcRoll({ uid: "elev2", ...klass }), "gast");
    assert.equal(kcRoll({ uid: "larare1", arLarare: true, ...klass }), "larare");
    assert.equal(kcRoll({ uid: null, ...klass }), "utloggad");
    assert.equal(kcRoll(), "utloggad");
  });

  it("lärare är lärare även i en annan klass (globalt anspråk, SAKERHET R1)", () => {
    assert.equal(kcRoll({ uid: "x", arLarare: true, studentIds: [] }), "larare");
  });

  it("gästen avgörs utan spärrlistan (den är inte läsbar för gäster, #500)", () => {
    assert.equal(kcRoll({ uid: "elev2", studentIds: ["elev1"] }), "gast");
    // Står man i en ANNAN klass spärrlista är man ändå gäst här.
    assert.equal(kcRoll({ uid: "elev2", studentIds: ["elev1"], inredningSparr: ["elev2"] }), "gast");
  });

  it("trasiga listor ger aldrig inredningsrätt", () => {
    assert.equal(kcRoll({ uid: "elev1", studentIds: null }), "gast");
    assert.equal(kcRoll({ uid: "elev1", studentIds: "elev1" }), "gast");
    assert.equal(kcRoll({ uid: null, studentIds: [null] }), "utloggad");
    assert.equal(kcRoll({ uid: "elev1", studentIds: ["elev1"], inredningSparr: null }), "hemma");
  });

  it("varje roll är en känd roll", () => {
    for (const uid of ["elev1", "elev2", "elev3", null]) {
      assert.ok(KC_ROLLER.includes(kcRoll({ uid, ...klass })));
    }
  });
});

describe("rollKanInreda / rollArGast", () => {
  it("bara lärare och hemmaklass får inreda", () => {
    assert.deepEqual(KC_ROLLER.filter(rollKanInreda), ["larare", "hemma"]);
    assert.deepEqual(KC_ROLLER.filter(rollArGast), ["gast", "utloggad"]);
    assert.equal(rollKanInreda(null), false);
    assert.equal(rollArGast(null), false);
  });

  it("kanInredaFor (layoutplanen) följer samma roll", () => {
    for (const uid of ["elev1", "elev2", "elev3", null]) {
      for (const arLarare of [false, true]) {
        assert.equal(kanInredaFor({ uid, arLarare, ...klass }), rollKanInreda(kcRoll({ uid, arLarare, ...klass })));
      }
    }
  });

  it("arKlassmedlem", () => {
    assert.equal(arKlassmedlem("elev1", klass.studentIds), true);
    assert.equal(arKlassmedlem("elev2", klass.studentIds), false);
    assert.equal(arKlassmedlem("", [""]), false);
    assert.equal(arKlassmedlem("elev1", undefined), false);
  });
});

describe("rubriken och statusraden läser samma roll", () => {
  const nivo = { klassNamn: "6B", niva: 3, nivaNamn: "Träkoja" };
  it("gäst ser klassens namn, hemma/spärrad/lärare ser nivån", () => {
    assert.equal(rubrikText({ ...nivo, roll: "gast" }), "Klasscentret i 6B 🏛️");
    assert.equal(rubrikText({ ...nivo, roll: "utloggad" }), "Klasscentret i 6B 🏛️");
    for (const roll of ["hemma", "sparrad", "larare"]) {
      assert.equal(rubrikText({ ...nivo, roll }), "Klasscentret · Nivå 3 Träkoja 🏛️");
    }
  });

  it("hemmaklass som kommer via grannbyn behandlas som hemma, inte som gäst", () => {
    assert.equal(rubrikText({ ...nivo, roll: "hemma", visaOnly: true }), "Klasscentret · Nivå 3 Träkoja 🏛️");
    assert.equal(statusHtml({ laddad: true, roll: "hemma", visaOnly: true }), "");
  });

  it("innan rollen är avgjord gissar vägen in", () => {
    assert.equal(rubrikText({ ...nivo, roll: null, visaOnly: true }), "Klasscentret i 6B 🏛️");
    assert.equal(rubrikText({ ...nivo, roll: null }), "Klasscentret · Nivå 3 Träkoja 🏛️");
    assert.equal(rubrikText({ roll: "gast" }), "Klasscentret · Nivå 1 🏛️"); // gäst utan klassnamn
  });

  it("O1: ny klass-EXP ger ny rubrik och mätare (samma progress som byn)", () => {
    const fore = progressTillNasta(troskelFor(2, 20) + 3, 20);
    const efter = progressTillNasta(troskelFor(3, 20) + 1, 20);
    assert.equal(fore.niva, 2);
    assert.equal(efter.niva, 3);
    const t1 = rubrikText({ roll: "hemma", niva: fore.niva, nivaNamn: fore.namn });
    const t2 = rubrikText({ roll: "hemma", niva: efter.niva, nivaNamn: efter.namn });
    assert.notEqual(t1, t2);
    assert.match(t2, /Nivå 3/);
    assert.notEqual(matarRad(fore), matarRad(efter));
    assert.match(matarRad(efter), /till Nivå 4/);
  });
});

describe("anvandarNyckel (O4: byte av användare)", () => {
  it("elev, lärare och utloggad ger olika nycklar", () => {
    assert.equal(anvandarNyckel({ studentId: "kc02" }), "elev:kc02");
    assert.equal(anvandarNyckel({ teacher: true, uid: "t1" }), "larare:t1");
    assert.equal(anvandarNyckel({}), "");
    assert.equal(anvandarNyckel(), "");
  });

  it("byte kc02 → kc03, utloggning och elev → lärare märks; samma användare gör det inte", () => {
    const vid = anvandarNyckel({ studentId: "kc02", uid: "kc02" });
    assert.equal(anvandarNyckel({ studentId: "kc02", teacher: false, uid: "kc02" }), vid);
    assert.notEqual(anvandarNyckel({ studentId: "kc03", uid: "kc03" }), vid);
    assert.notEqual(anvandarNyckel({ studentId: null, uid: null }), vid);
    assert.notEqual(anvandarNyckel({ studentId: null, teacher: true, uid: "kc02" }), vid);
  });
});
