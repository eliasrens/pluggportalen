// ============================================================================
// #805 (epic #802 §3.4–3.5): Mina klasser → Elever (kompakt elevtabell med
// menyn ⋯) och Admin-sidan med kort.
//   * årskurslärare ser aldrig Ge mynt, Ta ur klassen, Ta bort konto, Lägg till
//     elev, Ge hela klassen mynt, Skapa klass eller Admin
//   * destruktiva val ligger bara i menyn och bekräftas i en ruta (aldrig confirm())
//   * Admin-sidans kort, omdirigeringen av #/larare/admin/klasser
//   * inga nya läsningar när fliken/sidan öppnas; nya vyer bara via import()
// Webbläsartestet med båda rollerna: admin/qa-elever-admin-e2e.mjs.
// Körs med: node --test
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";
import { KLASSKNAPPAR, MENYVAL, fordelaMynt, matcharSok, menyFor } from "../src/teacher-elever-val.js";
import { MINA_FLIKAR, flikSektioner } from "../src/teacher-mina-val.js";

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const utanKommentarer = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let shared, sections, admin;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
  sections = await import("../src/teacher-classes-sections.js");
  admin = await import("../src/teacher-admin.js");
});

describe("menyn ⋯ (§3.4)", () => {
  it("årskurslärare: bara Byt lösenord", () => {
    assert.deepEqual(menyFor(false).map((v) => v.label), ["Byt lösenord"]);
  });
  it("admin: Byt lösenord (och användarnamn), Ändra namn och avatar, Ge mynt, Ta ur klassen, Ta bort konto", () => {
    assert.deepEqual(menyFor(true).map((v) => v.key), ["losen", "namn", "mynt", "ur", "bort"]);
    assert.equal(menyFor(true)[0].adminLabel, "Byt lösenord eller användarnamn");
  });
  it("de destruktiva valen är adminval och märkta farliga (bekräftas)", () => {
    assert.deepEqual(MENYVAL.filter((v) => v.farlig).map((v) => v.label), ["Ta ur klassen", "Ta bort konto"]);
    for (const v of MENYVAL.filter((x) => x.farlig)) assert.equal(v.admin, true, v.key);
  });
  it("ingen admin-text i årskurslärarens meny", () => {
    const text = menyFor(false).map((v) => v.label).join(" ");
    assert.doesNotMatch(text, /mynt|Ta ur|Ta bort|namn och avatar|användarnamn/i);
  });
});

