// ============================================================================
// Enhetstest för Klasscentrets kodritade byggnad (src/art-klasscenter.js) – #478.
//   • alla 10 nivåer ger en giltig, sluten SVG-sträng med samma viewBox
//   • okänd/trasig nivå clampas (0/-3/NaN/"x" → 1, 11/99 → 10, 4.4 → 4)
//   • animera:false tar bort ALLA ambient-klasser (rök/fana/glitter …)
//   • inga gradient-/id-defs (krockar när flera klasscenter ritas på en sida)
// Körs browser-fritt:  node --test test/art-klasscenter.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  klasscenterSvg,
  klasscenterMarkup,
  klampaNiva,
  KLASSCENTER_NIVAER,
  KLASSCENTER_MATT,
} from "../src/art-klasscenter.js";
import { NIVAER } from "../src/klasscenter/kc-niva.js";

const AMBIENT = /class="[^"]*\b(hus-rok|kc-(flamma|fana|glitter|svava|blink))\b/;

const ANTAL = KLASSCENTER_NIVAER.length;

test("KLASSCENTER_NIVAER härleds ur kc-niva NIVAER, nivå 1..N i ordning med namn", () => {
  assert.equal(ANTAL, NIVAER.length);
  KLASSCENTER_NIVAER.forEach((n, i) => {
    assert.equal(n.niva, i + 1);
    assert.ok(n.namn && n.emoji);
  });
});

test("varje nivå i listan har rit-funktion och returnerar giltig SVG med gemensam viewBox", () => {
  const sett = new Set();
  for (let n = 1; n <= ANTAL; n++) {
    const svg = klasscenterSvg(n);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.ok(svg.includes(`viewBox="${KLASSCENTER_MATT.viewBox}"`));
    assert.ok(svg.includes(`data-niva="${n}"`));
    assert.ok(!svg.includes("undefined") && !svg.includes("NaN"), `nivå ${n} har trasiga värden`);
    assert.ok(!/<(linearGradient|radialGradient|clipPath|animate)\b|\bid="/.test(svg), `nivå ${n} har defs/id/SMIL`);
    // Grov välformadhetskoll: lika många öppnade som stängda <g>.
    assert.equal((svg.match(/<g[\s>]/g) || []).length, (svg.match(/<\/g>/g) || []).length);
    sett.add(klasscenterMarkup(n));
  }
  assert.equal(sett.size, ANTAL, "varje nivå ska se olika ut");
});

test("okänd nivå clampas till 1..N", () => {
  for (const [in_, ut] of [[0, 1], [-3, 1], [NaN, 1], ["x", 1], [undefined, 1], [ANTAL + 1, ANTAL], [99, ANTAL], [4.4, 4], ["7", 7]])
    assert.equal(klampaNiva(in_), ut, `klampaNiva(${in_})`);
  assert.equal(klasscenterSvg(0), klasscenterSvg(1));
  assert.equal(klasscenterSvg(42), klasscenterSvg(ANTAL));
});

test("animera:false ger inga ambient-klasser; default har ambient på flera nivåer", () => {
  for (let n = 1; n <= ANTAL; n++) assert.ok(!AMBIENT.test(klasscenterSvg(n, { animera: false })), `nivå ${n}`);
  const medAnim = KLASSCENTER_NIVAER.filter((n) => AMBIENT.test(klasscenterSvg(n.niva)));
  assert.ok(medAnim.length >= 6);
});

test("aria ger role=img + escapad etikett, annars aria-hidden", () => {
  assert.match(klasscenterSvg(3, { aria: 'Klass "4B"' }), /role="img" aria-label="Klass &#34;4B&#34;"/);
  assert.match(klasscenterSvg(3), /aria-hidden="true"/);
});
