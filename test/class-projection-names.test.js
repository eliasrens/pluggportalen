// ============================================================================
// Enhetstest (#316): klass-projektionen ska ALLTID bära `namn`.
// ----------------------------------------------------------------------------
// ROT: en partiell skriv-väg (award/self-publish/rum) kunde skapa en members-
// entry med bara siffror/utseende men UTAN `namn` → kartan ritade en trasig
// platshållare (rå-uid). Här bevisas de tre garantierna:
//   1. SKRIV: varje projektions-skrivning berikas med namn (identityFor) så
//      ingen post skapas namnlös – även updateDoc-vägen OCH setDoc-fallbacken.
//   2. LÄS: en post som ändå saknar namn läks defensivt ur students/{id} i
//      by-/grannby-översikten (0 extra läsningar i normalfallet = O(1) består).
//   3. Rena hjälpare: withEntryName / boendeMissingNameIds.
// Firebase-fritt (delad fejk-Firestore-fixtur):  node --test test/class-projection-names.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createClassProjectionStore,
  withEntryName,
  boendeMissingNameIds,
} from "../src/class-projection.js";
import { makeFakeDb } from "./helpers/class-projection-fakedb.js";

// --- Rena hjälpare ----------------------------------------------------------

test("withEntryName fyller namn/username när patchen saknar dem", () => {
  const out = withEntryName({ stars: 3 }, { namn: "Anna", username: "anna" });
  assert.equal(out.namn, "Anna");
  assert.equal(out.username, "anna");
  assert.equal(out.stars, 3);
});

test("withEntryName rör ALDRIG ett redan satt namn (lärarens explicita vinner)", () => {
  const out = withEntryName({ namn: "Riktig", stars: 1 }, { namn: "Session", username: "s" });
  assert.equal(out.namn, "Riktig");
  assert.equal(out.username, "s"); // username saknades → fylls
});

test("withEntryName utan känd källa lämnar patchen orörd (ingen tom-sträng skrivs)", () => {
  const out = withEntryName({ xp: 5 }, {});
  assert.deepEqual(out, { xp: 5 });
  assert.equal("namn" in out, false);
});

test("withEntryName returnerar en KOPIA (muterar inte inpatchen)", () => {
  const src = { stars: 2 };
  const out = withEntryName(src, { namn: "Bo" });
  assert.equal("namn" in src, false, "originalet orört");
  assert.equal(out.namn, "Bo");
});

test("boendeMissingNameIds: bara poster helt utan namn OCH username", () => {
  const boende = [
    { id: "a", namn: "Anna" },
    { id: "b", username: "bo" }, // username räknas som namn
    { id: "c" }, // helt utan → glapp
    { id: "d", namn: "", username: "" }, // tomma → glapp
    { namn: "utan id" }, // inget id → hoppas
  ];
  assert.deepEqual(boendeMissingNameIds(boende), ["c", "d"]);
  assert.deepEqual(boendeMissingNameIds([]), []);
  assert.deepEqual(boendeMissingNameIds(null), []);
});

// --- KRAV 1: varje skrivning bär namn (identityFor) ------------------------

test("updateStudentProjection berikar med namn ur identityFor (befintligt dok)", async () => {
  const fake = makeFakeDb({
    classProjections: { "6a": { members: { anna: { namn: "Anna", stars: 0 } } } },
  });
  fake.adapter.identityFor = (id) =>
    id === "anna" ? { namn: "Anna", username: "anna" } : {};
  const store = createClassProjectionStore(fake.adapter);

  // Award-liknande partiell patch UTAN namn.
  await store.updateStudentProjection("6a", "anna", { stars: 3, xp: 42 });

  const doc = fake.store.get("classProjections/6a");
  assert.equal(doc.members.anna.stars, 3);
  assert.equal(doc.members.anna.namn, "Anna", "namn skrevs med");
  assert.equal(doc.members.anna.username, "anna");
});

test("updateStudentProjection bär namn även i setDoc-fallbacken (dok saknas)", async () => {
  const fake = makeFakeDb({});
  fake.adapter.identityFor = (id) =>
    id === "anna" ? { namn: "Anna", username: "anna" } : {};
  const store = createClassProjectionStore(fake.adapter);

  // Ingen projektion finns → updateDoc kastar not-found → setDoc merge-fallback.
  await store.updateStudentProjection("nyklass", "anna", { stars: 2, husLast: true });

  assert.equal(fake.counts.updateDoc, 1, "försökte updateDoc först");
  assert.equal(fake.counts.setDoc, 1, "föll tillbaka på setDoc merge");
  const doc = fake.store.get("classProjections/nyklass");
  assert.equal(doc.members.anna.stars, 2);
  assert.equal(doc.members.anna.husLast, true);
  assert.equal(doc.members.anna.namn, "Anna", "namnet kom med i den skapade posten");
});

