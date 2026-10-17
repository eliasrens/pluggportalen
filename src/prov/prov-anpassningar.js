// ============================================================================
// Prov (#748, spec §14): anpassningarna – ren logik, ingen Firebase/DOM
// (testas i test/prov-anpassningar.test.js).
//   extraTid  provTillfallen/{t}.extraTid: { [elevUid]: minuter } – elevens
//             egen tidsgräns = tidsgransMin + extraTid[uid] (reglerna likadant)
//   elevIds   ett omprov för valda elever: bara de kan starta och skriva
//             (reglerna), och bara de ser det (klienten filtrerar)
//   flikbyten svar/{uid}.flikbyten: hur många gånger eleven lämnade
//             provfliken – bara information till läraren, straffar inget
// Får inte importera något: prov-tillfalle-logik.js bygger på den.
// ============================================================================

// Valen i lärarens lista (minuter). Reglerna godtar 1–240 per elev.
export const EXTRA_TID_VAL = [5, 10, 15, 20, 30, 45, 60];
export const EXTRA_TID_MAX = 240;
// Ett omprov gäller högst så här många elever (reglerna: 1–100).
export const OMPROV_MAX = 100;

/** Elevens extra minuter i tillfället (0 om inga eller ogiltiga). */
export function extraMin(tf, uid) {
  const x = tf?.extraTid?.[uid];
  return Number.isInteger(x) && x > 0 && x <= EXTRA_TID_MAX ? x : 0;
}

/** Elevens egen tidsgräns i minuter: tidsgränsen + extra tid, eller null utan tidsgräns. */
export function tidsgransFor(tf, uid) {
  const g = tf?.tidsgransMin;
  return Number.isInteger(g) && g > 0 ? g + extraMin(tf, uid) : null;
}

/** Är tillfället ett omprov för valda elever? */
export const arOmprov = (tf) => Array.isArray(tf?.elevIds);

/** Gäller tillfället eleven? Ett vanligt tillfälle gäller hela klassen, ett omprov bara de valda. */
export const gallerElev = (tf, uid) => !arOmprov(tf) || tf.elevIds.includes(uid);

/** "Vikingaprovet – omprov (3 elever)" – eller bara provets namn. */
export function tillfalleNamn(tf) {
  const namn = tf?.provNamn || "Prov";
  if (!arOmprov(tf)) return namn;
  const n = tf.elevIds.length;
  return `${namn} – omprov (${n} ${n === 1 ? "elev" : "elever"})`;
}

/** "Vikingaprovet (omprov)" – namnet eleven och statistiken ser (#749 F2), eller bara provets namn. */
export function elevProvNamn(tf) {
  const namn = tf?.provNamn || "Prov";
  return arOmprov(tf) ? `${namn} (omprov)` : namn;
}

/**
 * Lärarens val → det som sparas: bara heltal 1–240, bara elever som finns
 * (i klassen, eller i omprovet). Tomt → {}.
 * @param {Record<string, any>} val     { [uid]: minuter | "" }
 * @param {string[]} [giltiga]         elevernas uid
 */
export function rensaExtraTid(val, giltiga = null) {
  const ok = giltiga ? new Set(giltiga) : null;
  const ut = {};
  for (const [uid, v] of Object.entries(val || {})) {
    const m = Number(v);
    if ((!ok || ok.has(uid)) && Number.isInteger(m) && m > 0 && m <= EXTRA_TID_MAX) ut[uid] = m;
  }
  return ut;
}

/** "Extra tid: Alva +15 min, Bo +10 min" (i namnordning) – eller "". */
export function extraTidText(extraTid, namn = {}) {
  const rader = Object.entries(extraTid || {})
    .filter(([, m]) => Number.isInteger(m) && m > 0)
    .map(([uid, m]) => ({ namn: namn[uid] || "Okänd elev", m }))
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
  return rader.length ? `Extra tid: ${rader.map((r) => `${r.namn} +${r.m} min`).join(", ")}` : "";
}

/**
 * Omprovets förval (§14 "till exempel sådana som var sjuka"): de som inte
 * skrev ursprungsprovet alls – inget svar, eller inlämnat av stängningen
 * utan ett enda svar.
 * @param {string[]} elever               klassens (eller ursprungsomprovets) elever
 * @param {Record<string, object>} svar    ursprungstillfällets svar
 */
export function omprovForval(elever, svar) {
  return elever.filter((uid) => {
    const d = svar?.[uid];
    if (!d) return true;
    return d.inlamnadNar === "stangt" && !Object.keys(d.svar || {}).length;
  });
}

/** Rimligt antal flikbyten (ogiltigt → 0). Reglerna godtar 0–10000. */
export const FLIKBYTEN_MAX = 10_000;
export function tolkaFlikbyten(v) {
  return Number.isInteger(v) && v > 0 ? Math.min(v, FLIKBYTEN_MAX) : 0;
}

/** "Lämnade provet 2 gånger" – eller "" (diskret information, straffar inget). */
export function flikbyteText(n) {
  const x = tolkaFlikbyten(n);
  if (!x) return "";
  return `Lämnade provet ${x === 1 ? "1 gång" : `${x} gånger`}`;
}
