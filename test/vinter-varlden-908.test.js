// ============================================================================
// Tester: vintern i världen, på porten och i lärarspärren (#908, epic #906,
// UTVECKLINGSUPPDRAG_VINTER_JUL.md B.1–B.5) – ren rendering i Node.
//   • snoTak: generiskt snötäcke på varje husskal (även Halloween-husen) –
//     stillastående kopia (ingen rök, inga id:n/klasser), unika filter-id:n
//   • snödrivor/snögubbe/kappor syns bara på vintern (.sz-bara-vinter), blommor
//     och tuvor döljs (.sz-dolj-vinter) – ingen ny dekor påverkar sommaren
//   • byns snögubbe tar ingen plats: övrig dekor exakt som utan den
//   • bländreglerna (B.2): ingen #FFFFFF i snön, stigen via --sz-stig
//   • QA-verktyget för bländtestet (PNG-avkodning + luminans)
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { SNO, SNO_HL, snoTak, snodriva, snogubbe, snoKrona, snoGran } from "../src/art-style.js";
import { husMini, husScen, husSkalMarkup, listHusSkal } from "../src/art-hus-ute.js";
import { byDekor, DEKOR_ART, DEKOR_MATT, dekorMarkSvg } from "../src/art-by-dekor.js";
import { byLayout, byParams } from "../src/varld-by.js";
import { gardScen } from "../src/art-gard.js";
import { portScenMajestic } from "../src/art-port-majestic.js";
import { portDekor, gateDekorSvg } from "../src/art-sasong.js";
import { SEASONS } from "../src/season-config.js";
import { lasPng, bland } from "../admin/qa-vinter-blandtest.mjs";

const CSS = readFileSync(new URL("../src/styles/32-sasong.css", import.meta.url), "utf8");

