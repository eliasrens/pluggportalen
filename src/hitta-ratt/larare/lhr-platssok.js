// ============================================================================
// Hitta rätt! – platssökning för punktfrågor (src/hitta-ratt/larare/lhr-platssok.js) · #636
// ----------------------------------------------------------------------------
// Arkitektur §11.6. Bara lärarvyn (dynamisk import). Ingen DOM, inget
// Firebase – fetch och klocka injiceras, så hela modulen testas i Node.
//
//   const s = skapaPlatssok({ fetch, nu, vanta })
//   await s.sok(q, { scope, kalla: "auto" | "osm" })
//     → { kalla: "wikidata" | "osm", traffar: [{ kalla, namn, besk, lon, lat, inom, p18? }] }
//     auto: Wikidata först (wbsearchentities + wbgetentities, bara träffar med
//           P625 på jorden). 0 träffar ELLER fel → Nominatim som reserv.
//     osm:  bara Nominatim (knappen "Sök i OpenStreetMap").
//     inom = ligger i packets scope (delat/scope.js) – lärarvyn gråar resten.
//     Kastar PlatssokFel { code: "tom" | "kort" | "nat" | "429" | "server", message }.
//
// Användarvillkoren (Nominatim + Wikimedia):
//   • ingen autocomplete – vyn anropar bara på knapp eller Enter
//   • strypning: en sökning startar högst en gång per sekund, och två anrop
//     till Nominatim ligger alltid ≥ 1 s isär
//   • svaren cachas per sökord och källa (sessionen)
//   • webbläsaren skickar Referer (sajtens origin) som identifiering; träffar
//     från Nominatim visas med OSM_ATTRIBUTION (ODbL)
// Wikidata är CC0 – ingen attribution krävs.
// ============================================================================

import { inomScope } from "../delat/scope.js";

export const MIN_MS = 1000;
export const OSM_ATTRIBUTION = "Platsdata © OpenStreetMap-bidragsgivare (ODbL)";
export const TEXT = {
  tom: "Inget hittades. Prova ett annat namn eller klicka på kartan.",
  kort: "Skriv minst två bokstäver.",
  nat: "Sökningen når inte ut – kontrollera internetanslutningen. Du kan också klicka direkt på kartan.",
  429: "Söktjänsten har fått för många sökningar just nu. Vänta en minut och försök igen – eller klicka direkt på kartan.",
  server: "Sökningen fungerar inte just nu. Försök igen om en stund – eller klicka direkt på kartan.",
};

const WD = "https://www.wikidata.org/w/api.php?format=json&origin=*";
const NOMINATIM = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=sv";
const JORDEN = "http://www.wikidata.org/entity/Q2";

export class PlatssokFel extends Error {
  constructor(code) {
    super(TEXT[code] || TEXT.server);
    this.code = code;
  }
}

/** ≈ 1 m – samma avrundning som servern (delat/egna.js). */
export const avrunda = (v) => Math.round(v * 1e5) / 1e5;

const norm = (q) => String(q || "").trim().replace(/\s+/g, " ").toLowerCase();

/** P625 (koordinat) på jorden – månkratrar och liknande sorteras bort. Föredragen rang först. */
export function koordinatUr(claims) {
  const lista = (claims?.P625 || []).filter((c) => c?.rank !== "deprecated");
  const c = lista.find((x) => x.rank === "preferred") || lista[0];
  const v = c?.mainsnak?.datavalue?.value;
  if (!v || !Number.isFinite(v.latitude) || !Number.isFinite(v.longitude)) return null;
  if (v.globe && v.globe !== JORDEN) return null;
  return { lat: v.latitude, lon: v.longitude };
}

export function skapaPlatssok({
  fetch: hamta = (...a) => globalThis.fetch(...a),
  nu = () => Date.now(),
  vanta = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const cache = new Map();
  const sokKlocka = { v: 0 }; // tidigaste start för nästa sökning
  const osmKlocka = { v: 0 }; // tidigaste nästa anrop till Nominatim

  async function strypt(mal) {
    const t = nu();
    if (mal.v > t) await vanta(mal.v - t);
    mal.v = Math.max(nu(), t) + MIN_MS;
  }

  async function json(url) {
    let r;
    try {
      r = await hamta(url, { referrerPolicy: "strict-origin-when-cross-origin" });
    } catch {
      throw new PlatssokFel("nat");
    }
    if (r.status === 429) throw new PlatssokFel("429");
    if (!r.ok) throw new PlatssokFel("server");
    try {
      return await r.json();
    } catch {
      throw new PlatssokFel("server");
    }
  }

  async function wikidata(q) {
    const s = await json(`${WD}&action=wbsearchentities&type=item&limit=10&language=sv&uselang=sv&search=${encodeURIComponent(q)}`);
    const traffar = Array.isArray(s?.search) ? s.search : [];
    if (!traffar.length) return [];
    const e = await json(`${WD}&action=wbgetentities&props=claims&ids=${traffar.map((x) => x.id).join("|")}`);
    return traffar.map((x) => {
      const claims = e?.entities?.[x.id]?.claims;
      const k = koordinatUr(claims);
      if (!k) return null;
      const p18 = claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      return { kalla: `wikidata:${x.id}`, namn: x.label || x.id, besk: x.description || "", ...k, ...(p18 ? { p18 } : {}) };
    }).filter(Boolean);
  }

  async function nominatim(q) {
    await strypt(osmKlocka);
    const r = await json(`${NOMINATIM}&q=${encodeURIComponent(q)}`);
    return (Array.isArray(r) ? r : []).map((x) => {
      const lat = Number(x.lat), lon = Number(x.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const namn = x.name || String(x.display_name || "").split(",")[0] || q;
      return { kalla: `osm:${x.osm_type}/${x.osm_id}`, namn, besk: x.display_name || "", lat, lon };
    }).filter(Boolean);
  }

  async function uppslag(kalla, q) {
    const nyckel = `${kalla}:${norm(q)}`;
    if (!cache.has(nyckel)) {
      const p = kalla === "osm" ? nominatim(q) : wikidata(q);
      cache.set(nyckel, p);
      p.catch(() => cache.delete(nyckel)); // fel cachas inte
    }
    return cache.get(nyckel);
  }

  return {
    async sok(q, { scope = null, kalla = "auto" } = {}) {
      q = String(q || "").trim();
      if (q.length < 2) throw new PlatssokFel("kort");
      const iCache = cache.has(`${kalla === "osm" ? "osm" : "wikidata"}:${norm(q)}`);
      if (!iCache) await strypt(sokKlocka);
      let kalla2 = kalla === "osm" ? "osm" : "wikidata";
      let traffar = [];
      let wdFel = null;
      if (kalla2 === "wikidata") {
        traffar = await uppslag("wikidata", q).catch((err) => { wdFel = err; return []; });
        if (!traffar.length) {
          kalla2 = "osm";
          try {
            traffar = await uppslag("osm", q);
          } catch (err) {
            throw wdFel || err;
          }
        }
      } else {
        traffar = await uppslag("osm", q);
      }
      if (!traffar.length) throw wdFel || new PlatssokFel("tom");
      return {
        kalla: kalla2,
        traffar: traffar.map((t) => ({ ...t, inom: scope ? inomScope(scope, t.lon, t.lat) : true })),
      };
    },
  };
}
