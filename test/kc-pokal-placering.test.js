// ============================================================================
// Pokaler i Klasscentrets rum (#497): nycklar, automatisk placering (ren),
// layoutens validering av pokal-nycklar, tillståndets auto-saker, hover-
// rutans innehåll, rules-synk och bootgrafen.
// Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pokalNyckel, pokalIdFranNyckel } from "../src/klasscenter/kc-pokal-typer.js";
import {
  placeraPokaler, hyllaPlatsPos, hedersPokaler, finastForst, KC_HYLLA, KC_POKAL_STORLEK, KC_HEDERS_MAX,
} from "../src/klasscenter/kc-pokal-placering.js";
import { validatePlacedItems, normaliseraLayout, planRestore, KC_POKAL_MAX } from "../src/klasscenter/kc-layout-plan.js";
import { skapaKcRumTillstand } from "../src/klasscenter/kc-rum-tillstand.js";
import { pokalTipsHtml } from "../src/klasscenter/kc-rum-pokaler.js";
import { KC_POKALHYLLA_PLATSER } from "../src/art-klasscenter-pokaler.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const MATT = { W: 1200, H: 700, enhet: 25 };
const pokal = (id, wonAt) => ({ id, wonAt, titel: "T", art: "pokal-mm", typ: id.split("-").slice(0, 2).join("-") });
const P = [pokal("mm-klasskamp-c3", 300), pokal("mm-klasskamp-a1", 100), pokal("live-vinst-b2", 200)];

describe("pokal-nycklar", () => {
  it("pokal-<trophyId> fram och tillbaka; bara kända typer + giltigt kallaId", () => {
    assert.equal(pokalNyckel("mm-klasskamp-X_1"), "pokal-mm-klasskamp-X_1");
    assert.equal(pokalIdFranNyckel("pokal-mm-klasskamp-X_1"), "mm-klasskamp-X_1");
    assert.equal(pokalIdFranNyckel("pokal-live-avklarat-s9"), "live-avklarat-s9");
    assert.equal(pokalIdFranNyckel("pokal-okand-typ-1"), null);
    assert.equal(pokalIdFranNyckel("pokal-mm-klasskamp-"), null);
    assert.equal(pokalIdFranNyckel("pokal-mm-klasskamp-a.b"), null);
    assert.equal(pokalIdFranNyckel("lounge"), null);
    assert.equal(pokalIdFranNyckel(null), null);
  });
});

