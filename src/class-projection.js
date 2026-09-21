// ============================================================================
// Pluggporten – klass-projektion (data-lagret för by-/grannby-översikten)
// ----------------------------------------------------------------------------
// DESIGNVAL: ETT DOKUMENT PER KLASS = O(1) FIRESTORE-LÄSNINGAR PER KLASS.
//
// Byn/grannbyn ritar ~24 klasskamraters hus varje gång den öppnas. Den GAMLA
// vägen (data-content.getStudentsWithLooks) läser ett studentData-dok PER elev,
// live, varje gång → N läsningar per klass-öppning. Det sprängde Firestores
// gratiskvot i prod (incident 2026-09-09, se #231).
//
// Lösningen är en FÖRBERÄKNAD projektion i ett enda dokument per klass,
// `classProjections/{classId}`, med ett `members`-MAP keyat på studentId. En
// `getDoc` hämtar HELA klassen = exakt 1 läsning, oavsett antal elever. INGEN
// subcollection: `getDocs` på en subkollektion debiterar en läsning PER medlem
// och skulle spränga O(1)-målet.
//
// Varje members-entry bär ALLT översikten ritar, så inga students/{id} ELLER
// studentData/{id} behöver läsas per klasskamrat:
//   { namn, username, avatarId, avatarItems[], paletteId, husSkalId,
//     stars, xp, completed, husLast }
//
// SKRIVNINGAR sker med fält-path `updateDoc` (t.ex. "members.<uid>.stars") som
// är atomära per path – ~24 elever som var och en skriver SIN egen nyckel
// klottrar inte över varandra. Hela `members`-mappen skrivs ALDRIG om i en het
// väg; bara self-heal-backfillen får `setDoc(..., {merge:true})`.
//
// SELF-HEALING: saknas dokumentet (eller en medlems-entry) faller läsaren
// tillbaka på dagens per-elev-läsning EN gång, bygger entries och skriver
// projektionen – sedan kostar varje öppning 1 läsning igen. Ingen engångs-
// backfill behövs.
//
// Den här modulen är REN av Firebase: allt Firestore-arbete injiceras via en
// liten adapter (`createClassProjectionStore(adapter)`), så kärnlogiken kan
// enhetstestas med en fejk-adapter som RÄKNAR getDoc/getDocs. data-content.js
// skapar den riktiga store:n med de riktiga Firestore-funktionerna inkopplade.
// ============================================================================

import { myClasses, classmateIds } from "./klass-membership.js";
import {
  projectionEntryFrom,
  fallbackEntryFrom,
  boendeFromMembers,
  boendeMissingNameIds,
  withEntryName,
  missingMemberIds,
  isPermissionDenied,
  isNotFound,
  appearanceChanged,
} from "./class-projection-entries.js";

// De rena entry/boende-hjälparna bor i class-projection-entries.js men re-
// exporteras här så befintliga importvägar (data-content.js, testerna) består.
export {
  projectionEntryFrom,
  fallbackEntryFrom,
  missingMemberIds,
  entryToBoende,
  boendeFromMembers,
  boendeMissingNameIds,
  withEntryName,
  isPermissionDenied,
  isNotFound,
  sameAvatarItems,
  appearanceChanged,
  createTtlCache,
} from "./class-projection-entries.js";

const DEFAULT_TTL_MS = 30_000; // kort session-cache: zooma ut/in läser inte om

