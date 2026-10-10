// ============================================================================
// Regel-tester: Live-svarssättet (#551) – liveSessions/{sid}.answerKind
//   • sessionen: "free" | "choice" eller saknas (alla före #551 = "free"),
//     låst efter start (ändras bara i lobbyn),
//   • svaren: skriv själv = dokumentet som före #551; flerval = answerKind
//     "choice" + choiceIndex 0–3 (facit räknas ändå om på servern),
//   • test 3d: ett manipulerat svar i fel svarssätt för sessionen nekas,
//   • gamla sessioner utan answerKind fungerar precis som förut.
// Svaren byggs med samma plan som klienten (planLiveAnswerWrites); de
// manipulerade dokumenten skrivs förbi planen (som en elev i devtools).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  deleteField, doc, setDoc, updateDoc, writeBatch, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { planLiveAnswerWrites } from "../src/tavling/answer-writes.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { seededRng } from "../src/mult/generator.js";

let testEnv, elev, teacher;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `ak${Date.now().toString(36)}x${(seq++).toString(36)}`;

const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "4B mot 5E", gameMode: "multiplication_0_10", classIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, durationMin: 20, divisors: { "4b": 17, "5e": 22 },
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H),
  ...over,
});
// Före #551: inget answerKind-fält.
const gammal = (over = {}) => {
  const { answerKind, ...utan } = sessionDoc(over);
  return utan;
};
const pagar = { status: "live", startedAt: ts(-60 * 1000) };

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
// Ett svar som klienten bygger det. choiceIndex → flervalssvar.
function svar(sid, { answerKind = "free", answer = 56, choiceIndex, attemptId = aid() } = {}) {
  const record = { factorA: 7, factorB: 8, answer, correctAnswer: 56 };
  return planLiveAnswerWrites({
    sessionId: sid, attemptId, uid: "alma", classId: "4b", mode: "multiplication_0_10",
    record, isCorrect: answer === 56, shard: 0, fv, answerKind, choiceIndex,
  });
}
// Manipulerat: samma batch men svarsdokumentet ändrat förbi planen.
function manip(writes, patch) {
  const [first, ...rest] = writes;
  const data = { ...first.data, ...patch };
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete data[k];
  return [{ ...first, data }, ...rest];
}

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-answerkind"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "liveSessions", "lobby"), sessionDoc());
    await setDoc(doc(db, "liveSessions", "flerval-lobby"), sessionDoc({ answerKind: "choice" }));
    await setDoc(doc(db, "liveSessions", "fritt"), sessionDoc(pagar));
    await setDoc(doc(db, "liveSessions", "flerval"), sessionDoc({ ...pagar, answerKind: "choice" }));
    await setDoc(doc(db, "liveSessions", "gammal"), gammal(pagar));
    await setDoc(doc(db, "liveSessions", "gammal-lobby"), gammal());
    for (const sid of ["fritt", "flerval", "gammal"]) {
      await setDoc(doc(db, "liveSessions", sid, "players", "alma"),
        { uid: "alma", classId: "4b", name: "Alma", joinedAt: ts(-H), lastSeenAt: ts(-H), correct: 0, incorrect: 0 });
    }
  });
});

const create = (data) => setDoc(doc(teacher(), "liveSessions", "ny"), { ...data, createdBy: "larare1", createdAt: serverTimestamp() });

describe("Live-svarssätt: sessionen", () => {
  it("nya sessioner sparar answerKind (Klassmatchen = \"free\"); free/choice/saknas godtas", async () => {
    assert.equal(sessionDoc().answerKind, "free");
    await assertSucceeds(create(sessionDoc()));
    await assertSucceeds(create(sessionDoc({ answerKind: "choice" })));
    await assertSucceeds(create(gammal()));
  });

  it("okänt svarssätt, fel typ och null nekas", async () => {
    for (const answerKind of ["fritext", "", "FREE", 0, null, ["free"]]) {
      await assertFails(create(sessionDoc({ answerKind })));
    }
  });

  it("i lobbyn får läraren ändra svarssättet", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "lobby"), { answerKind: "choice" }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "gammal-lobby"), { answerKind: "choice" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "flerval-lobby"), { answerKind: "fritext" }));
  });

  it("3b: låst efter start – inte under match, inte efter slut", async () => {
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "flerval"), { answerKind: "free" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "fritt"), { answerKind: "choice" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "flerval"), { answerKind: deleteField() }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "gammal"), { answerKind: "choice" }));
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "flerval"), { status: "finished", answerKind: "free" }));
    // Vanliga ändringar under match påverkas inte; frånvarande ≡ "free".
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "flerval"), { "classDivisors.4b": 16 }));
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "gammal"), { answerKind: "free" }));
  });

  it("starta matchen med svarssättet satt", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "liveSessions", "flerval-lobby"), { status: "live", startedAt: serverTimestamp() }));
  });
});