describe("placeraPokaler (ren, deterministisk)", () => {
  it("lika fina → nyast först på hyllans platser, oberoende av listans ordning", () => {
    const a = placeraPokaler(P, {}, MATT);
    const b = placeraPokaler([...P].reverse(), {}, MATT);
    assert.deepEqual(a, b, "två klienter → samma placering");
    assert.deepEqual(a["pokal-mm-klasskamp-c3"], { ...hyllaPlatsPos(0, MATT), z: 0 });
    assert.deepEqual(a["pokal-live-vinst-b2"], { ...hyllaPlatsPos(1, MATT), z: 0 });
    assert.deepEqual(a["pokal-mm-klasskamp-a1"], { ...hyllaPlatsPos(2, MATT), z: 0 });
  });

  it("#528: finast (varde) först, oavsett ålder", () => {
    const r = placeraPokaler([{ ...pokal("mm-brons-x", 900), varde: 20 }, { ...pokal("mm-klasskamp-y", 1), varde: 50 }], {}, MATT);
    assert.deepEqual(Object.keys(r), ["pokal-mm-klasskamp-y", "pokal-mm-brons-x"]);
  });

  it("samma wonAt → id avgör; saknat wonAt räknas som äldst", () => {
    const r = placeraPokaler([pokal("mm-klasskamp-b", 5), pokal("mm-klasskamp-a", 5), pokal("live-vinst-z", null)], {}, MATT);
    assert.deepEqual(Object.keys(r), ["pokal-mm-klasskamp-a", "pokal-mm-klasskamp-b", "pokal-live-vinst-z"]);
  });

  it("en flyttad pokal (nyckel i layouten) placeras inte – de andra flyttar upp", () => {
    const r = placeraPokaler(P, { "pokal-mm-klasskamp-c3": { x: 70, y: 30, z: 4 } }, MATT);
    assert.equal("pokal-mm-klasskamp-c3" in r, false);
    assert.deepEqual(r["pokal-live-vinst-b2"], { ...hyllaPlatsPos(0, MATT), z: 0 });
  });

  it("inga pokaler → ingenting", () => {
    assert.deepEqual(placeraPokaler([], { lounge: { x: 1, y: 2, z: 0 } }, MATT), {});
  });

  it("fler än hyllans 3 → första lediga väggplats, aldrig ovanpå en sak", () => {
    const many = Array.from({ length: 11 }, (_, i) => pokal(`mm-klasskamp-p${String(i).padStart(2, "0")}`, i + 1));
    const pi = { klassfana: { x: 36, y: 22, z: 1 } }; // första väggplatsen är upptagen
    const r = placeraPokaler(many, pi, MATT);
    assert.equal(Object.keys(r).length, 11);
    const hylla = new Set(KC_POKALHYLLA_PLATSER.map((_, i) => JSON.stringify(hyllaPlatsPos(i, MATT))));
    const pa = Object.values(r).filter((p) => hylla.has(JSON.stringify({ x: p.x, y: p.y })));
    assert.equal(pa.length, 3);
    for (const s of ["p10", "p09", "p08"]) assert.ok(pa.includes(r[`pokal-mm-klasskamp-${s}`]), "nyast på hyllan");
    const vagg = ["p00", "p01", "p02", "p03", "p04", "p05", "p06", "p07"].map((s) => r[`pokal-mm-klasskamp-${s}`]);
    for (const v of vagg) assert.ok(Math.hypot(v.x - 36, v.y - 22) >= 6, "inte på fanan");
    assert.equal(new Set(vagg.map((v) => `${v.x},${v.y}`)).size, 8, "olika platser");
    for (const v of Object.values(r)) assert.ok(v.x >= 0 && v.x <= 100 && v.y >= 0 && v.y <= 100);
  });

  it("#528: väggplatserna skyms aldrig av pokalhyllan", () => {
    const many = Array.from({ length: 30 }, (_, i) => pokal(`live-vinst-q${String(i).padStart(2, "0")}`, i + 1));
    const hylla = new Set(KC_POKALHYLLA_PLATSER.map((_, i) => JSON.stringify(hyllaPlatsPos(i, MATT))));
    const hx = ((KC_HYLLA.w + KC_POKAL_STORLEK.w) * MATT.enhet * 50) / MATT.W;
    const hy = ((KC_HYLLA.h + KC_POKAL_STORLEK.h) * MATT.enhet * 50) / MATT.H;
    for (const p of Object.values(placeraPokaler(many, {}, MATT))) {
      if (hylla.has(JSON.stringify({ x: p.x, y: p.y }))) continue;
      assert.ok(Math.abs(p.x - KC_HYLLA.x) >= hx || Math.abs(p.y - KC_HYLLA.y) >= hy, `${p.x},${p.y} under hyllan`);
    }
  });

  it("hyllplatserna ligger inom hyllan och följer scenens mått", () => {
    for (const m of [MATT, { W: 600, H: 800, enhet: 15 }, null]) {
      for (let i = 0; i < KC_POKALHYLLA_PLATSER.length; i++) {
        const p = hyllaPlatsPos(i, m);
        assert.ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 62, `plats ${i} på väggen`);
      }
    }
    // Ett hyllplan, vänster→höger.
    assert.equal(KC_POKALHYLLA_PLATSER.length, 3, "#528: gratis-hyllan rymmer 3");
    assert.ok(hyllaPlatsPos(0, MATT).x < hyllaPlatsPos(1, MATT).x && hyllaPlatsPos(1, MATT).x < hyllaPlatsPos(2, MATT).x);
    assert.equal(hyllaPlatsPos(0, MATT).y, hyllaPlatsPos(2, MATT).y);
    assert.ok(KC_HYLLA.w > KC_POKAL_STORLEK.w * 3, "tre pokaler per hyllplan ryms");
  });
});

