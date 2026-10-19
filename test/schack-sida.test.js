// ============================================================================
// Schack B (#776, spec §4): modulen i registret (opt-in, inte låsbar, stängs av
// fokusläget), routen i app.js med import(), bootgrafen (#271), workern,
// markupen för startsidan och nivåväljaren samt att inget confirm() används.
// Körs med: node --test test/schack-sida.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  STUDENT_MODULES, TOGGLABLE_MODULES, OPT_IN_MODULES, SCHACK_IKON, moduleForRoute, modulesHiddenForStudent, normalizeEnabledModules,
} from "../src/gamemode-visibility.js";
import { LOCK_TARGET_TYPES } from "../src/class-lock.js";
import { startHtml, nivavalHtml } from "../src/schack/schack-sida-delar.js";
import { nyttParti } from "../src/schack/schack-parti.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
/** Källkoden utan kommentarer (de får nämna confirm() och Firestore). */
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("modulen schack i registret (§4)", () => {
  const m = STUDENT_MODULES.find((x) => x.id === "schack");
  it("opt-in, i gruppen Öva, inlärningsmodul (fokusläget stänger den) men inte låsbar", () => {
    assert.ok(m, "schack saknas i STUDENT_MODULES");
    assert.deepEqual([m.label, m.grupp, m.optIn, m.learning, m.lockable, m.routes], ["Schack", "ova", true, true, false, ["/elev/schack"]]);
    assert.ok(TOGGLABLE_MODULES.includes(m), "läraren kan slå på den per klass");
    assert.ok(OPT_IN_MODULES.includes("schack"));
    assert.ok(!LOCK_TARGET_TYPES.includes("schack"), "går inte att låsa klassen till schack");
    assert.equal(moduleForRoute("/elev/schack"), "schack");
  });
  it("lärarens enabledModules slår på schack för klassen", () => {
    assert.deepEqual(normalizeEnabledModules(["schack", "x"]), ["schack"]);
    const av = [{ id: "a", studentIds: ["e"] }];
    const pa = [{ id: "a", studentIds: ["e"], enabledModules: ["schack"] }];
    assert.ok(modulesHiddenForStudent(av, "e").includes("schack"));
    assert.ok(!modulesHiddenForStudent(pa, "e").includes("schack"));
  });
  it("ikonen är en egen SVG-bonde, utan unicode-schacktecken", () => {
    assert.match(SCHACK_IKON, /^<svg [^>]*aria-hidden="true"/);
    assert.match(SCHACK_IKON, /<circle cx="50" cy="31" r="14"\/>/);
    assert.doesNotMatch(SCHACK_IKON, /[♔-♟]/u);
    assert.equal(m.ikon, SCHACK_IKON);
  });
});

