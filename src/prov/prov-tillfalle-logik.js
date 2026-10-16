// ============================================================================
// Prov (#740, spec §5): provtillfällets rena logik – tidsgränsen, elevens
// läge, återställningen ur localStorage, lärarens översikt och fokuslåsets
// standardtid. Ingen Firebase/DOM (testas i test/prov-tillfalle.test.js);
// sidorna (prov-elev-sida.js, prov-tillfallen-sida.js) bygger på den.
// Tider är epoch-ms mot serverns klocka (serverNow, data-class-lock.js).
// ============================================================================

import { besvarat } from "./prov-modell.js";

// Menylänken (§5.5): ett rättat prov som lämnats tillbaka syns i 14 dagar.
export const TILLBAKA_DAGAR = 14;
const DAG_MS = 24 * 60 * 60 * 1000;

// Nedräkningens färger (§5.5): gul vid 5 minuter kvar, röd vid 1 minut.
export const GUL_MS = 5 * 60 * 1000;
export const ROD_MS = 60 * 1000;

// Lärarens översikt läser om svaren så här ofta (§5.3) – aldrig onSnapshot.
export const OVERSIKT_INTERVALL_MS = 60 * 1000;

/** Timestamp | Date | ms | null → ms (eller null). */
export function tillMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === "number") return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
  return null;
}

/** Ska Prov synas i elevens meny? Ett öppet tillfälle eller ett nyligen tillbakalämnat prov. */
export function provSynligt({ oppna = [], tillbaka = [] } = {}, nu) {
  if (oppna.length) return true;
  return tillbaka.some((r) => (tillMs(r.aterlamnadAt) ?? 0) > nu - TILLBAKA_DAGAR * DAG_MS);
}

/** När elevens tid tar slut (ms), eller null utan tidsgräns / innan provet startats. */
export function slutTid(startad, tidsgransMin) {
  const s = tillMs(startad);
  return s != null && Number.isInteger(tidsgransMin) && tidsgransMin > 0 ? s + tidsgransMin * 60_000 : null;
}

