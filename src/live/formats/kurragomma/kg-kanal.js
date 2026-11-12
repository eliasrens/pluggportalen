// ============================================================================
// Kurragömma (#838): RÖRELSEKANALEN (kg-kanal.js; scen/kg-rorelse.js är gåendet
// i 3D-scenen) – ett gränssnitt, två implementationer
// (spec §5.3). Sökarnas positioner, realtidshändelserna (vissling, hittad,
// miss, nySokare) och statusen överst går här, inte i Firestore.
//   • "rtdb"  Firebase Realtime Database. SDK:n laddas med import() från samma
//             källa som appens övriga Firebase-moduler (bootgrafen #271) –
//             först när kanalen startas. Reglerna: database.rules.json.
//   • "lokal" en buss i minnet för demoläget (D) och testerna. Samma gränssnitt;
//             demots "server" skriver roll/med/hand/status via buss.server.
// Resten av formatet känner inte till vilken som används.
//
//   skapaRorelsekanal({ sid, uid, lage, app, url?, sdk?, buss?, nu? }) → kanal
//     kanal.start()                 ansluter (rtdb: lyssnar på .info/serverTimeOffset, så t
//                                   och åldersgränsen räknas på SERVERNS klocka)
//     kanal.skickaPos({ x, z, yaw }) → bool  sökarens egen pos: högst 5/s, bara vid flytt
//                                   > 0,15 m eller vridning > 0,05 rad – men minst var
//                                   POS_PULS_MS (pulsen för "det finns alltid en sökare").
//                                   Första skicket armerar onDisconnect().remove() på egen
//                                   pos (bara sökare skriver – gömmare/projektor rör den aldrig),
//                                   och den armeras om varje gång .info/connected blir sann igen
//     kanal.paPos(cb)               cb(uid, { x, z, yaw, t } | null) – andras positioner
//     kanal.paHandelse(cb)          cb(h) – bara händelser yngre än HAND_MAX_ALDER_MS,
//                                   lyssnar på de HAND_LIMIT senaste (limitToLast)
//     kanal.paStatus(cb)            cb({ fas, lasta, gomda, sokare })
//     kanal.stang()                 slutar lyssna och tar bort egen pos
//   skapaPosFilter({ nu })          den rena takt-/flyttregeln (testad)
//   skapaLokalBuss({ nu })          → { kanalFor(uid), server: { roll, med, handelse, status, pos } }
//   KG_DATABASE_URL                 databasen i prod (pluggportalen-so-2026-default-rtdb, europe-west1)
// ============================================================================

import {
  POS_MIN_INTERVALL_MS, POS_MIN_FLYTT_M, POS_MIN_VRID_RAD, POS_PULS_MS, HAND_MAX_ALDER_MS, HAND_LIMIT,
} from "./delat/kg-config.js";

export const KG_DATABASE_URL = "https://pluggportalen-so-2026-default-rtdb.europe-west1.firebasedatabase.app";
const SDK_URL = "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
/** Databasinstanser som redan pekats mot emulatorn – connectDatabaseEmulator får bara anropas en gång per instans. */
const emulatorKopplade = new WeakSet();

/** Takten och flyttregeln för sökarens egna positioner. prova(p) → true = skicka. */
export function skapaPosFilter({ nu = Date.now } = {}) {
  let senast = null;
  return {
    prova({ x, z, yaw = 0 }) {
      const t = nu();
      if (senast) {
        const dt = t - senast.t;
        if (dt < POS_MIN_INTERVALL_MS) return false;
        const flytt = Math.hypot(x - senast.x, z - senast.z) >= POS_MIN_FLYTT_M || Math.abs(yaw - senast.yaw) >= POS_MIN_VRID_RAD;
        if (!flytt && dt < POS_PULS_MS) return false;
      }
      senast = { x, z, yaw, t };
      return true;
    },
    get senast() { return senast; },
  };
}

const posDoc = (p, t) => ({ x: Number(p.x) || 0, z: Number(p.z) || 0, yaw: Number(p.yaw) || 0, t });

function lyssnare() {
  const set = new Set();
  return { add: (cb) => { set.add(cb); return () => set.delete(cb); }, emit: (...a) => { for (const cb of [...set]) cb(...a); }, clear: () => set.clear() };
}

// ---- Realtime Database -------------------------------------------------------

