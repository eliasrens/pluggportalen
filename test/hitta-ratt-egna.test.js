// ============================================================================
// Hitta rätt! (#633): lärarens egna pack – de rena delarna.
//   normaliseraPack (gränser, scope, områden, härledda fält), facitnyckel,
//   kompaktFacit (officiella = oförändrat), scope-rutor, startvy "auto",
//   startsidans "Från din lärare" + personbästa per version, felvyer,
//   bootgrafen (inga nya filer, 107).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseraPack, nyttPackId, slugId, EGEN_ID_RE, IKONER, GRANS } from "../src/hitta-ratt/delat/egna.js";
import { facitNyckel, kompaktFacit } from "../src/hitta-ratt/delat/facit.js";
import { SCOPE_RUTA, GEO_SCOPE, STANDARD, inomScope } from "../src/hitta-ratt/delat/scope.js";
import { HrFel } from "../src/hitta-ratt/delat/omgang.js";
import { SCOPES } from "../src/hitta-ratt/karta/projektion.js";
import { egnaForElev, delasMed, startvyAuto, egetSparFel, STARTVY_MIN_ANDEL } from "../src/hitta-ratt/hr-egna.js";
import { startsidaHtml, packKortHtml } from "../src/hitta-ratt/hr-start-vy.js";
import { topplisteGrupper, topplistorVyHtml } from "../src/hitta-ratt/hr-topplista-vy.js";
import { geoOmraden, packFacit } from "../admin/sync-hitta-ratt-functions.mjs";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const lasJson = (rel) => JSON.parse(readFileSync(join(SRC, "hitta-ratt/content", rel), "utf8"));
const GEO_OMR = geoOmraden();
const ID = "e-k3f9q0z1m2xa";

const punkt = (over = {}) => ({
  id: ID, title: "  Gästrikland   runt ", description: "Orter", ikon: "🏞️", type: "point", geo: "sverige-landskap",
  classIds: ["5E", "5A", "5E"],
  items: [
    { id: "gavle", name: "Gävle", lat: 60.674912345, lon: 17.1413, kalla: "wikidata:Q25748" },
    { name: "Sandviken", prompt: "", lat: 60.6167, lon: 16.7667 },
    { name: "Hofors", prompt: "Var ligger bruksorten Hofors?", lat: 60.55, lon: 16.2833 },
  ],
  ...over,
});
const omrade = (over = {}) => ({
  id: ID, title: "Norrland", type: "area", geo: "sverige-landskap", classIds: ["5E"],
  items: [{ name: "Lappland", omrade: GEO_OMR["sverige-landskap"] ? Object.keys(GEO_OMR["sverige-landskap"])[0] : "o1" }],
  ...over,
});
const norm = (p, opt = {}) => normaliseraPack(p, { geoOmraden: GEO_OMR, ...opt });
const felkod = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof HrFel, `HrFel väntades, fick ${e}`);
    return e.message;
  }
  return "ok";
};

