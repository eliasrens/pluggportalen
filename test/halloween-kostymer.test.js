// ============================================================================
// Tester: Halloween-kostymerna (#693, epic #689) – spec §4, test 8–11
//   • katalogen: 11 kostymer, `category:"klader"` + `seasonal`/`collection`
//     "halloween", alla fem slottar, 50–250 mynt, bara i Halloween-fliken
//   • lazy (#271): katalog + konst registreras av hw-konst.js; före laddning
//     blir ett buret hw-id en dold platshållare (aldrig emoji, aldrig fel)
//   • test 8/10: avatarMarkup ritar kostymen (af-kostym) – synligheten avgörs
//     av CSS mot <html data-halloween>, så den syns direkt när Halloween är på
//   • test 9: Halloween av → CSS döljer, garderoben säger "ta av men inte på"
//     (wearableActive), och ingen elevdata rörs (avatarMarkup muterar inget)
//   • test 11: samma slot-boxar som vanliga plagg → samma ankargrid på alla
//     avatarer (den visuella matrisen: preview/preview-kostymer.html)
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHOP_ITEMS, getItem, itemsInCategory, itemsInCollection, isWearable } from "../src/shop-items.js";
import { WEARABLES, wearableSvg, wearableAnchor } from "../src/art-wearables.js";
import { loadCollectionArt } from "../src/art-items.js";
import { AVATARS, avatarMarkup, wearableActive } from "../src/avatars.js";
import { HW_KOSTYMER } from "../src/halloween/hw-art-kostymer.js";
import { HW_KOSTYMER_KATALOG } from "../src/halloween/hw-kostymer.js";

const KOSTYMER = HW_KOSTYMER_KATALOG;
const SLOTS = ["hatt", "ansikte", "hals", "hand", "rygg"];
const PAR = { hatt: "xMidYMax", ansikte: "xMidYMid", hals: "xMidYMin", hand: "xMidYMax", rygg: "xMidYMin" };

