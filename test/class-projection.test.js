// ============================================================================
// Enhetstest för klass-projektionen (src/class-projection.js) – data-lagret
// bakom by-/grannby-översiktens O(1)-läsning (#231/#232).
//
// Kärnan är Firebase-fri: den tar en injicerad adapter. Här bygger vi en
// FEJK-Firestore i minnet som RÄKNAR getDoc/getDocs, så vi kan bevisa
// O(1)-läsningen, self-heal och fält-path-skrivningen. Körs browser-fritt:
//   node --test test/class-projection.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createClassProjectionStore,
  projectionEntryFrom,
  fallbackEntryFrom,
  missingMemberIds,
} from "../src/class-projection.js";

// --- Fejk-Firestore --------------------------------------------------------
// Dokument lagras platt på "collection/id". doc()/collection() returnerar bara
// en beskrivning; getDoc/getDocs slår upp och RÄKNAR. setDoc merge deep-mergar;
// updateDoc applicerar fält-paths och kastar not-found om dokumentet saknas.

function deepMerge(target, patch) {
  const out = target && typeof target === "object" ? { ...target } : {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function makeFakeDb(seed = {}) {
  // seed: { "students": {id: data}, "studentData": {id:data}, "classes": {id:data}, "classProjections": {id:data} }
  const store = new Map(); // key "collection/id" -> data object
  for (const [coll, docs] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(docs)) {
      store.set(`${coll}/${id}`, JSON.parse(JSON.stringify(data)));
    }
  }
  const counts = { getDoc: 0, getDocs: 0, setDoc: 0, updateDoc: 0 };
  let clock = 1000;

  const adapter = {
    db: { _fake: true },
    now: () => clock,
    doc: (_db, coll, id) => ({ kind: "doc", coll, id, path: `${coll}/${id}` }),
    collection: (_db, coll) => ({ kind: "collection", coll }),
    getDoc: async (ref) => {
      counts.getDoc++;
      const data = store.get(ref.path);
      return {
        id: ref.id,
        exists: () => data !== undefined,
        data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))),
      };
    },
    getDocs: async (ref) => {
      counts.getDocs++;
      const prefix = `${ref.coll}/`;
      const docs = [];
      for (const [key, data] of store.entries()) {
        if (key.startsWith(prefix)) {
          const id = key.slice(prefix.length);
          docs.push({ id, data: () => JSON.parse(JSON.stringify(data)) });
        }
      }
      return { docs, forEach: (fn) => docs.forEach(fn) };
    },
    setDoc: async (ref, data, opts) => {
      counts.setDoc++;
      const existing = store.get(ref.path);
      if (opts && opts.merge && existing) {
        store.set(ref.path, deepMerge(existing, data));
      } else {
        store.set(ref.path, JSON.parse(JSON.stringify(data)));
      }
    },
    updateDoc: async (ref, fieldPaths) => {
      counts.updateDoc++;
      const existing = store.get(ref.path);
      if (existing === undefined) {
        const err = new Error("No document to update");
        err.code = "not-found";
        throw err;
      }
      const next = JSON.parse(JSON.stringify(existing));
      for (const [path, value] of Object.entries(fieldPaths)) setByPath(next, path, value);
      store.set(ref.path, next);
    },
  };
  return {
    adapter,
    counts,
    store,
    setClock: (t) => {
      clock = t;
    },
    advance: (dt) => {
      clock += dt;
    },
  };
}

// --- Rena hjälpare ---------------------------------------------------------

test("projectionEntryFrom bär ALLA översiktsfält inkl husLast", () => {
  const student = { namn: "Anna", username: "anna", avatarId: "fox" };
  const sd = {
    avatarId: "cat",
    avatarItems: ["hatt"],
    room: { paletteId: "skog" },
    husSkalId: "molnslott",
    husLast: true,
    xp: 120,
    progress: { area1: { quiz: { completed: true, stars: 3 } } },
  };
  const e = projectionEntryFrom(student, sd);
  assert.equal(e.namn, "Anna");
  assert.equal(e.username, "anna");
  assert.equal(e.avatarId, "cat"); // studentData vinner över students
  assert.deepEqual(e.avatarItems, ["hatt"]);
  assert.equal(e.paletteId, "skog");
  assert.equal(e.husSkalId, "molnslott");
  assert.equal(e.husLast, true);
  assert.equal(e.xp, 120);
  assert.equal(e.completed, 1);
  assert.equal(e.stars, 3);
  // exakt fältuppsättningen (inget läcker, inget saknas)
  assert.deepEqual(
    Object.keys(e).sort(),
    ["avatarId", "avatarItems", "completed", "husLast", "husSkalId", "namn", "paletteId", "stars", "username", "xp"]
  );
});

