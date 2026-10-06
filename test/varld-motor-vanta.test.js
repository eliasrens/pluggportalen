// ============================================================================
// Handoffens texturväntan (#396, I1 #426, G1 §6.6.1): två väntetider.
//   • Ny bild klar → spela direkt.
//   • Reserv finns (bara omspeglingen saknas) → högst RESERV_MAX_MS (120).
//   • Kall övergång (inget spelbart) → VANTA_MAX_MS (250), sedan CSS.
// Riktiga (korta) timers: performance.now() styr gränserna.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { vantaTexturer, RESERV_MAX_MS } from "../src/varld-motor-forbered.js";

const aldrig = new Promise(() => {});
const sen = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
async function mat(fn) {
  const t0 = performance.now();
  const res = await fn(t0);
  return { res, ms: performance.now() - t0 };
}

test("RESERV_MAX_MS = 120 och kortare än kall väntan (250)", () => {
  assert.equal(RESERV_MAX_MS, 120);
});

test("ny bild klar före gränserna → spelar direkt", async () => {
  const { res, ms } = await mat((t0) => vantaTexturer(sen(20), () => true, t0 + 250, t0 + 120));
  assert.equal(res, "klart");
  assert.ok(ms < 100, `${ms} ms`);
});

test("reserv finns, omspeglingen hinner inte → slutar vänta vid reservgränsen", async () => {
  const { res, ms } = await mat((t0) => vantaTexturer(aldrig, () => true, t0 + 250, t0 + 120));
  assert.equal(res, "reserv");
  assert.ok(ms >= 115 && ms < 230, `${ms} ms`);
});

test("kall övergång (inget spelbart vid 120) → väntar till deadline", async () => {
  const { res, ms } = await mat((t0) => vantaTexturer(aldrig, () => false, t0 + 250, t0 + 120));
  assert.equal(res, "deadline");
  assert.ok(ms >= 245, `${ms} ms`);
});

test("kall övergång som blir klar mellan 120 och 250 → spelas när den är klar", async () => {
  const { res, ms } = await mat((t0) => vantaTexturer(sen(180), () => false, t0 + 250, t0 + 120));
  assert.equal(res, "klart");
  assert.ok(ms >= 175 && ms < 245, `${ms} ms`);
});

test("utan reservTill (tvinga: samma gräns) gäller bara deadline", async () => {
  const { res, ms } = await mat((t0) => vantaTexturer(aldrig, () => true, t0 + 150));
  assert.equal(res, "reserv"); // reservTill = deadline → kontrolleras först vid deadline
  assert.ok(ms >= 145, `${ms} ms`);
});

test("ett avvisat klart-löfte räknas som klart (valj() avgör sedan reserv/CSS)", async () => {
  const { res } = await mat((t0) => vantaTexturer(Promise.reject(new Error("x")), () => false, t0 + 250, t0 + 120));
  assert.equal(res, "klart");
});

test("F6: spelbart blir sant EFTER reservgränsen (startlagret färskt) → spelar då, inte vid deadline", async () => {
  const t = performance.now() + 170;
  const { res, ms } = await mat((t0) => vantaTexturer(aldrig, () => performance.now() >= t, t0 + 250, t0 + 120));
  assert.equal(res, "reserv");
  assert.ok(ms >= 165 && ms < 240, `${ms} ms`);
});
