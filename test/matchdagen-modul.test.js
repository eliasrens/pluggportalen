// ============================================================================
// Tester: Matchdagen 1a (#867) – moduler per elev (elevModuler, perElev) och
// lärarens inställningar per elev (matchdagenInst, src/matchdagen/md-inst.js).
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §1 och §15 "Modulen per elev":
//   • syns bara för valda elever, aldrig för klasskamrater
//   • kan också slås på för hela klassen (enabledModules, #876 – se matchdagen-klass.test.js)
//   • fokusläget spärrar den
//   • lärarens inställningar sparas och läses (formen; regler: emulatortestet)
//   • bootgrafen oförändrad (107) – allt nytt i src/matchdagen/ via import()
// Ren node, ingen emulator: node --test test/matchdagen-modul.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STUDENT_MODULES, TOGGLABLE_MODULES, PER_ELEV_MODULES, OPT_IN_MODULES, MATCHDAGEN_IKON, ELEV_MODULER_MAX,
  moduleForRoute, modulesHiddenForStudent, normalizeElevModuler, normalizeEnabledModules, normalizeHiddenModules,
} from "../src/gamemode-visibility.js";
import { lockAllowsRoute } from "../src/class-lock.js";
import {
  STANDARD_INST, normalizeInst, harKallor, kallNycklar, harMatchdagen, nyaElevModuler, sammanfattning, fragorText, INGA_FRAGOR,
} from "../src/matchdagen/md-inst.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const MD = "matchdagen";

describe("registret: Matchdagen är en per-elev- och klassmodul", () => {
  const m = STUDENT_MODULES.find((x) => x.id === MD);
  it("perElev + optIn + learning, gruppen Öva, egen route, inget låsmål", () => {
    assert.ok(m, "matchdagen saknas i STUDENT_MODULES");
    assert.equal(m.label, "Matchdagen");
    assert.equal(m.perElev, true);
    assert.equal(m.optIn, true);
    assert.equal(m.learning, true);
    assert.equal(m.grupp, "ova");
    assert.equal(m.lockable, false);
    assert.deepEqual(m.routes, ["/elev/matchdagen"]);
    assert.equal(moduleForRoute("/elev/matchdagen"), MD, "routern grindar den");
  });
  it("ikonen är en SVG-fotboll, ingen emoji", () => {
    assert.equal(m.ikon, MATCHDAGEN_IKON);
    assert.match(m.ikon, /^<svg [^>]*aria-hidden="true"/);
    assert.match(m.ikon, /<circle /);
    assert.doesNotMatch(m.ikon, /\p{Extended_Pictographic}/u);
  });
  it("kan slås på för hela klassen (#876) och för enskilda elever", () => {
    assert.ok(TOGGLABLE_MODULES.includes(m), "i lärarens klassvisa modullista (Vad eleverna ser)");
    assert.deepEqual(PER_ELEV_MODULES.map((x) => x.id), [MD]);
    assert.deepEqual(normalizeEnabledModules(["hittaratt", MD, "schack"]), ["hittaratt", MD, "schack"]);
    assert.deepEqual(normalizeHiddenModules([MD, "plugga"]), [MD, "plugga"]);
  });
  it("räknas som opt-in (dold när klasslistan inte går att läsa)", () => {
    assert.deepEqual(OPT_IN_MODULES, ["hittaratt", "ekvationsresan", "schack", MD]);
  });
});

describe("normalizeElevModuler", () => {
  it("bara kända per-elev-moduler, inga tomma listor, tål skräp", () => {
    assert.deepEqual(normalizeElevModuler({ a: [MD, MD, " matchdagen "], b: ["schack"], c: [], d: "matchdagen" }), { a: [MD] });
    for (const skrap of [null, undefined, "x", [], 7]) assert.deepEqual(normalizeElevModuler(skrap), {});
  });
  it("med studentIds: bara klassens elever; högst 100 elever", () => {
    assert.deepEqual(normalizeElevModuler({ a: [MD], ut: [MD] }, ["a", "b"]), { a: [MD] });
    const stor = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`e${i}`, [MD]]));
    assert.equal(Object.keys(normalizeElevModuler(stor)).length, ELEV_MODULER_MAX);
  });
});

