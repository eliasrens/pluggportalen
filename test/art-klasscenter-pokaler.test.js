// ============================================================================
// Enhetstest för Klasscentrets pokal-konst (src/art-klasscenter-pokaler*.js) – #496.
//   • varje pokaltyp (kc-pokal-typer.js) har konst under sin art-nyckel, plus
//     reserven "pokal" som normaliseraPokal faller tillbaka på
//   • giltig, sluten SVG; inga gradient-/id-defs/SMIL; inga undefined/NaN
//   • animera:false tar bort ALLA ambient-klasser
//   • hyllans platser och tavlans fält ligger inom möbelns viewBox
// Körs browser-fritt:  node --test test/art-klasscenter-pokaler.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  KC_POKALER, POKAL_VB, KC_POKALHYLLA_PLATSER, KC_TROFEHYLLA_PLATSER, KC_STATISTIK_FALT,
  kcPokalSvg, kcPokalMarkup, kcPokalStorlek, kcPokalhyllaSvg, kcTrofehyllaSvg,
} from "../src/art-klasscenter-pokaler.js";
import { listaPokaltyper, normaliseraPokal } from "../src/klasscenter/kc-pokal-typer.js";

const AMBIENT = /class="[^"]*\bkc-(flamma|glitter|glod|guppa|pendel)\b/;
const MOBLER = ["kc-pokalhylla", "kc-trofehylla", "kc-statistiktavla"];

const giltig = (svg, namn) => {
  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
  assert.ok(!svg.includes("undefined") && !svg.includes("NaN"), `${namn} har trasiga värden`);
  assert.ok(!/<(linearGradient|radialGradient|clipPath|filter|animate)\b|\sid="/.test(svg), `${namn} har defs/id/SMIL`);
  assert.equal((svg.match(/<g[\s>]/g) || []).length, (svg.match(/<\/g>/g) || []).length, `${namn}: obalanserade <g>`);
  assert.equal((svg.match(/<svg[\s>]/g) || []).length, (svg.match(/<\/svg>/g) || []).length, `${namn}: obalanserade <svg>`);
};

const inom = (r, viewBox, namn) => {
  const [, , vw, vh] = viewBox.split(" ").map(Number);
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= vw && r.y + r.h <= vh, `${namn} utanför viewBox`);
};

test("varje pokaltyp har konst under sin art-nyckel, och reserven finns", () => {
  const typer = listaPokaltyper();
  assert.ok(typer.length >= 3);
  for (const t of typer) {
    assert.ok(KC_POKALER[t.art], `${t.id}: art-nyckeln ${t.art} saknar konst`);
    assert.equal(KC_POKALER[t.art].viewBox, POKAL_VB, `${t.id}: pokaler delar viewBox`);
  }
  assert.equal(KC_POKALER.pokal.viewBox, POKAL_VB);
  assert.ok(KC_POKALER[normaliseraPokal("x", { typ: "framtida-typ" }).art], "okänd typ → ritbar reserv");
});

test("varje pokal/möbel ger giltig, unik SVG utan defs/id/SMIL, med ambient som går att stänga av", () => {
  const sett = new Set();
  for (const art of Object.keys(KC_POKALER)) {
    const svg = kcPokalSvg(art);
    giltig(svg, art);
    assert.ok(svg.includes(`viewBox="${KC_POKALER[art].viewBox}"`) && svg.includes(`data-art="${art}"`));
    assert.ok(AMBIENT.test(svg), `${art} saknar ambient`);
    assert.ok(!AMBIENT.test(kcPokalSvg(art, { animera: false })), `${art} animerar trots animera:false`);
    sett.add(kcPokalMarkup(art));
  }
  assert.equal(sett.size, Object.keys(KC_POKALER).length, "varje pokal ska se olika ut");
});

test("statistiktavlan har klicka-mig-glöd och tre fält inom viewBox", () => {
  assert.match(kcPokalSvg("kc-statistiktavla"), /class="kc-glod"/);
  assert.deepEqual(Object.keys(KC_STATISTIK_FALT), ["exp", "losta", "progress"]);
  for (const [k, r] of Object.entries(KC_STATISTIK_FALT)) inom(r, KC_POKALER["kc-statistiktavla"].viewBox, k);
});

