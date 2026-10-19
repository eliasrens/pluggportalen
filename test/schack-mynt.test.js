// ============================================================================
// Schackets pluggmynt (#798, docs/SCHACK.md §18) – utan emulator.
// ----------------------------------------------------------------------------
//   * serverns kontroll (schack-mynt-kontroll.js): ett riktigt parti mot Bonden/
//     Springaren godkänns; fel seed, fel nivå, ett utbytt datordrag, olagligt drag,
//     ingen matt, för lång draglista nekas; elevens färg ur matten
//   * lektionerna: varje lektions lösning godkänns, fel svar/ofullständig jakt/patt nekas
//   * pusslen: lösningen (och ett annat mattdrag) godkänns, fel drag nekas
//   * klientens skapaMynt: kvittot läses en gång, uppdateras lokalt, onBetalt bara vid mynt
//   * texterna, husets pokal (schackPokaler), reglerna och callable-listan i källkoden
// Motorn spelar själv (analysera för eleven, valjDrag för datorn) – som i appen.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/schack/vendor/chess.js";
import { valjDrag, analysera, provaDatorDrag } from "../src/schack/schack-motor.js";
import { verifieraDatorParti, verifieraLektion, verifieraPussel, MAX_HALVDRAG, maxGrunda } from "../src/schack/schack-mynt-kontroll.js";
import {
  DATOR_MYNT, LEKTION_MYNT, PUSSEL_MYNT, SCHACK_POKALER, pusselNyckel, normaliseraKvitto, efterUtbetalning,
  harDator, harLektion, harPussel, nivaBelonningText, datorVinstText,
} from "../src/schack/schack-mynt-delat.js";
import { skapaMynt } from "../src/schack/schack-mynt.js";
import { LEKTIONER, bedomDrag } from "../src/schack/schack-lektioner.js";
import { minstaDrag } from "../src/schack/schack-stjarnjakt.js";
import { schackPokaler, pokalNyckel, arPokalNyckel } from "../src/hitta-ratt/hr-pokal.js";
import { schackPokalSvg } from "../src/schack/schack-pokal-art.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (f) => readFileSync(join(ROOT, f), "utf8");
const bank = (fil) => JSON.parse(las(`src/schack/pussel/${fil}`)).pussel;

/**
 * Ett parti som i appen: datorn = valjDrag(nivå, seed + halvdrag · 7919, historiken),
 * eleven = analysera på `elevDjup`. Returnerar { drag, chess }.
 */
function spela({ niva, seed, elevFarg = "w", elevDjup = 3, max = 300 }) {
  const c = new Chess();
  const drag = [];
  while (!c.isGameOver() && drag.length < max) {
    const fen = c.fen();
    const d = c.turn() === elevFarg
      ? analysera(fen, { djup: elevDjup, historik: { drag: [...drag] }, tidsgransMs: 5000 }).drag
      : valjDrag(fen, { niva, seed: (seed + drag.length * 7919) >>> 0, historik: { drag: [...drag] } }).drag;
    drag.push(c.move(d).san);
  }
  return { drag, chess: c };
}

const vinstBonden = spela({ niva: "bonden", seed: 12345 });
const vinstSvart = spela({ niva: "bonden", seed: 777, elevFarg: "b" });

