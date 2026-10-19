// ============================================================================
// Pluggporten – lärarsidan: Hem, ren logik (teacher-hem-logik.js, #807)
// ----------------------------------------------------------------------------
// Epic #802 DEL 2. Utan importer och utan DOM, så att den testas i node
// (test/lararsida-hem.test.js). Sidan är teacher-hem.js, läsningarna
// teacher-hem-data.js.
//   KOM_IGANG / komIgangSteg / visaKomIgang  – 2.1 (bara årskurslärare)
//   attGoraRader                              – 2.2
//   SNABBVAL                                  – 2.3
//   klassKort, ovatDenHarVeckan, inaktiva     – 2.4 + "inte övat på 2 veckor"
//   omradesNamn                               – "Jobbar med: …" utan läsningar
// "Övat" = members.<uid>.ovat i classProjections (dagen eleven senast fick en
// övning godkänd, projection-sync.js ovatIdag) – EN läsning per klass.
// ============================================================================

const MINA = "#/larare/mina-klasser";
const minaHash = (id, flik) => `${MINA}?${new URLSearchParams(id ? { klass: id, flik } : { flik })}`;

/** localStorage-nycklar (per webbläsare; *Uid = per lärarkonto). */
export const LAGRING = {
  kortUtskrivna: "pp:larare:kortUtskrivna", // teacher-login-print.js sätter den
  omradesNamn: "pp:larare:omradesnamn", // "subj/area" → namn, fylls när biblioteket laddas
  komIgangDold: (uid) => `pp:larare:${uid}:komIgangDold`,
  komIgangKlart: (uid) => `pp:larare:${uid}:komIgangKlart`, // steg som räknats klara (läses inte om)
  doldaKlasser: (uid) => `pp:larare:${uid}:doldaKlasser`, // admin: dolda klasser på Hem
};

/** Kom igång (2.1): fyra steg som bockas av automatiskt. */
export const KOM_IGANG = [
  { key: "kort", text: "Skriv ut inloggningskort till eleverna", hash: minaHash(null, "elever") },
  { key: "omraden", text: "Välj vilka områden din klass ska jobba med", hash: minaHash(null, "ser") },
  { key: "prov", text: "Skapa eller kör ett prov", hash: "#/larare/prov?vy=ny" },
  { key: "live", text: "Testa Live med klassen", hash: "#/larare/live" },
];

/** Stegen med klar true/false ur { kort, omraden, prov, live }. */
export const komIgangSteg = (klart = {}) => KOM_IGANG.map((s) => ({ ...s, klar: !!klart[s.key] }));

/** Rutan visas för årskurslärare som inte dolt den och inte är klara. Admin ser den aldrig. */
export const visaKomIgang = ({ admin, dold, steg }) => !admin && !dold && steg.some((s) => !s.klar);

/** Har minst en av lärarens klasser tilldelade områden? (steg 2, ur klassdokumenten) */
export const harOmraden = (classes) => (classes || []).some((c) => Array.isArray(c.assignedAreas) && c.assignedAreas.length > 0);

/** Snabbval (2.3). */
export const SNABBVAL = [
  { key: "omraden", titel: "Välj områden åt en klass", text: "Bestäm vad eleverna ser i Plugga", hash: minaHash(null, "ser"), icon: "users" },
  { key: "omrade", titel: "Skapa nytt område", text: "Frågor, par och texter", hash: "#/larare/innehall", icon: "book" },
  { key: "prov", titel: "Skapa ett prov", text: "Blandade frågetyper", hash: "#/larare/prov?vy=ny", icon: "clipboard" },
  { key: "live", titel: "Starta Live", text: "Tävling i klassen eller mot en annan", hash: "#/larare/live", icon: "bolt" },
];

// --- Datum ("YYYY-MM-DD", lokal tid – samma form som ovatIdag) -----------------
const pad = (n) => String(n).padStart(2, "0");
export const dagNyckel = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Måndagen i veckan för `now`. */
export function veckostart(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dagNyckel(d);
}
/** Dagen `dagar` dagar före `now`. */
export function dagarSedan(dagar, now = new Date()) {
  return dagNyckel(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dagar));
}

const ovatAv = (members, uid) => {
  const v = members?.[uid]?.ovat;
  return typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v) ? v : null;
};
/** Finns datumen i projektionen alls? (före första övningen efter deployen: nej) */
const sparas = (members) => Object.keys(members || {}).some((uid) => ovatAv(members, uid));

/**
 * "Övat den här veckan: 18 av 23" – eleverna i klassen (studentIds) vars
 * senaste övning är i veckan. null när datumen inte finns än (raden döljs).
 */
export function ovatDenHarVeckan(members, studentIds, now = new Date()) {
  if (!sparas(members)) return null;
  const ids = studentIds || [];
  const fran = veckostart(now);
  return { ovat: ids.filter((uid) => (ovatAv(members, uid) || "") >= fran).length, av: ids.length };
}

/**
 * Elever som inte övat på `dagar` dagar. En elev utan datum räknas bara när
 * datumen bevisligen sparats längre än så i klassen (någon annan har ett äldre
 * datum) – annars vet vi inte, och raden hoppas över.
 * @returns {{ uid, namn }[]}
 */
