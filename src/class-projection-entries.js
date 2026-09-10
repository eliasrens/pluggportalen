// ============================================================================
// Pluggportalen – klass-projektionens ENTRY-form (ren shaping, ingen Firebase)
// ----------------------------------------------------------------------------
// De rena hjälparna som formar data mellan tre representationer:
//   students/{id} + studentData/{id}   →  members-entry (projectionEntryFrom)
//   members-entry (keyad på id)         →  boende-objekt byn ritar (entryToBoende)
// samt fallback-entry för nekad läsning och self-heal-diffen (missingMemberIds).
//
// Utbrutet ur class-projection.js (som bär Firestore-store:n) så shaping-logiken
// kan enhetstestas isolerat och båda filerna hålls under filtaket. class-
// projection.js re-exporterar allt härifrån, så befintliga importvägar består.
//
// Här bor även den GENERISKA TTL-session-cachen (createTtlCache, #274): en ren,
// Firebase-fri cache-fabrik som data.js/data-content.js/data-classes.js
// återanvänder INLINE. Den ligger i den här redan-existerande boot-graf-filen
// (INTE i en NY fil) så att inget nytt hamnar i den boot-kritiska modulgrafen –
// en ny boot-graf-fil ger ett 404-fönster vid GitHub Pages-deploy och fäller
// boot (prod-incident 2026-09-10, se #271). Firebase-fri = enhetstestbar utan
// emulator (test/data-cache.test.js).
// ============================================================================

import { xpFromStudentData, progressTotals } from "./leveling.js";

// ---------------------------------------------------------------------------
// Generisk TTL-session-cache (#274)
// ---------------------------------------------------------------------------
// Samma anda som klass-projektionens inbyggda cache (createClassProjectionStore):
// Map<key,{value,ts}>, kort TTL, injicerbar now()-klocka för testbarhet, explicit
// invalidering. Semantik = kort TTL (INTE stale-while-revalidate): ett färskt
// värde (ålder < ttl) returneras direkt utan att loadern körs → snabba återbesök
// under en session slipper nätrundan. När TTL löpt ut hämtas färskt EN gång och
// cachas. Lärar-ändringar (hiddenModes/innehåll) når därför eleven inom en
// TTL-cykel vid nästa navigering, utan hård-omladdning (krav 1). Egna skrivningar
// invaliderar nyckeln explicit så saldo/olåst aldrig är gammalt (krav 2).
//
// @param {object} [o]
// @param {function} [o.now]   () → ms (injicerbar klocka; default Date.now)
// @param {number}   [o.ttlMs] TTL i ms (default 30 s, som projektions-cachen)
const DEFAULT_TTL_MS = 30_000;

export function createTtlCache({ now = () => Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const store = new Map(); // key -> { value, ts }
  const isFresh = (hit) => hit && now() - hit.ts < ttlMs;

  return {
    /** Cachad läsning: färsk träff returneras direkt (loadern körs INTE),
     *  annars körs `loader()`, resultatet cachas och returneras. */
    async read(key, loader) {
      const hit = store.get(key);
      if (isFresh(hit)) return hit.value;
      const value = await loader();
      store.set(key, { value, ts: now() });
      return value;
    },
    /** Färskt cachat värde eller undefined (utan att hämta). */
    getFresh(key) {
      const hit = store.get(key);
      return isFresh(hit) ? hit.value : undefined;
    },
    /** Finns en FÄRSK post för nyckeln? (för test/introspektion) */
    has(key) {
      return isFresh(store.get(key));
    },
    /** Skriv in ett värde direkt (t.ex. det färska saldot ur en transaktion). */
    set(key, value) {
      store.set(key, { value, ts: now() });
      return value;
    },
    /** Töm EN nyckel (anropas av skriv-vägen efter lyckad skrivning). */
    invalidate(key) {
      store.delete(key);
    },
    /** Töm hela cachen (in-/utloggning, test). */
    clear() {
      store.clear();
    },
  };
}

/**
 * REN hjälpare: bygg en members-entry ur ett students-dokument + dess
 * studentData. Samma fält-härledning som getStudentsWithLooks (en KÄLLA för
 * fältformen), men keyad in i projektionen och med `husLast` i stället för det
 * härledda `locked` (vyn härleder locked ur husLast).
 * @param {object} student students/{id}-data (namn, username, avatarId)
 * @param {object} sd       studentData/{id}-data
 */
export function projectionEntryFrom(student = {}, sd = {}) {
  const s = student || {};
  const d = sd || {};
  const { completed, stars } = progressTotals(d.progress);
  return {
    namn: s.namn || "",
    username: s.username || "",
    avatarId: d.avatarId || s.avatarId || "fox",
    avatarItems: Array.isArray(d.avatarItems) ? d.avatarItems : [],
    paletteId: (d.room && d.room.paletteId) || null,
    husSkalId: d.husSkalId || null,
    stars,
    xp: xpFromStudentData(d),
    completed,
    husLast: d.husLast === true,
  };
}

/**
 * REN hjälpare: fallback-entry när studentData INTE gick att läsa. Vid en nekad
 * läsning (locked=true) är huset låst (husLast → true) och vi ritar ett
 * generiskt hus; vid andra fel faller vi tyst tillbaka på default-utseendet.
 */
export function fallbackEntryFrom(student = {}, locked = false) {
  const s = student || {};
  return {
    namn: s.namn || "",
    username: s.username || "",
    avatarId: s.avatarId || "fox",
    avatarItems: [],
    paletteId: null,
    husSkalId: null,
    stars: 0,
    xp: 0,
    completed: 0,
    husLast: !!locked,
  };
}

/** Vilka av `memberIds` saknar en entry i projektionen? (för self-heal) */
export function missingMemberIds(members = {}, memberIds = []) {
  const have = members && typeof members === "object" ? members : {};
  return [...new Set((Array.isArray(memberIds) ? memberIds : []).filter(Boolean))].filter(
    (id) => !have[id]
  );
}

/**
 * REN hjälpare: gör en members-entry (keyad på `id` i projektionen) till det
 * översikts-objekt som byn/grannbyn ritar (mountByScen + aggregateKlassStats).
 * Samma form som den gamla getStudentsWithLooks gav: `id` läggs på och `locked`
 * härleds ur entryns `husLast` (låst hus ritas 🔒). Egen elev märks aldrig låst
 * ute i byn (mountByScen gate:ar `!me`), så ingen special-casing behövs här.
 */
export function entryToBoende(id, entry = {}) {
  const e = entry || {};
  return {
    id,
    namn: e.namn || "",
    username: e.username || "",
    avatarId: e.avatarId || "fox",
    avatarItems: Array.isArray(e.avatarItems) ? e.avatarItems : [],
    paletteId: e.paletteId || null,
    husSkalId: e.husSkalId || null,
    xp: Math.max(0, Number(e.xp) || 0),
    completed: Math.max(0, Number(e.completed) || 0),
    stars: Math.max(0, Number(e.stars) || 0),
    locked: !!e.husLast,
  };
}

/**
 * REN hjälpare: bygg översikts-arrayen (boende) ur en members-map, i ordningen
 * `orderIds` (deduplicerad). Id:n som saknar en entry hoppas tyst över – efter
 * self-heal ska de dock alltid finnas.
 */
export function boendeFromMembers(members = {}, orderIds = []) {
  const m = members && typeof members === "object" ? members : {};
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(orderIds) ? orderIds : []) {
    if (!id || seen.has(id) || !m[id]) continue;
    seen.add(id);
    out.push(entryToBoende(id, m[id]));
  }
  return out;
}
