// ============================================================================
// Enhetstest för Klasscentrum-föremålens kodritade konst
// (src/art-klasscenter-inredning*.js) – #487.
//   • varje katalogpost (kc-shop-items.js) har en ritfunktion under sin art-nyckel
//   • registret har inga föräldralösa nycklar (konst utan katalogpost)
//   • giltig, sluten SVG; inga gradient-/id-defs/SMIL; inga undefined/NaN
//   • animera:false tar bort ALLA ambient-klasser
// Körs browser-fritt:  node --test test/art-klasscenter-inredning.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  KC_INREDNING,
  kcInredningSvg,
  kcInredningMarkup,
  kcInredningStorlek,
} from "../src/art-klasscenter-inredning.js";
import { KC_SHOP_ITEMS } from "../src/klasscenter/kc-shop-items.js";

const AMBIENT = /class="[^"]*\bkc-(flamma|fana|glitter|svava|blink|pendel|vatten|kaskad|fisk|bubbla)\b/;

test("varje katalogpost har en ritfunktion under sin art-nyckel", () => {
  for (const it of KC_SHOP_ITEMS) {
    const art = KC_INREDNING[it.art];
    assert.ok(art, `${it.id}: art-nyckeln ${it.art} saknar konst`);
    assert.equal(typeof art.rita, "function", `${it.id}: rita saknas`);
    assert.match(art.viewBox, /^0 0 \d+ \d+$/);
    assert.ok(art.w > 0);
  }
});

test("registret har inga nycklar utan katalogpost", () => {
  const iKatalog = new Set(KC_SHOP_ITEMS.map((it) => it.art));
  for (const nyckel of Object.keys(KC_INREDNING)) assert.ok(iKatalog.has(nyckel), `${nyckel} finns inte i katalogen`);
});

test("varje föremål ger giltig, unik SVG utan defs/id/SMIL", () => {
  const sett = new Set();
  for (const it of KC_SHOP_ITEMS) {
    const svg = kcInredningSvg(it.art);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.ok(svg.includes(`viewBox="${KC_INREDNING[it.art].viewBox}"`));
    assert.ok(svg.includes(`data-art="${it.art}"`));
    assert.ok(!svg.includes("undefined") && !svg.includes("NaN"), `${it.id} har trasiga värden`);
    assert.ok(!/<(linearGradient|radialGradient|clipPath|animate)\b|\bid="/.test(svg), `${it.id} har defs/id/SMIL`);
    assert.equal((svg.match(/<g[\s>]/g) || []).length, (svg.match(/<\/g>/g) || []).length, `${it.id}: obalanserade <g>`);
    sett.add(kcInredningMarkup(it.art));
  }
  assert.equal(sett.size, KC_SHOP_ITEMS.length, "varje föremål ska se olika ut");
});

test("animera:false ger inga ambient-klasser; default har ambient på alla", () => {
  for (const it of KC_SHOP_ITEMS) {
    assert.ok(!AMBIENT.test(kcInredningSvg(it.art, { animera: false })), `${it.id} animerar trots animera:false`);
    assert.ok(AMBIENT.test(kcInredningSvg(it.art)), `${it.id} saknar ambient`);
  }
});

test("okänd art-nyckel → null; aria escapas; storlek ur viewBox", () => {
  assert.equal(kcInredningSvg("kc-finns-inte"), null);
  assert.equal(kcInredningMarkup("kc-finns-inte"), null);
  assert.equal(kcInredningStorlek("kc-finns-inte"), null);
  assert.match(kcInredningSvg("kc-fontan", { aria: 'Fontän "A"' }), /role="img" aria-label="Fontän &#34;A&#34;"/);
  assert.match(kcInredningSvg("kc-fontan"), /aria-hidden="true"/);
  const s = kcInredningStorlek("kc-akvarium");
  assert.equal(s.w, KC_INREDNING["kc-akvarium"].w);
  assert.equal(s.h, s.w); // kvadratisk viewBox
});