export function inaktiva(members, studentIds, now = new Date(), dagar = 14) {
  if (!sparas(members)) return [];
  const grans = dagarSedan(dagar, now);
  const ids = studentIds || [];
  const gammal = ids.some((uid) => { const d = ovatAv(members, uid); return d && d < grans; });
  return ids
    .filter((uid) => { const d = ovatAv(members, uid); return d ? d < grans : gammal; })
    .map((uid) => ({ uid, namn: String(members?.[uid]?.namn || "").trim() || "Elev" }));
}

/** "David, Ines och Kevin" / "David, Ines, Kevin och 4 till". */
export function namnLista(namn, max = 3) {
  const n = namn.slice(0, max);
  const rest = namn.length - n.length;
  if (rest > 0) return `${n.join(", ")} och ${rest} till`;
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} och ${n[n.length - 1]}` : n.join("");
}

/** Visningsnamn för ett område-id när namnet inte finns sparat: "vasatiden-2" → "Vasatiden 2". */
export const fintNamn = (areaId) => {
  const s = String(areaId || "").replace(/[-_]+/g, " ").trim();
  return s ? s[0].toLocaleUpperCase("sv") + s.slice(1) : "";
};

/** Klassens tilldelade områden som namn (sparade namn → annars id:t snyggat). */
export function omradesNamn(assigned, namnKarta = {}) {
  return (Array.isArray(assigned) ? assigned : [])
    .map((a) => namnKarta[`${a.subjectId}/${a.areaId}`] || fintNamn(a.areaId))
    .filter(Boolean);
}

/**
 * Ett kompakt klasskort (2.4).
 * @param {object} c  klassdokumentet
 * @param {{ lock?: object|null, members?: object|null, namnKarta?: object, now?: Date, sluttid?: string }} o
 */
export function klassKort(c, { lock = null, members = null, namnKarta = {}, now = new Date(), sluttid = "" } = {}) {
  const elever = Array.isArray(c.studentIds) ? c.studentIds.length : 0;
  return {
    id: c.id,
    namn: c.name || c.id,
    elever,
    fokus: lock ? { sluttid } : null,
    omraden: omradesNamn(c.assignedAreas, namnKarta),
    ovat: members ? ovatDenHarVeckan(members, c.studentIds, now) : null,
    hash: minaHash(c.id, "hur"),
  };
}

/**
 * Att göra (2.2) – bara det som behöver göras nu, i den här ordningen:
 * prov att rätta, öppna prov, fokusläge på, Live, elever som inte övat.
 * @param {object} o
 * @param {Array} o.attRatta  prov-raknare.attRattaRader
 * @param {Array} o.oppnaProv  [{ id, namn, klass }]
 * @param {Array} o.fokus     [{ classId, klass, mal, sluttid }]
 * @param {Array} o.live      [{ id, namn, lobby }]
 * @param {Array} o.inaktiva  [{ classId, klass, elever: [{ namn }] }]
 */
export function attGoraRader({ attRatta = [], oppnaProv = [], fokus = [], live = [], inaktiva: ina = [] } = {}) {
  return [
    ...attRatta.map((r) => ({
      typ: "ratta", ikon: "pencil", ton: "gul", titel: `${r.antal} prov att rätta`,
      text: `${r.namn}${r.omprov ? " (omprov)" : ""} · ${r.klass}`, knapp: "Rätta", hash: `#/larare/prov/ratta?t=${encodeURIComponent(r.id)}`,
    })),
    ...oppnaProv.map((p) => ({
      typ: "oppet", ikon: "clipboard", ton: "gul", titel: `Provet är öppet i ${p.klass}`,
      text: `${p.namn} · stäng det när alla har lämnat in`, knapp: "Öppna", hash: `#/larare/prov/tillfalle?t=${encodeURIComponent(p.id)}`,
    })),
    ...fokus.map((f) => ({
      typ: "fokus", ikon: "lock", ton: "gul", titel: `Fokusläge är på i ${f.klass}`,
      text: `Låst till ${f.mal}${f.sluttid ? ` till ${f.sluttid}` : ""}`, knapp: "Stäng av", classId: f.classId,
    })),
    ...live.map((s) => ({
      typ: "live", ikon: "bolt", ton: "gron", titel: s.lobby ? "Live-match väntar i lobbyn" : "Live-match pågår",
      text: s.namn, knapp: "Öppna", hash: `#/larare/live?id=${encodeURIComponent(s.id)}`,
    })),
    ...ina.filter((k) => k.elever.length).map((k) => ({
      typ: "inaktiva", ikon: "users", ton: "bla",
      titel: `${k.elever.length} ${k.elever.length === 1 ? "elev" : "elever"} i ${k.klass} har inte övat på 2 veckor`,
      text: namnLista(k.elever.map((e) => e.namn)), knapp: "Visa", hash: minaHash(k.classId, "elever"),
    })),
  ];
}

/** Admin: klasserna som visas på Hem (dolda bort, utom när "Visa alla" är på). */
export const synligaKlasser = (classes, dolda, visaAlla = false) =>
  visaAlla ? classes : classes.filter((c) => !dolda.has(c.id));
