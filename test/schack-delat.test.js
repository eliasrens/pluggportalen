// ============================================================================
// Schack 2A (#779): den DELADE logiken (src/schack/schack-server-delat.js +
// schack-server-parti.js), synken till functions/schack/ (admin/sync-schack-
// functions.mjs), klientlagret schack-moln.js och bootgrafen (#271, 107).
//   poängformeln §8: 1000 start, vinst +10…+30, förlust −5…−20, remi ±5, golv 800
//   klockan §7.2: serverns tid, den på tur räknar ned, tid slut
//   §7.3: 5 min utan drag (utan klocka), 24 h = gammalt
//   lobbyn §7.1: utmaning 2 min, väntan 10 min, ett parti åt gången
//   partiet: chess.js avgör laglighet, matt, patt, remi; trefaldig upprepning kräver historiken
// Körs med: node --test test/schack-delat.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KLOCKOR, UTMANING_MS, VANTAN_MS, LAMNAT_MS, GAMMALT_MS, START_POANG, GOLV_POANG,
  normaliseraKlocka, nyKlocka, klockaNu, klockaEfterDrag, tidSlut, harLamnat, arGammalt, activeLockMal,
  rensaLobby, partiFor, forvantat, poangDelta, nyPoang, tabellRad, uppdateraTabell, topplista, utfallFor,
} from "../src/schack/schack-server-delat.js";
import { START_FEN, byggParti, bedomSlut, normaliseraDrag, provaDrag } from "../src/schack/schack-server-parti.js";
import { driftedFiles, sharedFiles, FILER, SRC } from "../admin/sync-schack-functions.mjs";
import { Chess } from "../src/schack/vendor/chess.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRCDIR = join(ROOT, "src");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("poängformeln (§8) – ren funktion", () => {
  it("start 1000, lika motstånd: vinst +20, förlust −13 (avrundat), remi 0", () => {
    assert.equal(START_POANG, 1000);
    assert.equal(poangDelta(1000, 1000, 1), 20);
    assert.equal(poangDelta(1000, 1000, 0), -13);
    assert.equal(poangDelta(1000, 1000, 0.5), 0);
  });
  it("vinst ligger i +10…+30 och förlust i −5…−20 för alla rimliga poäng", () => {
    for (let a = 800; a <= 1600; a += 25) {
      for (let b = 800; b <= 1600; b += 25) {
        const v = poangDelta(a, b, 1);
        const f = poangDelta(a, b, 0);
        const r = poangDelta(a, b, 0.5);
        assert.ok(v >= 10 && v <= 30, `vinst ${a} mot ${b}: ${v}`);
        assert.ok(f <= -5 && f >= -20, `förlust ${a} mot ${b}: ${f}`);
        assert.ok(Math.abs(r) <= 5, `remi ${a} mot ${b}: ${r}`);
      }
    }
  });
  it("mer poäng för vinst mot en starkare (förklaringen för eleven), mindre förlust mot en starkare", () => {
    assert.ok(poangDelta(1000, 1400, 1) > poangDelta(1000, 1000, 1));
    assert.ok(poangDelta(1000, 1000, 1) > poangDelta(1000, 700, 1));
    assert.ok(poangDelta(1000, 1400, 0) > poangDelta(1000, 700, 0), "mindre minus mot en starkare");
    assert.ok(poangDelta(1000, 1400, 0.5) > 0 && poangDelta(1400, 1000, 0.5) < 0, "remi gynnar den svagare");
    assert.equal(Math.round(forvantat(1000, 1000) * 100), 50);
  });
  it("golvet 800: ingen hamnar under", () => {
    assert.equal(GOLV_POANG, 800);
    assert.equal(nyPoang(800, 1000, 0), 800);
    assert.equal(nyPoang(805, 900, 0), 800);
    assert.equal(nyPoang(810, 1500, 0), 805);
    assert.equal(nyPoang(800, 1000, 0.5), 800 + poangDelta(800, 1000, 0.5));
  });
  it("uppdateraTabell: båda raderna ur samma gamla poäng, räknare per utfall, nybörjare = 1000", () => {
    const t = uppdateraTabell({}, { vit: "a", svart: "b", resultat: "1-0" });
    assert.deepEqual(t.a, { poang: 1020, vinster: 1, forluster: 0, remier: 0, partier: 1 });
    assert.deepEqual(t.b, { poang: 987, vinster: 0, forluster: 1, remier: 0, partier: 1 });
    const t2 = uppdateraTabell(t, { vit: "b", svart: "a", resultat: "½-½" });
    assert.equal(t2.a.remier, 1);
    assert.equal(t2.b.remier, 1);
    assert.equal(t2.a.partier, 2);
    assert.equal(t2.a.poang + t2.b.poang <= t.a.poang + t.b.poang + 1, true, "remi är nästan nollsumma");
    const t3 = uppdateraTabell({ a: { poang: 801 } }, { vit: "a", svart: "b", resultat: "0-1" });
    assert.equal(t3.a.poang, 800);
    assert.equal(t3.b.poang, 1000 + poangDelta(1000, 801, 1));
    assert.deepEqual(tabellRad({}, "x"), { poang: 1000, vinster: 0, forluster: 0, remier: 0, partier: 0 });
    assert.deepEqual(utfallFor("0-1"), { w: 0, b: 1 });
  });
  it("topplista: sorterad på poäng, sedan vinster, med placering", () => {
    const l = topplista({ a: { poang: 1010, vinster: 1 }, b: { poang: 1030 }, c: { poang: 1010, vinster: 2 } }, (u) => u.toUpperCase());
    assert.deepEqual(l.map((r) => [r.plats, r.uid, r.namn]), [[1, "b", "B"], [2, "c", "C"], [3, "a", "A"]]);
  });
});

