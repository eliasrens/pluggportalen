// ============================================================================
// Matchdagen (#869, Etapp 1c): det som sparas LOKALT (spec §5) – ren modul,
// lagringen skickas in (localStorage på webben, en Map i testerna).
//   • den pågående matchen, efter varje läge: matchdagen-match:{uid}
//     { v, sasong, omg, matchId, m, kallNamn } – fortsätter efter omladdning
//   • en färdig match som inte hann sparas: matchdagen-osparad:{uid}
//     { K, matchId, match } – sparas om nästa gång Matchdagen öppnas
//
//   lasPagaende(lagring, uid, K) → post | null  (bara om den hör till nästa match)
//   sparaPagaende(lagring, uid, post), rensaPagaende(lagring, uid)
//   lasOsparad / sparaOsparad / rensaOsparad
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

export function lasOsparad(lagring, uid) {
  const p = las(lagring, OSPARAD_NYCKEL + uid);
  return p && p.K && p.match && typeof p.matchId === "string" ? p : null;
}
export const sparaOsparad = (lagring, uid, post) => skriv(lagring, OSPARAD_NYCKEL + uid, post);
export const rensaOsparad = (lagring, uid) => skriv(lagring, OSPARAD_NYCKEL + uid, null);
