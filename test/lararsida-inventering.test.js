// ============================================================================
// #803 (epic #802 §0.1) – ingen lärarfunktion får försvinna.
//   * varje flik i TEACHER_TABS, sektion i CLASS_SECTIONS och statistikflik i
//     STATS_TABS har en rad i placeringskartan (src/teacher-struktur.js) – en ny
//     flik/sektion utan rad gör testet rött
//   * rollen i kartan stämmer med registryn, och allt går att nå i den nya
//     toppmenyn för samma roller (årskurslärare: Hem, Mina klasser, Material,
//     Prov, Live; admin: samma + Admin)
//   * gamla adresser (DEL 7) hamnar rätt; ?prov= följer med till Hitta rätt!
//   * docs/LARARSIDAN_INVENTERING.md nämner varje rad
// Registry-modulerna importeras på riktigt med Firebase-SDK:t stubbat.
// Körs med: node --test
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";
import { GAMLA_ADRESSER, NYA_PLATSER, PLACERING } from "../src/teacher-struktur.js";

let shared, sections, stats;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
  sections = await import("../src/teacher-classes-sections.js");
  stats = (await import("../src/teacher-class.js")).STATS_TABS;
});

const ROLLER = { arskurs: false, admin: true };
/** Grupp → synliga flikar i toppmenyn för rollen. */
const meny = (admin) => shared.navGroups(admin);
/** Når rollen fliken (via toppmenyn eller, för Hjälp, profilmenyn)? */
function nar(tabKey, admin) {
  const t = shared.TEACHER_TABS.find((x) => x.key === tabKey);
  if (!t || (t.admin && !admin)) return false;
  if (t.group === "profil") return true; // profilmenyn finns för alla
  return meny(admin).some((g) => g.key === t.group && g.tabs.includes(t));
}
const rollAv = (admin) => (admin ? "admin" : "alla");
/** Minsta roll som når en klass-sektion: via något sidläge vars flik rollen når. */
function sektionsRoll(key) {
  const lagen = Object.values(sections.CLASS_PAGE_MODES).filter((m) => m.sections.includes(key));
  if (lagen.some((m) => nar(m.tab, false))) return "alla";
  if (lagen.some((m) => nar(m.tab, true))) return "admin";
  return null;
}

