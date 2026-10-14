// ============================================================================
// Tester: köpbara Halloween-avatarer (#694, epic #689, spec §5)
//   • katalogen: 6 avatarer, category "avatar", Halloween-samlingen, 400–800
//     mynt, egen undergrupp i Halloween-fliken – aldrig i rummets möbellåda
//   • reglerna (kopAvatarOk i firestore.rules) listar exakt katalogens id:n
//   • test 12/13 (klientdelen): canUseAvatar – gratis alltid, köpbar bara ägd
//   • lazy konst: före laddning neutral platshållare (aldrig fel figur), efter
//     laddning riktig figur i stilguidens viewBox; kläder/kostymer ritas på
//     varje ny avatar via samma avatarMarkup (test 11, se även preview-sidan)
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHOP_ITEMS, itemsInCategory, itemsInCollection } from "../src/shop-items.js";
import {
  AVATARS, isBuyableAvatar, buyableAvatars, canUseAvatar, avatarSvg, avatarMarkup, avatarName,
  avatarEmoji, avatarArtReady, loadAvatarArt,
} from "../src/avatars.js";
import { itemSvg } from "../src/art-items.js";

const KOP = buyableAvatars();
const IDS = KOP.map((it) => it.id);

test("katalogen: 6 köpbara Halloween-avatarer, 400–800 mynt, stabila id:n", () => {
  assert.equal(KOP.length, 6);
  for (const it of KOP) {
    assert.match(it.id, /^hw-av-[a-z]+$/);
    assert.equal(it.collection, "halloween");
    assert.ok(it.price >= 400 && it.price <= 800, `${it.id}: pris ${it.price}`);
    assert.ok(it.name && it.emoji && !/["<>]/.test(it.name));
    assert.equal(AVATARS[it.id], undefined, "inte bland de fria");
    assert.ok(isBuyableAvatar(it.id));
  }
  assert.equal(new Set(IDS).size, 6);
  assert.equal(SHOP_ITEMS.filter((it) => IDS.includes(it.id)).length, 6, "unika i katalogen");
  assert.ok(itemsInCollection("halloween").filter((it) => it.category === "avatar").length === 6);
  assert.equal(itemsInCategory("avatar").length, 0, "ingen egen vanlig flik");
  // Emoji-fallbacken (lärarens elevtabell) får inte vara Emoji 13+ (#590).
  for (const it of KOP) assert.doesNotMatch(it.emoji, /\u{1F408}‍⬛|\u{1F9AB}|\u{1FAB2}/u);
});

test("befintliga avatarer är fortfarande gratis (test 13)", () => {
  for (const id of Object.keys(AVATARS)) {
    assert.equal(isBuyableAvatar(id), false, id);
    assert.equal(canUseAvatar(id, []), true, id);
  }
});

test("köpavatar kan bara användas när den ägs (test 12/13)", () => {
  assert.equal(canUseAvatar("hw-av-spoke", []), false);
  assert.equal(canUseAvatar("hw-av-spoke", ["keps"]), false);
  assert.equal(canUseAvatar("hw-av-spoke", ["hw-av-spoke"]), true);
  assert.equal(canUseAvatar("hw-av-spoke", undefined), false);
  assert.equal(canUseAvatar("okand-id", ["okand-id"]), false, "bara katalogens köpavatarer");
});

test("reglerna listar exakt katalogens köpavatarer", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const m = rules.match(/function kopAvatarOk\(\)[\s\S]*?!\(av in \[([^\]]*)\]\)/);
  assert.ok(m, "kopAvatarOk med id-lista finns");
  const iRegler = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(iRegler, [...IDS].sort());
});

test("lazy konst: platshållare före laddning, riktig figur efter – med kläder", async () => {
  // Före: aldrig räven eller en annan fel figur – en neutral siluett med namnet.
  assert.equal(avatarArtReady("hw-av-spoke"), false);
  assert.equal(itemSvg("hw-av-spoke"), null);
  const fore = avatarSvg("hw-av-spoke");
  assert.match(fore, /data-av-vantar="hw-av-spoke"/);
  assert.match(fore, /aria-label="Litet spöke"/);
  assert.equal(avatarName("hw-av-vampyr"), "Liten vampyr");
  assert.equal(avatarEmoji("hw-av-vampyr"), "🧛");

  await loadAvatarArt();
  for (const id of IDS) {
    assert.equal(avatarArtReady(id), true);
    const svg = avatarSvg(id);
    assert.doesNotMatch(svg, /data-av-vantar/);
    assert.match(svg, /viewBox="0 0 100 120"/);
    assert.match(svg, new RegExp(`aria-label="${KOP.find((it) => it.id === id).name}"`));
    assert.ok(itemSvg(id), `${id}: bild på butikskortet`);
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
  // Varje klädsak (inkl. kommande kostymer) ritas på varje ny avatar.
  const klader = SHOP_ITEMS.filter((it) => it.category === "klader").map((it) => it.id);
  for (const id of IDS) {
    for (const k of klader) {
      const html = avatarMarkup(id, [k]);
      assert.match(html, /class="af-wear af-/, `${k} på ${id}`);
      assert.doesNotMatch(html, /data-av-vantar/);
    }
  }
  // Okända id:n faller fortfarande tillbaka på räven.
  assert.match(avatarSvg("finns-inte"), /aria-label="Räv"/);
});

test("Halloween-fliken: egen undergrupp 👻 Avatarer med alla sex", async () => {
  const hw = await import("../src/halloween/hw-butik.js");
  const sek = hw.halloweenSektioner().find((s) => s.id === "avatarer");
  assert.ok(sek, "undergruppen finns");
  assert.deepEqual(sek.items.map((it) => it.id), IDS);
});