/**
 * Skapa en klass-projektions-store kring en injicerad Firestore-adapter.
 *
 * @param {object} adapter
 * @param {*}        adapter.db          Firestore-db-handtaget (ogenomskinligt för oss).
 * @param {function} adapter.doc         (db, ...path) → DocumentReference
 * @param {function} adapter.collection  (db, ...path) → CollectionReference
 * @param {function} adapter.getDoc      (ref) → Promise<snapshot> (RÄKNAS i test)
 * @param {function} adapter.getDocs     (query) → Promise<querySnapshot> (RÄKNAS i test)
 * @param {function} adapter.setDoc      (ref, data, opts?) → Promise
 * @param {function} adapter.updateDoc   (ref, fieldPathMap) → Promise
 * @param {function} [adapter.now]       () → ms (injicerbar klocka för cache-TTL i test)
 * @param {number}   [adapter.ttlMs]     session-cachens TTL (default 30 s)
 * @param {function} [adapter.identityFor] (studentId) → { namn?, username? } – den
 *   KÄNDA identiteten för en elev (utan en Firestore-läsning), normalt sessionens
 *   egen elev. Används för att GARANTERA att varje projektions-skrivning bär namn
 *   (#316) även när patchen (award/rum/avatar/self-publish) inte gör det. Default:
 *   tom (då faller vi tillbaka på patchens ev. namn och den defensiva läsningen).
 */
