// ============================================================================
// Hitta rätt! – lärarvyns rena logik (src/hitta-ratt/larare/lhr-modell.js) · #634
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, inget Firebase) – testas i Node. Vyerna i
// lhr-redigera.js, lhr-mina.js och lhr-fardiga.js ritar bara det som räknas här.
// Arkitektur §11.9.
//
// Formuläret (ett vanligt objekt, vyn muterar det inte direkt):
//   { id, sparad, kopiaAv, title, description, ikon, geo, type, startvy,
//     classIds: [], leaderboard, kopieraFran?,
//     items: [{ id?, name, prompt, lat, lon, kalla, bild? } | { id?, name, prompt, omrade, key, bild? }] }
//   sparad = packet finns på servern → geo och typ är låsta (§11.0).
//   leaderboard = kryssrutan "Skoltopplista" (#635). Den skickas INTE med
//   sparningen (servern ignorerar den) utan via hittaRattSattTopplista efteråt.
//   lat/lon får vara text ("60,67") – tillIndata gör om dem till tal.
//
//   nyttFormular(id) · formularFranPack(pack) · dupliceraPack(pack, nyttId)
//   tillIndata(f) → det som skickas till hittaRattSparaPack
//   kontrollera(f, geoOmraden) → { ok, fel?, pack? } (samma normaliseraPack som servern)
//   facitAndras(original, f, geoOmraden) → visa FACIT_VARNING före sparning?
//   bytKarta(f, { geo, type }, nycklar) → { form, borttagna } (bara osparade)
//   omradeslista(namn, nycklar) · sokOmraden(lista, q, valda) · laggTillOmrade(f, o)
//   delaKatalog(katalog, uid) → { mina, kollegor } · klassText(ids, klasser)
//   raderaText(post) · provData(pack, omradesIds) (provspel: rättning i klienten)
//   kopieraFran = egna källpackets id när en kopia har bilder (#637) – skickas
//   med första sparningen så att servern kopierar bilderna. bild = itemets bild
//   (delat/egna.js normBild): eget dokument (id) eller officiell repofil (fil).
//   topplistaAndras(original, f) → ska hittaRattSattTopplista anropas efter sparningen?
//   TOPPLISTA_TEXT · topplistaKvitto(pa, klasstext)
// ============================================================================

import { normaliseraPack, normBild, IKONER, GRANS } from "../delat/egna.js";
import { facitNyckel, kompaktFacit } from "../delat/facit.js";
import { raknaOmgang, MIN_MS_PER_FRAGA } from "../delat/omgang.js";

export const GEOER = [
  { geo: "sverige-landskap", namn: "Sverige (landskap)" },
  { geo: "sverige-lan", namn: "Sverige (län)" },
  { geo: "europa", namn: "Europa" },
  { geo: "varlden", namn: "Världen" },
];
export const geoNamn = (geo) => GEOER.find((g) => g.geo === geo)?.namn || geo;

export const TYPER = {
  point: { namn: "Punkt", ikon: "📍", hint: "Eleven sätter en nål där platsen ligger." },
  area: { namn: "Område", ikon: "🗺️", hint: "Eleven klickar på rätt land, landskap eller län." },
};

export const FACIT_VARNING = "Du har ändrat platser eller frågor. Elevernas rekord och skolans topplista för kartan börjar om från noll.";
export const LAMNA_TEXT = "Du har ändringar som inte är sparade. Vill du lämna utan att spara?";

/** Förklaringen under kryssrutan "Skoltopplista / Gör till skolutmaning" (§11.5). */
export const TOPPLISTA_TEXT = {
  pa: "PÅ: eleverna tävlar om skolrekordet. Kartan får en Top 15 under 🏆 Topplistor, och den som leder får Kartmästare-pokalen i sitt hus. Rekord som eleverna redan satt räknas med.",
  av: "AV: eleverna spelar och ser sina egna rekord, men det finns ingen topplista och ingen pokal. Rekorden sparas ändå, så du kan slå på topplistan senare.",
  vem: "Bara eleverna i klasserna som ser området ser topplistan.",
};

/** Ändrade läraren kryssrutan? (Nytt område: bara om den är ikryssad.) */
export function topplistaAndras(original, f) {
  return (f.leaderboard === true) !== (original?.leaderboard === true);
}

/** Kvittot efter sparningen (klasserna står redan i "Sparat!"-raden). */
export function topplistaKvitto(pa, klasstext) {
  if (!pa) return "Skoltopplistan är avstängd – topplistan och pokalen är borttagna.";
  return klasstext ? "Skoltopplistan är på – eleverna ser den under 🏆 Topplistor." : "Skoltopplistan är på, men ingen klass ser området ännu.";
}

