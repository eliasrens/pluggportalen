// ============================================================================
// Mattematchens pluggmynt (#846) – rena tester (node --test, ingen emulator):
//   • config ↔ firestore.rules: 1 per rätt, 50 per dag, samlingen mmMynt
//   • "dag": reglernas datumräkning (UTC + 1/2 h, EU:s sommartidsregel) ger
//     samma svenska datum som klientens Intl-version (myntDag), även runt
//     omställningarna och midnatt – porten nedan speglar reglerna rad för rad
//     och testet låser att reglerna fortfarande innehåller just de uttrycken
//   • skrivplanen: mynt bara med `mynt` OCH rätt svar (Live-svar i C slipper)
//   • bootgrafen oförändrad (107 filer) och filerna ≤ 400 rader
// Reglerna körs skarpt i test/firestore-rules-mattematchen-mynt.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MYNT_PER_RATT, MYNT_TAK_PER_DAG, MYNT_KVITTON, MYNT_TAK_TEXT, myntDag, myntForRatt,
} from "../src/tavling/mm-config.js";
import { planMathAnswerWrites, planMmMyntWrites } from "../src/tavling/answer-writes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
const H = 3600 * 1000;
const fv = { increment: (n) => ({ inc: n }), serverTimestamp: () => ({ ts: true }) };

/** Port av reglernas svenskDag/svenskSommartid/sistaSondag – UTC-räkning. */
function svenskDagRegler(ms) {
  const t = new Date(ms);
  const y = t.getUTCFullYear();
  const dayOfWeek = (d) => (d.getUTCDay() === 0 ? 7 : d.getUTCDay()); // reglerna: 1 = måndag … 7 = söndag
  const sistaSondag = (m) => 31 - (dayOfWeek(new Date(Date.UTC(y, m - 1, 31))) % 7);
  const sommar = ms >= Date.UTC(y, 2, sistaSondag(3), 1) && ms < Date.UTC(y, 9, sistaSondag(10), 1);
  const l = new Date(ms + (sommar ? 2 : 1) * H);
  const p2 = (n) => (n < 10 ? "0" : "") + String(n);
  return `${l.getUTCFullYear()}-${p2(l.getUTCMonth() + 1)}-${p2(l.getUTCDate())}`;
}

