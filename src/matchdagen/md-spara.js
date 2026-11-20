// ============================================================================
// Matchdagen (#869, Etapp 1c): KÖN av osparade matcher (md-lokal.js) och valet av
// karriär när Matchdagen öppnas. Ingen DOM och ingen Firebase – S.data (md-data.js
// eller förhandsvisningens stubbe) och S.lagring skickas in, så det testas i node.
//
//   hamtaKarriar(S) → K | null     läser karriären EN gång, väljer den sparade eller
//                                  den lokala (flest matcher) och sparar kön
//   sparaKon(S, K?) → bool         sparar köns matcher i ordning med karriären K
//                                  (standard köns egen); true = kön är tom
//
// Kön ligger kvar tills varje match har sparats, så flera misslyckade sparningar i
// rad (offline) förlorar ingen match. Kunde karriären inte läsas skrivs ingenting –
// en gammal lokal kopia får aldrig skriva över en nyare på servern (S.lasfel).
// ============================================================================

import { karriarOk } from "./delat/md-sasong.js";
import { lasOsparad, sparaOsparad } from "./md-lokal.js";

export async function sparaKon(S, K = null) {
  const o = lasOsparad(S.lagring, S.uid);
  if (!o) return true;
  const kvar = [...o.koe];
  try {
    while (kvar.length) {
      const { matchId, match } = kvar[0];
      await S.data.sparaMatch(S.uid, K || o.K, matchId, match);
      kvar.shift();
    }
  } catch (err) {
    console.warn(`Matchdagen: ${kvar.length} match(er) kunde inte sparas än – de ligger kvar på datorn`, err);
  }
  sparaOsparad(S.lagring, S.uid, kvar.length ? { K: o.K, koe: kvar } : null);
  return !kvar.length;
}

const antalMatcher = (K) => Number(K?.summa?.matcher) || 0;

export async function hamtaKarriar(S) {
  let K = null;
  try {
    K = await S.data.lasKarriar(S.uid);
  } catch (err) {
    console.warn("Matchdagen: karriären kunde inte läsas", err);
    S.lasfel = true;
    return null;
  }
  K = karriarOk(K) ? K : null;
  const o = lasOsparad(S.lagring, S.uid);
  if (!o) return K;
  // Den lokala har fler matcher (de osparade) – men klubben (namnet) är serverns:
  // läraren kan ha återställt lagnamnet medan matcherna låg kvar på datorn.
  const val = !K || antalMatcher(o.K) > antalMatcher(K) ? (K ? { ...o.K, klubb: K.klubb } : o.K) : K;
  await sparaKon(S, val);
  return val;
}