function skapaRtdbKanal({ sid, uid, app, url = KG_DATABASE_URL, sdk = null, emulator = null, nu = Date.now }) {
  const filter = skapaPosFilter({ nu });
  const av = [];
  let fb = null;
  let db = null;
  let offset = 0; // serverns klocka − klientens (.info/serverTimeOffset)
  let armad = false;
  const rot = () => `kg/${sid}`;
  const egen = () => fb.ref(db, `${rot()}/pos/${uid}`);
  const serverNu = () => nu() + offset;
  const armera = () => fb.onDisconnect(egen()).remove().catch(() => null);
  return {
    async start() {
      fb = sdk || (await import(/* webpackIgnore: true */ SDK_URL));
      db = fb.getDatabase(app, url);
      if (emulator && !emulatorKopplade.has(db)) {
        fb.connectDatabaseEmulator(db, emulator.host, emulator.port);
        emulatorKopplade.add(db);
      }
      av.push(fb.onValue(fb.ref(db, ".info/serverTimeOffset"), (snap) => { offset = Number(snap.val()) || 0; }));
      // Ett onDisconnect gäller bara den anslutningen: efter ett nätavbrott måste
      // sökaren armera om, annars blir nästa avbrott en frusen figur för de andra.
      av.push(fb.onValue(fb.ref(db, ".info/connected"), (snap) => { if (snap.val() === true && armad) armera(); }));
    },
    skickaPos(p) {
      if (!db || !filter.prova(p)) return false;
      if (!armad) {
        armad = true;
        armera();
      }
      fb.set(egen(), posDoc(p, serverNu())).catch(() => null);
      return true;
    },
    paPos(cb) {
      const q = fb.ref(db, `${rot()}/pos`);
      const andra = (snap) => { if (snap.key !== uid) cb(snap.key, snap.val()); };
      const u1 = fb.onChildAdded(q, andra);
      const u2 = fb.onChildChanged(q, andra);
      const u3 = fb.onChildRemoved(q, (snap) => { if (snap.key !== uid) cb(snap.key, null); });
      const stopp = () => { u1(); u2(); u3(); };
      av.push(stopp);
      return stopp;
    },
    paHandelse(cb) {
      const q = fb.query(fb.ref(db, `${rot()}/hand`), fb.orderByChild("t"), fb.limitToLast(HAND_LIMIT));
      const u = fb.onChildAdded(q, (snap) => {
        const h = snap.val();
        if (h && Number(h.t) >= serverNu() - HAND_MAX_ALDER_MS) cb({ id: snap.key, ...h });
      });
      av.push(u);
      return u;
    },
    paStatus(cb) {
      const u = fb.onValue(fb.ref(db, `${rot()}/status`), (snap) => cb(snap.val() || null));
      av.push(u);
      return u;
    },
    stang() {
      for (const u of av.splice(0)) u();
      if (db && armad) fb.remove(egen()).catch(() => null);
    },
  };
}

// ---- Lokal buss (demoläget, testerna) -----------------------------------------

export function skapaLokalBuss({ nu = Date.now } = {}) {
  const st = { roll: {}, med: {}, pos: {}, hand: [], status: null };
  let handNr = 0; // löpande – listan klipps vid HAND_LIMIT, id:t får aldrig upprepas (klienterna dedupar på id)
  const paPos = lyssnare();
  const paHand = lyssnare();
  const paStatus = lyssnare();
  const sattPos = (uid, p) => {
    if (p) st.pos[uid] = p;
    else delete st.pos[uid];
    paPos.emit(uid, p);
  };
  const server = {
    roll(uid, roll) { st.roll[uid] = roll; },
    med(uid) { st.med[uid] = true; },
    pos: (uid, p) => sattPos(uid, posDoc(p, nu())),
    handelse(h) {
      const post = { id: `h${++handNr}`, t: nu(), ...h };
      st.hand.push(post);
      if (st.hand.length > HAND_LIMIT) st.hand.splice(0, st.hand.length - HAND_LIMIT);
      paHand.emit(post);
      return post;
    },
    status(patch) {
      st.status = { ...(st.status || {}), ...patch };
      paStatus.emit({ ...st.status });
      return st.status;
    },
    tomma() { st.roll = {}; st.med = {}; st.pos = {}; st.hand = []; st.status = null; },
    get tillstand() { return st; },
  };
  function kanalFor(uid) {
    const filter = skapaPosFilter({ nu });
    const av = [];
    return {
      async start() {},
      skickaPos(p) {
        if (st.roll[uid] !== "sokare" || !filter.prova(p)) return false;
        sattPos(uid, posDoc(p, nu()));
        return true;
      },
      paPos(cb) {
        for (const [u, p] of Object.entries(st.pos)) if (u !== uid) cb(u, p);
        const u = paPos.add((u2, p) => { if (u2 !== uid) cb(u2, p); });
        av.push(u);
        return u;
      },
      paHandelse(cb) {
        for (const h of st.hand) if (h.t >= nu() - HAND_MAX_ALDER_MS) cb(h);
        const u = paHand.add((h) => { if (h.t >= nu() - HAND_MAX_ALDER_MS) cb(h); });
        av.push(u);
        return u;
      },
      paStatus(cb) {
        if (st.status) cb({ ...st.status });
        const u = paStatus.add(cb);
        av.push(u);
        return u;
      },
      stang() {
        for (const u of av.splice(0)) u();
        if (st.pos[uid]) sattPos(uid, null);
      },
    };
  }
  return { kanalFor, server };
}

/** Kanalen för en elev/projektor. lage "rtdb" (standard) eller "lokal" (kräver buss). */
export function skapaRorelsekanal({ sid, uid, lage = "rtdb", buss = null, ...opt }) {
  if (lage === "lokal") {
    if (!buss) throw new Error("Den lokala rörelsekanalen behöver en buss (skapaLokalBuss).");
    return buss.kanalFor(uid);
  }
  return skapaRtdbKanal({ sid, uid, ...opt });
}
