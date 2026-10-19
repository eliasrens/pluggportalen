// ============================================================================
// #804 (epic #802 §3.1–3.3) – Mina klasser utan webbläsare:
//   * klassväljaren: ?klass= (id eller namn) → sparad klass → första; > 8
//     klasser = sökbar rullgardin; sökningen
//   * flikarna och vad de visar för årskurslärare resp. admin – årskurs ser
//     aldrig en admin-sektion (elevkonton/mynt, Klasscentret)
//   * vald klass + statistikens underflik kommer ihåg: adressen (?klass=&flik=
//     &del=), gamla ?sektion= och lastStatsTab i localStorage (omladdning)
//   * avstängda moduler: modulAv + varje av/på-bar modul med statistik har
//     sin underflik markerad (modul:)
//   * gamla adresser → Mina klasser; nya filer laddas bara dynamiskt (#271)
//   * hela områdesnamn och mobil (inga ellipser, inget som skjuter ut sidan)
// Webbläsartestet (sidbyte, omladdning, 320/375 px): admin/qa-mina-klasser-e2e.mjs.
// Körs med: node --test
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";
import {
  MANGA_KLASSER, MINA_BASE, MINA_FLIKAR, SEKTION_TILL_FLIK, filtreraKlasser, flikSektioner, hittaKlass, minaHash, startVal,
} from "../src/teacher-mina-val.js";
import { PLACERING } from "../src/teacher-struktur.js";

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const KLASSER = [{ id: "4a", name: "4A" }, { id: "4b", name: "4B" }, { id: "5e", name: "5E" }];
const q = (s) => new URLSearchParams(s);

let shared, sections, statsAv, stats;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
  sections = await import("../src/teacher-classes-sections.js");
  statsAv = await import("../src/teacher-stats-av.js");
  stats = (await import("../src/teacher-class.js")).STATS_TABS;
});

describe("klassväljaren (§3.1)", () => {
  it("?klass= tar id eller namn (4B), annars sparad klass, annars första", () => {
    assert.equal(startVal(KLASSER, { query: q("klass=4b") }).id, "4b");
    assert.equal(startVal(KLASSER, { query: q("klass=4B") }).id, "4b");
    assert.equal(startVal(KLASSER, { query: q("klass=finns-inte"), saved: "5e" }).id, "5e");
    assert.equal(startVal(KLASSER, { saved: "borttagen" }).id, "4a");
    assert.equal(startVal([], {}).id, null);
    assert.equal(hittaKlass(KLASSER, " 5e "), KLASSER[2]);
  });
  it("fler än 8 klasser → sökbar rullgardin; sökningen hittar på namn och id", () => {
    assert.equal(MANGA_KLASSER, 8);
    const src2 = src("teacher-mina-klasser.js");
    assert.match(src2, /klasser\.length > MANGA_KLASSER/);
    assert.match(src2, /type="search" class="mk-sok-falt"/);
    assert.deepEqual(filtreraKlasser(KLASSER, "4").map((k) => k.id), ["4a", "4b"]);
    assert.deepEqual(filtreraKlasser(KLASSER, "b").map((k) => k.id), ["4b"]);
    assert.equal(filtreraKlasser(KLASSER, "").length, 3);
  });
});

