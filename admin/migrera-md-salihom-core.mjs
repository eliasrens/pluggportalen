// ============================================================================
// Matchdagen: förnamnet Hedda → Salihom i de sparade spelarna – ren kärna (#916)
// ----------------------------------------------------------------------------
// planeraNamnbyte(K, rakna?) → patch | null för ETT matchdagen/{uid}-dokument.
// Skriptet admin/migrera-md-salihom.mjs kör den på alla dokument (torrt som standard).
//
// Spelarnamnen sparas bara i karriären (docs/DATAMODELL.md, matchdagen/{uid}):
//   trupp     [{ id, namn, … }]   startelvan
//   reserver  [{ id, namn, … }]   reserverna (#871)
//   marknad   ["id|namn|pos|nr|st"] spelarna till salu (äldre dokument: objekt)
// Inget annat i Matchdagen bär spelarnamn: ligan, kvalet, pokalerna och klubbhistoriken har
// lagnamn, vänskapsmatcherna (mdLobby/mdVanskap) och topplistan elevernas och lagens namn.
//
// Bara ett förnamn som är EXAKT "Hedda" byts ("Hedda Berg" → "Salihom Berg"); efternamnet,
// alla andra fält och alla andra namn rörs inte. Idempotent: en andra körning ger null.
// ============================================================================

export const GAMMALT = "Hedda";
export const NYTT = "Salihom";

/** Det nya namnet om förnamnet är exakt GAMMALT, annars null. */
export function nyttNamn(namn) {
  if (typeof namn !== "string") return null;
  if (namn === GAMMALT) return NYTT;
  return namn.startsWith(`${GAMMALT} `) ? NYTT + namn.slice(GAMMALT.length) : null;
}

/** En spelare som objekt: en kopia med det nya namnet, eller null. */
function spelare(p) {
  const n = p && typeof p === "object" ? nyttNamn(p.namn) : null;
  return n ? { ...p, namn: n } : null;
}

/** En rad i marknaden ("id|namn|pos|nr|st") – eller ett objekt i ett äldre dokument. */
function saluRad(r) {
  if (typeof r !== "string") return spelare(r);
  const delar = r.split("|");
  const n = nyttNamn(delar[1]);
  if (!n) return null;
  delar[1] = n;
  return delar.join("|");
}

/**
 * Patchen ({ trupp?, reserver?, marknad? } – hela listorna, bara de som ändras) eller null.
 * rakna (valfri) får antalet bytta spelare per lista: { trupp, reserver, marknad }.
 */
export function planeraNamnbyte(K, rakna = {}) {
  if (!K || typeof K !== "object") return null;
  const patch = {};
  for (const [falt, byt] of [["trupp", spelare], ["reserver", spelare], ["marknad", saluRad]]) {
    const lista = K[falt];
    if (!Array.isArray(lista)) continue;
    let antal = 0;
    const ny = lista.map((x) => {
      const y = byt(x);
      if (y === null) return x;
      antal++;
      return y;
    });
    if (!antal) continue;
    patch[falt] = ny;
    rakna[falt] = (rakna[falt] || 0) + antal;
  }
  return Object.keys(patch).length ? patch : null;
}