describe("synligheten: bara för valda elever, aldrig för klasskamrater", () => {
  const klasser = () => [
    { id: "4a", studentIds: ["alva", "bo", "cia"], elevModuler: { alva: [MD] } },
    { id: "4b", studentIds: ["dan", "cia"], elevModuler: {} },
    // En annan klass som (felaktigt) listar bo – bo går inte i den klassen.
    { id: "5c", studentIds: ["eva"], elevModuler: { bo: [MD], eva: [MD] } },
  ];
  const dold = (uid, k = klasser()) => modulesHiddenForStudent(k, uid).includes(MD);
  it("vald elev ser den, klasskamraterna inte", () => {
    assert.equal(dold("alva"), false);
    assert.equal(dold("bo"), true, "klasskamrat i samma klass");
    assert.equal(dold("dan"), true, "elev i en annan klass");
    assert.equal(dold("eva"), false, "vald i sin egen klass");
  });
  it("en lista i en klass eleven inte går i räknas inte", () => {
    assert.equal(dold("bo"), true);
  });
  it("elev i två klasser: vald i den ena räcker", () => {
    assert.equal(dold("cia"), true);
    const k = klasser();
    k[1].elevModuler = { cia: [MD] };
    assert.equal(dold("cia", k), false);
  });
  it("enabledModules med matchdagen slår på den för hela klassen (#876)", () => {
    const k = klasser();
    k[0].enabledModules = [MD, "schack"];
    assert.equal(dold("bo", k), false);
    assert.equal(dold("dan", k), true, "en annan klass påverkas inte");
    assert.equal(modulesHiddenForStudent(k, "bo").includes("schack"), false, "schack (klassvis opt-in) fungerar som förut");
  });
  it("ingen elev / ingen klass / trasig data → dold", () => {
    assert.equal(dold(null), true);
    assert.equal(dold("okand"), true);
    assert.equal(modulesHiddenForStudent(null, "alva").includes(MD), true);
    assert.equal(dold("alva", [{ id: "4a", studentIds: ["alva"], elevModuler: { alva: "matchdagen" } }]), true);
  });
  it("andra moduler påverkas inte av elevModuler", () => {
    const utan = modulesHiddenForStudent([{ id: "x", studentIds: ["a"] }], "a").filter((id) => id !== MD);
    const med = modulesHiddenForStudent([{ id: "x", studentIds: ["a"], elevModuler: { a: [MD] } }], "a");
    assert.deepEqual(med.sort(), utan.sort());
  });
});

describe("fokusläget spärrar Matchdagen", () => {
  const NU = Date.now();
  const lock = (over = {}) => ({ mal: { typ: "omrade", id: "so/vikingatiden" }, till: NU + 1_800_000, doljOvrigt: false, ...over });
  it("låst till ett område eller en annan modul → stängd (även utan Dölj allt annat)", () => {
    assert.equal(lockAllowsRoute(lock(), "/elev/matchdagen"), false);
    assert.equal(lockAllowsRoute(lock({ mal: { typ: "lasresan" } }), "/elev/matchdagen"), false);
    assert.equal(lockAllowsRoute(lock(), "/elev/shop"), true, "kontroll: en icke-inlärningsmodul är öppen");
  });
  it("efter provet med \"Välj själv\": bara om läraren valt Matchdagen", () => {
    const fri = (moduler) => ({ ...lock({ mal: { typ: "prov", id: "t1" } }), fri: "egna", moduler });
    assert.equal(lockAllowsRoute(fri(["plugga"]), "/elev/matchdagen"), false);
    assert.equal(lockAllowsRoute(fri(["plugga", MD]), "/elev/matchdagen"), true);
  });
});

