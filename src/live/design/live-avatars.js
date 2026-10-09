// ============================================================================
// Live-design (#571): ELEVERNAS AVATARER – läsning (designspec §4.2). Ren
// logik utan DOM/Firebase: laddaren injiceras (default = klassprojektionen via
// data-content.js), så antalet läsningar kan räknas i test.
//
// Kvotregeln (incident #231): avatarerna läses ur classProjections/{classId}
// – ETT dokument per klass med avatarId + avatarItems för hela klassen. ALDRIG
// studentData eller students per elev, och ingen self-heal (den läser per
// elev): saknas en elev i projektionen läses projektionen om EN gång (en ny
// elev kan ha publicerat sig), därefter visas standardavataren.
//   • prefetch(classIds) när lobbyn/vyn öppnas: en läsning per deltagande klass.
//   • ensure(players): läser bara klasser som inte lästs; en saknad elev ger
//     högst en omläsning av sin klass (och högst en per retryMs och klass –
//     30 elever som ansluter samtidigt ger EN omläsning, inte 30).
//
// Huslås (husLast) – SAMMA som byn: byn ritar en låst kamrats avatar ur
// projektionen precis som en olåst (husMini + avatarMarkup) och låser bara
// rummet. Projektionen bär aldrig något låst innehåll (en besökares self-heal
// skriver standardutseende för en låst elev; eleven själv publicerar sitt
// utseende, #240). Live visar alltså projektionens avatar oförändrad och läser
// aldrig något mer – `locked` finns i info() för den vy som vill visa 🔒.
//
// API
//   createAvatarRoster({ load?, now?, retryMs? }) → {
//     prefetch(classIds) → Promise
//     ensure(players [{ uid, classId }]) → Promise<uid[]>  (nya elever; onChange får
//                                         även de som löstes upp vid omläsning)
//     info(uid) → { avatarId, avatarItems, locked, resolved }
//     onChange(fn(uids)) → off
//     reads() → antal projektionsläsningar, whenSettled() → Promise (test/kontroll)
//   }
//   load(classId, { fresh }) → Promise<{ members }>  (fresh = förbi sessionscachen)
// ============================================================================

import { entryToBoende } from "../../class-projection-entries.js";
import { DEFAULT_AVATAR } from "../../avatars.js";

const RETRY_MS = 5_000;

/** Riktiga laddaren: klassprojektionen (1 getDoc, sessionscachad 30 s). */
async function projectionLoad(classId, { fresh = false } = {}) {
  const dc = await import("../../data-content.js");
  if (fresh) dc.invalidateClassProjection(classId);
  return dc.getClassProjection(classId);
}

const DEFAULT_INFO = Object.freeze({ avatarId: DEFAULT_AVATAR, avatarItems: [], locked: false, resolved: false });

export function createAvatarRoster({ load = projectionLoad, now = () => Date.now(), retryMs = RETRY_MS } = {}) {
  const classes = new Map(); // classId → { members, at, loading: Promise|null, retryT }
  const settled = new Set(); // uid som saknades även efter omläsning → standardavatar
  const known = new Map(); // uid → classId (från ensure)
  const listeners = new Set();
  let readCount = 0;

  function emit(uids) {
    if (!uids.length) return;
    for (const fn of listeners) {
      try { fn(uids); } catch (e) { console.warn("Live-avatarer:", e); }
    }
  }

  function read(classId, fresh) {
    const c = classes.get(classId) || { members: null, at: 0, loading: null, retryT: 0 };
    classes.set(classId, c);
    if (c.loading) return c.loading;
    readCount++;
    c.at = now();
    c.loading = Promise.resolve()
      .then(() => load(classId, { fresh }))
      .then((p) => { c.members = (p && p.members && typeof p.members === "object") ? p.members : {}; })
      .catch((e) => { console.warn("Live-avatarer: projektionen kunde inte läsas", e); c.members = c.members || {}; })
      .finally(() => { c.loading = null; });
    return c.loading;
  }

  function uidsOf(classId) {
    return [...known].filter(([, cid]) => cid === classId).map(([u]) => u);
  }

  /** Läs klassen om (en gång per retryMs) för elever som saknas i projektionen. */
  function retry(classId) {
    const c = classes.get(classId);
    const wait = Math.max(0, c.at + retryMs - now());
    if (c.retryT) return c.retryP;
    c.retryP = new Promise((resolve) => {
      c.retryT = setTimeout(async () => {
        const missing = uidsOf(classId).filter((u) => !c.members?.[u] && !settled.has(u));
        await read(classId, true);
        c.retryT = 0;
        for (const u of missing) if (!c.members?.[u]) settled.add(u);
        emit(missing);
        resolve(missing);
      }, wait);
    });
    return c.retryP;
  }

  async function prefetch(classIds = []) {
    const ids = [...new Set((classIds || []).filter(Boolean))];
    await Promise.all(ids.map((cid) => (classes.get(cid)?.members ? null : read(cid, false))));
  }

  async function ensure(players = []) {
    const fresh = [];
    for (const p of players || []) {
      if (!p || !p.uid || !p.classId) continue;
      if (!known.has(p.uid)) fresh.push(p.uid);
      known.set(p.uid, p.classId);
    }
    const cids = [...new Set([...known.values()])];
    await prefetch(cids);
    const changed = fresh;
    for (const cid of cids) {
      const members = classes.get(cid)?.members || {};
      if (uidsOf(cid).some((u) => !members[u] && !settled.has(u))) retry(cid);
    }
    if (changed.length) emit(changed);
    // Omläsningen väntar vi inte in: vyn ritar nu och får onChange när den kommer.
    return changed;
  }

  function info(uid) {
    const cid = known.get(uid);
    const entry = cid ? classes.get(cid)?.members?.[uid] : null;
    if (entry) {
      const b = entryToBoende(uid, entry);
      return { avatarId: b.avatarId || DEFAULT_AVATAR, avatarItems: b.avatarItems, locked: b.locked, resolved: true };
    }
    return settled.has(uid) ? { ...DEFAULT_INFO, resolved: true } : DEFAULT_INFO;
  }

  return {
    prefetch,
    ensure,
    info,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reads: () => readCount,
    /** Promise som löses när pågående omläsningar är klara (test/kontroll). */
    whenSettled: () => Promise.all([...classes.values()].map((c) => (c.retryT ? c.retryP : c.loading))),
    destroy() {
      for (const c of classes.values()) clearTimeout(c.retryT);
      listeners.clear();
    },
  };
}
