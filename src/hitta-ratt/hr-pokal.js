// ============================================================================
// Hitta rätt! – Kartmästare-pokalerna, ren logik (src/hitta-ratt/hr-pokal.js) · #610
// ----------------------------------------------------------------------------
// Pokalen är INGEN ägd sak (arkitektur §0/§3.2): den ritas ur
// hittaRattMeta/ledare = { packs: { [packId]: { uids, titel, typ } } }, som
// bara Cloud Functionen skriver – i samma transaktion som topplistan, med
// ledarna omräknade ur alla entries (rank.js: alla på plats 1, delad etta →
// flera). Eleven sparar bara PLACERINGEN i room.placements["hrpokal-<packId>"].
// Tappar eleven ledningen finns packen inte längre i elevens lista → pokalen
// ritas inte, ligger inte i lådan och placeringen städas bort. Den kan inte
// säljas, köpas eller behållas (finns aldrig i ownedItems).
// Toggle av (epic 2/2): functionen tar bort packs.{packId} → samma väg.
//
// API (rent, testas i Node)
//   POKAL_PREFIX, arPokalNyckel(key), pokalNyckel(packId), packIdFranNyckel(key)
//   pokalNamn(titel)              → "Kartmästare – Skolrekord {titel}"
//   minaPokaler(meta, uid)        → [{ nyckel, packId, titel, typ, namn }] (sorterad på titel)
//   rensaPokaler(placements, giltiga) → antal borttagna (muterar placements)
// ============================================================================

export const POKAL_PREFIX = "hrpokal-";
const PACK_RE = /^[a-z0-9-]{1,60}$/;

export const arPokalNyckel = (key) => String(key || "").startsWith(POKAL_PREFIX);
export const pokalNyckel = (packId) => POKAL_PREFIX + packId;
export const packIdFranNyckel = (key) => (arPokalNyckel(key) ? String(key).slice(POKAL_PREFIX.length) : null);

export function pokalNamn(titel) {
  return `Kartmästare – Skolrekord ${titel}`;
}

/**
 * De pack där `uid` leder topplistan just nu. Saknat/trasigt dokument,
 * tom uids-lista eller ett avstängt pack (`av: true`, förberett för epic 2/2)
 * ger ingen pokal.
 * @param {object|null} meta hittaRattMeta/ledare
 * @param {string} uid
 */
export function minaPokaler(meta, uid) {
  if (!uid || !meta || typeof meta.packs !== "object" || !meta.packs) return [];
  const ut = [];
  for (const [packId, p] of Object.entries(meta.packs)) {
    if (!PACK_RE.test(packId) || !p || p.av === true) continue;
    if (!Array.isArray(p.uids) || !p.uids.includes(uid)) continue;
    const titel = typeof p.titel === "string" && p.titel ? p.titel : packId;
    ut.push({ nyckel: pokalNyckel(packId), packId, titel, typ: p.typ === "area" ? "area" : "point", namn: pokalNamn(titel) });
  }
  return ut.sort((a, b) => a.titel.localeCompare(b.titel, "sv"));
}

/**
 * Ta bort pokal-placeringar som eleven inte längre har rätt till (tappad
 * ledning, avstängd topplista). Rör aldrig vanliga möbler.
 * @param {Record<string, object>} placements muteras
 * @param {Set<string>} giltiga pokal-nycklar eleven har nu
 * @returns {number} antal borttagna
 */
export function rensaPokaler(placements, giltiga) {
  let n = 0;
  for (const key of Object.keys(placements || {})) {
    if (arPokalNyckel(key) && !giltiga.has(key)) {
      delete placements[key];
      n += 1;
    }
  }
  return n;
}
