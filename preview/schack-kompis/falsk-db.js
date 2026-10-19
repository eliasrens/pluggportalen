// ============================================================================
// Förhandsvisningen av kompisläget (#780): en liten låtsas-Firestore (Admin-
// SDK:ns form) i localStorage, delad mellan flikarna i samma webbläsare.
// Den RIKTIGA serverkoden (functions/schack-lobby.js, schack-parti.js) körs mot
// den här i sidan – samma regler, samma transaktioner, samma fel – så två
// flikar kan spela mot varandra utan Firebase.
//
//   const db = skapaFalskDb({ nyckel });   db.collection("x").doc("y").get()
//   db.runTransaction(async (tx) => …)     tx.get / tx.set(ref, data, { merge }) / tx.update
//   db.las(path) / db.skriv(path, data)    direkt (seed, lyssnare)
//   db.lyssna(fn)                          fn() vid varje ändring (även från andra flikar)
//   db.stang()                             sluta lyssna på andra flikar
// Transaktionerna låses mellan flikarna med Web Locks (navigator.locks) när det finns.
// ============================================================================

const kopia = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const arObjekt = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Firestores merge: true – kartor slås ihop rekursivt, allt annat ersätts. */
function sammanfoga(gammal, ny) {
  if (!arObjekt(gammal) || !arObjekt(ny)) return kopia(ny);
  const ut = { ...gammal };
  for (const [k, v] of Object.entries(ny)) ut[k] = arObjekt(v) && arObjekt(gammal[k]) ? sammanfoga(gammal[k], v) : kopia(v);
  return ut;
}

/** update(): fältvägar med punkt ("schack.datorPartier") sätts på djupet. */
function uppdatera(gammal, falt) {
  const ut = kopia(gammal) || {};
  for (const [vag, v] of Object.entries(falt)) {
    const delar = vag.split(".");
    let o = ut;
    for (const d of delar.slice(0, -1)) o = arObjekt(o[d]) ? o[d] : (o[d] = {});
    const sista = delar[delar.length - 1];
    o[sista] = v && v.__oka != null ? (Number(o[sista]) || 0) + v.__oka : kopia(v);
  }
  return ut;
}

export function skapaFalskDb({ nyckel = "pp:schack-kompis-preview:db", lagring = localStorage } = {}) {
  const lokala = new Set();
  const alla = () => {
    try { return JSON.parse(lagring.getItem(nyckel)) || {}; } catch { return {}; }
  };
  const sparaAlla = (d) => {
    lagring.setItem(nyckel, JSON.stringify(d));
    for (const fn of lokala) queueMicrotask(fn);
  };
  // Andra flikar: storage-händelsen kommer när deras skrivning syns här (en BroadcastChannel
  // kan hinna före localStorage-speglingen mellan processerna – då läses gammal data).
  const andraFlikar = (e) => { if (e.key === nyckel || e.key === null) for (const fn of lokala) fn(); };
  globalThis.addEventListener?.("storage", andraFlikar);

  const snap = (ref, data) => ({ id: ref.id, ref, exists: data !== undefined, data: () => kopia(data) });

  function ref(coll, id) {
    const path = `${coll}/${id}`;
    const r = {
      id, path,
      get: async () => snap(r, alla()[path]),
      set: async (data, opt) => skrivPaket([{ typ: "set", path, data, opt }]),
      update: async (data) => skrivPaket([{ typ: "update", path, data }]),
    };
    return r;
  }

  function skrivPaket(skrivningar) {
    const d = alla();
    for (const s of skrivningar) {
      if (s.typ === "update") {
        if (d[s.path] === undefined) throw Object.assign(new Error(`NOT_FOUND: ${s.path}`), { code: 5 });
        d[s.path] = uppdatera(d[s.path], s.data);
      } else d[s.path] = s.opt?.merge ? sammanfoga(d[s.path], s.data) : kopia(s.data);
    }
    sparaAlla(d);
  }

  const las = async (fn) => (globalThis.navigator?.locks?.request ? globalThis.navigator.locks.request(`${nyckel}:las`, fn) : fn());

  return {
    collection(coll) {
      return {
        doc: (id) => ref(coll, id),
        where(falt, op, varde) {
          return {
            get: async () => {
              const docs = Object.entries(alla())
                .filter(([p, v]) => p.startsWith(`${coll}/`) && op === "array-contains" && Array.isArray(v?.[falt]) && v[falt].includes(varde))
                .map(([p, v]) => snap(ref(coll, p.slice(coll.length + 1)), v));
              return { docs, empty: !docs.length };
            },
          };
        },
      };
    },
    runTransaction(fn) {
      return las(async () => {
        const skrivningar = [];
        const tx = {
          get: async (r) => snap(r, alla()[r.path]),
          set: (r, data, opt) => { skrivningar.push({ typ: "set", path: r.path, data, opt }); },
          update: (r, data) => { skrivningar.push({ typ: "update", path: r.path, data }); },
        };
        const res = await fn(tx);
        if (skrivningar.length) skrivPaket(skrivningar);
        return res;
      });
    },
    las: (path) => kopia(alla()[path]),
    skriv: (path, data) => skrivPaket([{ typ: "set", path, data }]),
    rensa: () => sparaAlla({}),
    lyssna(fn) {
      lokala.add(fn);
      return () => lokala.delete(fn);
    },
    /** Sluta lyssna på andra flikar. */
    stang: () => globalThis.removeEventListener?.("storage", andraFlikar),
  };
}

/** increment() för update() i låtsas-databasen. */
export const oka = (n) => ({ __oka: n });