describe("toppmenyn (DEL 1.1)", () => {
  it("årskurslärare ser exakt Hem, Mina klasser, Material, Prov, Live", () => {
    assert.deepEqual(meny(ROLLER.arskurs).map((g) => g.label), ["Hem", "Mina klasser", "Material", "Prov", "Live"]);
  });
  it("admin ser samma val + Admin", () => {
    assert.deepEqual(meny(ROLLER.admin).map((g) => g.label), ["Hem", "Mina klasser", "Material", "Prov", "Live", "Admin"]);
  });
  it("Statistik är inget eget val längre, och ingen admin-flik syns för årskurslärare", () => {
    assert.ok(!shared.TEACHER_GROUPS.some((g) => g.label === "Statistik"));
    for (const g of meny(false)) for (const t of g.tabs) assert.equal(t.admin, false, `${t.key} i årskursmenyn`);
  });
  it("varje flik har en route (#/larare/…) och en känd grupp eller profilmenyn", () => {
    const grupper = new Set(shared.TEACHER_GROUPS.map((g) => g.key).concat("profil"));
    for (const t of shared.TEACHER_TABS) {
      assert.match(t.hash, /^#\/larare\//, t.key);
      assert.ok(grupper.has(t.group), `${t.key}: okänd grupp ${t.group}`);
    }
  });
});

describe("placeringskartan (§0.1)", () => {
  const fall = () => [
    ["flikar", shared.TEACHER_TABS.map((t) => t.key)],
    ["sektioner", sections.CLASS_SECTIONS.map((s) => s.key)],
    ["statistik", stats.map((s) => s.key)],
  ];
  it("varje flik, sektion och statistikflik har en plats efter omgörningen", () => {
    for (const [del, keys] of fall()) {
      for (const k of keys) {
        const p = PLACERING[del][k];
        assert.ok(p, `${del}.${k} saknar placering i src/teacher-struktur.js`);
        assert.ok(NYA_PLATSER.some((n) => p.efter.startsWith(n)), `${del}.${k}: "${p.efter}" börjar inte med ett nytt menyval`);
        assert.match(p.del, /^[A-F–]$/, `${del}.${k}: del`);
      }
    }
  });
  it("kartan har inga rader för sådant som inte finns (stavfel/borttaget)", () => {
    for (const [del, keys] of fall()) {
      assert.deepEqual(Object.keys(PLACERING[del]).filter((k) => !keys.includes(k)), [], del);
    }
  });
  it("varje flik nås i toppmenyn av exakt de roller kartan anger", () => {
    for (const t of shared.TEACHER_TABS) {
      const p = PLACERING.flikar[t.key];
      assert.equal(nar(t.key, true), true, `admin når ${t.key}`);
      assert.equal(nar(t.key, false), p.roll === "alla", `årskurs och ${t.key}`);
      assert.equal(rollAv(t.admin), p.roll, `${t.key}: rollen i kartan`);
    }
  });
  it("varje klass-sektion ligger i ett sidläge som rätt roll når", () => {
    for (const s of sections.CLASS_SECTIONS) {
      assert.equal(sektionsRoll(s.key), PLACERING.sektioner[s.key].roll, `sektion ${s.key}`);
    }
  });
  it("varje statistikflik nås via statistiksektionen för alla roller", () => {
    assert.equal(sektionsRoll("statistik"), "alla");
    for (const s of stats) {
      assert.equal(PLACERING.statistik[s.key].roll, "alla", s.key);
      // `when` kräver bara en vald klass – den finns alltid i klassvyn.
      assert.ok(!s.when || s.when({ classId: "4a" }), `${s.key} syns med vald klass`);
    }
  });
  it("docs/LARARSIDAN_INVENTERING.md tar upp varje rad", () => {
    const doc = readFileSync(new URL("../docs/LARARSIDAN_INVENTERING.md", import.meta.url), "utf8");
    for (const [del, keys] of fall()) {
      for (const k of keys) assert.ok(doc.includes(`\`${del}.${k}\``), `inventeringen saknar \`${del}.${k}\``);
    }
  });
});

describe("gamla adresser (DEL 7)", () => {
  const routes = () => new Set(shared.TEACHER_TABS.map((t) => t.hash.slice(1)));
  const mal = (hash) => {
    const [p, q] = hash.slice(1).split("?");
    return shared.teacherRedirect(p, q) || hash;
  };
  it("varje gammal adress i spec-tabellen har ett mål som är en riktig route", () => {
    for (const gammal of Object.keys(GAMLA_ADRESSER)) {
      assert.ok(shared.TEACHER_REDIRECTS[gammal], `${gammal} saknas i TEACHER_REDIRECTS`);
      const dit = mal(`#${gammal}`).split("?")[0].slice(1);
      assert.ok(routes().has(dit), `${gammal} → ${dit} är ingen route`);
    }
  });
  it("Översikt → Hem, och äldre adresser följer kedjan", () => {
    assert.equal(mal("#/larare/oversikt"), "#/larare/hem");
    assert.equal(mal("#/larare"), "#/larare/hem");
    assert.equal(mal("#/larare/klass"), "#/larare/mina-klasser?flik=hur");
    assert.equal(mal("#/larare/elever"), "#/larare/mina-klasser?flik=ser");
    assert.equal(mal("#/larare/prompter"), "#/larare/innehall");
  });
  it("parametrarna följer med: ?prov= till Hitta rätt!, ?klass= till klassvyn", () => {
    assert.equal(mal("#/larare/hitta-ratt?prov=sverige&fran=fardiga"), "#/larare/hitta-ratt?prov=sverige&fran=fardiga");
    assert.equal(mal("#/larare/klass?klass=4b"), "#/larare/mina-klasser?flik=hur&klass=4b");
    assert.equal(mal("#/larare/oversikt?x=1"), "#/larare/hem?x=1");
  });
  it("en route som redan är platsen omdirigeras inte (ingen loop)", () => {
    for (const p of routes()) {
      const dit = shared.teacherRedirect(p, "");
      assert.ok(dit === null || dit.slice(1).split("?")[0] !== p, p);
    }
    assert.equal(shared.teacherRedirect("/larare/live", "id=1"), null);
  });
  it("app.js omdirigerar via teacherRedirect och har inga egna lärar-omdirigeringar kvar", () => {
    const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    assert.match(app, /teacherRedirect\(path,/);
    assert.match(app, /window\.location\.replace\(ny\)/);
    assert.doesNotMatch(app, /"\/larare[^"]*": \(\) => go\(/);
  });
});

describe("profilmenyn och bootgrafen", () => {
  it("Logga ut ligger i profilmenyn, inte som eget toppval; ☰ finns för smala skärmar", () => {
    const src = readFileSync(new URL("../src/teacher-shared.js", import.meta.url), "utf8");
    assert.match(src, /class="tprof-meny"[\s\S]*Hjälp och guide[\s\S]*data-logout="1"[\s\S]*Logga ut/);
    assert.doesNotMatch(src, /class="tnav logout"/);
    assert.match(src, /class="tnav tnav-burger"/);
  });
  it("nya lärarfiler laddas bara dynamiskt", () => {
    const src = readFileSync(new URL("../src/teacher-shared.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /^import .*teacher-(struktur|hjalp|gate)/m);
    assert.match(src, /import\("\.\/teacher-gate\.js"\)/);
    assert.match(src, /import\("\.\/teacher-hjalp\.js"\)/);
  });
});
