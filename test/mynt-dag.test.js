// ============================================================================
// Dagskvittot myntDag (#853, SAKERHET-MYNT §6 B1) – rena tester (node --test):
//   • mynt-dag.js ↔ firestore.rules: källor, tak per gång/dag, XP-tak, gåvan 8,
//     gårdsdjuren (och ↔ katalogen/farm-core)
//   • taken skär aldrig en legitim utbetalning: största beloppet per källa
//     räknat ur koden ≤ PER_GANG
//   • planTjana + tjanaMyntMed (injicerat SDK): klippning, dokument utan xp,
//     gåvan per djur, omförsök bara över midnatt
//   • ingen elevväg anropar addCoins( längre; bootgrafen 107; ≤ 400 rader
// Reglerna körs skarpt i test/firestore-rules-mynt-dag.test.js.
// ============================================================================

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KALLOR, PER_GANG, PER_DAG, XP_PER_GANG, XP_PER_DAG, GAVA_MYNT, GARDSDJUR, MYNT_DAG_KVITTON,
  MYNT_DAG_TAK_TEXT, grannDag, myntDag, planTjana,
} from "../src/mynt-dag.js";
import { SHOP_ITEMS } from "../src/shop-items.js";
import { FARM_GIFT_COINS } from "../src/farm-core.js";
import { xpForExercise } from "../src/leveling.js";
import { MAX_QUESTIONS_PER_SESSION } from "../src/question-rotation.js";
import { ROUND_SIZE } from "../src/rakna-core.js";
import { myntAv, QUIZ_TIMELINE_MAX } from "../src/timeline/tidsjakt-core.js";
import {
  COINS_PER_CORRECT, AMNES_COINS_PER_CORRECT, AMNES_QUESTIONS_BY_LEVEL, AMNES_QUESTIONS_HARD_MAX, QUESTIONS_MAX,
} from "../src/lasresan/config.js";
import { validateReadingTexts } from "../src/amneslasning/content.js";
import { amnesCoinsFor } from "../src/amneslasning/progress.js";
import { COINS } from "../src/ekvationsresan/config.js";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const rules = read("firestore.rules");
const H = 3600 * 1000;

