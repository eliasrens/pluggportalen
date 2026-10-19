// ============================================================================
// Pluggporten – klass-lås / fokusläge (issue #436), REN logik (ingen Firebase/DOM)
// ----------------------------------------------------------------------------
// Läraren kan LÅSA en klass till ETT mål (ett pluggområde ELLER en låsbar
// modul: Läsresan, Ekvationsresan, Hitta rätt!, Mattematchen …) fram till ett
// klockslag. Lagras på klass-dokumentet:
//
//   classes/{id}.lock = {
//     mal:  { typ: "omrade" | <modul-id>, id?: "<subjectId>/<areaId>" | <tillfälle>, namn?: string },
//     till: <epoch-ms>,          // sluttiden (klockslaget läraren valde)
//     doljOvrigt: <bool>,        // "Dölj allt annat": även shop/värld/profil döljs
//     efter?: { lage, moduler? }, // bara prov (#788): vad en elev som LÄMNAT IN får göra
//   }
//
// Saknat fält, okänd form eller `till <= now` = INGET lås (bakåtkompatibelt).
// Grundlåset spärrar alltid övriga INLÄRNINGS-moduler (andra Plugga-områden +
// alla `learning`-moduler som inte är målet). Med doljOvrigt nås BARA målet.
//
// Mål-typerna och inlärnings-rutterna HÄRLEDS ur modulregistret
// (STUDENT_MODULES i gamemode-visibility.js, #734): ny modul = en rad där.
//
// Laddas ALLTID dynamiskt (via class-lock-watch.js / lärarpanelen) – filen får
// aldrig hamna i den statiska bootgrafen (incident #271).
// ============================================================================

import { STUDENT_MODULES, studentModuleForRoute } from "./gamemode-visibility.js";

/** Låstypen för ett Plugga-område (modulen med `lockAreas`). */
const OMRADE = "omrade";

// Låsbara moduler ur registret. Typen = modul-id, utom område-modulen (Plugga),
// vars mål är ETT område: typen "omrade" + mal.id "subj/area". En modul med
// `lockId` (Prov, #740) låses till ETT tillfälle: typen = modul-id + mal.id.
const LASBARA = STUDENT_MODULES.filter((m) => m.lockable);
const typAv = (m) => (m.lockAreas ? OMRADE : m.id);

/** Mål-typerna (ur registret; speglas i firestore.rules validLockShape). */
export const LOCK_TARGET_TYPES = LASBARA.map(typAv);

/** Registrets modul för låsets mål-typ (null om okänd). */
export function lockTargetModule(typ) {
  return LASBARA.find((m) => typAv(m) === typ) || null;
}

/** Längsta tillåtna lås (speglas i firestore.rules): en skoldag räcker gott. */
export const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

// Område-modulens rutter (Plugga): första = listan (visar bara målområdet under
// låset), övriga = område/spel/äventyr som bär ?subj=&area=.
const [OMRADE_LISTA, ...OMRADE_RUTTER] = lockTargetModule(OMRADE)?.routes || [];

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
  if (typ === OMRADE) {
    if (!parseAreaKey(v.mal.id)) return null;
    mal.id = String(v.mal.id);
  } else if (lockTargetModule(typ).lockId) {
    // Speglar reglerna: id krävs, 3–200 tecken (ett tillfälles dokument-id).
    const id = typeof v.mal.id === "string" ? v.mal.id : "";
    if (id.length <= 2 || id.length > 200) return null;
    mal.id = id;
  }
  if (typeof v.mal.namn === "string" && v.mal.namn.trim()) mal.namn = v.mal.namn.trim().slice(0, 100);
  const lock = { mal, till, doljOvrigt: v.doljOvrigt === true };
  // "Efter inlämning" (#788) finns bara på ett provlås; "prov" (stanna) = som förr.
  const efter = lockTargetModule(typ).lockId ? normalizeEfter(v.efter) : null;
  if (efter && efter.lage !== EFTER.PROV) lock.efter = efter;
  return lock;
}

// --- Efter inlämning (#788) ------------------------------------------------------
// Läraren väljer i provets låsruta vad en elev som LÄMNAT IN får göra medan
// låset gäller för resten av klassen. Elever som skriver är låsta som förr.

/** Lägena: stanna på provsidan / bara övning / klassens vanliga läge / välj själv. */
export const EFTER = { PROV: "prov", OVNING: "ovning", KLASS: "klass", EGNA: "egna" };
export const EFTER_LAGEN = [EFTER.PROV, EFTER.OVNING, EFTER.KLASS, EFTER.EGNA];
/** Förvalet i låsrutan (Elias förslag, #788). */
export const EFTER_STANDARD = EFTER.KLASS;

/** Moduler som kan väljas i "Välj själv" (provet självt är alltid öppet). */
export const EFTER_VALBARA = STUDENT_MODULES.filter((m) => !m.lockId);
/** "Bara övning": registrets `ovning`-moduler. */
export const OVNING_MODULER = STUDENT_MODULES.filter((m) => m.ovning).map((m) => m.id);

/** Normalisera efter-valet: { lage, moduler? } eller null (okänt läge). */
export function normalizeEfter(v) {
  if (!v || typeof v !== "object" || !EFTER_LAGEN.includes(v.lage)) return null;
  if (v.lage !== EFTER.EGNA) return { lage: v.lage };
  const kanda = new Set(EFTER_VALBARA.map((m) => m.id));
  const moduler = [...new Set(Array.isArray(v.moduler) ? v.moduler : [])].filter((id) => kanda.has(id));
  return { lage: EFTER.EGNA, moduler };
}

