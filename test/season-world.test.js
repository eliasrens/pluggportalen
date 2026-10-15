// ============================================================================
// Tester: höstvärlden, löven och inloggningens teman (#691, epic #689).
//   • test 1: sommar = inga variabler, ingen palett-CSS → konsten ritar sina
//     egna fallback-färger (sz()) = exakt dagens färger
//   • paletten är en NYCKEL i SEASONS (fler säsonger utan ombyggnad)
//   • Halloween färgar bara inloggningen, inte världen (§2.1)
//   • test 4: ≤20 löv, animeras bara med transform/opacity, pointer-events:none,
//     av vid reducerad rörelse, pausas (.sz-paus) och döljs i rummet
//   • dekoren ligger runt login-skylten, aldrig bakom texten
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEASONS, HALLOWEEN_LOGIN_PALETTE, themeFor } from "../src/season-config.js";
import { LOV_ANTAL, lovMarkup, paletteCss } from "../src/season-world.js";
import { portDekor } from "../src/art-sasong.js";
import { sz } from "../src/art-style.js";
import { husScen } from "../src/art-hus-ute.js";
import { portScenMajestic } from "../src/art-port-majestic.js";

const CSS = readFileSync(new URL("../src/styles/32-sasong.css", import.meta.url), "utf8");

test("sommar: tom palett, inga löv, ingen palett-CSS (test 1)", () => {
  const t = themeFor({ season: "sommar", halloweenActive: false });
  assert.deepEqual(t.world, {});
  assert.deepEqual(t.login, {});
  assert.equal(t.leaves, false);
  assert.equal(t.halloween, false);
  assert.equal(paletteCss(t), "");
  // Okänd/saknad säsong = sommar.
  assert.equal(themeFor(null).season, "sommar");
  assert.equal(themeFor({ season: "vinter" }).season, "sommar");
});

test("sz(): sommarfärgen är fallbacken – konsten ritar dagens färg utan variabel", () => {
  assert.equal(sz("grass", "#8FCB74"), "var(--sz-grass,#8FCB74)");
  const svg = husScen("");
  for (const v of ["sky1,#9AD3F0", "sky2,#E8F6FD", "hill,#A8DA8F", "grass,#8FCB74", "tree-a,#6FC66F"]) {
    assert.ok(svg.includes(`var(--sz-${v})`), v);
  }
  // Höstdekor/Halloween-detaljer finns i konsten men är dolda som standard.
  assert.ok(svg.includes('class="sz-bara-host"'));
  assert.ok(svg.includes('class="sz-bara-halloween"'));
  assert.match(CSS, /\.sz-bara-host,\s*\.sz-bara-halloween\s*\{\s*display:\s*none;/);
});

test("höst: palett med varma kronor, löv på, bara på världen/inloggningen", () => {
  const t = themeFor({ season: "host", halloweenActive: false });
  assert.equal(t.leaves, true);
  assert.equal(t.world["tree-a"], SEASONS.host.palette["tree-a"]);
  const css = paletteCss(t);
  assert.match(css, /^\.varld-stage,\.room-window\{--sz-sky1:/);
  // Port-övergångens overlay (SVG:n flyttas ut ur .port-scen) får samma
  // inloggningspalett – annars blir zoomen sommargrön (#727).
  assert.ok(css.includes(".port-scen,.port-overgang,body:has(.sz-gate){"));
  // Ingen global :root/body-regel – Plugga/Live/lärarsidan rörs inte.
  assert.ok(!/(^|\})\s*(:root|html|body)\s*\{/.test(css));
  // Alla variabler som konsten läser och höstpaletten sätter är giltiga färger.
  for (const [k, v] of Object.entries(SEASONS.host.palette)) assert.match(v, /^#[0-9A-F]{6}$/i, k);
});

test("Halloween färgar bara inloggningen – världen behåller säsongens palett", () => {
  const t = themeFor({ season: "sommar", halloweenActive: true });
  assert.equal(t.halloween, true);
  assert.deepEqual(t.world, {});
  assert.equal(t.login["port-sky1"], HALLOWEEN_LOGIN_PALETTE["port-sky1"]);
  assert.equal(t.leaves, false);
  const h = themeFor({ season: "host", halloweenActive: true });
  assert.equal(h.world["port-sky1"], SEASONS.host.palette["port-sky1"]);
  assert.equal(h.login["port-sky1"], HALLOWEEN_LOGIN_PALETTE["port-sky1"]);
  // halloween:true men slutdatum passerat (halloweenActive false) = av.
  assert.equal(themeFor({ season: "host", halloween: true, halloweenActive: false }).halloween, false);
});

test("löven: högst 20, fyra återanvända varianter (test 4)", () => {
  assert.ok(LOV_ANTAL <= 20);
  const m = lovMarkup();
  assert.equal((m.match(/class="sz-lov"/g) || []).length, LOV_ANTAL);
  // Deterministiskt – samma löv varje gång (ingen Math.random per rendering).
  assert.equal(lovMarkup(), m);
});

test("löven: bara transform/opacity, klickgenomskinliga, av vid reducerad rörelse, pausbara", () => {
  for (const kf of CSS.matchAll(/@keyframes\s+sz-[a-z]+\s*\{([\s\S]*?)\n\}/g)) {
    const props = [...kf[1].matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
    for (const p of props) assert.ok(p === "transform" || p === "opacity", `otillåten egenskap i keyframes: ${p}`);
  }
  assert.match(CSS, /\.sz-lager\s*\{[^}]*pointer-events:\s*none/);
  assert.match(CSS, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.sz-lager\s*\{\s*display:\s*none/);
  assert.match(CSS, /html\.sz-paus \.sz-lov[^{]*\{\s*animation-play-state:\s*paused/);
  assert.match(CSS, /\.varld-stage\[data-niva="rum"\] \.sz-lager/);
});

test("inloggningen: dekoren ligger runt skylten, aldrig bakom texten", () => {
  const { bak, fram } = portDekor();
  // Login-skylten upptar ungefär x 340–620, y 230–460 i port-scenens viewBox.
  const punkter = [...(bak + fram).matchAll(/translate\((-?[\d.]+) (-?[\d.]+)\)/g)].map((m) => [+m[1], +m[2]]);
  assert.ok(punkter.length > 4);
  for (const [x, y] of punkter) assert.ok(!(x > 330 && x < 630 && y > 220 && y < 470), `dekor bakom skylten: ${x},${y}`);
  // Scenen tar emot dekoren; utan dekor (sommar/fallback) ritas den som förut.
  assert.ok(portScenMajestic({ bak: "<g id=\"t-bak\"/>", fram: "" }).includes('id="t-bak"'));
  assert.ok(!portScenMajestic().includes("undefined"));
});
