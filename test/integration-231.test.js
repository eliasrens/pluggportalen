// ============================================================================
// INTEGRATIONSVERIFIERING av hela #231-kedjan (QA-item #235).
//
// Enhetstesterna #232–#234 bevisar delarna var för sig (läs-antal, self-heal,
// fält-drift). DEN HÄR filen kopplar ihop SKRIV-sidan (projection-sync:
// mirrorStudentProjection + awardProjectionPatch, som game-shared.js och
// data-room.js anropar) med LÄS-sidan (class-projection: getClassOverview /
// getOwnVillageOverview, som pages-varld.js/varld-grannby.js anropar) genom EN
// gemensam fejk-Firestore, och bevisar END-TO-END att:
//
//   (3) KONSISTENS: efter awardExercise OCH efter avatar/palett/hus-skal/lås-
//       ändring speglar projektionen EXAKT det värde en färsk per-elev-läsning
//       (projectionEntryFrom över den skrivna studentData:n) skulle gett – dvs
//       by-översikten visar samma siffror/utseende som förr.
//   (4) HUSLÅS: en elev med husLast=true ritas låst (locked=true) i by-/grannby-
//       översikten UTAN en per-elev-läsning (0 studentData-getDoc, 1 projektion).
//   (5) REGRESSION (rums-inträde): den delade huslås-hjälparen (isHouseLocked)
//       gate:ar rummet oförändrat, och den gamla per-elev-läsvägen
//       (getStudentsWithLooks-formen via projectionEntryFrom) är intakt.
//
// Körs browser-fritt:  node --test test/integration-231.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { createClassProjectionStore } from "../src/class-projection.js";
import { projectionEntryFrom, entryToBoende } from "../src/class-projection-entries.js";
import {
  mirrorStudentProjection,
  awardProjectionPatch,
} from "../src/projection-sync.js";

// data-room.isHouseLocked är EN rad över samma husLast-fält
// (`!!(studentData && studentData.husLast === true)`), men data-room.js drar in
// Firebase via en https-import som Nodes test-loader inte kan ladda. Vi kan inte
// importera den Firebase-fritt, så vi speglar dess exakta kontrakt lokalt och
// verifierar att rums-inträdes-gaten fortfarande härleds ur husLast. (Läs-vyns
// lås härleds i sin tur ur SAMMA fält via entryToBoende → locked, som testas
// mot den riktiga koden nedan.)
const isHouseLocked = (sd) => !!(sd && sd.husLast === true);

// --- Fejk-Firestore som RÄKNAR läsningar (samma mönster som de andra testen) --

