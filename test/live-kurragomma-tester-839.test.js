// Kurragömma D (#839) – TESTARENS fynd som rena tester (rättade i rättningsrunda 1).
//   F2  slutskärmen: "Du blev hittad <plats> och letade sedan" – result.gomstallen[].namn
//       är ELEVENS namn (servern), inte platsen → "Du blev hittad Theo 3A och letade sedan."
//   F4  lokala bussen (demot): händelse-id = h${hand.length + 1} – efter HAND_LIMIT
//       händelser blir alla "h21", projektorns dedupe (sedda) släpper sedan inget mer.
// Runda 3 (35407dc), rättat: N1b samma tick – functions/kurragomma-tick.js sätter tystRef = nu för en
//   FRÅNKOPPLAD gömd (ingen vissling) i samma kgTick som en annan gömd visslas med hand.t = nu.
//   Referensen är nu kgPlayers.tystVissling = hand-händelsens id (bara visslingsgrenen sätter den),
//   aldrig tystRef eller en tidsstämpel.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slutRad } from "../src/live/formats/kurragomma/kge-skarmar.js";
import { skapaLokalBuss } from "../src/live/formats/kurragomma/kg-kanal.js";
import { platsNamn } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import { HAND_LIMIT } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { skapaEgenVisslingar, egenVisslingsReferens } from "../src/live/formats/kurragomma/kge-logik.js";

describe("tester #839: slutskärmen", () => {
  // Serverns result.gomstallen (functions/kurragomma-resultat.js) som e2e-matchen 2026-11-11 gav det.
  const gom = { uid: "c03", x: -17.76, z: -16.04, skydd: 2, namn: "Theo 3A", hittad: true };
  const rad = { uid: "c03", name: "Theo 3A", klaradeSig: false, poang: 12, hittade: 0 };

  it("hittad: raden nämner platsen, aldrig elevens eget namn (F2)", () => {
    const text = slutRad(rad, gom);
    assert.ok(!text.includes("Theo 3A"), text);
    assert.equal(text, `Du blev hittad ${platsNamn(gom.x, gom.z)} och letade sedan.`);
  });

  it("klarade sig / sökare hela matchen påverkas inte", () => {
    assert.equal(slutRad({ ...rad, klaradeSig: true }, { ...gom, hittad: false }), "Du klarade dig gömd hela matchen!");
    assert.equal(slutRad({ ...rad, hittade: 2 }, null), "Du var sökare och hittade 2 gömda!");
  });
});

describe("tester #839: lokala bussen (demot)", () => {
  it("varje händelse har ett eget id även efter HAND_LIMIT – en lyssnare med dedupe ser alla (F4)", () => {
    let t = 1_800_000_000_000;
    const buss = skapaLokalBuss({ nu: () => t });
    const kanal = buss.kanalFor("projektor");
    const sedda = new Set();
    let visade = 0;
    kanal.paHandelse((h) => { if (!sedda.has(h.id)) { sedda.add(h.id); visade++; } });
    const N = HAND_LIMIT + 10;
    for (let i = 0; i < N; i++) { t += 100; buss.server.handelse({ typ: "vissling", x: 0, z: 0, plats: "vid ladan" }); }
    assert.equal(visade, N);
    const ids = buss.server.tillstand.hand.map((h) => h.id);
    assert.equal(new Set(ids).size, ids.length, ids.join(","));
  });
});

describe("tester #839 runda 3: tystnadsregelns egna vissling", () => {
  // kgTick: c01 frånkopplad → kgPlayers.tystRef = nu (ingen vissling); c03 tyst → tystRef = nu
  // och hand { typ: "vissling", t: nu }. Samma nu för alla kandidater i ett anrop.
  it("en tystRef som flyttats utan vissling matchar inte någon annans vissling med samma t (N1b)", () => {
    const nu = 1_794_447_108_599;
    const hand = { id: "-NxQ7c03", typ: "vissling", t: nu, x: -3.85, z: -14.58, plats: "i granen" }; // c03:s vissling, utan uid
    const c01 = skapaEgenVisslingar();
    // c01 (frånkopplad): kgPlayers.tystRef = nu men ingen tystVissling → ingen referens.
    const ref = egenVisslingsReferens("", { roll: "gomd", tystRef: nu, senastSvarAt: null });
    assert.equal(ref, null, "tystRef ensam är ingen referens");
    assert.equal((ref && c01.referens(ref)) || c01.vissling(hand), null, "c01 visslades inte – ingen egen vissling-rad");
    assert.equal(c01.referens(nu), null, "en tidsstämpel är aldrig en referens");
    assert.equal(c01.vissling(hand), null);
    // c03 (visslad i samma tick): tystVissling = händelsens id → referens; samma id i hand är dess egen.
    const c03 = skapaEgenVisslingar();
    const ref3 = egenVisslingsReferens("", { roll: "gomd", tystRef: nu, tystVissling: "-NxQ7c03" });
    assert.equal(ref3, "-NxQ7c03");
    assert.equal(c03.referens(ref3), null);
    assert.equal(c03.vissling(hand), hand, "c03: egen vissling-rad (TEXT.tystVissling)");
    assert.equal(c03.vissling({ ...hand, id: "-NxQ7bo" }), null, "bo:s vissling i samma tick (samma t) är inte c03:s");
    assert.equal(egenVisslingsReferens("-NxQ7c03", { roll: "gomd", tystVissling: "-NxQ7c03" }), null, "samma referens igen – inget nytt");
    assert.equal(egenVisslingsReferens("", { roll: "sokare", tystVissling: "-NxQ7c03" }), null, "sökare visslas aldrig");
  });
});
