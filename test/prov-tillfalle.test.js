// ============================================================================
// Prov C (#740, spec §5 + testlistan): provtillfällets rena logik.
//   • automatisk sparning: tak, felrad + nytt försök, nekad = slutgiltigt
//   • omladdning mitt i provet återställer alla svar (localStorage vs servern)
//   • tidsgränsen: sluttid, nedräkningens färger, elevens läge
//   • lärarens översikt, stängning/öppna igen, fokuslåsets standardtid
//   • budgeten (§9.1) räknad på sparningens tak
// Ren Node: node --test test/prov-tillfalle.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SPARNING, arSlutgiltigtFel, skapaSparare } from "../src/prov/prov-sparning.js";
import {
  arProvetsLas, attOppnaIgen, attStangaIn, elevLage, kvarNiva, kvarText, lokalNyckel, oversiktRader, oversiktSumma,
  provSynligt, slutTid, standardLasMinuter, tillMs, valjStartSvar,
} from "../src/prov/prov-tillfalle-logik.js";
import { delaUppProv, tomtSvar } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

// --- Falsk klocka + timers ------------------------------------------------------
function klocka() {
  let t = 0;
  let nasta = 1;
  const timers = new Map();
  return {
    nu: () => t,
    timer: {
      set: (fn, ms) => { const id = nasta++; timers.set(id, { fn, vid: t + ms }); return id; },
      clear: (id) => timers.delete(id),
    },
    /** Flytta fram tiden och kör förfallna timers (i tidsordning) + väntande promises. */
    async ga(ms) {
      const mal = t + ms;
      for (;;) {
        await new Promise((r) => setImmediate(r));
        const [id, x] = [...timers].filter(([, x]) => x.vid <= mal).sort((a, b) => a[1].vid - b[1].vid)[0] || [];
        if (!id) break;
        timers.delete(id);
        t = Math.max(t, x.vid);
        x.fn();
      }
      t = mal;
      await new Promise((r) => setImmediate(r));
    },
  };
}

function sparare(k, { svara = () => Promise.resolve() } = {}) {
  const statusar = [];
  const anrop = [];
  let slut = null;
  const s = skapaSparare({
    spara: () => { anrop.push(k.nu()); return svara(anrop.length); },
    onStatus: (x) => statusar.push(x.lage),
    onSlutgiltigt: (e) => (slut = e),
    nu: k.nu,
    timer: k.timer,
  });
  return { s, statusar, anrop, slut: () => slut };
}

