// ============================================================================
// Hitta rätt! (#636): lärarvyns platssökning (src/hitta-ratt/larare/lhr-platssok.js).
// Ingen nätverkstrafik – fetch, klocka och väntan är stubbar.
// Körs med: node --test test/hitta-ratt-platssok.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { skapaPlatssok, koordinatUr, avrunda, MIN_MS, TEXT, PlatssokFel } from "../src/hitta-ratt/larare/lhr-platssok.js";

const JORDEN = "http://www.wikidata.org/entity/Q2";
const MANEN = "http://www.wikidata.org/entity/Q405";
const p625 = (lat, lon, globe = JORDEN, rank = "normal") => ({ rank, mainsnak: { datavalue: { value: { latitude: lat, longitude: lon, globe } } } });

const svar = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

/** Fetch-stub: routes = [[regex, (url) => svar | Error]]. Loggar varje anrop med klockan. */
function stub(routes, klocka = { t: 0 }) {
  const anrop = [];
  const fetch = async (url) => {
    anrop.push({ url, t: klocka.t });
    const r = routes.find(([re]) => re.test(url));
    if (!r) throw new Error(`oväntad url ${url}`);
    const v = r[1](url);
    if (v instanceof Error) throw v;
    return v;
  };
  const vantat = [];
  const s = skapaPlatssok({ fetch, nu: () => klocka.t, vanta: async (ms) => { vantat.push(ms); klocka.t += ms; } });
  return { s, anrop, vantat, klocka };
}

const GAVLE_SOK = { search: [
  { id: "Q2643", label: "Gävle", description: "tätort i Gävle kommun, Sverige" },
  { id: "Q500212", label: "Gävle kommun", description: "kommun i Gävleborgs län" },
  { id: "Q999", label: "Gävle (album)", description: "musikalbum" },
  { id: "Q777", label: "Gävle (krater)", description: "krater på månen" },
] };
const GAVLE_ENT = { entities: {
  Q2643: { claims: { P625: [p625(60.6749, 17.1413)], P18: [{ mainsnak: { datavalue: { value: "Gävle rådhus.jpg" } } }] } },
  Q500212: { claims: { P625: [p625(60.66, 16.9)] } },
  Q999: { claims: {} },
  Q777: { claims: { P625: [p625(10, 20, MANEN)] } },
} };

const wdRoutes = (sok, ent) => [
  [/wbsearchentities/, () => svar(sok)],
  [/wbgetentities/, () => svar(ent)],
];

describe("Wikidata", () => {
  it("söker på svenska, hämtar P625 och sparar källan wikidata:Q…", async () => {
    const { s, anrop } = stub(wdRoutes(GAVLE_SOK, GAVLE_ENT));
    const r = await s.sok("Gävle", { scope: "sverige" });
    assert.equal(r.kalla, "wikidata");
    assert.equal(r.traffar.length, 2);
    assert.deepEqual(r.traffar[0], {
      kalla: "wikidata:Q2643", namn: "Gävle", besk: "tätort i Gävle kommun, Sverige",
      lat: 60.6749, lon: 17.1413, p18: "Gävle rådhus.jpg", inom: true,
    });
    assert.match(anrop[0].url, /language=sv&uselang=sv/);
    assert.match(anrop[0].url, /origin=\*/);
    assert.match(anrop[0].url, /search=G%C3%A4vle/);
    assert.match(anrop[1].url, /ids=Q2643\|Q500212\|Q999\|Q777/);
  });

  it("P625-filtret: utan koordinat och koordinater på månen sorteras bort", () => {
    assert.equal(koordinatUr({}), null);
    assert.equal(koordinatUr({ P625: [p625(10, 20, MANEN)] }), null);
    assert.deepEqual(koordinatUr({ P625: [p625(1, 2)] }), { lat: 1, lon: 2 });
    // Föredragen rang vinner, avrådd rang räknas inte.
    assert.deepEqual(koordinatUr({ P625: [p625(1, 2), p625(3, 4, JORDEN, "preferred")] }), { lat: 3, lon: 4 });
    assert.equal(koordinatUr({ P625: [p625(1, 2, JORDEN, "deprecated")] }), null);
  });

  it("markerar träffar utanför packets scope", async () => {
    const sok = { search: [{ id: "Q243", label: "Eiffeltornet", description: "torn i Paris" }] };
    const ent = { entities: { Q243: { claims: { P625: [p625(48.8584, 2.2945)] } } } };
    const { s } = stub(wdRoutes(sok, ent));
    const r = await s.sok("Eiffeltornet", { scope: "sverige" });
    assert.equal(r.traffar[0].inom, false);
    const { s: s2 } = stub(wdRoutes(sok, ent));
    assert.equal((await s2.sok("Eiffeltornet", { scope: "europa" })).traffar[0].inom, true);
  });

  it("avrundar till 5 decimaler (≈ 1 m)", () => {
    assert.equal(avrunda(60.674912345), 60.67491);
    assert.equal(avrunda(-0.000004), -0);
  });
});

