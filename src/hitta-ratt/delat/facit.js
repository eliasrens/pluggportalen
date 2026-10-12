// ============================================================================
// Hitta rätt! – facit som servern rättar mot (src/hitta-ratt/delat/facit.js) · #633
// ----------------------------------------------------------------------------
// Ren modul, DELAD med servern. Officiella pack (sync-skriptet → packs.js) och
// egna pack (hittaRattPacks, läses av hittaRattSubmit) görs om till SAMMA
// kompakta form, så de rättas identiskt av delat/omgang.js.
//
//   kompaktFacit(pack, omraden) → { id, typ, titel, leaderboard, cfg, items,
//                                   omraden? }   (omraden = geofilens alla id)
//     leaderboard: officiella = PÅ om inte false, egna = AV om inte true (§11.0)
//   facitNyckel(pack) → kanonisk sträng av det som avgör svaren: typ, geo och
//     items-id + lat/lon (punkt) eller område. Ordningen spelar ingen roll.
//     Servern hashar den (sha1) – ändras nyckeln höjs packens version (§11.4).
//     Texter, bilder, beskrivning och klasser ingår INTE.
// ============================================================================

const typAv = (pack) => (pack?.type === "area" ? "area" : "point");

export function kompaktFacit(pack, omraden) {
  const typ = typAv(pack);
  return {
    id: pack.id,
    typ,
    titel: pack.title,
    leaderboard: pack.official === false ? pack.leaderboard === true : pack.leaderboard !== false,
    cfg: pack.scoringConfig || {},
    items: pack.items.map((it) => (typ === "area" ? { id: it.id, omrade: it.omrade } : { id: it.id, lat: it.lat, lon: it.lon })),
    ...(typ === "area" ? { omraden: [...(omraden || [])].sort() } : {}),
  };
}

export function facitNyckel(pack) {
  const typ = typAv(pack);
  const rader = (pack.items || [])
    .map((it) => (typ === "area" ? `${it.id}=${it.omrade}` : `${it.id}=${Number(it.lat)},${Number(it.lon)}`))
    .sort();
  return `${typ}|${pack.geo}|${rader.join(";")}`;
}
