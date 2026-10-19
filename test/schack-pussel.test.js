// ============================================================================
// Pusslen "Matt i ett/två drag" (#791, spec §13–§14, docs/SCHACK.md §16).
// ----------------------------------------------------------------------------
//   (datan och skriptet: test/schack-pussel-data.test.js)
//   * logiken utan DOM: fel drag nekas (pjäsen hoppar tillbaka), tipset pekar på
//     rätt pjäs, varje mattdrag är rätt, försvaret i matt i två
//   * framstegen: EN skrivning per nytt pussel, kvar efter "omladdning"
//   * källkoden: allt i src/schack/, lat (import()/fetch), ingen statisk JSON,
//     bootgrafen 107, inga mynt
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../src/schack/vendor/chess.js";
import {
  SORTER, TEXT, laddaPussel, skapaPusselLopp, uciDrag, normaliseraFramsteg, arNyttLost, efterLost,
  startNummer, lasLage, sparaLage, slutet,
} from "../src/schack/schack-pussel.js";
import { skapaPusselKontroll } from "../src/schack/schack-pussel-vy.js";
import { valHtml, pusselHtml, nrText } from "../src/schack/schack-pussel-delar.js";
import { startHtml } from "../src/schack/schack-sida-delar.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRCDIR = join(ROOT, "src");
const las = (f) => readFileSync(join(ROOT, f), "utf8");
const kod = (f) => las(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const bank = (sort) => JSON.parse(las(`src/schack/pussel/${SORTER[sort].fil}`));

const mattIEtt = (fen) => new Chess(fen).moves({ verbose: true }).filter((m) => {
  const k = new Chess(fen);
  k.move(m);
  return k.isCheckmate();
});

describe("logiken utan DOM (§14: fel drag hoppar tillbaka, tipset visar rätt pjäs)", () => {
  const ett = bank("ett").pussel[0];
  const tva = bank("tva").pussel[0];

  it("matt i ett: fel drag nekas med texten, tipset pekar på lösningens pjäs, mattdraget löser", () => {
    const l = skapaPusselLopp(ett, "ett");
    const t = l.tips();
    assert.equal(t.from, ett.losning[0].slice(0, 2));
    assert.equal(t.to, ett.losning[0].slice(2, 4));
    assert.ok(t.san);
    const fel = new Chess(ett.fen).moves({ verbose: true }).find((m) => !mattIEtt(ett.fen).some((x) => x.lan === m.lan));
    const r = l.bedom(fel);
    assert.deepEqual(r, { ok: false, klart: false, text: TEXT.fel });
    assert.equal(TEXT.fel, "Inte riktigt – prova igen!");
    assert.equal(l.fen(), new Chess(ett.fen).fen(), "ställningen är oförändrad");
    assert.equal(l.fel(), 1);
    const ratt = l.bedom(uciDrag(ett.losning[0]));
    assert.deepEqual(ratt, { ok: true, klart: true, text: "Snyggt! Schack matt! ⭐" });
    assert.ok(l.klart());
    assert.equal(l.tips(), null);
    assert.equal(l.bedom(fel).ok, false, "efter matten görs inget mer");
  });

  it("matt i ett: VARJE drag som ger matt är rätt, även ett annat än lösningens", () => {
    const flera = bank("ett").pussel.find((p) => mattIEtt(p.fen).length > 1);
    assert.ok(flera, "banken har pussel med flera mattdrag");
    for (const m of mattIEtt(flera.fen)) {
      assert.equal(skapaPusselLopp(flera, "ett").bedom(m).klart, true, m.lan);
    }
  });

  it("matt i två: fel första drag nekas, rätt ger datorns försvar ur lösningen, sedan matt; tipset följer med", () => {
    const l = skapaPusselLopp(tva, "tva");
    assert.equal(l.elevDrag(), 1);
    assert.equal(l.tips().from, tva.losning[0].slice(0, 2));
    const fel = new Chess(tva.fen).moves({ verbose: true }).find((m) => m.lan !== tva.losning[0]);
    assert.equal(l.bedom(fel).ok, false);
    const r1 = l.bedom(uciDrag(tva.losning[0]));
    assert.equal(r1.ok, true);
    assert.equal(r1.klart, false);
    assert.deepEqual(r1.forsvar, uciDrag(tva.losning[1]));
    assert.equal(l.elevDrag(), 2);
    assert.equal(l.tips().from, tva.losning[2].slice(0, 2), "tipset visar andra dragets pjäs");
    const c = new Chess(tva.fen);
    c.move(uciDrag(tva.losning[0]));
    c.move(uciDrag(tva.losning[1]));
    assert.equal(l.fen(), c.fen(), "försvaret är gjort i loppet");
    const ickeMatt = c.moves({ verbose: true }).find((m) => !mattIEtt(c.fen()).some((x) => x.lan === m.lan));
    assert.equal(l.bedom(ickeMatt).ok, false, "ett drag som inte ger matt nekas");
    assert.equal(l.bedom(uciDrag(tva.losning[2])).klart, true);
  });

  it("genom brädets kontroll: fel drag → pjäsen står kvar; tipsringen markerar pjäsen och försvinner vid draget", () => {
    let lopp = skapaPusselLopp(tva, "tva");
    let rattDrag = null;
    const k = skapaPusselKontroll({
      egenFarg: "w", interaktiv: "w",
      beforeMove: (d) => { const r = lopp.bedom(d); if (r.ok) rattDrag = r; return r.ok; },
      onMove: () => { if (rattDrag?.forsvar) { const f = rattDrag.forsvar; rattDrag = null; k.move(f); } },
    });
    k.setPosition(tva.fen, { senast: uciDrag(tva.senast) });
    const fore = k.getFen();
    assert.deepEqual(k.getState().senast, { from: tva.senast.slice(0, 2), to: tva.senast.slice(2, 4) });
    const fel = new Chess(tva.fen).moves({ verbose: true }).find((m) => m.lan !== tva.losning[0] && !m.promotion);
    k.tryck(fel.from);
    assert.equal(k.tryck(fel.to).typ, "nekad");
    assert.equal(k.getFen(), fore, "pjäsen hoppade tillbaka");
    assert.equal(k.slapp(fel.from, fel.to).typ, "nekad", "dra och släpp nekas också");
    assert.equal(k.getFen(), fore);
    const t = lopp.tips();
    k.markeraTips(t.from);
    assert.deepEqual(k.getState().rutKlass, { [t.from]: "tips" });
    k.tryck(t.from);
    k.tryck(t.to);
    assert.deepEqual(k.getState().rutKlass, {}, "ringen försvann vid draget");
    assert.equal(k.getHistory().length, 2, "elevens drag + datorns försvar");
    const t2 = lopp.tips();
    k.tryck(t2.from);
    k.tryck(t2.to);
    assert.ok(k.getState().slut, "matt");
    assert.equal(k.getState().slut.orsak, "matt");
    // Ny ställning: ringen bort.
    lopp = skapaPusselLopp(tva, "tva");
    k.markeraTips("a1");
    k.setPosition(tva.fen);
    assert.deepEqual(k.getState().rutKlass, {});
  });
});

describe("framstegen (studentData.schack.pussel, §13)", () => {
  it("normaliseras, och bara ett NYTT pussel räknas (en skrivning), även efter Hoppa över", () => {
    assert.deepEqual(normaliseraFramsteg(null), { ett: { losta: 0, senast: 0 }, tva: { losta: 0, senast: 0 } });
    assert.deepEqual(normaliseraFramsteg({ ett: { losta: "3", senast: -1 }, x: 1 }).ett, { losta: 0, senast: 0 });
    let f = {};
    assert.ok(arNyttLost(f, "ett", 1));
    f = efterLost(f, "ett", 1);
    assert.deepEqual(f.ett, { losta: 1, senast: 1 });
    assert.ok(!arNyttLost(f, "ett", 1), "samma pussel igen");
    f = efterLost(f, "ett", 4); // hoppade över 2 och 3
    assert.deepEqual(f.ett, { losta: 2, senast: 4 });
    assert.ok(!arNyttLost(f, "ett", 2), "ett överhoppat bakom senast räknas inte");
    assert.deepEqual(efterLost(f, "ett", 3), f);
    assert.deepEqual(f.tva, { losta: 0, senast: 0 });
    assert.ok(!arNyttLost(f, "ett", 0) && !arNyttLost(f, "ett", 1.5));
  });

  it("finns kvar efter en omladdning: läget lokalt + framstegen ger samma pussel igen", () => {
    const lagring = new Map();
    const ls = { getItem: (k) => lagring.get(k) ?? null, setItem: (k, v) => lagring.set(k, String(v)), removeItem: (k) => lagring.delete(k) };
    const NYCKEL = "pp:schack:dator:e1:pussel";
    // "Firestore" (studentData-cachen): skrivs med samma ändring som schack-moln.js pusselLost.
    const db = { pussel: {} };
    let skrivningar = 0;
    const spara = (sort, nr) => {
      skrivningar++;
      const g = db.pussel[sort] || { losta: 0, senast: 0 };
      db.pussel[sort] = { losta: g.losta + 1, senast: nr };
    };
    const losOchGaVidare = (sort, nr) => {
      const p = bank(sort).pussel[nr - 1];
      const l = skapaPusselLopp(p, sort);
      for (let i = 0; i < p.losning.length; i += 2) l.bedom(uciDrag(p.losning[i]));
      assert.ok(l.klart());
      if (arNyttLost(db.pussel, sort, nr)) spara(sort, nr);
      sparaLage(ls, NYCKEL, sort, nr + 1);
    };
    // Första besöket: pussel 1, 2, sedan hoppa över 3.
    let nr = startNummer(db.pussel, lasLage(ls, NYCKEL).ett, "ett", 200);
    assert.equal(nr, 1);
    losOchGaVidare("ett", 1);
    losOchGaVidare("ett", 2);
    sparaLage(ls, NYCKEL, "ett", 4);
    // Omladdning: samma lagring och samma "Firestore".
    nr = startNummer(db.pussel, lasLage(ls, NYCKEL).ett, "ett", 200);
    assert.equal(nr, 4, "fortsätter där eleven var");
    losOchGaVidare("ett", 4);
    losOchGaVidare("ett", 1); // gör om det första – ingen skrivning
    assert.equal(skrivningar, 3, "EN skrivning per nytt pussel");
    assert.deepEqual(db.pussel.ett, { losta: 3, senast: 4 });
    // Ny dator (ingen lokal lagring): nästa efter det senast lösta.
    assert.equal(startNummer(db.pussel, undefined, "ett", 200), 5);
    assert.equal(startNummer({ ett: { losta: 150, senast: 180 } }, 250, "ett", 200), 200, "aldrig förbi sista");
    assert.equal(startNummer(db.pussel, undefined, "tva", 200), 1);
  });

  it("vid slutet börjar eleven om på 1 (F1), men fortsätter om den redan gör om dem", () => {
    const klar = { ett: { losta: 200, senast: 200 } };
    assert.equal(startNummer(klar, undefined, "ett", 200), 1, "ny dator");
    assert.equal(startNummer(klar, 200, "ett", 200), 1, "läget står kvar på sista");
    assert.equal(startNummer(klar, 57, "ett", 200), 57, "gör om dem – fortsätt där");
    const hoppat = { ett: { losta: 196, senast: 200 } };
    assert.equal(startNummer(hoppat, 200, "ett", 200), 1, "slutet även efter Hoppa över");
    assert.deepEqual(slutet(hoppat, "ett", 200), { slut: true, alla: false });
    assert.deepEqual(slutet(klar, "ett", 200), { slut: true, alla: true });
    assert.deepEqual(slutet({}, "ett", 200), { slut: false, alla: false });
    assert.equal(startNummer({ ett: { losta: 10, senast: 199 } }, 199, "ett", 200), 199, "inte slutet än");
  });

  it("sista pusslets text säger bara 'alla' när alla är lösta (F2)", () => {
    assert.equal(TEXT.sista(200, 200), "Du har löst alla 200 pussel!");
    assert.equal(TEXT.sista(196, 200), "Du har kommit till sista pusslet – 196 av 200 lösta.");
    const vy = kod("src/schack/schack-pussel-vy.js");
    assert.doesNotMatch(vy, /Du har gjort alla/);
    assert.match(vy, /TEXT\.sista\(framsteg\[sort\]\.losta, lista\.length\)/);
  });

  it("läget lokalt tål en lagring som kastar och trasig JSON", () => {
    const kastar = { getItem() { throw new Error("nekad"); }, setItem() { throw new Error("full"); } };
    assert.deepEqual(lasLage(kastar, "x"), {});
    assert.doesNotThrow(() => sparaLage(kastar, "x", "ett", 3));
    assert.deepEqual(lasLage({ getItem: () => "{trasig" }, "x"), {});
    assert.deepEqual(lasLage({ getItem: () => '{"ett":"5","tva":0,"x":3}' }, "x"), {});
  });
});

describe("lat laddning av banken", () => {
  it("laddaPussel hämtar pussel/<fil>.json bredvid modulen, bara när den anropas", async () => {
    const hamtat = [];
    const hamta = async (url) => {
      hamtat.push(url);
      return { ok: true, json: async () => JSON.parse(readFileSync(new URL(url), "utf8")) };
    };
    const l = await laddaPussel("tva", { hamta });
    assert.equal(l.length, bank("tva").pussel.length);
    assert.equal(hamtat.length, 1);
    assert.match(hamtat[0], /\/src\/schack\/pussel\/matt-i-tva\.json$/);
    await assert.rejects(laddaPussel("tre", { hamta }));
    await assert.rejects(laddaPussel("ett", { hamta: async () => ({ ok: false, status: 404, json: async () => ({}) }) }));
    await assert.rejects(laddaPussel("ett", { hamta: async () => ({ ok: true, json: async () => ({ pussel: [] }) }) }));
  });
});

describe("markupen", () => {
  it("startsidan: kortet Pussel är öppet (inte 'kommer snart')", () => {
    const html = startHtml(null);
    assert.match(html, /data-act="pussel"/);
    assert.doesNotMatch(html, /data-act="pussel"[^>]*aria-disabled/);
  });
  it("valet visar båda sorterna med framstegen; pusselvyn har texten, Tips, Nästa, Förra, Hoppa över och källan", () => {
    const v = valHtml({ ett: { losta: 12, senast: 13 } }, { ett: 200, tva: 200 }, { tva: 7 });
    assert.match(v, /data-sort="ett"/);
    assert.match(v, /data-sort="tva"/);
    assert.match(v, /12 av 200 lösta/);
    assert.match(v, /Fortsätt med pussel 14/);
    assert.match(v, /Fortsätt med pussel 7/);
    assert.match(valHtml({}, {}), /0 lösta/);
    assert.match(valHtml({ ett: { losta: 200, senast: 200 } }, { ett: 200 }, { ett: 200 }), /Alla klara – gör om dem!/);
    assert.match(valHtml({ ett: { losta: 196, senast: 200 } }, { ett: 200 }, { ett: 200 }), /Du har kommit till slutet – gör om dem!/);
    assert.doesNotMatch(valHtml({ ett: { losta: 196, senast: 200 } }, { ett: 200 }, { ett: 200 }), /Fortsätt med pussel 200/);
    assert.match(valHtml({ ett: { losta: 200, senast: 200 } }, { ett: 200 }, { ett: 57 }), /Fortsätt med pussel 57/, "gör om dem");
    const p = pusselHtml("ett");
    assert.match(p, /Vit drar och gör matt i ett drag/);
    assert.match(pusselHtml("tva"), /Vit drar och gör matt i två drag/);
    for (const act of ["tips", "nasta", "forra", "hoppa", "val"]) assert.match(p, new RegExp(`data-act="${act}"`), act);
    assert.match(p, /lichess\.org/);
    assert.equal(nrText(13, 200), "Pussel 13 av 200");
  });
});

describe("källkoden (#271, §13)", () => {
  const NYA = ["schack-pussel.js", "schack-pussel-vy.js", "schack-pussel-delar.js"];

  it("allt nytt ligger i src/schack/ och pusselvyn laddas bara med import()", () => {
    for (const f of NYA) assert.ok(existsSync(join(SRCDIR, "schack", f)), f);
    const flode = kod("src/schack/schack-flode.js");
    assert.match(flode, /import\("\.\/schack-pussel-vy\.js"\)/);
    // Utanför pusselmodulerna själva importerar ingen fil dem statiskt.
    for (const fil of filerUnder(SRCDIR).filter((f) => f.endsWith(".js") && !/[/\\]schack-pussel[^/\\]*\.js$/.test(f))) {
      const src = readFileSync(fil, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      assert.doesNotMatch(src, /^\s*(?:import|export)\s[^;]*?from\s+["'][^"']*schack-pussel[^"']*\.js["']/m, relative(ROOT, fil));
    }
  });

  it("pussel-JSON:en importeras aldrig statiskt – bara fetch i schack-pussel.js", () => {
    for (const fil of filerUnder(SRCDIR).filter((f) => /\.(m?js|html)$/.test(f))) {
      const src = readFileSync(fil, "utf8");
      assert.doesNotMatch(src, /import[^;()]*["'][^"']*pussel\/[^"']*\.json["']/, relative(ROOT, fil));
      assert.doesNotMatch(src, /import\([^)]*\.json/, relative(ROOT, fil));
    }
    const p = kod("src/schack/schack-pussel.js");
    assert.match(p, /new URL\(`\.\/pussel\/\$\{SORTER\[sort\]\.fil\}`, import\.meta\.url\)/);
    assert.match(p, /fetch\(u\)/);
  });

  it("bootgrafen är kvar på 107 och ingen schackfil ligger i den", () => {
    const g = staticBootGraph();
    assert.equal(g.size, 107);
    assert.ok(![...g].some((f) => f.startsWith(join(SRCDIR, "schack") + "/")));
  });

  it("inga mynt, ingen Firestore i pusselvyn; EN skrivning i schack-moln.js pusselLost", () => {
    for (const f of NYA) {
      const src = kod(`src/schack/${f}`);
      assert.doesNotMatch(src, /coins|awardExercise|pluggmynt|firebase|firestore|updateDoc|setDoc/i, f);
      assert.doesNotMatch(src, /\bconfirm\(/, f);
    }
    const moln = kod("src/schack/schack-moln.js");
    const fn = moln.slice(moln.indexOf("export async function pusselLost"));
    assert.equal((fn.match(/updateDoc\(/g) || []).length, 1);
    assert.match(fn, /`schack\.pussel\.\$\{sort\}\.losta`\]: increment\(1\)/);
    assert.match(fn, /`schack\.pussel\.\$\{sort\}\.senast`\]: nr/);
    assert.doesNotMatch(fn, /coins/);
    const page = kod("src/schack/page-schack.js");
    assert.match(page, /pussel: pusselFor\(sd\)/);
    assert.match(page, /pusselLost\(sort, nr\)/);
  });

  it("på smal skärm visas uppgiften bara i statusraden (F3)", () => {
    const css = las("src/styles/40-schack-pussel.css");
    assert.match(css, /@media \(max-width: 820px\) \{[\s\S]*\.schack-pussel-uppgift \{ display: none; \}/);
  });

  it("vyn skriver bara när ett nytt pussel löses och rensar sin timer", () => {
    const vy = kod("src/schack/schack-pussel-vy.js");
    assert.match(vy, /if \(arNyttLost\(framsteg, sort, nr\)\)/);
    assert.equal((vy.match(/pc\.spara\(/g) || []).length, 1);
    assert.match(vy, /destroy\(\) \{[\s\S]*clearTimeout\(timer\)/);
  });

  it("schackOk i firestore.rules har pussel bredvid lektionerna", () => {
    const r = las("firestore.rules");
    assert.match(r, /hasOnly\(\['datorPartier', 'aktivtParti', 'lektioner', 'pussel'\]\)/);
    assert.match(r, /!\('pussel' in d\) \|\| schackPusselOk\(ns\.get\('pussel', \{\}\), schackMap\(os, 'pussel'\)\)/);
    assert.match(las("package.json"), /test\/firestore-rules-schack-pussel\.test\.js/);
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
