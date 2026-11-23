// ============================================================================
// Tester: julen i världen, på porten och i lärarspärren (#909, epic #906,
// UTVECKLINGSUPPDRAG_VINTER_JUL.md C.1–C.3)
//   • konsten (src/jul/jul-art-varld.js): EN blinkande grupp per slinga,
//     lampor i gult/rött/grönt, port/spärr/fönster märkta .julv-dekor
//   • takkanten ur silhuetten (takLinje): skorstenen tas bort, taket följs
//   • lazy: src/jul/ finns inte i bootgrafen (107 filer) och laddas med import()
//   • CSS (53-jul.css): bara opacity i blinket, 3 lägen, av vid reducerad
//     rörelse, pausas i dold flik – och INGEN regel träffar sommar/höst utan Jul
//   • kontrast (WCAG AA) för skylten, login-kortet och "Lärare →" mot julkvällen
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAMP_FARGER, ljusslinga, langsLinje, portJul, gateJul, fonsterJul, julgran, julbock, tomte,
} from "../src/jul/jul-art-varld.js";
import { takLinje, husJul } from "../src/jul/jul-varld.js";
import { JUL_LOGIN_PALETTE } from "../src/season-config.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");
const CSS = readFileSync(join(SRC, "styles/53-jul.css"), "utf8");
const antal = (s, re) => (s.match(re) || []).length;

test("ljusslingan: varannan lampa i EN blinkande grupp, gult/rött/grönt", () => {
  const p = [[0, 0], [30, 5], [60, 0], [90, 5], [120, 0]];
  const s = ljusslinga(p, { r: 7, fas: 1.2 });
  assert.equal(antal(s, /class="julv-blink"/g), 1);
  for (const c of LAMP_FARGER) assert.ok(s.includes(`fill="${c}"`), c);
  assert.match(s, /animation-delay:-1.2s/);
  assert.equal(ljusslinga([[0, 0]]), "");
});

test("langsLinje: jämna steg längs en polylinje", () => {
  const pts = langsLinje([[0, 0], [100, 0], [100, 100]], 20);
  assert.equal(pts.length, 10);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    assert.ok(d <= 20.001, `steg ${d}`);
  }
});

test("takLinje: följer taket, tar bort skorstenen", () => {
  // Stuga i miniatyr (1 px = 1 enhet): tak-triangel 40..160, topp y=20,
  // takfot y=60, + en 12 px bred skorsten vid x 120–132 upp till y=10.
  const B = 200, H = 120;
  const a = new Uint8ClampedArray(B * H * 4);
  const satt = (x, y) => (a[(y * B + x) * 4 + 3] = 255);
  for (let x = 40; x <= 160; x++) {
    const topp = 20 + Math.abs(x - 100) * (40 / 60);
    for (let y = Math.ceil(topp); y < H; y++) satt(x, y);
  }
  for (let x = 120; x <= 132; x++) for (let y = 10; y < H; y++) satt(x, y);
  const linje = takLinje(a, B, H, { x0: 0, y0: 0, k: 1, oppning: 20, inset: 0 });
  assert.ok(linje.length > 20);
  for (const [x, y] of linje) {
    const tak = 20 + Math.abs(x - 100) * (40 / 60);
    // Ingen punkt uppe på skorstenen (y 10); öppningen planar bara ut taket
    // lite närmast skorstenen och nocken.
    assert.ok(y > 20, `x ${x}: ${y} uppe på skorstenen`);
    assert.ok(Math.abs(y - tak) < 12, `x ${x}: ${y} mot taket ${tak}`);
  }
  assert.deepEqual(takLinje(new Uint8ClampedArray(B * H * 4), B, H), []);
});

test("husets juldekor: slinga + adventsstjärna, märkt .julv-dekor", () => {
  const linje = Array.from({ length: 40 }, (_, i) => [300 + i * 9, 250 - Math.min(i, 39 - i) * 6]);
  const s = husJul({ linje, fonster: { x: 440, y: 330, w: 150, h: 130 } });
  assert.match(s, /^<g class="julv-dekor julv-hus">/);
  assert.match(s, /julv-advent/);
  assert.equal(antal(s, /class="julv-blink"/g), 1);
  // Utan fönster hänger stjärnan under takkanten.
  assert.match(husJul({ linje, fonster: null }), /julv-advent/);
});