describe("normaliseraPack – städning och härledda fält", () => {
  it("punktpack: trim, standardtexter, slug-id, avrundning, härledda fält", () => {
    const p = norm(punkt());
    assert.equal(p.title, "Gästrikland runt");
    assert.equal(p.category, "egna");
    assert.equal(p.official, false);
    assert.equal(p.visaGranser, "svag");
    assert.deepEqual(p.scoringConfig, { fullKm: 5, halvKm: 90 });
    assert.equal(p.maxZoom, 10);
    assert.equal(p.startvy, "auto");
    assert.deepEqual(p.classIds, ["5A", "5E"], "unika och sorterade");
    assert.deepEqual(p.items.map((i) => i.id), ["gavle", "sandviken", "hofors"]);
    assert.equal(p.items[0].lat, 60.67491, "≈ 1 m – stabil nyckel");
    assert.equal(p.items[1].prompt, "Var ligger Sandviken?");
    assert.equal(p.items[2].prompt, "Var ligger bruksorten Hofors?");
    assert.equal(p.items[0].kalla, "wikidata:Q25748");
  });

  it("områdespack: källnyckeln sätts av servern ur geofilen, gränser PÅ, 700 ms", () => {
    const [id, key] = Object.entries(GEO_OMR.europa).find(([, k]) => k === "SWE");
    const p = norm(omrade({ geo: "europa", items: [{ name: "Sverige", omrade: id, key: "FEJK" }] }));
    assert.deepEqual(p.items[0], { id: "sverige", name: "Sverige", prompt: "Hitta Sverige", omrade: id, key });
    assert.equal(p.visaGranser, true);
    assert.deepEqual(p.scoringConfig, { minMsPerFraga: 700 });
    assert.equal(p.maxZoom, 16);
  });

  it("ikon ur listan, annars standard; leaderboard/owner tas aldrig från indata, ogiltig bild tas bort", () => {
    assert.equal(norm(punkt({ ikon: "💩" })).ikon, IKONER[0]);
    const p = norm(punkt({ leaderboard: true, ownerUid: "x", version: 9, items: [{ name: "A", lat: 60, lon: 17, bild: { id: "x" } }] }));
    for (const f of ["leaderboard", "ownerUid", "version"]) assert.equal(f in p, false, f);
    assert.equal("bild" in p.items[0], false, "ogiltigt bild-id → ingen bild (#637)");
    assert.equal(norm(punkt({ startvy: "hel" })).startvy, "hel");
    assert.equal(norm(punkt({ startvy: "konstig" })).startvy, "auto");
  });

  it("dubbla namn får -2; uttryckligen dubbla id nekas", () => {
    const p = norm(punkt({ items: [{ name: "Ön", lat: 60, lon: 17 }, { name: "Ön", lat: 61, lon: 17 }] }));
    assert.deepEqual(p.items.map((i) => i.id), ["on", "on-2"]);
    assert.match(felkod(() => norm(punkt({ items: [{ id: "a", name: "A", lat: 60, lon: 17 }, { id: "a", name: "B", lat: 61, lon: 17 }] }))), /samma id/);
    assert.equal(slugId("Västerås slott!"), "vasteras-slott");
  });
});

describe("normaliseraPack – gränser (§11.1)", () => {
  const lang = (n) => "x".repeat(n);
  it("titel 1–60, beskrivning ≤ 200, namn 1–60, prompt ≤ 120", () => {
    assert.match(felkod(() => norm(punkt({ title: "  " }))), /Namnet saknas/);
    assert.equal(felkod(() => norm(punkt({ title: lang(60) }))), "ok");
    assert.match(felkod(() => norm(punkt({ title: lang(61) }))), /högst 60/);
    assert.match(felkod(() => norm(punkt({ description: lang(201) }))), /högst 200/);
    assert.match(felkod(() => norm(punkt({ items: [{ name: lang(61), lat: 60, lon: 17 }] }))), /högst 60/);
    assert.match(felkod(() => norm(punkt({ items: [{ name: "A", prompt: lang(121), lat: 60, lon: 17 }] }))), /högst 120/);
    assert.match(felkod(() => norm(punkt({ items: [{ name: "", lat: 60, lon: 17 }] }))), /namn saknas/);
  });

  it("1–60 frågor", () => {
    assert.match(felkod(() => norm(punkt({ items: [] }))), /minst en/);
    const items = (n) => Array.from({ length: n }, (_, i) => ({ name: `Ort ${i}`, lat: 60, lon: 17 }));
    assert.equal(norm(punkt({ items: items(GRANS.items) })).items.length, 60);
    assert.match(felkod(() => norm(punkt({ items: items(61) }))), /högst 60/);
  });

  it("klasser ≤ 20 och måste finnas (servern skickar befintliga)", () => {
    const k = Array.from({ length: 21 }, (_, i) => `k${i}`);
    assert.match(felkod(() => norm(punkt({ classIds: k }))), /högst 20/);
    assert.match(felkod(() => norm(punkt({ classIds: ["5E", "9Z"] }), { klasser: ["5E"] })), /finns inte/);
    assert.match(felkod(() => norm(punkt({ classIds: ["a/b"] }))), /ogiltiga/);
    assert.deepEqual(norm(punkt({ classIds: undefined })).classIds, []);
  });

  it("id, typ och geo", () => {
    assert.match(felkod(() => norm(punkt({ id: "sverige-stader" }))), /id är ogiltigt/);
    assert.match(felkod(() => norm(punkt({ id: "e-KORT" }))), /id är ogiltigt/);
    assert.match(felkod(() => norm(punkt({ type: "linje" }))), /Frågetypen/);
    assert.match(felkod(() => norm(punkt({ geo: "mars" }))), /Okänd karta/);
    assert.match(felkod(() => norm(punkt({ geo: ["europa"] }))), /Okänd karta/);
    assert.match(felkod(() => norm(punkt({ geo: "constructor" }))), /Okänd karta/);
    assert.match(felkod(() => norm(punkt({ items: [{ id: "Ö!", name: "A", lat: 60, lon: 17 }] }))), /ogiltigt id/);
  });

  it("scope: punkter utanför geofilens ruta nekas (Eiffeltornet på Sverigekartan)", () => {
    assert.match(felkod(() => norm(punkt({ items: [{ name: "Eiffeltornet", lat: 48.8584, lon: 2.2945 }] }))), /utanför kartan/);
    assert.equal(felkod(() => norm(punkt({ geo: "europa", items: [{ name: "Eiffeltornet", lat: 48.8584, lon: 2.2945 }] }))), "ok");
    assert.match(felkod(() => norm(punkt({ items: [{ name: "A", lat: "60", lon: 17 }] }))), /saknas/);
    assert.match(felkod(() => norm(punkt({ items: [{ name: "A", lat: NaN, lon: 17 }] }))), /saknas/);
  });

  it("områden: måste finnas i geofilen och vara unika", () => {
    assert.match(felkod(() => norm(omrade({ items: [{ name: "X", omrade: "o999" }] }))), /finns inte/);
    assert.match(felkod(() => norm(omrade({ items: [{ name: "X", omrade: "toString" }] }))), /finns inte/);
    assert.match(felkod(() => norm(omrade({ items: [{ name: "A", omrade: "o1" }, { name: "B", omrade: "o1" }] }))), /finns redan/);
    // Lista i stället för map (lärarvyn kan skicka geofilens id-lista).
    assert.equal(normaliseraPack(omrade({ items: [{ name: "A", omrade: "o1", key: "k" }] }), { geoOmraden: { "sverige-landskap": ["o1"] } }).items[0].key, "k");
  });

  it("nyttPackId följer EGEN_ID_RE", () => {
    for (let i = 0; i < 50; i++) assert.match(nyttPackId(), EGEN_ID_RE);
    assert.equal(nyttPackId(() => 0), "e-aaaaaaaaaaaa");
  });
});