export function createClassProjectionStore(adapter) {
  const { db, doc, collection, getDoc, getDocs, setDoc, updateDoc } = adapter;
  const now = adapter.now || (() => Date.now());
  const ttlMs = Number.isFinite(adapter.ttlMs) ? adapter.ttlMs : DEFAULT_TTL_MS;
  const identityFor = typeof adapter.identityFor === "function" ? adapter.identityFor : () => ({});

  // Modul-/store-lokal session-cache: Map<classId, {value, ts}>.
  const cache = new Map();

  function projRef(classId) {
    return doc(db, "classProjections", classId);
  }

  /** Töm cachen för en klass (anropas av skriv-vägen och i test). */
  function invalidateClassProjection(classId) {
    cache.delete(classId);
  }

  /** Töm hela projektions-cachen (test/utloggning). */
  function clearProjectionCache() {
    cache.clear();
  }

  /**
   * Läs en klass-projektion via EXAKT 1 getDoc (eller från cachen om färsk).
   * Saknat dokument ger { members: {} }. Cachar även "saknad" så ett tomt
   * grannby-svep inte läser om i onödan; self-heal invaliderar efter en write.
   * @param {string} classId
   * @returns {Promise<{members: Object}>}
   */
  async function getClassProjection(classId) {
    if (!classId) return { members: {} };
    const hit = cache.get(classId);
    if (hit && now() - hit.ts < ttlMs) return hit.value;
    const snap = await getDoc(projRef(classId));
    const data = snap && snap.exists && snap.exists() ? snap.data() : null;
    const members = data && data.members && typeof data.members === "object" ? data.members : {};
    const value = { members };
    cache.set(classId, { value, ts: now() });
    return value;
  }

  /**
   * Bygg members-entries via dagens PER-ELEV-läsning (fallback/self-heal).
   * Läser students/{id} (alltid läsbar) + studentData/{id} (kan nekas = låst
   * hus) per elev, parallellt med per-elev-catch. Returnerar en entry-map.
   * @param {string[]} ids
   * @returns {Promise<{[id:string]: object}>}
   */
  async function buildProjectionEntries(ids) {
    const uniq = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
    const pairs = await Promise.all(
      uniq.map(async (id) => {
        let student = {};
        try {
          const ss = await getDoc(doc(db, "students", id));
          student = ss && ss.exists && ss.exists() ? ss.data() : {};
        } catch {
          student = {};
        }
        try {
          const ds = await getDoc(doc(db, "studentData", id));
          const d = ds && ds.exists && ds.exists() ? ds.data() : {};
          return [id, projectionEntryFrom(student, d)];
        } catch (err) {
          return [id, fallbackEntryFrom(student, isPermissionDenied(err))];
        }
      })
    );
    const map = {};
    for (const [id, entry] of pairs) map[id] = entry;
    return map;
  }

  /**
   * Self-heal: säkerställ att projektionen finns och täcker `memberIds`. Saknas
   * dokumentet eller entries → bygg de saknade ur buildProjectionEntries, skriv
   * dem (setDoc merge – enda stället hela dok:t merge-skrivs) och returnera den
   * kompletta projektionen. Efterföljande getClassProjection kostar 1 dok.
   * @param {string} classId
   * @param {string[]} memberIds klassens elev-id (från classes/{id}.studentIds)
   * @returns {Promise<{members: Object, healed: boolean}>}
   */
  async function ensureClassProjection(classId, memberIds = []) {
    const current = await getClassProjection(classId);
    const missing = missingMemberIds(current.members, memberIds);
    if (missing.length === 0) {
      return { members: current.members, healed: false };
    }
    const built = await buildProjectionEntries(missing);
    // Skriv bara de saknade entries (merge deep-mergar in i members utan att
    // röra befintliga nycklar). setDoc merge skapar dokumentet om det saknas.
    //
    // BEST-EFFORT: en cross-class-BESÖKARE (grannby) får enligt reglerna INTE
    // skriva en ANNAN klass projektion (skriv = egen klass/lärare) → skrivningen
    // nekas. Det får ALDRIG fälla vyn: vi behåller de byggda entries i minnet och
    // ritar ändå. En medlem i klassen (eller läraren) fyller projektionen nästa
    // gång den rör sig i sin egen by, varefter grannby-svepet blir O(1) igen.
    // Bara permission-denied sväljs; andra fel (t.ex. nät) bubblar som förr.
    try {
      await setDoc(projRef(classId), { members: built }, { merge: true });
      invalidateClassProjection(classId);
    } catch (err) {
      if (!isPermissionDenied(err)) throw err;
    }
    const members = { ...current.members, ...built };
    return { members, healed: true };
  }

  /**
   * DEFENSIV LÄSNING (#316): en glapp-post i projektionen som saknar `namn` (och
   * `username`) skulle rita en trasig platshållare (rå-uid) i byn. Läs students/{id}
   * för PRECIS de posterna och fyll i namnet – normalfallet (alla poster har namn)
   * läser INGET, så O(1)-budgeten består. Best-effort: en misslyckad läsning
   * lämnar posten oförändrad (bättre uid än en fälld vy). Muterar boende-posterna
   * (färska objekt ur entryToBoende) och returnerar samma array.
   */
  async function fillMissingNames(boende) {
    const missing = boendeMissingNameIds(boende);
    if (missing.length === 0) return boende;
    const byId = new Map(boende.map((b) => [b.id, b]));
    await Promise.all(
      missing.map(async (id) => {
        try {
          const ss = await getDoc(doc(db, "students", id));
          const s = ss && ss.exists && ss.exists() ? ss.data() : {};
          const b = byId.get(id);
          if (b && s && s.namn) b.namn = s.namn;
          if (b && s && !b.username && s.username) b.username = s.username;
        } catch {
          /* best-effort: behåll posten som den är */
        }
      })
    );
    return boende;
  }

  /**
   * By-/grannby-översikt för EN klass: säkerställ projektionen (self-heal EN gång
   * om den saknas/är ofullständig) och returnera den boende-array som mountByScen
   * + aggregateKlassStats ritar. Kostar EXAKT 1 getDoc när projektionen finns –
   * O(1) per klass oavsett antal klasskamrater (det som #234 handlar om).
   * @param {string} classId
   * @param {string[]} memberIds  klassens elev-id (classes/{id}.studentIds)
   * @returns {Promise<Array>} boende (id, namn, avatarId, …, locked)
   */
  async function getClassOverview(classId, memberIds = []) {
    const { members } = await ensureClassProjection(classId, memberIds);
    return fillMissingNames(boendeFromMembers(members, memberIds));
  }

  /**
   * By-översikt för den EGNA byn = unionen av elevens ALLA klasser. Läser:
   *   • den egna studentData:n FÄRSKT (1 dok) – egna husets utseende/stjärnor/
   *     nivå är alltid up-to-date även om projektionens self-entry släpar efter,
   *   • EN projektion per egen klass (O(1)/klass, oavsett klasstorlek).
   * Öppna egna byn kostar alltså egna studentData + 1 projektion = 2 dok för en
   * elev i en klass (acceptanskravet ≤2). Egen elev sorteras INTE hit – anroparen
   * lägger den först (self-first), som byn gjort sedan tidigare.
   * @param {object} o
   * @param {string} o.meId
   * @param {Array} o.classes  hela klasslistan (getClasses)
   * @param {string} [o.meNamn]  namn-fallback för egen elev (utan klass finns
   *   ingen projektions-entry att läsa namnet ur – vi läser inte students/{meId})
   * @returns {Promise<Array>} boende, egen elev inkluderad (osorterad)
   */
  async function getOwnVillageOverview({ meId, classes = [], meNamn = "" } = {}) {
    if (!meId) return [];
    // Egen studentData färskt (1 läsning) – oberoende av när projektionen skrevs.
    let ownSd = {};
    try {
      const snap = await getDoc(doc(db, "studentData", meId));
      ownSd = snap && snap.exists && snap.exists() ? snap.data() : {};
    } catch {
      ownSd = {};
    }
    // Union av alla egna klassers projektioner (1 läsning/klass, self-heal en gång).
    // Vi samlar samtidigt de egna klass-id:na så self-publish (nedan) kan skriva
    // till exakt dem UTAN en ny läsning (updateStudentProjectionAllClasses hade
    // kostat en extra getDocs via classIdsForStudent – det bryter #231:s O(1)).
    const merged = {};
    const myClassIds = [];
    for (const c of myClasses(meId, classes)) {
      const ids = Array.isArray(c.studentIds) ? c.studentIds : [];
      myClassIds.push(c.id);
      const { members } = await ensureClassProjection(c.id, ids);
      for (const [id, entry] of Object.entries(members)) {
        if (!merged[id]) merged[id] = entry;
      }
    }
    // Egen entry byggs ur den FÄRSKA studentData:n. Namn/username tas ur
    // projektionen om den finns (annars meNamn-fallback) – students/{meId} läses
    // aldrig, så vi håller oss inom ≤2 dok.
    const selfBase = merged[meId] || {};
    const freshSelf = projectionEntryFrom(
      {
        namn: selfBase.namn || meNamn || "",
        username: selfBase.username || "",
        avatarId: selfBase.avatarId,
      },
      ownSd
    );
    merged[meId] = freshSelf;

    // SELF-PUBLISH (#240): en LÅST elev (husLast) får sin projektions-entry
    // self-heal:ad med NULL-utseende av en BESÖKARE – som enligt firestore.rules
    // inte får läsa den låstas studentData (#231) – så klasskompisar ritar
    // standardhuset. Eleven själv får dock skriva sin EGEN klass-entry OBEROENDE
    // av husLast. Här publicerar vi därför det RIKTIGA utseendet (färg/husskal/
    // avatar) + den färska husLast-flaggan till projektionen, så kompisar ser det.
    //   • BARA vid faktisk skillnad mot projektionen (appearanceChanged).
    //   • INGA nya läsningar: vi skriver till de redan itererade myClassIds
    //     (samma mängd som updateStudentProjectionAllClasses hade nått) – inget
    //     classIdsForStudent-getDocs.
    //   • BEST-EFFORT & icke-blockerande: översiktens returvärde är oförändrat
    //     oavsett skriv-utfall; fel sväljs (jfr #231 self-heal, commit b7022c3).
    if (myClassIds.length > 0 && appearanceChanged(freshSelf, selfBase)) {
      // Bär ALLTID med namn/username (#316): den här self-publish-vägen kunde
      // tidigare skapa/uppdatera en entry med bara utseende – utan namn – om
      // eleven ännu inte hade en fullständig entry. namn tas ur den färska
      // self-entryn (projektionens namn eller meNamn-fallback).
      const patch = {
        avatarId: freshSelf.avatarId,
        avatarItems: freshSelf.avatarItems,
        paletteId: freshSelf.paletteId,
        husSkalId: freshSelf.husSkalId,
        husLast: freshSelf.husLast,
      };
      // Sätt namn/username bara när vi faktiskt känner dem (skriv aldrig över ett
      // riktigt namn med ""); saknas de här fyller updateStudentProjection dem
      // ur den kända identiteten (identityFor).
      if (freshSelf.namn) patch.namn = freshSelf.namn;
      if (freshSelf.username) patch.username = freshSelf.username;
      for (const cid of myClassIds) {
        Promise.resolve()
          .then(() => updateStudentProjection(cid, meId, patch))
          .catch(() => {});
      }
    }

    return fillMissingNames(boendeFromMembers(merged, classmateIds(meId, classes)));
  }

  /**
   * Skriv-API: uppdatera BARA en elevs egen entry via fält-path `updateDoc`.
   * Atomärt per path → samtidiga skrivningar för olika elever krockar inte.
   * Tål att dokumentet ännu inte finns (skapar med setDoc merge). Invaliderar
   * session-cachen för klassen.
   * @param {string} classId
   * @param {string} studentId
   * @param {object} patch  under-fält att sätta, t.ex. { stars, xp, husLast }
   */
  async function updateStudentProjection(classId, studentId, patch = {}) {
    if (!classId || !studentId) return;
    const raw = patch && typeof patch === "object" ? patch : {};
    // Tom patch = no-op (som förr): vi lägger ALDRIG till namn på en skrivning som
    // annars inte hade skett (då hade en ren läs-väg börjat skriva).
    if (Object.keys(raw).length === 0) return;
    // GARANTERA NAMN I VARJE SKRIVNING (#316): en partiell patch (award/rum/
    // avatar/self-publish) får aldrig skapa – eller lämna – en members-entry utan
    // `namn`. Bär patchen inte redan namn, fyll ur den kända identiteten (normalt
    // sessionens egen elev, som är den som skriver dessa het-vägar). Läraren
    // (upsertStudent) skickar redan namn explicit → withEntryName rör det inte då.
    const fields = withEntryName(raw, identityFor(studentId));
    const paths = {};
    for (const [key, value] of Object.entries(fields)) {
      paths[`members.${studentId}.${key}`] = value;
    }
    const ref = projRef(classId);
    try {
      await updateDoc(ref, paths);
    } catch (err) {
      if (isNotFound(err)) {
        // Dokumentet finns inte än: skapa/komplettera med en merge-skrivning av
        // just den här elevens nästlade entry (inga andra medlemmar rörs).
        await setDoc(ref, { members: { [studentId]: { ...fields } } }, { merge: true });
      } else {
        throw err;
      }
    }
    invalidateClassProjection(classId);
  }

  /**
   * Vilka klasser är eleven medlem i? Slår upp via klass-dokumentens
   * `studentIds` (samma logik som klassbyn: en elev kan vara i FLERA klasser).
   * EN getDocs av classes-kollektionen. Skriv-vägen använder detta för att
   * uppdatera ALLA elevens klassers projektioner.
   * @param {string} studentId
   * @returns {Promise<string[]>}
   */
  async function classIdsForStudent(studentId) {
    if (!studentId) return [];
    const snap = await getDocs(collection(db, "classes"));
    const ids = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      if (Array.isArray(data.studentIds) && data.studentIds.includes(studentId)) {
        ids.push(d.id);
      }
    });
    return ids;
  }

  /**
   * Bekvämlighet för skriv-vägen: uppdatera elevens entry i ALLA sina klassers
   * projektioner (en elev kan vara i flera klasser). Returnerar de klass-id som
   * uppdaterades.
   * @param {string} studentId
   * @param {object} patch
   * @returns {Promise<string[]>}
   */
  async function updateStudentProjectionAllClasses(studentId, patch = {}) {
    const classIds = await classIdsForStudent(studentId);
    await Promise.all(classIds.map((cid) => updateStudentProjection(cid, studentId, patch)));
    return classIds;
  }

  return {
    getClassProjection,
    getClassOverview,
    getOwnVillageOverview,
    buildProjectionEntries,
    ensureClassProjection,
    updateStudentProjection,
    updateStudentProjectionAllClasses,
    classIdsForStudent,
    invalidateClassProjection,
    clearProjectionCache,
  };
}
