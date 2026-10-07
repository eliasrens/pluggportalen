// ============================================================================
// Klasscentrets rum (#490): lokalt tillstånd mot den gemensamma layouten
// (samtidighet + Spara), statusraden, historikraderna och hallens tema.
// Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FLOOR_TOP } from "../src/art-room.js";
import { skapaKcRumTillstand, sammaLayout, statusHtml } from "../src/klasscenter/kc-rum-tillstand.js";
import { narText, historikRadHtml } from "../src/klasscenter/kc-rum-historik.js";
import { validatePlacedItems, KC_Z_MAX } from "../src/klasscenter/kc-layout-plan.js";
import { kcHallHtml, hallTema, GOLV_TOPP } from "../src/art-klasscenter-hall.js";

const layout = (version, placedItems = {}) => ({ version, placedItems, updatedBy: "u", updatedAt: null });

describe("kc-rum-tillstand", () => {
  it("första snapshoten visas; samma version ignoreras", () => {
    const t = skapaKcRumTillstand();
    assert.equal(t.laddad, false);
    assert.equal(t.fjarr(layout(3, { lounge: { x: 40, y: 80, z: 1 } })), "ritad");
    assert.equal(t.laddad, true);
    assert.equal(t.version, 3);
    assert.deepEqual(t.placements, { lounge: { x: 40, y: 80, z: 1 } });
    assert.equal(t.fjarr(layout(3, {})), "samma");
    assert.equal(t.osparat, false);
  });

  it("annans sparning visas direkt när inget är osparat och ingen drar", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1));
    assert.equal(t.fjarr(layout(2, { fontan: { x: 50, y: 75, z: 0 } })), "ritad");
    assert.ok(t.placements.fontan);
  });

  it("realtid skriver aldrig över en pågående drag – väntar tills den släpps", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1, { lounge: { x: 40, y: 80, z: 0 } }));
    assert.equal(t.fjarr(layout(2, { flygel: { x: 20, y: 80, z: 0 } }), { dragPagar: true }), "vantar");
    assert.ok(t.placements.lounge, "den dragna layouten ligger kvar");
    // Klick utan flytt (inget osparat) → den väntande visas efter drag:en.
    assert.equal(t.efterDrag(), true);
    assert.deepEqual(Object.keys(t.placements), ["flygel"]);
    assert.equal(t.version, 2);
  });

  it("osparade ändringar: annans version väntar, Visa deras släpper mina", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1, { lounge: { x: 40, y: 80, z: 0 } }));
    t.placements.lounge.x = 60;
    t.andrat();
    assert.equal(t.osparat, true);
    assert.equal(t.fjarr(layout(2, { flygel: { x: 20, y: 80, z: 0 } })), "vantar");
    assert.equal(t.efterDrag(), false, "osparat → väntande visas inte automatiskt");
    assert.equal(t.placements.lounge.x, 60);
    assert.equal(t.visaVantande(), true);
    assert.equal(t.osparat, false);
    assert.deepEqual(Object.keys(t.placements), ["flygel"]);
  });

  it("Spara: senaste vinner – väntande äldre version släpps, osparat nollas", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1, { lounge: { x: 40, y: 80, z: 0 } }));
    t.placements.lounge.x = 61.234;
    t.andrat();
    t.fjarr(layout(2, {}));
    const skickat = t.placedItemsAttSpara();
    assert.deepEqual(skickat, { lounge: { x: 61.23, y: 80, z: 0 } });
    t.sparat({ ok: true, version: 3, placedItems: skickat, uid: "me" });
    assert.equal(t.osparat, false);
    assert.equal(t.vantande, null);
    assert.equal(t.version, 3);
    assert.equal(t.fjarr(layout(3, skickat)), "samma", "eget eko ritar inte om");
  });

  it("tillbaka till ursprungsläget = inte osparat", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1, { lounge: { x: 40, y: 80, z: 0 } }));
    t.placements.lounge.x = 70;
    t.andrat();
    t.placements.lounge.x = 40;
    t.andrat();
    assert.equal(t.osparat, false);
  });

  it("ovanpa: flyttad/ny sak läggs överst, numreras om vid taket", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1, { lounge: { x: 1, y: 1, z: 4 }, flygel: { x: 1, y: 1, z: 2 } }));
    t.ovanpa("flygel");
    assert.equal(t.placements.flygel.z, 5);
    assert.equal(t.rang("flygel") > t.rang("lounge"), true);
    t.placements.lounge.z = KC_Z_MAX;
    t.ovanpa("flygel");
    assert.equal(t.placements.lounge.z, 0);
    assert.equal(t.placements.flygel.z, 1);
    t.placements.akvarium = { x: 50, y: 78 };
    t.ovanpa("akvarium");
    assert.equal(t.placements.akvarium.z, 2);
  });

  it("det som sparas godtas av sparplanen (#489)", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(0));
    t.placements.guldstaty = { x: 33.33333, y: 77.7777, z: 0 };
    t.placements.kristallkrona = { x: 50, y: 20, z: 1 };
    const v = validatePlacedItems(t.placedItemsAttSpara(), { lada: ["guldstaty", "kristallkrona"] });
    assert.equal(v.ok, true);
  });

  it("sammaLayout bryr sig inte om nyckelordning", () => {
    assert.equal(sammaLayout({ a: { x: 1, y: 2, z: 0 }, b: { x: 3, y: 4, z: 1 } }, { b: { x: 3, y: 4, z: 1 }, a: { x: 1, y: 2 } }), true);
    assert.equal(sammaLayout({ a: { x: 1, y: 2 } }, {}), false);
  });
});

