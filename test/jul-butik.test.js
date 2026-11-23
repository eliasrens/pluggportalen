// ============================================================================
// Tester: 🎄 Jul-fliken i butiken (#910, epic #906, DEL D.1–D.2)
//   • katalogen: 9 dekor, 3 möbler, 8 trädgård, 3 hus à 4 000 – `jul-`-id:n,
//     `collection: "jul"`, priser enligt D.2; lazy (bootgrafen, 400-raders-
//     gränsen i shop-items.js) men känd av servern (butikVara)
//   • fliken: en samlingsflik per samling (samling-butik.js) – Halloween och
//     Jul delar koden, undergrupperna i Halloweens ordning, öppen bara när
//     tillägget är på (servern: kopVara + samlingOppen)
//   • mysterylådan och Mysterymaten innehåller aldrig julvaror
//   • konsten: säsongsoberoende, husen har Halloween-husens utsnitt, får
//     vinterns snötäcke via art-hus-ute.js, samma placeringsflöde
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  SHOP_ITEMS, getItem, itemsInCategory, itemsInCollection, isGardenItem, isHouseItem, isMultiItem, isFlatItem,
  isWearable, itemIdFromKey,
} from "../src/shop-items.js";
import { itemSvg, itemSize, categorySvg, loadCollectionArt } from "../src/art-items.js";
import { husSkalMarkup, isHusSkal, listHusSkal } from "../src/art-hus-ute.js";
import { nyPlaceringsNyckel, rumSakHtml } from "../src/rum-promenad-golv.js";
import { MYSTERY_ITEMS, rollMysteryItem } from "../src/mystery-items.js";
import { butikVara, kopVara } from "../src/butik-core.js";
import { JUL_VAROR } from "../src/jul/jul-katalog.js";

const PRISER = {
  "jul-adventsljusstake": 75, "jul-julstjarna": 60, "jul-pepparkaksfat": 50, "jul-julbock": 55, "jul-tomtefigur": 110,
  "jul-julstrumpa": 40, "jul-snoglob": 150, "jul-ljusslinga": 45, "jul-mistel": 95,
  "jul-julmatta": 85, "jul-oppen-spis": 180, "jul-julgran": 120,
  "jul-snogubbe": 60, "jul-snolykta": 70, "jul-kalke": 80, "jul-granris": 110, "jul-stor-julbock": 130, "jul-slade": 180,
  "jul-fagelbord": 140, "jul-isskulptur": 300,
  "jul-pepparkakshus": 4000, "jul-tomteverkstad": 4000, "jul-snohydda": 4000,
};
const av = (cat) => JUL_VAROR.filter((it) => it.category === cat);
const NU = Date.UTC(2026, 11, 10, 12);
const JUL_PA = { season: "vinter", halloween: false, jul: true, julUntil: null };
const JUL_SLUT = { season: "vinter", halloween: false, jul: true, julUntil: NU - 1 };