/** "23 min kvar" / "45 s kvar" / "Tiden är slut". */
export function kvarText(ms) {
  if (ms <= 0) return "Tiden är slut";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s kvar`;
  return `${Math.ceil(s / 60)} min kvar`;
}

/** Nedräkningens nivå: "" | "gul" (≤ 5 min) | "rod" (≤ 1 min). */
export function kvarNiva(ms) {
  if (ms <= ROD_MS) return "rod";
  if (ms <= GUL_MS) return "gul";
  return "";
}

/**
 * Elevens läge i ett tillfälle:
 *   "stangt"     provet är stängt (eller förberett) – inget mer skrivs
 *   "inlamnat"   eleven (eller tiden/stängningen) har lämnat in
 *   "ny"         öppet, inte startat → "Starta provet"
 *   "tiden-slut" startat, tidsgränsen har passerat men inte inlämnat
 *   "pagar"      startat → "Fortsätt provet"
 */
export function elevLage(tillfalle, svarDok, nu) {
  if (svarDok?.inlamnad) return "inlamnat";
  if (tillfalle?.status !== "oppet") return "stangt";
  if (!svarDok) return "ny";
  const slut = slutTid(svarDok.startad, tillfalle.tidsgransMin);
  return slut != null && nu >= slut ? "tiden-slut" : "pagar";
}

/** localStorage-nyckeln för elevens svar i ett tillfälle. */
export const lokalNyckel = (tillfalleId, elevId) => `pp:prov:${tillfalleId}:${elevId}`;

/**
 * Vilka svar ska eleven fortsätta med (§5.5 "omladdning eller krasch tappar
 * aldrig något")? localStorage skrivs vid VARJE ändring, före sparningen, så
 * en lokal kopia som är minst lika ny som serverns sparning vinner. En äldre
 * (t.ex. från en annan dator) slängs.
 * @param {{ svar?: object, uppdaterad?: any } | null} server  svar-dokumentet
 * @param {{ svar?: object, at?: number } | null} lokal        { svar, at } ur localStorage
 * @returns {{ svar: object, franLokal: boolean }}
 */
export function valjStartSvar(server, lokal) {
  const s = server?.svar && typeof server.svar === "object" ? server.svar : {};
  if (!lokal?.svar || typeof lokal.svar !== "object") return { svar: s, franLokal: false };
  const serverAt = tillMs(server?.uppdaterad) ?? 0;
  if ((Number(lokal.at) || 0) < serverAt) return { svar: s, franLokal: false };
  const lika = JSON.stringify(lokal.svar) === JSON.stringify(s);
  return { svar: { ...s, ...lokal.svar }, franLokal: !lika };
}

/**
 * Lärarens översikt (§5.3): en rad per elev i klassen.
 * @param {{ id: string, namn: string }[]} elever  klassens elever
 * @param {Record<string, object>} svarPerElev     svar-dokumenten (id = elevens uid)
 * @param {object} tillfalle                       { fragor, tidsgransMin }
 * @returns {{ id, namn, status: "ej"|"skriver"|"inlamnat", statusText, besvarade, antal, kvarMs: number|null, inlamnadNar?: string }[]}
 */
export function oversiktRader(elever, svarPerElev, tillfalle, nu) {
  return elever.map((e) => {
    const d = svarPerElev[e.id];
    const { besvarade, antal } = besvarat(tillfalle.fragor, d?.svar || {});
    if (!d) return { id: e.id, namn: e.namn, status: "ej", statusText: "Inte börjat", besvarade: 0, antal, kvarMs: null };
    const slut = slutTid(d.startad, tillfalle.tidsgransMin);
    if (d.inlamnad) {
      return { id: e.id, namn: e.namn, status: "inlamnat", statusText: "Inlämnat", besvarade, antal, kvarMs: null, inlamnadNar: d.inlamnadNar || "elev" };
    }
    return { id: e.id, namn: e.namn, status: "skriver", statusText: "Skriver", besvarade, antal, kvarMs: slut == null ? null : Math.max(0, slut - nu) };
  });
}

/** "12 elever: 3 inte börjat · 7 skriver · 2 inlämnat". */
export function oversiktSumma(rader) {
  const n = (s) => rader.filter((r) => r.status === s).length;
  return { ej: n("ej"), skriver: n("skriver"), inlamnat: n("inlamnat"), antal: rader.length };
}

/**
 * Fokuslåsets standardtid (§5.2): tidsgränsen + 10 minuter, annars 60 minuter.
 * @returns {number} minuter från nu
 */
export function standardLasMinuter(tidsgransMin) {
  return Number.isInteger(tidsgransMin) && tidsgransMin > 0 ? tidsgransMin + 10 : 60;
}

/** Svar-dokument som ska markeras inlämnade när provet stängs (§5.4). */
export function attStangaIn(svarDok) {
  return svarDok.filter((d) => d && d.inlamnad !== true).map((d) => d.id);
}

/**
 * Svar som ska få tillbaka sin markering när provet öppnas igen (bara stängningens).
 * Elever som redan har fått tillbaka provet hoppas över (#743 F4) – de har sett
 * rättningen (kanske facit) och får inte skriva om. Reglerna nekar dem också.
 * @param {object[]} svarDok
 * @param {Set<string>|string[]} [tillbaka] elev-id med tillbakalämnad rättning
 */
export function attOppnaIgen(svarDok, tillbaka = []) {
  const klara = new Set(tillbaka);
  return svarDok.filter((d) => d?.inlamnad === true && d.inlamnadNar === "stangt" && !klara.has(d.id)).map((d) => d.id);
}

/** Batchstorlek när provet öppnas igen: reglerna gör en exists()/get() per elev (högst 20 per batch). */
export const OPPNA_IGEN_BATCH = 15;

/** Varningen i rutan "Öppna igen" (ur tillfällets rattStatus – ingen extra läsning). */
export function tillbakaVarning(rattStatus) {
  const n = Number(rattStatus?.tillbaka) || 0;
  if (!n) return "";
  return `${n === 1 ? "1 elev har" : `${n} elever har`} redan fått tillbaka provet och kan inte skriva mer.`;
}

/** Ett tillfälles fokuslås (från classes/{id}.lock) – gäller det just det här tillfället? */
export function arProvetsLas(lock, tillfalleId) {
  return lock?.mal?.typ === "prov" && lock.mal.id === tillfalleId;
}
