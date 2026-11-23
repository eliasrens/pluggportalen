// ============================================================================
// Butiken på servern (#854, epic #851, docs/SAKERHET-MYNT.md §6 B2) – den rena
// kärnan src/butik-core.js (kopVara), synken till functions/butik/, klientlagret
// src/butik-kop.js och bootgrafen (107).
//   varje kategori (K1–K8 + mysterylådan E6), priset ur katalogen (klientens pris
//   finns inte ens i anropet), för lite pengar, okänd vara, comingSoon, mystery-vara
//   direkt, säsong av/på, single som redan ägs, multi-räknaren +1, ägget med
//   hatchSpecies ur katalogen, gårdsuppgraderingar i ordning, djurplats,
//   mysterylådan med fast rng (ny vara och dubblett), agdaDjur för ägg/djur/gårdsdjur
// Körs med: node --test test/butik-core.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { butikVara, kopVara, rumsdjurMedAldre, samlingOppen } from "../src/butik-core.js";
import { getItem, KOP_AVATARER, SHOP_ITEMS } from "../src/shop-items.js";
import { MYSTERY_BOXES, MYSTERY_ITEMS, dupCoins } from "../src/mystery-items.js";
import { HW_DJUR_VAROR } from "../src/halloween/hw-djur-katalog.js";
import { HW_KOSTYMER_KATALOG } from "../src/halloween/hw-kostymer.js";
import { HW_SPECIES } from "../src/art-pets-creatures.js";
import { driftedFiles, sharedFiles, FILER, SRC } from "../admin/sync-butik-functions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NU = Date.UTC(2026, 9, 20, 10);
const HALLOWEEN = { halloween: true };
const fast = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const kop = (data, id, opt = {}) => kopVara(data, butikVara(id), { nu: NU, rng: fast(0.5), ...opt });

/** Patchen som update() skriver den (dot-path "farm.animals" → farm.animals). */
function tillampa(data, patch) {
  const ut = structuredClone(data);
  for (const [k, v] of Object.entries(patch || {})) {
    const delar = k.split(".");
    let o = ut;
    for (const d of delar.slice(0, -1)) o = o[d] ??= {};
    o[delar.at(-1)] = structuredClone(v);
  }
  return ut;
}

describe("katalogen på servern (butikVara)", () => {
  it("statiska varor, mysterylådorna, köpavatarerna och de lazy Halloween-raderna", () => {
    assert.equal(butikVara("keps").price, 20);
    for (const b of MYSTERY_BOXES) assert.equal(butikVara(b.id).price, b.price);
    for (const a of KOP_AVATARER) assert.equal(butikVara(a.id).category, "avatar");
    for (const k of HW_KOSTYMER_KATALOG) assert.equal(butikVara(k.id).price, k.price);
    for (const v of HW_DJUR_VAROR) assert.equal(butikVara(v.id).hatchSpecies, v.id.slice("hw-djur-".length));
    for (const id of [undefined, null, 5, "", "finnsinte", "__proto__", "constructor"]) assert.equal(butikVara(id), null, String(id));
  });
  it("Halloween-djurens katalog följer HW_SPECIES (id, namn, ordning)", () => {
    assert.deepEqual(HW_DJUR_VAROR.map((v) => [v.hatchSpecies, v.name]), HW_SPECIES.map((s) => [s.id, s.name]));
    for (const v of HW_DJUR_VAROR) assert.equal(v.price, 500);
  });
  it("köpavatarerna står i shop-items.js en gång (avatars.js lägger inte till dem igen)", () => {
    assert.equal(SHOP_ITEMS.filter((it) => it.category === "avatar").length, KOP_AVATARER.length);
  });
});