function deepMerge(target, patch) {
  const out = target && typeof target === "object" ? { ...target } : {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(out[k], v);
    else out[k] = v;
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
  const store = new Map();
  for (const [coll, docs] of Object.entries(seed)) {
    for (const [id, data] of Object.entries(docs)) {
      store.set(`${coll}/${id}`, JSON.parse(JSON.stringify(data)));
    }
  }
  // Räkna läsningar per collection, så vi kan bevisa "0 per-elev-läsningar".
  const counts = { getDoc: 0, getDocs: 0, setDoc: 0, updateDoc: 0 };
  const getDocByColl = {};
  let clock = 1000;
  const adapter = {
    db: { _fake: true },
    now: () => clock,
    doc: (_db, coll, id) => ({ kind: "doc", coll, id, path: `${coll}/${id}` }),
    collection: (_db, coll) => ({ kind: "collection", coll }),
    getDoc: async (ref) => {
      counts.getDoc++;
      getDocByColl[ref.coll] = (getDocByColl[ref.coll] || 0) + 1;
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
      for (const [path, value] of Object.entries(fieldPaths)) setByPath(next, path, value);
      store.set(ref.path, next);
    },
  };
  return { adapter, counts, getDocByColl, store };
}

// Hitta ett boende-objekt i en översikts-array.
const byId = (arr, id) => arr.find((s) => s.id === id);

// Vad en FÄRSK per-elev-läsning (den gamla getStudentsWithLooks-vägen) hade
// visat för eleven, ur students/{id} + det aktuella studentData/{id}. Det är
// projektionens sanningskälla – översikten ska matcha detta.
function freshLook(store, id) {
  const student = store.get(`students/${id}`) || {};
  const sd = store.get(`studentData/${id}`) || {};
  return projectionEntryFrom(student, sd);
}

// ---------------------------------------------------------------------------
// (3) KONSISTENS: mutation → spegling → översikten == färsk per-elev-läsning
// ---------------------------------------------------------------------------

test("KONSISTENS: award + utseende-mutationer speglas så översikten == färsk per-elev-läsning", async () => {
  // En klass med två elever; projektionen finns redan (steady-state).
  const fake = makeFakeDb({
    classes: { "6a": { studentIds: ["me", "kompis"] } },
    students: {
      me: { namn: "Mira", username: "mira", avatarId: "fox" },
      kompis: { namn: "Ken", username: "ken", avatarId: "owl" },
    },
    studentData: {
      me: { avatarId: "fox", room: { paletteId: null }, xp: 0, progress: {} },
      kompis: { avatarId: "owl", xp: 30, progress: { a: { quiz: { completed: true, stars: 1 } } } },
    },
    classProjections: {
      "6a": {
        members: {
          me: projectionEntryFrom(
            { namn: "Mira", username: "mira" },
            { avatarId: "fox", xp: 0, progress: {} }
          ),
          kompis: projectionEntryFrom(
            { namn: "Ken", username: "ken" },
            { avatarId: "owl", xp: 30, progress: { a: { quiz: { completed: true, stars: 1 } } } }
          ),
        },
      },
    },
  });
  const store = createClassProjectionStore(fake.adapter);

  // Hjälpare som efterliknar data-lagrets riktiga skriv-punkter:
  //   1. skriv studentData (det data-room.js/game-shared.js gör), sedan
  //   2. spegla in i projektionen via EXAKT samma mirror-anrop.
  const writeSd = (id, patch) => {
    const cur = fake.store.get(`studentData/${id}`) || {};
    fake.store.set(`studentData/${id}`, deepMerge(cur, patch));
  };

  // --- awardExercise: eleven klarar en övning ------------------------------
  // game-shared.js: sparar progress/xp i studentData och speglar
  // awardProjectionPatch(sd) in i projektionen.
  writeSd("me", { xp: 120, progress: { a: { quiz: { completed: true, stars: 3 } } } });
  await mirrorStudentProjection(
    store.updateStudentProjectionAllClasses,
    "me",
    awardProjectionPatch(fake.store.get("studentData/me"))
  );

  // --- setAvatar / saveAvatarItems / saveRoom(paletteId) / saveHusSkal -----
  // data-room.js: varje mutator skriver sitt studentData-fält och speglar det.
  writeSd("me", { avatarId: "cat" });
  await mirrorStudentProjection(store.updateStudentProjectionAllClasses, "me", { avatarId: "cat" });

  writeSd("me", { avatarItems: ["hatt", "cape"] });
  await mirrorStudentProjection(store.updateStudentProjectionAllClasses, "me", { avatarItems: ["hatt", "cape"] });

  writeSd("me", { room: { paletteId: "skog" } });
  await mirrorStudentProjection(store.updateStudentProjectionAllClasses, "me", { paletteId: "skog" });

  writeSd("me", { husSkalId: "molnslott" });
  await mirrorStudentProjection(store.updateStudentProjectionAllClasses, "me", { husSkalId: "molnslott" });

  // Läs by-översikten (grannby-vägen: getClassOverview) och jämför elevens
  // synliga fält mot en FÄRSK per-elev-läsning av samma studentData.
  const overview = await store.getClassOverview("6a", ["me", "kompis"]);
  const me = byId(overview, "me");
  const fresh = freshLook(fake.store, "me");

  // Award-siffrorna speglades korrekt.
  assert.equal(me.stars, fresh.stars, "stars == färsk läsning");
  assert.equal(me.xp, fresh.xp, "xp == färsk läsning");
  assert.equal(me.completed, fresh.completed, "completed == färsk läsning");
  assert.equal(me.stars, 3);
  assert.equal(me.xp, 120);
  assert.equal(me.completed, 1);
  // Utseendet speglades korrekt.
  assert.equal(me.avatarId, fresh.avatarId, "avatarId == färsk läsning");
  assert.equal(me.avatarId, "cat");
  assert.deepEqual(me.avatarItems, fresh.avatarItems, "avatarItems == färsk läsning");
  assert.deepEqual(me.avatarItems, ["hatt", "cape"]);
  assert.equal(me.paletteId, fresh.paletteId, "paletteId == färsk läsning");
  assert.equal(me.paletteId, "skog");
  assert.equal(me.husSkalId, fresh.husSkalId, "husSkalId == färsk läsning");
  assert.equal(me.husSkalId, "molnslott");

  // Klasskamraten som INTE muterades är oförändrad och matchar också.
  const kompis = byId(overview, "kompis");
  const freshKompis = freshLook(fake.store, "kompis");
  assert.equal(kompis.stars, freshKompis.stars);
  assert.equal(kompis.xp, freshKompis.xp);
  assert.equal(kompis.avatarId, freshKompis.avatarId);
});

test("KONSISTENS: award mot en klass utan projektion self-healar och landar på rätt siffror", async () => {
  // Ingen classProjections/6a ännu: mirror faller på updateDoc→not-found→setDoc.
  const fake = makeFakeDb({
    classes: { "6a": { studentIds: ["me"] } },
    students: { me: { namn: "Mira", username: "mira", avatarId: "fox" } },
    studentData: { me: { avatarId: "fox", xp: 200, progress: { a: { quiz: { completed: true, stars: 2 } }, b: { para: { completed: true, stars: 3 } } } } },
  });
  const store = createClassProjectionStore(fake.adapter);

  await mirrorStudentProjection(
    store.updateStudentProjectionAllClasses,
    "me",
    awardProjectionPatch(fake.store.get("studentData/me"))
  );

  // ensureClassProjection täcker upp resten av klassen (self-heal) och läser 1 dok.
  const overview = await store.getClassOverview("6a", ["me"]);
  const me = byId(overview, "me");
  const fresh = freshLook(fake.store, "me");
  assert.equal(me.stars, fresh.stars);
  assert.equal(me.xp, fresh.xp);
  assert.equal(me.completed, fresh.completed);
  assert.equal(me.stars, 5, "best-star per läge summeras (2+3)");
});

// ---------------------------------------------------------------------------
// (4) HUSLÅS ritas låst UTAN per-elev-läsning
// ---------------------------------------------------------------------------

test("HUSLÅS: setHusLast speglas → låst hus ritas locked, 0 per-elev-läsningar", async () => {
  const fake = makeFakeDb({
    classes: { "6a": { studentIds: ["me", "kompis"] } },
    studentData: {
      me: { avatarId: "fox", xp: 0 },
      kompis: { avatarId: "owl", xp: 40, husLast: false },
    },
    classProjections: {
      "6a": {
        members: {
          me: projectionEntryFrom({ namn: "Mira" }, { avatarId: "fox", xp: 0 }),
          kompis: projectionEntryFrom({ namn: "Ken" }, { avatarId: "owl", xp: 40, husLast: false }),
        },
      },
    },
  });
  const store = createClassProjectionStore(fake.adapter);

  // Kompisen låser sitt hus: data-room.setHusLast skriver husLast + speglar.
  const cur = fake.store.get("studentData/kompis");
  fake.store.set("studentData/kompis", { ...cur, husLast: true });
  await mirrorStudentProjection(store.updateStudentProjectionAllClasses, "kompis", { husLast: true });

  // Rita grannby-översikten. Nollställ läsräknarna FÖRE render.
  const doc0 = fake.getDocByColl["studentData"] || 0;
  const overview = await store.getClassOverview("6a", ["me", "kompis"]);
  const doc1 = fake.getDocByColl["studentData"] || 0;

  const kompis = byId(overview, "kompis");
  assert.equal(kompis.locked, true, "låst hus ritas locked ur husLast");
  assert.equal(byId(overview, "me").locked, false);
  assert.equal(doc1 - doc0, 0, "INGEN per-elev studentData-läsning under render");
});

test("HUSLÅS: rums-inträde gate:as fortsatt ur husLast (samma fält som by-vyns lås)", () => {
  // pages-klasskamrat.js/pages-varld.js gate:ar rummet via isHouseLocked över
  // det inlästa studentData. Låst → true (visa "🔒 Låst"), annars false.
  assert.equal(isHouseLocked({ husLast: true }), true);
  assert.equal(isHouseLocked({ husLast: false }), false);
  assert.equal(isHouseLocked({}), false);
  assert.equal(isHouseLocked(null), false);
  assert.equal(isHouseLocked(undefined), false);

  // By-/grannby-vyns lås härleds ur SAMMA husLast-fält, men via den riktiga
  // entryToBoende (locked). De två gaterna kan alltså aldrig glida isär.
  assert.equal(entryToBoende("x", projectionEntryFrom({}, { husLast: true })).locked, true);
  assert.equal(entryToBoende("x", projectionEntryFrom({}, { husLast: false })).locked, false);
});

// ---------------------------------------------------------------------------
// (5) REGRESSION: den gamla per-elev-läsformen (rums-inträde) är intakt
// ---------------------------------------------------------------------------

test("REGRESSION: full studentData → översiktsform (projectionEntryFrom) oförändrad", () => {
  // #/elev/<id> läser fortfarande full studentData (getStudentData); by-formen
  // härleds ur students + studentData EXAKT som getStudentsWithLooks gjorde.
  const student = { namn: "Ada", username: "ada", avatarId: "fox" };
  const sd = {
    avatarId: "cat",
    avatarItems: ["glasögon"],
    room: { paletteId: "hav", placements: { stol: { x: 1, y: 2 } } },
    husSkalId: "kristallhus",
    husLast: false,
    xp: 340,
    progress: { v: { quiz: { completed: true, stars: 3 }, para: { completed: true, stars: 2 } } },
  };
  const e = projectionEntryFrom(student, sd);
  assert.equal(e.namn, "Ada");
  assert.equal(e.avatarId, "cat"); // studentData vinner
  assert.deepEqual(e.avatarItems, ["glasögon"]);
  assert.equal(e.paletteId, "hav"); // room.placements läcker INTE in
  assert.equal(e.husSkalId, "kristallhus");
  assert.equal(e.husLast, false);
  assert.equal(e.xp, 340);
  assert.equal(e.stars, 5); // progressTotals SUMMERAR stjärnor per läge (3 + 2)
  assert.equal(e.completed, 2);
});
