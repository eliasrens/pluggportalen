// ============================================================================
// Tester: Jul-kostymerna (11) och Jul-avatarerna (6) (#911, epic #906, DEL E)
//   • kostymerna: `jul-`-id:n, `category:"klader"` + `seasonal`/`collection`
//     "jul", priserna enligt E.1, lazy (platshållare före laddning), samma
//     WEARABLES-format och slot-konvention som Halloween-kostymerna
//   • Luciakronan: lugn låga – ingen animation i konsten
//   • matrisen (QA-test 11): varje säsongskostym (Halloween + Jul) på varje
//     avatar (gratis, Halloween, Jul) – 0 platshållare
//   • avatarerna: katalog i shop-items.js (servern känner dem), regeln
//     kopAvatarOk listar dem, köpta kan väljas året runt, ej köpta inte, de
//     gratis oförändrade; lazy konst med platshållare
//   • servern (kopVara): kostymer och avatarer säljs bara när Jul är på
//   • Live-poolen (Halloween-QA F2): se live-avatar-pool-f2.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHOP_ITEMS, getItem, itemsInCategory, itemsInCollection, isWearable } from "../src/shop-items.js";
import { WEARABLES, wearableSvg, wearableAnchor } from "../src/art-wearables.js";
import { loadCollectionArt, itemSvg } from "../src/art-items.js";
import {
  AVATARS, avatarMarkup, avatarSvg, avatarArtReady, buyableAvatars, canUseAvatar, isBuyableAvatar, loadAvatarArt,
} from "../src/avatars.js";
import { butikVara, kopVara } from "../src/butik-core.js";
import { JUL_KOSTYMER_KATALOG } from "../src/jul/jul-kostymer.js";
import { JUL_KOSTYMER } from "../src/jul/jul-art-kostymer.js";

const PRISER = {
  "jul-tomteluva": 60, "jul-renhorn": 80, "jul-oronmuffar": 90, "jul-luciakrona": 120,
  "jul-rosiga-kinder": 70, "jul-tomteskagg": 90, "jul-stickad-halsduk": 100,
  "jul-paket": 50, "jul-polkagrisstav": 110, "jul-tomtesack": 200, "jul-snoangelvingar": 250,
};
const SLOT = {
  "jul-tomteluva": "hatt", "jul-renhorn": "hatt", "jul-oronmuffar": "hatt", "jul-luciakrona": "hatt",
  "jul-rosiga-kinder": "ansikte", "jul-tomteskagg": "ansikte", "jul-stickad-halsduk": "hals",
  "jul-paket": "hand", "jul-polkagrisstav": "hand", "jul-tomtesack": "rygg", "jul-snoangelvingar": "rygg",
};
const AV_PRISER = {
  "jul-av-pepparkaksgubbe": 400, "jul-av-snogubbe": 450, "jul-av-ren": 500,
  "jul-av-pingvin": 600, "jul-av-isbjorn": 700, "jul-av-tomtenisse": 800,
};
const PAR = { hatt: "xMidYMax", ansikte: "xMidYMid", hals: "xMidYMin", hand: "xMidYMax", rygg: "xMidYMin" };
const NU = Date.UTC(2026, 11, 10, 12);
const JUL_PA = { season: "vinter", halloween: false, jul: true, julUntil: null };
const JUL_AV = { season: "vinter", halloween: false, jul: false };

// --- Före laddning (ordningen spelar roll: körs först i processen) ------------

