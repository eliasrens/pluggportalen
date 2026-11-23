// ============================================================================
// Tester: inga Emoji 13+ i säsongssamlingarna (#590; Halloween #696, Jul #910)
// ----------------------------------------------------------------------------
// Generaliserad ur admin/qa-halloween-emoji.mjs: samlingarnas källfiler
// (src/halloween/, src/jul/ och butikens samlingsflikar) och ALLA samlingsvaror
// i katalogen (namn + emoji-fallback, efter loadCollectionArt) får inte
// innehålla tecken från Unicode 13+ eller Emoji 13+-sekvenser av äldre tecken
// (🧑‍🎄, 🐻‍❄️ …). Tabellen test/fixtures/emoji-13-plus.json är framtagen ur
// Unicodes filer med `node admin/qa-sasong-emoji.mjs <dir> --fixtur`.
// Ren node: node --test test/sasong-emoji.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { SHOP_ITEMS } from "../src/shop-items.js";
import { loadCollectionArt } from "../src/art-items.js";

const ROT = new URL("../", import.meta.url);
const { intervall, sekvenser } = JSON.parse(readFileSync(new URL("test/fixtures/emoji-13-plus.json", ROT), "utf8"));
const LANGST = Math.max(...sekvenser.map((s) => [...s].length));
const SEKV = new Set(sekvenser);

/** Emoji 13+ i en text: [{ tecken, index }] (FE0F räknas inte, som i QA-skriptet). */
function emoji13(text) {
  const t = [...String(text).replace(/️/g, "")];
  const ut = [];
  for (let i = 0; i < t.length; i++) {
    const cp = t[i].codePointAt(0);
    if (cp > 0x2000 && intervall.some(([a, b]) => cp >= a && cp <= b)) ut.push({ tecken: t[i], index: i });
    for (let n = Math.min(LANGST, t.length - i); n >= 1; n--) {
      const s = t.slice(i, i + n).join("");
      if (SEKV.has(s)) {
        ut.push({ tecken: s, index: i });
        i += n - 1;
        break;
      }
    }
  }
  return ut;
}

const SAMLINGSFILER = [
  ...["halloween", "jul"].flatMap((d) => readdirSync(new URL(`src/${d}/`, ROT)).filter((f) => f.endsWith(".js")).map((f) => `src/${d}/${f}`)),
  "src/samling-butik.js", "src/butik-samlingar.js",
];

test("tabellen fångar kända Emoji 13+ (även sekvenser av äldre tecken) och släpper äldre", () => {
  for (const e of ["🧑‍🎄", "🐻‍❄️", "🪅", "🫎", "🛖", "🪵", "🧋"]) assert.ok(emoji13(`x ${e} y`).length, `${e} är Emoji 13+`);
  for (const e of ["🎄", "🎅", "🤶", "⛄", "🦌", "🛷", "🧦", "🧊", "🟥", "🕯️", "🎃", "👻", "Snöhydda åäö –"]) {
    assert.deepEqual(emoji13(e), [], `${e} är äldre än Emoji 13`);
  }
});

test("samlingarnas källfiler har inga Emoji 13+", () => {
  assert.ok(SAMLINGSFILER.length > 10);
  for (const f of SAMLINGSFILER) {
    const fynd = emoji13(readFileSync(new URL(f, ROT), "utf8"));
    assert.deepEqual(fynd.map((x) => x.tecken), [], f);
  }
});

test("alla samlingsvaror i katalogen (namn + emoji-fallback) är fria från Emoji 13+", async () => {
  await loadCollectionArt(); // de lazy varorna (kostymer, djur, Jul) slås in
  const varor = SHOP_ITEMS.filter((it) => it.collection);
  assert.ok(varor.some((it) => it.collection === "jul") && varor.some((it) => it.collection === "halloween"));
  for (const it of varor) assert.deepEqual(emoji13(`${it.name} ${it.emoji}`), [], it.id);
});
