// ============================================================================
// Pluggporten – säsonger: konfiguration + ren logik (issue #690, epic #689;
// tilläggsregistret + Vinter/Jul #907, epic #906)
// ----------------------------------------------------------------------------
// Spec: UTVECKLINGSUPPDRAG_HOST_HALLOWEEN.md §1.1, §2;
// UTVECKLINGSUPPDRAG_VINTER_JUL.md A.1–A.2.
//
// Dokumentet config/season (skrivs bara av admin, läses av alla – även
// utloggade, firestore.rules):
//   { season: "sommar" | "host" | "vinter",
//     halloween: bool, halloweenUntil?: Timestamp|null,
//     jul?: bool, julUntil?: Timestamp|null,
//     updatedAt, updatedBy }
// Saknas dokumentet (eller är det trasigt) = sommar utan tillägg, dvs. exakt
// som i dag. Saknas `jul` (gamla dokument) = Jul av.
//
// Säsongen är en NYCKEL i SEASONS → palett + dekor. En ny säsong = en rad här
// + nyckeln i firestore.rules (validSeasonDoc) – ingen ombyggnad.
// Paletten fylls i av höstvärlden (#691); sommarens värden är dagens färger.
//
// Tillägg (Halloween, Jul, …) ligger ovanpå valfri säsong och är rader i
// TILLAGG: på/av-fält + slutdatumsfält i dokumentet, förvalt slutdatum,
// inloggningspalett och butikssamling. Ett tillägg är PÅ när fältet === true
// OCH slutdatumet (om det finns) inte har passerat – jämfört mot den
// server-korrigerade klockan (season.js), så en elev som ställer fram
// datorklockan inte påverkar något.
//
// Ingen Firebase här – testas i node (test/season.test.js).
// ============================================================================

export const DEFAULT_SEASON = "sommar";

/** localStorage-nyckeln för senast kända läge: JSON normalizeSeason() (slutdatum i ms|null). */
export const SEASON_CACHE_KEY = "pp:season";

/**
 * Säsongernas konfiguration. `palette` = färgvärden som världen/inloggningen
 * sätter som CSS-variabler och SVG-färgparametrar; `dekor` = vad säsongen
 * lägger till (löv m.m.). Tomt = dagens utseende.
 */
export const SEASONS = {
  sommar: {
    label: "Sommar",
    // Tom = SVG-konstens egna fallback-färger (sz() i art-style.js) = i dag.
    palette: {},
    dekor: { leaves: false },
    // Förhandsvisningen i admin (teacher-season.js).
    preview: { sky: "#7FC7E8", grass: "#6FC66F", tree: ["#58C6A9", "#6FC66F", "#4FAF5F"] },
  },
  host: {
    label: "Höst",
    // Värld (#691, gladare efter Elias): klar krispig höstblå himmel med varm
    // horisont, gräset fortfarande grönt med gyllene stänk, mättade kronor i
    // pumpaorange/klarröd/solgul och buskar i frisk gulgrön.
    palette: {
      sky1: "#4BA2E8", sky2: "#FFF3DA", hill: "#B2D873", grass: "#93C95A",
      "grass-light": "#E2D96A", "grass-mid": "#C4DA6A", tuft: "#7FB548", "tuft-dark": "#5F9A3A",
      "tree-a": "#FF8A2A", "tree-b": "#F2524A", "tree-c": "#FFD23F", bush: "#A6CF3F",
      // Inloggningen (porten + lärarspärren).
      "port-bg": "#9BCDF0", "port-sky1": "#5AA6E2", "port-sky2": "#A8D5F4", "port-sky3": "#FFE7BE",
      "port-far": "#CFE59A", "port-bush": "#F2A23A", "gate-bg": "#3A2A26", "gate-bg2": "#5A3524",
    },
    dekor: { leaves: true },
    preview: { sky: "#4BA2E8", grass: "#93C95A", tree: ["#FF8A2A", "#F2524A", "#FFD23F"] },
  },
  vinter: {
    label: "Vinter",
    // B.1 (#906): aldrig helt vit – snön är som ljusast #EEF3F8 (B.2), mörka
    // granar och ett dovt rönnbärsrött (tree-b) som bryter det gröna.
    palette: {
      sky1: "#7DB3E3", sky2: "#E6EEF7",
      hill: "#D3E1EE", grass: "#E3EBF3", "grass-light": "#EEF3F8", "grass-mid": "#D8E3EE",
      tuft: "#AFC4D8", "tuft-dark": "#94ABC4",
      "tree-a": "#3F8C6B", "tree-b": "#C9474F", "tree-c": "#2F7A5C", bush: "#5C9C80",
      "port-bg": "#8DBBE6", "port-sky1": "#5E97D6", "port-sky2": "#A9CBEB", "port-sky3": "#F3E4D2",
      "port-far": "#C2D4E6", "port-bush": "#4F8F74", "port-moln": "#F4F7FB",
      "gate-bg": "#1F2B44", "gate-bg2": "#2E4066",
    },
    dekor: { leaves: false, sno: true },
    preview: { sky: "#7DB3E3", grass: "#E3EBF3", tree: ["#3F8C6B", "#C9474F", "#2F7A5C"] },
  },
};

