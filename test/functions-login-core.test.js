// ============================================================================
// Enhetstester: validering i functions/login-core.js (ingen emulator).
// Hela flödet (Auth + Firestore + återställning) testas i
// functions-update-login.test.mjs mot emulatorerna.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LoginError,
  normalizeUsername,
  usernameToEmail,
  validateInput,
} from "../functions/login-core.js";

const code = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof LoginError, "ska vara LoginError");
    return e.code;
  }
  return null;
};

describe("validateInput", () => {
  it("normaliserar användarnamn (trim + gemener)", () => {
    const r = validateInput({ uid: "u1", username: "  Omar851 " });
    assert.deepEqual(r, { uid: "u1", username: "omar851", password: null });
  });

  it("tar emot bara lösenord", () => {
    assert.deepEqual(validateInput({ uid: "u1", password: "katt482" }), {
      uid: "u1",
      username: null,
      password: "katt482",
    });
  });

  it("kräver uid och något att ändra", () => {
    assert.equal(code(() => validateInput({ username: "abc" })), "invalid-argument");
    assert.equal(code(() => validateInput({ uid: "a/b", username: "abc" })), "invalid-argument");
    assert.equal(code(() => validateInput({ uid: "u1" })), "invalid-argument");
    assert.equal(code(() => validateInput(null)), "invalid-argument");
  });

  it("nekar ogiltiga användarnamn", () => {
    for (const u of ["ab", "omar 851", "åsa1", "a@b.se", "x".repeat(41), 123]) {
      assert.equal(code(() => validateInput({ uid: "u1", username: u })), "invalid-argument", String(u));
    }
    assert.equal(code(() => validateInput({ uid: "u1", username: "o.mar_8-5" })), null);
  });

  it("nekar för korta/långa lösenord", () => {
    assert.equal(code(() => validateInput({ uid: "u1", password: "12345" })), "invalid-argument");
    assert.equal(code(() => validateInput({ uid: "u1", password: "x".repeat(65) })), "invalid-argument");
    assert.equal(code(() => validateInput({ uid: "u1", password: 123456 })), "invalid-argument");
  });
});

describe("e-postmappning", () => {
  it("matchar src/auth.js usernameToEmail", () => {
    assert.equal(normalizeUsername(" Elev1 "), "elev1");
    assert.equal(usernameToEmail(" Elev1 "), "elev1@elev.pluggportalen.local");
  });
});