describe("mynt-dag.js ↔ firestore.rules", () => {
  const fn = /function myntDagOk\(uid, dag\) \{([\s\S]*?)\n    \}/.exec(rules);
  const gava = /function myntDagGavaOk\(d, gavor, efter\) \{([\s\S]*?)\n    \}/.exec(rules);
  const karta = (namn) => {
    const m = new RegExp(`function ${namn}\\(\\) \\{ return \\{([^}]*)\\}; \\}`).exec(rules);
    assert.ok(m, `${namn} saknas i reglerna`);
    return Object.fromEntries([...m[1].matchAll(/'(\w+)': (\d+)/g)].map((x) => [x[1], Number(x[2])]));
  };
  it("match-blocket: läs elev/lärare, skriv bara myntDagOk, radera bara admin", () => {
    assert.match(rules, /match \/myntDag\/\{dag\} \{\s*allow read: if isSelf\(studentId\) \|\| hasStudent\(studentId\);\s*allow create, update: if myntDagOk\(studentId, dag\);\s*allow delete: if isAdmin\(\);/);
    assert.equal(MYNT_DAG_KVITTON, "myntDag");
  });
  it("taken per gång och per dag är samma tal", () => {
    assert.deepEqual(karta("myntPerGang"), { ...PER_GANG });
    assert.deepEqual(karta("myntPerDag"), { ...PER_DAG });
    assert.ok(fn[1].includes(`x <= ${XP_PER_GANG} && d.get('xp', 0) <= ${XP_PER_DAG}`));
  });
  it("källorna, dagen, bindningen till saldot och XP", () => {
    assert.ok(fn[1].includes(`k in [${KALLOR.map((k) => `'${k}'`).join(", ")}]`));
    for (const krav of [
      "isSelf(uid)", "dag == svenskDag(request.time) && d.dag == dag && d.lastAt == request.time",
      "m == d.get(k, 0) - o.get(k, 0)", "x == d.get('xp', 0) - o.get('xp', 0)", "(x == 0 || k == 'ovning')",
      "m + x >= 1", "efter.get('coins', 0) == fore.get('coins', 0) + m", "efter.get('xp', 0) == fore.get('xp', 0) + x",
      "['dag', 'kalla', 'lastAt', 'senastMynt', 'senastXp', 'xp', k, 'gardUid', 'gavor']",
      "['dag', 'kalla', 'lastAt', 'senastMynt', 'senastXp', 'xp', k])",
    ]) assert.ok(fn[1].includes(krav), krav);
  });
  it("gåvan: 8, ett nytt ägt gårdsdjur ur agdaDjur", () => {
    assert.ok(gava, "myntDagGavaOk saknas");
    assert.ok(gava[1].includes(`d.senastMynt == ${GAVA_MYNT}`));
    assert.ok(gava[1].includes("d.gavor.diff(gavor).affectedKeys() == [d.gardUid].toSet()"));
    assert.ok(gava[1].includes("!(d.gardUid in gavor)"));
    assert.ok(gava[1].includes(`efter.get('agdaDjur', {}).get(d.gardUid, '') in [${GARDSDJUR.map((k) => `'${k}'`).join(", ")}]`));
  });
  it("gåvan och gårdsdjuren stämmer med farm-core och katalogen", () => {
    assert.equal(GAVA_MYNT, FARM_GIFT_COINS);
    assert.deepEqual([...GARDSDJUR].sort(), SHOP_ITEMS.filter((i) => i.farmAnimal).map((i) => i.id).sort());
  });
  it("texten vid taket", () => {
    assert.equal(MYNT_DAG_TAK_TEXT, "Du har fått dagens alla mynt härifrån – resultatet sparas ändå.");
  });
});

describe("taken skär aldrig en legitim utbetalning", () => {
  const kod = (fil, formel) => assert.ok(read(fil).includes(formel), `${fil}: ${formel}`);
  it("övning: alla baseCoins-formler ≤ PER_GANG.ovning", () => {
    const fragor = Math.max(MAX_QUESTIONS_PER_SESSION, ROUND_SIZE); // tidslinjen ryms i quizets 10 (quizLimit = 10 − tidslinje)
    assert.ok(QUIZ_TIMELINE_MAX <= MAX_QUESTIONS_PER_SESSION);
    const quiz = 2 * (3 + fragor * 2 + 2);
    kod("src/games-quiz.js", "const baseCoins = 2 * (3 + correct * 2 + (correct === total ? 2 : 0));");
    kod("src/games-rakna.js", "const baseCoins = 2 * (3 + correct * 2 + (correct === total ? 2 : 0));");
    kod("src/timeline/tidsjakt-core.js", "quizLimit: limit - questions.length");
    kod("src/games-match.js", "const baseCoins = 2 * (8 + (mistakes === 0 ? 8 : Math.max(0, 6 - mistakes)));");
    kod("src/games-match.js", "const baseCoins = 2 * Math.max(5, 6 + Math.max(0, 10 - (tries - total)));");
    kod("src/games-jakt.js", "const baseCoins = 2 * Math.min(25, Math.max(5, 4 + Math.round(score / 45)));");
    kod("src/adventure/reward.js", "const baseCoins = 2 * (goal * 2 + Math.max(0, 6 - mistakes));");
    const goals = readdirSync(join(ROOT, "src/adventure/themes"))
      .flatMap((f) => [...read(`src/adventure/themes/${f}`).matchAll(/^\s*goal: (\d+)/gm)].map((m) => Number(m[1])));
    assert.ok(goals.length >= 3);
    const max = Math.max(
      quiz,
      2 * (8 + 8), 2 * (6 + 10), // match: felfritt / minsta antal försök
      2 * 25, // jakt
      myntAv({ traffar: MAX_QUESTIONS_PER_SESSION, antal: MAX_QUESTIONS_PER_SESSION, exakt: MAX_QUESTIONS_PER_SESSION }),
      2 * (Math.max(...goals) * 2 + 6), // äventyr
    );
    assert.equal(max, 52);
    assert.ok(max <= PER_GANG.ovning, `största övning ${max} > ${PER_GANG.ovning}`);
  });
  it("övning: Fånga sanningar (utan slut) – taket räcker för minst tio minuters felfritt spel i maxtempo", () => {
    const src = read("src/games-sanningsjakt.js");
    const tal = (n) => Number(new RegExp(`const ${n} = ([\\d.]+);`).exec(src)[1]);
    kod("src/games-sanningsjakt.js", "coinsEarned += tile.fresh ? COINS_FRESH_TRUTH : COINS_REPEAT_TRUTH;");
    // Värsta fallet: varannan bricka sann och alla färska, från första sekunden i tätaste takt.
    const myntPerSekund = tal("COINS_FRESH_TRUTH") / (2 * tal("SPAWN_INTERVAL_MIN"));
    assert.ok(PER_GANG.ovning / myntPerSekund >= 10 * 60, `${PER_GANG.ovning / myntPerSekund} s`);
  });
  it("XP per övning: xpForExercise(3) = XP_PER_GANG", () => {
    assert.equal(xpForExercise(3), XP_PER_GANG);
    assert.ok(XP_PER_DAG >= 20 * XP_PER_GANG);
  });
  it("Läsresan: bankens största text × 3 ≤ PER_GANG.lasresa", () => {
    const dir = "src/lasresan/content/bank";
    let maxFragor = QUESTIONS_MAX;
    for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith(".json"))) {
      const j = JSON.parse(read(`${dir}/${f}`));
      for (const t of Array.isArray(j) ? j : j.texts || Object.values(j)) {
        if (t && Array.isArray(t.questions)) maxFragor = Math.max(maxFragor, t.questions.length);
      }
    }
    assert.ok(maxFragor * COINS_PER_CORRECT <= PER_GANG.lasresa, `${maxFragor} frågor`);
    assert.ok(20 * COINS_PER_CORRECT <= PER_GANG.lasresa, "marginal: 20 frågor");
  });
  it("Ämnesläsning: 5/rätt × hårda frågetaket (första läsningen) ≤ PER_GANG.amnes", () => {
    const maxNiva = Math.max(...Object.values(AMNES_QUESTIONS_BY_LEVEL).map((r) => r[1]));
    assert.ok(maxNiva <= AMNES_QUESTIONS_HARD_MAX);
    assert.equal(amnesCoinsFor(AMNES_QUESTIONS_HARD_MAX, 0), AMNES_QUESTIONS_HARD_MAX * AMNES_COINS_PER_CORRECT);
    assert.ok(amnesCoinsFor(AMNES_QUESTIONS_HARD_MAX, 0) <= PER_GANG.amnes, "lärarens text med högsta tillåtna antalet frågor");
  });
  it("Ämnesläsning: en text över det hårda frågetaket är ett fel – sparas aldrig", () => {
    const fraga = (i) => ({ id: `q${i}`, question: `Fråga ${i}?`, options: ["a", "b", "c", "d"], answerIndex: 0, category: "fakta" });
    const text = (n) => ({ id: `t${n}`, title: `Text ${n}`, level: 1, textType: "fact", body: "Ord ".repeat(60), questions: Array.from({ length: n }, (_, i) => fraga(i + 1)) });
    const ok = validateReadingTexts([text(AMNES_QUESTIONS_HARD_MAX)]);
    assert.deepEqual(ok.errors, []);
    assert.ok(ok.warnings.some((w) => /frågor \(ska vara/.test(w)), "utanför nivåns intervall = bara varning");
    const over = validateReadingTexts([text(AMNES_QUESTIONS_HARD_MAX + 1)]);
    assert.equal(over.valid.length, 0);
    assert.ok(over.errors.some((e) => e.includes(`högst ${AMNES_QUESTIONS_HARD_MAX} per text`)), over.errors.join(" | "));
  });
  it("Ekvationsresan: högsta beloppet = PER_GANG.ekv", () => {
    assert.equal(Math.max(COINS.extraChallenge, ...COINS.byLevel.map((r) => r.coins)), PER_GANG.ekv);
  });
  it("dagstaket rymmer en tung men normal dag (§9 F1, #853)", () => {
    assert.ok(PER_DAG.ovning >= 30 * 50, "30 perfekta quiz");
    assert.ok(PER_DAG.lasresa >= 25 * QUESTIONS_MAX * COINS_PER_CORRECT, "25 texter med flest frågor, alla rätt");
    assert.ok(PER_DAG.amnes >= 20 * 7 * AMNES_COINS_PER_CORRECT, "20 nya nivå 3-texter, alla rätt");
    assert.ok(PER_DAG.ekv >= 80 * Math.max(COINS.extraChallenge, ...COINS.byLevel.map((r) => r.coins)), "80 uppgifter med högsta beloppet");
  });
  it("dagstaket rymmer minst en utbetalning per gång för varje källa", () => {
    for (const k of Object.keys(PER_GANG)) assert.ok(PER_DAG[k] >= PER_GANG[k], k);
  });
});