describe("kopVara – vanliga varor (K1)", () => {
  it("klädsak: priset ur katalogen, ownedItems, ingen räknare", () => {
    const r = kop({ coins: 100, ownedItems: ["ballong"] }, "keps");
    assert.equal(r.ok, true);
    assert.deepEqual(r.patch, { coins: 80, ownedItems: ["ballong", "keps"] });
    assert.deepEqual(r.result, { ok: true, coins: 80, owned: ["ballong", "keps"], counts: {} });
  });
  it("single som redan ägs → ok:true utan skrivning (inget dras)", () => {
    const r = kop({ coins: 100, ownedItems: ["keps"] }, "keps");
    assert.equal(r.ok, true);
    assert.equal(r.patch, null);
    assert.equal(r.result.coins, 100);
  });
  it("multi (möbel): räknaren +1 per köp, äldre köp utan räknare räknas som 1", () => {
    const r1 = kop({ coins: 500, ownedItems: [] }, "soffa");
    assert.deepEqual(r1.patch, { coins: 340, ownedItems: ["soffa"], ownedCounts: { soffa: 1 } });
    const r2 = kop(tillampa({ coins: 500, ownedItems: [] }, r1.patch), "soffa");
    assert.deepEqual(r2.patch.ownedCounts, { soffa: 2 });
    assert.deepEqual(kop({ coins: 500, ownedItems: ["soffa"] }, "soffa").patch.ownedCounts, { soffa: 2 }, "äldre dokument");
    assert.equal(kop({ coins: 500, ownedCounts: { crop_carrot: 3 } }, "crop_carrot").patch.ownedCounts.crop_carrot, 4, "frön");
  });
  it("husskal, lada-skin, rumsuppgradering och köpavatar är single-varor i ownedItems", () => {
    for (const id of ["slott", "lada-bla", "rum-2"]) {
      const r = kop({ coins: 99999 }, id);
      assert.deepEqual(r.patch, { coins: 99999 - getItem(id).price, ownedItems: [id] }, id);
    }
    const av = kop({ coins: 1000 }, "hw-av-spoke", { sasong: HALLOWEEN });
    assert.deepEqual(av.patch, { coins: 600, ownedItems: ["hw-av-spoke"] });
  });
  it("för lite pengar → ok:false, ingen skrivning", () => {
    const r = kop({ coins: 19, ownedItems: [] }, "keps");
    assert.equal(r.ok, false);
    assert.equal(r.patch, null);
    assert.deepEqual([r.result.ok, r.result.coins, r.result.owned], [false, 19, []]);
    assert.equal(kop({}, "keps").ok, false, "saknat saldo = 0");
    assert.equal(kop({ coins: "99999" }, "keps").ok, false, "saldo som sträng räknas inte");
  });
  it("okänd vara, comingSoon, mystery-vara direkt och pris 0 → ok:false", () => {
    assert.equal(kopVara({ coins: 9999 }, null, { nu: NU }).ok, false);
    assert.equal(kopVara({ coins: 9999 }, { ...getItem("keps"), comingSoon: true }, { nu: NU }).ok, false);
    const myst = MYSTERY_ITEMS.find((it) => !it.existingShopItem);
    assert.equal(kop({ coins: 9999 }, myst.id).ok, false, `${myst.id} (pris 0, mysteryOnly)`);
    assert.equal(kopVara({ coins: 9999 }, { ...getItem("keps"), price: 0 }, { nu: NU }).ok, false);
  });
  it("klientens pris finns inte: varan bär katalogpriset, en förfalskad post har inget att säga till om", () => {
    assert.match(kod("src/butik-kop.js"), /\(\{ itemId \}\)/);
    assert.doesNotMatch(kod("src/butik-kop.js"), /price/);
    assert.doesNotMatch(kod("functions/butik-kop.js"), /data\.price|request\.data\.price/);
  });
});

describe("säsongsvaror (Halloween)", () => {
  it("utanför säsong nekas, under säsong säljs, slutdatumet gäller", () => {
    assert.equal(kop({ coins: 999 }, "hw-pumpalykta").ok, false, "ingen config/season");
    assert.equal(kop({ coins: 999 }, "hw-pumpalykta", { sasong: { halloween: false } }).ok, false);
    assert.equal(kop({ coins: 999 }, "hw-pumpalykta", { sasong: HALLOWEEN }).ok, true);
    assert.equal(kop({ coins: 999 }, "hw-haxhatt", { sasong: { halloween: true, halloweenUntil: NU - 1 } }).ok, false);
    assert.equal(kop({ coins: 999 }, "hw-haxhatt", { sasong: { halloween: true, halloweenUntil: NU + 1 } }).ok, true);
    assert.equal(samlingOppen("jul", HALLOWEEN, NU), false, "okänd samling");
  });
});