describe("serverns kontroll av ett parti mot datorn (verifieraDatorParti)", () => {
  it("partierna i testet slutar med elevens matt", () => {
    assert.ok(vinstBonden.chess.isCheckmate() && vinstBonden.chess.turn() === "b");
    assert.ok(vinstSvart.chess.isCheckmate() && vinstSvart.chess.turn() === "w");
  });

  it("ett riktigt parti mot Bonden godkänns, även när eleven har svart", () => {
    assert.deepEqual(verifieraDatorParti({ niva: "bonden", seed: 12345, drag: vinstBonden.drag }), { ok: true, studentFarg: "w" });
    assert.deepEqual(verifieraDatorParti({ niva: "bonden", seed: 777, drag: vinstSvart.drag }), { ok: true, studentFarg: "b" });
  });

  it("ett riktigt parti mot Damen godkänns – spelat med 120 ms tidsgräns (en långsam Chromebook, lägre djup)", () => {
    const f = JSON.parse(las("test/fixtures/schack-damen-vinst.json"));
    assert.deepEqual(verifieraDatorParti({ niva: f.niva, seed: f.seed, drag: f.drag }), { ok: true, studentFarg: "w" });
    assert.equal(verifieraDatorParti({ niva: "tornet", seed: f.seed, drag: f.drag }).fel, "dator", "Tornet hade spelat annorlunda");
  });

  it("ett vunnet parti mot Tornet räknas inte som Damen (Tornet = Damen på djup 3, granskningsfynd #798)", () => {
    const p = spela({ niva: "tornet", seed: 1, elevDjup: 4 });
    assert.ok(p.chess.isCheckmate());
    assert.equal(verifieraDatorParti({ niva: "tornet", seed: 1, drag: p.drag }).ok, true);
    const r = verifieraDatorParti({ niva: "damen", seed: 1, drag: p.drag });
    assert.equal(r.ok, false);
    assert.equal(r.fel, "dator");
  });

  it("maxGrunda: högst 10 % (minst 1) av datordragen får stämma bara under nivåns djup", () => {
    assert.equal(maxGrunda(5), 1);
    assert.equal(maxGrunda(40), 4);
  });

  it("ett riktigt parti mot Springaren godkänns (slumpen med seed)", () => {
    const p = spela({ niva: "springaren", seed: 4242 });
    assert.ok(p.chess.isCheckmate());
    assert.equal(verifieraDatorParti({ niva: "springaren", seed: 4242, drag: p.drag }).ok, true);
  });

  it("fel seed eller fel nivå: datorns drag stämmer inte", () => {
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 12346, drag: vinstBonden.drag }).fel, "dator");
    // Samma parti påstått mot Damen: Damen hade aldrig spelat Bondens drag.
    assert.equal(verifieraDatorParti({ niva: "damen", seed: 12345, drag: vinstBonden.drag }).fel, "dator");
  });

  it("ett utbytt datordrag (en dålig dator inlagd för hand) nekas", () => {
    // Byt datorns första drag mot ett annat lagligt drag och låt eleven fortsätta likadant så långt det går.
    const c = new Chess();
    c.move(vinstBonden.drag[0]);
    const annat = c.moves().find((m) => m !== vinstBonden.drag[1]);
    const fusk = [vinstBonden.drag[0], annat];
    const k = new Chess();
    fusk.forEach((d) => k.move(d));
    // Spela till matt med eleven mot ett datorlöst "parti" (svart gör sämsta tänkbara: första lagliga draget).
    while (!k.isGameOver() && fusk.length < 400) {
      const d = k.turn() === "w" ? analysera(k.fen(), { djup: 2, tidsgransMs: 2000 }).drag : k.moves({ verbose: true })[0];
      fusk.push(k.move(d).san);
    }
    assert.ok(k.isCheckmate(), "fuskpartiet slutar med matt");
    const r = verifieraDatorParti({ niva: "bonden", seed: 12345, drag: fusk });
    assert.equal(r.ok, false);
    assert.equal(r.fel, "dator");
    assert.equal(r.halvdrag, 1, "redan datorns första drag fälls");
  });

  it("olagligt drag, ingen matt, datorn vann, trasiga indata och för lång lista nekas", () => {
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1, drag: ["e4", "e5", "Ke3", "Ke6"] }).fel, "olagligt");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 12345, drag: vinstBonden.drag.slice(0, -1) }).fel, "ingen-matt");
    // Narrmatt: svart (datorn) gör matt – eleven (vit) vann inte.
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1, drag: ["f3", "e5", "g4", "Qh4#"] }, { egenFarg: "w" }).fel, "ingen-matt");
    assert.equal(verifieraDatorParti({ niva: "kungen", seed: 1, drag: vinstBonden.drag }).fel, "niva");
    assert.equal(verifieraDatorParti({ niva: "constructor", seed: 1, drag: vinstBonden.drag }).fel, "niva");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: -1, drag: vinstBonden.drag }).fel, "seed");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1.5, drag: vinstBonden.drag }).fel, "seed");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1, drag: "e4 e5" }).fel, "drag");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1, drag: [] }).fel, "drag");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1, drag: [{ from: "e2" }] }).fel, "drag");
    assert.equal(verifieraDatorParti({ niva: "bonden", seed: 1, drag: Array(MAX_HALVDRAG + 1).fill("e4") }).fel, "drag");
    assert.equal(verifieraDatorParti(null).fel, "niva");
  });

  it("tidsgränsen för hela partiet gäller (fel 'tid', ingen evig kontroll)", () => {
    let t = 0;
    const r = verifieraDatorParti({ niva: "bonden", seed: 12345, drag: vinstBonden.drag }, { nu: () => (t += 1000), partiTidsgransMs: 3000 });
    assert.equal(r.fel, "tid");
  });

  it("provaDatorDrag: rätt djup hittas, och ett drag nivån aldrig väljer ger 0", () => {
    const fen = new Chess().fen();
    const d = valjDrag(fen, { niva: "tornet", seed: 1 }).drag;
    const djup = provaDatorDrag(fen, d, { niva: "tornet", seed: 1, minDjup: 2 });
    assert.ok(djup >= 2 && djup <= 3, `djup ${djup}`); // första djupet (från minDjup) där valet är detsamma
    assert.equal(provaDatorDrag(fen, { from: "g1", to: "h3" }, { niva: "tornet", seed: 1, minDjup: 2 }), 0);
  });
});