describe("scope och facit", () => {
  it("SCOPE_RUTA = projektion.js SCOPES; varje geofil har sitt scope", () => {
    for (const [sc, r] of Object.entries(SCOPE_RUTA)) assert.deepEqual(r, SCOPES[sc].ruta, sc);
    for (const [geo, sc] of Object.entries(GEO_SCOPE)) assert.equal(lasJson(`geo/${geo}.json`).scope, sc, geo);
    assert.deepEqual(Object.keys(GEO_OMR).sort(), Object.keys(GEO_SCOPE).sort());
  });

  it("STANDARD = de officiella packens poäng och zoom per scope", () => {
    for (const { id } of lasJson("packs/index.json")) {
      const p = lasJson(`packs/${id}.json`);
      const std = STANDARD[GEO_SCOPE[p.geo]];
      assert.equal(p.maxZoom, std.maxZoom, id);
      if (p.type === "point") assert.deepEqual(p.scoringConfig, std.scoringConfig, id);
    }
    assert.ok(inomScope("sverige", 17.14, 60.67) && !inomScope("sverige", 2.29, 48.86) && !inomScope("mars", 0, 0));
  });

  it("facitnyckeln: bara svaren räknas – inte ordning, texter, klasser eller beskrivning", () => {
    const a = norm(punkt());
    const k = facitNyckel(a);
    const omkastad = { ...a, items: [...a.items].reverse() };
    assert.equal(facitNyckel(omkastad), k, "ordningen spelar ingen roll");
    const texter = norm(punkt({ title: "Annat", description: "ny", classIds: ["7B"], items: punkt().items.map((i) => ({ ...i, prompt: "Hitta!" })) }));
    assert.equal(facitNyckel(texter), k);
    const flyttad = norm(punkt({ items: punkt().items.map((i, n) => (n === 0 ? { ...i, lat: 60.7 } : i)) }));
    assert.notEqual(facitNyckel(flyttad), k, "flyttad punkt");
    assert.notEqual(facitNyckel(norm(punkt({ items: punkt().items.slice(1) }))), k, "borttagen fråga");
    const o1 = norm(omrade({ items: [{ name: "A", omrade: "o1" }] }));
    const o2 = norm(omrade({ items: [{ name: "A", omrade: "o2" }] }));
    assert.notEqual(facitNyckel(o1), facitNyckel(o2), "annat område");
  });

  it("kompaktFacit: officiella oförändrade, egna = topplista AV om inte true", () => {
    const f = packFacit();
    assert.equal(f["sverige-stader"].leaderboard, true);
    assert.equal(f["sverige-landskap"].omraden.length, 25);
    const e = kompaktFacit(norm(omrade()), Object.keys(GEO_OMR["sverige-landskap"]));
    assert.equal(e.leaderboard, false);
    assert.equal(kompaktFacit({ ...norm(punkt()), leaderboard: true }).leaderboard, true);
    assert.deepEqual(e.cfg, { minMsPerFraga: 700 });
    assert.equal(e.omraden.length, 25);
  });
});