describe("lärarens inställningar (md-inst.js)", () => {
  it("standard: inga källor, flerval, klocka av, lugnt av, paus 60", () => {
    assert.deepEqual(normalizeInst(null), { ...STANDARD_INST });
    assert.deepEqual(STANDARD_INST, { omraden: [], tabeller: [], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60 });
  });
  it("ogiltiga värden faller tillbaka; listorna rensas", () => {
    const i = normalizeInst({
      omraden: ["so/vikingatiden", "so/vikingatiden", "trasig", " ma/brak ", 7], tabeller: [7, 3, 11, "5", 3, 0],
      rakna: ["ma/klockan"], svarssatt: "gissa", klocka: 45, lugnt: "ja", paus: 90,
    });
    assert.deepEqual(i, { omraden: ["so/vikingatiden", "ma/brak"], tabeller: [0, 3, 7], rakna: ["ma/klockan"],
      svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60 });
    assert.equal(normalizeInst({ omraden: Array.from({ length: 80 }, (_, n) => `s/a${n}`) }).omraden.length, 60);
  });
  it("sparas och läses tillbaka oförändrat (rundresa)", () => {
    const val = { omraden: ["so/vikingatiden"], tabeller: [3, 7], rakna: [], svarssatt: "skriv", klocka: 30, lugnt: true, paus: 45 };
    assert.deepEqual(normalizeInst(normalizeInst(val)), val);
  });
  it("frågekällor: inga valda → meddelandet om saknade frågor", () => {
    assert.equal(harKallor(null), false);
    assert.equal(fragorText({}), `${INGA_FRAGOR}.`);
    assert.equal(harKallor({ tabeller: [0] }), true, "tabell 0 räknas");
    assert.deepEqual(kallNycklar({ omraden: ["so/v"], tabeller: [7], rakna: ["ma/k"] }), ["omrade:so/v", "tabell:7", "rakna:ma/k"]);
    assert.equal(fragorText({ omraden: ["a/b", "c/d"], tabeller: [3, 4, 7] }),
      "Dina frågor kommer från 2 Plugga-områden samt tabellerna 3, 4 och 7.");
    assert.equal(fragorText({ tabeller: [5] }), "Dina frågor kommer från tabell 5.");
  });
  it("sammanfattningen i lärarens panel", () => {
    assert.equal(sammanfattning({ omraden: ["a/b"], tabeller: [3, 7], klocka: 30, lugnt: true }), "1 område · tabellerna 3, 7 · klocka 30 s · lugnt läge");
    assert.equal(sammanfattning(null), "inga frågor valda");
    assert.equal(sammanfattning({ tabeller: [5], paus: 30 }), "tabell 5 · paus 30 min");
    assert.equal(sammanfattning({ tabeller: [5], paus: 0 }), "tabell 5 · paus av");
  });
  it("på/av per elev: hela mapen, andra elever orörda, gamla elever rensas", () => {
    const cls = { studentIds: ["a", "b"], elevModuler: { a: [MD], gammal: [MD] } };
    assert.equal(harMatchdagen(cls, "a"), true);
    assert.equal(harMatchdagen(cls, "b"), false);
    assert.equal(harMatchdagen(cls, "gammal"), false);
    assert.deepEqual(nyaElevModuler(cls, "b", true), { a: [MD], b: [MD] });
    assert.deepEqual(nyaElevModuler(cls, "a", false), {});
    assert.deepEqual(nyaElevModuler({ studentIds: ["a"] }, "a", true), { a: [MD] });
  });
});

describe("källkod: bootgrafen, lazy-laddning och lärarpanelen", () => {
  it("bootgrafen är oförändrad (107 filer) och inget i src/matchdagen/ ligger i den", () => {
    const start = join(ROOT, "src", "app.js");
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try { src = readFileSync(file, "utf8"); } catch { continue; }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const m of src.matchAll(/\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g)) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    assert.equal(seen.size, 107);
    assert.deepEqual([...seen].filter((f) => f.includes(`${join("src", "matchdagen")}`)), []);
  });
  it("routen och lärarsektionen laddar src/matchdagen/ med import()", () => {
    assert.match(read("src/app.js"), /"\/elev\/matchdagen": dynSida\(async \(\) => \(await import\("\.\/matchdagen\/page-matchdagen\.js"\)\)/);
    assert.match(read("src/teacher-classes-sections.js"), /await import\("\.\/matchdagen\/larare\/md-anpassningar\.js"\)/);
  });
  it("panelen har alla inställningar i §1.2", () => {
    const p = read("src/matchdagen/larare/md-anpassningar-panel.js");
    for (const s of ["<b>Matchdagen</b>", "Frågekällor", "Plugga-områden", "Multiplikationstabeller", "<h4>Räkna</h4>",
      "Svarssätt", "Klocka på frågorna", "Lugnt läge", "Påminnelse om paus", "Återställ lagnamn"]) {
      assert.ok(p.includes(s), `panelen saknar ${s}`);
    }
    assert.match(p, /data-tabell/);
    for (const n of ["svarssatt", "klocka", "paus"]) assert.ok(p.includes(`radio("${n}"`), n);
  });
  it("filerna i src/matchdagen/ och testet håller 400-radersgränsen", () => {
    const filer = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? filer(`${dir}/${d.name}`) : d.name.endsWith(".js") ? [`${dir}/${d.name}`] : []));
    for (const f of [...filer("src/matchdagen"), "test/matchdagen-modul.test.js", "test/firestore-rules-matchdagen-inst.test.js"]) {
      assert.ok(read(f).split("\n").length <= 401, `${f} ≤ 400 rader`);
    }
  });
});
