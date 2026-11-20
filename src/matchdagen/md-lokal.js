// ============================================================================
// Matchdagen (#869, Etapp 1c): det som sparas LOKALT (spec §5) – ren modul,
// lagringen skickas in (localStorage på webben, en Map i testerna).
//   • den pågående matchen, efter varje läge: matchdagen-match:{uid}
//     { v, sasong, omg, matchId, m, kallNamn } – fortsätter efter omladdning
//   • färdiga matcher som inte hann sparas – en KÖ: matchdagen-osparad:{uid}
//     { K, koe: [{ matchId, match }] } – K är karriären efter den senaste matchen.
//     Kön sparas (md-spara.js) när Matchdagen öppnas och efter varje match, så att
//     ingen match försvinner om flera sparningar i rad misslyckas.
//
//   lasPagaende(lagring, uid, K) → post | null  (bara om den hör till nästa match)
//   sparaPagaende(lagring, uid, post), rensaPagaende(lagring, uid)
//   lasOsparad(lagring, uid) → { K, koe } | null
//   laggIKo(lagring, uid, { K, matchId, match })   lägger matchen sist i kön, K blir den nya
//   sparaOsparad(lagring, uid, { K, koe } | null), rensaOsparad(lagring, uid)
// ============================================================================

export const MATCH_NYCKEL = "matchdagen-match:";
export const OSPARAD_NYCKEL = "matchdagen-osparad:";

function las(lagring, nyckel) {
  try { return JSON.parse(lagring?.getItem(nyckel) || "null"); } catch { return null; }
}
function skriv(lagring, nyckel, v) {
  try { if (v == null) lagring?.removeItem(nyckel); else lagring?.setItem(nyckel, JSON.stringify(v)); } catch { /* privat fönster */ }
}

/** Den pågående matchen – bara om den gäller klubbens nästa match (samma säsong och omgång). */
export function lasPagaende(lagring, uid, K) {
  const p = las(lagring, MATCH_NYCKEL + uid);
  if (!p || p.v !== 1 || !p.m || typeof p.matchId !== "string") return null;
  if (!K || p.sasong !== K.sasong || p.omg !== K.liga?.omg || p.m.slut) return null;
  return p;
}
export const sparaPagaende = (lagring, uid, post) => skriv(lagring, MATCH_NYCKEL + uid, { v: 1, ...post });
export const rensaPagaende = (lagring, uid) => skriv(lagring, MATCH_NYCKEL + uid, null);

/** Högst så många osparade matcher (en hel säsong och mer – sedan släpps de äldsta). */
export const KO_MAX = 30;
const giltig = (x) => x && x.match && typeof x.matchId === "string";

export function lasOsparad(lagring, uid) {
  const p = las(lagring, OSPARAD_NYCKEL + uid);
  if (!p || !p.K) return null;
  // Äldre form (en enda match): { K, matchId, match }.
  const koe = Array.isArray(p.koe) ? p.koe.filter(giltig) : giltig(p) ? [{ matchId: p.matchId, match: p.match }] : [];
  return koe.length ? { K: p.K, koe } : null;
}
export function laggIKo(lagring, uid, { K, matchId, match }) {
  const koe = (lasOsparad(lagring, uid)?.koe || []).filter((x) => x.matchId !== matchId);
  koe.push({ matchId, match });
  sparaOsparad(lagring, uid, { K, koe: koe.slice(-KO_MAX) });
}
export const sparaOsparad = (lagring, uid, post) => skriv(lagring, OSPARAD_NYCKEL + uid, post);
export const rensaOsparad = (lagring, uid) => skriv(lagring, OSPARAD_NYCKEL + uid, null);