test("katalogen: 9 dekor, 3 möbler, 8 trädgård, 3 hus – priser enligt D.2", () => {
  assert.deepEqual([av("dekor").length, av("mobler").length, av("tradgard").length, av("hus").length], [9, 3, 8, 3]);
  assert.equal(JUL_VAROR.length, 23);
  assert.deepEqual(Object.fromEntries(JUL_VAROR.map((it) => [it.id, it.price])), PRISER);
  for (const it of JUL_VAROR) {
    assert.equal(it.collection, "jul");
    assert.match(it.id, /^jul-[a-z0-9-]+$/, `${it.id}: stabilt jul-prefix, inget '#'`);
    assert.ok(it.name && it.emoji, `${it.id}: namn + emoji-fallback`);
    assert.doesNotMatch(it.name, /["<>]/, `${it.id}: namnet hamnar i aria-label`);
  }
  for (const it of av("hus")) assert.equal(it.skalId, it.id, "item-id === skal-id (Firestore)");
});

test("lazy katalog: okänd före loadCollectionArt, sedan i SHOP_ITEMS utan dubbletter – servern känner dem alltid", async () => {
  assert.equal(getItem("jul-julgran"), null, "inte i bootgrafen (shop-items.js)");
  assert.equal(butikVara("jul-julgran").price, 120, "butikKop läser jul-katalog.js direkt");
  await loadCollectionArt();
  await loadCollectionArt(); // idempotent
  assert.equal(getItem("jul-julgran").category, "mobler");
  // Julvarorna (#910); Jul-djurens julklappsägg (#912, test/jul-djur.test.js), kostymerna och
  // avatarerna (#911, jul-kostymer-avatarer.test.js) har egna tester.
  const varor = itemsInCollection("jul").filter((it) => !it.hatchSpecies && !["klader", "avatar"].includes(it.category));
  assert.deepEqual(varor.map((it) => it.id), Object.keys(PRISER));
  const ids = SHOP_ITEMS.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length, "inga dubbla id:n i hela katalogen");
  for (const cat of ["dekor", "mobler", "tradgard", "hus"]) {
    assert.ok(itemsInCategory(cat).every((it) => !it.collection), `${cat}: inga säsongsvaror i vanliga flikar`);
  }
});

test("servern: julvaror säljs bara när Jul är på (och slutdatumet inte passerat)", () => {
  const data = { coins: 5000, ownedItems: [] };
  assert.equal(kopVara(data, butikVara("jul-snogubbe"), { nu: NU, sasong: null }).ok, false, "Jul av");
  assert.equal(kopVara(data, butikVara("jul-snogubbe"), { nu: NU, sasong: JUL_SLUT }).ok, false, "slutdatumet passerat");
  assert.equal(kopVara(data, butikVara("jul-snogubbe"), { nu: NU, sasong: { season: "host", halloween: true } }).ok, false, "Halloween öppnar inte Jul");
  const r = kopVara(data, butikVara("jul-snogubbe"), { nu: NU, sasong: JUL_PA });
  assert.equal(r.ok, true);
  assert.equal(r.patch.coins, 4940);
  const hus = kopVara(data, butikVara("jul-pepparkakshus"), { nu: NU, sasong: JUL_PA });
  assert.equal(hus.patch.coins, 1000);
  assert.equal(kopVara({ coins: 3999 }, butikVara("jul-snohydda"), { nu: NU, sasong: JUL_PA }).ok, false, "för få mynt");
});

test("mysterylådan och Mysterymaten innehåller aldrig julvaror", () => {
  assert.ok(MYSTERY_ITEMS.every((it) => !it.collection && !String(it.id).startsWith("jul-")));
  let rng = 1;
  const slump = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) {
    const vinst = rollMysteryItem(slump, { legendaryChance: i % 2 ? 0.9 : null });
    assert.ok(!vinst.collection && !vinst.id.startsWith("jul-"), vinst.id);
  }
  assert.equal(getItem("apple").collection, undefined, "Mysterymaten är ingen samlingsvara");
});

test("fliken: Halloween och Jul delar samling-butik.js, undergrupperna i Halloweens ordning", async () => {
  const { SAMLINGAR } = await import("../src/butik-samlingar.js");
  const { HALLOWEEN_FLIK, halloweenSektioner, registreraUndergrupp } = await import("../src/halloween/hw-butik.js");
  assert.deepEqual(SAMLINGAR.map((s) => [s.samling, s.tillagg, s.flik.id]), [["halloween", "halloween", "halloween"], ["jul", "jul", "jul"]]);
  const [hw, jul] = SAMLINGAR;
  assert.equal(HALLOWEEN_FLIK, hw.flik, "hw-butik.js är ett tunt omslag");
  assert.equal(halloweenSektioner, hw.sektioner);
  assert.equal(registreraUndergrupp, hw.registreraUndergrupp);
  assert.deepEqual([jul.flik.name, jul.flik.emoji], ["Jul", "🎄"]);
  assert.equal(jul.flik.hint, "Bara under julen! Allt du köper här behåller du och kan använda för alltid – även när julen är slut.");
  assert.match(jul.slutText, /[Jj]ulen är slut/);
  await loadCollectionArt();
  // Kostymerna läggs sist i båda flikarna (Halloween #693, Jul #911).
  assert.deepEqual(jul.undergrupper.map((g) => g.id), hw.undergrupper.map((g) => g.id));
  assert.deepEqual(jul.undergrupper.map((g) => g.rubrik), ["🕯️ Dekor och möbler", "⛄ Trädgård", "🏠 Hus", "🦌 Djur", "🎅 Avatarer", "🎭 Kostymer"]);
  const sek = jul.sektioner();
  assert.deepEqual(sek.map((s) => [s.id, s.items.length]), [["inne", 12], ["tradgard", 8], ["hus", 3], ["djur", 10], ["avatarer", 6], ["kostymer", 11]]);
  // Halloween-fliken är orörd av julvarorna och tvärtom.
  assert.ok(hw.sektioner().every((s) => s.items.every((it) => it.collection === "halloween")));
  // Samlingarnas undergruppslistor är separata (E:s kostymer registreras per samling).
  jul.registreraUndergrupp({ id: "x-test", rubrik: "Test", match: () => false });
  assert.ok(!hw.undergrupper.some((g) => g.id === "x-test"));
  jul.undergrupper.splice(jul.undergrupper.findIndex((g) => g.id === "x-test"), 1);
});