describe("klockan (§7.2) med serverns tid", () => {
  it("klockval: null/5/10/15 giltiga, annat undefined", () => {
    assert.deepEqual([...KLOCKOR], [null, 5, 10, 15]);
    assert.equal(normaliseraKlocka(null), null);
    assert.equal(normaliseraKlocka(0), null);
    assert.equal(normaliseraKlocka("10"), 10);
    assert.equal(normaliseraKlocka(7), undefined);
    assert.equal(normaliseraKlocka("x"), undefined);
  });
  it("den på tur räknar ned från senastDragAt; efter draget byter räkningen sida", () => {
    const k = nyKlocka(5, 1000);
    assert.deepEqual(k, { minuter: 5, vitMs: 300_000, svartMs: 300_000, senastDragAt: 1000 });
    assert.deepEqual(klockaNu(k, "w", 61_000), { vitMs: 240_000, svartMs: 300_000, slut: false });
    assert.equal(tidSlut(k, "w", 61_000), false);
    const k2 = klockaEfterDrag(k, "w", 61_000);
    assert.deepEqual(k2, { minuter: 5, vitMs: 240_000, svartMs: 300_000, senastDragAt: 61_000 });
    assert.deepEqual(klockaNu(k2, "b", 71_000), { vitMs: 240_000, svartMs: 290_000, slut: false });
  });
  it("tid slut: 0 kvar, draget nekas (null), klientens klocka spelar ingen roll", () => {
    const k = nyKlocka(5, 0);
    assert.deepEqual(klockaNu(k, "w", 300_000), { vitMs: 0, svartMs: 300_000, slut: true });
    assert.equal(tidSlut(k, "w", 299_999), false);
    assert.equal(tidSlut(k, "w", 300_000), true);
    assert.equal(klockaEfterDrag(k, "w", 400_000), null);
    assert.equal(tidSlut(klockaEfterDrag(k, "w", 10_000), "b", 305_000), false, "bara den på tur förbrukar tid");
    assert.equal(tidSlut(klockaEfterDrag(k, "w", 10_000), "b", 310_000), true);
    assert.equal(tidSlut(null, "w", 1e12), false);
    assert.deepEqual(klockaNu(k, "w", -5), { vitMs: 300_000, svartMs: 300_000, slut: false }, "en klocka bakåt ger aldrig mer tid");
  });
  it("§7.3: 5 min utan drag = lämnat, 24 h = gammalt", () => {
    assert.equal(LAMNAT_MS, 300_000);
    assert.equal(GAMMALT_MS, 86_400_000);
    assert.equal(harLamnat(0, 299_999), false);
    assert.equal(harLamnat(0, 300_000), true);
    assert.equal(arGammalt(0, GAMMALT_MS - 1), false);
    assert.equal(arGammalt(0, GAMMALT_MS), true);
  });
  it("fokusläget: bara ett lås med till i framtiden räknas", () => {
    assert.equal(activeLockMal(null, 10), null);
    assert.equal(activeLockMal({ mal: { typ: "omrade" }, till: 10 }, 10), null);
    assert.deepEqual(activeLockMal({ mal: { typ: "lasresan" }, till: 11 }, 10), { typ: "lasresan" });
    assert.equal(activeLockMal({ mal: {}, till: 11 }, 10), null);
  });
});

