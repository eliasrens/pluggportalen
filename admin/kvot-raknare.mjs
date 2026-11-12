// ============================================================================
// Kvotmätning (#841): RÄKNANDE Firestore och Realtime Database för serverkärnan
// i emulatorn – samma räkning som admin/ms-kvot-sim.mjs (Meteorstormen), bruten
// ut så att Kurragömmas mätning (kg-kvot-sim.mjs) kan dela den.
//
//   skapaRaknandeFirestore(rawDb, slag) → { db, server: { las, skriv, perSort } }
//     db ser ut som Admin SDK:s Firestore för kärnan (collection/doc/getAll/
//     runTransaction) och räknar: en läsning per dokument, minst en per fråga
//     eller räknefråga (count) – som Firestores debitering; en skrivning per
//     dokument i set/update/create/delete, även i transaktioner.
//     slag(path) → etikett per samling i perSort ("läs kgPlayers (tx)" …).
//   raknaRtdb(rtdb) → { las, bytes }  patchar Query.prototype.once/get på den
//     instansen: varje serverläsning (child(...).once("value"), frågor) räknas
//     och svarets JSON-storlek summeras.
// ============================================================================

const SKRIV = ["set", "update", "create", "delete"];
const KEDJA = ["collection", "doc", "where", "orderBy", "limit", "select", "startAfter", "count"];
const lasN = (snap) => (snap?.docs ? Math.max(1, snap.size) : 1);
const vag = (t) => t.path || t._queryOptions?.collectionId || t._query?._queryOptions?.collectionId || "fråga";

export function skapaRaknandeFirestore(rawDb, slag = (p) => p) {
  const server = { las: 0, skriv: 0, perSort: {} };
  const sort = (namn, n = 1) => { server.perSort[namn] = (server.perSort[namn] || 0) + n; };
  const ursprung = new WeakMap();
  const ut = (x) => ursprung.get(x) || x;

  function omslut(obj) {
    const p = new Proxy(obj, {
      get(t, namn) {
        const v = t[namn];
        if (typeof v !== "function") return v;
        if (namn === "get") {
          return async (...a) => {
            const s = await v.apply(t, a);
            const n = lasN(s);
            server.las += n;
            sort(`läs ${slag(vag(t))}`, n);
            return s;
          };
        }
        if (SKRIV.includes(namn)) {
          return async (...a) => {
            server.skriv++;
            sort(`skriv ${slag(vag(t))}`);
            return v.apply(t, a.map(ut));
          };
        }
        if (KEDJA.includes(namn)) return (...a) => omslut(v.apply(t, a));
        return v.bind(t);
      },
    });
    ursprung.set(p, obj);
    return p;
  }
  function omslutTx(tx) {
    const w = {
      async get(r) {
        const s = await tx.get(ut(r));
        const n = lasN(s);
        server.las += n;
        sort(`läs ${slag(vag(ut(r)))} (tx)`, n);
        return s;
      },
      async getAll(...rs) {
        const s = await tx.getAll(...rs.map(ut));
        server.las += rs.length;
        for (const r of rs) sort(`läs ${slag(vag(ut(r)))} (tx)`);
        return s;
      },
      ...Object.fromEntries(SKRIV.map((m) => [m, (r, ...a) => {
        server.skriv++;
        sort(`skriv ${slag(vag(ut(r)))} (tx)`);
        tx[m](ut(r), ...a);
        return w;
      }])),
    };
    return w;
  }
  const db = {
    collection: (...a) => omslut(rawDb.collection(...a)),
    doc: (...a) => omslut(rawDb.doc(...a)),
    async getAll(...rs) {
      server.las += rs.length;
      for (const r of rs) sort(`läs ${slag(vag(ut(r)))}`);
      return rawDb.getAll(...rs.map(ut));
    },
    runTransaction: (fn) => rawDb.runTransaction((tx) => fn(omslutTx(tx))),
  };
  return { db, server };
}

export function raknaRtdb(rtdb) {
  const r = { las: 0, bytes: 0 };
  const ref = rtdb.ref("kvot-raknare");
  // Reference ärver once/get från Query – patcha där så child(...)/frågor räknas med.
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(ref));
  const mal = typeof proto.once === "function" ? proto : Object.getPrototypeOf(ref);
  for (const m of ["once", "get"]) {
    const orig = mal[m];
    if (typeof orig !== "function") continue;
    mal[m] = async function (...a) {
      const s = await orig.apply(this, a);
      r.las++;
      try { r.bytes += Buffer.byteLength(JSON.stringify(s?.val?.() ?? null)); } catch { /* inget */ }
      return s;
    };
  }
  return r;
}
