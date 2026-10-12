// Hitta rätt! (#607) – validering av de 12 officiella packen och geofilerna.
//   node --test test/hitta-ratt-packs.test.js
//
// Kontrollerar att varje pack är komplett, att varje områdesitem pekar på en
// giltig geometri (rätt källnyckel), att varje punkt ligger inom packens
// bounds OCH i rätt land/landskap enligt Natural Earth/Lantmäteriet (en
// oberoende kontroll av Wikidata-koordinaterna), att bilderna finns med
// licens, och att geofilerna håller budgeten och inte gör externa anrop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT = join(ROT, "src/hitta-ratt/content");
const las = (rel) => JSON.parse(readFileSync(join(CONTENT, rel), "utf8"));

// Kartmotorns projektion (C #606 lyfter spikens fil till src/hitta-ratt/karta/).
const projFil = ["src/hitta-ratt/karta/projektion.js", "preview/hitta-ratt-spik/projektion.js"]
  .map((r) => join(ROT, r)).find(existsSync);
const { tillKarta, SCOPES } = await import(pathToFileURL(projFil).href);

const index = las("packs/index.json");
const packs = index.map((x) => las(`packs/${x.id}.json`));
const geoCache = {};
const geo = (id) => (geoCache[id] ||= las(`geo/${id}.json`));
const nycklar = (id) => las(`geo/${id}.nycklar.json`);

const SCOPE_FOR_GEO = { "sverige-landskap": "sverige", "sverige-lan": "sverige", europa: "europa", varlden: "varlden" };
const SVARIGHET = new Set(["grund", "medel", "utmaning"]);
const KATEGORI = new Set(["sverige", "europa", "varlden", "kanda-platser"]);
const LICENSER = /^(Public domain|CC0( 1\.0)?|CC BY( \d\.\d)?|CC BY-SA( \d\.\d)?)$/;
// Hur långt (km) en punkt får ligga utanför sitt förenklade land/landskap
// (kuststäder, Venedig i lagunen, gränsberg som Matterhorn).
const TOLERANS_KM = { sverige: 4, europa: 8, varlden: 30 };

// --- SVG-väg (M x y l dx dy … z, heltal) → ringar ----------------------------
function ringar(d) {
  const ut = [];
  for (const del of d.split("M").filter(Boolean)) {
    const tal = del.replace(/[lz]/g, " ").match(/-?\d+/g).map(Number);
    let x = tal[0], y = tal[1];
    const r = [[x, y]];
    for (let i = 2; i + 1 < tal.length; i += 2) { x += tal[i]; y += tal[i + 1]; r.push([x, y]); }
    ut.push(r);
  }
  return ut;
}
function inuti(rs, [px, py]) {
  let inne = false;
  for (const r of rs) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inne = !inne;
    }
  }
  return inne;
}
function avstand(rs, [px, py]) {
  let m = Infinity;
  for (const r of rs) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, ay] = r[j], [bx, by] = r[i];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      m = Math.min(m, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
  }
  return m;
}

test("index.json listar exakt de 12 officiella packen, unika id:n", () => {
  assert.equal(index.length, 12);
  assert.equal(new Set(index.map((x) => x.id)).size, 12);
  for (const x of index) {
    const p = packs.find((q) => q.id === x.id);
    assert.equal(x.antal, p.items.length, x.id);
    assert.equal(x.type, p.type, x.id);
    assert.equal(x.geo, p.geo, x.id);
  }
});

test("varje pack har alla fält enligt §3.1 / §15 / §24", () => {
  for (const p of packs) {
    assert.ok(p.id && /^[a-z0-9-]+$/.test(p.id), p.id);
    assert.equal(p.official, true, p.id);
    assert.equal(p.leaderboard, true, p.id);
    assert.ok(Number.isInteger(p.version) && p.version >= 1, p.id);
    assert.ok(p.title && p.description, p.id);
    assert.ok(KATEGORI.has(p.category), `${p.id}: kategori ${p.category}`);
    assert.ok(SVARIGHET.has(p.difficulty), `${p.id}: svårighet ${p.difficulty}`);
    assert.ok(["point", "area"].includes(p.type), p.id);
    assert.ok(SCOPE_FOR_GEO[p.geo], `${p.id}: okänd geo ${p.geo}`);
    assert.ok(Array.isArray(p.bounds) && p.bounds.length === 4 && p.bounds[0] < p.bounds[2] && p.bounds[1] < p.bounds[3], p.id);
    assert.ok(p.startvy === null || p.startvy.length === 4, p.id);
    assert.ok(p.maxZoom > 1, p.id);
    if (p.type === "point") {
      const { fullKm, halvKm } = p.scoringConfig;
      assert.ok(fullKm > 0 && halvKm > fullKm, `${p.id}: scoringConfig`);
    }
    assert.ok(p.items.length >= 15, `${p.id}: för få items`);
    assert.equal(new Set(p.items.map((it) => it.id)).size, p.items.length, `${p.id}: dubbla item-id`);
    assert.equal(new Set(p.items.map((it) => it.name)).size, p.items.length, `${p.id}: dubbla namn`);
    for (const it of p.items) assert.ok(it.name && it.prompt, `${p.id}/${it.id}`);
  }
});