test("projectionEntryFrom faller tillbaka snällt på tom data", () => {
  const e = projectionEntryFrom({ namn: "Bo", avatarId: "owl" }, {});
  assert.equal(e.avatarId, "owl");
  assert.deepEqual(e.avatarItems, []);
  assert.equal(e.paletteId, null);
  assert.equal(e.husSkalId, null);
  assert.equal(e.husLast, false);
  assert.equal(e.xp, 0);
});

test("fallbackEntryFrom: locked=true → husLast true, default-utseende", () => {
  const e = fallbackEntryFrom({ namn: "Cia", avatarId: "fox" }, true);
  assert.equal(e.husLast, true);
  assert.equal(e.avatarId, "fox");
  assert.deepEqual(e.avatarItems, []);
});

test("missingMemberIds ger de id som saknar entry", () => {
  assert.deepEqual(missingMemberIds({ a: {}, b: {} }, ["a", "b", "c"]), ["c"]);
  assert.deepEqual(missingMemberIds({}, ["a"]), ["a"]);
  assert.deepEqual(missingMemberIds({ a: {} }, ["a"]), []);
});

// --- getClassProjection: EXAKT 1 läsning + cache ---------------------------

test("getClassProjection läser exakt 1 dokument", async () => {
  const fake = makeFakeDb({
    classProjections: { "6a": { members: { anna: { namn: "Anna", stars: 2 } } } },
  });
  const store = createClassProjectionStore(fake.adapter);
  const proj = await store.getClassProjection("6a");
  assert.equal(fake.counts.getDoc, 1, "exakt 1 getDoc för hela klassen");
  assert.equal(fake.counts.getDocs, 0);
  assert.equal(proj.members.anna.stars, 2);
});

test("getClassProjection cachar inom TTL (0 extra läsningar)", async () => {
  const fake = makeFakeDb({ classProjections: { "6a": { members: {} } } });
  const store = createClassProjectionStore(fake.adapter);
  await store.getClassProjection("6a");
  await store.getClassProjection("6a");
  assert.equal(fake.counts.getDoc, 1, "andra läsningen kom från cachen");
  // Efter TTL läses igen.
  fake.advance(60_000);
  await store.getClassProjection("6a");
  assert.equal(fake.counts.getDoc, 2);
});

test("getClassProjection: saknat dokument → tom members, 1 läsning", async () => {
  const fake = makeFakeDb({});
  const store = createClassProjectionStore(fake.adapter);
  const proj = await store.getClassProjection("tom");
  assert.equal(fake.counts.getDoc, 1);
  assert.deepEqual(proj.members, {});
});

// --- ensureClassProjection: self-heal --------------------------------------

test("ensureClassProjection self-healar: saknad → per-elev en gång → 1 dok efteråt", async () => {
  const fake = makeFakeDb({
    students: {
      anna: { namn: "Anna", username: "anna", avatarId: "fox" },
      bo: { namn: "Bo", username: "bo", avatarId: "owl" },
    },
    studentData: {
      anna: { avatarItems: ["hatt"], room: { paletteId: "skog" }, xp: 50, husLast: false },
      bo: { husSkalId: "molnslott", xp: 10 },
    },
    // ingen classProjections/6a ännu
  });
  const store = createClassProjectionStore(fake.adapter);

  const res = await store.ensureClassProjection("6a", ["anna", "bo"]);
  assert.equal(res.healed, true, "self-heal skedde");
  assert.equal(res.members.anna.paletteId, "skog");
  assert.equal(res.members.anna.avatarItems.length, 1);
  assert.equal(res.members.bo.husSkalId, "molnslott");
  assert.equal(res.members.anna.husLast, false);

  // Läsningar under self-heal: 1 (projektions-getDoc, tom) + 2 per elev (students+studentData) = 5.
  assert.equal(fake.counts.getDoc, 5);
  assert.equal(fake.counts.setDoc, 1, "projektionen skrevs en gång");

  // Projektionen finns nu i "db". En färsk läsning (cache invaliderad av heal)
  // kostar EXAKT 1 dokument.
  const before = fake.counts.getDoc;
  const proj = await store.getClassProjection("6a");
  assert.equal(fake.counts.getDoc - before, 1, "efterföljande läsning = 1 dok");
  assert.equal(proj.members.anna.namn, "Anna");
  assert.equal(proj.members.bo.namn, "Bo");
});

