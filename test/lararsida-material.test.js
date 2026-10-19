// ============================================================================
// #806 (epic #802 DEL 4) – Material med underflikar.
//   * flikarna per roll: årskurslärare utan Hitta rätt!, admin med; placeringskartan stämmer
//   * varje flik har en rad om var klassinställningarna finns, med länkar som landar på riktiga routes
//   * gamla adresser (#/larare/innehall, /brakresan, /hitta-ratt?prov=) hamnar rätt, parametrar följer med
//   * interna länkar till Material pekar på en känd flik; vyerna laddas bara med import() (bootgrafen)
//   * ikonknapparna i materialtabellen har title + aria-label med text
//   * Ekvationsresans testläge (minneslager) kör utan Firebase och skriver ingenting
//   * Schack-provet rör inte mynt/räknare/server
// Körs med: node --test
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { installeraFirebaseStubbe, installeraWebbStubbe } from "./helpers/firebase-stub-loader.js";
import { PLACERING } from "../src/teacher-struktur.js";
import { MATERIAL_FLIKAR, LANK, materialFlik, materialFlikar } from "../src/teacher-material-flikar.js";

const SRC = new URL("../src/", import.meta.url).pathname;
const las = (f) => readFileSync(join(SRC, f), "utf8");
const filer = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? filer(p) : p.endsWith(".js") ? [p] : [];
});

let shared;
before(async () => {
  installeraFirebaseStubbe();
  installeraWebbStubbe();
  shared = await import("../src/teacher-shared.js");
});

describe("flikarna per roll", () => {
  it("årskurslärare: Plugga-områden, Läsresan, Ekvationsresan, Bråkresan, Schack – inte Hitta rätt!", () => {
    assert.deepEqual(materialFlikar(false).map((f) => f.key), ["plugga", "lasresan", "ekvationsresan", "brakresan", "schack"]);
  });
  it("admin ser alla sex, Hitta rätt! inräknad", () => {
    assert.deepEqual(materialFlikar(true).map((f) => f.key), ["plugga", "lasresan", "ekvationsresan", "brakresan", "hitta-ratt", "schack"]);
  });
  it("rollen i placeringskartan stämmer med registryn, och varje flik har en plats", () => {
    assert.deepEqual(Object.keys(PLACERING.material).sort(), MATERIAL_FLIKAR.map((f) => f.key).sort());
    for (const f of MATERIAL_FLIKAR) assert.equal(PLACERING.material[f.key].roll, f.admin ? "admin" : "alla", f.key);
  });
  it("Material är EN flik i toppmenyn, för båda rollerna (ingen admin-flik utanför Hitta rätt!)", () => {
    const t = shared.TEACHER_TABS.find((x) => x.key === "material");
    assert.equal(t.hash, "#/larare/material");
    assert.equal(t.group, "material");
    assert.equal(t.admin, false);
    for (const gammal of ["innehall", "brakresan", "hittaratt"]) assert.ok(!shared.TEACHER_TABS.some((x) => x.key === gammal), gammal);
  });
  it("materialFlik hittar på nyckel och ger null för okänt", () => {
    assert.equal(materialFlik("schack").label, "Schack");
    assert.equal(materialFlik("nej"), null);
  });
});