describe("statusraden", () => {
  const bas = { laddad: true, kan: true, visaOnly: false, vantande: false, osparat: false, sparatNyss: false };
  it("läsläge: gäst respektive bockad elev", () => {
    assert.match(statusHtml({ ...bas, kan: false, visaOnly: true }), /på besök/);
    assert.match(statusHtml({ ...bas, kan: false }), /läraren har stängt av inredning/);
  });
  it("väntande version erbjuder Visa deras", () => {
    assert.match(statusHtml({ ...bas, vantande: true, osparat: true }), /data-kc="visa-deras"/);
  });
  it("osparat / sparat / inget", () => {
    assert.match(statusHtml({ ...bas, osparat: true }), /inte är sparade/);
    assert.match(statusHtml({ ...bas, sparatNyss: true }), /Sparat!/);
    assert.equal(statusHtml(bas), "");
    assert.match(statusHtml({ ...bas, laddad: false }), /Hämtar/);
  });
});

describe("historiken", () => {
  const nu = new Date(2026, 9, 7, 15, 0);
  it("när: idag / igår / datum", () => {
    assert.equal(narText(new Date(2026, 9, 7, 9, 5), nu), "idag 09:05");
    assert.equal(narText({ toDate: () => new Date(2026, 9, 6, 23, 59) }, nu), "igår 23:59");
    assert.equal(narText({ seconds: new Date(2026, 9, 3, 14, 5).getTime() / 1000 }, nu), "3 okt 14:05");
    assert.equal(narText(null, nu), "nyss");
  });
  it("rad: Återställ-knapp med slot, aktuell version utan knapp, vem bara om satt", () => {
    const post = { slot: 4, version: 14, savedBy: "e1", savedAt: new Date(2026, 9, 7, 9, 5), placedItems: { a: {}, b: {} } };
    const r = historikRadHtml(post, { nu });
    assert.match(r, /data-slot="4"/);
    assert.match(r, /2 saker/);
    assert.doesNotMatch(r, /·/);
    assert.match(historikRadHtml(post, { nu, vem: "Alva" }), /2 saker · Alva/);
    const aktuell = historikRadHtml(post, { nu, aktuell: true });
    assert.doesNotMatch(aktuell, /data-slot/);
    assert.match(aktuell, /Visas nu/);
  });
});

describe("hallen", () => {
  it("golvlinjen = Mitt rums (drag-klamringen delas)", () => {
    assert.equal(GOLV_TOPP, FLOOR_TOP);
  });
  it("tema per nivå: trä 1–3, sten 4–6, borg 7–8, palats 9–10+", () => {
    assert.deepEqual([1, 3, 4, 6, 7, 8, 9, 10, 11].map(hallTema),
      ["tra", "tra", "sten", "sten", "borg", "borg", "palats", "palats", "palats"]);
  });
  it("ingen animation, inga id/defs, inga externa bilder (#374, Pixi)", () => {
    for (let n = 1; n <= 10; n++) {
      const h = kcHallHtml(n);
      assert.doesNotMatch(h, /\sid="|<defs|<animate|<image|<canvas|url\(/);
      assert.match(h, /class="room-bg kc-hall-bg"/);
    }
  });
});
