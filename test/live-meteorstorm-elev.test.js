// ============================================================================
// Meteorstormen D (#823) utan emulator: lärarformuläret och sessionen
// (ms-setup.js), resultatet + pluggmynten (ms-avslut.js), elevskärmens logik
// (ms-elev.js), lobby/slutskärmen (ms-skarmar.js – ingen placering som
// nummer), historiken (meteorstorm-history.js) och elevdemot
// (ms-elev-demo.js: låtsasservern med formatets riktiga regler + elevklienten
// ms-klient.js). Elevskärmens DOM (ms-elev-vy.js) körs i förhandsvisningen
// preview/preview-meteorstorm-elev.html.
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import METEORSTORM from "../src/live/formats/meteorstorm/index.js";
import { getFormat, registerFormat, validateFormat, answerKindsFor } from "../src/live/live-formats.js";
import { requireGameMode } from "../src/live/modes/index.js";
import {
  validateSetup, buildSessionFields, sessionTitle, defaultSessionName, prepareCreate, MS_CUSTOM_MIN,
} from "../src/live/formats/meteorstorm/ms-setup.js";
import { avslutaOchBetala, buildResult } from "../src/live/formats/meteorstorm/ms-avslut.js";
import {
  knappar, energiVinst, tangentTyp, kvittens, handelseRad, slutet, bidragText, myntRader, dragFinns, decimal, planCfg,
  stageAction, lagesRad, valTangent, medKvitto, stationRad, VAL_SPARR_MS,
} from "../src/live/formats/meteorstorm/ms-elev.js";
import { endHtml, lobbyHtml } from "../src/live/formats/meteorstorm/ms-skarmar.js";
import { stationSvg, matareHtml } from "../src/live/formats/meteorstorm/ms-station-mini.js";
import { createMsElevDemo } from "../src/live/formats/meteorstorm/ms-elev-demo.js";
import { stormPlan } from "../src/live/formats/meteorstorm/delat/ms-agera.js";

const MULT = requireGameMode("multiplication_0_10");
const QUIZ = requireGameMode("plugga_quiz");
const DIR = new URL("../src/live/formats/meteorstorm/", import.meta.url);
const MINE = ["index.js", "ms-format-elev.js", "ms-setup.js", "ms-avslut.js", "ms-elev.js", "ms-elev-vy.js", "ms-skarmar.js",
  "ms-station-mini.js", "ms-elev-demo.js", "meteorstorm-student.js", "meteorstorm-history.js"];
const INPUT = {
  name: "Storm 4B", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
  classIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" }, durationMin: 10, lage: "klass-mot-klass", attacker: "milda",
  rewards: { firstPrize: 300, perCorrect: 5, cap: 300 },
};
// Reglernas msSettingsOk (firestore.rules "Meteorstormen") – fälten sessionen får ha.
const RULES_KEYS = ["name", "format", "gameMode", "answerKind", "participatingClassIds", "classNames", "durationSeconds",
  "countdownSeconds", "status", "createdBy", "createdByName", "createdAt", "msSeed", "msInstallningar", "msStationer", "showNames",
  "quiz", "questionCount", "rewards", "startedAt", "endsAt", "finishedAt", "result"];