test("ensureClassProjection: komplett projektion → ingen skrivning, ingen heal", async () => {
  const fake = makeFakeDb({
    classProjections: {
      "6a": { members: { anna: { namn: "Anna" }, bo: { namn: "Bo" } } },
    },
  });
  const store = createClassProjectionStore(fake.adapter);
  const res = await store.ensureClassProjection("6a", ["anna", "bo"]);
  assert.equal(res.healed, false);
  assert.equal(fake.counts.setDoc, 0);
  assert.equal(fake.counts.getDoc, 1, "bara projektions-läsningen");
});

test("ensureClassProjection: DELVIS saknad medlem byggs (bara den saknade)", async () => {
  const fake = makeFakeDb({
    classProjections: { "6a": { members: { anna: { namn: "Anna" } } } },
    students: { bo: { namn: "Bo", avatarId: "owl" } },
    studentData: { bo: { xp: 5 } },
  });
  const store = createClassProjectionStore(fake.adapter);
  const res = await store.ensureClassProjection("6a", ["anna", "bo"]);
  assert.equal(res.healed, true);
  assert.equal(res.members.bo.namn, "Bo");
  assert.equal(res.members.anna.namn, "Anna"); // befintlig bevarad
  // 1 projektionsläsning + 2 (bo:s students+studentData). anna byggs INTE om.
  assert.equal(fake.counts.getDoc, 3);
});

test("ensureClassProjection: cross-class nekad SKRIVNING → ritar ändå (best-effort, kastar ej)", async () => {
  // Grannby-fallet: en besökare får enligt reglerna inte skriva en ANNAN klass
  // projektion. Self-heal-skrivningen nekas → får ALDRIG fälla vyn.
  const fake = makeFakeDb({
    students: { anna: { namn: "Anna", avatarId: "fox" }, bo: { namn: "Bo", avatarId: "owl" } },
    studentData: { anna: { xp: 30 }, bo: { xp: 5 } },
  });
  fake.adapter.setDoc = async () => {
    const err = new Error("Missing or insufficient permissions");
    err.code = "permission-denied";
    throw err;
  };
  const store = createClassProjectionStore(fake.adapter);
  const res = await store.ensureClassProjection("7b", ["anna", "bo"]);
  // Vyn får datan trots att skrivningen nekades:
  assert.equal(res.healed, true);
  assert.equal(res.members.anna.namn, "Anna");
  assert.equal(res.members.bo.namn, "Bo");
  assert.equal(res.members.anna.xp, 30);
});

test("ensureClassProjection: ICKE-permission-fel på skrivning bubblar (nät e.d.)", async () => {
  const fake = makeFakeDb({
    students: { anna: { namn: "Anna", avatarId: "fox" } },
    studentData: { anna: { xp: 1 } },
  });
  fake.adapter.setDoc = async () => {
    throw new Error("network glitch");
  };
  const store = createClassProjectionStore(fake.adapter);
  await assert.rejects(() => store.ensureClassProjection("7b", ["anna"]), /network glitch/);
});

test("buildProjectionEntries: nekad studentData → husLast true (låst hus)", async () => {
  const fake = makeFakeDb({ students: { cia: { namn: "Cia", avatarId: "fox" } } });
  // Simulera permission-denied på studentData/cia:
  const realGetDoc = fake.adapter.getDoc;
  fake.adapter.getDoc = async (ref) => {
    if (ref.path === "studentData/cia") {
      const err = new Error("Missing or insufficient permissions");
      err.code = "permission-denied";
      throw err;
    }
    return realGetDoc(ref);
  };
  const store = createClassProjectionStore(fake.adapter);
  const map = await store.buildProjectionEntries(["cia"]);
  assert.equal(map.cia.husLast, true, "nekad läsning tolkas som låst hus");
  assert.equal(map.cia.namn, "Cia");
  assert.equal(map.cia.avatarId, "fox");
});