describe("automatisk sparning (§5.5)", () => {
  it("första sparningen 4 s efter en ändring, sedan 'Sparat'", async () => {
    const k = klocka();
    const { s, anrop, statusar } = sparare(k);
    s.andrat();
    await k.ga(3_999);
    assert.equal(anrop.length, 0);
    await k.ga(1);
    assert.deepEqual(anrop, [4_000]);
    assert.equal(s.status.lage, "sparat");
    assert.equal(s.status.tid, 4_000);
    assert.ok(statusar.includes("sparar"));
  });

  it("taket: en elev som skriver hela tiden sparas högst var 24:e sekund (≤ 101 skrivningar på 40 min)", async () => {
    const k = klocka();
    const { s, anrop } = sparare(k);
    for (let i = 0; i < 40 * 60; i++) {
      s.andrat();
      if (i % 7 === 0) s.lamnatRuta();
      await k.ga(1_000);
    }
    for (let i = 1; i < anrop.length; i++) assert.ok(anrop[i] - anrop[i - 1] >= SPARNING.mellanrumMs, `mellanrum ${i}`);
    assert.ok(anrop.length <= (40 * 60_000) / SPARNING.mellanrumMs + 1, `${anrop.length} skrivningar`);
    assert.ok(anrop.length >= 95, "men sparar ändå löpande");
  });

  it("lämnar eleven en svarsruta sparas det direkt när taket tillåter", async () => {
    const k = klocka();
    const { s, anrop } = sparare(k);
    s.andrat();
    s.lamnatRuta();
    await k.ga(0);
    assert.deepEqual(anrop, [0], "direkt – ingen sparning har gjorts än");
    await k.ga(5_000);
    s.andrat();
    s.lamnatRuta();
    await k.ga(0);
    assert.equal(anrop.length, 1, "inte före taket");
    await k.ga(19_000);
    assert.deepEqual(anrop, [0, 24_000]);
  });

  it("spolaNu sparar direkt utan tak (eleven lämnar sidan)", async () => {
    const k = klocka();
    const { s, anrop } = sparare(k);
    s.andrat();
    s.lamnatRuta();
    await k.ga(1_000);
    s.andrat();
    await s.spolaNu();
    assert.deepEqual(anrop, [0, 1_000]);
    assert.equal(s.osparat, false);
  });

  it("ett nätverksfel visar felraden och försöker igen tills det lyckas", async () => {
    const k = klocka();
    let natet = false;
    const { s, anrop } = sparare(k, {
      svara: () => (natet ? Promise.resolve() : Promise.reject(Object.assign(new Error("offline"), { code: "unavailable" }))),
    });
    s.andrat();
    await k.ga(4_000);
    assert.equal(s.status.lage, "fel", "felraden");
    await k.ga(5_000);
    assert.equal(anrop.length, 2, "nytt försök efter 5 s");
    await k.ga(10_000);
    assert.equal(anrop.length, 3, "efter 10 s till");
    natet = true;
    await k.ga(20_000);
    assert.equal(anrop.length, 4);
    assert.equal(s.status.lage, "sparat", "felraden borta");
    assert.equal(s.osparat, false);
  });

  it("en sparning som hänger (offline) visar felraden efter 8 s och rättar sig när den går igenom", async () => {
    const k = klocka();
    let klar;
    const { s } = sparare(k, { svara: () => new Promise((r) => (klar = r)) });
    s.andrat();
    await k.ga(4_000);
    assert.equal(s.status.lage, "sparar");
    await k.ga(8_000);
    assert.equal(s.status.lage, "fel");
    klar();
    await k.ga(0);
    assert.equal(s.status.lage, "sparat");
  });

  it("ändringar under en pågående sparning sparas efteråt (inget tappas)", async () => {
    const k = klocka();
    let klar;
    const { s, anrop } = sparare(k, { svara: () => new Promise((r) => (klar = r)) });
    s.andrat();
    await k.ga(4_000);
    s.andrat();
    klar();
    await k.ga(0);
    assert.equal(s.osparat, true);
    await k.ga(24_000);
    assert.equal(anrop.length, 2);
    klar();
    await k.ga(0);
    assert.equal(s.osparat, false);
  });

  it("nekad av reglerna (stängt / tiden ute) = slutgiltigt, inga fler försök", async () => {
    const k = klocka();
    const nekad = Object.assign(new Error("nej"), { code: "permission-denied" });
    const { s, anrop, slut } = sparare(k, { svara: () => Promise.reject(nekad) });
    s.andrat();
    await k.ga(4_000);
    assert.equal(slut(), nekad);
    s.andrat();
    await k.ga(120_000);
    assert.equal(anrop.length, 1);
    assert.ok(arSlutgiltigtFel({ code: "permission-denied" }));
    assert.ok(!arSlutgiltigtFel({ code: "unavailable" }));
  });

  it("stoppa(): inget sparas efter inlämningen", async () => {
    const k = klocka();
    const { s, anrop } = sparare(k);
    s.andrat();
    s.stoppa();
    await k.ga(60_000);
    assert.equal(anrop.length, 0);
  });
});