describe("mm-config ↔ firestore.rules", () => {
  const fn = /function mmMyntOk\(uid, dag\) \{([\s\S]*?)\n    \}/.exec(rules);
  it("mmMyntOk finns och använder samma tal som configen", () => {
    assert.ok(fn, "mmMyntOk saknas i firestore.rules");
    assert.ok(fn[1].includes(`bumped('mynt', ${MYNT_PER_RATT})`), `reglerna: bumped('mynt', ${MYNT_PER_RATT})`);
    assert.ok(fn[1].includes(`d.mynt <= ${MYNT_TAK_PER_DAG}`), `reglerna: d.mynt <= ${MYNT_TAK_PER_DAG}`);
    assert.ok(fn[1].includes(`.get('coins', 0) : 0) + ${MYNT_PER_RATT};`), "saldot ökar med exakt MYNT_PER_RATT");
    assert.ok(rules.includes(`match /${MYNT_KVITTON}/{dag}`), `match /${MYNT_KVITTON}/{dag}`);
    assert.match(rules, /match \/mmMynt\/\{dag\} \{\s*allow read: if isSelf\(studentId\) \|\| hasStudent\(studentId\);\s*allow create, update: if mmMyntOk\(studentId, dag\);\s*allow delete: if isAdmin\(\);/);
  });
  it("kvittot kräver nytt rätt svar, samma elev, rätt dag, bara räknarfälten", () => {
    for (const krav of [
      "isSelf(uid)", "!exists(ap) && existsAfter(ap)", "a.uid == uid && a.isCorrect == true",
      "dag == svenskDag(request.time) && d.dag == dag", "d.lastAt == request.time",
      "changedOnly(['dag', 'cid', 'mynt', 'lastAttemptId', 'lastAt'])",
    ]) assert.ok(fn[1].includes(krav), krav);
  });
  it("datumuttrycken i reglerna är de som porten speglar", () => {
    assert.ok(rules.includes("function sistaSondag(y, m) { return 31 - (timestamp.date(y, m, 31).dayOfWeek() % 7); }"));
    assert.ok(rules.includes("t >= timestamp.date(y, 3, sistaSondag(y, 3)) + duration.value(1, 'h')"));
    assert.ok(rules.includes("t < timestamp.date(y, 10, sistaSondag(y, 10)) + duration.value(1, 'h')"));
    assert.ok(rules.includes("let l = t + duration.value(svenskSommartid(t) ? 2 : 1, 'h');"));
  });
  it("talen är de beslutade: 1 per rätt, 50 per dag, mjuk text", () => {
    assert.equal(MYNT_PER_RATT, 1);
    assert.equal(MYNT_TAK_PER_DAG, 50);
    assert.equal(MYNT_TAK_TEXT, "Dagens mynt är intjänade – poängen räknas fortfarande!");
    assert.equal(myntForRatt(0), 1);
    assert.equal(myntForRatt(49), 1);
    assert.equal(myntForRatt(50), 0);
    assert.equal(myntForRatt(undefined), 1);
  });
});

describe("svenskt datum: reglerna (UTC + 1/2 h) = klienten (Europe/Stockholm)", () => {
  it("form ÅÅÅÅ-MM-DD och kända punkter", () => {
    assert.match(myntDag(Date.UTC(2026, 10, 13, 12)), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(myntDag(Date.UTC(2026, 10, 13, 23, 30)), "2026-11-14"); // 00:30 svensk vintertid
    assert.equal(myntDag(Date.UTC(2026, 6, 1, 22, 30)), "2026-07-02");   // 00:30 svensk sommartid
    assert.equal(myntDag(Date.UTC(2026, 6, 1, 21, 30)), "2026-07-01");   // 23:30 svensk sommartid
    assert.equal(myntDag(Date.UTC(2026, 11, 31, 23, 30)), "2027-01-01"); // nyår
    assert.equal(svenskDagRegler(Date.UTC(2026, 11, 31, 23, 30)), "2027-01-01");
  });
  it("var 10:e minut ±3 dygn runt alla omställningar 2024–2030", () => {
    let n = 0;
    for (let y = 2024; y <= 2030; y++) {
      for (const m of [3, 10]) {
        const grans = Date.UTC(y, m - 1, 31 - ((new Date(Date.UTC(y, m - 1, 31)).getUTCDay() || 7) % 7), 1);
        for (let t = grans - 3 * 24 * H; t <= grans + 3 * 24 * H; t += 10 * 60 * 1000, n++) {
          assert.equal(svenskDagRegler(t), myntDag(t), new Date(t).toISOString());
        }
      }
    }
    assert.ok(n > 10000);
  });
  it("varje midnatt (±90 min, var 5:e minut) 2025–2028", () => {
    for (let d = Date.UTC(2025, 0, 1); d < Date.UTC(2029, 0, 1); d += 24 * H) {
      for (let off = -90; off <= 90; off += 5) {
        const t = d + off * 60 * 1000;
        assert.equal(svenskDagRegler(t), myntDag(t), new Date(t).toISOString());
      }
    }
  });
});

describe("skrivplanen: mynt bara med `mynt` och rätt svar", () => {
  const base = {
    competitionId: "mm1", attemptId: "att12345", uid: "alma", classId: "4b", name: "Alma",
    record: { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 }, shard: 2, fv,
  };
  it("utan mynt: 4 skrivningar som förut (Live-svar i issue C utelämnar mynt)", () => {
    assert.equal(planMathAnswerWrites({ ...base, isCorrect: true }).length, 4);
    assert.equal(planMathAnswerWrites({ ...base, isCorrect: true, mynt: null }).length, 4);
    assert.equal(planMathAnswerWrites({ ...base, isCorrect: false }).length, 2);
  });
  it("med mynt + rätt: kvittot och saldot sist i samma batch", () => {
    const w = planMathAnswerWrites({ ...base, isCorrect: true, mynt: { dag: "2026-11-13" } });
    assert.equal(w.length, 6);
    assert.deepEqual(w[4].path, ["studentData", "alma", MYNT_KVITTON, "2026-11-13"]);
    assert.deepEqual(w[4].data, {
      dag: "2026-11-13", cid: "mm1", mynt: { inc: MYNT_PER_RATT }, lastAttemptId: "att12345", lastAt: { ts: true },
    });
    assert.equal(w[4].merge, true);
    assert.deepEqual(w[5], { path: ["studentData", "alma"], data: { coins: { inc: MYNT_PER_RATT } }, merge: true });
  });
  it("med mynt + fel svar: inga myntskrivningar", () => {
    const w = planMathAnswerWrites({ ...base, isCorrect: false, mynt: { dag: "2026-11-13" } });
    assert.equal(w.length, 2);
    assert.ok(w.every((x) => x.path[0] === "mathCompetitions"));
  });
  it("planMmMyntWrites kräver en riktig dag", () => {
    assert.throws(() => planMmMyntWrites({ competitionId: "mm1", attemptId: "a", uid: "alma", dag: "idag", fv }), /ogiltig dag/);
    assert.throws(() => planMmMyntWrites({ competitionId: "mm1", attemptId: "a", uid: "alma", fv }), /ogiltig dag/);
  });
});

describe("struktur", () => {
  it("bootgrafen är oförändrad (107 filer) och mm-config.js ligger utanför", () => {
    const start = join(SRC, "app.js");
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const file = queue.shift();
      let src;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const next = resolve(dirname(file), m[1]);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    assert.equal(seen.size, 107, "bootgrafen ska vara kvar på 107 filer");
    assert.ok(!seen.has(join(SRC, "tavling", "mm-config.js")));
    assert.ok(!seen.has(join(SRC, "tavling", "answer-writes.js")));
  });
  it("filerna håller 400-radersgränsen", () => {
    for (const f of ["src/tavling/mm-config.js", "src/tavling/answer-writes.js", "src/tavling/mm-data.js",
      "src/tavling/page-mattematchen.js", "test/mm-mynt.test.js", "test/firestore-rules-mattematchen-mynt.test.js"]) {
      assert.ok(readFileSync(join(ROOT, f), "utf8").split("\n").length <= 401, `${f} ≤ 400 rader`);
    }
  });
});
