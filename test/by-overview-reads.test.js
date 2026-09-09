// ============================================================================
// Enhetstest för by-/grannby-översiktens LÄS-ANTAL (#234).
//
// Bevisar att den nya projektions-vägen (getClassOverview / getOwnVillageOverview
// i src/class-projection.js) läser:
//   • Öppna egna byn: egna studentData + 1 projektion = ≤2 dok, oavsett klasstorlek.
//   • Öppna en grannklass: O(1) per klass (1 projektion/klass), inte O(elever).
// samt att stjärnor/avatar/palett/hus-skal/lås (husLast → locked) mappas rätt.
//
// Samma FEJK-Firestore-mönster som class-projection.test.js: en in-minnes-adapter
// som RÄKNAR getDoc/getDocs. Körs browser-fritt:
//   node --test test/by-overview-reads.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { createClassProjectionStore } from "../src/class-projection.js";

// --- Fejk-Firestore (kopia av class-projection.test.js:s adapter) ----------

function deepMerge(target, patch) {
  const out = target && typeof target === "object" ? { ...target } : {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function makeFakeDb(seed = {}) {
  const store = new Map();
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
          docs.push({ id: key.slice(prefix.length), data: () => JSON.parse(JSON.stringify(data)) });
        }
      }
      return { docs, forEach: (fn) => docs.forEach(fn) };
    },
    setDoc: async (ref, data, opts) => {
      counts.setDoc++;
      const existing = store.get(ref.path);
      if (opts && opts.merge && existing) store.set(ref.path, deepMerge(existing, data));
      else store.set(ref.path, JSON.parse(JSON.stringify(data)));
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
      for (const [path, value] of Object.entries(fieldPaths)) {
        const parts = path.split(".");
        let cur = next;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
      }
      store.set(ref.path, next);
    },
  };
  return { adapter, counts, store };
}

// En full members-entry (som projectionEntryFrom skulle ha byggt).
function entry(over = {}) {
  return {
    namn: "", username: "", avatarId: "fox", avatarItems: [], paletteId: null,
    husSkalId: null, stars: 0, xp: 0, completed: 0, husLast: false, ...over,
  };
}

// Dränera micro-/makrotask-kön så en fire-and-forget-skrivning (self-publish i
// #240 körs icke-blockerande) hunnit slå igenom innan vi läser fake-db:n.
const flush = () => new Promise((r) => setTimeout(r, 0));

// --- getClassOverview: O(1) per klass --------------------------------------

test("getClassOverview: projektionen finns → EXAKT 1 getDoc, 0 getDocs", async () => {
  const fake = makeFakeDb({
    classProjections: {
      "6a": {
        members: {
          anna: entry({ namn: "Anna", avatarId: "owl", avatarItems: ["hatt"], paletteId: "hav", husSkalId: "molnslott", stars: 5, xp: 200, completed: 4, husLast: false }),
          bo: entry({ namn: "Bo", stars: 1, husLast: true }),
        },
      },
    },
  });
  const store = createClassProjectionStore(fake.adapter);
  const students = await store.getClassOverview("6a", ["anna", "bo"]);

  assert.equal(fake.counts.getDoc, 1, "exakt 1 getDoc för hela klassen");
  assert.equal(fake.counts.getDocs, 0);

  const anna = students.find((s) => s.id === "anna");
  const bo = students.find((s) => s.id === "bo");
  // Stjärnor, avatar, palett, hus-skal mappas rätt.
  assert.equal(anna.stars, 5);
  assert.equal(anna.avatarId, "owl");
  assert.deepEqual(anna.avatarItems, ["hatt"]);
  assert.equal(anna.paletteId, "hav");
  assert.equal(anna.husSkalId, "molnslott");
  assert.equal(anna.xp, 200);
  assert.equal(anna.completed, 4);
  // Lås härleds ur husLast → locked.
  assert.equal(anna.locked, false);
  assert.equal(bo.locked, true);
});

test("getClassOverview: läs-antalet är O(1), inte O(elever)", async () => {
  const members = {};
  const ids = [];
  for (let i = 0; i < 30; i++) {
    const id = `e${i}`;
    ids.push(id);
    members[id] = entry({ namn: `Elev ${i}`, stars: i });
  }
  const fake = makeFakeDb({ classProjections: { "6a": { members } } });
  const store = createClassProjectionStore(fake.adapter);
  const students = await store.getClassOverview("6a", ids);

  assert.equal(fake.counts.getDoc, 1, "1 dok även för 30 elever");
  assert.equal(students.length, 30);
});

// --- getOwnVillageOverview: egna byn ≤2 dok --------------------------------

