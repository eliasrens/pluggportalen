// ============================================================================
// Pluggporten – Läsresan, lärarstyrd nivå: Firestore-brygga (#505)
// ----------------------------------------------------------------------------
// Tunn brygga ovanpå den rena kärnan src/lasresan/level-control.js:
//   studentData/{id}.lasresa.{level, pendingLevel, levelSetAt, levelSetBy}
//                                    – elevens nivå (EN transaktion per elev)
//   classes/{id}.lasresaStartLevel10 – klassens startnivå (heltal 1–10, eller
//                                      saknas = START_LEVEL) + spegeln
//                                      lasresaStartLevel (gammal skala 1–7)
// Nivåskala 1–10 (#519): ny skala i nya fält, gamla fält = spegel som gamla
// cachade klienter läser/skriver ofarligt – se src/lasresan/level-scale.js.
// Se docs/LASRESAN.md "Lärarstyrd nivå" + docs/DATAMODELL.md.
//
// Behörighet ligger i firestore.rules: studentData skrivs bara av eleven själv
// eller lärare, classes bara av lärare (lasresaStartLevel valideras där).
//
// Importeras BARA dynamiskt (lärarvyn / Läsresans moduler) – aldrig statiskt
// från app.js (bootgrafen, #271 / incident 2026-09-10).
// ============================================================================

import { db } from "./firebase-config.js";
import {
  deleteField,
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, defaultStudentData, getClassForStudent, invalidateStudentData } from "./data.js";
import { clearClassCache } from "./data-classes.js";
import { normalizeLasresa } from "./lasresan/progress.js";
import {
  classStartLevelOf,
  effectiveStartLevel,
  parseTeacherLevel,
  withTeacherLevel,
} from "./lasresan/level-control.js";
import { LEVEL_MIN, LEVEL_MAX } from "./lasresan/config.js";
import {
  CLASS_START_LEVEL_FIELD,
  CLASS_START_LEVEL_LEGACY_FIELD,
  classStartLevelFields,
  toStoredLasresa,
} from "./lasresan/level-scale.js";
import { WORLDS } from "./lasresan/worlds/index.js";

export { CLASS_START_LEVEL_FIELD };

function requireLevel(level) {
  const lvl = parseTeacherLevel(level);
  if (lvl === null) throw new Error(`Ogiltig nivå: ${level} (måste vara ${LEVEL_MIN}–${LEVEL_MAX}).`);
  return lvl;
}

/**
 * Sätt EN elevs Läsresan-nivå (lärare). Ingen påbörjad text → nivån gäller
 * direkt; påbörjad text → sparas som pendingLevel och gäller från texten
 * efter. Resultat, sedda texter, totaler, världar och pengar rörs inte.
 * Elev som inte börjat får ett lasresa-objekt med lärarens nivå (som då vinner
 * över klassens startnivå).
 * @returns {Promise<{studentId:string, level:number, applied:("now"|"pending")}>}
 */
export async function setStudentLevel(studentId, level) {
  if (!studentId) throw new Error("studentId saknas.");
  const lvl = requireLevel(level);
  const ref = doc(db, "studentData", studentId);
  const applied = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const cur = normalizeLasresa(sd && sd.lasresa, WORLDS);
    const out = withTeacherLevel(cur, lvl, Date.now());
    const lasresa = toStoredLasresa(out.lasresa);
    if (snap.exists()) tx.update(ref, { lasresa });
    else tx.set(ref, { ...defaultStudentData(), lasresa });
    return out.applied;
  });
  invalidateStudentData(studentId);
  return { studentId, level: lvl, applied };
}

/**
 * Sätt samma nivå för ALLA elever i en klass (samma semantik som
 * setStudentLevel, en transaktion per elev). `classIdOrStudentIds` = klass-id
 * (läser classes/{id}.studentIds) eller en färdig lista med elev-id.
 * Ett misslyckat elev-byte stoppar inte de andra.
 * @returns {Promise<{level:number, total:number, updated:number, now:number,
 *   pending:number, failed:{studentId:string, error:string}[]}>}
 *   updated = now + pending (antal påverkade elever).
 */
export async function setClassLevel(classIdOrStudentIds, level) {
  const lvl = requireLevel(level);
  let ids;
  if (Array.isArray(classIdOrStudentIds)) {
    ids = classIdOrStudentIds;
  } else {
    if (!classIdOrStudentIds) throw new Error("classId saknas.");
    const snap = await getDoc(doc(db, "classes", classIdOrStudentIds));
    if (!snap.exists()) throw new Error(`Klassen ${classIdOrStudentIds} finns inte.`);
    ids = snap.data().studentIds;
  }
  ids = [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && x))];
  const results = await Promise.allSettled(ids.map((id) => setStudentLevel(id, lvl)));
  const out = { level: lvl, total: ids.length, updated: 0, now: 0, pending: 0, failed: [] };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      out.updated += 1;
      out[r.value.applied] += 1;
    } else {
      console.warn(`[Läsresan] kunde inte sätta nivå för ${ids[i]}`, r.reason);
      out.failed.push({ studentId: ids[i], error: (r.reason && r.reason.message) || String(r.reason) });
    }
  });
  return out;
}

/** Klassens startnivå (1–10), eller null om den inte är satt (→ START_LEVEL). */
export async function getClassStartLevel(classId) {
  if (!classId) return null;
  const snap = await getDoc(doc(db, "classes", classId));
  return snap.exists() ? classStartLevelOf(snap.data()) : null;
}

/**
 * Sätt klassens startnivå (lärare). Gäller elever som inte har börjat Läsresan
 * och nya elever – INTE elever som redan är igång (använd setClassLevel för
 * dem). `level` null → fälten tas bort (tillbaka till START_LEVEL).
 * Skriver lasresaStartLevel10 + spegeln lasresaStartLevel (1–7), så det
 * fungerar även innan de nya reglerna är deployade (#519).
 * @returns {Promise<number|null>} sparad nivå (null = borttagen)
 */
export async function setClassStartLevel(classId, level) {
  if (!classId) throw new Error("classId saknas.");
  const lvl = level == null ? null : requireLevel(level);
  const fields =
    lvl === null
      ? { [CLASS_START_LEVEL_FIELD]: deleteField(), [CLASS_START_LEVEL_LEGACY_FIELD]: deleteField() }
      : classStartLevelFields(lvl);
  await setDoc(doc(db, "classes", classId), fields, { merge: true });
  clearClassCache();
  return lvl;
}

/**
 * Startnivån som gäller för en elev som inte börjat: elevens klass (första i
 * getClasses-ordningen, som resten av elevsidan) → lasresaStartLevel, annars
 * START_LEVEL. Fel vid läsning → START_LEVEL (Läsresan ska aldrig stoppas).
 */
export async function getStudentStartLevel(studentId = currentStudentId()) {
  try {
    const cls = studentId ? await getClassForStudent(studentId) : null;
    return effectiveStartLevel(classStartLevelOf(cls));
  } catch (err) {
    console.warn("[Läsresan] kunde inte läsa klassens startnivå", err);
    return effectiveStartLevel(null);
  }
}