export const SEASON_KEYS = Object.keys(SEASONS);

/**
 * Halloween-temat för INLOGGNINGEN (elev + lärare, §1.5): kvällshimmel i lila
 * och mörkblått. Gäller bara när Halloween är på och vinner då över säsongens
 * port-färger. Världen får inte den här paletten – bara små detaljer (§2.1).
 */
export const HALLOWEEN_LOGIN_PALETTE = {
  "port-bg": "#2E2557", "port-sky1": "#1F1D4A", "port-sky2": "#3E2F73", "port-sky3": "#6B4E92",
  "port-far": "#4A4380", hill: "#4F7A6A", grass: "#43695A", "tree-a": "#E98A3A",
  "tree-b": "#B5546B", "tree-c": "#E2B23E", "port-bush": "#3F6E62", "port-moln": "#8E83B8",
  "gate-bg": "#1E1B45", "gate-bg2": "#3B2C6E",
};

/**
 * Jul-temat för INLOGGNINGEN (C.2, #906): en blå kväll, inte svart – himlen
 * #1E2D63 → #6E7FB8, snön ljust blågrå i månsken, granarna mörkgröna. Som för
 * Halloween får världen den inte (världen behåller säsongens dagsljus).
 */
export const JUL_LOGIN_PALETTE = {
  "port-bg": "#2A3A72", "port-sky1": "#1E2D63", "port-sky2": "#3C4C8A", "port-sky3": "#6E7FB8",
  "port-far": "#8E9FC8", hill: "#B3C4DE", grass: "#C3D2E8", "tree-a": "#2F6B55",
  "tree-b": "#B8434B", "tree-c": "#2A5E4A", "port-bush": "#3D6E5C", "port-moln": "#AFBEDD",
  "gate-bg": "#18234C", "gate-bg2": "#2C3B74",
};

/** Nästa `dag` i `manad` (0-baserad) kl. 23.59 lokal tid – nästa år om det har passerat. */
function nastaDag(now, manad, dag) {
  const nu = new Date(now);
  const d = new Date(nu.getFullYear(), manad, dag, 23, 59, 0, 0);
  if (d.getTime() <= now) d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
}

/**
 * Tilläggsregistret (A.2): ett tredje tillägg (t.ex. Påsk) = en rad här +
 * fälten i firestore.rules (validSeasonDoc) + en samling och en butiksflik.
 *   falt / tillFalt  fälten i config/season (på/av, slutdatum)
 *   standardTill     förvalt slutdatum i adminfliken (ms)
 *   loginPalett      inloggningens palett när tillägget är på
 *   samling          butikssamlingen (shop-items `collection`) som är öppen då
 * <html data-{id}="1"> sätts av season-world.js medan tillägget är på.
 * Båda på samtidigt: inloggningen får den SENARE radens palett (Jul vinner
 * över Halloween), dekoren visas för båda.
 */
export const TILLAGG = [
  {
    id: "halloween", label: "Halloween", emoji: "🎃", falt: "halloween", tillFalt: "halloweenUntil",
    standardTill: (now) => nastaDag(now, 10, 2), standardText: "2 nov 23.59",
    loginPalett: HALLOWEEN_LOGIN_PALETTE, samling: "halloween",
  },
  {
    id: "jul", label: "Jul", emoji: "🎄", falt: "jul", tillFalt: "julUntil",
    // Tjugondag Knut.
    standardTill: (now) => nastaDag(now, 0, 13), standardText: "13 jan 23.59",
    loginPalett: JUL_LOGIN_PALETTE, samling: "jul",
  },
];

export const TILLAGG_IDS = TILLAGG.map((t) => t.id);

/** Tilläggets rad i registret (eller null). */
export function tillagg(id) {
  return TILLAGG.find((t) => t.id === id) || null;
}

/**
 * Temat som ska visas: läget (med `{id}Active` per tillägg, season-store.js)
 * → attribut + palett. `login` = paletten för inloggningsskärmen (aktiva
 * tillägg vinner, senare rad sist), `world` = världens palett (bara säsongen).
 * `halloween`/`jul` = är tillägget på; `tillagg` = de aktiva id:na.
 */