test("pages-shop.js: flikarna ur SAMLINGAR och isTillaggActive – inga Halloween-särfall kvar", () => {
  const src = readFileSync(new URL("../src/pages-shop.js", import.meta.url), "utf8");
  assert.match(src, /import\("\.\/butik-samlingar\.js"\)/);
  assert.match(src, /isTillaggActive\(s\.tillagg\)/);
  assert.doesNotMatch(src, /hw-butik|isHalloweenActive|halloweenSektioner|HALLOWEEN_FLIK/);
});

test("konsten: SVG för alla 23, flik-ikon, husskal registrerade, säsongsoberoende", async () => {
  await loadCollectionArt();
  for (const it of JUL_VAROR) {
    const svg = itemSvg(it.id);
    assert.ok(svg && svg.startsWith("<svg"), `${it.id} har konst`);
    assert.ok(svg.includes(`aria-label="${it.name}"`));
    assert.doesNotMatch(svg, /NaN|undefined/, `${it.id}: inga trasiga koordinater`);
    const { w, h } = itemSize(it.id);
    assert.ok(w > 1 && h > 0.5 && h < 12, `${it.id} storlek ${w}×${h}`);
    // EN delad glöd (hw-glod) – inga egna animationer per sak.
    assert.doesNotMatch(svg, /class="(?!hw-glod")[^"]*"/, `${it.id}: bara den delade glöden`);
  }
  assert.ok(categorySvg("jul"), "flik-ikonen är SVG (ingen Emoji 13+)");
  const lista = listHusSkal().map((s) => s.id);
  for (const it of av("hus")) {
    assert.ok(isHusSkal(it.id) && lista.includes(it.id));
    const m = husSkalMarkup(it.id);
    assert.notEqual(m, husSkalMarkup("stuga"));
    assert.doesNotMatch(m, /NaN|undefined/);
    assert.equal(itemSvg(it.id).match(/viewBox="([^"]+)"/)[1], itemSvg("hw-spokhus").match(/viewBox="([^"]+)"/)[1], "Halloween-husens utsnitt");
  }
  for (const f of readdirSync(new URL("../src/jul/", import.meta.url))) {
    if (!f.startsWith("jul-art") && f !== "jul-konst.js") continue;
    const src = readFileSync(new URL(`../src/jul/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /season|sasong/i, `${f} beror inte på säsongen`);
    assert.ok(src.split("\n").length <= 400, `${f} ≤ 400 rader`);
  }
});

test("husen får vinterns snötäcke: husSkalMedSno i ute-scenen, byn och vid husbytet (F2)", async () => {
  await loadCollectionArt();
  const { husSkalMedSno } = await import("../src/art-hus-ute.js");
  for (const it of av("hus")) {
    const m = husSkalMedSno(it.id);
    assert.ok(m.startsWith(husSkalMarkup(it.id)) && m.includes('class="sz-bara-vinter" data-sno='), it.id);
  }
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  assert.equal((src("art-hus-ute.js").match(/\$\{husSkalMedSno\(skalId\)\}/g) || []).length, 2, "huset ute + byn");
  assert.match(src("pages-varld.js"), /husgruppEl\.innerHTML = husSkalMedSno\(skalId\)/, "Nytt hus: snön följer med");
});

test("samma placeringsflöde som befintliga saker (köpa, placera, flytta, ta bort)", async () => {
  await loadCollectionArt();
  for (const it of [...av("dekor"), ...av("mobler")]) {
    assert.ok(!isGardenItem(it.id) && !isHouseItem(it.id) && !isWearable(it.id), `${it.id} placeras i rummet`);
    assert.ok(isMultiItem(it.id), `${it.id} kan ägas i flera exemplar`);
  }
  for (const it of av("tradgard")) assert.ok(isGardenItem(it.id) && isMultiItem(it.id), `${it.id} placeras ute`);
  for (const it of av("hus")) assert.ok(isHouseItem(it.id) && !isMultiItem(it.id));
  assert.ok(isFlatItem("jul-julmatta"), "mattan ritas underst");

  const placements = {};
  for (const id of ["jul-julgran", "jul-julgran", "jul-julmatta"]) placements[nyPlaceringsNyckel(placements, id)] = { x: 50, y: 70 };
  assert.deepEqual(Object.keys(placements), ["jul-julgran", "jul-julgran#2", "jul-julmatta"]);
  placements["jul-julgran#2"] = { x: 20, y: 80 };
  delete placements["jul-julgran"];
  const key = "jul-julgran#2";
  const { w, h } = itemSize(itemIdFromKey(key));
  const html = rumSakHtml({ key, x: 20, y: 80, titel: "Julgran med pynt", art: itemSvg("jul-julgran"), w, h });
  assert.ok(html.includes(`data-id="${key}"`) && html.includes(`data-remove="${key}"`) && html.includes("<svg"));
});
