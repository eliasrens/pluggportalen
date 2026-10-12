// ============================================================================
// Hitta rätt! – bilder från Wikimedia Commons (src/hitta-ratt/larare/commons.js) · #637
// ----------------------------------------------------------------------------
// Arkitektur §7 och §11.8. Ren modul (ingen DOM, inget Firebase) – fetch
// injiceras. Används av lärarvyn (lhr-bilder.js, från lärarens webbläsare)
// OCH av admin/hitta-ratt-bilder.mjs (officiella packens bilder), så att
// licensvitlistan bara finns på ett ställe.
//
//   licens(extmetadata) → { licens, licensUrl } | null
//     Vitlistan: Public domain, CC0, CC BY och CC BY-SA. Allt annat → null.
//   rensaHtml(html) → ren text (Commons Artist-fält innehåller ofta länkar)
//   fotografUr(extmetadata) → Artist (eller Credit) utan HTML, ≤ 160 tecken
//
//   const c = skapaCommons({ fetch })
//   await c.sok(q)            → [träff] med godkänd licens (rutnät, 330 px)
//   await c.info(fil, 960)    → träff | null (vald bild: 960-miniatyren)
//   await c.p18(qid)          → "Gävle rådhus.jpg" | null  (Wikidatas bild, P18)
//   träff = { fil: "File:…", thumb, bredd, hojd, sida, licens, licensUrl, fotograf }
//   Kastar CommonsFel { code: "nat" | "429" | "server" } med svensk text.
//
// Eleven anropar ALDRIG Commons: läraren väljer, bilden skalas ned och kopieras
// till hittaRattBilder (§11.8).
// ============================================================================

export const API = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*";
const WD = "https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&props=claims";
const META = "License|LicenseShortName|LicenseUrl|Artist|Credit";
export const RUTNAT_PX = 330; // Commons standardsteg – ovanliga bredder stryps
export const HAMTA_PX = 960; // miniatyren som skalas ned till ≤ 800 px
const MAX_FOTOGRAF = 160;

export const TEXT = {
  nat: "Bildsökningen når inte ut – kontrollera internetanslutningen.",
  429: "Wikimedia Commons har fått för många sökningar just nu. Vänta en minut och försök igen.",
  server: "Bildsökningen fungerar inte just nu. Försök igen om en stund.",
};

export class CommonsFel extends Error {
  constructor(code) {
    super(TEXT[code] || TEXT.server);
    this.code = code;
  }
}

/** Commons-licens → { licens, licensUrl } eller null (inte på vitlistan). */
export function licens(meta = {}) {
  const kort = meta.LicenseShortName?.value || "";
  const url = meta.LicenseUrl?.value || "";
  const kod = (meta.License?.value || "").toLowerCase();
  if (/^(pd|public domain)/.test(kod) || /^public domain/i.test(kort)) return { licens: "Public domain", licensUrl: "https://creativecommons.org/publicdomain/mark/1.0/" };
  if (/^cc0/.test(kod)) return { licens: "CC0 1.0", licensUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
  const m = kod.match(/^cc-(by|by-sa)-(\d\.\d)/);
  if (m) return { licens: `CC ${m[1].toUpperCase()} ${m[2]}`, licensUrl: url.replace(/^http:/, "https:") || `https://creativecommons.org/licenses/${m[1]}/${m[2]}/` };
  return null;
}

/** HTML → ren text. */
export function rensaHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, "").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim();
}

export const fotografUr = (meta = {}) =>
  (rensaHtml(meta.Artist?.value) || rensaHtml(meta.Credit?.value) || "okänd").slice(0, MAX_FOTOGRAF);

/** En Commons-sida (generator/titles + imageinfo) → träff eller null. */
export function traffUr(sida) {
  const ii = sida?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const lic = licens(meta);
  if (!lic) return null;
  return {
    fil: sida.title, thumb: ii.thumburl || ii.url, bredd: ii.thumbwidth || ii.width, hojd: ii.thumbheight || ii.height,
    sida: ii.descriptionurl, ...lic, fotograf: fotografUr(meta),
  };
}

const iiParam = (px) => `&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${px}&iiextmetadatafilter=${META}`;

export function skapaCommons({ fetch: hamta = (...a) => globalThis.fetch(...a) } = {}) {
  async function json(url) {
    let r;
    try {
      r = await hamta(url, { referrerPolicy: "strict-origin-when-cross-origin" });
    } catch {
      throw new CommonsFel("nat");
    }
    if (r.status === 429) throw new CommonsFel("429");
    if (!r.ok) throw new CommonsFel("server");
    try {
      return await r.json();
    } catch {
      throw new CommonsFel("server");
    }
  }
  const sidor = (j) => Object.values(j?.query?.pages || {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  return {
    async sok(q, { antal = 24 } = {}) {
      const s = String(q || "").trim();
      if (!s) return [];
      const j = await json(`${API}&generator=search&gsrnamespace=6&gsrlimit=${antal}&gsrsearch=${encodeURIComponent(`${s} filetype:bitmap`)}${iiParam(RUTNAT_PX)}`);
      return sidor(j).map(traffUr).filter(Boolean);
    },
    async info(fil, px = HAMTA_PX) {
      const titel = String(fil || "").startsWith("File:") ? fil : `File:${fil}`;
      const j = await json(`${API}&titles=${encodeURIComponent(titel)}${iiParam(px)}`);
      return traffUr(sidor(j)[0]);
    },
    async p18(qid) {
      if (!/^Q\d{1,12}$/.test(String(qid || ""))) return null;
      const j = await json(`${WD}&ids=${qid}`);
      const v = j?.entities?.[qid]?.claims?.P18?.find((c) => c?.rank !== "deprecated")?.mainsnak?.datavalue?.value;
      return typeof v === "string" && v ? v : null;
    },
  };
}