describe("#528 Troféhyllan = hedershyllan", () => {
  const nio = Array.from({ length: 9 }, (_, i) => ({ ...pokal(`live-vinst-s${i}`, i + 1), varde: i === 0 ? 99 : 10 }));
  const TH = { trofehylla: { x: 60, y: 30, z: 1 } };

  it("utan Troféhylla i rummet → inga hederspokaler, 3 på hyllan", () => {
    assert.deepEqual(hedersPokaler(nio, {}), []);
    const r = placeraPokaler(nio, {}, MATT);
    assert.equal(Object.keys(r).length, 9);
  });

  it("med Troféhylla → de 6 finaste i den, resten auto-placeras (3 på hyllan, övriga på väggen)", () => {
    const h = hedersPokaler(nio, TH);
    assert.equal(h.length, KC_HEDERS_MAX);
    assert.equal(KC_HEDERS_MAX, 6);
    assert.equal(KC_HEDERS_MAX > KC_POKALHYLLA_PLATSER.length, true, "rymmer fler än gratis-hyllan");
    assert.equal(h[0].id, "live-vinst-s0", "finast (varde) först trots äldst");
    assert.deepEqual(h.slice(1).map((p) => p.id), ["live-vinst-s8", "live-vinst-s7", "live-vinst-s6", "live-vinst-s5", "live-vinst-s4"]);
    const r = placeraPokaler(nio, TH, MATT);
    assert.deepEqual(Object.keys(r).sort(), ["pokal-live-vinst-s1", "pokal-live-vinst-s2", "pokal-live-vinst-s3"]);
    for (const p of h) assert.equal(pokalNyckel(p.id) in r, false, "aldrig dubbelt");
  });

  it("flyttad pokal stannar där den flyttats, även med Troféhylla", () => {
    const pi = { ...TH, "pokal-live-vinst-s0": { x: 5, y: 5, z: 0 } };
    assert.equal(hedersPokaler(nio, pi).some((p) => p.id === "live-vinst-s0"), false);
    assert.equal("pokal-live-vinst-s0" in placeraPokaler(nio, pi, MATT), false);
  });

  it("finastForst: varde ↓, nyast, id", () => {
    const l = [{ id: "b", varde: 1, wonAt: 5 }, { id: "a", varde: 1, wonAt: 5 }, { id: "c", varde: 2, wonAt: 1 }, { id: "d", varde: 1, wonAt: 9 }];
    assert.deepEqual(l.sort(finastForst).map((p) => p.id), ["c", "d", "a", "b"]);
  });
});

describe("layouten godtar flyttade pokaler", () => {
  it("validatePlacedItems: pokal-nyckel ok utan möbellåda; okänd typ nekas", () => {
    const ok = validatePlacedItems({ "pokal-mm-klasskamp-a1": { x: 40, y: 20, z: 3 }, lounge: { x: 1, y: 80 } }, { lada: ["lounge"] });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.placedItems["pokal-mm-klasskamp-a1"], { x: 40, y: 20, z: 3 });
    assert.equal(validatePlacedItems({ "pokal-hittepa-1": { x: 1, y: 1 } }).kod, "okant-foremal");
    assert.equal(validatePlacedItems({ "pokal-mm-klasskamp-a1": { x: "x", y: 1 } }).kod, "ogiltig-position");
  });

  it(`högst ${KC_POKAL_MAX} flyttade pokaler`, () => {
    const pi = {};
    for (let i = 0; i <= KC_POKAL_MAX; i++) pi[`pokal-live-vinst-s${i}`] = { x: 10, y: 10, z: 0 };
    assert.equal(validatePlacedItems(pi).kod, "for-manga-pokaler");
    delete pi["pokal-live-vinst-s0"];
    assert.equal(validatePlacedItems(pi).ok, true);
  });

  it("normaliseraLayout och planRestore behåller pokalerna (aldrig i lådan)", () => {
    const pi = { "pokal-live-vinst-s1": { x: 5, y: 6, z: 1 }, flygel: { x: 20, y: 80, z: 0 } };
    assert.deepEqual(Object.keys(normaliseraLayout({ placedItems: pi, version: 2 }).placedItems).sort(), Object.keys(pi).sort());
    const r = planRestore({ placedItems: pi, version: 2 }, { lada: [] });
    assert.deepEqual(Object.keys(r.placedItems), ["pokal-live-vinst-s1"]);
  });
});