describe("omladdning mitt i provet återställer alla svar", () => {
  const prov = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
  const { fragor } = delaUppProv(prov);

  it("localStorage som är nyare än serverns sparning vinner – alla frågetyper", () => {
    const svar = { ...tomtSvar(fragor), q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", ""], q6: ["Åska", "", ""], q7: ["Bronsåldern", "Stenåldern", "Järnåldern", "Vikingatiden"], q8: "Ett långt svar" };
    const server = { svar: { q1: 0 }, uppdaterad: { toMillis: () => 1_000 } };
    // Det provsidan sparar i localStorage vid varje ändring – via JSON, som på riktigt.
    const lokal = JSON.parse(JSON.stringify({ svar, at: 1_500 }));
    const r = valjStartSvar(server, lokal);
    assert.deepEqual(r.svar, svar);
    assert.equal(r.franLokal, true, "de osparade ändringarna sparas direkt");
  });
  it("en äldre lokal kopia (annan dator) slängs; ingen lokal kopia = serverns", () => {
    const server = { svar: { q4: "Birka" }, uppdaterad: { toMillis: () => 9_000 } };
    assert.deepEqual(valjStartSvar(server, { svar: { q4: "Bir" }, at: 8_000 }), { svar: { q4: "Birka" }, franLokal: false });
    assert.deepEqual(valjStartSvar(server, null), { svar: { q4: "Birka" }, franLokal: false });
    assert.deepEqual(valjStartSvar(null, null), { svar: {}, franLokal: false });
    assert.deepEqual(valjStartSvar(server, { svar: { q4: "Birka" }, at: 9_500 }), { svar: { q4: "Birka" }, franLokal: false }, "lika = inget att spara");
  });
  it("nyckeln är per tillfälle och elev", () => {
    assert.equal(lokalNyckel("tf1", "elev1"), "pp:prov:tf1:elev1");
  });
});

describe("tidsgränsen (§5.5)", () => {
  it("räknas från startad med serverns tid", () => {
    assert.equal(slutTid({ toMillis: () => 1_000 }, 40), 1_000 + 40 * 60_000);
    assert.equal(slutTid(1_000, null), null, "ingen tidsgräns");
    assert.equal(slutTid(null, 40), null, "inte startat");
    assert.equal(tillMs({ seconds: 2, nanoseconds: 5e8 }), 2_500);
  });
  it("nedräkningen: '23 min kvar', gul vid 5 min, röd vid 1 min", () => {
    assert.equal(kvarText(23 * 60_000), "23 min kvar");
    assert.equal(kvarText(22 * 60_000 + 1), "23 min kvar", "avrundat uppåt");
    assert.equal(kvarText(45_000), "45 s kvar");
    assert.equal(kvarText(0), "Tiden är slut");
    assert.equal(kvarNiva(5 * 60_000 + 1), "");
    assert.equal(kvarNiva(5 * 60_000), "gul");
    assert.equal(kvarNiva(60_000 + 1), "gul");
    assert.equal(kvarNiva(60_000), "rod");
  });
  it("elevens läge: ny, pågår, tiden slut, inlämnat, stängt", () => {
    const tf = { status: "oppet", tidsgransMin: 10 };
    assert.equal(elevLage(tf, null, 0), "ny");
    assert.equal(elevLage(tf, { startad: 0, inlamnad: false }, 9 * 60_000), "pagar");
    assert.equal(elevLage(tf, { startad: 0, inlamnad: false }, 10 * 60_000), "tiden-slut");
    assert.equal(elevLage(tf, { startad: 0, inlamnad: true, inlamnadNar: "tid" }, 0), "inlamnat");
    assert.equal(elevLage({ ...tf, status: "stangt" }, { startad: 0, inlamnad: false }, 0), "stangt");
    assert.equal(elevLage({ ...tf, status: "stangt" }, { startad: 0, inlamnad: true, inlamnadNar: "stangt" }, 0), "inlamnat");
    assert.equal(elevLage({ status: "oppet", tidsgransMin: null }, { startad: 0, inlamnad: false }, 1e12), "pagar", "utan gräns");
  });
});

describe("stängt prov (§5.4)", () => {
  it("att stänga markerar alla som inte lämnat in – och bara stängningens markering tas tillbaka", () => {
    const svar = [
      { id: "a", inlamnad: false },
      { id: "b", inlamnad: true, inlamnadNar: "elev" },
      { id: "c", inlamnad: false },
      { id: "d", inlamnad: true, inlamnadNar: "tid" },
    ];
    assert.deepEqual(attStangaIn(svar), ["a", "c"]);
    const efter = svar.map((d) => (["a", "c"].includes(d.id) ? { ...d, inlamnad: true, inlamnadNar: "stangt" } : d));
    assert.deepEqual(attStangaIn(efter), []);
    assert.deepEqual(attOppnaIgen(efter), ["a", "c"], "elevens egen inlämning är slutgiltig");
  });
  it("provets eget fokuslås känns igen (stäng tar bort just det)", () => {
    assert.ok(arProvetsLas({ mal: { typ: "prov", id: "tf1" } }, "tf1"));
    assert.ok(!arProvetsLas({ mal: { typ: "prov", id: "tf2" } }, "tf1"));
    assert.ok(!arProvetsLas({ mal: { typ: "lasresan" } }, "tf1"));
    assert.ok(!arProvetsLas(null, "tf1"));
  });
});

describe("lärarens översikt (§5.3) och Kör i klass (§5.2)", () => {
  const tf = {
    tidsgransMin: 40,
    fragor: [
      { id: "t1", typ: "text", titel: "x", brodtext: "y" },
      { id: "q1", typ: "flerval", fraga: "?", poang: 1, alternativ: ["a", "b"] },
      { id: "q4", typ: "kortsvar", fraga: "?", poang: 1 },
    ],
  };
  const elever = [{ id: "a", namn: "Alva" }, { id: "b", namn: "Bo" }, { id: "c", namn: "Cleo" }];

  it("status, besvarade frågor och tid kvar per elev", () => {
    const rader = oversiktRader(elever, {
      b: { startad: 0, inlamnad: false, svar: { q1: 1, q4: "" } },
      c: { startad: 0, inlamnad: true, inlamnadNar: "tid", svar: { q1: 0, q4: "Birka" } },
    }, tf, 10 * 60_000);
    assert.deepEqual(rader.map((r) => [r.namn, r.statusText, `${r.besvarade} av ${r.antal}`]), [
      ["Alva", "Inte börjat", "0 av 2"],
      ["Bo", "Skriver", "1 av 2"],
      ["Cleo", "Inlämnat", "2 av 2"],
    ]);
    assert.equal(rader[1].kvarMs, 30 * 60_000);
    assert.equal(rader[2].inlamnadNar, "tid");
    assert.deepEqual(oversiktSumma(rader), { ej: 1, skriver: 1, inlamnat: 1, antal: 3 });
  });
  it("fokuslåset: tidsgränsen + 10 min, annars 60 min", () => {
    assert.equal(standardLasMinuter(40), 50);
    assert.equal(standardLasMinuter(null), 60);
  });
  it("fokuslåset räcker för den med mest extra tid (#749 F1); ogiltig extra tid räknas inte", () => {
    assert.equal(standardLasMinuter(40, {}), 50);
    assert.equal(standardLasMinuter(40, { a: 15, b: 30 }), 80);
    assert.equal(standardLasMinuter(40, { a: "60", b: -5, c: 999 }), 50);
    assert.equal(standardLasMinuter(null, { a: 30 }), 60);
  });
  it("menylänken: öppet prov, eller tillbakalämnat de senaste 14 dagarna", () => {
    const DAG = 86_400_000;
    const nu = 100 * DAG;
    assert.equal(provSynligt({ oppna: [{ id: "x" }] }, nu), true);
    assert.equal(provSynligt({ tillbaka: [{ aterlamnadAt: { toMillis: () => nu - 13 * DAG } }] }, nu), true);
    assert.equal(provSynligt({ tillbaka: [{ aterlamnadAt: { toMillis: () => nu - 15 * DAG } }] }, nu), false);
    assert.equal(provSynligt({}, nu), false);
  });
});

describe("budgeten (§9.1): 25 elever, 12 frågor, 40 minuter", () => {
  it("skrivningar ≤ 3 000 även när alla skriver hela tiden", () => {
    const perElev = Math.floor((40 * 60_000) / SPARNING.mellanrumMs) + 1 /* start */ + 1 /* inlämning */;
    const oppnaStang = 2 /* tillfälle + facit */ + 1 /* lås */ + 1 /* stäng */ + 1 /* lås av */ + 25 /* stäng-markeringar */;
    const totalt = 25 * perElev + oppnaStang;
    assert.ok(totalt <= 3_000, `${totalt} skrivningar`);
  });
  it("läsningar ≤ 3 000: elevernas lyssnare + lärarens översikt var 60:e s", () => {
    const elev = 25 * (1 /* lyssnaren */ + 1 /* tillbakalämnade (tomt = 1) */ + 1 /* eget svar */ + 1 /* startad */ + 2 /* stäng/öppna-ändringar */);
    const larare = 25 /* namn */ + 40 * 25 /* svaren var 60:e s */ + 1 /* tillfället */ + 25 /* stäng läser svaren */;
    assert.ok(elev + larare <= 3_000, `${elev + larare} läsningar`);
  });
});

describe("kopplingen in i appen (bootgrafen #271, §5.5)", async () => {
  const { readFileSync } = await import("node:fs");
  const las = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  it("menylänken: NAV_VILLKOR.prov laddar bevakaren med import()", () => {
    const ui = las("ui.js");
    assert.match(ui, /prov: getProvVisible/);
    assert.match(ui, /import\("\.\/prov\/prov-watch\.js"\)/);
    assert.doesNotMatch(ui, /^import .*\/prov\//m);
  });
  it("rutterna laddar provsidorna med import()", () => {
    const app = las("app.js");
    for (const r of ["/elev/prov", "/elev/prov/skriv", "/elev/prov/resultat", "/larare/prov/tillfalle"]) assert.ok(app.includes(`"${r}":`), r);
    assert.match(app, /import\("\.\/prov\/prov-elev-sida\.js"\)/);
    assert.doesNotMatch(app, /^import .*\/prov\//m);
  });
  it("modulraden: Prov överst i Öva, inte av/på-bar, låses till ett tillfälle", async () => {
    const { STUDENT_MODULES, TOGGLABLE_MODULES } = await import("../src/gamemode-visibility.js");
    const ova = STUDENT_MODULES.filter((m) => m.grupp === "ova");
    assert.equal(ova[0].id, "prov");
    assert.equal(ova[0].villkor, "prov");
    assert.ok(!TOGGLABLE_MODULES.some((m) => m.id === "prov"));
  });
});