test("lazy: före laddning okänd katalog → dold platshållare, ingen emoji", () => {
  assert.equal(getItem("hw-haxhatt"), null, "katalogen ligger inte i bootgrafen");
  assert.equal(WEARABLES["hw-haxhatt"], undefined);
  const html = avatarMarkup("fox", ["hw-haxhatt", "keps"]);
  assert.match(html, /<span class="af-kostym-vantar" data-kostym="hw-haxhatt" hidden><\/span>/);
  assert.ok(!html.includes("🧙"));
  assert.match(html, /af-wear af-hatt"><svg/, "vanliga plagg ritas som förut");
  // Okända id utan säsongsprefix ignoreras som förut (ingen platshållare).
  assert.doesNotMatch(avatarMarkup("fox", ["finns-inte"]), /vantar/);
});

test("katalogen: 11 kostymer i alla fem slottar, 50–250 mynt", async () => {
  await loadCollectionArt();
  assert.equal(KOSTYMER.length, 11);
  assert.deepEqual(SHOP_ITEMS.filter((it) => it.seasonal), KOSTYMER, "registrerade i SHOP_ITEMS");
  for (const it of KOSTYMER) {
    assert.equal(it.category, "klader", it.id);
    assert.equal(it.seasonal, "halloween", it.id);
    assert.equal(it.collection, "halloween", `${it.id}: säljs i Halloween-fliken`);
    assert.match(it.id, /^hw-[a-z0-9-]+$/);
    assert.ok(SLOTS.includes(it.slot), `${it.id}: slot ${it.slot}`);
    assert.ok(it.price >= 50 && it.price <= 250, `${it.id} ${it.price}`);
    assert.ok(it.name && it.emoji);
    assert.doesNotMatch(it.name, /["<>]/);
    assert.ok(isWearable(it.id), "bärs som vanliga kläder (garderoben)");
  }
  for (const s of SLOTS) assert.ok(KOSTYMER.some((it) => it.slot === s), `minst en kostym i ${s}`);
  const ids = SHOP_ITEMS.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length, "inga dubbla id:n");
  // Bara i Halloween-fliken – aldrig i den vanliga Kläder-fliken.
  assert.ok(itemsInCategory("klader").every((it) => !it.seasonal));
  assert.deepEqual(itemsInCollection("halloween").filter((it) => it.category === "klader"), KOSTYMER);
});

test("Halloween-fliken: kostymerna i egen undergrupp", async () => {
  await loadCollectionArt();
  const hw = await import("../src/halloween/hw-butik.js");
  const sek = hw.halloweenSektioner().find((s) => s.id === "kostymer");
  assert.deepEqual(sek.items, KOSTYMER);
});

test("konsten: lazy, WEARABLES-format, slot-konventionen", async () => {
  assert.deepEqual(Object.keys(HW_KOSTYMER).sort(), KOSTYMER.map((it) => it.id).sort());
  for (const it of KOSTYMER) {
    const w = HW_KOSTYMER[it.id];
    assert.equal(w.par, PAR[it.slot], `${it.id}: par som slottens övriga plagg`);
    assert.doesNotMatch(w.art, /NaN|undefined/, it.id);
    assert.match(w.viewBox, /^0 0 \d+ \d+$/);
  }
  // Före laddning: ingen konst (avatarMarkup ritar ett tomt spann, aldrig emoji).
  await loadCollectionArt();
  await loadCollectionArt(); // idempotent – inga dubbletter i katalogen
  assert.equal(SHOP_ITEMS.filter((it) => it.id === "hw-haxhatt").length, 1);
  assert.equal(wearableAnchor("hw-fladdervingar"), "vingar");
  for (const it of KOSTYMER) {
    const svg = wearableSvg(it.id);
    assert.ok(svg && svg.startsWith("<svg"), `${it.id} har konst`);
    assert.ok(svg.includes(`aria-label="${it.name}"`));
  }
});

test("test 8/10: avatarMarkup ritar kostymen med af-kostym – vanliga plagg orörda", async () => {
  await loadCollectionArt();
  const html = avatarMarkup("fox", ["hw-haxhatt", "halsduk", "hw-vampyrmantel"]);
  assert.match(html, /class="af-wear af-hatt af-kostym" data-seasonal="halloween"><svg/);
  assert.match(html, /class="af-wear af-hals"><svg/, "vanligt plagg utan af-kostym");
  assert.doesNotMatch(html, /af-hals af-kostym/);
  // Rygg-kostymen ritas BAKOM figuren som manteln.
  assert.ok(html.indexOf("hw-vampyrmantel") < html.indexOf("af-base"));
  assert.match(avatarMarkup("fox", ["hw-fladdervingar"]), /af-rygg af-anchor-vingar af-kostym/);
});

test("test 9: synligheten avgörs av CSS mot <html data-halloween> – på alla ritvägar", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /html:not\(\[data-halloween\]\) \.af-kostym\[data-seasonal="halloween"\] \{ display: none; \}/);
  assert.match(css, /\.af-wear\.af-rygg\.af-anchor-vingar \{/);
  // Alla avatar-ritvägar går genom avatarMarkup (ingen egen wearableSvg på avataren).
  const ritvagar = ["varld-by-scen.js", "varld-kompis.js", "pages-varld.js", "pages-elev.js", "ui.js", "pages-klasskamrat.js",
    "live/design/live-avatar-pool.js", "lasresan/ui-map.js", "adventure/index.js", "games-sanningsjakt.js"];
  for (const f of ritvagar) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    assert.match(src, /avatarMarkup\(/, `${f} ritar avataren via avatarMarkup`);
  }
});

test("test 9: ingen elevdata skrivs om – avatarMarkup muterar inte listan", () => {
  const worn = Object.freeze(["hw-haxhatt", "hw-spokmask", "keps"]);
  avatarMarkup("owl", worn); // fryst lista: kastar om den muteras
  assert.deepEqual(worn, ["hw-haxhatt", "hw-spokmask", "keps"]);
});

test("test 9/10: wearableActive – vanliga alltid, kostymer bara när <html data-halloween>", async () => {
  await loadCollectionArt();
  const prev = globalThis.document;
  const dataset = {};
  globalThis.document = { documentElement: { dataset } };
  try {
    assert.equal(wearableActive(getItem("keps")), true);
    assert.equal(wearableActive(getItem("hw-haxhatt")), false, "Halloween av → kan inte tas på");
    dataset.halloween = "1";
    assert.equal(wearableActive(getItem("hw-haxhatt")), true, "Halloween på → kan bäras");
    delete dataset.halloween;
    assert.equal(wearableActive(getItem("hw-haxhatt")), false, "slutdatum passerat → av igen");
  } finally {
    if (prev === undefined) delete globalThis.document;
    else globalThis.document = prev;
  }
  assert.equal(wearableActive(getItem("hw-haxhatt")), false, "utan DOM: aldrig bärbar");
});

test("test 11: varje kostym ritas på varje avatar med slottens box", async () => {
  await loadCollectionArt();
  for (const av of Object.keys(AVATARS)) {
    for (const it of KOSTYMER) {
      const html = avatarMarkup(av, [it.id]);
      assert.match(html, new RegExp(`af-wear af-${it.slot}( af-anchor-\\w+)? af-kostym`), `${it.id} på ${av}`);
      assert.match(html, /<svg[^>]*viewBox/, `${it.id} på ${av} har konst`);
    }
  }
});
