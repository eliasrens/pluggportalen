// #831: klass-membership.js är EN källa för hur klass + elevkonto ser ut, delad
// av lärarsidan (data.js/data-content.js/data-classes.js) och importskriptet.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultStudentData,
  newStudentDoc,
  studentCredentialsDoc,
  newClassDoc,
  nextClassOrder,
  normalizeUsername,
  USERNAME_RE,
} from "../src/klass-membership.js";

test("ny elev: gemener i användarnamnet, fox som standardavatar", () => {
  assert.deepEqual(newStudentDoc({ namn: "Kim", username: " Kim023 " }), { namn: "Kim", username: "kim023", avatarId: "fox" });
  assert.equal(normalizeUsername("Test1807"), "test1807");
  assert.ok(USERNAME_RE.test("test023") && !USERNAME_RE.test("te st"));
});

test("studentData: 0 mynt och tomma samlingar, nytt objekt varje gång", () => {
  const a = defaultStudentData();
  assert.equal(a.coins, 0);
  assert.equal(a.avatarId, "fox");
  assert.deepEqual(a.ownedItems, []);
  assert.notEqual(defaultStudentData().farm, a.farm);
});

test("lösenordet sparas som text för läraren", () => {
  assert.deepEqual(studentCredentialsDoc({ username: "Kim023", password: "Hemlis023" }, "T"), {
    username: "kim023",
    password: "Hemlis023",
    updatedAt: "T",
  });
});

test("ny klass: namn, order, createdAt, tom elevlista; order sist", () => {
  assert.deepEqual(newClassDoc({ name: " 3A ", order: 5 }, "T"), { name: "3A", order: 5, createdAt: "T", studentIds: [] });
  assert.deepEqual(newClassDoc({ name: "3A" }, "T"), { name: "3A", createdAt: "T", studentIds: [] });
  assert.equal(nextClassOrder([{ order: 2 }, { order: "7" }, {}]), 8);
  assert.equal(nextClassOrder([]), 1);
});
