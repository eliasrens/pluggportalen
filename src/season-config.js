// ============================================================================
// Pluggporten – säsonger: konfiguration + ren logik (issue #690, epic #689)
// ----------------------------------------------------------------------------
// Spec: UTVECKLINGSUPPDRAG_HOST_HALLOWEEN.md §1.1, §2.
//
// Dokumentet config/season (skrivs bara av admin, läses av alla – även
// utloggade, firestore.rules):
//   { season: "sommar" | "host", halloween: bool, halloweenUntil?: Timestamp|null,
//     updatedAt, updatedBy }
// Saknas dokumentet (eller är det trasigt) = sommar utan Halloween, dvs. exakt
// som i dag.
//
// Säsongen är en NYCKEL i SEASONS → palett + dekor. En ny säsong (vinter, vår,
// jul) = en rad här + nyckeln i firestore.rules (validSeason) – ingen ombyggnad.
// Paletten fylls i av höstvärlden (#691); sommarens värden är dagens färger.
//
// Halloween är PÅ när halloween === true OCH slutdatumet (om det finns) inte
// har passerat – jämfört mot den server-korrigerade klockan (season.js), så en
// elev som ställer fram datorklockan inte påverkar något.
//
// Ingen Firebase här – testas i node (test/season.test.js).
// ============================================================================

export const DEFAULT_SEASON = "sommar";

/** localStorage-nyckeln för senast kända läge: JSON { season, halloween, halloweenUntil(ms|null) }. */
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
 * Temat som ska visas: { season, halloween } → attribut + palett.
 * `login` = paletten för inloggningsskärmen (Halloween vinner), `world` =
 * världens palett (bara säsongen).
 */
export function themeFor(state) {
  const season = Object.prototype.hasOwnProperty.call(SEASONS, state?.season) ? state.season : DEFAULT_SEASON;
  const halloween = !!state?.halloweenActive;
  const world = { ...seasonConfig(season).palette };
  const login = halloween ? { ...world, ...HALLOWEEN_LOGIN_PALETTE } : world;
  return { season, halloween, leaves: !!seasonConfig(season).dekor?.leaves, world, login };
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
 * Allt okänt faller tillbaka till sommar / ingen Halloween.
 * @returns {{season:string, halloween:boolean, halloweenUntil:number|null}}
 */
export function normalizeSeason(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    season: Object.prototype.hasOwnProperty.call(SEASONS, d.season) ? d.season : DEFAULT_SEASON,
    halloween: d.halloween === true,
    halloweenUntil: toMs(d.halloweenUntil),
  };
}

/** Är Halloween på vid tiden `now` (ms, server-korrigerad)? */
export function halloweenActive(state, now) {
  const s = normalizeSeason(state);
  if (!s.halloween) return false;
  return s.halloweenUntil == null || now < s.halloweenUntil;
}

/** När ändras Halloween-läget av sig självt nästa gång (ms), eller null. */
export function nextSeasonBoundary(state, now) {
  const s = normalizeSeason(state);
  return s.halloween && s.halloweenUntil != null && now < s.halloweenUntil ? s.halloweenUntil : null;
}

/**
 * Förvalt slutdatum: 2 november kl. 23.59 (lokal tid) innevarande år – eller
 * nästa år om det redan har passerat.
 */
export function defaultHalloweenUntil(now) {
  const nu = new Date(now);
  const d = new Date(nu.getFullYear(), 10, 2, 23, 59, 0, 0);
  if (d.getTime() <= now) d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
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

/** En rad som beskriver läget, t.ex. "Höst · Halloween på till 2 nov 23.59". */
export function describeSeason(state, now) {
  const s = normalizeSeason(state);
  const namn = seasonConfig(s.season).label;
  if (!s.halloween) return `${namn} · Halloween av`;
  if (s.halloweenUntil == null) return `${namn} · Halloween på (inget slutdatum)`;
  if (now >= s.halloweenUntil) return `${namn} · Halloween av (slutdatumet ${formatUntil(s.halloweenUntil, now)} har passerat)`;
  return `${namn} · Halloween på till ${formatUntil(s.halloweenUntil, now)}`;
}