test("lazy: före laddning är jul-kostymen en dold platshållare och jul-avataren en siluett", () => {
  assert.equal(getItem("jul-luciakrona"), null, "katalogen ligger inte i bootgrafen");
  assert.equal(WEARABLES["jul-luciakrona"], undefined);
  const html = avatarMarkup("fox", ["jul-luciakrona", "keps"]);
  assert.match(html, /<span class="af-kostym-vantar" data-kostym="jul-luciakrona" hidden><\/span>/);
  assert.ok(!html.includes("🕯"), "aldrig emoji-fallback för en kostym");
  assert.match(html, /af-wear af-hatt"><svg/, "vanliga plagg ritas som förut");
  // Köpavataren: katalograden finns direkt (shop-items.js), konsten är lazy.
  assert.equal(avatarArtReady("jul-av-snogubbe"), false);
  assert.match(avatarSvg("jul-av-snogubbe"), /data-av-vantar="jul-av-snogubbe"/);
  assert.match(avatarSvg("jul-av-snogubbe"), /aria-label="Snögubben"/);
});

// --- Kostymerna ---------------------------------------------------------------

test("kostymerna: 11 i alla fem slottar, priserna enligt E.1, bara i Jul-fliken", async () => {
  await loadCollectionArt();
  await loadCollectionArt(); // idempotent
  assert.deepEqual(Object.fromEntries(JUL_KOSTYMER_KATALOG.map((it) => [it.id, it.price])), PRISER);
  assert.deepEqual(SHOP_ITEMS.filter((it) => it.seasonal === "jul"), JUL_KOSTYMER_KATALOG, "registrerade en gång");
  for (const it of JUL_KOSTYMER_KATALOG) {
    assert.equal(it.category, "klader", it.id);
    assert.equal(it.seasonal, "jul", it.id);
    assert.equal(it.collection, "jul", it.id);
    assert.equal(it.slot, SLOT[it.id], it.id);
    assert.ok(it.name && it.emoji && !/["<>]/.test(it.name), it.id);
    assert.ok(isWearable(it.id), "bärs som vanliga kläder (garderoben)");
  }
  const namn = SHOP_ITEMS.filter((it) => it.category === "klader").map((it) => it.name);
  assert.equal(new Set(namn).size, namn.length, "inga två klädsaker med samma namn i garderoben");
  const ids = SHOP_ITEMS.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length, "inga dubbla id:n");
  assert.ok(itemsInCategory("klader").every((it) => !it.seasonal), "aldrig i den vanliga Kläder-fliken");
  assert.deepEqual(itemsInCollection("jul").filter((it) => it.category === "klader"), JUL_KOSTYMER_KATALOG);
  const { JUL_SAMLING } = await import("../src/jul/jul-butik.js");
  assert.deepEqual(JUL_SAMLING.sektioner().find((s) => s.id === "kostymer").items, JUL_KOSTYMER_KATALOG);
});

test("kostymkonsten: WEARABLES-format, slottens par, vingarna och skägget har ankare", async () => {
  await loadCollectionArt();
  assert.deepEqual(Object.keys(JUL_KOSTYMER).sort(), Object.keys(PRISER).sort());
  for (const it of JUL_KOSTYMER_KATALOG) {
    const w = JUL_KOSTYMER[it.id];
    assert.equal(w.par, PAR[it.slot], `${it.id}: par som slottens övriga plagg`);
    assert.match(w.viewBox, /^0 0 \d+ \d+$/);
    assert.doesNotMatch(w.art, /NaN|undefined/, it.id);
    const svg = wearableSvg(it.id);
    assert.ok(svg && svg.startsWith("<svg"), `${it.id} har konst`);
    assert.ok(svg.includes(`aria-label="${it.name}"`));
  }
  assert.equal(wearableAnchor("jul-snoangelvingar"), "vingar");
  assert.equal(wearableAnchor("jul-tomteskagg"), "skagg");
  assert.equal(wearableAnchor("jul-tomtesack"), "sack");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  for (const a of ["af-ansikte.af-anchor-skagg", "af-rygg.af-anchor-sack"]) assert.match(css, new RegExp(`\\.af-wear\\.${a.replace(".", "\\.")} \\{`), a);
});

test("Luciakronan: ljus med lugn låga – ingen animation, inget fladder", () => {
  const art = JUL_KOSTYMER["jul-luciakrona"].art;
  assert.equal((art.match(/fill="#F7C948"/g) || []).length, 5, "fem lågor");
  assert.doesNotMatch(art, /<animate|class=|hw-glod|@keyframes/, "ingen animation");
  // Ingen kostym animeras (avatarerna ritas i många vyer samtidigt).
  for (const w of Object.values(JUL_KOSTYMER)) assert.doesNotMatch(w.art, /<animate|class=/);
});

test("avatarMarkup: jul-kostymen ritas med af-kostym året runt – rygg bakom figuren", async () => {
  await loadCollectionArt();
  const html = avatarMarkup("fox", ["jul-tomteluva", "halsduk", "jul-tomtesack"]);
  assert.match(html, /class="af-wear af-hatt af-kostym" data-seasonal="jul"><svg/);
  assert.match(html, /class="af-wear af-hals"><svg/);
  assert.ok(html.indexOf("jul-tomtesack") < html.indexOf("af-base"), "säcken bakom figuren");
  assert.doesNotMatch(html, /hidden|vantar/);
  assert.match(avatarMarkup("fox", ["jul-snoangelvingar"]), /af-rygg af-anchor-vingar af-kostym/);
  assert.match(avatarMarkup("fox", ["jul-tomteskagg"]), /af-ansikte af-anchor-skagg af-kostym/);
});

test("matrisen (QA-test 11): varje säsongskostym på varje avatar – gratis, Halloween och Jul – 0 platshållare", async () => {
  await Promise.all([loadCollectionArt(), loadAvatarArt()]);
  const kostymer = SHOP_ITEMS.filter((it) => it.seasonal);
  assert.equal(kostymer.length, 22, "11 Halloween + 11 Jul");
  const avatarer = [...buyableAvatars().map((a) => a.id), ...Object.keys(AVATARS)];
  assert.equal(avatarer.length, 6 + 6 + Object.keys(AVATARS).length);
  let celler = 0;
  for (const av of avatarer) {
    for (const k of kostymer) {
      const html = avatarMarkup(av, [k.id]);
      assert.match(html, new RegExp(`af-wear af-${k.slot}( af-anchor-\\w+)? af-kostym" data-seasonal="${k.seasonal}"><svg[^>]*viewBox`), `${k.id} på ${av}`);
      assert.doesNotMatch(html, /vantar/, `${k.id} på ${av}: ingen platshållare`);
      celler++;
    }
  }
  assert.equal(celler, 22 * avatarer.length);
});

// --- Avatarerna ---------------------------------------------------------------

test("avatarerna: 6 i Jul-samlingen, priserna enligt E.2, i shop-items.js (servern känner dem)", () => {
  const jul = buyableAvatars().filter((it) => it.collection === "jul");
  assert.deepEqual(Object.fromEntries(jul.map((it) => [it.id, it.price])), AV_PRISER);
  for (const it of jul) {
    assert.equal(it.category, "avatar");
    assert.equal(AVATARS[it.id], undefined, "inte bland de gratis");
    assert.ok(isBuyableAvatar(it.id));
    assert.ok(it.name && it.emoji && !/["<>]/.test(it.name));
    assert.equal(butikVara(it.id), getItem(it.id), "butikKop slår upp den i den statiska katalogen");
  }
  assert.deepEqual(jul.map((it) => it.name),
    ["Lilla pepparkaksgubben", "Snögubben", "Liten ren", "Pingvin med halsduk", "Isbjörnsunge", "Tomtenisse"]);
  assert.equal(itemsInCategory("avatar").length, 0, "ingen egen vanlig flik");
  assert.ok(readFileSync(new URL("../src/shop-items.js", import.meta.url), "utf8").split("\n").length <= 400, "shop-items.js ≤ 400 rader");
});

test("köpta kan väljas året runt, ej köpta inte, de gratis är oförändrade", () => {
  assert.equal(canUseAvatar("jul-av-tomtenisse", []), false);
  assert.equal(canUseAvatar("jul-av-tomtenisse", ["hw-av-spoke"]), false);
  assert.equal(canUseAvatar("jul-av-tomtenisse", ["jul-av-tomtenisse"]), true, "canUseAvatar läser inte säsongen");
  for (const id of Object.keys(AVATARS)) assert.equal(canUseAvatar(id, []), true, id);
  const src = readFileSync(new URL("../src/avatars.js", import.meta.url), "utf8");
  assert.doesNotMatch(src.match(/export function canUseAvatar[\s\S]*?\n}/)[0], /season|jul/i);
});

test("reglerna: kopAvatarOk listar Jul-avatarerna", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const m = rules.match(/function kopAvatarOk\(\)[\s\S]*?!\(av in \[([^\]]*)\]\)/);
  const iRegler = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  for (const id of Object.keys(AV_PRISER)) assert.ok(iRegler.includes(id), id);
});

test("avatarkonsten: riktig figur i stilguidens viewBox, butikskort, Jul-fliken har undergruppen", async () => {
  await Promise.all([loadAvatarArt(), loadCollectionArt()]);
  for (const id of Object.keys(AV_PRISER)) {
    assert.equal(avatarArtReady(id), true, id);
    const svg = avatarSvg(id);
    assert.doesNotMatch(svg, /data-av-vantar|NaN|undefined/, id);
    assert.match(svg, /viewBox="0 0 100 120"/);
    assert.match(svg, new RegExp(`aria-label="${getItem(id).name}"`));
    assert.ok(itemSvg(id), `${id}: bild på butikskortet`);
  }
  const { JUL_SAMLING } = await import("../src/jul/jul-butik.js");
  assert.deepEqual(JUL_SAMLING.sektioner().find((s) => s.id === "avatarer").items.map((it) => it.id), Object.keys(AV_PRISER));
});

// --- Servern ------------------------------------------------------------------

test("servern (kopVara): kostymer och avatarer säljs bara när Jul är på, köpet dras och sparas", () => {
  for (const [id, pris] of [["jul-luciakrona", 120], ["jul-av-ren", 500]]) {
    const vara = butikVara(id);
    assert.equal(vara.price, pris, `${id}: butikKop läser katalogen`);
    assert.equal(kopVara({ coins: 900 }, vara, { nu: NU, sasong: JUL_AV }).ok, false, `${id}: Jul av`);
    const r = kopVara({ coins: 900, ownedItems: ["keps"] }, vara, { nu: NU, sasong: JUL_PA });
    assert.equal(r.ok, true, id);
    assert.equal(r.patch.coins, 900 - pris);
    assert.deepEqual(r.patch.ownedItems, ["keps", id]);
    assert.equal(r.patch.ownedCounts, undefined, `${id}: single-vara, ingen räknare`);
    const igen = kopVara({ coins: 900, ownedItems: [id] }, vara, { nu: NU, sasong: JUL_PA });
    assert.ok(igen.ok && !igen.patch, `${id}: redan ägd → inget dras`);
  }
});

// Live-poolen (Halloween-QA F2): test/live-avatar-pool-f2.test.js (egen process, före laddning).