describe("kc-rum-tillstand: auto-saker (#497)", () => {
  const layout = (version, placedItems = {}) => ({ version, placedItems, updatedBy: "u", updatedAt: null });
  const nytt = (lista = P) => skapaKcRumTillstand({ autoPlacera: (lokal) => placeraPokaler(lista, lokal, MATT) });

  it("auto-pokaler syns men sparas inte och ger inget osparat", () => {
    const t = nytt();
    t.fjarr(layout(1, { lounge: { x: 40, y: 80, z: 1 } }));
    assert.deepEqual(Object.keys(t.placements).sort(), ["lounge", "pokal-live-vinst-b2", "pokal-mm-klasskamp-a1", "pokal-mm-klasskamp-c3"]);
    assert.equal(t.arAuto("pokal-mm-klasskamp-a1"), true);
    assert.equal(t.arAuto("lounge"), false);
    t.andrat();
    assert.equal(t.osparat, false);
    assert.deepEqual(Object.keys(t.placedItemsAttSpara()), ["lounge"]);
  });

  it("flyttad auto-pokal blir en vanlig placering → osparat, sparas, övriga flyttar upp", () => {
    const t = nytt();
    t.fjarr(layout(1));
    const p = t.placements;
    p["pokal-mm-klasskamp-c3"] = { ...p["pokal-mm-klasskamp-c3"], x: 70, y: 40 }; // motorns flytt
    t.ovanpa("pokal-mm-klasskamp-c3");
    t.andrat();
    assert.equal(t.osparat, true);
    assert.equal(t.arAuto("pokal-mm-klasskamp-c3"), false);
    assert.deepEqual(Object.keys(t.placedItemsAttSpara()), ["pokal-mm-klasskamp-c3"]);
    assert.deepEqual(t.placements["pokal-live-vinst-b2"], { ...hyllaPlatsPos(0, MATT), z: 0 }, "flyttar upp");
  });

  it("borttagen flyttad pokal (🗑️) → tillbaka på hyllan", () => {
    const t = nytt();
    t.fjarr(layout(1, { "pokal-mm-klasskamp-a1": { x: 70, y: 40, z: 2 } }));
    assert.equal(t.arAuto("pokal-mm-klasskamp-a1"), false);
    delete t.placements["pokal-mm-klasskamp-a1"]; // motorns borttagning
    t.andrat();
    assert.equal(t.osparat, true);
    assert.deepEqual(t.placements["pokal-mm-klasskamp-a1"], { ...hyllaPlatsPos(2, MATT), z: 0 });
    assert.equal(t.arAuto("pokal-mm-klasskamp-a1"), true);
    assert.deepEqual(t.placedItemsAttSpara(), {});
  });

  it("omplacera() räknar om (t.ex. nya pokaler eller nytt scenmått)", () => {
    let lista = [P[0]];
    const t = skapaKcRumTillstand({ autoPlacera: (lokal) => placeraPokaler(lista, lokal, MATT) });
    t.fjarr(layout(1));
    assert.equal(Object.keys(t.placements).length, 1);
    lista = P;
    assert.equal(Object.keys(t.placements).length, 1, "ingen omräkning utan signal");
    t.omplacera();
    assert.equal(Object.keys(t.placements).length, 3);
  });

  it("utan autoPlacera beter sig tillståndet som förut", () => {
    const t = skapaKcRumTillstand();
    t.fjarr(layout(1, { lounge: { x: 40, y: 80, z: 1 } }));
    assert.deepEqual(Object.keys(t.placements), ["lounge"]);
  });
});

describe("hover-rutan", () => {
  it("titel, text, tävling + datum (escapat)", () => {
    const h = pokalTipsHtml({ typ: "mm-klasskamp", titel: "Mattematchens mästare", detalj: "Höstmatchen <v.42>", wonAt: Date.UTC(2026, 9, 3, 12) });
    assert.match(h, /Mattematchens mästare/);
    assert.match(h, /Vinnare av Mattematchen! Klassen kämpade stenhårt tillsammans\./);
    assert.match(h, /Höstmatchen &lt;v\.42&gt;/);
    assert.match(h, /3 oktober 2026/);
  });
  it("okänd typ: bara rubriken", () => {
    const h = pokalTipsHtml({ typ: "framtida", titel: "Ny pokal" });
    assert.match(h, /Ny pokal/);
    assert.doesNotMatch(h, /kc-pokal-tips-text|kc-pokal-tips-fot/);
  });
});

describe("synk + bootgraf", () => {
  const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
  it(`firestore.rules: kcPokalerOk har tak ${KC_POKAL_MAX} och samma typer som registret`, () => {
    const block = rules.match(/function kcPokalerOk\(pk\)\s*\{([\s\S]*?)\n\s*\}/);
    assert.ok(block, "kcPokalerOk finns");
    assert.match(block[1], new RegExp(`pk\\.size\\(\\) <= ${KC_POKAL_MAX}\\b`));
    assert.match(rules, /kcPokalerOk\(pi\.keys\(\)\.removeAll\(kcKatalog\(\)\.keys\(\)\)\)/);
    assert.match(rules, /'pokal-\(' \+ kcPokalTyper\(\)\.join\('\|'\)/);
  });

  it("bootgrafen: 110 filer, inga pokal-/rum-moduler (#271)", () => {
    const g = staticBootGraph();
    for (const f of ["klasscenter/kc-pokal-placering.js", "klasscenter/kc-rum-pokaler.js", "klasscenter/kc-pokal-typer.js",
      "klasscenter/kc-rum-session.js", "art-klasscenter-pokaler.js", "rum-inredning.js"]) {
      assert.equal(g.has(join(SRC, f)), false, `${f} får inte ligga i bootgrafen`);
    }
    assert.equal(g.size, 110);
  });
});

function staticBootGraph() {
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
  return seen;
}