describe("säsongsvaror (Jul, #910) – lazy i webben, okända för serverns SHOP_ITEMS", () => {
  const JUL = { season: "vinter", jul: true };
  it("dekor/möbler/trädgård räknas upp i ownedCounts vid varje köp, husen är single", () => {
    assert.equal(getItem("jul-snogubbe"), null, "som på servern: inte i SHOP_ITEMS");
    const forsta = kop({ coins: 200 }, "jul-snogubbe", { sasong: JUL });
    assert.deepEqual(forsta.patch, { coins: 140, ownedItems: ["jul-snogubbe"], ownedCounts: { "jul-snogubbe": 1 } });
    const andra = kop({ coins: 140, ...forsta.patch }, "jul-snogubbe", { sasong: JUL });
    assert.deepEqual(andra.patch, { coins: 80, ownedItems: ["jul-snogubbe"], ownedCounts: { "jul-snogubbe": 2 } });
    assert.equal(kop({ coins: 999 }, "jul-julgran", { sasong: JUL }).patch.ownedCounts["jul-julgran"], 1);
    assert.equal(kop({ coins: 999 }, "jul-mistel", { sasong: JUL }).patch.ownedCounts["jul-mistel"], 1);
    const hus = kop({ coins: 9000, ownedItems: ["jul-snohydda"] }, "jul-snohydda", { sasong: JUL });
    assert.equal(hus.patch, null, "ett ägt hus köps inte igen");
  });
});

describe("ägg, värmelampa och Mysterymat (K3–K5)", () => {
  it("vanligt ägg: nytt ägg i pets[], 200 mynt, agdaDjur[id] = mystery-egg", () => {
    const r = kop({ coins: 250, pets: [{ id: "p1" }] }, "mystery-egg");
    assert.equal(r.patch.coins, 50);
    const egg = r.patch.pets[1];
    assert.equal(r.patch.pets.length, 2);
    assert.equal(egg.eggBoughtAt, NU);
    assert.equal(egg.hasHeatLamp, false);
    assert.equal(egg.eggSpecies, undefined);
    assert.deepEqual(egg.pos, { x: 50, y: 78 });
    assert.deepEqual(r.patch.agdaDjur, { [egg.id]: "mystery-egg" });
    assert.deepEqual(r.result, { ok: true, coins: 50, pets: r.patch.pets });
  });
  it("Halloween-ägg: arten (hatchSpecies) ur katalogen, 500, lampa ger hasHeatLamp, befintlig karta behålls", () => {
    const r = kop({ coins: 600, ownedItems: ["varmelampa"], agdaDjur: { gammal: "hund" } }, "hw-djur-uggli", { sasong: HALLOWEEN });
    const egg = r.patch.pets[0];
    assert.equal(r.patch.coins, 100);
    assert.equal(egg.eggSpecies, "uggli");
    assert.equal(egg.hasHeatLamp, true);
    assert.deepEqual(r.patch.agdaDjur, { gammal: "hund", [egg.id]: "hw-djur-uggli" });
    assert.equal(kop({ coins: 600 }, "hw-djur-uggli").ok, false, "utanför säsong");
  });
  it("det gamla singular-pet:et migreras till pets[0] vid äggköpet (som förut)", () => {
    const r = kop({ coins: 200, pet: { eggBoughtAt: 5, speciesId: "x", hatchedAt: 6, stage: 2 } }, "mystery-egg");
    assert.equal(r.patch.pets.length, 2);
    assert.equal(r.patch.pets[0].speciesId, "x");
    assert.notEqual(r.patch.pets[0].id, r.patch.pets[1].id);
  });
  it("värmelampa: ownedItems + hasHeatLamp på okläckta ägg; redan ägd → no-op", () => {
    const r = kop({ coins: 130, pets: [{ id: "a" }, { id: "b", hatchedAt: 1 }] }, "varmelampa");
    assert.deepEqual(r.patch, {
      coins: 10, ownedItems: ["varmelampa"], pets: [{ id: "a", hasHeatLamp: true }, { id: "b", hatchedAt: 1 }],
    });
    assert.equal(r.result.owned.length, 1);
    const igen = kop({ coins: 130, ownedItems: ["varmelampa"] }, "varmelampa");
    assert.deepEqual([igen.ok, igen.patch, igen.result.coins], [true, null, 130]);
    assert.equal(kop({ coins: 119 }, "varmelampa").ok, false);
  });
  it("Mysterymat: appleCount +1 för 5 mynt, aldrig ownedItems", () => {
    assert.deepEqual(kop({ coins: 5, appleCount: 2 }, "apple").patch, { coins: 0, appleCount: 3 });
    assert.deepEqual(kop({ coins: 5 }, "apple").result, { ok: true, coins: 0, appleCount: 1 });
    assert.deepEqual(kop({ coins: 4, appleCount: 2 }, "apple").result, { ok: false, coins: 4, appleCount: 2, error: "För få mynt." });
  });
});