describe("elevsidan", () => {
  const katalog = {
    packs: {
      "e-aaaaaaaaaaaa": { title: "Öland", type: "point", geo: "sverige-landskap", antal: 5, classIds: ["5E"], version: 2, ikon: "🏝️" },
      "e-bbbbbbbbbbbb": { title: "Alperna", type: "area", geo: "europa", antal: 7, classIds: ["6C"], version: 1 },
      "e-cccccccccccc": { title: "Gotland", type: "point", geo: "sverige-landskap", antal: 4, classIds: ["5A", "5E"], version: 1 },
      "sverige-stader": { title: "Fel", classIds: ["5E"] },
    },
  };

  it("egnaForElev: bara elevens klasser, sorterade på titel", () => {
    const e = egnaForElev(katalog, ["5E"]);
    assert.deepEqual(e.map((p) => p.title), ["Gotland", "Öland"]);
    assert.equal(e[1].ikon, "🏝️");
    assert.equal(e[1].version, 2);
    assert.deepEqual(egnaForElev(katalog, []), []);
    assert.deepEqual(egnaForElev(null, ["5E"]), []);
    assert.ok(delasMed({ classIds: ["5E"] }, ["5A", "5E"]) && !delasMed({}, ["5E"]));
  });

  it("startsidan: 'Från din lärare' först, 'Egen karta' i stället för svårighet", () => {
    const index = lasJson("packs/index.json");
    const html = startsidaHtml(index, {}, egnaForElev(katalog, ["5E"]));
    assert.ok(html.indexOf("Från din lärare") > 0 && html.indexOf("Från din lärare") < html.indexOf("Sverige</h2>"));
    assert.match(html, /data-pack="e-aaaaaaaaaaaa"/);
    assert.match(html, /Egen karta/);
    assert.doesNotMatch(startsidaHtml(index, {}, []), /Från din lärare/);
  });

  it("personbästa visas bara för packens nuvarande version", () => {
    const [, oland] = egnaForElev(katalog, ["5E"]);
    assert.match(packKortHtml(oland, { typ: "point", s: 420, v: 2 }), /Ditt bästa: <b>420 p/);
    assert.doesNotMatch(packKortHtml(oland, { typ: "point", s: 420, v: 1 }), /Ditt bästa/);
    assert.doesNotMatch(packKortHtml(oland, { typ: "point", s: 420 }), /Ditt bästa/);
  });

  it("felvyer för egna pack", () => {
    assert.equal(egetSparFel("failed-precondition", "Läraren har ändrat kartan – starta en ny omgång.").igen, true);
    assert.equal(egetSparFel("failed-precondition", "Tiden stämmer inte"), null, "vanliga fel → vanliga vyn");
    assert.match(egetSparFel("permission-denied", "").text, /inte delad med din klass/);
    assert.match(egetSparFel("not-found", "").rubrik, /finns inte längre/);
    assert.equal(egetSparFel("unavailable", ""), null);
  });
});