describe("lobbyn (§7.1)", () => {
  it("rensaLobby: väntan 10 min, utmaning 2 min; trasiga poster bort", () => {
    assert.equal(UTMANING_MS, 120_000);
    assert.equal(VANTAN_MS, 600_000);
    const klass = {
      vantar: { a: { namn: "A", klocka: null, sedan: 0 }, b: { namn: "B", klocka: 5, sedan: 100_000 }, c: { namn: "C" } },
      utmaningar: { u1: { fran: "a", till: "b", sedan: 500_000 }, u2: { fran: "b", till: "a", sedan: 599_000 } },
    };
    const r = rensaLobby(klass, 620_000);
    assert.deepEqual(Object.keys(r.vantar), ["b"]);
    assert.deepEqual(Object.keys(r.utmaningar), ["u2"]);
    assert.equal(r.andrad, true);
    assert.equal(rensaLobby({ vantar: {}, utmaningar: {} }, 1).andrad, false);
    assert.deepEqual(rensaLobby(null, 1), { vantar: {}, utmaningar: {}, andrad: false });
  });
  it("partiFor: elevens pågående parti", () => {
    const partier = { p1: { vit: "a", svart: "b" }, p2: { vit: "c", svart: "d" } };
    assert.equal(partiFor(partier, "b"), "p1");
    assert.equal(partiFor(partier, "d"), "p2");
    assert.equal(partiFor(partier, "e"), null);
    assert.equal(partiFor(undefined, "a"), null);
  });
});

