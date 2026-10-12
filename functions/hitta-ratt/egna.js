// ============================================================================
// Hitta rätt! – lärarens egna pack (src/hitta-ratt/delat/egna.js) · #633
// ----------------------------------------------------------------------------
// Ren modul, DELAD med servern (functions/hitta-ratt/). Servern
// (hittaRattSparaPack) kör normaliseraPack på allt läraren skickar; lärarvyn
// kan köra samma funktion för att visa felet innan något skickas.
//
//   EGEN_ID_RE   "e-" + 12 tecken [a-z0-9] (§11.0) – krockar aldrig med officiella
//   nyttPackId(slump?) → "e-k3f9q0z1m2xa"
//   IKONER       packens ikon väljs ur listan
//   GRANS        fältgränserna (§11.1)
//   normaliseraPack(indata, { geoOmraden, klasser }) → städat pack | kastar HrFel
//     geoOmraden  geo → { områdes-id: källnyckel } (GEO_OMRADEN i packs.js)
//                 eller geo → [områdes-id] – okänt område nekas
//     klasser     befintliga klass-id (servern läser dem) – utelämnad = ingen kontroll
//   Ut: { id, official: false, title, description, ikon, category: "egna",
//         type, geo, startvy, visaGranser, scoringConfig, maxZoom, classIds, items }
//   Härledda fält (scoringConfig, maxZoom, visaGranser) sätts här, aldrig av
//   läraren. ownerUid, leaderboard, version och facit sätter servern.
//   Bilder (bild.id) hanteras i F – här tas `bild` bort.
// ============================================================================

import { HrFel } from "./omgang.js";
import { GEO_SCOPE, STANDARD, OMRADE_CFG, inomScope } from "./scope.js";

export const EGEN_ID_RE = /^e-[a-z0-9]{12}$/;
export const ITEM_ID_RE = /^[a-z0-9-]{1,60}$/;
const KLASS_ID_RE = /^[^/]{1,100}$/;

export const IKONER = ["🗺️", "📍", "🏞️", "🏙️", "🏰", "⛰️", "🌲", "🌊", "🏝️", "🌋", "🏛️", "🗽", "⛪", "🚂", "🧭", "🌍"];

export const GRANS = {
  titel: 60, beskrivning: 200, namn: 60, prompt: 120, items: 60, klasser: 20, kalla: 120,
  katalogBytes: 800_000,
};

const ALFABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Nytt id för ett eget pack. `slump()` → [0, 1) (standard: crypto om det finns). */
export function nyttPackId(slump) {
  const tal = slump
    ? Array.from({ length: 12 }, () => Math.floor(slump() * ALFABET.length))
    : Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (b) => b % ALFABET.length);
  return `e-${tal.map((i) => ALFABET[i]).join("")}`;
}

const fel = (msg) => new HrFel("invalid-argument", msg);
const text = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

function begransad(v, max, falt, { kravs = false } = {}) {
  const t = text(v);
  if (kravs && !t) throw fel(`${falt} saknas.`);
  if (t.length > max) throw fel(`${falt} får vara högst ${max} tecken.`);
  return t;
}

/** "Västerås slott!" → "vasteras-slott" (för frågor utan id). */
export function slugId(namn) {
  return text(namn).toLowerCase()
    .replace(/[åä]/g, "a").replace(/ö/g, "o").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "fraga";
}

const avrunda = (v) => Math.round(v * 1e5) / 1e5; // ≈ 1 m – stabil facitnyckel

function normKlasser(lista, klasser) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) throw fel("Klasserna är ogiltiga.");
  const ids = [...new Set(lista.map(text))];
  if (ids.some((id) => !KLASS_ID_RE.test(id))) throw fel("Klasserna är ogiltiga.");
  if (ids.length > GRANS.klasser) throw fel(`Kartan kan delas med högst ${GRANS.klasser} klasser.`);
  if (klasser) {
    const finns = new Set(klasser);
    if (ids.some((id) => !finns.has(id))) throw fel("En av klasserna finns inte.");
  }
  return ids.sort();
}