describe("knapparna för hela klassen + sök (§3.4)", () => {
  it("Skriv ut för alla; Ge hela klassen mynt och Lägg till elev bara admin", () => {
    assert.deepEqual(KLASSKNAPPAR.map((k) => [k.label, k.admin]), [
      ["Skriv ut inloggningskort", false], ["Ge hela klassen mynt", true], ["Lägg till elev", true],
    ]);
    assert.match(src("teacher-elever-tabell.js"), /KLASSKNAPPAR\.filter\(\(k\) => \(admin \|\| !k\.admin\)/);
  });
  it("sökningen: namn eller användarnamn, utan skiftlägeskänslighet; tom = alla", () => {
    const alva = { namn: "Alva Öberg", username: "4a01" };
    assert.ok(matcharSok(alva, ""));
    assert.ok(matcharSok(alva, "  alv "));
    assert.ok(matcharSok(alva, "ÖBERG"));
    assert.ok(matcharSok(alva, "4a0"));
    assert.ok(!matcharSok(alva, "bilal"));
    assert.ok(matcharSok({}, ""));
    assert.ok(!matcharSok({}, "x"));
  });
  it("Ge hela klassen mynt: heltal 1–1000", () => {
    assert.deepEqual(fordelaMynt("10"), { antal: 10 });
    assert.deepEqual(fordelaMynt("12.9"), { antal: 12 });
    assert.ok(fordelaMynt("0").fel);
    assert.ok(fordelaMynt("-5").fel);
    assert.ok(fordelaMynt("abc").fel);
    assert.ok(fordelaMynt("1001").fel);
  });
});

describe("rollen styr vad som ritas", () => {
  it("Elever-fliken: årskurs = Inloggning (utan adminval), admin = Elever + Klasscentret", () => {
    const elever = MINA_FLIKAR.find((f) => f.key === "elever");
    assert.deepEqual(flikSektioner(elever, false), ["inloggning"]);
    assert.deepEqual(flikSektioner(elever, true), ["elever", "klasscenter"]);
    const sek = src("teacher-classes-sections.js");
    assert.match(sek, /key: "inloggning",[\s\S]*?render: elevSection\(false\)/);
    assert.match(sek, /key: "elever",[\s\S]*?render: elevSection\(true\)/);
    // Extra lås: även admin-sektionen kräver isAdmin() (reglerna spärrar ändå, #678).
    assert.match(sek, /admin: admin && isAdmin\(\)/);
  });
  it("tabellen ritar Mynt-kolumnen och adminvalen bara när admin är sant", () => {
    const t = utanKommentarer(src("teacher-elever-tabell.js"));
    assert.match(t, /\$\{admin \? `<span role="columnheader">Mynt<\/span>` : ""\}/);
    assert.match(t, /\$\{admin \? `<span class="et-mynt"/);
    assert.match(t, /const val = menyFor\(admin\);/);
    assert.match(t, /if \(!b \|\| !admin\) return;/); // klasspanelerna öppnas aldrig för årskurs
    assert.match(t, /passwordOnly: !admin/); // användarnamnet låst för årskurs (som förut)
  });
  it("Skapa klass, Döp om och Ta bort klass finns bara på Admin-sidan", () => {
    for (const f of ["teacher-elever-tabell.js", "teacher-elever-atgarder.js", "teacher-mina-klasser.js", "teacher-classes-sections.js"]) {
      assert.doesNotMatch(utanKommentarer(src(f)), /renderCreateClass|deleteClass|upsertClass/, f);
    }
    assert.match(src("teacher-admin.js"), /data\.deleteClass\(c\.id\)/);
    assert.match(src("teacher-admin.js"), /data\.upsertClass\(c\.id, \{ name \}\)/);
  });
});

describe("bekräftelse på sidan, aldrig confirm()/prompt()/alert()", () => {
  it("de nya vyerna anropar inte webbläsarens dialoger", () => {
    for (const f of ["teacher-elever-tabell.js", "teacher-elever-atgarder.js", "teacher-bekrafta.js", "teacher-admin.js", "teacher-class-accounts.js"]) {
      assert.doesNotMatch(utanKommentarer(src(f)), /\b(confirm|prompt|alert)\(/, f);
    }
  });
  it("bekräftelserutan fokuserar Avbryt – Enter bekräftar aldrig av misstag (#805 F3)", () => {
    const b = src("teacher-bekrafta.js");
    assert.match(b, /ruta\.querySelector\("\.et-avbryt"\)\.focus\(\)/);
    assert.doesNotMatch(utanKommentarer(b), /ja\.focus\(\)/);
  });
  it("Ta bort konto: misslyckas raderingen efter att eleven tagits ur klassen ritas tabellen om med ett fel (#805 F4)", () => {
    const a = src("teacher-elever-atgarder.js");
    assert.match(a, /await data\.setClassStudents\(cls\.id, nextIds\);\s*cls\.studentIds = nextIds;\s*try \{\s*await data\.deleteStudent\(s\.id\);\s*\} catch \(err\) \{[\s\S]*?borta\(\);\s*fel\(/);
  });
  it("Ge mynt per elev har samma gräns som hela klassen (fordelaMynt)", () => {
    assert.match(src("teacher-class-accounts.js"), /const \{ antal: amount, fel \} = fordelaMynt\(amountEl\.value\);/);
  });
  it("Ta ur klassen, Ta bort konto och Ta bort klass går via bekrafta()", () => {
    const a = src("teacher-elever-atgarder.js");
    assert.match(a, /typ === "ur"\) \{\s*return bekrafta\(host, \{/);
    assert.match(a, /typ === "bort"\) \{\s*return bekrafta\(host, \{/);
    assert.match(a, /knapp: "Ja, ge mynt",\s*farlig: false/);
    assert.match(src("teacher-admin.js"), /bekrafta\(ruta, \{[\s\S]*?knapp: "Ta bort klassen"/);
  });
});

describe("Admin-sidan (§3.5)", () => {
  it("kort: Skapa klass, Döp om klass, Ta bort klass, Lärarkonton, Säsong, Hitta rätt!, Mattematchen", () => {
    assert.deepEqual(admin.ADMIN_KORT.map((k) => k.titel),
      ["Skapa klass", "Döp om klass", "Ta bort klass", "Lärarkonton", "Säsong", "Hitta rätt!", "Mattematchen"]);
  });
  it("korten som leder vidare pekar på riktiga admin-flikar (Hitta rätt!: Material-underfliken, #806)", () => {
    const hr = admin.ADMIN_KORT.find((x) => x.key === "hittaratt");
    assert.equal(hr.hash, "#/larare/material?flik=hitta-ratt");
    assert.match(src("teacher-material-flikar.js"), /key: "hitta-ratt"[^\n]*admin: true/);
    for (const k of admin.ADMIN_KORT.filter((x) => x.hash && x !== hr)) {
      const t = shared.TEACHER_TABS.find((x) => x.hash === k.hash);
      assert.ok(t, `${k.titel}: ${k.hash} är ingen flik`);
      assert.equal(t.admin, true, `${k.titel} är bara för admin`);
    }
  });
  it("Admin är en admin-flik (#/larare/admin) och syns inte för årskurslärare", () => {
    const t = shared.TEACHER_TABS.find((x) => x.key === "admin");
    assert.equal(t.hash, "#/larare/admin");
    assert.equal(t.admin, true);
    assert.ok(!shared.navGroups(false).some((g) => g.key === "admin"));
    assert.equal(shared.navGroups(true).find((g) => g.key === "admin").tabs[0].key, "admin");
    assert.ok(!shared.TEACHER_TABS.some((x) => x.key === "adminklasser"), "gamla fliken är borta");
  });
  it("årskurskonto som öppnar #/larare/admin får 'Det här kan bara admin göra.' (lazyPage)", () => {
    assert.match(src("teacher-shared.js"), /if \(admin && isTeacher\(\) && !isAdmin\(\)\) return renderAdminOnly\(ctx\);/);
  });
  it("inga läsningar när sidan öppnas – klasser/elever först när ett verktyg behöver dem", () => {
    const a = utanKommentarer(src("teacher-admin.js"));
    assert.match(a, /const klasser = \(\) => \(klasserP \|\|= data\.getClasses\(\)/);
    assert.match(a, /const elever = \(\) => \(eleverP \|\|= data\.getStudents\(\)/);
    const fore = a.slice(a.indexOf("export async function pageLarareAdmin"), a.indexOf("function visa("));
    assert.doesNotMatch(fore.replace(/const (klasser|elever) = .*$/gm, ""), /data\.get/);
  });
});

describe("omdirigering av #/larare/admin/klasser (DEL 7)", () => {
  const mal = (hash) => {
    const [p, q] = hash.slice(1).split("?");
    return shared.teacherRedirect(p, q) || hash;
  };
  it("utan klass → Admin", () => {
    assert.equal(mal("#/larare/admin/klasser"), "#/larare/admin");
  });
  it("med vald klass → Mina klasser → Elever, och gamla ?sektion= följer med", () => {
    assert.equal(mal("#/larare/admin/klasser?klass=4a"), "#/larare/mina-klasser?flik=elever&klass=4a");
    assert.equal(mal("#/larare/admin/klasser?klass=4a&sektion=klasscenter"), "#/larare/mina-klasser?flik=elever&klass=4a&sektion=klasscenter");
  });
  it("Admin-sidan omdirigeras inte (ingen loop)", () => {
    assert.equal(shared.teacherRedirect("/larare/admin", ""), null);
    assert.equal(shared.teacherRedirect("/larare/admin", "verktyg=skapa"), null);
  });
});

describe("läsningar och bootgrafen", () => {
  it("elevtabellen läser inget när den ritas – lösenord/mynt bara vid klick på Visa, en elev", () => {
    const t = utanKommentarer(src("teacher-elever-tabell.js"));
    const rita = t.slice(t.indexOf("export function renderElevTabell"), t.indexOf("function visaKnapp("));
    assert.doesNotMatch(rita, /getStudentCredentials|getCoins|getStudents|getDoc/);
    assert.match(t, /getStudentCredentials\(\[s\.id\]\)/);
    assert.match(t, /data\.getCoins\(s\.id\)/);
  });
  it("de nya vyerna laddas bara med import()", () => {
    assert.match(src("teacher-shared.js"), /import\("\.\/teacher-admin\.js"\)/);
    assert.match(src("teacher-classes-sections.js"), /import\("\.\/teacher-elever-tabell\.js"\)/);
    for (const f of ["teacher-shared.js", "teacher-classes-sections.js", "teacher-classes.js", "app.js"]) {
      assert.doesNotMatch(src(f), /^import [^\n]*teacher-(admin|elever-|bekrafta)/m, f);
    }
  });
  it("Master-Detail-vyn för Admin → Klasser & elevkonton är borta", () => {
    assert.ok(!("admin" in sections.CLASS_PAGE_MODES));
    assert.doesNotMatch(src("teacher-classes.js"), /teacher-classes-page|pageLarareAdminKlasser/);
  });
});