const KOPIA = " (kopia)";

export function nyttFormular(id) {
  return {
    id, sparad: false, kopiaAv: null, title: "", description: "", ikon: IKONER[0],
    geo: "sverige-landskap", type: "point", startvy: "auto", classIds: [], leaderboard: false, items: [],
  };
}

function itemFran(it, type) {
  const bild = normBild(it.bild);
  const bas = { id: it.id, name: it.name || "", prompt: it.prompt || "", ...(bild ? { bild } : {}) };
  if (type === "area") return { ...bas, omrade: it.omrade || "", key: it.key || "" };
  const kalla = it.kalla || (it.wikidata ? `wikidata:${it.wikidata}` : "");
  return { ...bas, lat: it.lat ?? "", lon: it.lon ?? "", ...(kalla ? { kalla } : {}) };
}

/** Ett sparat eget pack (hittaRattPacks) → formulär. */
export function formularFranPack(pack) {
  const type = pack.type === "area" ? "area" : "point";
  return {
    id: pack.id, sparad: true, kopiaAv: null,
    title: pack.title || "", description: pack.description || "",
    ikon: IKONER.includes(pack.ikon) ? pack.ikon : IKONER[0],
    geo: pack.geo, type, startvy: pack.startvy === "hel" ? "hel" : "auto",
    classIds: Array.isArray(pack.classIds) ? [...pack.classIds] : [],
    leaderboard: pack.leaderboard === true,
    items: (pack.items || []).map((it) => itemFran(it, type)),
  };
}

/**
 * Duplicera ett pack (officiellt, eget eller en kollegas) → ett NYTT osparat
 * formulär: nytt id, "(kopia)", inga klasser, topplistan AV. Bilderna följer
 * med (#637): egna packs bilder kopieras av servern vid första sparningen
 * (kopieraFran), officiella pekar på samma repofil.
 * Geo och typ går att byta tills kopian sparats.
 */
export function dupliceraPack(pack, nyttId) {
  const type = pack.type === "area" ? "area" : "point";
  const titel = String(pack.title || "Karta");
  const items = (pack.items || []).slice(0, GRANS.items).map((it) => itemFran(it, type));
  const kopieraFran = String(pack.id || "").startsWith("e-") && items.some((it) => it.bild?.id) ? pack.id : null;
  return {
    id: nyttId, sparad: false, kopiaAv: titel,
    title: titel.slice(0, GRANS.titel - KOPIA.length) + KOPIA,
    description: String(pack.description || "").slice(0, GRANS.beskrivning),
    ikon: IKONER.includes(pack.ikon) ? pack.ikon : TYPER[type].ikon,
    geo: pack.geo, type, startvy: pack.startvy === "hel" ? "hel" : "auto",
    classIds: [], leaderboard: false, kopieraFran, items,
  };
}

