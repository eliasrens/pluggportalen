// ============================================================================
// Matchdagen (#869, Etapp 1c): det som sparas LOKALT (spec §5) – ren modul,
// lagringen skickas in (localStorage på webben, en Map i testerna).
//   • den pågående matchen, efter varje läge: matchdagen-match:{uid}
//     { v, sasong, omg, typ, matchId, m } – fortsätter efter omladdning (också mitt i
//     en straffläggning: matchen är inte klar förrän straffarna är avgjorda)
//   • färdiga matcher som inte hann sparas – en KÖ: matchdagen-osparad:{uid}
//     { K, koe: [{ matchId, match }] } – K är karriären efter den senaste matchen.
//     Kön sparas (md-spara.js) när Matchdagen öppnas och efter varje match, så att
//     ingen match försvinner om flera sparningar i rad misslyckas.
//
//   lasPagaende(lagring, uid, K, typ?) → post | null  (bara om den hör till nästa match; typ "liga" | "kval")
//   sparaPagaende(lagring, uid, post), rensaPagaende(lagring, uid)
//   lasOsparad(lagring, uid) → { K, koe } | null
//   laggIKo(lagring, uid, { K, matchId, match })   lägger matchen sist i kön, K blir den nya
//   sparaOsparad(lagring, uid, { K, koe } | null), rensaOsparad(lagring, uid)
//   • det pågående träningslägret (#871, §8.4): matchdagen-lager:{uid}
//     { v, nyckel, spelareId, svar: [{ ratt }], sek } – varje svar sparas SÅ FORT det
//     är givet, så en omladdning fortsätter på nästa fråga (aldrig en ny chans på samma)
//   lasLager(lagring, uid, K) → post | null  (bara om lägret fortfarande är ledigt i K)
//   sparaLager(lagring, uid, post), rensaLager(lagring, uid)
// ============================================================================

import { arKlar } from "./delat/md-motor.js";
import { lagerNyckel } from "./delat/md-trupp.js";

export const MATCH_NYCKEL = "matchdagen-match:";
export const OSPARAD_NYCKEL = "matchdagen-osparad:";
export const LAGER_NYCKEL = "matchdagen-lager:";

function las(lagring, nyckel) {
  try { return JSON.parse(lagring?.getItem(nyckel) || "null"); } catch { return null; }
}
function skriv(lagring, nyckel, v) {
  try { if (v == null) lagring?.removeItem(nyckel); else lagring?.setItem(nyckel, JSON.stringify(v)); } catch { /* privat fönster */ }
}

/** Den pågående matchen – bara om den gäller klubbens nästa match (samma säsong, omgång och typ). */
export function lasPagaende(lagring, uid, K, typ = "liga") {
  const p = las(lagring, MATCH_NYCKEL + uid);
  if (!p || p.v !== 1 || !p.m || typeof p.matchId !== "string") return null;
  if (!K || p.sasong !== K.sasong || p.omg !== K.liga?.omg || (p.typ || "liga") !== typ || arKlar(p.m)) return null;
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

/** Det pågående träningslägret – bara om det gäller klubbens lediga läger och spelaren finns i startelvan. */
export function lasLager(lagring, uid, K) {
  const p = las(lagring, LAGER_NYCKEL + uid);
  if (!p || p.v !== 1 || typeof p.nyckel !== "string" || !Array.isArray(p.svar)) return null;
  if (!K || p.nyckel !== lagerNyckel(K) || !K.trupp?.some((x) => x.id === p.spelareId)) return null;
  return { ...p, svar: p.svar.map((x) => ({ ratt: x?.ratt === true })), sek: Math.max(0, Number(p.sek) || 0) };
}
export const sparaLager = (lagring, uid, post) => skriv(lagring, LAGER_NYCKEL + uid, { v: 1, ...post });
export const rensaLager = (lagring, uid) => skriv(lagring, LAGER_NYCKEL + uid, null);