export function themeFor(state) {
  const season = Object.prototype.hasOwnProperty.call(SEASONS, state?.season) ? state.season : DEFAULT_SEASON;
  const dekor = seasonConfig(season).dekor || {};
  const world = { ...seasonConfig(season).palette };
  const aktiva = TILLAGG.filter((t) => !!state?.[`${t.id}Active`]);
  const login = aktiva.length ? Object.assign({ ...world }, ...aktiva.map((t) => t.loginPalett)) : world;
  const theme = { season, tillagg: aktiva.map((t) => t.id), leaves: !!dekor.leaves, sno: !!dekor.sno, world, login };
  for (const t of TILLAGG) theme[t.id] = aktiva.includes(t);
  return theme;
}

/** Säsongens konfiguration (okänd nyckel → sommar). */
export function seasonConfig(key) {
  return SEASONS[key] || SEASONS[DEFAULT_SEASON];
}

/** Tidsstämpel → ms (Firestore Timestamp, Date, ms eller null). */
export function toMs(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v.seconds === "number") return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return null;
}

/**
 * config/season-dokumentet (eller localStorage-cachen) → normaliserat läge.
 * Allt okänt faller tillbaka till sommar / tillägget av.
 * @returns {{season:string, halloween:boolean, halloweenUntil:number|null,
 *            jul:boolean, julUntil:number|null}}
 */
export function normalizeSeason(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const s = { season: Object.prototype.hasOwnProperty.call(SEASONS, d.season) ? d.season : DEFAULT_SEASON };
  for (const t of TILLAGG) {
    s[t.falt] = d[t.falt] === true;
    s[t.tillFalt] = toMs(d[t.tillFalt]);
  }
  return s;
}

/** Är tillägget `id` på vid tiden `now` (ms, server-korrigerad)? */
export function tillaggAktivt(state, id, now) {
  const t = tillagg(id);
  if (!t) return false;
  const s = normalizeSeason(state);
  if (!s[t.falt]) return false;
  return s[t.tillFalt] == null || now < s[t.tillFalt];
}

/** Id:na för tilläggen som är på vid `now`, i registrets ordning. */
export function aktivaTillagg(state, now) {
  const s = normalizeSeason(state);
  return TILLAGG_IDS.filter((id) => tillaggAktivt(s, id, now));
}

/** Är Halloween på vid tiden `now` (ms, server-korrigerad)? */
export function halloweenActive(state, now) {
  return tillaggAktivt(state, "halloween", now);
}

/** När ändras något tilläggs läge av sig självt nästa gång (ms), eller null. */
export function nextSeasonBoundary(state, now) {
  const s = normalizeSeason(state);
  let nasta = null;
  for (const t of TILLAGG) {
    const till = s[t.tillFalt];
    if (s[t.falt] && till != null && now < till && (nasta == null || till < nasta)) nasta = till;
  }
  return nasta;
}

/** Förvalt slutdatum för tillägget `id` (ms). */
export function defaultTillaggUntil(id, now) {
  return tillagg(id).standardTill(now);
}

/**
 * Förvalt slutdatum: 2 november kl. 23.59 (lokal tid) innevarande år – eller
 * nästa år om det redan har passerat.
 */
export function defaultHalloweenUntil(now) {
  return defaultTillaggUntil("halloween", now);
}

/** ms → värde för <input type="datetime-local"> (lokal tid). */
export function toLocalInput(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** <input type="datetime-local">-värde → ms (lokal tid), tomt/trasigt → null. */
export function fromLocalInput(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v || ""));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

const MANADER = ["jan", "feb", "mars", "april", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];

/** "2 nov 23.59" (+ år om det inte är innevarande). */
export function formatUntil(ms, now = Date.now()) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  const ar = d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MANADER[d.getMonth()]}${ar} ${p(d.getHours())}.${p(d.getMinutes())}`;
}

/** Ett tilläggs del av beskrivningen, t.ex. "Jul på till 13 jan 23.59". */
function describeTillagg(s, t, now) {
  const till = s[t.tillFalt];
  if (!s[t.falt]) return `${t.label} av`;
  if (till == null) return `${t.label} på (inget slutdatum)`;
  if (now >= till) return `${t.label} av (slutdatumet ${formatUntil(till, now)} har passerat)`;
  return `${t.label} på till ${formatUntil(till, now)}`;
}

/**
 * En rad som beskriver läget, t.ex. "Höst · Halloween på till 2 nov 23.59"
 * eller "Vinter · Jul på till 13 jan 23.59". Tillägg som är påslagna (även med
 * passerat slutdatum) nämns; inget påslaget → "Halloween av" som förut.
 */
export function describeSeason(state, now) {
  const s = normalizeSeason(state);
  const namn = seasonConfig(s.season).label;
  const pa = TILLAGG.filter((t) => s[t.falt]);
  return [namn, ...(pa.length ? pa : TILLAGG.slice(0, 1)).map((t) => describeTillagg(s, t, now))].join(" · ");
}