describe("routen och bootgrafen (#271)", () => {
  it("app.js registrerar /elev/schack med import() av src/schack/page-schack.js", () => {
    const app = las("src/app.js");
    assert.match(app, /"\/elev\/schack": dynSida\(async \(\) => \(await import\("\.\/schack\/page-schack\.js"\)\)\.pageSchack\(\)/);
    assert.doesNotMatch(app, /^\s*import[^;]*["']\.\/schack\//m, "ingen statisk import av schack i app.js");
  });
  it("sidan och flödet laddar partivyn och motorn lazy; ingen fil i src/schack/ importeras statiskt utifrån", () => {
    assert.match(las("src/schack/page-schack.js"), /import\("\.\/schack-flode\.js"\)/);
    assert.match(las("src/schack/schack-flode.js"), /import\("\.\/schack-dator-vy\.js"\)/);
    assert.match(las("src/schack/schack-dator.js"), /new Workern\(new URL\("\.\/schack-motor-worker\.js", import\.meta\.url\), \{ type: "module" \}\)/);
    assert.match(las("src/schack/schack-dator.js"), /import\("\.\/schack-motor\.js"\)/, "reserv i huvudtråden");
  });
  it("workern importerar bara motorn och svarar med id", () => {
    const w = las("src/schack/schack-motor-worker.js");
    assert.deepEqual([...w.matchAll(/^import .* from "([^"]+)"/gm)].map((x) => x[1]), ["./schack-motor.js"]);
    assert.match(w, /self\.onmessage/);
    assert.match(w, /self\.postMessage\(\{ id, ok: true, resultat \}\)/);
  });
  it("inget confirm()/alert()/prompt() i src/schack/ – rutorna ligger på sidan", () => {
    for (const f of readdirSync(join(ROOT, "src/schack")).filter((f) => f.endsWith(".js"))) {
      assert.doesNotMatch(kod(`src/schack/${f}`), /\b(confirm|alert|prompt)\(/, f);
    }
  });
  it("sidans CSS är inbyggd i styles.css", () => {
    assert.match(las("src/styles.css"), /src\/styles\/36-schack-sida\.css/);
    assert.match(las("src/styles.css"), /\.schack-fraga \{/);
  });
  // #777 F2: rutorna på sidan hette .schack-ruta – samma klass som brädets 64 rutor –
  // så varje ruta fick ram, padding och (≤ 820 px) position: fixed: brädet blev tomt på mobil.
  it("sidans CSS rör inte brädets rutor (.schack-ruta) och panelens rutor använder inte klassen", () => {
    const sidCss = las("src/styles/36-schack-sida.css").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(sidCss, /\.schack-ruta(?![-\w])/);
    assert.doesNotMatch(kod("src/schack/schack-dator-vy.js"), /class="[^"]*\bschack-ruta(?![-\w])/);
    assert.doesNotMatch(kod("src/schack/schack-sida-delar.js"), /class="[^"]*\bschack-ruta(?![-\w])/);
  });
  // #777: på en 320 px-mobil ger sidans marginal (2 × 20 px) bara 280 px – brädet (minst 320 px)
  // går då ut i marginalen i stället för att sidan skrollar i sidled.
  it("brädet får gå ut i sidans marginal på smal skärm", () => {
    const sidCss = las("src/styles/36-schack-sida.css");
    assert.match(sidCss, /\.schack-parti-brade \{ margin-inline: min\(0px, \(100% - 320px\) \/ 2\); \}/);
  });
  // #779 (Etapp 2A): bara schack-moln.js får tala med Firebase – och den skriver
  // bara räknaren studentData.schack.datorPartier; allt annat går via callables.
  it("ingen Firestore utanför schack-moln.js och inga mynt i schackmodulen", () => {
    for (const f of readdirSync(join(ROOT, "src/schack")).filter((f) => f.endsWith(".js"))) {
      assert.doesNotMatch(kod(`src/schack/${f}`), /awardCoins|coins\b/i, f);
      if (f === "schack-moln.js") continue;
      assert.doesNotMatch(kod(`src/schack/${f}`), /firebase|firestore|setDoc|updateDoc/i, f);
    }
    const moln = kod("src/schack/schack-moln.js");
    assert.doesNotMatch(moln, /setDoc|deleteDoc|addDoc|writeBatch|runTransaction/);
    assert.match(moln, /"schack\.datorPartier": increment\(1\)/);
  });
});

describe("markupen (§4)", () => {
  it("startsidan: fyra stora kort, 'Spela mot datorn' och 'Lär dig schack' (#790) är öppna utan kompisläge; pågående parti överst", () => {
    const html = startHtml(null);
    assert.equal((html.match(/class="big-card schack-kort/g) || []).length, 4);
    assert.match(html, /data-act="dator"[^>]*>(?!.*aria-disabled)/);
    assert.equal((html.match(/Kommer snart/g) || []).length, 2);
    assert.doesNotMatch(html, /Fortsätt partiet/);
    for (const t of ["Spela mot datorn", "Spela mot en kompis", "Lär dig schack", "Pussel"]) assert.ok(html.includes(t), t);
    const p = nyttParti({ niva: "damen", farg: "b" });
    p.drag = ["e4", "e5"];
    const med = startHtml(p);
    assert.match(med, /data-act="fortsatt"[^>]*>Fortsätt partiet/);
    assert.match(med, /Mot Damen · 1 drag · du spelar svart/);
    assert.ok(med.indexOf("schack-pagaende") < med.indexOf("schack-kort-rad"), "överst");
  });
  it("nivåväljaren: fyra nivåer och tre färger, valet markerat med aria-checked", () => {
    const html = nivavalHtml({ niva: "tornet", farg: "slump" }, null);
    assert.equal((html.match(/role="radio" class="schack-niva/g) || []).length, 4);
    assert.equal((html.match(/role="radio" class="schack-farg/g) || []).length, 3);
    assert.match(html, /data-niva="tornet" aria-checked="true"/);
    assert.match(html, /data-niva="bonden" aria-checked="false"/);
    assert.match(html, /data-farg="slump" aria-checked="true"/);
    assert.match(html, /data-act="starta"/);
    assert.doesNotMatch(html, /schack-notis/);
    const p = nyttParti({ niva: "bonden" });
    assert.match(nivavalHtml({ niva: "bonden", farg: "w" }, p), /schack-notis[\s\S]*data-act="fortsatt"/);
  });
  it("inga unicode-schacktecken i markupen", () => {
    assert.doesNotMatch(startHtml(null) + nivavalHtml({ niva: "bonden", farg: "w" }, null), /[♔-♟]/u);
  });
});