/** "60,67" / " 17.14 " / 60.67 → tal, tomt → undefined. */
export function tal(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Formuläret → indata till hittaRattSparaPack (servern normaliserar igen). */
export function tillIndata(f) {
  const items = f.items.map((it) => {
    const bild = normBild(it.bild);
    const bas = { ...(it.id ? { id: it.id } : {}), name: String(it.name || "").trim(), prompt: String(it.prompt || "").trim(), ...(bild ? { bild } : {}) };
    if (f.type === "area") return { ...bas, omrade: it.omrade, ...(it.key ? { key: it.key } : {}) };
    return { ...bas, lat: tal(it.lat), lon: tal(it.lon), ...(it.kalla ? { kalla: it.kalla } : {}) };
  });
  return {
    id: f.id, title: String(f.title || "").trim(), description: String(f.description || "").trim(),
    ikon: f.ikon, type: f.type, geo: f.geo, startvy: f.startvy === "hel" ? "hel" : "auto",
    classIds: [...(f.classIds || [])], items,
  };
}

/** Samma kontroll som servern gör (utan klasskontrollen). */
export function kontrollera(f, geoOmraden = {}) {
  try {
    return { ok: true, pack: normaliseraPack(tillIndata(f), { geoOmraden }) };
  } catch (err) {
    return { ok: false, fel: err?.message || "Kartan är ogiltig." };
  }
}

/**
 * Ändrar sparningen facit (platser, områden, nya eller borttagna frågor)?
 * Bara för sparade pack – då höjer servern versionen och nollställer rekorden.
 */
export function facitAndras(original, f, geoOmraden = {}) {
  if (!original || !f.sparad) return false;
  const k = kontrollera(f, geoOmraden);
  if (!k.ok) return false;
  return facitNyckel(original) !== facitNyckel(k.pack);
}

/**
 * Byt karta eller typ på ett osparat formulär. Byter typen töms frågorna.
 * Områdesfrågor flyttas till den nya kartan via källnyckeln (Europa ↔ världen);
 * de som inte finns där tas bort. Punktfrågor behålls (utanför kartan = fel vid sparning).
 * @param nycklar  den nya kartans <geo>.nycklar.json (källnyckel → områdes-id)
 */
export function bytKarta(f, { geo = f.geo, type = f.type }, nycklar = {}) {
  if (f.sparad) return { form: f, borttagna: 0 };
  let items = f.items;
  if (type !== f.type) items = [];
  else if (type === "area" && geo !== f.geo) {
    items = f.items.filter((it) => it.key && nycklar[it.key]).map((it) => ({ ...it, omrade: nycklar[it.key] }));
  }
  return { form: { ...f, geo, type, items }, borttagna: f.items.length - items.length };
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Kartans områden för namnlistan: [{ id, key, namn }] sorterade på namn. */
export function omradeslista(namn = {}, nycklar = {}) {
  return Object.entries(nycklar)
    .map(([key, id]) => ({ id, key, namn: namn[key] || key }))
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
}

/** Områden som matchar sökningen (början av ett ord först) och inte redan är valda. */
export function sokOmraden(lista, q, valda = []) {
  const v = new Set(valda);
  const s = norm(q);
  const kvar = lista.filter((o) => !v.has(o.id));
  if (!s) return kvar;
  const traff = kvar.filter((o) => norm(o.namn).includes(s));
  const borjar = (o) => norm(o.namn).split(/[\s-]+/).some((ord) => ord.startsWith(s));
  return [...traff.filter(borjar), ...traff.filter((o) => !borjar(o))];
}

export function laggTillOmrade(f, o) {
  if (f.items.some((it) => it.omrade === o.id)) return f;
  return { ...f, items: [...f.items, { name: o.namn, prompt: "", omrade: o.id, key: o.key }] };
}

export const tomFraga = (type) => (type === "area" ? { name: "", prompt: "", omrade: "", key: "" } : { name: "", prompt: "", lat: "", lon: "" });

/** Katalogen → lärarens egna och kollegornas pack, sorterade på titel. */
export function delaKatalog(katalog, uid) {
  const packs = katalog?.packs && typeof katalog.packs === "object" ? katalog.packs : {};
  const alla = Object.entries(packs)
    .filter(([id, p]) => id.startsWith("e-") && p)
    .map(([id, p]) => ({ ...p, id, antal: Number(p.antal) || 0, classIds: Array.isArray(p.classIds) ? p.classIds : [] }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "sv") || (a.id < b.id ? -1 : 1));
  return { mina: alla.filter((p) => p.ownerUid === uid), kollegor: alla.filter((p) => p.ownerUid !== uid) };
}

/** Klass-id → "5A, 5E" (okända id visas som de är). */
export function klassText(ids, klasser = []) {
  const namn = new Map(klasser.map((k) => [k.id, k.name || k.id]));
  return (ids || []).map((id) => namn.get(id) || id).sort((a, b) => a.localeCompare(b, "sv")).join(", ");
}

export function raderaText(post) {
  const t = `Radera "${post?.title || "kartan"}"? Det går inte att ångra.`;
  return post?.leaderboard ? `${t}\n\nSkolans topplista för kartan är påslagen – den och pokalen tas också bort.` : t;
}

/**
 * Provspel: lokala deps för hr-spel.js. Rättningen sker här i klienten med
 * samma raknaOmgang som servern – inget försök, inget sparas, inga coins.
 * @param omradesIds  geofilens alla områdes-id (områdespack)
 */
export function provData(pack, omradesIds = []) {
  const facit = kompaktFacit({ ...pack, official: true, leaderboard: false }, omradesIds);
  return {
    startaForsok: async () => "prov",
    skickaOmgang: async (_id, svar) => {
      // Läraren klickar ofta snabbt – tidsgränsen mot fusk gäller inte här.
      const justerat = svar.map((s) => (Number.isInteger(s?.ms) ? { ...s, ms: Math.max(s.ms, MIN_MS_PER_FRAGA) } : s));
      return { result: raknaOmgang(facit, justerat), pb: null, nyttRekord: false, leaderboard: false, prov: true };
    },
  };
}