describe("planTjana: klippning", () => {
  const sd = { coins: 100, xp: 40 };
  it("under taket: hela beloppet, kvittot och saldot", () => {
    const p = planTjana({ kalla: "ovning", mynt: 50, xp: 30, sd, kvitto: null });
    assert.deepEqual(p, {
      mynt: 50, xp: 30, tak: false, xpTak: false, xpSaknas: false,
      kvitto: { kalla: "ovning", senastMynt: 50, senastXp: 30, ovning: 50, xp: 30 },
      sd: { coins: 150, xp: 70 },
    });
  });
  it("klipps mot PER_GANG och PER_DAG", () => {
    assert.equal(planTjana({ kalla: "ekv", mynt: 9, sd, kvitto: null }).mynt, PER_GANG.ekv);
    const p = planTjana({ kalla: "lasresa", mynt: 27, sd, kvitto: { lasresa: PER_DAG.lasresa - 5 } });
    assert.deepEqual([p.mynt, p.tak, p.kvitto.lasresa, p.sd.coins], [5, true, PER_DAG.lasresa, 105]);
    const full = planTjana({ kalla: "lasresa", mynt: 27, sd, kvitto: { lasresa: PER_DAG.lasresa } });
    assert.deepEqual([full.mynt, full.tak, full.kvitto, full.sd], [0, true, null, null]);
  });
  it("XP: bara för ovning, bara när fältet finns, klipps mot XP-taken", () => {
    assert.equal(planTjana({ kalla: "lasresa", mynt: 3, xp: 50, sd }).xp, 0);
    const utan = planTjana({ kalla: "ovning", mynt: 20, xp: 50, sd: { coins: 1 } });
    assert.deepEqual([utan.mynt, utan.xp, utan.xpSaknas, utan.tak, "xp" in utan.sd, "xp" in utan.kvitto], [20, 0, true, false, false, false]);
    const p = planTjana({ kalla: "ovning", mynt: 0, xp: 50, sd, kvitto: { ovning: 10, xp: XP_PER_DAG - 10 } });
    assert.deepEqual([p.mynt, p.xp, p.tak, p.xpTak, p.kvitto.xp, p.sd], [0, 10, false, true, XP_PER_DAG, { coins: 100, xp: 50 }]);
  });
  it("bara XP klipps: mynten betalas fullt → tak false (ingen takrad), xpTak true", () => {
    const p = planTjana({ kalla: "ovning", mynt: 50, xp: 50, sd, kvitto: { xp: XP_PER_DAG - 5 } });
    assert.deepEqual([p.mynt, p.xp, p.tak, p.xpTak], [50, 5, false, true]);
    const m = planTjana({ kalla: "ovning", mynt: 50, xp: 50, sd, kvitto: { ovning: PER_DAG.ovning - 5 } });
    assert.deepEqual([m.mynt, m.xp, m.tak, m.xpTak], [5, 50, true, false]);
  });
  it("gåvan: alltid 8, en gång per djur och dag", () => {
    const p = planTjana({ kalla: "gard", mynt: 8, sd, kvitto: { gard: 8, gavor: { a: true } }, gardUid: "b" });
    assert.deepEqual(p.kvitto, { kalla: "gard", senastMynt: 8, senastXp: 0, gard: 16, gardUid: "b", gavor: { b: true } });
    const igen = planTjana({ kalla: "gard", mynt: 8, sd, kvitto: { gavor: { b: true } }, gardUid: "b" });
    assert.deepEqual([igen.mynt, igen.tak, igen.kvitto], [0, true, null]);
    assert.equal(planTjana({ kalla: "gard", mynt: 8, sd }).mynt, 0, "utan gardUid");
  });
  it("okänd källa kastar", () => {
    assert.throws(() => planTjana({ kalla: "bonus", mynt: 1 }), /okänd källa/);
  });
});