test("updateStudentProjection: tom patch är no-op även MED identityFor (skriver inte)", async () => {
  const fake = makeFakeDb({ classProjections: { "6a": { members: {} } } });
  fake.adapter.identityFor = () => ({ namn: "Anna", username: "anna" });
  const store = createClassProjectionStore(fake.adapter);
  await store.updateStudentProjection("6a", "anna", {});
  assert.equal(fake.counts.updateDoc, 0, "en ren läs-väg börjar aldrig skriva");
  assert.equal(fake.counts.setDoc, 0);
});

test("updateStudentProjection: explicit namn i patchen vinner över identityFor (lärare)", async () => {
  const fake = makeFakeDb({
    classProjections: { "6a": { members: { bo: { namn: "Gammalt" } } } },
  });
  // identityFor svarar med ett ANNAT namn – ska INTE användas när patch har namn.
  fake.adapter.identityFor = () => ({ namn: "FelSession", username: "fel" });
  const store = createClassProjectionStore(fake.adapter);
  await store.updateStudentProjection("6a", "bo", { namn: "Nytt", avatarId: "owl" });
  const doc = fake.store.get("classProjections/6a");
  assert.equal(doc.members.bo.namn, "Nytt", "lärarens explicita namn behålls");
});

test("updateStudentProjectionAllClasses bär namn i ALLA elevens klasser", async () => {
  const fake = makeFakeDb({
    classes: { "6a": { studentIds: ["anna"] }, grupp: { studentIds: ["anna"] } },
    classProjections: {
      "6a": { members: { anna: { namn: "Anna", stars: 0 } } },
      grupp: { members: { anna: { namn: "Anna", stars: 0 } } },
    },
  });
  fake.adapter.identityFor = (id) =>
    id === "anna" ? { namn: "Anna", username: "anna" } : {};
  const store = createClassProjectionStore(fake.adapter);
  await store.updateStudentProjectionAllClasses("anna", { stars: 7 });
  for (const cid of ["6a", "grupp"]) {
    const doc = fake.store.get(`classProjections/${cid}`);
    assert.equal(doc.members.anna.stars, 7);
    assert.equal(doc.members.anna.namn, "Anna");
  }
});

// --- KRAV 2: defensiv läsning läker en namnlös post ur students/{id} -------

test("getClassOverview: namnlös post läks ur students/{id} (defensiv fallback)", async () => {
  const fake = makeFakeDb({
    classProjections: {
      "6a": {
        members: {
          anna: { namn: "Anna", stars: 2, avatarId: "fox" },
          bo: { stars: 1, avatarId: "owl" }, // GLAPP: ingen namn/username
        },
      },
    },
    students: { bo: { namn: "Bo", username: "bo", avatarId: "owl" } },
  });
  const store = createClassProjectionStore(fake.adapter);

  const boende = await store.getClassOverview("6a", ["anna", "bo"]);
  const bo = boende.find((b) => b.id === "bo");
  assert.equal(bo.namn, "Bo", "namnet hämtades ur students/bo");
  const anna = boende.find((b) => b.id === "anna");
  assert.equal(anna.namn, "Anna");
});

test("getClassOverview: alla poster har namn → INGEN extra students-läsning (O(1))", async () => {
  const fake = makeFakeDb({
    classProjections: {
      "6a": { members: { anna: { namn: "Anna" }, bo: { namn: "Bo" } } },
    },
    students: { anna: { namn: "Anna" }, bo: { namn: "Bo" } },
  });
  const store = createClassProjectionStore(fake.adapter);
  await store.getClassOverview("6a", ["anna", "bo"]);
  // Exakt 1 getDoc = projektionen. INGEN students/{id}-läsning tillkom.
  assert.equal(fake.counts.getDoc, 1, "namn fanns redan → 0 defensiva läsningar");
});

test("getClassOverview: en post utan students-dok behåller uid tyst (best-effort)", async () => {
  const fake = makeFakeDb({
    classProjections: { "6a": { members: { spoke: { stars: 0 } } } },
    // inget students/spoke
  });
  const store = createClassProjectionStore(fake.adapter);
  const boende = await store.getClassOverview("6a", ["spoke"]);
  // Namnet gick inte att läka → posten finns kvar (vyn ritar uid, men vyn faller
  // aldrig). namn förblir tom sträng.
  assert.equal(boende.length, 1);
  assert.equal(boende[0].id, "spoke");
  assert.equal(boende[0].namn, "");
});
