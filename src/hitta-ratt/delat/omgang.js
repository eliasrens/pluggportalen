// ============================================================================
// Hitta rätt! – rätta en HEL omgång (src/hitta-ratt/delat/omgang.js) · #609
// ----------------------------------------------------------------------------
// Ren modul, DELAD med servern (functions/hitta-ratt/, se sync-skriptet).
// Cloud Functionen hittaRattSubmit kör den på packens facit och elevens svar –
// klientens totalsumma finns inte ens i anropet (arkitektur §4.1).
//
//   raknaOmgang(pack, svar, { startMs, nuMs }) → resultat | kastar HrFel
//
//   pack  { id, typ: "point"|"area", cfg: { fullKm, halvKm, minMsPerFraga },
//           items: [{ id, lat, lon } | { id, omrade }], omraden?: [id…] }
//   svar  punkt [{ itemId, lon, lat }] · område [{ itemId, omrade, ms }]
//
// Kontroller (§4.1 punkt 3–4): svaren täcker EXAKT packens items, en gång var;
// koordinater ändliga och inom ±180/±90; omrade ett känt id i geofilen; varje
// ms ≥ minMsPerFraga (700) och Σms ≤ (nu − start) + 2 s.
//
// Resultat: { typ, max, n, godkanda, s | r,t, fragor }
//   punkt: s = Σ poäng, max = 100·n, fragor [{ id, p, km }]
//   område: r = antal rätt, t = Σms i tiondelar (avrundat), max = n,
//           fragor [{ id, ratt }]
//   godkanda = antal godkända svar (§26: 1 coin vardera)
// ============================================================================

import { poang, avstandKm, godkandPunkt } from "./poang.js";

export const MIN_MS_PER_FRAGA = 700;
export const TID_MARGINAL_MS = 2000;
export const MAX_MS_PER_FRAGA = 6 * 3600 * 1000;
const OMRADE_RE = /^o[0-9]{1,4}$/;
const ITEM_RE = /^[a-z0-9-]{1,60}$/;

export class HrFel extends Error {
  /** @param {string} code HttpsError-kod · @param {string} message på svenska */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const fel = (msg) => new HrFel("invalid-argument", msg);
const iRange = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

export function raknaOmgang(pack, svar, { startMs, nuMs } = {}) {
  if (!pack || !Array.isArray(pack.items) || !pack.items.length) throw new HrFel("not-found", "Okänd karta.");
  if (!Array.isArray(svar)) throw fel("Svaren saknas.");
  const items = new Map(pack.items.map((it) => [it.id, it]));
  if (svar.length !== items.size) throw fel("En omgång ska svara på alla frågor i kartan, en gång var.");
  const sett = new Set();
  for (const s of svar) {
    const id = s && typeof s === "object" ? s.itemId : null;
    if (typeof id !== "string" || !ITEM_RE.test(id) || !items.has(id)) throw fel("Svar på en fråga som inte finns i kartan.");
    if (sett.has(id)) throw fel("Samma fråga besvarad två gånger.");
    sett.add(id);
  }
  return pack.typ === "area" ? raknaOmrade(pack, svar, items, startMs, nuMs) : raknaPunkt(pack, svar, items);
}

function raknaPunkt(pack, svar, items) {
  const fragor = svar.map((s) => {
    if (!iRange(s.lon, -180, 180) || !iRange(s.lat, -90, 90)) throw fel("Ogiltig koordinat.");
    const it = items.get(s.itemId);
    const km = avstandKm([s.lon, s.lat], [it.lon, it.lat]);
    return { id: it.id, p: poang(km, pack.cfg), km: Math.round(km * 10) / 10 };
  });
  return {
    typ: "point",
    max: 100 * fragor.length,
    n: fragor.length,
    s: fragor.reduce((sum, f) => sum + f.p, 0),
    godkanda: fragor.filter((f) => godkandPunkt(f.p)).length,
    fragor,
  };
}

function raknaOmrade(pack, svar, items, startMs, nuMs) {
  const min = Math.max(MIN_MS_PER_FRAGA, Number(pack.cfg?.minMsPerFraga) || 0);
  const kanda = Array.isArray(pack.omraden) ? new Set(pack.omraden) : null;
  let summaMs = 0;
  const fragor = svar.map((s) => {
    if (typeof s.omrade !== "string" || !OMRADE_RE.test(s.omrade) || (kanda && !kanda.has(s.omrade))) {
      throw fel("Okänt område.");
    }
    if (!Number.isInteger(s.ms) || s.ms > MAX_MS_PER_FRAGA) throw fel("Ogiltig tid.");
    if (s.ms < min) throw new HrFel("failed-precondition", "Svarstiden är orimligt kort – omgången räknas inte.");
    summaMs += s.ms;
    return { id: s.itemId, ratt: items.get(s.itemId).omrade === s.omrade };
  });
  if (Number.isFinite(startMs) && Number.isFinite(nuMs) && summaMs > nuMs - startMs + TID_MARGINAL_MS) {
    throw new HrFel("failed-precondition", "Tiden stämmer inte med när omgången startade – omgången räknas inte.");
  }
  const r = fragor.filter((f) => f.ratt).length;
  return { typ: "area", max: fragor.length, n: fragor.length, r, t: Math.round(summaMs / 100), godkanda: r, fragor };
}