describe("tjanaMyntMed med injicerat SDK", () => {
  let tjanaMyntMed;
  before(async () => {
    installeraFirebaseStubbe();
    ({ tjanaMyntMed } = await import("../src/data-mynt.js"));
  });
  /** Minnes-Firestore: transaktion med get/set(merge)/update(fältvägar), valfri nekare. */
  function fejk(start, { neka = () => false, nu = () => Date.UTC(2026, 10, 14, 10) } = {}) {
    const lager = new Map(Object.entries(structuredClone(start)));
    const skrivningar = [];
    const djup = (a, b) => {
      for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? djup({ ...a[k] }, v) : v;
      return a;
    };
    return {
      lager, skrivningar,
      sdk: {
        db: {}, nu, serverTimestamp: () => "TS",
        doc: (_db, ...seg) => seg.join("/"),
        runTransaction: async (_db, fn) => {
          const ut = [];
          const tx = {
            get: async (p) => ({ exists: () => lager.has(p), data: () => structuredClone(lager.get(p)) }),
            set: (p, d, o) => ut.push(["set", p, d, o]),
            update: (p, d) => ut.push(["update", p, d]),
          };
          const r = await fn(tx);
          if (ut.some(([, p, d]) => neka(p, d))) throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
          for (const [typ, p, d, o] of ut) {
            skrivningar.push([typ, p, d]);
            if (typ === "set") lager.set(p, o?.merge ? djup(structuredClone(lager.get(p) || {}), d) : d);
            else {
              const ny = structuredClone(lager.get(p));
              for (const [k, v] of Object.entries(d)) {
                const delar = k.split(".");
                let x = ny;
                for (const del of delar.slice(0, -1)) x = x[del] ||= {};
                x[delar.at(-1)] = v;
              }
              lager.set(p, ny);
            }
          }
          return r;
        },
      },
    };
  }
  const DAG = myntDag(Date.UTC(2026, 10, 14, 10));

  it("klipper mot dagstaket och skriver saldo + kvitto i samma transaktion", async () => {
    const f = fejk({ "studentData/a": { coins: 10, xp: 5 }, [`studentData/a/myntDag/${DAG}`]: { dag: DAG, ovning: PER_DAG.ovning - 7, xp: 0 } });
    const r = await tjanaMyntMed(f.sdk, "ovning", 50, { xp: 50, studentId: "a" });
    assert.deepEqual([r.mynt, r.xp, r.tak, r.xpTak, r.saldo, r.xpTotal], [7, 50, true, false, 17, 55]);
    assert.equal(f.skrivningar.length, 2);
    assert.deepEqual(f.lager.get("studentData/a"), { coins: 17, xp: 55 });
    const k = f.lager.get(`studentData/a/myntDag/${DAG}`);
    assert.deepEqual([k.ovning, k.senastMynt, k.senastXp, k.xp, k.lastAt, k.dag], [PER_DAG.ovning, 7, 50, 50, "TS", DAG]);
  });
  it("dokument utan xp: mynten betalas, ingen xp-skrivning", async () => {
    const f = fejk({ "studentData/a": { coins: 10, progress: {} } });
    const r = await tjanaMyntMed(f.sdk, "ovning", 30, { xp: 40, studentId: "a" });
    assert.deepEqual([r.mynt, r.xp], [30, 0]);
    assert.deepEqual(f.lager.get("studentData/a"), { coins: 40, progress: {} });
    assert.ok(!("xp" in f.lager.get(`studentData/a/myntDag/${DAG}`)));
  });
  it("taket helt nått: ingenting skrivs", async () => {
    const f = fejk({ "studentData/a": { coins: 10 }, [`studentData/a/myntDag/${DAG}`]: { ekv: PER_DAG.ekv } });
    const r = await tjanaMyntMed(f.sdk, "ekv", 5, { studentId: "a" });
    assert.deepEqual([r.mynt, r.tak, r.saldo, f.skrivningar.length], [0, true, 10, 0]);
  });
  it("gåvan: extra-funktionen skrivs i samma skrivning, avbrott skriver ingenting", async () => {
    const f = fejk({ "studentData/a": { coins: 1, farm: { animals: [{ uid: "h" }] } } });
    const extra = (sd) => (sd.farm.animals.length ? { "farm.animals": [{ uid: "h", lastGiftAt: 1 }] } : null);
    const r = await tjanaMyntMed(f.sdk, "gard", 8, { gardUid: "h", extra, studentId: "a" });
    assert.deepEqual([r.mynt, r.saldo], [8, 9]);
    assert.deepEqual(f.lager.get("studentData/a").farm.animals, [{ uid: "h", lastGiftAt: 1 }]);
    assert.deepEqual(f.lager.get(`studentData/a/myntDag/${DAG}`).gavor, { h: true });
    const stopp = await tjanaMyntMed(f.sdk, "gard", 8, { gardUid: "h", extra: () => null, studentId: "a" });
    assert.equal(stopp.avbrutet, true);
    assert.equal(f.skrivningar.length, 2);
  });
  it("studentData saknas: ingenting skrivs, inget nytt dokument med mynt (#855 F15)", async () => {
    const f = fejk({});
    const r = await tjanaMyntMed(f.sdk, "ovning", 30, { xp: 10, studentId: "a" });
    assert.deepEqual([r.mynt, r.avbrutet, f.skrivningar.length], [0, true, 0]);
  });
  it("nekat mitt på dagen: inget omförsök, { mynt: 0, nekad }", async () => {
    let forsok = 0;
    const f = fejk({ "studentData/a": { coins: 1 } }, { neka: () => (forsok++, true) });
    const r = await tjanaMyntMed(f.sdk, "ekv", 3, { studentId: "a" });
    assert.deepEqual([r.mynt, r.nekad, forsok], [0, true, 1]);
  });
  it("nekat strax före svensk midnatt: ett omförsök med nästa dag", async () => {
    const t = Date.UTC(2026, 10, 14, 22, 59, 58); // 23:59:58 svensk vintertid
    const dagar = [];
    const f = fejk({ "studentData/a": { coins: 1 } }, {
      nu: () => t,
      neka: (p) => (p.includes("/myntDag/") ? (dagar.push(p.split("/").at(-1)), p.endsWith("2026-11-14")) : false),
    });
    const r = await tjanaMyntMed(f.sdk, "ekv", 3, { studentId: "a" });
    assert.deepEqual(dagar, ["2026-11-14", "2026-11-15"]);
    assert.deepEqual([r.mynt, r.saldo], [3, 4]);
    assert.equal(grannDag(t), "2026-11-15");
    assert.equal(grannDag(t + 2 * 60 * 1000), "2026-11-14"); // 00:01:58 → dagen före
    assert.equal(grannDag(Date.UTC(2026, 10, 14, 10)), null);
  });
  it("andra fel kastas vidare", async () => {
    const f = fejk({ "studentData/a": { coins: 1 } });
    f.sdk.runTransaction = async () => { throw Object.assign(new Error("offline"), { code: "unavailable" }); };
    await assert.rejects(tjanaMyntMed(f.sdk, "ekv", 3, { studentId: "a" }), /offline/);
  });
});

