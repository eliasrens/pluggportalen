// ============================================================================
// Hitta rätt! (#634): namnfilerna <geo>.namn.json för lärarvyns områdesval.
//   Varje område i varje geofil har ett svenskt namn (via nyckelfilen), de
//   officiella packens namn vinner, och eleven laddar aldrig namnfilen.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { byggNamn } from "../admin/hitta-ratt-namn.mjs";

const ROT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEO = join(ROT, "src/hitta-ratt/content/geo");
const PACKS = join(ROT, "src/hitta-ratt/content/packs");
const SOM_NYCKELN = new Set(["USA"]); // namnet råkar vara samma som nyckeln
const lasJson = (fil) => JSON.parse(readFileSync(fil, "utf8"));
const geoer = readdirSync(GEO).filter((f) => f.endsWith(".json") && f.split(".").length === 2).map((f) => f.replace(/\.json$/, ""));

describe("namnfilerna", () => {
  it("finns för alla fyra geofiler", () => {
    assert.deepEqual(geoer.sort(), ["europa", "sverige-lan", "sverige-landskap", "varlden"]);
  });

  for (const geo of geoer) {
    it(`${geo}: varje område i geofilen har ett namn`, () => {
      const geofil = lasJson(join(GEO, `${geo}.json`));
      const nycklar = lasJson(join(GEO, `${geo}.nycklar.json`));
      const namn = lasJson(join(GEO, `${geo}.namn.json`));
      const keyFor = new Map(Object.entries(nycklar).map(([k, id]) => [id, k]));
      for (const o of geofil.omraden) {
        const key = keyFor.get(o.id);
        assert.ok(key, `${geo} ${o.id} saknar nyckel`);
        const n = namn[key];
        assert.equal(typeof n, "string", `${geo} ${key} saknar namn`);
        assert.ok(n.trim().length >= 2 && n.length <= 60, `${geo} ${key}: "${n}"`);
        if (n === key) assert.ok(SOM_NYCKELN.has(key), `${geo} ${key}: bara källnyckeln`);
      }
      assert.equal(Object.keys(namn).length, Object.keys(nycklar).length, "inga extra namn");
    });
  }

  it("de officiella packens namn används för samma nyckel", () => {
    for (const f of readdirSync(PACKS).filter((f) => f !== "index.json")) {
      const p = lasJson(join(PACKS, f));
      if (p.type !== "area") continue;
      const namn = lasJson(join(GEO, `${p.geo}.namn.json`));
      for (const it of p.items) assert.equal(namn[it.key], it.name, `${f} ${it.key}`);
    }
  });

  it("byggNamn: pack först, sedan Natural Earth (med rättning), sist nyckeln", () => {
    const perGeo = new Map([["varlden", new Map([["SWE", "Sverige"]])], ["europa", new Map([["NOR", "Norge"]])], ["sverige-lan", new Map([["SE-X", "Gävleborgs län"]])]]);
    const ne = new Map([["SWE", "Sverige (NE)"], ["NOR", "Norge (NE)"], ["SWZ", "Swaziland"], ["FRA", "Frankrike"]]);
    const { namn, kallor } = byggNamn("varlden", { SWE: "o1", NOR: "o2", SWZ: "o3", FRA: "o4", XXX: "o5", "SE-X": "o6" }, perGeo, ne);
    assert.deepEqual(namn, { FRA: "Frankrike", NOR: "Norge", "SE-X": "SE-X", SWE: "Sverige", SWZ: "Eswatini", XXX: "XXX" });
    assert.deepEqual(kallor, { pack: 2, ne: 2, nyckel: 2 });
  });

  it("elevsidan laddar aldrig namnfilen (bara lärarvyn)", () => {
    const dir = join(ROT, "src/hitta-ratt");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      assert.doesNotMatch(readFileSync(join(dir, f), "utf8"), /namn\.json/, f);
    }
    assert.match(readFileSync(join(dir, "larare/lhr-data.js"), "utf8"), /\.namn\.json/);
  });
});
