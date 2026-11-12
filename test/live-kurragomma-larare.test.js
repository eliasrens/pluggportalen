// Kurragömma E (#840): lärarformuläret (gömtid, startsökare, tystnad, karta → kgInstallningar,
// speltid 3/5/10/15/20/30 + Egen 1–60), deltagarregeln för pluggmynten (deltog), historiken
// (pall, topplista med pluggmynt, klarade sig / visslingar varav läraren / hittade flest,
// andel rätt per uppgift och tabell/kategori, Statistik → Live), Vissla-panelens rena logik
// och filkraven (≤ 400 rader, CSS-prefix kg-, synken, bootgrafen).
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import KURRAGOMMA from "../src/live/formats/kurragomma/index.js";
import { getFormat, registerFormat, validateFormat } from "../src/live/live-formats.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { fieldsFor, setupFieldsHtml, validateSetupFields, defaultSetupValues, coerceSetupValue } from "../src/live/live-setup-fields.js";
import {
  buildSessionFields, installningarUr, gomtidField, startsokareField, tystnadField, kartaField, durationField, INST_FALT,
} from "../src/live/formats/kurragomma/kg-setup.js";
import { deltog, rewardRader } from "../src/live/formats/kurragomma/delat/kg-regler.js";
import { visslaPanelSynlig, visslaFelText, visslaLista } from "../src/live/formats/kurragomma/kgp-logik.js";
import {
  GOMTIDER_S, GOMTID_STANDARD_S, SPELTIDER_MIN, SPELTID_EGEN_MIN, LARARE_VISSLA_SPARR_MS, VISSLING_SPARR_MS,
} from "../src/live/formats/kurragomma/delat/kg-config.js";

const MAPP = "src/live/formats/kurragomma";
const INPUT = {
  name: "Kurragömma 4B", gameMode: "multiplication_0_10", answerKind: "free", durationMin: 3, classIds: ["4b"], classNames: { "4b": "4B" },
  format: "kurragomma", gomtid: 20, startsokare: "2", tystnad: false, karta: "on", showNames: true, rewards: { firstPrize: 100, perCorrect: 2, cap: 300 },
};

