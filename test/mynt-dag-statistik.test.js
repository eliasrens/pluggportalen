// ============================================================================
// Dagskvittot (#853, testarens F1): när taket klipper en Läsresan- eller
// Ämnesläsningsutbetalning visar statistiken det som faktiskt BETALADES –
// försökets earnedMoney och de lagrade summorna (lasresa.moneyEarned,
// amneslasning.areas.<id>.totals / amneslasning.totals). Under taket ändras
// ingenting (ingen extra skrivning). Kör de RIKTIGA data-lasresan.js,
// data-amneslasning.js och data-mynt.js mot minnes-Firestore (node --test).
// ============================================================================

import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installeraMinnesFirestore } from "./helpers/minnes-firestore-loader.js";
import { MYNT_DAG_KVITTON, PER_DAG, myntDag } from "../src/mynt-dag.js";
import { pengarRattelse } from "../src/lasresan/rewards.js";

const UID = "e853";
let fs, lr, amn;
const bank = JSON.parse(readFileSync(new URL("../src/lasresan/content/bank/level-1.json", import.meta.url), "utf8"));
const TEXT = (Array.isArray(bank) ? bank : bank.texts)[0]; // 4 frågor → 12 mynt
const ratt = (t) => t.questions.map((q) => ({ qid: q.id, chosen: q.answerIndex }));
const AMNES = {
  id: "vik-1-skepp", title: "Vikingarnas skepp", level: 1, textType: "fact", body: "Vikingarna byggde skepp.",
  questions: [1, 2, 3].map((i) => ({ id: `q${i}`, question: `F${i}?`, options: ["a", "b", "c", "d"], answerIndex: 0, category: "fakta" })),
}; // 3 rätt × 5 = 15 mynt
const kvittoVag = () => `studentData/${UID}/${MYNT_DAG_KVITTON}/${myntDag(Date.now())}`;
const forsok = () => [...fs.rakna.logg].filter((l) => l.startsWith("skriv") && l.includes("/lasresaAttempts/"));

before(async () => {
  fs = await installeraMinnesFirestore();
  lr = await import("../src/data-lasresan.js");
  amn = await import("../src/data-amneslasning.js");
});
beforeEach(async () => {
  await fs.setDoc(fs.doc(fs.db, `studentData/${UID}`), { coins: 10, xp: 0, progress: {} });
  await fs.deleteDoc(fs.doc(fs.db, kvittoVag()));
  (await import("../src/data.js")).invalidateStudentData(UID);
});

describe("Läsresan: statistiken = det som betalades", () => {
  it("under taket: hela beloppet, ingen rättelse", async () => {
    await lr.startText(TEXT.id, UID);
    fs.nollstall();
    const res = await lr.completeText({ text: TEXT, answers: ratt(TEXT) }, UID);
    assert.deepEqual([res.coins, res.tak, res.attempt.earnedMoney], [12, false, 12]);
    assert.equal(fs.las(`studentData/${UID}`).lasresa.moneyEarned, 12);
    assert.equal(forsok().length, 1, "försöket skrivs en gång – ingen rättelse");
  });
  it("taket klipper 12 → 5: försöket och lasresa.moneyEarned visar 5", async () => {
    await fs.setDoc(fs.doc(fs.db, kvittoVag()), { dag: myntDag(Date.now()), kalla: "lasresa", lasresa: PER_DAG.lasresa - 5 });
    await lr.startText(TEXT.id, UID);
    const res = await lr.completeText({ text: TEXT, answers: ratt(TEXT) }, UID);
    assert.deepEqual([res.coins, res.tak, res.attempt.earnedMoney], [5, true, 5]);
    const sd = fs.las(`studentData/${UID}`);
    assert.deepEqual([sd.coins, sd.lasresa.moneyEarned], [15, 5]);
    const lista = await lr.listAttempts(UID);
    assert.equal(lista[0].earnedMoney, 5);
  });
});

describe("Ämnesläsning: statistiken = det som betalades", () => {
  const ctx = { subjectId: "so", areaId: "vikingar" };
  it("under taket: 15 i försöket, området och totalen", async () => {
    await amn.startAmnesText({ ...ctx, textId: AMNES.id }, UID);
    const res = await amn.completeAmnesText({ ...ctx, text: AMNES, answers: ratt(AMNES) }, UID);
    assert.deepEqual([res.coins, res.tak, res.attempt.earnedMoney], [15, false, 15]);
    const a = fs.las(`studentData/${UID}`).amneslasning;
    assert.deepEqual([a.areas.vikingar.totals.moneyEarned, a.totals.moneyEarned], [15, 15]);
  });
  it("taket klipper 15 → 4: försöket, området och totalen visar 4", async () => {
    await fs.setDoc(fs.doc(fs.db, kvittoVag()), { dag: myntDag(Date.now()), kalla: "amnes", amnes: PER_DAG.amnes - 4 });
    await amn.startAmnesText({ ...ctx, textId: AMNES.id }, UID);
    const res = await amn.completeAmnesText({ ...ctx, text: AMNES, answers: ratt(AMNES) }, UID);
    assert.deepEqual([res.coins, res.tak, res.attempt.earnedMoney], [4, true, 4]);
    const sd = fs.las(`studentData/${UID}`);
    assert.deepEqual([sd.coins, sd.amneslasning.areas.vikingar.totals.moneyEarned, sd.amneslasning.totals.moneyEarned], [14, 4, 4]);
  });
});

describe("pengarRattelse (ren)", () => {
  const sd = { lasresa: { moneyEarned: 40 }, lasresaAttemptsFallback: [{ textId: "a", completedAt: 1, earnedMoney: 12 }, { textId: "b", completedAt: 2, earnedMoney: 9 }] };
  const opts = { vagar: [["lasresa", "moneyEarned"], ["saknas", "x"]], fallbackField: "lasresaAttemptsFallback", textId: "b", completedAt: 2 };
  it("sänker summorna med skillnaden och rättar försöket i fallback-listan", () => {
    const p = pengarRattelse(sd, { ...opts, tjanat: 9, betalt: 2 });
    assert.equal(p["lasresa.moneyEarned"], 33);
    assert.ok(!("saknas.x" in p));
    assert.deepEqual(p.lasresaAttemptsFallback.map((a) => a.earnedMoney), [12, 2]);
  });
  it("ingen skillnad → tom patch; aldrig under 0", () => {
    assert.deepEqual(pengarRattelse(sd, { ...opts, tjanat: 9, betalt: 9 }), {});
    assert.equal(pengarRattelse({ lasresa: { moneyEarned: 3 } }, { ...opts, tjanat: 9, betalt: 0 })["lasresa.moneyEarned"], 0);
  });
});