describe("struktur", () => {
  it("ingen elevväg anropar addCoins( – bara lärarens Ge mynt (teacher-*) och definitionen", () => {
    const rader = execSync('git grep -n "addCoins(" -- src', { cwd: ROOT, encoding: "utf8" }).trim().split("\n");
    const ovriga = rader.filter((r) => !/^src\/teacher-[\w-]+\.js:/.test(r) && !r.startsWith("src/data.js:") );
    assert.deepEqual(ovriga, []);
    assert.ok(rader.some((r) => r.startsWith("src/teacher-")));
  });
  it("bootgrafen är oförändrad (107 filer) och myntfilerna ligger utanför", () => {
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
    for (const f of ["data-mynt.js", "mynt-dag.js"]) assert.ok(!seen.has(join(ROOT, "src", f)), f);
  });
  it("filerna håller 400-radersgränsen", () => {
    for (const f of ["src/mynt-dag.js", "src/data-mynt.js", "src/game-shared.js", "src/data-farm.js", "src/data-xp.js",
      "src/lasresan/rewards.js", "src/ekvationsresan/mynt.js", "src/data-amneslasning.js", "src/varld-foder.js",
      "test/mynt-dag.test.js", "test/firestore-rules-mynt-dag.test.js", "src/data-lasresan.js",
      "src/lasresan/rewards.js", "test/mynt-dag-statistik.test.js"]) {
      assert.ok(read(f).split("\n").length <= 401, `${f} ≤ 400 rader`);
    }
  });
});