describe("vanliga djur och gårdsdjur (K6–K7)", () => {
  it("vanligt djur: ny post i roomAnimals med uid och golvplats, agdaDjur[uid] = art", () => {
    const r = kop({ coins: 200, roomAnimals: [{ uid: "katt", id: "katt" }] }, "hund");
    assert.equal(r.patch.coins, 40);
    const ny = r.patch.roomAnimals[1];
    assert.match(ny.uid, /^hund#[a-z0-9]+$/);
    assert.deepEqual({ ...ny, uid: 0 }, { uid: 0, id: "hund", pos: { x: 50, y: 78 }, name: null, stowed: false });
    assert.deepEqual(r.patch.agdaDjur, { [ny.uid]: "hund" });
    assert.deepEqual(r.result.animals, r.patch.roomAnimals);
  });
  it("äldre djur i ownedItems följer med in i listan (som animalsFromData), utan dubblett av samma art", () => {
    const r = kop({ coins: 200, ownedItems: ["kanin", "keps"], roomAnimals: [] }, "kanin");
    assert.deepEqual(r.patch.roomAnimals.map((a) => [a.uid.split("#")[0], a.id]), [["kanin", "kanin"], ["kanin", "kanin"]]);
    assert.equal(r.patch.roomAnimals[0].uid, "kanin");
    assert.equal(Object.keys(r.patch.agdaDjur).length, 1, "bara det köpta djuret får en post i köpet");
    assert.deepEqual(rumsdjurMedAldre({ ownedItems: ["hund"], roomAnimals: [{ uid: "hund", id: "katt" }] }).map((a) => a.uid), ["hund", "hund#2"]);
  });
  it("gårdsdjur: farm.animals (dot-path), trivsel 80, agdaDjur[uid] = art; resten av gården orörd", () => {
    const data = { coins: 300, farm: { barnLevel: 2, animals: [{ uid: "animal_pig#1", id: "animal_pig" }] } };
    const r = kop(data, "animal_horse");
    assert.deepEqual(Object.keys(r.patch).sort(), ["agdaDjur", "coins", "farm.animals"]);
    assert.equal(r.patch.coins, 50);
    const hast = r.patch["farm.animals"][1];
    assert.equal(hast.id, "animal_horse");
    assert.equal(hast.trivsel, 80);
    assert.deepEqual(r.patch.agdaDjur, { [hast.uid]: "animal_horse" });
    assert.deepEqual(r.result.animal, hast);
    assert.equal(tillampa(data, r.patch).farm.barnLevel, 2);
    assert.equal(kop({ coins: 249 }, "animal_horse").ok, false);
  });
  it("djur, gårdsdjur och ägg kan köpas igen – varje köp är ett nytt uid", () => {
    let data = { coins: 2000 };
    const uids = new Set();
    for (let i = 0; i < 3; i++) {
      const r = kopVara(data, butikVara("animal_cow"), { nu: NU, rng: fast(0.25) });
      data = tillampa(data, r.patch);
      uids.add(r.result.animal.uid);
    }
    assert.equal(uids.size, 3, "samma tid och slump ger ändå unika uid");
    assert.equal(Object.keys(data.agdaDjur).length, 3);
  });
});

describe("gårdsuppgraderingar (K8)", () => {
  it("köps i ordning: nivå 2 före 3, aldrig ownedItems", () => {
    assert.deepEqual(kop({ coins: 1000 }, "odling-3").result.error, "fel nivå");
    const r2 = kop({ coins: 1000 }, "odling-2");
    assert.deepEqual(r2.patch, { coins: 850, "farm.gardenTier": 2 });
    assert.equal(r2.result.farm.gardenTier, 2);
    const efter = tillampa({ coins: 1000 }, r2.patch);
    assert.deepEqual(kop(efter, "odling-3").patch, { coins: 500, "farm.gardenTier": 3 });
    assert.equal(kop(efter, "odling-2").ok, false, "samma nivå igen");
    assert.deepEqual(kop({ coins: 450 }, "lada-2").patch, { coins: 0, "farm.barnLevel": 2 });
    assert.equal(kop({ coins: 449 }, "lada-2").result.error, "för få coins");
  });
});

describe("mysterylådan (K2/E6) – lottningen i kärnan", () => {
  it("ny vara med fast rng: priset ur katalogen, varan i ownedItems", () => {
    const r = kopVara({ coins: 600, ownedItems: [] }, butikVara("mysterybox"), { nu: NU, rng: fast(0) });
    assert.equal(r.ok, true);
    assert.equal(r.result.duplicate, false);
    assert.equal(r.result.refund, 0);
    assert.equal(r.result.item.rarity, "vanlig");
    assert.deepEqual(r.patch, { coins: 100, ownedItems: [r.result.item.id] });
  });
  it("dubblett: varan finns redan → dupCoins tillbaka, ownedItems oförändrad", () => {
    const forst = kopVara({ coins: 600 }, butikVara("mysterybox"), { nu: NU, rng: fast(0) }).result.item;
    const r = kopVara({ coins: 600, ownedItems: [forst.id] }, butikVara("mysterybox"), { nu: NU, rng: fast(0) });
    assert.equal(r.result.duplicate, true);
    assert.equal(r.result.refund, dupCoins(forst.rarity));
    assert.deepEqual(r.patch, { coins: 600 - 500 + 40, ownedItems: [forst.id] });
    assert.equal(r.result.coins, 140);
  });
  it("lådans legendaryChance ur katalogen: Epic (0.9) ger legendarisk för rng 0.5", () => {
    const r = kopVara({ coins: 2000 }, butikVara("mysterybox-epic"), { nu: NU, rng: fast(0.5) });
    assert.equal(r.result.item.rarity, "legendary");
    assert.equal(r.patch.coins, 0);
    assert.equal(kopVara({ coins: 249 }, butikVara("mysterybox-mini"), { nu: NU }).ok, false);
  });
});

describe("synken till functions/butik/ (admin/sync-butik-functions.mjs)", () => {
  it("kopian är i synk och innehåller exakt de delade filerna", () => {
    assert.deepEqual(driftedFiles(), []);
    assert.deepEqual(sharedFiles(), [
      "butik-core.js", "shop-items.js", "mystery-items.js", "season-config.js", "farm-core.js", "klass-membership.js",
      "halloween/hw-kostymer.js", "halloween/hw-djur-katalog.js", "jul/jul-katalog.js",
    ]);
  });
  it("--check går igenom", () => {
    const ut = execFileSync(process.execPath, [join(ROOT, "admin/sync-butik-functions.mjs"), "--check"], { encoding: "utf8" });
    assert.match(ut, /synkad/);
  });
  it("den delade koden är ren: inga webbläsar-/Firebase-importer, bara relativa importer inom listan", () => {
    for (const f of FILER) {
      const src = readFileSync(join(SRC, f), "utf8");
      const utanKommentar = src.replace(/^\s*\/\/.*$/gm, "");
      assert.doesNotMatch(utanKommentar, /\b(document|window|localStorage)\./, `${f}: webbläsar-API`);
      for (const [, spec] of src.matchAll(/(?:import|export)[^"';]*from\s+["']([^"']+)["']/g)) {
        const mal = join(dirname(f), spec).replace(/\\/g, "/");
        assert.ok(spec.startsWith("."), `${f}: ${spec}`);
        assert.ok(FILER.includes(mal), `${f}: ${spec} måste också vara delad`);
      }
    }
  });
  it("npm-skriptet, predeploy, index-exporten och proxyn finns", () => {
    const pkg = JSON.parse(las("package.json"));
    assert.equal(pkg.scripts["sync:butik"], "node admin/sync-butik-functions.mjs");
    assert.match(pkg.scripts["test:functions"], /test\/functions-butik\.test\.mjs/);
    assert.match(las("firebase.json"), /sync-butik-functions\.mjs/);
    assert.match(las("functions/index.js"), /export \{ butikKop \} from "\.\/butik-kop\.js";/);
    assert.match(las("admin/qa-emulator-proxy.mjs"), /"\/butikKop"/);
    assert.match(kod("functions/butik-kop.js"), /onCall\(\{ region: "europe-west1", maxInstances: 3, memory: "256MiB" \}/);
  });
});

describe("klienten: alla köp via butikKop, bootgrafen 107", () => {
  it("pages-shop.js och data-mystery.js laddar butik-kop.js dynamiskt; inga klientköp kvar", () => {
    assert.match(kod("src/pages-shop.js"), /await import\("\.\/butik-kop\.js"\)/);
    assert.match(kod("src/data-mystery.js"), /await import\("\.\/butik-kop\.js"\)/);
    assert.match(kod("src/pages-shop.js"), /runMysteryBox\(\{ id: item\.id \}\)/);
    const alla = ["data.js", "data-pet.js", "data-pet-mat.js", "data-animals.js", "data-farm.js", "data-mystery.js", "data-classes.js"]
      .map((f) => kod("src/" + f)).join("\n");
    for (const f of ["buyItem", "buyEgg", "buyHeatLamp", "buyApple", "buyAnimal", "buyFarmAnimal", "buyFarmUpgrade",
      "donateToClassProject", "setBarnLevel", "setGardenTier"]) {
      assert.doesNotMatch(alla, new RegExp(`\\b${f}\\b`), f);
    }
    assert.doesNotMatch(kod("src/data-mystery.js"), /runTransaction|rollMysteryItem/);
  });
  it("ett nekat köp visar serverns skäl när varan inte säljs, annars saldotexten (F1)", () => {
    const shop = kod("src/pages-shop.js");
    assert.equal((shop.match(/flash\(nekadText\(res, "Du har inte råd/g) || []).length, 2, "vanliga köp + mysterylådan");
    const monster = /säljs inte\|finns inte/;
    assert.match(shop, monster);
    const nej = (id, sasong) => kopVara({ coins: 9999 }, butikVara(id), { nu: NU, sasong }).result.error;
    assert.match(nej("hw-pumpalykta", { halloween: false }), /säljs inte/, "säsongen stängd");
    assert.match(kopVara({ coins: 9999 }, null).result.error, /finns inte/);
    assert.doesNotMatch(kop({ coins: 0 }, "keps").result.error, /säljs inte|finns inte/, "för få mynt → standardtexten");
  });
  it("plantSeed skriver markören lastFro", () => {
    assert.match(kod("src/data-farm.js"), /\["ownedCounts\." \+ cropId\]: seeds - 1,\s*lastFro: cropId,/);
  });
  it("bootgrafen är kvar på 107 utan butik-kop.js, butik-core.js eller Functions-SDK:t", () => {
    const g = bootgraf();
    assert.equal(g.size, 107);
    for (const f of ["src/butik-kop.js", "src/butik-core.js", "src/halloween/hw-djur-katalog.js"]) assert.ok(!g.has(f), f);
    for (const f of g) assert.doesNotMatch(las(f), /^\s*import[^;]*firebase-functions\.js/m, f);
  });
});

/** Statiska importer från src/app.js (som admin/qa-bootgraf-bfs.mjs, men arbetskopian). */
function bootgraf() {
  const seen = new Set(["src/app.js"]);
  const q = ["src/app.js"];
  const re = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g;
  while (q.length) {
    const f = q.shift();
    for (const [, s] of las(f).matchAll(re)) {
      if (!s.startsWith(".")) continue;
      const p = join(dirname(f), s).replace(/\\/g, "/");
      if (!seen.has(p)) {
        seen.add(p);
        q.push(p);
      }
    }
  }
  return seen;
}