test("getOwnVillageOverview: egna byn läser egna studentData + 1 projektion (=2)", async () => {
  const fake = makeFakeDb({
    studentData: {
      me: { avatarId: "cat", room: { paletteId: "skog" }, husSkalId: "kristallhus", husLast: false, xp: 500, progress: { a: { quiz: { completed: true, stars: 3 } } } },
    },
    classProjections: {
      "6a": {
        members: {
          // Projektionens self-entry är MEDVETET inaktuell (xp:0) för att bevisa
          // att egna byn läser egna studentData färskt och skriver över den.
          me: entry({ namn: "Jag", username: "jag", avatarId: "fox", xp: 0, stars: 0 }),
          anna: entry({ namn: "Anna", avatarId: "owl", paletteId: "hav", stars: 2, xp: 120, completed: 2, husLast: true }),
        },
      },
    },
  });
  const classes = [{ id: "6a", name: "6A", studentIds: ["me", "anna"] }];
  const store = createClassProjectionStore(fake.adapter);
  const boende = await store.getOwnVillageOverview({ meId: "me", classes, meNamn: "Jag" });

  assert.equal(fake.counts.getDoc, 2, "egna studentData + 1 projektion");
  assert.equal(fake.counts.getDocs, 0);

  const me = boende.find((s) => s.id === "me");
  const anna = boende.find((s) => s.id === "anna");
  // Egen entry byggd ur den FÄRSKA studentData:n (inte projektionens stale 0).
  assert.equal(me.xp, 500);
  assert.equal(me.completed, 1);
  assert.equal(me.stars, 3);
  assert.equal(me.avatarId, "cat");
  assert.equal(me.paletteId, "skog");
  assert.equal(me.husSkalId, "kristallhus");
  assert.equal(me.namn, "Jag");
  // Klasskamraten kommer ur projektionen, lås härlett ur husLast.
  assert.equal(anna.stars, 2);
  assert.equal(anna.locked, true);
});

test("getOwnVillageOverview: flera klasser → O(1)/klass, egen elev dedupas", async () => {
  const fake = makeFakeDb({
    studentData: { me: { avatarId: "cat", xp: 100 } },
    classProjections: {
      "6a": { members: { me: entry({ namn: "Jag" }), a1: entry({ namn: "A1" }), a2: entry({ namn: "A2" }) } },
      "6b": { members: { me: entry({ namn: "Jag" }), b1: entry({ namn: "B1" }) } },
    },
  });
  const classes = [
    { id: "6a", studentIds: ["me", "a1", "a2"] },
    { id: "6b", studentIds: ["me", "b1"] },
  ];
  const store = createClassProjectionStore(fake.adapter);
  const boende = await store.getOwnVillageOverview({ meId: "me", classes, meNamn: "Jag" });

  // egna studentData (1) + 1 projektion per klass (2) = 3, oberoende av elevantal.
  assert.equal(fake.counts.getDoc, 3);
  assert.equal(fake.counts.getDocs, 0);

  // Union över klasserna, egen elev bara EN gång.
  const meCount = boende.filter((s) => s.id === "me").length;
  assert.equal(meCount, 1);
  assert.deepEqual(boende.map((s) => s.id).sort(), ["a1", "a2", "b1", "me"]);
});

test("getOwnVillageOverview: utan klass → bara egna huset (1 studentData-läsning)", async () => {
  const fake = makeFakeDb({ studentData: { me: { avatarId: "cat", xp: 50 } } });
  const store = createClassProjectionStore(fake.adapter);
  const boende = await store.getOwnVillageOverview({ meId: "me", classes: [], meNamn: "Jag" });

  assert.equal(fake.counts.getDoc, 1, "bara egna studentData");
  assert.equal(boende.length, 1);
  assert.equal(boende[0].id, "me");
  assert.equal(boende[0].namn, "Jag");
  assert.equal(boende[0].xp, 50);
});

// --- #240: self-publish av eget (även LÅST) utseende -----------------------

test("getOwnVillageOverview self-publishar riktigt utseende när det skiljer sig (även husLast)", async () => {
  // Eleven är LÅST men har färgat/bytt hus: projektionens self-entry bär det
  // GAMLA/tomma utseendet (som en besökare self-heal:ade utan att kunna läsa den
  // låstas studentData). Egen öppning ska publicera det riktiga utseendet.
  const fake = makeFakeDb({
    studentData: {
      me: { avatarId: "cat", avatarItems: ["hatt"], room: { paletteId: "skog" }, husSkalId: "molnslott", husLast: true, xp: 300 },
    },
    classProjections: {
      "6a": {
        members: {
          me: entry({ namn: "Jag", username: "jag" }), // tomt utseende, husLast:false
          anna: entry({ namn: "Anna" }),
        },
      },
    },
  });
  const classes = [{ id: "6a", studentIds: ["me", "anna"] }];
  const store = createClassProjectionStore(fake.adapter);

  const boende = await store.getOwnVillageOverview({ meId: "me", classes, meNamn: "Jag" });
  // Ingen extra LÄSning: bara egna studentData + 1 projektion.
  assert.equal(fake.counts.getDoc, 2);
  assert.equal(fake.counts.getDocs, 0);

  await flush(); // låt fire-and-forget-skrivningen slå igenom

  // Projektionen bär nu det RIKTIGA utseendet inkl. husLast.
  const meEntry = fake.store.get("classProjections/6a").members.me;
  assert.equal(meEntry.avatarId, "cat");
  assert.deepEqual(meEntry.avatarItems, ["hatt"]);
  assert.equal(meEntry.paletteId, "skog");
  assert.equal(meEntry.husSkalId, "molnslott");
  assert.equal(meEntry.husLast, true, "lås-flaggan hålls färsk men blockerar inte skrivningen");
  // Skrevs via fält-path (updateDoc), inte hel-dok-omskrivning; anna orörd.
  assert.equal(fake.counts.updateDoc, 1);
  assert.equal(fake.store.get("classProjections/6a").members.anna.namn, "Anna");
  // Egen elev i översikten är förstås det färska utseendet.
  const me = boende.find((s) => s.id === "me");
  assert.equal(me.husSkalId, "molnslott");
  assert.equal(me.paletteId, "skog");
});

