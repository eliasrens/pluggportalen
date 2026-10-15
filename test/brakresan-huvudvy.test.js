// ============================================================================
// Bråkresan #713 H – huvudvyns listlogik, drakpanelens texter och miniatyrerna
// (spec §9 "Nivåberäkning"/"Gemensam drakpanel", §11 "Huvudvy").
// ============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CHALLENGES, CHALLENGE_IDS } from "../src/brakresan/schema/katalog.js";
import {
  FILTER, filtrera, kortStatus, listlage, matcharSok, normalisera, rekommendationer, sammanfattning,
} from "../src/brakresan/huvudvy-lista.js";
import { drakInfo } from "../src/brakresan/drakpanel.js";
import { miniatyrSvg, MINIATYR_IDS } from "../src/brakresan/miniatyr.js";

const ids = (lista) => lista.map((c) => c.id).join(",");

describe("listan (§11)", () => {
  test("standardläget visar alla 50 i föreskriven ordning", () => {
    assert.equal(filtrera(CHALLENGES).length, 50);
    assert.deepEqual(filtrera(CHALLENGES).map((c) => c.id), CHALLENGE_IDS);
    assert.deepEqual(FILTER.map((f) => f.label), ["Alla", "Inte bemästrade", "Bemästrade", "Rekommenderade"]);
  });

  test("filtren Bemästrade / Inte bemästrade / Rekommenderade", () => {
    const state = { challenges: { "03": { stars: 3 }, "12": { stars: 2 }, "50": { stars: 3 } } };
    const rek = rekommendationer([{ active: true, challengeIds: ["19", "03"] }]);
    assert.equal(ids(filtrera(CHALLENGES, { filter: "bemastrade", state })), "03,50");
    assert.equal(filtrera(CHALLENGES, { filter: "inte-bemastrade", state }).length, 48);
    assert.equal(ids(filtrera(CHALLENGES, { filter: "rekommenderade", rek })), "03,19");
    assert.equal(ids(filtrera(CHALLENGES, { filter: "rekommenderade", rek, sok: "tallinje" })), "19");
  });

  test("sök på namn, moment och nummer – utan att bry sig om å/ä/ö eller versaler", () => {
    assert.equal(normalisera(" Bråk ÄR "), "brak ar");
    assert.equal(ids(filtrera(CHALLENGES, { sok: "tallinje" })), "18,19,26");
    assert.equal(ids(filtrera(CHALLENGES, { sok: "PROCENT" })), "41,42,43,44,45,46,49");
    assert.equal(ids(filtrera(CHALLENGES, { sok: "extra" })), "38,47,48,50");
    assert.equal(ids(filtrera(CHALLENGES, { sok: "19" })), "19");
    assert.equal(ids(filtrera(CHALLENGES, { sok: "09" })), "09");
    assert.ok(matcharSok(CHALLENGES[0], ""));
    assert.equal(filtrera(CHALLENGES, { sok: "zzz" }).length, 0);
  });

  test("översikten: stjärnor X/150 och bemästrade Y/50 ur posterna", () => {
    assert.deepEqual(sammanfattning(null), { stars: 0, mastered: 0 });
    assert.deepEqual(sammanfattning({ challenges: { "01": { stars: 3 }, "02": { stars: 2 }, "03": { stars: 9 } } }), { stars: 8, mastered: 2 });
  });

  test("status läses utan färg: text + ikon + tre stjärnplatser", () => {
    const fall = [
      [{}, "inte-paborjad", "Inte påbörjad", 0],
      [{ activeRoundId: "r", activeAnswered: 4, firstTotal: 4 }, "pagaende", "Pågående omgång (4/10 svarade)", 0],
      [{ firstTotal: 10, last: 6 }, "tranar", "Tränar", 0],
      [{ stars: 1, last: 8 }, "stjarnor", "1 av 3 stjärnor", 1],
      [{ stars: 2 }, "stjarnor", "2 av 3 stjärnor", 2],
      [{ stars: 3, last: 10 }, "bemastrad", "Bemästrad", 3],
    ];
    for (const [entry, status, label, stars] of fall) {
      const k = kortStatus(entry);
      assert.deepEqual([k.status, k.label, k.stars], [status, label, stars]);
      assert.ok(k.ikon, `ikon för ${status}`);
    }
    assert.equal(kortStatus({ stars: 1, last: 8 }).senast, "Senast 8 av 10");
    assert.equal(kortStatus({}).senast, null);
  });

  test("rekommendationer: aktiva, katalogordning, kommentarer utan dubbletter", () => {
    const rek = rekommendationer([
      { active: true, challengeIds: ["19", "03"], comment: " Tallinjen! " },
      { active: true, classId: "6a", challengeIds: ["19"], comment: "Tallinjen!" },
      { active: false, challengeIds: ["40"] },
      { active: true, challengeIds: ["99"] },
      null,
    ]);
    assert.deepEqual([...rek.keys()], ["03", "19"]);
    assert.deepEqual(rek.get("19"), ["Tallinjen!"]);
  });

  test("listans läge sparas och läses tillbaka; skräp ger standardvärden", () => {
    const m = new Map();
    const store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    assert.equal(listlage.las(store), null);
    listlage.spara({ filter: "bemastrade", sok: "procent", scrollY: 1234, fokus: "41" }, store);
    assert.deepEqual(listlage.las(store), { filter: "bemastrade", sok: "procent", scrollY: 1234, fokus: "41" });
    m.set("pp:brakresan:lista", JSON.stringify({ filter: "hack", sok: 5, scrollY: -3 }));
    assert.deepEqual(listlage.las(store), { filter: "alla", sok: "", scrollY: 0, fokus: null });
    m.set("pp:brakresan:lista", "{trasig");
    assert.equal(listlage.las(store), null);
  });
});