describe("partiet – chess.js avgör (§1, §6)", () => {
  it("lagligt drag ger SAN, FEN och nästa tur; olagligt eller trasigt ger null", () => {
    const r = provaDrag([], { from: "e2", to: "e4" });
    assert.equal(r.san, "e4");
    assert.equal(r.tur, "b");
    assert.deepEqual(r.drag, ["e4"]);
    assert.equal(r.slut, null);
    assert.match(r.fen, /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b KQkq/);
    assert.equal(provaDrag([], { from: "e2", to: "e5" }), null);
    assert.equal(provaDrag([], { from: "e7", to: "e5" }), null, "svart får inte dra först");
    assert.equal(provaDrag([], { from: "e2", to: "e2" }), null);
    assert.equal(provaDrag([], { from: "z9", to: "e4" }), null);
    assert.equal(provaDrag([], null), null);
    assert.equal(provaDrag([], { from: "e2", to: "e4", promotion: "k" }), null);
    assert.deepEqual(normaliseraDrag({ from: "E2", to: "E4", promotion: "" }), { from: "e2", to: "e4" });
    assert.deepEqual(normaliseraDrag({ from: "a7", to: "a8", promotion: "N" }), { from: "a7", to: "a8", promotion: "n" });
    assert.equal(byggParti([]).fen(), START_FEN);
  });
  it("ett drag som lämnar kungen i schack nekas", () => {
    // 1. e4 e5 2. Bc4 Nc6 3. Qh5 – svart kan inte flytta f-bonden fritt när Dh5 hotar? Enklare: bunden pjäs.
    const drag = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6"];
    // Vit: Dxf7#. Bygg ställning där svart springare e7 är bunden mot kungen.
    const r = provaDrag(drag, { from: "h5", to: "f7" });
    assert.equal(r.san, "Qxf7#");
    assert.deepEqual(r.slut, { resultat: "1-0", orsak: "matt" });
    const bunden = provaDrag(["e4", "d5", "Bb5+"], { from: "c7", to: "c6" });
    assert.equal(bunden.san, "c6", "täcka schacken går");
    assert.equal(provaDrag(["e4", "d5", "Bb5+"], { from: "g8", to: "f6" }), null, "ignorera schacken går inte");
  });
  it("narrmatt → 0-1 matt; patt och för lite material → remi", () => {
    assert.deepEqual(provaDrag(["f3", "e5", "g4"], { from: "d8", to: "h4" }).slut, { resultat: "0-1", orsak: "matt" });
    assert.deepEqual(bedomSlut(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")), { resultat: "½-½", orsak: "patt" });
    assert.deepEqual(bedomSlut(new Chess("7k/8/6K1/8/8/8/8/8 w - - 0 1")), { resultat: "½-½", orsak: "remi" });
    assert.equal(bedomSlut(new Chess()), null);
  });
  it("trefaldig upprepning räknas ur HELA draglistan (en FEN ensam räcker inte)", () => {
    const d = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1"];
    const r = provaDrag(d, { from: "f6", to: "g8" });
    assert.deepEqual(r.slut, { resultat: "½-½", orsak: "remi" });
    const r2 = provaDrag(d.slice(0, 3), { from: "f6", to: "g8" });
    assert.equal(r2.slut, null);
  });
  it("förvandling: utan val blir det dam, annars vald pjäs", () => {
    const d = ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2", "bxa8=Q", "gxh1=Q"];
    assert.equal(byggParti(d).fen().split(" ")[0], "Qnbqkbnr/p1ppppp1/8/8/8/8/1PPPPP1P/RNBQKBNq");
    const r = provaDrag(d.slice(0, 8), { from: "b7", to: "a8" });
    assert.equal(r.san, "bxa8=Q");
    assert.equal(provaDrag(d.slice(0, 8), { from: "b7", to: "a8", promotion: "n" }).san, "bxa8=N");
  });
});

describe("synken till functions/schack/ (admin/sync-schack-functions.mjs)", () => {
  it("kopian är i synk och innehåller exakt de delade filerna", () => {
    assert.deepEqual(driftedFiles(), []);
    assert.deepEqual(sharedFiles(), ["vendor/chess.js", "vendor/LICENSE", "schack-server-delat.js", "schack-server-parti.js"]);
    assert.equal(FILER.length, 4);
  });
  it("den delade koden är ren: inga webbläsar-/Firebase-importer, bara relativa importer inom src/schack/", () => {
    for (const f of FILER.filter((f) => f.endsWith(".js") && !f.includes("vendor/"))) {
      const src = readFileSync(join(SRC, f), "utf8");
      assert.doesNotMatch(src, /from\s+["']https?:/, `${f}: CDN-import`);
      assert.doesNotMatch(src, /\b(document|window|localStorage)\./, `${f}: webbläsar-API`);
      assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /firebase/i, `${f}: Firebase hör till klient-/serverlagret`);
      assert.doesNotMatch(src, /Math\.random\s*\(/, `${f}: slumpen tas i servern (crypto)`);
      for (const [, spec] of src.matchAll(/(?:import|export)[^"']*from\s+["']([^"']+)["']/g)) {
        assert.ok(spec.startsWith("./"), `${f}: bara importer inom src/schack/ (${spec})`);
      }
    }
  });
  it("npm-skriptet och predeploy finns", () => {
    const pkg = JSON.parse(las("package.json"));
    assert.equal(pkg.scripts["sync:schack"], "node admin/sync-schack-functions.mjs");
    assert.match(las("firebase.json"), /sync-schack-functions\.mjs/);
  });
});

describe("klientlagret schack-moln.js och bootgrafen (#271)", () => {
  it("schack-moln.js anropar alla elva callables och öppnar de två lyssnarna", () => {
    const m = kod("src/schack/schack-moln.js");
    for (const n of ["schackVanta", "schackSlutaVanta", "schackGaMed", "schackUtmana", "schackSvara", "schackDrag", "schackGeUpp",
      "schackRemi", "schackKravaVinst", "schackLarareAvsluta", "schackLarareTopplista"]) {
      assert.match(m, new RegExp(`"${n}"`), n);
    }
    assert.match(m, /onSnapshot\(doc\(db, "schackKlass", classId\)/);
    assert.match(m, /onSnapshot\(doc\(db, "schackPartier", partiId\)/);
    assert.match(m, /serverNow/);
  });
  it("index.js exporterar samma elva callables och proxyn släpper igenom dem", () => {
    const idx = las("functions/index.js");
    const proxy = las("admin/qa-emulator-proxy.mjs");
    for (const n of ["schackVanta", "schackSlutaVanta", "schackGaMed", "schackUtmana", "schackSvara", "schackDrag", "schackGeUpp",
      "schackRemi", "schackKravaVinst", "schackLarareAvsluta", "schackLarareTopplista"]) {
      assert.match(idx, new RegExp(`export const ${n} = `), n);
      assert.match(proxy, new RegExp(`"/${n}"`), n);
    }
  });
  it("bootgrafen är kvar på 107 och ingen schackfil ligger i den", () => {
    const g = staticBootGraph();
    assert.equal(g.size, 107);
    assert.ok(![...g].some((f) => f.startsWith(join(SRCDIR, "schack") + "/")), "ingen schackfil i bootgrafen");
    for (const fil of filerUnder(SRCDIR).filter((f) => f.endsWith(".js") && !f.startsWith(join(SRCDIR, "schack") + "/"))) {
      assert.doesNotMatch(readFileSync(fil, "utf8"), /^\s*(?:import|export)\s[^;]*?from\s+["'][^"']*schack-moln/m, relative(ROOT, fil));
    }
  });
});

function filerUnder(mapp) {
  return readdirSync(mapp).flatMap((f) => {
    const p = join(mapp, f);
    return statSync(p).isDirectory() ? filerUnder(p) : [p];
  });
}

function staticBootGraph() {
  const start = join(SRCDIR, "app.js");
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