test("getOwnVillageOverview: self-publishar i ALLA egna klasser (flera klasser)", async () => {
  const fake = makeFakeDb({
    studentData: { me: { avatarId: "cat", room: { paletteId: "skog" }, husLast: true } },
    classProjections: {
      "6a": { members: { me: entry({ namn: "Jag" }) } },
      grupp: { members: { me: entry({ namn: "Jag" }) } },
    },
  });
  const classes = [
    { id: "6a", studentIds: ["me"] },
    { id: "grupp", studentIds: ["me"] },
  ];
  const store = createClassProjectionStore(fake.adapter);
  await store.getOwnVillageOverview({ meId: "me", classes, meNamn: "Jag" });
  await flush();

  assert.equal(fake.counts.getDocs, 0, "self-publish gör INGEN classIdsForStudent-getDocs");
  for (const cid of ["6a", "grupp"]) {
    const m = fake.store.get(`classProjections/${cid}`).members.me;
    assert.equal(m.paletteId, "skog", `${cid} fick riktigt utseende`);
    assert.equal(m.husLast, true);
  }
});

test("getOwnVillageOverview: skriver INTE när utseendet redan matchar (kör två gånger)", async () => {
  const fake = makeFakeDb({
    studentData: {
      me: { avatarId: "cat", avatarItems: ["hatt"], room: { paletteId: "skog" }, husSkalId: "molnslott", husLast: true, xp: 300 },
    },
    classProjections: {
      "6a": {
        members: {
          // Projektionen bär REDAN exakt det färska utseendet.
          me: entry({ namn: "Jag", avatarId: "cat", avatarItems: ["hatt"], paletteId: "skog", husSkalId: "molnslott", husLast: true }),
        },
      },
    },
  });
  const classes = [{ id: "6a", studentIds: ["me"] }];
  const store = createClassProjectionStore(fake.adapter);

  await store.getOwnVillageOverview({ meId: "me", classes, meNamn: "Jag" });
  await flush();
  assert.equal(fake.counts.updateDoc, 0, "lika utseende → ingen skrivning");
  assert.equal(fake.counts.setDoc, 0);

  // Andra körningen (cache invaliderad? nej – ingen skrivning skedde) – ändå ingen skrivning.
  await store.getOwnVillageOverview({ meId: "me", classes, meNamn: "Jag" });
  await flush();
  assert.equal(fake.counts.updateDoc, 0, "andra körningen skriver inte heller");
  assert.equal(fake.counts.setDoc, 0);
});

// --- Self-heal: saknad projektion → engångskostnad, sen 1 dok --------------

test("getClassOverview: saknad projektion self-healar EN gång, sen 1 dok", async () => {
  const fake = makeFakeDb({
    students: { anna: { namn: "Anna", avatarId: "owl" }, bo: { namn: "Bo", avatarId: "fox" } },
    studentData: {
      anna: { room: { paletteId: "hav" }, xp: 90, progress: { a: { quiz: { completed: true, stars: 2 } } } },
      bo: { xp: 10 },
    },
    // classProjections/6a saknas medvetet.
  });
  const store = createClassProjectionStore(fake.adapter);

  const first = await store.getClassOverview("6a", ["anna", "bo"]);
  assert.equal(fake.counts.setDoc, 1, "self-heal skriver projektionen EN gång");
  const anna = first.find((s) => s.id === "anna");
  assert.equal(anna.stars, 2);
  assert.equal(anna.paletteId, "hav");

  // Nästa öppning läser bara projektionen (1 getDoc till).
  const before = fake.counts.getDoc;
  const second = await store.getClassOverview("6a", ["anna", "bo"]);
  assert.equal(fake.counts.getDoc - before, 1, "steady-state = 1 dok");
  assert.equal(fake.counts.setDoc, 1, "ingen ny self-heal");
  assert.equal(second.length, 2);
});