/** Modulerna som är öppna efter inlämning ("klass" = alla, klassens vanliga grind gäller). */
export function efterModuler(efter) {
  if (efter?.lage === EFTER.OVNING) return [...OVNING_MODULER];
  if (efter?.lage === EFTER.EGNA) return [...efter.moduler];
  if (efter?.lage === EFTER.KLASS) return EFTER_VALBARA.map((m) => m.id);
  return [];
}

/** Läser låset elevens provsvar (inlämnad eller inte)? Bara ett provlås med ett efter-val. */
export function lockBehoverInlamning(lock) {
  return !!(lock?.efter && lockTargetModule(lock.mal.typ)?.lockId);
}

/**
 * Elevens EFFEKTIVA lås när hen har lämnat in (`inlamnad`): oförändrat för den
 * som skriver (eller när läraren valt "stanna på provsidan"), annars samma lås
 * med `fri` = läget och `moduler` = de öppna modulerna. "klass" ⇒ gateFor ger
 * null (inget lås – klassens vanliga läge).
 */
export function lockEfterInlamning(lock, inlamnad) {
  if (!lock || !inlamnad || !lockBehoverInlamning(lock)) return lock;
  return { ...lock, fri: lock.efter.lage, moduler: efterModuler(lock.efter) };
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
  if (lock.mal.typ !== OMRADE) {
    const m = lockTargetModule(lock.mal.typ);
    if (m.lockId && lock.mal.id) return `#${m.lockRoute || m.routes[0]}?${m.lockId}=${encodeURIComponent(lock.mal.id)}`;
    return `#${m.routes[0]}`;
  }
  const a = parseAreaKey(lock.mal.id);
  const enc = encodeURIComponent;
  return `#${OMRADE_RUTTER[0]}?subj=${enc(a.subjectId)}&area=${enc(a.areaId)}`;
}

/** Visningsnamn för målet (modulens namn, t.ex. "Läsresan", eller områdets/provets namn). */
export function lockLabel(lock) {
  if (lock.fri === EFTER.OVNING) return "Övning efter provet";
  if (lock.fri) return "Efter provet";
  if (lock.mal.typ !== OMRADE) {
    const m = lockTargetModule(lock.mal.typ);
    return m.lockId && lock.mal.namn ? lock.mal.namn : m.label;
  }
  return lock.mal.namn || parseAreaKey(lock.mal.id)?.areaId || "ett område";
}

/** Är (ämne, område) låsets mål-område? */
export function lockAllowsArea(lock, subjectId, areaId) {
  if (lock.fri) return lock.moduler.includes(lockTargetModule(OMRADE)?.id);
  return lock.mal.typ === OMRADE && lock.mal.id === areaKey(subjectId, areaId);
}

/**
 * Hör elev-routen till låsets MÅL? (Målet nås alltid under låset – även om
 * modulen annars är dold via hiddenModules, så eleven aldrig studsar i en loop.)
 * @param {string} path  route utan query, t.ex. "/elev/spela"
 * @param {URLSearchParams|{get:function}} query
 */
export function lockIsTarget(lock, path, query) {
  if (lock.mal.typ !== OMRADE) return lockTargetModule(lock.mal.typ).routes.includes(path);
  if (path === OMRADE_LISTA) return true; // listan visar bara målområdet
  if (!OMRADE_RUTTER.includes(path)) return false;
  return lockAllowsArea(lock, query?.get?.("subj") || "", query?.get?.("area") || "");
}

/** Inlärnings-rutter (registrets `learning`-moduler) – det grundlåset alltid styr. */
function arInlarning(path) {
  return !!studentModuleForRoute(path)?.learning;
}

/**
 * Får eleven öppna `path` under låset?
 *  - målet: alltid
 *  - övriga inlärnings-rutter (andra områden + alla andra `learning`-moduler): aldrig
 *  - allt annat (hus/värld/shop/profil…): bara om läraren INTE valt "Dölj allt annat"
 *  - avatarvalet (första inloggningen) blockeras aldrig
 */
export function lockAllowsRoute(lock, path, query) {
  if (lockIsTarget(lock, path, query)) return true;
  if (path === "/elev/avatar") return true;
  // Inlämnat (#788): bara de valda modulerna – hus, värld, profil och Live är stängda.
  if (lock.fri === EFTER.KLASS) return true;
  if (lock.fri) return lock.moduler.includes(studentModuleForRoute(path)?.id);
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
export function buildLock({ typ, id, namn, till, doljOvrigt, efter }) {
  const mal = { typ };
  if (id) mal.id = id;
  if (namn) mal.namn = namn;
  return normalizeLock({ mal, till, doljOvrigt: !!doljOvrigt, efter });
}

/**
 * Router-/meny-vänlig vy av ett lås (null in → null ut). Ett inlämnat prov med
 * "klassens vanliga läge" (#788) är inget lås alls; `fri` = efter-läget annars.
 */
export function gateFor(lock) {
  if (!lock || lock.fri === EFTER.KLASS) return null;
  return {
    lock,
    fri: lock.fri || null,
    home: lockHomeHash(lock),
    label: lockLabel(lock),
    klockslag: formatKlockslag(lock.till),
    allows: (path, query) => lockAllowsRoute(lock, path, query),
    isTarget: (path, query) => lockIsTarget(lock, path, query),
    allowsArea: (subjectId, areaId) => lockAllowsArea(lock, subjectId, areaId),
  };
}