// --- updateStudentProjection: fält-path + cache-invalidering ---------------

test("updateStudentProjection skriver bara egen entry via fält-path + invaliderar cache", async () => {
  const fake = makeFakeDb({
    classProjections: {
      "6a": { members: { anna: { namn: "Anna", stars: 1, xp: 10 }, bo: { namn: "Bo", stars: 5 } } },
    },
  });
  const store = createClassProjectionStore(fake.adapter);

  // Värm cachen.
  await store.getClassProjection("6a");
  assert.equal(fake.counts.getDoc, 1);

  await store.updateStudentProjection("6a", "anna", { stars: 3, xp: 42 });
  assert.equal(fake.counts.updateDoc, 1);
  assert.equal(fake.counts.setDoc, 0, "befintligt dok → updateDoc, ingen setDoc");

  // Rätt fält-paths skrevs, bo orörd.
  const doc = fake.store.get("classProjections/6a");
  assert.equal(doc.members.anna.stars, 3);
  assert.equal(doc.members.anna.xp, 42);
  assert.equal(doc.members.anna.namn, "Anna"); // orörd
  assert.equal(doc.members.bo.stars, 5); // klasskamrat orörd

  // Cachen invaliderades → nästa läsning träffar db igen och ser 3.
  const before = fake.counts.getDoc;
  const proj = await store.getClassProjection("6a");
  assert.equal(fake.counts.getDoc - before, 1, "cache invaliderad efter skrivning");
  assert.equal(proj.members.anna.stars, 3);
});

test("updateStudentProjection tål att dokumentet saknas (setDoc merge-fallback)", async () => {
  const fake = makeFakeDb({});
  const store = createClassProjectionStore(fake.adapter);
  await store.updateStudentProjection("nyklass", "anna", { stars: 2, husLast: true });
  assert.equal(fake.counts.updateDoc, 1, "försökte updateDoc först");
  assert.equal(fake.counts.setDoc, 1, "föll tillbaka på setDoc merge");
  const doc = fake.store.get("classProjections/nyklass");
  assert.equal(doc.members.anna.stars, 2);
  assert.equal(doc.members.anna.husLast, true);
});

test("updateStudentProjection: tom patch är en no-op", async () => {
  const fake = makeFakeDb({ classProjections: { "6a": { members: {} } } });
  const store = createClassProjectionStore(fake.adapter);
  await store.updateStudentProjection("6a", "anna", {});
  assert.equal(fake.counts.updateDoc, 0);
  assert.equal(fake.counts.setDoc, 0);
});

// --- classIdsForStudent -----------------------------------------------------

test("classIdsForStudent ger alla klasser eleven är med i (1 getDocs)", async () => {
  const fake = makeFakeDb({
    classes: {
      "6a": { studentIds: ["anna", "bo"] },
      "6b": { studentIds: ["cia"] },
      grupp: { studentIds: ["anna", "cia"] },
    },
  });
  const store = createClassProjectionStore(fake.adapter);
  const ids = await store.classIdsForStudent("anna");
  assert.deepEqual(ids.sort(), ["6a", "grupp"]);
  assert.equal(fake.counts.getDocs, 1);
  assert.equal(fake.counts.getDoc, 0);
});

test("updateStudentProjectionAllClasses skriver i alla elevens klasser", async () => {
  const fake = makeFakeDb({
    classes: {
      "6a": { studentIds: ["anna"] },
      grupp: { studentIds: ["anna"] },
    },
    classProjections: {
      "6a": { members: { anna: { stars: 0 } } },
      grupp: { members: { anna: { stars: 0 } } },
    },
  });
  const store = createClassProjectionStore(fake.adapter);
  const touched = await store.updateStudentProjectionAllClasses("anna", { stars: 7 });
  assert.deepEqual(touched.sort(), ["6a", "grupp"]);
  assert.equal(fake.store.get("classProjections/6a").members.anna.stars, 7);
  assert.equal(fake.store.get("classProjections/grupp").members.anna.stars, 7);
});