test("porten, spärren och fönstret: allt bär .julv-dekor; tomten vinkar, stjärnor/norrsken står stilla", () => {
  const { bak, fram } = portJul();
  assert.match(bak, /^<g class="julv-dekor julv-port-bak">/);
  assert.match(bak, /julv-norrsken/);
  assert.match(bak, /julv-mane/);
  assert.match(fram, /^<g class="julv-dekor julv-port-fram">/);
  for (const k of ["julv-slinga", "julv-granris", "julv-gran", "julv-tomte", "julv-snolykta", "julv-klappar"]) {
    assert.ok(fram.includes(k), k);
  }
  assert.equal(antal(fram, /class="julv-blink"/g), 1, "en slinga i bågen");
  assert.equal(antal(fram, /class="julv-vinkarm"/g), 1);
  assert.match(gateJul(), /^<g class="julv-dekor julv-gate">/);
  assert.ok(gateJul().includes("julv-tomte") && gateJul().includes("julv-snolykta"));
  assert.match(fonsterJul(), /^<g class="julv-dekor julv-fonster">/);
  // Inga emojier eller rena vita ytor större än en glimt.
  for (const s of [bak, fram, gateJul(), fonsterJul(), julgran(0, 0), julbock(0, 0), tomte(0, 0)]) {
    assert.doesNotMatch(s, /\p{Extended_Pictographic}/u);
  }
});

test("lazy: src/jul/ är inte i bootgrafen (107 filer) och laddas med import()", () => {
  const start = join(SRC, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.deepEqual([...seen].filter((f) => f.startsWith(join(SRC, "jul") + "/")), []);
  assert.equal(seen.size, 107, "bootgrafen ska vara kvar på 107 filer");
  const sw = readFileSync(join(SRC, "season-world.js"), "utf8");
  assert.match(sw, /import\("\.\/jul\/jul-varld\.js"\)/);
  assert.match(sw, /if \(theme\.jul\) fyllJul\(container\)/);
});

test("CSS: blinket = bara opacity i 3 lägen; av vid reducerad rörelse; pausas i dold flik", () => {
  const blink = CSS.match(/@keyframes julv-blink \{([\s\S]*?)\n\}/)[1];
  assert.equal(antal(blink, /opacity/g), 4); // 0 % = 100 % → 3 lägen
  assert.doesNotMatch(blink, /transform|filter/);
  assert.match(CSS, /\.julv-blink \{ animation: julv-blink [\d.]+s step-end infinite; \}/);
  assert.match(CSS, /prefers-reduced-motion: reduce\) \{\s*\.julv-blink, \.julv-vinkarm \{ animation: none; \}/);
  assert.match(CSS, /html\.sz-paus \.julv-blink,\s*html\.sz-paus \.julv-vinkarm \{ animation-play-state: paused; \}/);
  // #907 F1: solen och fåglarna bort på porten i julkvällen.
  assert.match(CSS, /html\[data-jul\] \.port-scen \.sz-dolj-halloween/);
});

test("CSS: ingen regel träffar sommar/höst utan Jul (0 px-diff)", () => {
  const utanKommentarer = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const selektorer = [...utanKommentarer.matchAll(/([^{}@]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((s) => s && !/^(from|to|\d|keyframes|media)/.test(s));
  assert.ok(selektorer.length > 5);
  for (const lista of selektorer) {
    for (const s of lista.split(",").map((x) => x.trim())) {
      if (/^[\d.]+%$/.test(s) || /^(from|to)$/.test(s)) continue;
      assert.ok(
        /html\[data-jul\]|html:not\(\[data-jul\]\)|\.julv-|\.sz-(bara|dolj)-jul/.test(s),
        `selektorn "${s}" kan träffa utan Jul`
      );
    }
  }
});

// --- Kontrast (WCAG 2.1) ------------------------------------------------------
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("kontrast: skylten, login-kortet och 'Lärare →' mot julkvällen (WCAG AA)", () => {
  const himmel = ["port-sky1", "port-sky2", "port-sky3", "port-bg"].map((k) => JUL_LOGIN_PALETTE[k]);
  const mark = [JUL_LOGIN_PALETTE.hill, JUL_LOGIN_PALETTE.grass];
  // Skyltens text (#3B3350 på ljust trä #E0B98C) – oförändrad.
  assert.ok(kontrast("#3B3350", "#E0B98C") >= 4.5);
  // Login-kortet (kräm #FFF3DC, kontur #3B3350) syns mot hela kvällshimlen (≥ 3:1).
  for (const c of himmel) assert.ok(kontrast("#FFF3DC", c) >= 3, `kortet mot ${c}`);
  // "Lärare →": #3B3350 på kräm-pastillen ≥ 4,5:1, och pastillen syns mot himmel och mark.
  assert.ok(kontrast("#3B3350", "#FFF3DC") >= 4.5);
  for (const c of himmel) assert.ok(kontrast("#FFF3DC", c) >= 3, `pastillen mot ${c}`);
  for (const c of mark) assert.ok(kontrast("#3B3350", c) >= 3, `pastillens kontur mot ${c}`);
  assert.match(CSS, /html\[data-jul\] \.port-scen \.port-larare-lank \{[^}]*background: #FFF3DC/);
});