/** En lösning per lektion, byggd ur lektionsdatan (som eleven skulle göra). */
function losningFor(l) {
  if (l.typ === "fragor") return l.uppgifter.map((u) => u.svar[0]);
  if (l.typ === "jakt") return l.uppgifter.map((u) => minstaDrag(u).vag);
  if (l.typ === "stallning") {
    return l.uppgifter.map((u) => {
      const c = new Chess(u.fen);
      for (const m of c.moves({ verbose: true })) {
        const k = new Chess(u.fen);
        k.move(m);
        if (bedomDrag(u, { piece: m.piece, captured: m.captured, flags: m.flags, san: m.san, efter: k.fen() }).ok) {
          return { from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) };
        }
      }
      throw new Error(`ingen lösning i lektion ${l.nr}`);
    });
  }
  return { seed: 12345, drag: vinstBonden.drag };
}

describe("serverns kontroll av en lektion (verifieraLektion)", () => {
  it("alla 12 lektioner godkänns med en riktig lösning", () => {
    for (const l of LEKTIONER) assert.deepEqual(verifieraLektion(l.nr, losningFor(l)), { ok: true }, `lektion ${l.nr}`);
  });

  it("lektion 12: ett remi- eller förlustparti spelat klart räknas, ett avbrutet (uppgivet) inte", () => {
    const forlust = spela({ niva: "bonden", seed: 5, elevDjup: 1, max: 400 });
    if (forlust.chess.isGameOver()) assert.equal(verifieraLektion(12, { seed: 5, drag: forlust.drag }).ok, true);
    assert.equal(verifieraLektion(12, { seed: 12345, drag: vinstBonden.drag.slice(0, 10) }).fel, "inte-slut");
    assert.equal(verifieraLektion(12, { seed: 12346, drag: vinstBonden.drag }).fel, "dator");
    assert.equal(verifieraLektion(12, [vinstBonden.drag]).fel, "losning");
  });

  it("fel svar, ofullständig eller olaglig jakt, patt och trasig form nekas", () => {
    const l1 = losningFor(LEKTIONER[0]);
    assert.equal(verifieraLektion(1, ["e5", ...l1.slice(1)]).fel, "fel-svar");
    assert.equal(verifieraLektion(1, l1.slice(1)).fel, "losning");
    const l2 = losningFor(LEKTIONER[1]);
    assert.equal(verifieraLektion(2, [l2[0].slice(0, -1), l2[1]]).fel, "fel-svar", "en stjärna kvar");
    assert.equal(verifieraLektion(2, [["h8"], l2[1]]).fel, "fel-svar", "tornet kan inte gå a1–h8");
    assert.equal(verifieraLektion(2, [Array(65).fill("a2"), l2[1]]).fel, "losning");
    // Lektion 10 uppgift 2: Df7 är patt.
    const l10 = losningFor(LEKTIONER[9]);
    assert.equal(verifieraLektion(10, [l10[0], { from: "f1", to: "f7" }, l10[2]]).fel, "fel-svar");
    assert.equal(verifieraLektion(9, [{ from: "e1", to: "e9" }, ...losningFor(LEKTIONER[8]).slice(1)]).fel, "fel-svar");
    assert.equal(verifieraLektion(11, [...losningFor(LEKTIONER[10]).slice(0, 2), { from: "b7", to: "b8", promotion: "k" }]).fel, "fel-svar");
    assert.equal(verifieraLektion(0, []).fel, "lektion");
    assert.equal(verifieraLektion(13, []).fel, "lektion");
    assert.equal(verifieraLektion("3", losningFor(LEKTIONER[2])).fel, "lektion");
  });
});

