// ============================================================================
// Hitta rätt! 2/2 – SPIK (#632): vilken platssökning för lärarens punktfrågor?
// ----------------------------------------------------------------------------
// Jämför Wikidata (wbsearchentities + wbgetentities P625/P18) med Nominatim
// (OSM) på svenska sökord som en lärare skulle skriva. Skriver en tabell:
// träff, beskrivning, koordinat och avstånd mellan tjänsterna.
//
//   node admin/hitta-ratt-sok-spik.mjs                  standardlistan
//   node admin/hitta-ratt-sok-spik.mjs "Gävle" "Vättern" egna sökord
//
// Nominatims användarvillkor följs: högst 1 anrop/s, identifierande
// User-Agent, ingen autocomplete. Inga beroenden, Node 18+ (global fetch).
// Resultatet är inklistrat i docs/HITTA-RATT-ARKITEKTUR.md §11.6.
// ============================================================================

const UA = "Pluggporten-spik/1.0 (https://www.pluggporten.se; arkitektur #632)";
const ORD = process.argv.slice(2).length ? process.argv.slice(2) : [
  "Gävle", "Kiruna", "Kebnekaise", "Storsjön", "Vättern", "Ölands södra udde",
  "Höga kusten", "Eiffeltornet", "Kilimanjaro", "Visby ringmur", "Sarek", "Lund",
];

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const json = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

function km([lon1, lat1], [lon2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Wikidata: 2 anrop – sök (svenska etiketter) och hämta P625 + P18 för träffarna. */
async function wikidata(q) {
  const s = await json(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&type=item&limit=7&language=sv&uselang=sv&search=${encodeURIComponent(q)}`);
  const ids = s.search.map((x) => x.id);
  if (!ids.length) return [];
  const e = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=${ids.join("|")}`);
  return s.search.map((x) => {
    const c = e.entities[x.id]?.claims || {};
    const p = c.P625?.[0]?.mainsnak?.datavalue?.value;
    return {
      id: x.id, namn: x.label, besk: x.description || "",
      lonlat: p ? [p.longitude, p.latitude] : null,
      bild: c.P18?.[0]?.mainsnak?.datavalue?.value || null,
    };
  }).filter((x) => x.lonlat);
}

async function nominatim(q) {
  const r = await json(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=sv&q=${encodeURIComponent(q)}`);
  return r.map((x) => ({ namn: x.name, besk: x.display_name, typ: `${x.category}/${x.type}`, lonlat: [+x.lon, +x.lat] }));
}

const rad = [];
let wdMs = 0;
for (const q of ORD) {
  const t0 = performance.now();
  const wd = await wikidata(q).catch((e) => (console.error(e.message), []));
  wdMs += performance.now() - t0;
  await vanta(1100); // Nominatim: max 1 req/s
  const nm = await nominatim(q).catch((e) => (console.error(e.message), []));
  const a = wd[0], b = nm[0];
  rad.push({
    sok: q,
    wikidata: a ? `${a.namn} – ${a.besk.slice(0, 40)} (${wd.length} m. koord${a.bild ? ", bild" : ""})` : "–",
    nominatim: b ? `${b.namn} – ${b.typ} (${nm.length})` : "–",
    skillnadKm: a && b ? Math.round(km(a.lonlat, b.lonlat)) : null,
  });
}
console.table(rad);
console.log(`Wikidata snitt ${Math.round(wdMs / ORD.length)} ms per sökning (2 anrop).`);