test("antal enligt specen §14", () => {
  const antal = Object.fromEntries(packs.map((p) => [p.id, p.items.length]));
  assert.deepEqual(antal, {
    "sverige-stader": 20, "sverige-landskap": 25, "sverige-lan": 21, "sverige-geografi": 20,
    "europa-lander-20": 20, "europa-lander-alla": 46, "europa-huvudstader-20": 20, "europa-huvudstader-alla": 46,
    "varlden-lander-30": 30, "varlden-huvudstader-30": 30, "europa-kanda-platser": 20, "varlden-kanda-platser": 20,
  });
});

test("områdesitems pekar på en giltig geometri med rätt källnyckel", () => {
  for (const p of packs.filter((q) => q.type === "area")) {
    const g = geo(p.geo), n = nycklar(p.geo);
    const ids = new Map(g.omraden.map((o) => [o.id, o]));
    const anvanda = new Set();
    for (const it of p.items) {
      assert.equal(n[it.key], it.omrade, `${p.id}/${it.id}: omrade ≠ nycklar[${it.key}] (kör admin/hitta-ratt-packs.mjs)`);
      const o = ids.get(it.omrade);
      assert.ok(o, `${p.id}/${it.id}: ${it.omrade} saknas i ${p.geo}`);
      assert.match(o.d, /^M-?\d+ -?\d+l/, `${p.id}/${it.id}: tom väg`);
      assert.ok(ringar(o.d).some((r) => r.length >= 3), `${p.id}/${it.id}: ingen ring`);
      assert.ok(!anvanda.has(it.omrade), `${p.id}/${it.id}: område används två gånger`);
      anvanda.add(it.omrade);
    }
  }
  // "alla"-packen täcker hela geofilen (inget land/landskap/län saknas).
  for (const [packId, geoId] of [["sverige-landskap", "sverige-landskap"], ["sverige-lan", "sverige-lan"], ["europa-lander-alla", "europa"]]) {
    const p = packs.find((q) => q.id === packId);
    assert.equal(p.items.length, geo(geoId).omraden.length, `${packId} täcker inte ${geoId}`);
  }
  // 20-packen är en delmängd av alla-packen.
  const alla = new Set(packs.find((q) => q.id === "europa-lander-alla").items.map((it) => it.key));
  for (const it of packs.find((q) => q.id === "europa-lander-20").items) assert.ok(alla.has(it.key), it.id);
});

test("varje område har en inre punkt inom kartan (klickring/zoom)", () => {
  for (const id of Object.keys(SCOPE_FOR_GEO)) {
    const g = geo(id);
    for (const o of g.omraden) {
      assert.ok(Array.isArray(o.c) && o.c.every(Number.isFinite), `${id}/${o.id}`);
    }
    assert.equal(new Set(g.omraden.map((o) => o.id)).size, g.omraden.length, `${id}: dubbla id`);
  }
});

test("punkter: giltiga koordinater inom packens bounds och kartan", () => {
  for (const p of packs.filter((q) => q.type === "point")) {
    const g = geo(p.geo);
    const [v, s, o, n] = p.bounds;
    for (const it of p.items) {
      const vem = `${p.id}/${it.id}`;
      assert.ok(Number.isFinite(it.lat) && Number.isFinite(it.lon), vem);
      assert.ok(it.lon >= v && it.lon <= o && it.lat >= s && it.lat <= n, `${vem}: ${it.lat},${it.lon} utanför bounds`);
      const [x, y] = tillKarta(g.proj, it.lon, it.lat);
      assert.ok(x >= 0 && x <= g.proj.bredd && y >= 0 && y <= g.proj.hojd, `${vem}: utanför kartan`);
      assert.ok(it.wikidata && /^Q\d+$/.test(it.wikidata), `${vem}: saknar Wikidata-källa`);
    }
  }
});