test("snöfärgerna är aldrig helt vita (B.2)", () => {
  assert.equal(SNO, "#EEF3F8");
  assert.equal(SNO_HL, "#F7FAFD");
  for (const svg of [snodriva(0, 0), snogubbe(0, 0), snoKrona(50, 50, 20), snoGran(50, 10, 20, 30), snoTak("<rect/>")]) {
    assert.doesNotMatch(svg, /#fff(fff)?\b/i);
  }
});

test("all vinterdekor syns bara på vintern", () => {
  for (const svg of [snodriva(0, 0), snogubbe(0, 0), snoKrona(50, 50, 20), snoGran(50, 10, 20, 30), snoTak("<rect/>")]) {
    assert.match(svg, /^<\w+ class="sz-bara-vinter"/);
  }
  assert.match(CSS, /\.sz-bara-vinter[^{]*\{ display: none; \}/);
  assert.match(CSS, /html\[data-sasong="vinter"\] \.sz-bara-vinter/);
  assert.match(CSS, /html\[data-sasong="vinter"\] \.sz-dolj-vinter/);
});

/** SVG-dokumentet i en snoTak-bild (data-URL) som text. */
const bildSvg = (img) => decodeURIComponent(img.match(/href="data:image\/svg\+xml;charset=utf-8,([^"]+)"/)[1]);

test("snoTak: en <image> med filtret i en egen SVG – stillastående kopia utan rök, klasser och roller", () => {
  const konst = `<g class="hus-rok r2"><circle r="9"/></g><g id="husgrupp" role="button" tabindex="0" aria-label="x"><rect class="a"/></g>`;
  const a = snoTak(konst, { x: 150, y: 0, w: 660, h: 600 });
  assert.match(a, /^<image class="sz-bara-vinter" data-sno="\d+" href="data:image\/svg\+xml/);
  assert.match(a, /x="150" y="0" width="660" height="600"/);
  assert.match(a, /pointer-events="none"/);
  assert.doesNotMatch(a, /<filter/, "inget levande filter i scenen");
  const svg = bildSvg(a);
  assert.match(svg, /<filter id="f"[^>]*x="150" y="0" width="660" height="600"/);
  assert.match(svg, /viewBox="150 0 660 600"/);
  assert.doesNotMatch(svg, /hus-rok|role=|tabindex=|aria-label=|class=/);
  assert.match(svg, /<g filter="url\(#f\)"><g id="husgrupp"><rect\/><\/g><\/g>/);
  // Samma konst + ruta = samma post (en bitmapp per husskal), annan konst = ny.
  assert.equal(snoTak(konst, { x: 150, y: 0, w: 660, h: 600 }), a);
  assert.notEqual(snoTak("<rect/>").match(/data-sno="(\d+)"/)[1], a.match(/data-sno="(\d+)"/)[1]);
});

test("QA 24: varje husskal får snö på taket – i byn och i huset ute (även Halloween-husen)", async () => {
  await import("../src/halloween/hw-konst.js").then((m) => m.registreraHalloweenKonst());
  const skal = listHusSkal();
  assert.ok(skal.some((s) => s.id.startsWith("hw-")), "Halloween-husen är registrerade");
  assert.ok(skal.length >= 40);
  for (const { id } of skal) {
    const mini = husMini({ skalId: id });
    assert.equal((mini.match(/<image class="sz-bara-vinter" data-sno=/g) || []).length, 1, id);
    assert.ok(mini.includes(husSkalMarkup(id)), `${id}: konsten själv orörd`);
    assert.match(bildSvg(mini), /<filter id="f"/, id);
    assert.match(husScen("", { skalId: id }), /<image class="sz-bara-vinter" data-sno=/, id);
  }
});

test("byn: snögubben tar ingen plats – övrig dekor är exakt som förut", () => {
  for (const [antal, kc] of [[20, true], [5, true], [8, false], [1, false]]) {
    const layout = byLayout(byParams(antal, { klasscenter: kc }));
    const d = byDekor(layout);
    assert.ok(d.snogubbe, `${antal} hus kc=${kc}: snögubbe placerad`);
    assert.equal(d.snogubbe.typ, "snogubbe");
    assert.ok(!d.uppst.includes(d.snogubbe));
    if (kc) {
      // Vid lägerelden: inne i Klasscentrets ruta, på dess marklinje.
      const c = layout.klasscenter;
      assert.ok(Math.abs(d.snogubbe.x - c.x) < c.bredd / 2);
      assert.ok(Math.abs(d.snogubbe.y - c.botten) < 1);
    }
    // Deterministiskt.
    assert.deepEqual(byDekor(layout), d);
  }
  assert.ok(DEKOR_MATT.snogubbe && DEKOR_ART.snogubbe().includes("sz-bara-vinter"));
});

test("byn: blomrabatter och tuvor döljs på vintern, dammen fryser", () => {
  const svg = dekorMarkSvg({
    damm: { x: 50, y: 50, rx: 8, ry: 3 },
    platta: [{ typ: "blommor", x: 10, y: 10 }, { typ: "tuva", x: 20, y: 20 }],
  });
  assert.equal((svg.match(/class="sz-dolj-vinter"/g) || []).length, 2);
  assert.match(svg, /class="sz-bara-vinter"><ellipse/);
});

test("stigen blir upptrampad snö via --sz-stig, granarna mörkgröna", () => {
  const p = SEASONS.vinter.palette;
  assert.equal(p.stig, "#D9D2C7");
  assert.ok(p["stig-kant"] && p.gran);
  assert.match(husScen(""), /fill="var\(--sz-stig,#EAD9C0\)"/);
  assert.match(DEKOR_ART.gran(), /var\(--sz-gran,#58B368\)/);
});

test("gården: snö på laggården och en snögubbe", () => {
  for (const skin of [null, "lada-bla"]) {
    const svg = gardScen({ barnLevel: 2, barnSkin: skin });
    assert.match(svg, /<image class="sz-bara-vinter" data-sno="\d+"/);
    assert.ok(svg.includes(snogubbe(540, 446, 1.15)));
  }
});

test("porten: snö på pelare/båge/mur (utan krönen), drivor, vintersol", () => {
  const svg = portScenMajestic(portDekor());
  const bild = svg.match(/<image class="sz-bara-vinter" data-sno[^>]*>/)[0];
  const kopia = bildSvg(bild);
  assert.match(kopia, /viewBox="-600 50 2160 440"/, "täcker letterboxen");
  assert.doesNotMatch(kopia, /Pluggporten|port-halva|portb-vimpel|#F890B7/, "skylt, grind och vimplar är inte med");
  assert.doesNotMatch(kopia, /r="13"|M195 88 L195 56/, "krönklot och vimpelstång är inte med (F4: klumpar)");
  assert.match(svg, /class="portb-solgrupp"/);
  assert.match(svg, /class="portb-sol sz-dolj-vinter"/);
  assert.match(CSS, /html\[data-sasong="vinter"\] \.portb-solgrupp \{ opacity: 0\.8;/);
  assert.equal((portDekor().fram.match(/class="sz-bara-vinter"/g) || []).length, 4, "en driva per lövhög");
});

test("lärarspärren: vinterns bakgrund + drivor och en snögubbe", () => {
  assert.match(CSS, /html\[data-sasong\] body:has\(\.sz-gate\)/);
  // "← Tillbaka" klarar AA (≥ 4,5:1) mot vinterns ljusare blå (F1).
  assert.match(CSS, /html\[data-sasong="vinter"\] \.sz-gate \.back-link:not\(:hover\) \{ color: #B4C1CF; \}/);
  const svg = gateDekorSvg();
  assert.ok((svg.match(/class="sz-bara-vinter"/g) || []).length >= 4);
});

test("bländtestets verktyg: PNG-avkodning och luminans", () => {
  // 2×2 RGB: vit, svart, #EEF3F8, #7DB3E3 (filter 0 per rad).
  const rader = [
    [0, 255, 255, 255, 0, 0, 0],
    [0, 0xee, 0xf3, 0xf8, 0x7d, 0xb3, 0xe3],
  ];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const chunk = (namn, d) => {
    const b = Buffer.alloc(12 + d.length);
    b.writeUInt32BE(d.length, 0); b.write(namn, 4, "ascii"); d.copy(b, 8);
    return b;
  };
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from(rader.flat()))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const bild = lasPng(png);
  assert.equal(bild.w, 2);
  const { medel, andel } = bland(bild);
  assert.equal(andel, 0.25, "bara den vita pixeln ≥ 245 (#EEF3F8 ≈ 242)");
  assert.ok(Math.abs(medel - (255 + 0 + 242.1 + 170.5) / 4) < 0.5, String(medel));
});
