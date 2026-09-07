// ============================================================================
// Enhetstest för roterande frågeurval (issue #112):
//   • questionKey: stabil, oberoende av ordning/duplicerad text
//   • pickRotatingQuestions: 10/session, osedda först, nollställ när varvet är
//     klart, alltid full session när poolen räcker, bakåtkompatibel start.
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_QUESTIONS_PER_SESSION,
  questionKey,
  pickRotatingQuestions,
} from "../src/question-rotation.js";

// Bygg en pool med n frågor med unik text.
function pool(n) {
  return Array.from({ length: n }, (_, i) => ({
    question: `Fråga nummer ${i}?`,
    options: ["a", "b"],
    answerIndex: 0,
  }));
}

test("MAX är 10 (issue #112: 10 frågor/session)", () => {
  assert.equal(MAX_QUESTIONS_PER_SESSION, 10);
});

test("questionKey är stabil och oberoende av ordning", () => {
  const q = { question: "Vad hände 1789?" };
  assert.equal(questionKey(q), questionKey({ question: "Vad hände 1789?" }));
  assert.notEqual(questionKey(q), questionKey({ question: "Något annat?" }));
});

test("questionKey tål saknad/tom frågetext", () => {
  assert.equal(typeof questionKey(null), "string");
  assert.equal(typeof questionKey({}), "string");
});

test("liten pool (≤10): kör alla, ingen rotation att spara", () => {
  const p = pool(6);
  const { questions, seen } = pickRotatingQuestions(p, []);
  assert.equal(questions.length, 6);
  assert.deepEqual(seen, []);
  // alla unika frågor kom med
  assert.equal(new Set(questions.map(questionKey)).size, 6);
});

test("stor pool: serverar exakt 10 och sparar deras nycklar", () => {
  const p = pool(25);
  const { questions, seen } = pickRotatingQuestions(p, []);
  assert.equal(questions.length, 10);
  assert.equal(seen.length, 10);
  assert.deepEqual([...seen].sort(), questions.map(questionKey).sort());
});

test("bakåtkompatibelt: saknad seen-data → slumpad start (10 st)", () => {
  const p = pool(25);
  assert.equal(pickRotatingQuestions(p, undefined).questions.length, 10);
  assert.equal(pickRotatingQuestions(p, null).questions.length, 10);
});

test("nästa session ger enbart OSEDDA frågor", () => {
  const p = pool(25);
  const s1 = pickRotatingQuestions(p, []);
  const s2 = pickRotatingQuestions(p, s1.seen);
  const overlap = s2.questions
    .map(questionKey)
    .filter((k) => new Set(s1.seen).has(k));
  assert.deepEqual(overlap, [], "andra sessionen upprepade sedda frågor");
  assert.equal(s2.questions.length, 10);
  assert.equal(s2.seen.length, 20); // 10 + 10
});

test("helt varv: pool töms över sessioner, sedan nollställs och rullar om", () => {
  const p = pool(25); // 25 = 10 + 10 + 5
  const s1 = pickRotatingQuestions(p, []);
  const s2 = pickRotatingQuestions(p, s1.seen); // seen = 20
  // Tredje sessionen: bara 5 osedda kvar → varvet tar slut, fylls upp till 10 ur
  // ett nytt varv, och seen börjar om med enbart de färska.
  const s3 = pickRotatingQuestions(p, s2.seen);
  assert.equal(s3.questions.length, 10, "ska alltid ge full session när poolen räcker");
  // De 5 kvarvarande osedda från gamla varvet ska ha serverats i s3.
  const servedAll = new Set([...s1.seen, ...s2.seen, ...s3.questions.map(questionKey)]);
  assert.equal(servedAll.size, 25, "alla 25 frågor ska ha serverats efter tre sessioner");
  // Nytt varv har börjat: seen är mindre än ett helt gammalt varv (bara färska).
  assert.ok(s3.seen.length < 20 && s3.seen.length > 0, `seen nollställd inför nytt varv (fick ${s3.seen.length})`);
});

test("seen som täcker hela poolen → full nollställning och nytt slumpat varv", () => {
  const p = pool(15);
  const allKeys = p.map(questionKey);
  const { questions, seen } = pickRotatingQuestions(p, allKeys);
  assert.equal(questions.length, 10);
  assert.equal(seen.length, 10);
});

test("stale nycklar (borttagna frågor) rensas ur seen", () => {
  const p = pool(25);
  const seen = [questionKey(p[0]), "qDEADBEEF_finns_ej", questionKey(p[1])];
  const { seen: next } = pickRotatingQuestions(p, seen);
  assert.ok(!next.includes("qDEADBEEF_finns_ej"), "stale nyckel ska rensas");
});

test("tom pool → tomt resultat, ingen krasch", () => {
  assert.deepEqual(pickRotatingQuestions([], []), { questions: [], seen: [] });
  assert.deepEqual(pickRotatingQuestions(null, []), { questions: [], seen: [] });
});
