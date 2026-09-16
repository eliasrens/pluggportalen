// ============================================================================
// Testfixtur: en FEJK-Firestore i minnet för klass-projektions-testerna.
// ----------------------------------------------------------------------------
// Delas av class-projection.test.js och class-projection-names.test.js (#316)
// så fixturen bara finns på ETT ställe (och ingen av testfilerna spränger
// 400-radstaket). Ingen .test.js-ändelse → node --test kör INTE denna som ett
// testblock, den bara importeras.
//
// Dokument lagras platt på "collection/id". doc()/collection() returnerar bara
// en beskrivning; getDoc/getDocs slår upp och RÄKNAR (counts.*). setDoc merge
// deep-mergar; updateDoc applicerar fält-paths och kastar not-found om
// dokumentet saknas – exakt som den riktiga adaptern beter sig.
// ============================================================================

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

/**
 * Bygg en fejk-Firestore med räknare.
 * @param {object} seed { students, studentData, classes, classProjections } –
 *   var och en { id: data }.
 * @returns {{ adapter, counts, store, setClock, advance }}
 */
export function makeFakeDb(seed = {}) {
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