describe("formatobjektet (#823-delarna)", () => {
  it("uppfyller interfacet; spellägen multiplikation + quiz; vyerna laddas latt", () => {
    assert.deepEqual(validateFormat(METEORSTORM), []);
    assert.equal(METEORSTORM.compatibleGameModes(MULT), true);
    assert.equal(METEORSTORM.compatibleGameModes(QUIZ), true);
    assert.deepEqual(answerKindsFor(METEORSTORM, QUIZ), ["choice"]);
    for (const fn of ["studentView", "historyRenderer", "projectorViews", "resultInputs", "prepareCreate"]) assert.equal(typeof METEORSTORM[fn], "function");
    assert.deepEqual(METEORSTORM.setupFields.map((f) => f.key), ["lage", "attacker", "durationMin", "showNames", "rewards"]);
  });
  it("max 400 rader per fil och egna CSS-prefix (mse-/msh-, inga delade klasser)", () => {
    for (const f of readdirSync(DIR).filter((x) => /\.(js|css)$/.test(x))) {
      assert.ok(readFileSync(new URL(f, DIR), "utf8").split("\n").length <= 400, f);
    }
    for (const css of ["meteorstorm-elev.css", "meteorstorm-historik.css"]) {
      const klasser = readFileSync(new URL(css, DIR), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").match(/\.[a-z][\w-]*/g) || [];
      const egna = klasser.filter((k) => !/^\.(mse|msh)-/.test(k));
      // Kärnans ramar (live-elev-*) och de återanvända komponenterna (fa-/ca-/tl-) stylas bara inuti .mse-elev-vy.
      assert.deepEqual(egna.filter((k) => !/^\.(live-elev|fa-|ca-|tl-|pa$|ok$|fel$)/.test(k)), [], css);
    }
  });
  it("bootgrafen: ingen av D:s filer importeras statiskt utanför formatmappen", () => {
    const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    assert.equal(/meteorstorm/.test(app), false);
    const vyer = readFileSync(new URL("ms-format-elev.js", DIR), "utf8");
    assert.match(vyer, /import\("\.\/meteorstorm-student\.js"\)/);
    assert.match(vyer, /import\("\.\/meteorstorm-history\.js"\)/);
    for (const f of MINE) assert.ok(readdirSync(DIR).includes(f), f);
  });
});

describe("lärarformuläret och sessionen (ms-setup.js, spec §2.6)", () => {
  it("giltiga inställningar ger inga fel – också En klass med en klass", () => {
    assert.deepEqual(METEORSTORM.validateSetup(INPUT), []);
    assert.deepEqual(validateSetup({ ...INPUT, classIds: ["4b"], lage: "en-klass" }), []);
  });
  it("läget måste passa klasserna, speltid 5–20, attacker och spelläge", () => {
    assert.match(validateSetup({ ...INPUT, classIds: ["4b"] }).join(), /två klasser/);
    assert.match(validateSetup({ ...INPUT, lage: "en-klass" }).join(), /bara en/);
    for (const d of [4, 21, "", "x", 7.5]) assert.ok(validateSetup({ ...INPUT, durationMin: d }).length, String(d));
    for (const d of [5, 12, 20, "15"]) assert.deepEqual(validateSetup({ ...INPUT, durationMin: d }), [], String(d));
    assert.ok(validateSetup({ ...INPUT, attacker: "galna" }).length);
    assert.ok(validateSetup({ ...INPUT, gameMode: "division" }).length);
    assert.ok(METEORSTORM.validateSetup({ ...INPUT, rewards: { firstPrize: 5000 } }).length);
    assert.deepEqual(MS_CUSTOM_MIN, { min: 5, max: 20 });
  });
  it("sessionens fält: frö 0–2³¹−1, En klass sparas utan attacker, namn på som standard", () => {
    const f = buildSessionFields(INPUT);
    assert.ok(Number.isInteger(f.msSeed) && f.msSeed >= 0 && f.msSeed <= 2147483647);
    assert.deepEqual(f.msInstallningar, { lage: "klass-mot-klass", attacker: "milda" });
    assert.equal(f.showNames, true);
    assert.deepEqual(buildSessionFields({ ...INPUT, lage: "en-klass", attacker: "vilda", showNames: false }).msInstallningar, { lage: "en-klass", attacker: "av" });
    assert.equal(buildSessionFields({ ...INPUT, showNames: false }).showNames, false);
    assert.equal(buildSessionFields(INPUT, () => 0.5).msSeed, 1073741824);
    assert.notEqual(buildSessionFields(INPUT).msSeed, buildSessionFields(INPUT).msSeed);
  });
  it("buildSessionDoc: bara fält som reglerna (msSettingsOk) godtar, speltid i hela minuter", async () => {
    if (!getFormat("meteorstorm")) registerFormat(METEORSTORM);
    const { buildSessionDoc } = await import("../src/live/live-core.js");
    const d = buildSessionDoc(INPUT, { uid: "larare1" });
    assert.equal(d.format, "meteorstorm");
    assert.equal(d.durationSeconds, 600);
    assert.deepEqual(d.rewards, { firstPrize: 300, perCorrect: 5, cap: 300 });
    assert.deepEqual(Object.keys(d).filter((k) => !RULES_KEYS.includes(k)), []);
  });
  it("rubrik och namnförslag", () => {
    assert.equal(sessionTitle({ participatingClassIds: ["4b", "4d"], classNames: { "4b": "4b", "4d": "4D" } }), "4B MOT 4D");
    assert.equal(defaultSessionName(["4B", "4D"]), "Meteorstormen 4B mot 4D");
    assert.equal(defaultSessionName([]), "Meteorstormen");
  });
  it("prepareCreate: quiz → frågor utan facit + facit i samma batch; multiplikation → inget", async () => {
    assert.deepEqual(await prepareCreate(INPUT, { gameMode: "multiplication_0_10" }), { data: {}, subdocs: [] });
    const quiz = [
      { question: "Huvudstad i Norge?", options: ["Oslo", "Bergen", "Malmö", "Åbo"], answerIndex: 0, category: "geo" },
      { question: "2 + 2?", options: ["3", "4", "5", "6"], answerIndex: 1 },
    ];
    const r = await prepareCreate(INPUT, { gameMode: "plugga_quiz", quiz: { subjectId: "s", areaId: "a" } },
      { getArea: async () => ({ quiz }), rng: () => 0.3 });
    assert.equal(r.data.questionCount, 2);
    assert.deepEqual(r.subdocs.map((x) => x.path.join("/")), ["msPublic/questions", "msPrivate/snapshot"]);
    assert.equal(JSON.stringify(r.subdocs[0].data).includes("answerIndex"), false, "facit läcker inte till elevernas dokument");
    assert.equal(r.subdocs[1].data.facit.length, 2);
  });
});

describe("resultatet och pluggmynten (ms-avslut.js)", () => {
  const RES = { format: "meteorstorm", winner: "4b", rewards: { u1: { rank: 1, correct: 3, prize: 300, correctCoins: 15, total: 315 } } };
  it("msAvsluta och sedan utbetalning med serverns result (status finished)", async () => {
    const anrop = [];
    const deps = { avsluta: async (sid) => { anrop.push(["avsluta", sid]); return { result: RES, redan: false }; },
      settle: async (sid, s) => { anrop.push(["settle", sid, s.status, s.result]); } };
    assert.equal(await avslutaOchBetala({ id: "s1", status: "live" }, deps), RES);
    assert.deepEqual(anrop, [["avsluta", "s1"], ["settle", "s1", "finished", RES]]);
  });
  it("demo och result utan mynt betalar inget; ett fel från servern kastas vidare", async () => {
    let betalt = 0;
    const deps = (r) => ({ avsluta: async () => ({ result: r }), settle: async () => { betalt++; } });
    await avslutaOchBetala({ id: "s1", demo: true }, deps(RES));
    await avslutaOchBetala({ id: "s1" }, deps({ ...RES, rewards: undefined }));
    assert.equal(betalt, 0);
    await assert.rejects(avslutaOchBetala({ id: "s1" }, { avsluta: async () => { throw new Error("nät"); }, settle: async () => {} }));
  });
  it("#823 F2: klassbonus (bara anropet som SKREV result), pokaler och kassapris som i live-data.js – bara admin, aldrig demo", async () => {
    const R2 = { ...RES, perClass: { "4b": { players: 3 }, "4d": { players: 2 } } };
    const rigg = (redan, admin = true) => {
      const anrop = [];
      const klass = async () => ({
        liveKlassBonus: async (r) => { anrop.push(["bonus", r]); return 1; },
        pokalerEfterAvslut: async (kalla, id, doc) => { anrop.push(["pokaler", kalla, id, doc.status, doc.result]); return []; },
        livePrisEfterAvslut: async (id, doc) => { anrop.push(["pris", id, doc.status]); return []; },
      });
      return { anrop, deps: { avsluta: async () => ({ result: R2, redan }), settle: async () => anrop.push(["settle"]), admin: () => admin, klass } };
    };
    let r = rigg(false);
    await avslutaOchBetala({ id: "s1", status: "live" }, r.deps);
    assert.deepEqual(r.anrop, [["settle"], ["bonus", R2], ["pokaler", "live", "s1", "finished", R2], ["pris", "s1", "finished"]]);
    r = rigg(true);
    await avslutaOchBetala({ id: "s1" }, r.deps);
    assert.deepEqual(r.anrop.map((a) => a[0]), ["settle", "pokaler", "pris"], "result fanns redan → ingen andra klassbonus");
    r = rigg(false, false);
    await avslutaOchBetala({ id: "s1" }, r.deps);
    assert.deepEqual(r.anrop.map((a) => a[0]), ["settle"], "årskurskonto: klasscentret skriver bara admin (som kärnan)");
    r = rigg(false);
    await avslutaOchBetala({ id: "s1", demo: true }, r.deps);
    assert.deepEqual(r.anrop, []);
    const fel = rigg(false);
    fel.deps.klass = async () => { throw new Error("laddning"); };
    assert.equal(await avslutaOchBetala({ id: "s1" }, fel.deps), R2, "klasscentret kastar aldrig vidare");
  });
  it("buildResult lämnar serverns result orört; utan det ett tomt utan mynt", () => {
    assert.equal(buildResult({}, [], [], MULT, { result: RES }), RES);
    const tomt = buildResult({ msInstallningar: { lage: "en-klass" } }, [], [{ uid: "a" }], MULT, undefined);
    assert.equal(tomt.format, "meteorstorm");
    assert.equal(tomt.rewards, undefined);
    assert.equal(tomt.winner, null);
  });
});

describe("elevskärmens logik (ms-elev.js, spec §5)", () => {
  const KMK = { participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" }, msInstallningar: { lage: "klass-mot-klass", attacker: "milda" } };
  const status = (drag = {}, x = {}) => ({ stationer: [
    { classId: "4b", skrov: 82, skold: 33.6, laddning: 3.1, flyter: false, hjalp: false, drag: { tillaten: true, kostnad: 3, armerad: false, redoMs: null, ...drag }, ...x },
    { classId: "4d", skrov: 64, skold: 10, laddning: 0, flyter: false, hjalp: false, drag: { tillaten: true, kostnad: 3, armerad: false, redoMs: null } },
  ] });
  const kn = (opts) => Object.fromEntries(knappar({ classId: "4b", session: KMK, now: 1000, ...opts }).map((k) => [k.typ, k]));

  it("knapparna: kostnad, gråa utan råd, dragstrålens nedräkning och 'på väg'", () => {
    let k = kn({ energi: 0, vinst: 1, status: status() });
    assert.deepEqual([k.skold.kan, k.laser.kan, k.drag.kan], [true, true, false]);
    assert.equal(k.drag.info, "⚡ 3");
    k = kn({ energi: 2, vinst: 1, status: status() });
    assert.equal(k.drag.kan, true);
    k = kn({ energi: 4, vinst: 1, status: status({ redoMs: 7400 }) });
    assert.equal(k.drag.kan, false);
    assert.equal(k.drag.info, "om 7 s");
    assert.equal(kn({ energi: 4, status: status({ armerad: true }) }).drag.info, "på väg …");
    assert.equal(kn({ energi: 1, vinst: 1, status: status({ kostnad: 2 }) }).drag.kan, true, "hjälpen: dragstrålen kostar 2");
  });
  it("ingen dragstråle i En klass eller med Attacker av", () => {
    const typer = (session) => knappar({ energi: 5, status: status(), classId: "4b", session }).map((k) => k.typ);
    assert.deepEqual(typer(KMK), ["skold", "laser", "drag"]);
    assert.deepEqual(typer({ ...KMK, msInstallningar: { lage: "klass-mot-klass", attacker: "av" } }), ["skold", "laser"]);
    assert.deepEqual(typer({ participatingClassIds: ["4b"], msInstallningar: { lage: "en-klass", attacker: "av" } }), ["skold", "laser"]);
    assert.equal(dragFinns({ ...KMK, msInstallningar: { lage: "klass-mot-klass", attacker: "vilda" } }), true);
  });
  it("genvägarna 1/2/3 och mellanslag; inga med Ctrl/Alt eller upprepning", () => {
    assert.equal(tangentTyp({ key: "1", code: "Digit1" }), "skold");
    assert.equal(tangentTyp({ key: "2", code: "Numpad2" }), "laser");
    assert.equal(tangentTyp({ key: "3" }), "drag");
    assert.equal(tangentTyp({ key: " ", code: "Space" }), "spara");
    assert.equal(tangentTyp({ key: "4", code: "Digit4" }), null);
    assert.equal(tangentTyp({ key: "1", ctrlKey: true }), null);
    assert.equal(tangentTyp({ key: "1", repeat: true }), null);
  });
  it("#823 F1: valets tangenter gäller även när flervalet redan förhindrat dem (capture-fasen)", () => {
    const e = { key: "2", code: "Digit2", defaultPrevented: true };
    assert.equal(valTangent(e, { lage: "val", shownAt: 0, nu: 5000 }), "laser");
    assert.equal(valTangent(e, { lage: "fraga", shownAt: 0, nu: 5000 }), null, "under frågan: frågekomponentens tangent");
    assert.equal(valTangent(e, { lage: "val", shownAt: 5000, nu: 5000 + VAL_SPARR_MS - 1 }), null, "samma tryck som svarade");
    const vy = readFileSync(new URL("ms-elev-vy.js", DIR), "utf8");
    assert.match(vy, /addEventListener\("keydown", onKey, true\)/);
    assert.match(vy, /removeEventListener\("keydown", onKey, true\)/);
    assert.equal(/defaultPrevented/.test(vy.replace(/\/\/.*$/gm, "")), false);
  });
  it("#823 F3: valet fokuserar rutan, inte Sköld; klick direkt efter att valet visats räknas inte", () => {
    const vy = readFileSync(new URL("ms-elev-vy.js", DIR), "utf8");
    assert.match(vy, /parts\.val\.focus\(/);
    assert.equal(/\.mse-knapp:not\(\[disabled\]\)"\)\?\.focus/.test(vy), false);
    assert.match(vy, /Date\.now\(\) - shownAt >= VAL_SPARR_MS\) valj/);
  });
  it("#823 F6: toppraden visar samma sköld som kvittensen", () => {
    const st = status();
    const res = { correct: true, typ: "skold", effekt: { skold: 0.64 }, energi: 0, status: st };
    const efter = medKvitto(st, res, "4b");
    assert.match(kvittens(res, { classId: "4b", session: KMK }).text, /skölden 34\/60/);
    assert.match(stationRad(efter.stationer[0]), /Sköld 34\/60/);
    assert.equal(efter.stationer[1], st.stationer[1], "den andra stationen orörd");
    assert.equal(medKvitto(st, { ...res, nekad: "energi" }, "4b"), st);
    assert.equal(medKvitto(st, { correct: true, typ: "laser", effekt: { laser: 0.077 } }, "4b").stationer[0].laddning, 3.177);
  });
  it("kvittensen ur msAgera-svaret: sköldmätaren, lasern, dragstrålens mål, sparad/nekad energi", () => {
    const k = (res) => kvittens({ correct: true, status: status(), ...res }, { classId: "4b", session: KMK })?.text;
    assert.equal(k({ typ: "skold", effekt: { skold: 0.64 }, energi: 0 }), "🛡️ +0,6 – skölden 34/60");
    assert.equal(k({ typ: "laser", effekt: { laser: 0.077 }, energi: 0 }), "🔫 Lasern laddas – 3,2 skott redo");
    assert.match(k({ typ: "drag", energi: 0 }), /slungar den mot 4D!/);
    assert.equal(k({ typ: "spara", energi: 3 }), "⚡ Energin sparad – du har 3.");
    assert.match(k({ typ: "spara", energi: 5 }), /Full energi/);
    assert.equal(k({ typ: "spara", onskad: "drag", nekad: "vantetid", energi: 2 }), "🌀 Dragstrålen laddar om – energin sparad.");
    assert.match(k({ typ: "skold", effekt: { skold: 0.6 }, handelse: "solstorm" }), /^☀️ Dubbel energi!/);
    assert.equal(kvittens({ correct: false }), null);
    assert.equal(decimal(3), "3");
  });
  it("händelserna och energins vinst räknas ur fröet (samma plan som servern), annars ur status", () => {
    const s = { ...KMK, msSeed: 4711, startedAt: 1_000_000, countdownSeconds: 4, durationSeconds: 600 };
    const cfg = planCfg(s);
    assert.equal(cfg.startMs, 1_004_000);
    const h = stormPlan(cfg).handelser.find((x) => x.typ === "solstorm") || stormPlan(cfg).handelser[0];
    const mitt = cfg.startMs + h.startMs + 1000;
    assert.equal(handelseRad(null, mitt, cfg).typ, h.typ);
    assert.match(handelseRad(null, mitt, cfg).text, / s$/);
    if (h.typ === "solstorm") assert.equal(energiVinst(null, mitt, cfg), 2);
    assert.equal(energiVinst(null, cfg.startMs + 1000, cfg), 1);
    assert.equal(planCfg({ msSeed: 1 }), null, "före start: ingen plan");
    assert.equal(energiVinst({ handelse: { typ: "kometsvans", slutMs: 5000 } }, 1000), 2);
    assert.equal(handelseRad({ handelse: { typ: "lugnet", slutMs: 1000 } }, 2000), null);
  });
  it("läget: flyter i rymden och extra kraft (inget om fel svar)", () => {
    assert.match(lagesRad({ flyter: true }), /flyter i rymden/);
    assert.match(lagesRad({ hjalp: true }, "4D"), /4D får extra kraft/);
    assert.equal(lagesRad({ skrov: 50 }), "");
    assert.equal(stageAction("countdown"), "lobby");
    assert.equal(stageAction("ended"), "slut");
  });
});

describe("slutskärmen – ingen placering som nummer (ms-skarmar.js)", () => {
  const S = { id: "s1", participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" },
    msInstallningar: { lage: "klass-mot-klass", attacker: "milda" }, rewards: { firstPrize: 300, perCorrect: 5, cap: 300 } };
  const R = {
    lage: "klass-mot-klass", winner: "4d", draw: false,
    placering: [{ classId: "4d", skrov: 71, nedskjutna: 30, plats: 1 }, { classId: "4b", skrov: 40, nedskjutna: 25, plats: 2 }],
    ranking: [{ uid: "u1", classId: "4b", correct: 12, answered: 15, handlingar: { skold: 5, laser: 6, drag: 1, spara: 0 }, bidrag: { nedskjutna: 7, kast: 1 } }],
    rewards: { u1: { rank: 2, correct: 12, prize: 255, correctCoins: 60, total: 315 } },
  };
  it("förlust: 'Bra kämpat – 4D vann den här gången', eget bidrag och mynten utan '2:a'", () => {
    const html = endHtml({ phase: "finished", session: S, result: R }, { uid: "u1" }, "4b");
    assert.match(html, /Bra kämpat – 4D vann den här gången/);
    assert.match(html, /Du sköt ner 7 meteorer, laddade skölden 5 gånger och slungade 1 meteor med dragstrålen\./);
    assert.match(html, /Stationens pris/);
    assert.match(html, /Totalt: <b>315<\/b>/);
    assert.equal(/\d+:[ae]\b|plats|🥈|Du kom/.test(html), false, "ingen placering som nummer");
  });
  it("vinst, oavgjort, En klass med stjärnor och utan, innan result finns", () => {
    assert.match(endHtml({ phase: "finished", session: S, result: R }, { uid: "u1" }, "4d"), /Ni vann! 🚀/);
    assert.match(endHtml({ phase: "finished", session: S, result: { ...R, winner: null, draw: true } }, { uid: "u1" }, "4b"), /Oavgjort/);
    const en = { lage: "en-klass", placering: [{ classId: "4b", skrov: 62, nedskjutna: 9, plats: 1 }], stjarnor: 2, overlevde: true, ranking: R.ranking };
    const html = endHtml({ phase: "finished", session: { ...S, participatingClassIds: ["4b"] }, result: en }, { uid: "u1" }, "4b");
    assert.match(html, /Stationen överlevde stormen!/);
    assert.match(html, /⭐⭐☆/);
    assert.match(endHtml({ phase: "finished", session: S, result: { ...en, stjarnor: 0, overlevde: false } }, { uid: "u1" }, "4b"), /flyter i rymden/);
    assert.match(endHtml({ phase: "ended", session: S, result: null }, { uid: "u1" }, "4b"), /Stormen är över/);
    assert.match(endHtml({ phase: "cancelled", session: S }, { uid: "u1" }, "4b"), /avbröts/);
  });
  it("bidraget och myntens rader", () => {
    assert.equal(bidragText({ correct: 3, handlingar: { spara: 3 }, bidrag: {} }), "Du svarade rätt 3 gånger och sparade energin.");
    assert.equal(bidragText({ correct: 0, handlingar: {}, bidrag: {} }), "Varje rätt svar ger stationen energi – nästa storm är din! 🚀");
    assert.equal(bidragText({ handlingar: { laser: 1 }, bidrag: {} }), "Du laddade lasern en gång.");
    assert.deepEqual(myntRader({ prize: 100, correct: 4, correctCoins: 20 }, "en-klass").map((r) => r.label), ["⭐ Stjärnpris", "4 rätt svar"]);
    assert.deepEqual(myntRader(null), []);
  });
  it("lobbyn visar dragstrålen bara när den finns; den lilla stationen följer skadenivåerna", () => {
    assert.match(lobbyHtml(S), /Dragstråle/);
    assert.equal(/Dragstråle/.test(lobbyHtml({ ...S, msInstallningar: { lage: "en-klass", attacker: "av" } })), false);
    assert.match(stationSvg({ skrov: 100, skold: 60 }), /mse-st-hel/);
    assert.match(stationSvg({ skrov: 100, skold: 60 }), /mse-st-bubbla/);
    assert.equal(/mse-st-bubbla/.test(stationSvg({ skrov: 40, skold: 0 })), false);
    assert.match(stationSvg({ skrov: 40 }), /mse-st-sprickor/);
    assert.match(stationSvg({ skrov: 0, flyter: true }), /mse-st-flyter/);
    assert.match(matareHtml({ namn: "4D", skrov: 20 }), /mse-matare-lag/);
    assert.match(matareHtml({ namn: "4D", skrov: null }), /väntar/);
  });
});

describe("elevdemot (ms-elev-demo.js): låtsasservern + elevklienten", () => {
  function match(opts = {}) {
    // Klockan går som vanligt (spärrens väntan) + hopp framåt.
    let t = 5_000_000 - Date.now();
    const d = createMsElevDemo({ klocka: () => Date.now() + t, latens: () => 0, ...opts });
    const k = d.api.skapaKlient({ sid: d.session.id, uid: "jag", seed: d.session.msSeed, gameMode: d.session.gameMode, antalFragor: d.session.questionCount || 0 });
    return { d, k, fram: (ms) => { t += ms; } };
  }
  it("svar + handling i ETT anrop; fel svar buffras; energin, effekten och statusen kommer i svaret", async () => {
    const { d, k, fram } = match();
    fram(30_000);
    const src = k.kalla();
    let q = src.next();
    assert.equal((await k.svara({ attemptId: "a1-xxxxxxx", factorA: q.a, factorB: q.b, answer: String(q.a * q.b + 1) })).correct, false);
    q = src.next();
    assert.equal((await k.svara({ attemptId: "a2-xxxxxxx", factorA: q.a, factorB: q.b, answer: String(q.a * q.b) })).correct, true);
    const r = await k.agera("skold");
    assert.equal(r.typ, "skold");
    assert.equal(r.energi, 0);
    assert.ok(r.effekt.skold > 0);
    assert.equal(r.status.stationer.length, 2);
    assert.equal(k.buffert.length, 0, "felsvaret följde med anropet");
    assert.ok(d.handlingar().some((h) => h.uid === "jag" && h.typ === "skold"));
  });
  it("snabbhetsspärren: för tätt → klienten väntar och försöker igen (ingen felruta)", async () => {
    const { k, fram } = match();
    fram(30_000);
    const src = k.kalla();
    for (let i = 0; i < 2; i++) {
      const q = src.next();
      await k.svara({ attemptId: `b${i}-xxxxxxx`, factorA: q.a, factorB: q.b, answer: String(q.a * q.b) });
      assert.equal((await k.agera("spara")).correct, true);
    }
    assert.equal(k.energi, 2);
  });
  it("dragstrålen kostar 3 – med för lite energi blir den sparad energi (nekad: energi)", async () => {
    const { k, fram } = match();
    fram(30_000);
    const q = k.kalla().next();
    await k.svara({ attemptId: "c1-xxxxxxx", factorA: q.a, factorB: q.b, answer: String(q.a * q.b) });
    const r = await k.agera("drag");
    assert.equal(r.typ, "spara");
    assert.equal(r.nekad, "energi");
    assert.equal(r.energi, 1);
  });
  it("hela matchen: simulerade klasser, msAvsluta-resultatet och mynten (demo betalar aldrig)", () => {
    const { d, fram } = match();
    fram(11 * 60_000);
    const r = d.avsluta();
    assert.equal(d.session.demo, true);
    assert.equal(r.placering.length, 2);
    assert.ok(r.totalCorrect > 300, "eleverna svarade");
    assert.ok(r.perQuestion.length > 10);
    assert.ok(Object.keys(r.rewards).length >= 40);
    assert.equal(d.avsluta(), r, "idempotent");
    // #823 F4: handlingar per klass som serverns perClass (sparat med).
    for (const t of ["skold", "laser", "drag", "spara"]) {
      assert.equal(r.perClass["4b"].handlingar[t] + r.perClass["4d"].handlingar[t], r.handlingar[t], t);
    }
  });
  it("En klass: stjärnor, ingen dragstråle hos de simulerade eleverna", () => {
    const { d, fram } = match({ lage: "en-klass" });
    fram(11 * 60_000);
    const r = d.avsluta();
    assert.equal(r.lage, "en-klass");
    assert.ok(r.stjarnor >= 0 && r.stjarnor <= 3);
    assert.equal(d.handlingar().filter((h) => h.typ === "drag").length, 0);
  });
  it("deterministisk: samma frö och klocka → samma storm och samma resultat", () => {
    const fast = (opts) => {
      let t = 5_000_000;
      const d = createMsElevDemo({ klocka: () => t, latens: () => 0, ...opts });
      return { d, fram: (ms) => { t += ms; } };
    };
    const a = fast();
    const b = fast();
    a.fram(11 * 60_000);
    b.fram(11 * 60_000);
    assert.deepEqual(a.d.avsluta().placering, b.d.avsluta().placering);
  });
});

describe("historiken och Statistik → Live (meteorstorm-history.js)", () => {
  const HOOK = `export async function resolve(spec, ctx, next) {
    if (spec.endsWith("/teacher-shared.js")) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(
      "export const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;');") };
    if (spec.endsWith("/live-css.js")) return { shortCircuit: true, url: "data:text/javascript,export function ensureLiveCss(){}" };
    return next(spec, ctx);
  }`;
  let H;
  let S;
  let R;
  before(async () => {
    register(`data:text/javascript,${encodeURIComponent(HOOK)}`);
    H = await import("../src/live/formats/meteorstorm/meteorstorm-history.js");
    let t = 9_000_000;
    const d = createMsElevDemo({ klocka: () => t, latens: () => 0 });
    t += 11 * 60_000;
    R = d.avsluta();
    S = { ...d.session, status: "finished" };
  });
  it("matchraden: vinnaren, oavgjort, En klass med stjärnor", () => {
    assert.match(H.winnerText(S, R), R.winner ? /☄️ 4[BD]/ : /Oavgjort/);
    assert.equal(H.winnerText(S, { ...R, winner: null, draw: true }), "🤝 Oavgjort");
    assert.equal(H.winnerText(S, { lage: "en-klass", placering: [{ classId: "4b" }], stjarnor: 3, overlevde: true }), "⭐⭐⭐ 4B");
    assert.equal(H.winnerText(S, null), "–");
  });
  it("en match: skrov per klass, handlingar per sort, andel rätt per elev och per fråga, pluggmynt", () => {
    const html = H.detailHtml(S, R);
    for (const id of ["4b", "4d"]) assert.ok(html.includes(`${Math.floor(R.placering.find((p) => p.classId === id).skrov)} %</b> skrov kvar`));
    assert.match(html, /Handlingar/);
    assert.ok(html.includes(`<b>${R.handlingar.skold.toLocaleString("sv-SE")}</b>`));
    assert.match(html, /Andel rätt per uppgift/);
    assert.match(html, /Andel rätt per tabell/);
    assert.match(html, /Pluggmynt/);
    assert.equal(/<th[^>]*>Plats<\/th>/.test(html), false, "elevtabellen har ingen placeringskolumn");
    assert.equal((html.match(/<tr><th scope="row">/g) || []).length >= R.ranking.length, true);
    assert.match(H.detailHtml(S, null), /Inget resultat ännu/);
  });
  it("Statistik → Live: Rätt · Skrov · Utfall per klass och sammanfattningen; playerCounts ur result", () => {
    assert.equal(H.classStats.cols, 3);
    const cells = H.classStats.cells(S, R, "4b");
    assert.match(cells, new RegExp(`${Math.floor(R.placering.find((p) => p.classId === "4b").skrov)} %`));
    assert.match(cells, R.winner === "4b" ? /Vann/ : /av 2|Oavgjort/);
    assert.match(H.classStats.cells(S, null, "4b"), /–/);
    assert.match(H.classSummaryHtml([{ s: S, result: R }], "4b"), /Meteorstormen – /);
    const pc = H.playerCounts(S, R);
    const row = R.ranking.find((p) => p.answered > 0);
    assert.deepEqual(pc.get(row.uid), { correct: row.correct, incorrect: row.answered - row.correct });
    assert.equal(H.ownPlayerTable, true);
  });
  it("#823 G1: settle(s) delar ut pokalerna och kassapriset (idempotenta) – aldrig klassbonusen, bara admin, aldrig demo/utan result", async () => {
    const rigg = (admin = true) => {
      const anrop = [];
      const deps = { admin: () => admin, klass: async () => ({
        liveKlassBonus: async () => anrop.push(["bonus"]),
        pokalerEfterAvslut: async (kalla, id, doc) => anrop.push(["pokaler", kalla, id, doc.result === R]),
        livePrisEfterAvslut: async (id, doc) => anrop.push(["pris", id, doc.result === R]),
      }) };
      return { anrop, deps };
    };
    const klar = { ...S, demo: false, status: "finished", result: R };
    let r = rigg();
    await H.settle(klar, r.deps);
    assert.deepEqual(r.anrop, [["pokaler", "live", S.id, true], ["pris", S.id, true]]);
    for (const [s, admin] of [[klar, false], [{ ...klar, demo: true }, true], [{ ...klar, result: null }, true], [{ ...klar, status: "live" }, true]]) {
      r = rigg(admin);
      await H.settle(s, r.deps);
      assert.deepEqual(r.anrop, []);
    }
    r = rigg();
    r.deps.klass = async () => { throw new Error("laddning"); };
    await H.settle(klar, r.deps); // kastar inte
  });
});