describe("flikarna (§3.1)", () => {
  it("fyra flikar med undertext, i specens ordning", () => {
    assert.deepEqual(MINA_FLIKAR.map((f) => [f.label, f.sub]), [
      ["Hur går det?", "Statistik"], ["Vad eleverna ser", "Områden och moduler"],
      ["Fokusläge", "Lås till en sak"], ["Elever", "Inloggning och konton"],
    ]);
  });
  it("varje sektion finns i CLASS_SECTIONS; årskurslärare ser aldrig en admin-sektion", () => {
    const finns = new Set(sections.CLASS_SECTIONS.map((s) => s.key));
    for (const f of MINA_FLIKAR) {
      for (const admin of [false, true]) for (const k of flikSektioner(f, admin)) assert.ok(finns.has(k), `${f.key}: ${k}`);
      for (const k of flikSektioner(f, false)) assert.equal(PLACERING.sektioner[k].roll, "alla", `årskurs ser ${k} under ${f.label}`);
    }
    assert.deepEqual(flikSektioner(MINA_FLIKAR[3], false), ["inloggning"]);
    assert.deepEqual(flikSektioner(MINA_FLIKAR[3], true), ["elever", "klasscenter"]);
    assert.deepEqual(flikSektioner(MINA_FLIKAR[1], false), ["omraden", "synlighet", "lagen"]);
  });
  it("sidläget Mina klasser = årskurssektionerna; admin-sektionerna bara via admin (rollen bestämmer)", () => {
    const { mina, minaAdmin } = sections.CLASS_PAGE_MODES;
    assert.equal(mina.tab, "klasser");
    assert.equal(mina.manage, false);
    assert.deepEqual([...mina.sections].sort(), MINA_FLIKAR.flatMap((f) => f.sections).sort());
    // #805: admin-sektionerna ligger i samma flik (Elever), bara för admin.
    assert.deepEqual(minaAdmin, { tab: "klasser", base: mina.base, sections: ["elever", "klasscenter"], manage: false, admin: true });
    // Rollen kommer ur myRole() (servern/reglerna spärrar ändå, #678) – inte ur adressen.
    assert.match(src("teacher-mina-klasser.js"), /admin: !!role\.admin/);
    assert.match(src("teacher-mina-klasser.js"), /flikSektioner\(flik, sida\.admin\)/);
  });
  it("Döp om / Ta bort klassen / Skapa klass finns inte i Mina klasser (bara Admin)", () => {
    const s = src("teacher-mina-klasser.js") + src("teacher-mina-ser.js");
    assert.doesNotMatch(s, /data-act="(rename|del)"|showCreate|renderCreateClass|deleteClass|upsertClass/);
  });
});

describe("kommer ihåg klass och underflik (sidbyte + omladdning)", () => {
  it("adressen speglar klass, flik och – under Hur går det? – underfliken", () => {
    assert.equal(minaHash("4b", "hur", "lasresan"), `${MINA_BASE}?klass=4b&flik=hur&del=lasresan`);
    assert.equal(minaHash("4b", "ser", "lasresan"), `${MINA_BASE}?klass=4b&flik=ser`);
    assert.equal(minaHash(null, "hur"), MINA_BASE);
  });
  it("omladdning: adressen ger samma klass/flik/underflik tillbaka", () => {
    const hash = minaHash("5e", "hur", "schack");
    assert.deepEqual(startVal(KLASSER, { query: q(hash.split("?")[1]) }), { id: "5e", flik: "hur", del: "schack" });
  });
  it("sidbyte (toppmenyn utan parametrar): sparad klass + senaste underflik, fliken Hur går det?", () => {
    assert.deepEqual(startVal(KLASSER, { saved: "4b", statsSaved: "ekvationsresan" }), { id: "4b", flik: "hur", del: "ekvationsresan" });
  });
  it("gamla ?sektion= väljer fliken (och schack → Hur går det? → Schack)", () => {
    assert.equal(startVal(KLASSER, { query: q("flik=ser&sektion=fokus") }).flik, "fokus");
    assert.deepEqual(startVal(KLASSER, { query: q("flik=ser&sektion=schack") }), { id: "4a", flik: "hur", del: "schack" });
    assert.equal(startVal(KLASSER, { query: q("sektion=inloggning") }).flik, "elever");
    assert.equal(startVal(KLASSER, { query: q("flik=okand") }).flik, "hur");
    for (const k of sections.CLASS_SECTIONS.map((s) => s.key)) assert.ok(SEKTION_TILL_FLIK[k], `?sektion=${k}`);
  });
  it("lastStatsTab sparas i localStorage och läses tillbaka (omladdning); utan lagring minns modulen", () => {
    const lager = new Map();
    globalThis.localStorage = { getItem: (k) => lager.get(k) ?? null, setItem: (k, v) => lager.set(k, String(v)), removeItem: (k) => lager.delete(k) };
    statsAv.sparaStatsTab("brakresan");
    assert.equal(lager.get(statsAv.STATS_TAB_KEY), "brakresan");
    assert.equal(statsAv.lastStatsTab(), "brakresan");
    globalThis.localStorage = { getItem: () => { throw new Error("blockerad"); }, setItem: () => { throw new Error("blockerad"); } };
    statsAv.sparaStatsTab("live");
    assert.equal(statsAv.lastStatsTab(), "live");
    delete globalThis.localStorage;
  });
  it("vald klass sparas i localStorage (delas med Admin → Klasser)", () => {
    const s = src("teacher-classes-store.js");
    assert.match(s, /localStorage\.setItem\(SELECTED_KEY, id\)/);
    assert.match(src("teacher-mina-klasser.js"), /saveClass\(store\.selectedId\)/);
    assert.match(src("teacher-mina-klasser.js"), /history\.replaceState\(history\.state, "", hash\)/);
  });
});