describe("serverns kontroll av ett pussel (verifieraPussel)", () => {
  const ett = bank("matt-i-ett.json");
  const tva = bank("matt-i-tva.json");
  it("lösningen godkänns för vart tionde pussel i båda sorterna", () => {
    for (let i = 0; i < ett.length; i += 10) assert.equal(verifieraPussel(ett[i], "ett", [ett[i].losning[0]]), true, ett[i].id);
    for (let i = 0; i < tva.length; i += 10) assert.equal(verifieraPussel(tva[i], "tva", [tva[i].losning[0], tva[i].losning[2]]), true, tva[i].id);
  });
  it("fel drag, bara första draget i matt i två, för många drag och trasig form nekas", () => {
    const p = ett[0];
    const fel = new Chess(p.fen).moves({ verbose: true }).find((m) => `${m.from}${m.to}` !== p.losning[0] && !m.san.includes("#"));
    assert.equal(verifieraPussel(p, "ett", [`${fel.from}${fel.to}`]), false);
    assert.equal(verifieraPussel(tva[0], "tva", [tva[0].losning[0]]), false);
    assert.equal(verifieraPussel(p, "ett", [p.losning[0], p.losning[0]]), false);
    assert.equal(verifieraPussel(p, "ett", []), false);
    assert.equal(verifieraPussel(p, "ett", ["e2e9"]), false);
    assert.equal(verifieraPussel(p, "fyra", [p.losning[0]]), false);
    assert.equal(verifieraPussel(p, "ett", "e2e4"), false);
  });
});

describe("klientens skapaMynt (kvittot och svaren)", () => {
  it("kvittot läses EN gång; en utbetalning uppdaterar det lokalt och kör onBetalt bara vid mynt", async () => {
    let lasningar = 0;
    const betalda = [];
    const mynt = skapaMynt({
      hamtaKvitto: async () => { lasningar++; return { dator: { bonden: 1 } }; },
      datorVinst: async ({ niva }) => (niva === "bonden" ? { mynt: 0, redan: true } : { mynt: DATOR_MYNT[niva], redan: false, pokal: niva === "damen" }),
      lektion: async () => ({ mynt: LEKTION_MYNT, redan: false }),
      pussel: async () => ({ mynt: 0, redan: true }),
      onBetalt: (s) => betalda.push(s.mynt),
    });
    assert.equal(mynt.nu(), null);
    const k = await mynt.kvitto();
    await mynt.kvitto();
    assert.equal(lasningar, 1);
    assert.ok(harDator(k, "bonden") && !harDator(k, "damen"));
    await mynt.datorVinst({ niva: "bonden", seed: 1, drag: ["e4"] });
    await mynt.datorVinst({ niva: "damen", seed: 1, drag: ["e4"] });
    await mynt.lektion(3, []);
    await mynt.pussel("ett", 1, "HiVCC", ["a1a2"]);
    const nu = mynt.nu();
    assert.ok(harDator(nu, "damen") && harLektion(nu, 3) && harPussel(nu, "ett", "HiVCC"));
    assert.ok(nu.pokaler.damen, "Damen ger pokalen även i den lokala kopian");
    assert.equal(nu.total, 500 + 5);
    assert.deepEqual(betalda, [500, 5], "onBetalt bara när mynt betalades");
    assert.equal(lasningar, 1, "ingen ny läsning efter svaren");
  });
  it("ett läsfel ger null och nästa vy försöker igen", async () => {
    let n = 0;
    const mynt = skapaMynt({ hamtaKvitto: async () => { n++; if (n === 1) throw new Error("nät"); return {}; } });
    const orig = console.warn;
    console.warn = () => {};
    try {
      assert.equal(await mynt.kvitto(), null);
      assert.deepEqual(await mynt.kvitto(), normaliseraKvitto({}));
    } finally {
      console.warn = orig;
    }
  });
});