describe("raden överst i varje flik", () => {
  const routes = () => new Set(shared.TEACHER_TABS.map((t) => t.hash.slice(1)));
  it("varje flik säger var klassinställningarna finns, med minst en länk", () => {
    for (const f of MATERIAL_FLIKAR) {
      assert.match(f.hint, /Mina klasser/, f.key);
      assert.match(f.hint, /data-hash="#\/larare\//, `${f.key}: länk`);
    }
  });
  it("Läsresans rad är den i specen: nivåerna ändras under Mina klasser → Hur går det? → Läsresan", () => {
    assert.match(materialFlik("lasresan").hint, /Elevernas nivåer ändrar du under .*Mina klasser → Hur går det\? → Läsresan/);
  });
  it("länkarna landar på en route eller en omdirigering", () => {
    for (const l of Object.values(LANK)) {
      const path = l.hash.slice(1).split("?")[0];
      const dit = (shared.teacherRedirect(path, "") || l.hash).slice(1).split("?")[0];
      assert.ok(routes().has(dit), `${l.hash} → ${dit}`);
    }
  });
});

describe("gamla adresser", () => {
  const mal = (hash) => {
    const [p, q] = hash.slice(1).split("?");
    return shared.teacherRedirect(p, q) || hash;
  };
  it("innehall, brakresan och hitta-ratt går till rätt underflik", () => {
    assert.equal(mal("#/larare/innehall"), "#/larare/material?flik=plugga");
    assert.equal(mal("#/larare/brakresan"), "#/larare/material?flik=brakresan");
    assert.equal(mal("#/larare/hitta-ratt"), "#/larare/material?flik=hitta-ratt");
    assert.equal(mal("#/larare/prompter"), "#/larare/material?flik=plugga");
  });
  it("parametrarna följer med: ?prov=&fran=, ?vy=, ?u=&seed=", () => {
    const p = new URLSearchParams(mal("#/larare/hitta-ratt?prov=sverige&fran=fardiga").split("?")[1]);
    assert.deepEqual(Object.fromEntries(p), { flik: "hitta-ratt", prov: "sverige", fran: "fardiga" });
    assert.deepEqual(Object.fromEntries(new URLSearchParams(mal("#/larare/hitta-ratt?vy=ny&id=e-1").split("?")[1])), { flik: "hitta-ratt", vy: "ny", id: "e-1" });
    assert.deepEqual(Object.fromEntries(new URLSearchParams(mal("#/larare/brakresan?u=05&vy=spela&seed=x").split("?")[1])), { flik: "brakresan", u: "05", vy: "spela", seed: "x" });
  });
  it("målet är en riktig route och omdirigeras inte vidare", () => {
    const dit = mal("#/larare/innehall").split("?")[0];
    assert.equal(dit, "#/larare/material");
    assert.equal(shared.teacherRedirect("/larare/material", "flik=schack"), null);
  });
  it("varje intern #/larare/material?flik=… i koden har en känd flik", () => {
    const kanda = new Set(MATERIAL_FLIKAR.map((f) => f.key));
    const fel = [];
    for (const f of filer(SRC)) {
      for (const m of readFileSync(f, "utf8").matchAll(/#\/larare\/material\?flik=([a-z-]+)/g)) if (!kanda.has(m[1])) fel.push(`${f}: ${m[1]}`);
    }
    assert.deepEqual(fel, []);
  });
  it("de flyttade vyerna bygger sina länkar med & (flik= står först)", () => {
    assert.doesNotMatch(las("brakresan/larare/testlage.js"), /\$\{HASH\}\?/);
    for (const f of ["page-larare-hitta-ratt", "lhr-fardiga", "lhr-mina", "lhr-redigera"]) {
      assert.doesNotMatch(las(`hitta-ratt/larare/${f}.js`), /\$\{HASH\}\?/, f);
    }
  });
});

describe("bootgrafen och filstorlek", () => {
  it("underflikarna laddas bara med import()", () => {
    for (const f of ["teacher-shared.js", "teacher-material.js", "teacher-material-flikar.js"]) {
      assert.doesNotMatch(las(f), /^import .*(teacher-content|testlage|hitta-ratt|larare-testlage|larare-prova|teacher-material-lasresan)/m, f);
    }
    assert.match(las("teacher-shared.js"), /import\("\.\/teacher-material\.js"\)/);
    for (const f of MATERIAL_FLIKAR) assert.match(f.rita.toString(), /import\(/, f.key);
  });
  it("nya filer är högst 400 rader", () => {
    for (const f of ["teacher-material.js", "teacher-material-flikar.js", "teacher-material-lasresan.js", "ekvationsresan/larare-testlage.js", "schack/larare-prova.js", "teacher-content-list.js", "teacher-shared.js"]) {
      assert.ok(las(f).split("\n").length <= 400, f);
    }
  });
});

describe("materialtabellens ikonknappar", () => {
  it("har title och aria-label med samma text, med områdets namn", () => {
    const src = las("teacher-content-list.js");
    assert.match(src, /const actBtn = [\s\S]*title="\$\{esc\(label\)\}" aria-label="\$\{esc\(label\)\}"/);
    for (const ak of ["edit", "review", "add", "amnes", "del"]) assert.match(src, new RegExp(`actBtn\\("${ak}", "[a-z]+", \`[^\`]*\\$\\{a\\.name\\}`), ak);
  });
});

describe("Ekvationsresans testläge", () => {
  it("minneslagret kör uppgift för uppgift utan Firebase och höjer aldrig mynt", async () => {
    const { minneslager } = await import("../src/ekvationsresan/larare-testlage.js");
    const { generateTask, seededRng } = await import("../src/ekvationsresan/generator.js");
    const { startRun, playMoves } = await import("../src/ekvationsresan/losning.js");
    const { fromJSON } = await import("../src/ekvationsresan/equation.js");
    const { taskResult } = await import("../src/ekvationsresan/resultat.js");
    const { rulesFor } = await import("../src/ekvationsresan/config.js");

    const lager = minneslager(2, { rng: seededRng("806") });
    const start = lager.enter();
    assert.equal(start.progress.level, 2);
    assert.ok(start.current.task.equation, "en uppgift att börja på");
    assert.equal(lager.enter().current.id, start.current.id, "samma pågående uppgift tills den är löst");

    const task = generateTask(2, { type: "A", rng: seededRng("806-a") });
    const { current } = lager.retry(task);
    const run = playMoves(startRun(fromJSON(task.equation), { rules: rulesFor(2) }), task.optimalPath);
    const res = await lager.save({ current, run, help: { maxStep: 0, log: [] }, result: taskResult(task, run, { maxStep: 0 }), blocked: 0, ownMoves: 0 });
    assert.equal(res.ok, true);
    assert.equal(res.coins, 0);
    assert.equal(res.balance, null);
    assert.notEqual(res.next.id, current.id, "nästa uppgift");
    assert.equal(res.progress.current.id, res.next.id);
  });
  it("sidan rör inte Firebase eller ekv-data", () => {
    const src = las("ekvationsresan/larare-testlage.js");
    assert.ok(!/ekv-data|firebase-config|\.\.\/data\.js|setDoc|runTransaction|addCoins|award\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "inga skrivvägar");
  });
});

describe("Schack – Prova mot datorn", () => {
  it("inga mynt, ingen räknare, ingen server och inget kompisläge", () => {
    const src = las("schack/larare-prova.js");
    assert.ok(!/schack-moln|mynt:|onDatorSlut|firebase|data\.js|ui\.js/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "inga skrivvägar");
    assert.match(src, /kompis: null/);
    assert.match(src, /pp:schack:dator:larare-prova/, "egen lokal nyckel, inte elevens");
  });
  it("Material skickar ?-parametrarna vidare till Schack (Fortsätt och omladdning visar det sparade partiet, F4)", () => {
    assert.match(las("teacher-material-flikar.js"), /rita: async \(sub, params\) => \(await import\("\.\/schack\/larare-prova\.js"\)\)\.renderSchackProva\(sub, params\)/);
    assert.match(las("teacher-material.js"), /flik\.rita\(sub, params\)/);
    assert.match(las("schack/larare-prova.js"), /params\.vy === "dator" \? params/);
  });
  it("schack-flode bygger hashar även när hashBas har en query", () => {
    assert.match(las("schack/schack-flode.js"), /hashBas\.includes\("\?"\) \? "&" : "\?"/);
  });
});