describe("avstängda moduler (§3.2)", () => {
  it("modulAv: dold modul är av; opt-in är av tills den slagits på (och inte dold)", () => {
    const { modulAv } = statsAv;
    assert.equal(modulAv({}, "lasresan"), false);
    assert.equal(modulAv({ hiddenModules: ["lasresan"] }, "lasresan"), true);
    assert.equal(modulAv({}, "ekvationsresan"), true);
    assert.equal(modulAv({ enabledModules: ["ekvationsresan"] }, "ekvationsresan"), false);
    assert.equal(modulAv({ enabledModules: ["schack"], hiddenModules: ["schack"] }, "schack"), true);
    assert.equal(modulAv({ hiddenModules: ["brakresan"] }, "brakresan"), true);
    assert.equal(modulAv({ hiddenModules: ["prov"] }, "prov"), false, "prov är inte av/på-bar");
  });
  it("underflikarna bär sin modul; Schack är en underflik", () => {
    const modul = Object.fromEntries(stats.map((t) => [t.key, t.modul || null]));
    assert.deepEqual(modul, {
      amnen: "plugga", omraden: "plugga", lasresan: "lasresan", ekvationsresan: "ekvationsresan", prov: null,
      brakresan: "brakresan", mattematchen: null, live: null, schack: "schack",
    });
  });
  it("nedtonad '· av' + texten med länk till Vad eleverna ser; statistiken står kvar under", () => {
    const tc = src("teacher-class.js");
    assert.match(tc, /stats-tab\$\{av\(t\) \? " av" : ""\}/);
    assert.match(tc, /· av/);
    assert.match(tc, /av\(tab\) \? avNotis\(ctx, pane, tab, opts\) : pane/);
    const a = src("teacher-stats-av.js");
    assert.match(a, /är avstängd för \$\{esc\(klass\)\}\.<\/b> Eleverna ser den inte\. Slå på den under/);
    assert.match(a, /flik: "ser"/);
    assert.match(a, /opts\.visaSer\(\)/);
  });
  it("schackets inaktuella 'Inga pluggmynt' är borta (#798)", () => {
    const m = readFileSync(new URL("../src/schack/larare/schack-larare-markup.js", import.meta.url), "utf8");
    assert.doesNotMatch(m, /Inga pluggmynt/);
    assert.match(m, /Samma val finns under Vad eleverna ser/);
  });
});

describe("Vad eleverna ser (§3.3)", () => {
  const s = () => src("teacher-mina-ser.js");
  it("tre numrerade steg med specens rubriker och hjälptexter; steg 3 ihopfällt", () => {
    assert.match(s(), /"Vilka områden jobbar ni med nu\?"/);
    assert.match(s(), /Kryssar du inte i några områden ser eleverna alla\./);
    assert.match(s(), /"Vilka delar ska finnas i elevernas meny\?"/);
    assert.match(s(), /Det du slår på här får sin statistik och sina inställningar under <b>Hur går det\?<\/b>/);
    assert.match(s(), /"Avancerat: dölj vissa övningslägen i ett område", ihop: true/);
    assert.match(s(), /<details class="mk-steg mk-steg-ihop"/);
    assert.doesNotMatch(s(), /<details[^>]* open/);
  });
  it("Sparat ✓ per steg ur sektionens egen bekräftelse – bara när ingen sparegrupp har osparat (F1)", () => {
    assert.match(s(), /\["ok", "Sparat ✓"\]/);
    assert.match(s(), /osparade\.size \? \["andrat", "Inte sparat än"\]/);
    assert.match(s(), /osparade\.delete\(grupp\(ok\)\)/);
    assert.match(s(), /osparade\.add\(grupp\(n\)\)/);
  });
  it("Hjälp-länken Fokusläge går till fliken Fokusläge (F3; resten av Hjälp görs i #808)", () => {
    assert.match(src("teacher-hjalp.js"), /"Fokusläge", hash: "#\/larare\/mina-klasser\?flik=fokus"/);
  });
  it("admin: Elever har allt Inloggning har – samma tabell, admin får bara FLER val (#805)", () => {
    const sek = src("teacher-classes-sections.js");
    // Båda sektionerna är den kompakta elevtabellen; skillnaden är bara admin-flaggan.
    assert.match(sek, /render: elevSection\(false\)/);
    assert.match(sek, /render: elevSection\(true\)/);
    assert.match(sek, /admin: admin && isAdmin\(\)/);
    const tabell = src("teacher-elever-tabell.js");
    assert.match(tabell, /et-skriv-ut/);
    assert.match(tabell, /openLoginEditor\(s, \{\s*passwordOnly: !admin/);
  });
  it("hela områdesnamn: ingen ellips i stegen, bredare rutor", () => {
    const css = readFileSync(new URL("../src/styles/43-larare-mina-klasser.css", import.meta.url), "utf8");
    const regel = css.match(/\.teacher-dark \.mk-ser \.member-name \{([^}]*)\}/)[1];
    assert.match(regel, /white-space: normal/);
    assert.match(regel, /text-overflow: clip/);
    assert.match(css, /\.mk-ser \.member-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(min\(240px, 100%\), 1fr\)\)/);
  });
});

