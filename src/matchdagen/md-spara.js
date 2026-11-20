// ============================================================================
// Matchdagen (#869, Etapp 1c): KÖN av osparade matcher (md-lokal.js) och valet av
// karriär när Matchdagen öppnas. Ingen DOM och ingen Firebase – S.data (md-data.js
// eller förhandsvisningens stubbe) och S.lagring skickas in, så det testas i node.
//
//   hamtaKarriar(S) → K | null     läser karriären EN gång, väljer den sparade eller
//                                  den lokala (flest matcher) och sparar kön
//   sparaKon(S, K?) → bool         sparar köns matcher i ordning med karriären K
//                                  (standard köns egen); true = kön är tom
//   ovanpaServern(K, G, koe) → K   den lokala karriären ovanpå serverns trupp (#871)
//
// Kön ligger kvar tills varje match har sparats, så flera misslyckade sparningar i
// rad (offline) förlorar ingen match. Kunde karriären inte läsas skrivs ingenting –
// en gammal lokal kopia får aldrig skriva över en nyare på servern (S.lasfel).
// ============================================================================

import { CUP, KASSA, MASTARCUP } from "./delat/md-config.js";
import { karriarOk, pengarFor } from "./delat/md-sasong.js";
import { lasOsparad, sparaOsparad } from "./md-lokal.js";

/**
 * Pengarna som köns matcher gav (pengarFor + uppflyttningen efter ett vunnet kval och
 * prispengarna efter en vunnen cupfinal, #872, och en vunnen final i Mästarcupen, #873) – ur matchdokumenten.
 */
export function konsPengar(koe) {
  return koe.reduce((sum, { match: m }) => {
    const [oss, dem, div] = [Number(m?.oss) || 0, Number(m?.dem) || 0, Number(m?.div) || 0];
    const st = Array.isArray(m?.straffar) ? m.straffar.map(Number) : null;
    const vann = oss > dem || (oss === dem && st && st[0] > st[1]);
    const extra = m?.typ === "kval" && vann ? KASSA.uppflyttning
      : m?.typ === "cup" && vann && Number(m?.omg) === CUP.rundor.length ? CUP.seger
        : m?.typ === "mastarcup" && vann && Number(m?.omg) === MASTARCUP.rundor.length ? MASTARCUP.seger : 0;
    return sum + pengarFor({ oss, dem }, Number(m?.ratt) || 0, div) + Math.round(extra * (1 + div * KASSA.perDiv));
  }, 0);
}

/**
 * Den lokala karriären ovanpå serverns trupp (#871). Reglerna godtar bara spelare ur det
 * SPARADE dokumentet – har truppen ändrats någon annanstans medan matcherna låg i kön (en
 * annan dator, eller ett köp vars svar aldrig kom men som gick fram) nekas kön för alltid.
 * Då gäller matcherna, tabellen och statistiken ur den lokala karriären, men truppen,
 * reserverna och lägret ur serverns – och kassan är serverns plus köns pengar (högst den lokala).
 */
export function ovanpaServern(K, G, koe) {
  const reserver = Array.isArray(G.reserver) ? G.reserver : [];
  const ids = new Set([...G.trupp, ...reserver].map((p) => p.id));
  return {
    ...K, trupp: G.trupp, reserver, lager: G.lager,
    marknad: (K.marknad || []).filter((p) => !ids.has(p.id)),
    kassa: Math.min(Number(K.kassa) || 0, (Number(G.kassa) || 0) + konsPengar(koe)),
  };
}

export async function sparaKon(S, K = null) {
  const o = lasOsparad(S.lagring, S.uid);
  if (!o) return true;
  const kvar = [...o.koe];
  let Kn = K || o.K;
  let ovanpa = false;
  try {
    while (kvar.length) {
      const { matchId, match } = kvar[0];
      try {
        await S.data.sparaMatch(S.uid, Kn, matchId, match);
      } catch (err) {
        // Nekad: läs serverns karriär EN gång och lägg kön ovanpå dess trupp (#871).
        if (err?.code !== "permission-denied" || ovanpa) throw err;
        const G = await S.data.lasKarriar(S.uid);
        if (!karriarOk(G)) throw err;
        Kn = ovanpaServern(Kn, G, kvar);
        ovanpa = true;
        continue;
      }
      kvar.shift();
    }
  } catch (err) {
    console.warn(`Matchdagen: ${kvar.length} match(er) kunde inte sparas än – de ligger kvar på datorn`, err);
  }
  if (ovanpa) S.K = S.K ? { ...Kn, klubb: S.K.klubb } : Kn;
  sparaOsparad(S.lagring, S.uid, kvar.length ? { K: ovanpa ? Kn : o.K, koe: kvar } : null);
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
  S.K = !K || antalMatcher(o.K) > antalMatcher(K) ? (K ? { ...o.K, klubb: K.klubb } : o.K) : K;
  await sparaKon(S, S.K);
  return S.K;
}