describe("lärarformuläret (spec §0.2, §9)", () => {
  it("fälten: speltid (snabbknappar + Egen 1–60, 8 min rekommenderat), gömtid, startsökare, tystnad, karta, namn, pluggmynt", () => {
    const keys = KURRAGOMMA.setupFields.map((f) => f.key);
    assert.deepEqual(keys, ["durationMin", "gomtid", "startsokare", "tystnad", "karta", "showNames", "rewards"]);
    assert.deepEqual(fieldsFor(KURRAGOMMA).map((f) => f.key), keys, "kärnan lägger inte till en egen matchlängd");
    const dur = durationField();
    assert.deepEqual(dur.options.map((o) => o.value), SPELTIDER_MIN);
    assert.deepEqual([dur.custom.min, dur.custom.max], [SPELTID_EGEN_MIN.min, SPELTID_EGEN_MIN.max]);
    assert.match(dur.hint, /8 min/);
    assert.deepEqual(gomtidField().options.map((o) => o.value), GOMTIDER_S);
    assert.equal(gomtidField().default, GOMTID_STANDARD_S);
    assert.deepEqual(startsokareField().options.map((o) => o.value), ["auto", "1", "2", "3", "4"]);
    assert.equal(startsokareField().default, "auto");
    assert.deepEqual([tystnadField().kind, tystnadField().default], ["toggle", true]);
    assert.deepEqual(kartaField().options, [{ value: "on", label: "Ön" }]);
    assert.deepEqual(INST_FALT, ["gomtid", "startsokare", "tystnad", "karta"]);
    const html = setupFieldsHtml(KURRAGOMMA.setupFields);
    for (const k of ["gomtid", "startsokare", "tystnad", "karta"]) assert.ok(html.includes(`data-field="${k}"`), k);
    assert.ok(html.includes('value="auto"') && html.includes("Egen tid"));
    assert.deepEqual(validateSetupFields(KURRAGOMMA.setupFields, { ...INPUT }), []);
    assert.ok(validateSetupFields(KURRAGOMMA.setupFields, { ...INPUT, gomtid: 25 }).length, "25 s finns inte");
    assert.ok(validateSetupFields(KURRAGOMMA.setupFields, { ...INPUT, startsokare: "5" }).length);
    assert.deepEqual(defaultSetupValues(KURRAGOMMA.setupFields).gomtid, 30);
    assert.equal(coerceSetupValue(gomtidField(), "45"), 45, "gömtiden blir ett tal");
    assert.equal(coerceSetupValue(startsokareField(), "3"), "3", "startsökare är en sträng i formuläret (Auto)");
  });

  it("värdena når sessionen: kgInstallningar + durationSeconds = gömtid + speltid", () => {
    if (!getFormat("kurragomma")) registerFormat(KURRAGOMMA);
    assert.deepEqual(validateFormat(KURRAGOMMA), []);
    const f = buildSessionFields(INPUT);
    assert.deepEqual(f.kgInstallningar, { gomtid: 20, startsokare: 2, tystnad: false, karta: "on" });
    assert.equal(f.durationSeconds, 20 + 3 * 60);
    const d = buildSessionDoc(INPUT, { uid: "larare1" });
    assert.deepEqual(d.kgInstallningar, { gomtid: 20, startsokare: 2, tystnad: false, karta: "on" });
    assert.equal(d.durationSeconds, 200);
    assert.equal(d.showNames, true);
    assert.deepEqual(d.rewards, { firstPrize: 100, perCorrect: 2, cap: 300 });
    // standardvärden utan fälten; "auto" och ogiltiga värden normaliseras; tomma fält räknas som saknade
    assert.deepEqual(installningarUr({}), { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    assert.deepEqual(installningarUr({ gomtid: "", startsokare: "auto", tystnad: true, karta: "" }), { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    assert.deepEqual(installningarUr({ gomtid: 25, startsokare: "9", tystnad: "ja", karta: "skolgarden" }), { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" });
    // ett färdigt kgInstallningar (äldre anropare/tester) tas emot – fälten vinner
    assert.deepEqual(installningarUr({ kgInstallningar: { gomtid: 60, tystnad: false } }).gomtid, 60);
    assert.deepEqual(installningarUr({ kgInstallningar: { gomtid: 60 }, gomtid: 45 }).gomtid, 45);
    assert.equal(buildSessionFields({ durationMin: 8 }).durationSeconds, 30 + 480);
  });
});

describe("pluggmynten: deltagare (spec §10 + #840)", () => {
  it("deltog = svarat, låst ett gömställe eller hittat någon; rows ur serverns data", () => {
    assert.equal(deltog({ besvarade: 0, harLast: true, hittade: 0 }), true, "gömd hela matchen utan svar");
    assert.equal(deltog({ besvarade: 0, harLast: false, hittade: 1 }), true, "startsökare som hittade med den fria laddningen");
    assert.equal(deltog({ besvarade: 2, harLast: false, hittade: 0 }), true);
    assert.equal(deltog({ besvarade: 0, harLast: false, hittade: 0 }), false, "varken svarat, låst eller hittat");
    assert.equal(deltog({}), false);
    assert.deepEqual(rewardRader([{ uid: "a", poang: 170, ratt: 0, besvarade: 0 }]), [{ uid: "a", score: 170, correct: 0, answered: 0 }]);
    const rules = readFileSync("firestore.rules", "utf8");
    assert.match(rules, /get\(gp\)\.data\.get\('harLast', false\) == true/, "samma villkor i reglernas Kurragömma-gren");
    assert.match(rules, /get\(gp\)\.data\.get\('hittade', 0\) >= 1/);
  });
});

describe("historiken (spec §11.3)", () => {
  const HOOK = `export async function resolve(spec, ctx, next) {
    if (spec.endsWith("/teacher-shared.js")) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(
      "export const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;');") };
    if (spec.endsWith("/live-css.js")) return { shortCircuit: true, url: "data:text/javascript,export function ensureLiveCss(){}" };
    return next(spec, ctx);
  }`;
  const S = { id: "m1", name: "Kurragömma 4B", gameMode: "multiplication_0_10", answerKind: "free", participatingClassIds: ["4b"], classNames: { "4b": "4B" }, kgInstallningar: { gomtid: 20, startsokare: 2, tystnad: false, karta: "on" } };
  const R = {
    format: "kurragomma", winner: null, players: 3, totalCorrect: 5, totalAnswered: 8, klaradeSig: 1, hittade: 1, visslingar: 3,
    flestHittade: { uid: "a", name: "Alma", antal: 1 },
    ranking: [
      { uid: "c", name: "Cleo <3", classId: "4b", poang: 170, ratt: 0, besvarade: 0, hittade: 0, roll: "gomd", klaradeSig: true, rank: 1 },
      { uid: "a", name: "Alma", classId: "4b", poang: 70, ratt: 3, besvarade: 4, hittade: 1, roll: "sokare", klaradeSig: false, rank: 2 },
      { uid: "b", name: "Bo", classId: "4b", poang: 24, ratt: 2, besvarade: 4, hittade: 0, roll: "sokare", klaradeSig: false, rank: 3 },
    ],
    gomstallen: [{ uid: "b", x: 1, z: 2, skydd: 2, namn: "Bo", hittad: true }, { uid: "c", x: 3, z: 3, skydd: 1, namn: "Cleo <3", hittad: false }],
    perQuestion: [
      { index: 0, key: "m:3x4", text: "3 × 4", answered: 6, correct: 5, statKeys: ["t3", "t4"], byClass: { "4b": { answered: 6, correct: 5 } } },
      { index: 1, key: "m:7x8", text: "7 × 8", answered: 2, correct: 0, statKeys: ["t7", "t8"], byClass: { "4b": { answered: 2, correct: 0 } } },
    ],
    rewards: { c: { rank: 1, correct: 0, prize: 100, correctCoins: 0, total: 100 }, a: { rank: 2, correct: 3, prize: 85, correctCoins: 6, total: 91 }, b: { rank: 3, correct: 2, prize: 72, correctCoins: 4, total: 76 } },
  };
  let H;
  before(async () => {
    register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
    H = await import("../src/live/formats/kurragomma/kurragomma-history.js");
  });
  it("matchraden och utfallet per elev", () => {
    assert.equal(H.winnerText(S, R), "🙈 1 klarade sig");
    assert.equal(H.winnerText(S, { ...R, klaradeSig: 0 }), "🔎 Sökarna hittade alla");
    assert.equal(H.winnerText(S, null), "–");
    assert.deepEqual(["c", "b", "a", "x"].map((u) => H.utfallText(R, u)), ["🙈 Klarade sig", "🔎 Hittad", "🔦 Sökare", "–"]);
    assert.equal(H.ownPlayerTable, true);
    assert.deepEqual(H.playerCounts(S, R).get("a"), { correct: 3, incorrect: 1 });
  });
  it("en match: pall, siffrorna (varav läraren – ur kgEvents, bara här), topplista med pluggmynt, andel rätt per uppgift och tabell; inställningarna i raden", async () => {
    assert.ok(!("visslingarLarare" in R), "summan står aldrig i result (sessionen läses av eleverna, F1)");
    const html = await H.detailHtml(S, R, { visslingarLarare: 1 });
    assert.match(html, /1 av 3 klarade sig gömda hela matchen/);
    assert.match(html, /gömtid 20 s · startsökare 2\s*· tystnadsregeln av/);
    assert.ok(html.includes("🥇") && html.includes("Cleo &lt;3") && !html.includes("Cleo <3"), "pallen, escapad");
    assert.match(html, /varav 1 av läraren/);
    assert.match(html, /Hittade flest<\/span><b>Alma<\/b><small>1 st/);
    assert.match(html, /Pluggmynt/);
    assert.ok(html.includes("<td class=\"num\">100</td>"), "Cleos pris utan rätt-mynt");
    assert.match(html, /🙈 Klarade sig/);
    assert.match(html, /Andel rätt per uppgift/);
    assert.match(html, /Andel rätt per tabell/);
    assert.match(html, /svår/);
    assert.ok(html.includes("7 × 8"));
    const utan = await H.detailHtml(S, { ...R, rewards: undefined }, { visslingarLarare: 0 });
    assert.match(utan, /ingen av läraren/);
    assert.ok(!utan.includes("Pluggmynt"));
    assert.match(H.summorHtml(R, null), /varav läraren: –/, "kunde inte läsas (eller inte lärare) → streck");
    // utan deps: historiken hämtar själv ur kurragomma-data (Firebase saknas här → streck, aldrig ett kast)
    assert.match(await H.detailHtml(S, R), /varav läraren: –/);
    assert.match(await H.detailHtml(S, null), /Inget resultat ännu/);
  });
  it("Statistik → Live: klassens rad och sammanfattningen", () => {
    assert.equal(H.classStats.cols, 4);
    const rad = H.classStats.cells(S, R, "4b").replace(/\s+/g, " ");
    assert.match(rad, /<td class="num">5<\/td><td class="num">1<\/td> <td class="num">1<\/td><td class="num">3<\/td>/);
    assert.match(H.classStats.cells(S, null, "4b"), /–/);
    const sum = H.classSummaryHtml([{ s: S, result: R }, { s: { ...S, id: "m2" }, result: R }], "4b");
    assert.match(sum, /🙈 Kurragömma – /);
    assert.match(sum, /Klassens svåraste uppgifter/);
    assert.ok(sum.includes("7 × 8"));
    assert.equal(H.classSummaryHtml([], "4b"), "");
  });
});

describe("Vissla-panelen – ren logik (kgp-logik.js)", () => {
  it("syns bara i lärarens fönster, i letfasen, medan matchen pågår, med en riktig server", () => {
    const bas = { screen: false, fas: "leta", phase: "live", harServer: true };
    assert.equal(visslaPanelSynlig(bas), true);
    assert.equal(visslaPanelSynlig({ ...bas, screen: true }), false, "aldrig i elevskärmsfönstret");
    assert.equal(visslaPanelSynlig({ ...bas, fas: "gom" }), false);
    assert.equal(visslaPanelSynlig({ ...bas, phase: "finished" }), false);
    assert.equal(visslaPanelSynlig({ ...bas, harServer: false }), false, "demot saknar kgLarareVissla");
    assert.equal(visslaPanelSynlig(), false);
  });
  it("feltexter och listan", () => {
    assert.deepEqual(visslaFelText({ code: "resource-exhausted" }), { text: "Vänta några sekunder", bort: false });
    assert.deepEqual(visslaFelText({ code: "failed-precondition" }), { text: "Inte gömd längre", bort: true });
    assert.equal(visslaFelText({ code: "permission-denied" }).bort, false);
    assert.equal(visslaFelText(null).bort, false);
    assert.deepEqual(visslaLista([{ uid: "b", name: "Örjan" }, { uid: "a", name: "" }, { uid: "c", name: "Alma" }]).map((x) => x.uid), ["c", "b", "a"]);
    assert.equal(LARARE_VISSLA_SPARR_MS, 5000);
    assert.ok(LARARE_VISSLA_SPARR_MS < VISSLING_SPARR_MS);
  });
});

describe("filkraven (#840)", () => {
  const filer = readdirSync(MAPP).filter((f) => f.endsWith(".js") || f.endsWith(".css"));
  it("≤ 400 rader, CSS-prefix kg- (kgp-/kgh-/kge-), inga Emoji 13+", () => {
    for (const f of [...filer, "kurragomma-vissling.js", "kurragomma-resultat.js", "kurragomma-tick.js"]) {
      const p = f.startsWith("kurragomma-vissling") || f === "kurragomma-resultat.js" || f === "kurragomma-tick.js" ? `functions/${f}` : `${MAPP}/${f}`;
      const src = readFileSync(p, "utf8");
      assert.ok(src.split("\n").length <= 401, `${p} över 400 rader`);
      assert.doesNotMatch(src, /[\u{1FA70}-\u{1FAFF}]/u, `${p}: Emoji 13+`);
    }
    for (const f of ["kurragomma-historik.css", "kurragomma-projektor.css"]) {
      const css = readFileSync(`${MAPP}/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const [, cls] of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
        if (/^\d/.test(cls)) continue;
        assert.ok(/^(kg[pha]?(-|$)|live-|lp-)/.test(cls), `${f}: klassen .${cls} saknar kg-prefix`);
      }
    }
  });
  it("historiken, panelen och datalagret laddas bara lätt; functions/kurragomma är synkad; index.js exporterar kgLarareVissla", () => {
    const index = readFileSync(`${MAPP}/index.js`, "utf8");
    assert.match(index, /historyRenderer: \(\) => import\("\.\/kurragomma-history\.js"\)/);
    assert.doesNotMatch(index, /kgp-vissla|kurragomma-data|kurragomma-history\.js"\s*;/);
    assert.match(readFileSync(`${MAPP}/kgp-on.js`, "utf8"), /import\("\.\/kgp-vissla\.js"\)/);
    assert.equal(readFileSync(`${MAPP}/delat/kg-config.js`, "utf8"), readFileSync("functions/kurragomma/kg-config.js", "utf8"), "npm run sync:kurragomma");
    assert.equal(readFileSync(`${MAPP}/delat/kg-regler.js`, "utf8"), readFileSync("functions/kurragomma/kg-regler.js", "utf8"));
    assert.match(readFileSync("functions/index.js", "utf8"), /export const kgLarareVissla = kurragommaCall\("kgLarareVissla"/);
    assert.match(readFileSync("package.json", "utf8"), /functions-kurragomma-vissla\.test\.mjs/);
    assert.match(readFileSync("package.json", "utf8"), /firestore-rules-live-kurragomma-840\.test\.js/);
  });
});