describe("mobil (320–375 px)", () => {
  const css = () => readFileSync(new URL("../src/styles/43-larare-mina-klasser.css", import.meta.url), "utf8");
  it("klassknapparna och statistikens underflikar radbryts; flikarna blir 2 × 2", () => {
    assert.match(css(), /\.teacher-dark \.mk-klassval \{[^}]*flex-wrap: wrap/);
    assert.match(css(), /\.teacher-dark\.mk-page \.stats-tabs \{ display: flex; flex-wrap: wrap/);
    assert.match(css(), /@media \(max-width: 760px\)[\s\S]*\.mk-flikar \{ display: grid; grid-template-columns: 1fr 1fr/);
  });
  it("styles.css är byggd av delarna", () => {
    const alla = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    assert.ok(alla.includes(".teacher-dark .mk-klassknapp"));
  });
});

describe("adresser och laddning", () => {
  const mal = (hash) => {
    const [p, qs] = hash.slice(1).split("?");
    return shared.teacherRedirect(p, qs) || hash;
  };
  it("Mina klasser är EN toppflik; gamla Klasser/Statistik leder till rätt flik med klassen", () => {
    const flikar = shared.navGroups(false).find((g) => g.key === "klasser").tabs;
    assert.deepEqual(flikar.map((t) => t.hash), [MINA_BASE]);
    assert.equal(mal("#/larare/klasser"), `${MINA_BASE}?flik=ser`);
    assert.equal(mal("#/larare/statistik?klass=4b"), `${MINA_BASE}?flik=hur&klass=4b`);
    assert.equal(mal("#/larare/klasser?klass=4b&sektion=fokus"), `${MINA_BASE}?flik=ser&klass=4b&sektion=fokus`);
    assert.equal(shared.teacherRedirect("/larare/mina-klasser", "klass=4b"), null);
  });
  it("nya filer laddas bara med import() – aldrig statiskt i bootgrafen (#271)", () => {
    for (const f of ["teacher-shared.js", "app.js", "teacher-classes.js"]) {
      assert.doesNotMatch(src(f), /^import .*teacher-(mina-|stats-av)/m, f);
    }
    assert.match(src("teacher-classes.js"), /import\("\.\/teacher-mina-klasser\.js"\)/);
    assert.match(src("teacher-mina-klasser.js"), /import\("\.\/teacher-mina-ser\.js"\)/);
  });
  it("inga nya läsningar: klasser + elever en gång, inga per-elev-anrop i de nya filerna", () => {
    const s = src("teacher-mina-klasser.js");
    assert.equal((s.match(/data\.\w+\(/g) || []).sort().join(","), "data.getClasses(,data.getStudents(");
    for (const f of ["teacher-mina-ser.js", "teacher-mina-val.js", "teacher-stats-av.js"]) assert.doesNotMatch(src(f), /data\.|getDoc|onSnapshot/, f);
  });
  it("filerna håller 400-radersgränsen", () => {
    for (const f of ["teacher-mina-klasser.js", "teacher-mina-ser.js", "teacher-mina-val.js", "teacher-stats-av.js", "teacher-class.js", "teacher-shared.js", "teacher-classes-sections.js"]) {
      assert.ok(src(f).split("\n").length <= 400, f);
    }
  });
});