describe("Nominatim som reserv", () => {
  const NOM = [{ osm_type: "relation", osm_id: 935236, name: "Sarek", display_name: "Sarek, Jokkmokks kommun, Norrbottens län, Sverige", lat: "67.29", lon: "17.69" }];

  it("0 träffar med koordinat i Wikidata → Nominatim, källa osm:relation/…", async () => {
    const { s, anrop } = stub([
      ...wdRoutes({ search: [{ id: "Q1", label: "Sarek" }] }, { entities: { Q1: { claims: {} } } }),
      [/nominatim/, () => svar(NOM)],
    ]);
    const r = await s.sok("Sarek", { scope: "sverige" });
    assert.equal(r.kalla, "osm");
    assert.deepEqual(r.traffar[0], { kalla: "osm:relation/935236", namn: "Sarek", besk: NOM[0].display_name, lat: 67.29, lon: 17.69, inom: true });
    const nom = anrop.find((a) => /nominatim/.test(a.url)).url;
    assert.match(nom, /format=jsonv2/);
    assert.match(nom, /accept-language=sv/);
    assert.match(nom, /limit=5/);
  });

  it("Wikidata utan några träffar alls → Nominatim (inget wbgetentities-anrop)", async () => {
    const { s, anrop } = stub([[/wbsearchentities/, () => svar({ search: [] })], [/nominatim/, () => svar(NOM)]]);
    const r = await s.sok("Sarek");
    assert.equal(r.kalla, "osm");
    assert.equal(anrop.filter((a) => /wbgetentities/.test(a.url)).length, 0);
  });

  it("Wikidata nere → Nominatim tar över", async () => {
    const { s } = stub([[/wikidata/, () => svar({}, 503)], [/nominatim/, () => svar(NOM)]]);
    assert.equal((await s.sok("Sarek")).kalla, "osm");
  });

  it("knappen \"Sök i OpenStreetMap\" (kalla: osm) frågar bara Nominatim", async () => {
    const { s, anrop } = stub([[/nominatim/, () => svar(NOM)]]);
    const r = await s.sok("Sarek", { kalla: "osm" });
    assert.equal(r.kalla, "osm");
    assert.equal(anrop.length, 1);
  });

  it("inga träffar någonstans → tydlig text", async () => {
    const { s } = stub([[/wbsearchentities/, () => svar({ search: [] })], [/nominatim/, () => svar([])]]);
    await assert.rejects(s.sok("xyzzy"), (e) => e instanceof PlatssokFel && e.code === "tom" && e.message === TEXT.tom);
  });
});

describe("fel", () => {
  it("429 → egen text (Wikidata och Nominatim)", async () => {
    const { s } = stub([[/wikidata/, () => svar({}, 429)], [/nominatim/, () => svar([], 429)]]);
    await assert.rejects(s.sok("Gävle"), (e) => e.code === "429" && e.message === TEXT[429]);
    assert.match(TEXT[429], /för många/);
    assert.match(TEXT[429], /klicka direkt på kartan/);
  });

  it("inget nät → nät-texten; fel cachas inte", async () => {
    let nere = true;
    const { s } = stub([
      [/wbsearchentities/, () => (nere ? new TypeError("Failed to fetch") : svar(GAVLE_SOK))],
      [/wbgetentities/, () => svar(GAVLE_ENT)],
      [/nominatim/, () => new TypeError("Failed to fetch")],
    ]);
    await assert.rejects(s.sok("Gävle"), (e) => e.code === "nat" && e.message === TEXT.nat);
    nere = false;
    assert.equal((await s.sok("Gävle")).traffar.length, 2);
  });

  it("5xx → server-texten (kartan nämns som utväg)", async () => {
    const { s } = stub([[/./, () => svar({}, 502)]]);
    await assert.rejects(s.sok("Gävle"), (e) => e.code === "server" && /klicka direkt på kartan/.test(e.message));
  });

  it("för kort sökord anropar ingenting", async () => {
    const { s, anrop } = stub([]);
    await assert.rejects(s.sok(" G "), (e) => e.code === "kort");
    assert.equal(anrop.length, 0);
  });
});

describe("strypning och cache", () => {
  it("två sökningar direkt efter varandra ligger ≥ 1 s isär", async () => {
    const { s, anrop, vantat } = stub(wdRoutes(GAVLE_SOK, GAVLE_ENT));
    await s.sok("Gävle");
    await s.sok("Sandviken");
    const starter = anrop.filter((a) => /wbsearchentities/.test(a.url)).map((a) => a.t);
    assert.equal(starter.length, 2);
    assert.ok(starter[1] - starter[0] >= MIN_MS, `${starter}`);
    assert.deepEqual(vantat, [MIN_MS]);
  });

  it("anrop till Nominatim ligger alltid ≥ 1 s isär, även efter Wikidata-reserven", async () => {
    const { s, anrop, klocka } = stub([[/wbsearchentities/, () => svar({ search: [] })], [/nominatim/, () => svar([{ osm_type: "node", osm_id: 1, name: "A", lat: "60", lon: "17" }])]]);
    await s.sok("aa");
    klocka.t += 300;
    await s.sok("bb", { kalla: "osm" });
    const nom = anrop.filter((a) => /nominatim/.test(a.url)).map((a) => a.t);
    assert.equal(nom.length, 2);
    assert.ok(nom[1] - nom[0] >= MIN_MS, `${nom}`);
  });

  it("efter en sekund behövs ingen väntan", async () => {
    const { s, vantat, klocka } = stub(wdRoutes(GAVLE_SOK, GAVLE_ENT));
    await s.sok("Gävle");
    klocka.t += 1500;
    await s.sok("Sandviken");
    assert.deepEqual(vantat, []);
  });

  it("samma sökord igen → cachen, inga nya anrop och ingen väntan", async () => {
    const { s, anrop, vantat } = stub(wdRoutes(GAVLE_SOK, GAVLE_ENT));
    await s.sok("Gävle");
    const r = await s.sok("  gävle ", { scope: "europa" });
    assert.equal(anrop.length, 2);
    assert.deepEqual(vantat, []);
    assert.equal(r.traffar[0].kalla, "wikidata:Q2643");
  });
});