function normItem(it, { typ, scope, kanda }) {
  if (!it || typeof it !== "object") throw fel("En fråga är ogiltig.");
  const name = begransad(it.name, GRANS.namn, "Frågans namn", { kravs: true });
  const id = it.id === undefined || it.id === null || it.id === "" ? slugId(name) : it.id;
  if (typeof id !== "string" || !ITEM_ID_RE.test(id)) throw fel(`Frågan "${name}" har ett ogiltigt id.`);
  const prompt = begransad(it.prompt, GRANS.prompt, "Frågetexten") || (typ === "area" ? `Hitta ${name}` : `Var ligger ${name}?`);
  if (typ === "area") {
    const omrade = typeof it.omrade === "string" ? it.omrade : "";
    const finns = Array.isArray(kanda) ? kanda.includes(omrade) : Object.hasOwn(kanda, omrade);
    if (!finns) throw fel(`Området för "${name}" finns inte på kartan.`);
    const key = Array.isArray(kanda) ? text(it.key).slice(0, 60) : kanda[omrade];
    return { id, name, prompt, omrade, ...(key ? { key } : {}) };
  }
  const lat = Number(it.lat);
  const lon = Number(it.lon);
  if (typeof it.lat !== "number" || typeof it.lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw fel(`Platsen för "${name}" saknas.`);
  }
  if (!inomScope(scope, lon, lat)) throw fel(`"${name}" ligger utanför kartan.`);
  const kalla = begransad(it.kalla, GRANS.kalla, "Källan");
  return { id, name, prompt, lat: avrunda(lat), lon: avrunda(lon), ...(kalla ? { kalla } : {}) };
}

/** Unika id: dubbletter från slugId får -2, -3 … (uttryckliga dubbletter nekas). */
function unikaId(items, ras) {
  const sett = new Set();
  return items.map((it, i) => {
    if (!sett.has(it.id)) {
      sett.add(it.id);
      return it;
    }
    if (ras[i]?.id) throw fel(`Två frågor har samma id (${it.id}).`);
    let n = 2;
    while (sett.has(`${it.id.slice(0, 56)}-${n}`)) n += 1;
    const id = `${it.id.slice(0, 56)}-${n}`;
    sett.add(id);
    return { ...it, id };
  });
}

export function normaliseraPack(indata, { geoOmraden = {}, klasser } = {}) {
  if (!indata || typeof indata !== "object") throw fel("Kartan saknas.");
  if (typeof indata.id !== "string" || !EGEN_ID_RE.test(indata.id)) throw fel("Kartans id är ogiltigt.");
  const typ = indata.type === "area" ? "area" : indata.type === "point" ? "point" : null;
  if (!typ) throw fel("Frågetypen är ogiltig.");
  const geo = indata.geo;
  const scope = typeof geo === "string" && Object.hasOwn(GEO_SCOPE, geo) ? GEO_SCOPE[geo] : null;
  if (!scope) throw fel("Okänd karta.");
  const kanda = geoOmraden[geo];
  if (typ === "area" && !kanda) throw fel("Okänd karta.");

  const title = begransad(indata.title, GRANS.titel, "Namnet", { kravs: true });
  const description = begransad(indata.description, GRANS.beskrivning, "Beskrivningen");
  const ikon = IKONER.includes(indata.ikon) ? indata.ikon : IKONER[0];
  const startvy = indata.startvy === "hel" ? "hel" : "auto";
  const classIds = normKlasser(indata.classIds, klasser);

  if (!Array.isArray(indata.items) || indata.items.length < 1) throw fel("Kartan behöver minst en fråga.");
  if (indata.items.length > GRANS.items) throw fel(`Kartan får ha högst ${GRANS.items} frågor.`);
  const items = unikaId(indata.items.map((it) => normItem(it, { typ, scope, kanda })), indata.items);
  if (typ === "area") {
    const omr = new Set();
    for (const it of items) {
      if (omr.has(it.omrade)) throw fel(`Området för "${it.name}" finns redan som en annan fråga.`);
      omr.add(it.omrade);
    }
  }

  return {
    id: indata.id, official: false, title, description, ikon, category: "egna",
    type: typ, geo, startvy,
    visaGranser: typ === "area" ? true : "svag",
    scoringConfig: typ === "area" ? { ...OMRADE_CFG } : { ...STANDARD[scope].scoringConfig },
    maxZoom: STANDARD[scope].maxZoom,
    classIds, items,
  };
}
