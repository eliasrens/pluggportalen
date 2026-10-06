// ============================================================================
// Pluggporten – klass-lås / fokusläge (issue #436), REN logik (ingen Firebase/DOM)
// ----------------------------------------------------------------------------
// Läraren kan LÅSA en klass till ETT mål (ett pluggområde ELLER Läsresan) fram
// till ett klockslag. Lagras på klass-dokumentet:
//
//   classes/{id}.lock = {
//     mal:  { typ: "omrade" | "lasresan", id?: "<subjectId>/<areaId>", namn?: string },
//     till: <epoch-ms>,          // sluttiden (klockslaget läraren valde)
//     doljOvrigt: <bool>,        // "Dölj allt annat": även shop/värld/profil döljs
//   }
//
// Saknat fält, okänd form eller `till <= now` = INGET lås (bakåtkompatibelt).
// Grundlåset döljer alltid övriga INLÄRNINGS-områden (andra Plugga-områden +
// Läsresan om den inte är målet). Med doljOvrigt nås BARA målet.
//
// Laddas ALLTID dynamiskt (via class-lock-watch.js / lärarpanelen) – filen får
// aldrig hamna i den statiska bootgrafen (incident #271).
// ============================================================================

/** Mål-typerna (utbyggbar enum – nya typer läggs till här + i reglerna). */
export const LOCK_TARGET_TYPES = ["omrade", "lasresan"];

/** Längsta tillåtna lås (speglas i firestore.rules): en skoldag räcker gott. */
export const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

// Plugga-modulens rutter: listan + område/spel/äventyr (de tre bär ?subj=&area=).
const OMRADE_RUTTER = ["/elev/omrade", "/elev/spela", "/elev/aventyr"];

/** "subjectId/areaId" → { subjectId, areaId } (null om ogiltigt). */
export function parseAreaKey(id) {
  const s = String(id || "");
  const i = s.indexOf("/");
  if (i <= 0 || i === s.length - 1) return null;
  return { subjectId: s.slice(0, i), areaId: s.slice(i + 1) };
}

/** Bygg ett områdes-id ur ämne + område. */
export function areaKey(subjectId, areaId) {
  return `${subjectId}/${areaId}`;
}

/**
 * Normalisera ett lås-fält till säker form, eller null om det inte är ett
 * giltigt lås (okänd typ, område utan id, saknad/ogiltig sluttid).
 */
export function normalizeLock(v) {
  if (!v || typeof v !== "object") return null;
  const typ = v.mal?.typ;
  if (!LOCK_TARGET_TYPES.includes(typ)) return null;
  const till = Math.round(Number(v.till));
  if (!Number.isFinite(till) || till <= 0) return null;
  const mal = { typ };
  if (typ === "omrade") {
    if (!parseAreaKey(v.mal.id)) return null;
    mal.id = String(v.mal.id);
  }
  if (typeof v.mal.namn === "string" && v.mal.namn.trim()) mal.namn = v.mal.namn.trim().slice(0, 100);
  return { mal, till, doljOvrigt: v.doljOvrigt === true };
}

/** Klassens AKTIVA lås vid tiden `now` (ms), annars null. */
export function activeLock(klass, now) {
  const lock = normalizeLock(klass?.lock);
  return lock && lock.till > now ? lock : null;
}

/**
 * Elevens aktiva lås: första klassen (i klasslistans ordning, samma regel som
 * getClassForStudent) som eleven är med i och som har ett aktivt lås.
 * @returns {object|null} låset + `classId`
 */
export function lockForStudent(classes, meId, now) {
  if (!meId || !Array.isArray(classes)) return null;
  for (const c of classes) {
    if (!Array.isArray(c?.studentIds) || !c.studentIds.includes(meId)) continue;
    const lock = activeLock(c, now);
    if (lock) return { ...lock, classId: c.id };
  }
  return null;
}

/** Hash-länken till låsets mål (dit eleven skickas när något annat är låst). */
export function lockHomeHash(lock) {
  if (lock.mal.typ === "lasresan") return "#/elev/lasresan";
  const a = parseAreaKey(lock.mal.id);
  const enc = encodeURIComponent;
  return `#/elev/omrade?subj=${enc(a.subjectId)}&area=${enc(a.areaId)}`;
}

/** Visningsnamn för målet ("Läsresan" eller områdets namn). */
export function lockLabel(lock) {
  if (lock.mal.typ === "lasresan") return "Läsresan";
  return lock.mal.namn || parseAreaKey(lock.mal.id)?.areaId || "ett område";
}

/** Är (ämne, område) låsets mål-område? */
export function lockAllowsArea(lock, subjectId, areaId) {
  return lock.mal.typ === "omrade" && lock.mal.id === areaKey(subjectId, areaId);
}

/**
 * Hör elev-routen till låsets MÅL? (Målet nås alltid under låset – även om
 * modulen annars är dold via hiddenModules, så eleven aldrig studsar i en loop.)
 * @param {string} path  route utan query, t.ex. "/elev/spela"
 * @param {URLSearchParams|{get:function}} query
 */
export function lockIsTarget(lock, path, query) {
  if (lock.mal.typ === "lasresan") return path === "/elev/lasresan";
  if (path === "/elev/plugga") return true; // listan visar bara målområdet
  if (!OMRADE_RUTTER.includes(path)) return false;
  return lockAllowsArea(lock, query?.get?.("subj") || "", query?.get?.("area") || "");
}

/** Inlärnings-rutter (Plugga + Läsresan) – det grundlåset alltid styr. */
function arInlarning(path) {
  return path === "/elev/plugga" || path === "/elev/lasresan" || OMRADE_RUTTER.includes(path);
}

/**
 * Får eleven öppna `path` under låset?
 *  - målet: alltid
 *  - övriga inlärnings-rutter (andra områden, Läsresan/Plugga): aldrig
 *  - allt annat (hus/värld/shop/profil…): bara om läraren INTE valt "Dölj allt annat"
 *  - avatarvalet (första inloggningen) blockeras aldrig
 */
export function lockAllowsRoute(lock, path, query) {
  if (lockIsTarget(lock, path, query)) return true;
  if (path === "/elev/avatar") return true;
  if (arInlarning(path)) return false;
  return !lock.doljOvrigt;
}

/** Klockslag "HH:MM" (svensk 24 h) för ett epoch-ms i lokal tid. */
export function formatKlockslag(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Återstående tid som "1 h 05 min" / "12 min" / "45 s". */
export function formatKvar(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.ceil(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/**
 * Klockslag "HH:MM" idag → epoch-ms (lokal tid). Null om formatet är fel eller
 * klockslaget redan passerat / ligger längre bort än MAX_LOCK_MS från `now`.
 */
export function tillFromKlockslag(hhmm, now) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  const till = d.getTime();
  return till > now && till - now <= MAX_LOCK_MS ? till : null;
}

/** Bygg ett lås att spara (validerat via normalizeLock), eller null. */
export function buildLock({ typ, id, namn, till, doljOvrigt }) {
  const mal = { typ };
  if (id) mal.id = id;
  if (namn) mal.namn = namn;
  return normalizeLock({ mal, till, doljOvrigt: !!doljOvrigt });
}