describe("beloppen, texterna och pokalen", () => {
  it("beloppen enligt Elias (200/400/500/500 + pokal, 5, 5)", () => {
    assert.deepEqual({ ...DATOR_MYNT }, { bonden: 200, springaren: 400, tornet: 500, damen: 500 });
    assert.equal(LEKTION_MYNT, 5);
    assert.equal(PUSSEL_MYNT, 5);
    assert.equal(pusselNyckel("tva", "HiVCC"), "tva-HiVCC");
  });
  it("texterna använder {mynt}-markören, aldrig mynt-emojin", () => {
    assert.equal(datorVinstText("bonden", { mynt: 200, redan: false }), "+200 {mynt} – första vinsten mot Bonden!");
    assert.equal(datorVinstText("bonden", { mynt: 0, redan: true }), "Du har redan fått mynt för Bonden.");
    assert.match(datorVinstText("damen", { mynt: 500, pokal: true }), /^\+500 \{mynt\} och pokalen Damens besegrare – första vinsten mot Damen!$/);
    assert.equal(nivaBelonningText("springaren", {}), "Första vinsten: +400 {mynt}");
    assert.equal(nivaBelonningText("damen", {}), "Första vinsten: +500 {mynt} och en pokal");
    assert.match(nivaBelonningText("bonden", { dator: { bonden: 1 } }), /^✓ Slagen/);
    for (const f of ["schack-mynt-delat.js", "schack-mynt.js", "schack-dator-vy.js", "schack-sida-delar.js", "schack-guide-delar.js", "schack-pussel-vy.js"]) {
      assert.doesNotMatch(las(`src/schack/${f}`), /\u{1FA99}/u, f);
    }
  });
  it("efterUtbetalning + normaliseraKvitto tål trasiga kvitton", () => {
    assert.deepEqual(normaliseraKvitto("x"), { dator: {}, lektioner: {}, pussel: {}, pokaler: {}, total: 0 });
    const k = efterUtbetalning({ dator: [], total: "7" }, "dator", "tornet", 500, 9);
    assert.deepEqual(k.dator, { tornet: 9 });
    assert.equal(k.total, 500);
  });
  it("husets pokal: schackPokaler ur studentData.schack.pokaler med pokal-prefixet", () => {
    assert.deepEqual(schackPokaler(null, SCHACK_POKALER), []);
    assert.deepEqual(schackPokaler({ pokaler: { okand: 1 } }, SCHACK_POKALER), []);
    const [p] = schackPokaler({ pokaler: { damen: 123 } }, SCHACK_POKALER);
    assert.equal(p.nyckel, pokalNyckel("schack-damen"));
    assert.ok(arPokalNyckel(p.nyckel));
    assert.equal(p.typ, "schack");
    assert.equal(p.namn, "Damens besegrare");
    const svg = schackPokalSvg({ aria: p.namn });
    assert.match(svg, /^<svg class="hr-pokal-svg schack-pokal-svg" viewBox="0 0 100 140" role="img" aria-label="Damens besegrare"/);
    assert.doesNotMatch(svg, /<defs|id="|Gradient/, "inga id/gradienter (flera pokaler på samma sida)");
    assert.match(schackPokalSvg({ animera: false }), /aria-hidden="true"/);
  });
});

describe("källkoden: reglerna, callables och bara servern betalar", () => {
  it("reglerna: schackMynt skrivs aldrig av klienter, schack.pokaler rörs aldrig av klienten", () => {
    const r = las("firestore.rules");
    assert.match(r, /match \/schackMynt\/\{uid\} \{\s*allow read: if isSelf\(uid\) \|\| hasStudent\(uid\);\s*allow write: if false;/);
    assert.match(r, /!\('pokaler' in d\) &&/);
  });
  it("tre callables i functions/index.js och klienten, kvittot + coins i EN transaktion", () => {
    const idx = las("functions/index.js");
    for (const n of ["schackDatorVinst", "schackLektionMynt", "schackPusselMynt"]) {
      assert.match(idx, new RegExp(`export const ${n} = schackCall\\("${n}"`), n);
      assert.match(las("src/schack/schack-moln.js"), new RegExp(`"${n}"`), n);
    }
    const srv = las("functions/schack-mynt.js");
    const betala = srv.slice(srv.indexOf("export async function betala"), srv.indexOf("async function redanBetald"));
    assert.match(betala, /runTransaction/);
    assert.match(betala, /coins: c\.FieldValue\.increment\(mynt\)/);
    assert.match(betala, /Object\.hasOwn\(k\[grupp\], nyckel\)/);
  });
  it("klienten skriver aldrig coins eller kvittot", () => {
    for (const f of ["schack-mynt.js", "schack-moln.js", "page-schack.js", "schack-dator-vy.js", "schack-lektion-vy.js", "schack-pussel-vy.js"]) {
      const src = las(`src/schack/${f}`);
      assert.doesNotMatch(src, /coins|setDoc\([^)]*schackMynt|updateDoc\([^)]*schackMynt/, f);
    }
  });
});
