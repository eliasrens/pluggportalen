// ============================================================================
// Hitta rätt! – personbästa och ranking (src/hitta-ratt/delat/rank.js) · #609
// ----------------------------------------------------------------------------
// Ren modul, DELAD med servern (kopieras till functions/hitta-ratt/ av
// admin/sync-hitta-ratt-functions.mjs). Inga importer.
//
// Mått (arkitektur §3.2): punkt { s } = totalpoäng · område { r, t } = antal
// rätt + aktiv tid i TIONDELAR av sekunder.
//
//   jamfor(a, b, typ)   < 0 om a är bättre, 0 om exakt lika, > 0 om sämre
//     punkt:  bara poäng – tiden finns inte ens med (§8)
//     område: fler rätt först, därefter kortare tid (§10) – 43/44 hamnar
//             därmed ALDRIG över 44/44, oavsett tid
//   battre(ny, gammal, typ)  nytt personbästa? Lika är aldrig bättre (§29)
//   rangordna(entries, typ)  [{ uid, …entry, plats }] – TÄT placering 1, 1, 2
//     (specens exempel §8). Inom delad plats sorteras raderna på namn bara för
//     att listan ska vara stabil – placeringen är densamma (inget dolt tie-break).
//   topplista(entries, typ, uid, n = 15) → { top, egen, plats, antal }
//     top = de n första raderna, plus de som delar plats med rad n (max TOPP_TAK).
//     egen = elevens rad om den INTE redan finns i top (annars null) – §22.
//   ledare(entries, typ) → uid:er på plats 1 (delad etta → flera ledare)
// ============================================================================

export const TOPP_N = 15;
export const TOPP_TAK = 25; // delad plats på rad 15 får plats, men listan svämmar inte över

const tal = (v) => (Number.isFinite(v) ? v : 0);

export function jamfor(a, b, typ) {
  if (typ === "area") {
    return tal(b.r) - tal(a.r) || tal(a.t) - tal(b.t);
  }
  return tal(b.s) - tal(a.s);
}

/** Ersätter `ny` personbästat `gammal`? Saknat rekord → ja. */
export function battre(ny, gammal, typ) {
  if (!gammal) return true;
  return jamfor(ny, gammal, typ) < 0;
}

/** Bara måtten för typen – det som sparas i personbästa och topplista. */
export function matt(res, typ) {
  return typ === "area" ? { r: tal(res.r), t: tal(res.t) } : { s: tal(res.s) };
}

/**
 * Alla entries som rader med tät placering, bäst först.
 * @param {Record<string, object>} entries uid → { n, k, s | r,t, … }
 */
export function rangordna(entries, typ) {
  const rader = Object.entries(entries || {})
    .filter(([, e]) => e && typeof e === "object")
    .map(([uid, e]) => ({ uid, ...e }));
  rader.sort((a, b) =>
    jamfor(a, b, typ) || String(a.n || "").localeCompare(String(b.n || ""), "sv") || (a.uid < b.uid ? -1 : 1)
  );
  let plats = 0;
  rader.forEach((r, i) => {
    if (i === 0 || jamfor(rader[i - 1], r, typ) !== 0) plats += 1;
    r.plats = plats;
  });
  return rader;
}

export function topplista(entries, typ, uid, n = TOPP_N) {
  const alla = rangordna(entries, typ);
  let slut = Math.min(n, alla.length);
  while (slut < alla.length && slut < TOPP_TAK && alla[slut].plats === alla[slut - 1].plats) slut += 1;
  const top = alla.slice(0, slut);
  const min = uid ? alla.find((r) => r.uid === uid) || null : null;
  const iTop = !!min && top.some((r) => r.uid === uid);
  return { top, egen: min && !iTop ? min : null, plats: min ? min.plats : null, antal: alla.length };
}

export function ledare(entries, typ) {
  return rangordna(entries, typ)
    .filter((r) => r.plats === 1)
    .map((r) => r.uid)
    .sort();
}