test("pokalhyllan: 3 platser inom viewBox (#528), pokaler auto-placeras i ordning", () => {
  assert.equal(KC_POKALHYLLA_PLATSER.length, 3);
  KC_POKALHYLLA_PLATSER.forEach((r, i) => inom(r, KC_POKALER["kc-pokalhylla"].viewBox, `plats ${i}`));
  const pokaler = [
    { id: "mm-klasskamp-a", art: "pokal-mm", titel: 'Mästare "6B"' },
    { id: "live-vinst-b", art: "pokal-live", titel: "Live-segrare" },
    { id: "okand-c", art: "finns-inte", titel: "Gammal" },
  ];
  const svg = kcPokalhyllaSvg(pokaler, { aria: "Pokalhylla" });
  giltig(svg, "hylla");
  const ids = [...svg.matchAll(/data-pokal-id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, pokaler.map((p) => p.id));
  assert.match(svg, /data-art="pokal" data-pokal-id="okand-c"/, "okänd art → reserven");
  assert.match(svg, /aria-label="Mästare &#34;6B&#34;"/);
  const { x, y } = KC_POKALHYLLA_PLATSER[0];
  assert.ok(svg.includes(`x="${x}" y="${y}"`));
  // Fler pokaler än platser → bara 3 ritas.
  const många = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, art: "pokal-mm" }));
  assert.equal((kcPokalhyllaSvg(många).match(/kc-pokal-plats/g) || []).length, 3);
  assert.equal((kcPokalhyllaSvg([]).match(/kc-pokal-plats/g) || []).length, 0);
});

test("#528 Troféhyllan: 6 platser inom viewBox, fler än gratis-hyllan; nya pokalfigurer giltiga", () => {
  assert.equal(KC_TROFEHYLLA_PLATSER.length, 6);
  assert.ok(KC_TROFEHYLLA_PLATSER.length > KC_POKALHYLLA_PLATSER.length);
  KC_TROFEHYLLA_PLATSER.forEach((r, i) => inom(r, KC_POKALER["kc-trofehylla"].viewBox, `trofé ${i}`));
  const många = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, art: "pokal-lasresan-500" }));
  const svg = kcTrofehyllaSvg(många, { aria: "Troféhylla" });
  giltig(svg, "troféhylla");
  assert.equal((svg.match(/kc-pokal-plats/g) || []).length, 6);
  for (const art of ["pokal-mm-silver", "pokal-mm-brons", "pokal-lasresan-100", "pokal-lasresan-250",
    "pokal-lasresan-500", "pokal-lasresan-1000", "pokal-larare-guld", "pokal-larare-stjarna",
    "pokal-larare-hjarta", "pokal-larare-medalj"]) {
    assert.equal(KC_POKALER[art].viewBox, POKAL_VB, art);
    giltig(kcPokalSvg(art, { aria: art }), art);
    assert.doesNotMatch(kcPokalSvg(art, { animera: false }), /class="kc-(glitter|flamma)/, `${art} utan ambient`);
  }
});

test("okänd art-nyckel → null; aria escapas; storlek ur viewBox", () => {
  assert.equal(kcPokalSvg("finns-inte"), null);
  assert.equal(kcPokalMarkup("finns-inte"), null);
  assert.equal(kcPokalStorlek("finns-inte"), null);
  assert.match(kcPokalSvg("pokal-mm", { aria: 'Pokal "A"' }), /role="img" aria-label="Pokal &#34;A&#34;"/);
  assert.match(kcPokalSvg("pokal-mm"), /aria-hidden="true"/);
  for (const art of MOBLER) assert.ok(kcPokalStorlek(art).w > 0);
  const s = kcPokalStorlek("pokal-live");
  assert.equal(s.h, +((s.w * 140) / 100).toFixed(2));
});
