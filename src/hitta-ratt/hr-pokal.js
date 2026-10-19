// ============================================================================
// Hitta rätt! – Kartmästare-pokalerna, ren logik (src/hitta-ratt/hr-pokal.js) · #610
// ----------------------------------------------------------------------------
// Pokalen är INGEN ägd sak (arkitektur §0/§3.2): den ritas ur
// hittaRattMeta/ledare = { packs: { [packId]: { uids, titel, typ, scope? } } }, som
// bara Cloud Functionen skriver – i samma transaktion som topplistan, med
// ledarna omräknade ur alla entries (rank.js: alla på plats 1, delad etta →
// flera). Eleven sparar bara PLACERINGEN i room.placements["hrpokal-<packId>"].
// Tappar eleven ledningen finns packen inte längre i elevens lista → pokalen
// ritas inte, ligger inte i lådan och placeringen städas bort. Den kan inte
// säljas, köpas eller behållas (finns aldrig i ownedItems).
// Toggle av (hittaRattSattTopplista, #635): functionen tar bort packs.{packId}
// → samma väg. Egna pack har scope (sverige/europa/varlden) → pokalens motiv.
//
// API (rent, testas i Node)
//   POKAL_PREFIX, arPokalNyckel(key), pokalNyckel(packId), packIdFranNyckel(key)
//   pokalNamn(titel)              → "Kartmästare – Skolrekord {titel}"
//   minaPokaler(meta, uid)        → [{ nyckel, packId, titel, typ, scope?, namn }] (sorterad på titel)
//   schackPokaler(schack, katalog) → schackets pokaler (#798) i samma form, typ "schack"
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
    const scope = typeof p.scope === "string" ? { scope: p.scope } : {};
    ut.push({ nyckel: pokalNyckel(packId), packId, titel, typ: p.typ === "area" ? "area" : "point", ...scope, namn: pokalNamn(titel) });
  }
  return ut.sort((a, b) => a.titel.localeCompare(b.titel, "sv"));
}

/**
 * Schackets pokaler (#798) i husets pokal-nycklar: studentData.schack.pokaler =
 * { damen: ms } (bara servern skriver) → [{ nyckel: "hrpokal-schack-damen", … }].
 * Samma placeringsväg som Kartmästare-pokalerna (prefixet, lådan, städningen).
 * `katalog` = SCHACK_POKALER (src/schack/schack-mynt-delat.js, laddas dynamiskt av
 * anroparen) – okända nycklar ger ingen pokal.
 * @param {object|null} schack studentData.schack
 * @param {Record<string, { id: string, namn: string, text?: string }>} katalog
 */
export function schackPokaler(schack, katalog) {
  const p = schack && typeof schack === "object" ? schack.pokaler : null;
  if (!p || typeof p !== "object" || !katalog) return [];
  return Object.keys(katalog).filter((id) => Object.hasOwn(p, id) && p[id] != null).map((id) => ({
    nyckel: pokalNyckel(`schack-${id}`), packId: `schack-${id}`, titel: katalog[id].namn, typ: "schack",
    schack: id, namn: katalog[id].namn,
  }));
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