test("punkter ligger i rätt land/landskap (oberoende kontroll mot geodatan)", () => {
  let kontrollerade = 0;
  for (const p of packs.filter((q) => q.type === "point")) {
    const g = geo(p.geo), n = nycklar(p.geo);
    const scope = SCOPE_FOR_GEO[p.geo];
    const tol = TOLERANS_KM[scope] * g.proj.s;
    const omr = new Map(g.omraden.map((o) => [o.id, ringar(o.d)]));
    for (const it of p.items.filter((x) => x.inom)) {
      const rs = omr.get(n[it.inom]);
      assert.ok(rs, `${p.id}/${it.id}: okänd inom-nyckel ${it.inom}`);
      const pt = tillKarta(g.proj, it.lon, it.lat);
      const ok = inuti(rs, pt) || avstand(rs, pt) <= tol;
      assert.ok(ok, `${p.id}/${it.id}: ligger inte i ${it.inom} (${(avstand(rs, pt) / g.proj.s).toFixed(1)} km utanför)`);
      kontrollerade++;
    }
  }
  assert.ok(kontrollerade >= 150, `bara ${kontrollerade} punkter har inom-kontroll`);
});

test("huvudstäderna hör till länderna i samma Europadefinition", () => {
  const land = new Set(packs.find((q) => q.id === "europa-lander-alla").items.map((it) => it.key));
  const hs = packs.find((q) => q.id === "europa-huvudstader-alla").items;
  assert.deepEqual(new Set(hs.map((it) => it.inom)), land);
  const hs20 = new Set(packs.find((q) => q.id === "europa-huvudstader-20").items.map((it) => it.inom));
  const l20 = new Set(packs.find((q) => q.id === "europa-lander-20").items.map((it) => it.key));
  assert.deepEqual(hs20, l20);
});

test("bilder (pack 11–12): nerladdade, lagom stora, med fotograf och licens", () => {
  for (const p of packs) {
    const harBild = p.items.filter((it) => it.bild);
    if (p.category !== "kanda-platser") { assert.equal(harBild.length, 0, `${p.id} ska inte ha bilder (§17)`); continue; }
    assert.equal(p.bilder, true, p.id);
    for (const it of p.items) {
      const vem = `${p.id}/${it.id}`, b = it.bild;
      assert.ok(b, `${vem}: saknar bild (kör admin/hitta-ratt-bilder.mjs)`);
      assert.match(b.fil, /^[a-z0-9-]+\.webp$/, vem);
      const fil = join(CONTENT, "bilder", b.fil);
      assert.ok(existsSync(fil), `${vem}: ${b.fil} saknas`);
      assert.ok(statSync(fil).size <= 150 * 1024, `${vem}: bilden är för stor`);
      assert.ok(Math.max(b.bredd, b.hojd) <= 800, `${vem}: över 800 px`);
      assert.ok(b.fotograf && !/[<>]/.test(b.fotograf), `${vem}: fotograf`);
      assert.match(b.licens, LICENSER, `${vem}: licens ${b.licens}`);
      if (!/^Public domain|^CC0/.test(b.licens)) assert.match(b.licensUrl, /^https:\/\/creativecommons\.org\//, vem);
      assert.match(b.kallaUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, vem);
    }
  }
});

test("geofilerna: format v1, budget och inga externa referenser", () => {
  for (const [id, scope] of Object.entries(SCOPE_FOR_GEO)) {
    const txt = readFileSync(join(CONTENT, `geo/${id}.json`), "utf8");
    const g = JSON.parse(txt);
    assert.equal(g.v, 1, id);
    assert.equal(g.scope, scope, id);
    assert.equal(g.proj.typ, SCOPES[scope].typ, id);
    for (const k of ["bakgrund", "sjoar", "vattendrag"]) assert.equal(typeof g.lager[k], "string", `${id}.${k}`);
    assert.ok(!/https?:|\/\//.test(txt), `${id}: extern referens`);
    assert.ok(!/"(name|namn|NAME|title)"/.test(txt), `${id}: geofilen får inte innehålla namn`);
    assert.ok(g.omraden.every((o) => /^o\d+$/.test(o.id)), `${id}: id ska vara ogenomskinliga`);
    const gz = gzipSync(txt).length / 1024;
    assert.ok(gz <= 90, `${id}: ${gz.toFixed(0)} kB gzip > 90`);
    const punkter = (txt.match(/-?\d+ -?\d+/g) || []).length;
    assert.ok(punkter <= 40000, `${id}: ${punkter} punkter > 40 000`);
  }
});

test("en svensk fråga laddar aldrig världsdata", () => {
  for (const p of packs) {
    const scope = SCOPE_FOR_GEO[p.geo];
    if (p.category === "sverige") assert.equal(scope, "sverige", p.id);
    if (p.id.startsWith("europa")) assert.equal(scope, "europa", p.id);
  }
});