describe("drakpanelen (§9)", () => {
  const info = (S, extra = {}) => drakInfo({ totalStars: S, dragon: S >= 10 ? { name: "Glöd" } : null, ...extra });

  test("trösklarna 0, 9, 10, 19, 20, 149, 150", () => {
    const rad = (S) => {
      const i = info(S);
      return [i.nivaText, i.nastaText, i.fullyGrown, Math.round(i.progress.andel * 100)];
    };
    assert.deepEqual(rad(0), ["Ägg", "10 stjärnor kvar tills ägget kläcks", false, 0]);
    assert.deepEqual(rad(9), ["Ägg", "1 stjärna kvar tills ägget kläcks", false, 90]);
    assert.deepEqual(rad(10), ["Nivå 1 av 15", "10 stjärnor kvar till nivå 2", false, 0]);
    assert.deepEqual(rad(19), ["Nivå 1 av 15", "1 stjärna kvar till nivå 2", false, 90]);
    assert.deepEqual(rad(20), ["Nivå 2 av 15", "10 stjärnor kvar till nivå 3", false, 0]);
    assert.deepEqual(rad(149), ["Nivå 14 av 15", "1 stjärna kvar till nivå 15", false, 90]);
    assert.deepEqual(rad(150), ["Nivå 15 av 15", "Fullt utvecklad", true, 100]);
  });

  test("ägget: namn 'Drakägget', ingen jakt; kläckt: namn, intervall och historik", () => {
    assert.equal(info(7).namn, "Drakägget");
    assert.equal(info(7).jakt, null);
    assert.equal(drakInfo({ totalStars: 12, dragon: {} }).namn, "Bråkis", "standardnamnet");
    const j = info(34, { hunts: { count: 6, coins: 97, lastDate: "2026-10-15" } });
    assert.equal(j.namn, "Glöd");
    assert.deepEqual([j.jakt.max, j.jakt.intervallText, j.jakt.antal, j.jakt.mynt], [30, "1–30 mynt", 6, 97]);
    assert.equal(drakInfo({ totalStars: 110, dragon: {}, hunts: { lastDate: "2026-10-15" } }, { idag: "2026-10-15" }).jakt.klarIdag, true);
    assert.equal(drakInfo({ totalStars: 110, dragon: {} }).jakt.intervallText, "1–120 mynt");
    assert.equal(drakInfo({ totalStars: 150, dragon: {} }).jakt.max, 200);
    assert.equal(drakInfo({ totalStars: 999 }).stars, 150, "aldrig över 150");
  });
});

test("miniatyrer: en egen bild per utmaning, dekor för skärmläsare", () => {
  assert.deepEqual([...MINIATYR_IDS].sort(), [...CHALLENGE_IDS]);
  const bilder = new Set();
  for (const id of CHALLENGE_IDS) {
    const svg = miniatyrSvg(id);
    assert.match(svg, /^<svg class="brh-mini" viewBox="0 0 80 60" aria-hidden="true"/);
    assert.doesNotMatch(svg, /NaN|undefined/, `utmaning ${id}`);
    assert.ok(svg.length > 150, `utmaning ${id} har innehåll`);
    bilder.add(svg);
  }
  assert.equal(bilder.size, 50, "ingen miniatyr är en kopia av en annan");
});
