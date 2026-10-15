// ============================================================================
// Bråkresan – huvudvyns listlogik (src/brakresan/huvudvy-lista.js) · #713 H
// ----------------------------------------------------------------------------
// Ren logik utan DOM (testas i test/brakresan-huvudvy.test.js), spec §11:
//   sammanfattning(state)          → { stars, mastered } (X/150, Y/50)
//   kortStatus(entry)              → { status, label, ikon, stars, senast }
//   matcharSok(c, sok)             → sök på nummer, namn, mål, moment (taggar)
//   filtrera(lista, { sok, filter, state, rek }) → utmaningarna som syns
//   rekommendationer(docs)         → Map(id → [kommentar …]) i katalogordning
//   listlage.spara/las             → filter, sök och scrollposition (sessionStorage)
// Filtren döljer bara tillfälligt – ingen utmaning låses (§2, §11).
// ============================================================================

import { CHALLENGES, TAGS, extraLabel } from "./schema/katalog.js";
import { challengeStatus, MAX_STARS_PER_CHALLENGE } from "./schema/regler.js";

export const FILTER = Object.freeze([
  { id: "alla", label: "Alla" },
  { id: "inte-bemastrade", label: "Inte bemästrade" },
  { id: "bemastrade", label: "Bemästrade" },
  { id: "rekommenderade", label: "Rekommenderade" },
]);
const FILTER_IDS = new Set(FILTER.map((f) => f.id));

/** Stjärnor X/150 och bemästrade Y/50 – räknade ur posterna (samma som servern). */
export function sammanfattning(state) {
  const poster = Object.values(state?.challenges || {});
  const stj = poster.map((e) => Math.max(0, Math.min(MAX_STARS_PER_CHALLENGE, e?.stars || 0)));
  return { stars: stj.reduce((a, b) => a + b, 0), mastered: stj.filter((s) => s >= MAX_STARS_PER_CHALLENGE).length };
}

// Ikonen står alltid bredvid texten – status läses utan färg (§11).
const IKON = { "inte-paborjad": "○", pagaende: "◐", tranar: "↻", stjarnor: "★", bemastrad: "✪" };

/** Kortets status ur state-posten (regler.js challengeStatus) + ikon och senaste resultat. */
export function kortStatus(entry = {}) {
  const { status, label } = challengeStatus(entry);
  const stars = Math.max(0, Math.min(MAX_STARS_PER_CHALLENGE, entry.stars || 0));
  const senast = Number.isInteger(entry.last) ? `Senast ${entry.last} av 10` : null;
  return { status, label, ikon: IKON[status], stars, senast };
}

/** Gemener utan diakritiska tecken: "Bråk" och "brak" hittar samma sak. */
export const normalisera = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// Ämnesrubriken ingår inte: "tallinje" ska hitta tallinjeutmaningarna, inte hela avsnittet.
const SOKTEXT = new Map(CHALLENGES.map((c) => [c.id, normalisera([
  c.name, c.goal, extraLabel(c), ...c.tags.map((t) => TAGS[t]),
].filter(Boolean).join(" "))]));

/**
 * Sök på namn/moment: alla ord måste finnas. Ett tal ("3", "03") träffar
 * utmaningens nummer – och står det ensamt bara numret.
 */
export function matcharSok(c, sok) {
  const ord = normalisera(sok).split(/\s+/).filter(Boolean);
  if (!ord.length) return true;
  if (ord.length === 1 && /^\d{1,2}$/.test(ord[0])) return Number(ord[0]) === c.nr;
  const text = SOKTEXT.get(c.id) || normalisera(c.name);
  return ord.every((o) => (/^\d{1,2}$/.test(o) ? Number(o) === c.nr : text.includes(o)));
}

/**
 * Utmaningarna som syns med aktuell sökning och filter, i föreskriven ordning.
 * @param {object[]} lista  katalogposter (CHALLENGES)
 * @param {{ sok?: string, filter?: string, state?: object, rek?: Map }} o
 */
export function filtrera(lista, { sok = "", filter = "alla", state = null, rek = new Map() } = {}) {
  return lista.filter((c) => {
    const stars = state?.challenges?.[c.id]?.stars || 0;
    if (filter === "bemastrade" && stars < MAX_STARS_PER_CHALLENGE) return false;
    if (filter === "inte-bemastrade" && stars >= MAX_STARS_PER_CHALLENGE) return false;
    if (filter === "rekommenderade" && !rek.has(c.id)) return false;
    return matcharSok(c, sok);
  });
}

/**
 * Lärarens aktiva rekommendationer (brakresaRecommendations, K #716) →
 * Map(utmanings-id → kommentarer) i katalogordning. Inaktiva och okända id hoppas över.
 */
export function rekommendationer(docs = []) {
  const per = new Map();
  for (const d of docs) {
    if (!d || d.active === false || !Array.isArray(d.challengeIds)) continue;
    const kommentar = typeof d.comment === "string" && d.comment.trim() ? d.comment.trim().slice(0, 200) : null;
    for (const id of d.challengeIds) {
      if (!per.has(id)) per.set(id, []);
      if (kommentar && !per.get(id).includes(kommentar)) per.get(id).push(kommentar);
    }
  }
  return new Map(CHALLENGES.filter((c) => per.has(c.id)).map((c) => [c.id, per.get(c.id)]));
}

// --- listans läge (§11: "Behåll listans läge och scrollposition") ---------------

const NYCKEL = "pp:brakresan:lista";

export const listlage = {
  /** { filter, sok, scrollY, fokus } – fokus = id på kortet eleven öppnade. */
  las(store = globalThis.sessionStorage) {
    try {
      const v = JSON.parse(store?.getItem(NYCKEL) || "null");
      if (!v || typeof v !== "object") return null;
      return {
        filter: FILTER_IDS.has(v.filter) ? v.filter : "alla",
        sok: typeof v.sok === "string" ? v.sok.slice(0, 60) : "",
        scrollY: Number.isFinite(v.scrollY) ? Math.max(0, v.scrollY) : 0,
        fokus: typeof v.fokus === "string" ? v.fokus : null,
      };
    } catch {
      return null;
    }
  },
  spara(lage, store = globalThis.sessionStorage) {
    try {
      store?.setItem(NYCKEL, JSON.stringify(lage));
    } catch { /* privat läge / fullt – listan börjar då överst */ }
  },
};
