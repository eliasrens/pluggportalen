// Enhetstester: mynt-ikonen överallt (#590, epic #587, spec DEL 6 + test 25–27).
// Mynt-emojin (U+1FA99, Emoji 13) är ▯ på Windows 10 – gränssnittet ritar
// coinIcon() (src/icons.js) i stället; datatexter bär markören {mynt}.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { COIN_MARK, withCoinIcon } from "../src/icons.js";
import { GR_CHESTS, GR_COIN } from "../src/live/formats/guldrush/delat/chests-config.js";
import { eventText } from "../src/live/formats/guldrush/delat/guldrush-regler.js";
import { computeRewards, rewardSummary } from "../src/live/live-rewards.js";

const COIN = String.fromCodePoint(0x1fa99);

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(js|mjs|css|html)$/.test(n) ? [p] : [];
  });
}

// Emoji 13+ (urval som saknas på Windows 10): Symbols & Pictographs Ext-A utom
// de som kom i Emoji 12, plus några spridda.
const EMOJI12_EXT_A = new Set([..."🩰🩱🩲🩳🩸🩹🩺🪀🪁🪂🪐🪑🪒🪓🪔🪕"].map((c) => c.codePointAt(0)));
const SPRIDDA = new Set([..."🥲🥸🥷🤌🦣🦤🦫🦬🦭🧋🛻🛼🛖🛗🛝🛞🛟"].map((c) => c.codePointAt(0)));
const nyEmoji = (cp) => (cp >= 0x1fa70 && cp <= 0x1faff && !EMOJI12_EXT_A.has(cp)) || SPRIDDA.has(cp);

test("test 26: ingen mynt-emoji i src/ eller i serverns guldrush-kopia", () => {
  const traffar = [...files("src"), ...files("functions/guldrush")]
    .filter((p) => readFileSync(p, "utf8").includes(COIN));
  assert.deepEqual(traffar, []);
});

test("Live (alla format) använder inga emojier från Emoji 13+", () => {
  const traffar = files("src/live").flatMap((p) => [...readFileSync(p, "utf8")]
    .filter((c) => nyEmoji(c.codePointAt(0))).map((c) => `${p}: ${c}`));
  assert.deepEqual(traffar, []);
});

test("kistkonfigen bär markören och UI:t byter den mot coinIcon-SVG", () => {
  assert.equal(GR_COIN, COIN_MARK);
  const lite = GR_CHESTS.find((c) => c.id === "lite_guld");
  assert.equal(lite.icon, COIN_MARK);
  const text = eventText({ type: "chest", chest: "lite_guld", name: "Alma", amount: 10 });
  assert.equal(text, `${COIN_MARK} Alma hittade 10 guld!`);
  const html = withCoinIcon(text);
  assert.match(html, /^<svg class="coin-svg" width="1em"/);
  assert.ok(!html.includes(COIN_MARK) && html.endsWith(" Alma hittade 10 guld!"));
  // Två mynt → två unika gradient-id:n.
  const ids = withCoinIcon(`${COIN_MARK}${COIN_MARK}`).match(/id="pc-guld-\d+"/g);
  assert.equal(new Set(ids).size, 2);
  assert.equal(withCoinIcon("utan mynt"), "utan mynt");
});

test("test 27: 1:a med 9 rätt, förstapris 300, 5/rätt → 300 + 45 = 345", () => {
  const s = { rewards: { firstPrize: 300, perCorrect: 5, cap: 1000 } };
  const rows = [
    { uid: "a", score: 900, correct: 9, answered: 9 },
    { uid: "b", score: 400, correct: 4, answered: 6 },
  ];
  const sum = rewardSummary(computeRewards(s, rows).a);
  assert.deepEqual(sum.lines, [
    { label: "Placeringspris", coins: 300 },
    { label: "9 rätt svar", coins: 45 },
  ]);
  assert.equal(sum.total, 345);
});

test("slutskärmarna ritar myntet inline (ingen CSS-emoji)", () => {
  for (const p of ["src/live/formats/guldrush/gr-skarmar.js", "src/live/formats/snilleblixt/snilleblixt-student.js"]) {
    assert.match(readFileSync(p, "utf8"), /<b>\$\{l\.coins\} \$\{coinIcon\("1em"\)\}<\/b>/, p);
  }
});