describe("Live-svarssätt: svaren", () => {
  it("skriv själv-session: vanligt svar godtas (rätt och fel)", async () => {
    await assertSucceeds(commit(elev("alma"), svar("fritt")));
    await assertSucceeds(commit(elev("alma"), svar("fritt", { answer: 54 })));
  });

  it("flervalssession: flervalssvar godtas (rätt och fel), alla index 0–3", async () => {
    for (const choiceIndex of [0, 1, 2, 3]) {
      await assertSucceeds(commit(elev("alma"), svar("flerval", { answerKind: "choice", choiceIndex })));
    }
    await assertSucceeds(commit(elev("alma"), svar("flerval", { answerKind: "choice", choiceIndex: 1, answer: 63 })));
  });

  it("3d: flervalssession – manipulerat svar i formen skriv själv nekas", async () => {
    await assertFails(commit(elev("alma"), svar("flerval")));
    // …även med bara ett av flervalsfälten
    await assertFails(commit(elev("alma"), manip(svar("flerval"), { choiceIndex: 2 })));
    await assertFails(commit(elev("alma"), manip(svar("flerval"), { answerKind: "choice" })));
    await assertFails(commit(elev("alma"), manip(svar("flerval"), { answerKind: "free" })));
  });

  it("3d: skriv själv-session – manipulerat flervalssvar nekas", async () => {
    await assertFails(commit(elev("alma"), svar("fritt", { answerKind: "choice", choiceIndex: 0 })));
    await assertFails(commit(elev("alma"), manip(svar("fritt"), { choiceIndex: 0 })));
    await assertFails(commit(elev("alma"), manip(svar("fritt"), { answerKind: "free" })));
  });

  it("flervalssvar: choiceIndex utanför 0–3 / fel typ, påhittat facit och extra fält nekas", async () => {
    const ok = () => svar("flerval", { answerKind: "choice", choiceIndex: 1 });
    for (const choiceIndex of [-1, 4, 1.5, "1", null]) {
      await assertFails(commit(elev("alma"), manip(ok(), { choiceIndex })));
    }
    await assertFails(commit(elev("alma"), manip(ok(), { answerKind: "Choice" })));
    await assertFails(commit(elev("alma"), manip(ok(), { isCorrect: true, answer: 63 }))); // fel men "rätt"
    await assertFails(commit(elev("alma"), manip(ok(), { correctAnswer: 63, answer: 63 })));
    await assertFails(commit(elev("alma"), manip(ok(), { options: [56, 54, 63, 48] })));
    await assertSucceeds(commit(elev("alma"), ok()));
  });

  it("klientens riktiga väg (#552): choices → checkAnswer på valt värde → answerRecord godtas, alla knappar", async () => {
    const mode = requireGameMode("multiplication_0_10");
    const rng = seededRng(551);
    const src = mode.createSource({ rng });
    for (let n = 0; n < 6; n++) {
      const q = src.next();
      const { options, answerIndex } = mode.choices(q, rng);
      for (const i of [answerIndex, (answerIndex + 1) % 4]) {
        const r = mode.checkAnswer(q, String(options[i]));
        assert.equal(r.correct, i === answerIndex);
        await assertSucceeds(commit(elev("alma"), planLiveAnswerWrites({
          sessionId: "flerval", attemptId: aid(), uid: "alma", classId: "4b", mode: mode.id,
          record: mode.answerRecord(q, r), isCorrect: r.correct, shard: 0, fv, answerKind: "choice", choiceIndex: i,
        })));
      }
    }
  });

  it("gammal session utan answerKind = skriv själv: vanligt svar godtas, flerval nekas", async () => {
    await assertSucceeds(commit(elev("alma"), svar("gammal")));
    await assertSucceeds(commit(elev("alma"), svar("gammal", { answer: 3 })));
    await assertFails(commit(elev("alma"), svar("gammal", { answerKind: "choice", choiceIndex: 0 })));
  });
});