describe("startvy auto", () => {
  const geoSv = lasJson("geo/sverige-landskap.json");
  const geoEu = lasJson("geo/europa.json");
  const ruta = SCOPE_RUTA.sverige;
  const pts = (lista) => ({ type: "point", startvy: "auto", items: lista.map(([lon, lat], i) => ({ id: `p${i}`, lon, lat })) });
  const gastrik = pts([[17.14, 60.67], [16.77, 60.62], [16.28, 60.55], [16.6, 60.9]]);

  it("passar in punkternas utbredning med luft, minst 25 % av scope-rutan", () => {
    const [v, s, o, n] = startvyAuto(gastrik, geoSv);
    assert.ok(v <= 16.28 && o >= 17.14 && s <= 60.55 && n >= 60.9, "alla punkter syns");
    assert.ok(Math.abs(o - v - (ruta[2] - ruta[0]) * STARTVY_MIN_ANDEL) < 1e-9, "minsta bredd");
    assert.ok(Math.abs(n - s - (ruta[3] - ruta[1]) * STARTVY_MIN_ANDEL) < 1e-9, "minsta höjd");
  });

  it("stor utbredning får 30 % luft men aldrig utanför scope-rutan", () => {
    const [v, s, o, n] = startvyAuto(pts([[11, 56], [24, 68], [13, 59], [18, 63]]), geoSv);
    assert.ok(v >= ruta[0] && s >= ruta[1] && o <= ruta[2] && n <= ruta[3]);
    assert.ok(Math.abs(o - v - Math.min(13 * 1.3, ruta[2] - ruta[0])) < 1e-9);
  });

  it("färre än 4 items, 'hel' eller okänd geo → hela kartan (null)", () => {
    assert.equal(startvyAuto(pts([[17, 60], [16, 60], [15, 60]]), geoSv), null);
    assert.equal(startvyAuto({ ...gastrik, startvy: "hel" }, geoSv), null);
    assert.equal(startvyAuto(gastrik, { scope: "mars" }), null);
  });

  it("områden: inre punkten c räknas om till lon/lat", () => {
    const n = GEO_OMR.europa;
    const id = (k) => Object.keys(n).find((o) => n[o] === k);
    const nord = { type: "area", startvy: "auto", items: ["SWE", "NOR", "FIN", "DNK"].map((k) => ({ id: k.toLowerCase(), omrade: id(k) })) };
    const [v, s, o, n2] = startvyAuto(nord, geoEu);
    assert.ok(v < 10 && o > 25 && s < 57 && n2 > 64, `Norden ryms: ${[v, s, o, n2]}`);
    assert.ok(o - v < 45, "inte hela Europa");
  });
});

describe("bootgrafen (#271)", () => {
  it("egna-modulerna laddas bara dynamiskt, grafen är kvar på 107", () => {
    const start = join(SRC, "app.js");
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    for (const f of ["hr-egna.js", "hr-egna-data.js", "delat/egna.js", "delat/facit.js", "delat/scope.js"]) {
      assert.equal(seen.has(join(SRC, "hitta-ratt", f)), false, f);
    }
    assert.equal(seen.size, 107);
  });
});

describe("🏆-vyn: gruppen Från din lärare (#635)", () => {
  const INDEX_TL = lasJson("packs/index.json");
  const katalog = {
    packs: {
      [ID]: { title: "Gästrikland runt", type: "point", geo: "sverige-landskap", antal: 4, classIds: ["5E"], leaderboard: true, version: 2 },
      "e-avavavavavav": { title: "Avstängd", type: "point", geo: "europa", antal: 3, classIds: ["5E"], leaderboard: false, version: 1 },
      "e-andraklass01": { title: "Annan klass", type: "area", geo: "europa", antal: 3, classIds: ["6C"], leaderboard: true, version: 1 },
    },
  };
  it("bara egna pack med topplistan PÅ i elevens klasser, först; officiella som förut", () => {
    const g = topplisteGrupper(INDEX_TL, egnaForElev(katalog, ["5E"]));
    assert.equal(g[0].namn, "Från din lärare");
    assert.deepEqual(g[0].pack.map((p) => p.id), [ID]);
    assert.deepEqual(g.slice(1).map((x) => x.id), topplisteGrupper(INDEX_TL, []).map((x) => x.id));
    assert.ok(!g.some((x) => x.pack.some((p) => p.id === "e-avavavavavav")), "AV syns inte");
    assert.ok(!g.some((x) => x.pack.some((p) => p.id === "e-andraklass01")), "annan klass syns inte");
  });
  it("inga egna med topplista → ingen tom grupp; knappen för packet ritas", () => {
    assert.ok(!topplisteGrupper(INDEX_TL, egnaForElev(katalog, ["9Z"])).some((x) => x.id === "egna"));
    const g = topplisteGrupper(INDEX_TL, egnaForElev(katalog, ["5E"]));
    const html = topplistorVyHtml(g, ID, { typ: "point", top: [], egen: null, plats: null, antal: 0 });
    assert.match(html, /Från din lärare/);
    assert.match(html, new RegExp(`data-pack="${ID}" aria-pressed="true">Gästrikland runt`));
  });
});
