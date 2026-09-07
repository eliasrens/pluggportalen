// ============================================================================
// Pluggportalen – kunskapsinnehåll + elevkonton (Firestore)
// ----------------------------------------------------------------------------
// Utbruten del av datamodulen: ämnen/arbetsområden (läs + lärarens skrivning)
// och elevkontohantering. Ingen sessionslogik här – den bor i data.js, som
// re-exporterar allt härifrån så att `import * as data from "./data.js"`
// fortsätter fungera oförändrat. Se docs/DATAMODELL.md.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ensureStudentData } from "./data.js";
import { createStudentAuthAccount } from "./auth.js";
import { xpFromStudentData, progressTotals } from "./leveling.js";

// ---------------------------------------------------------------------------
// Kunskapsinnehåll (ämnen och arbetsområden)
// ---------------------------------------------------------------------------

/** Lista alla ämnen, sorterade efter `order`. */
export async function getSubjects() {
  const snap = await getDocs(query(collection(db, "subjects"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Lista alla arbetsområden i ett ämne, sorterade efter `order`. */
export async function getAreas(subjectId) {
  const snap = await getDocs(
    query(collection(db, "subjects", subjectId, "areas"), orderBy("order"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Hämta ett enskilt arbetsområde (med texts[], quiz[], pairs[]). */
export async function getArea(subjectId, areaId) {
  const snap = await getDoc(doc(db, "subjects", subjectId, "areas", areaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------------------------------------------------------------------------
// Ämnen och arbetsområden – skrivning (lärarsidan)
// ---------------------------------------------------------------------------

/** Skapa (eller uppdatera) ett ämne, t.ex. { name, order, icon, description }. */
export async function upsertSubject(subjectId, subject) {
  const ref = doc(db, "subjects", subjectId);
  await setDoc(ref, subject, { merge: true });
  return subjectId;
}

/**
 * Spara ett arbetsområde (skapar eller ersätter hela dokumentet).
 * @param {string} subjectId ämnets id (t.ex. "so")
 * @param {string} areaId    arbetsområdets id (t.ex. "vikingatiden")
 * @param {object} area      { name, order, coverEmoji, description, texts[], quiz[], pairs[] }
 */
export async function saveArea(subjectId, areaId, area) {
  const ref = doc(db, "subjects", subjectId, "areas", areaId);
  // { id } hör inte hemma inuti dokumentet – det är dokumentets id.
  const { id, ...rest } = area;
  await setDoc(ref, rest);
  return areaId;
}

/** Ta bort ett arbetsområde. */
export async function deleteArea(subjectId, areaId) {
  await deleteDoc(doc(db, "subjects", subjectId, "areas", areaId));
}

/** Nästa lediga order-nummer i ett ämne (max befintlig + 1). */
export async function nextAreaOrder(subjectId) {
  const areas = await getAreas(subjectId);
  const max = areas.reduce((m, a) => Math.max(m, Number(a.order) || 0), 0);
  return max + 1;
}

// ---------------------------------------------------------------------------
// Elevkonton (lärarsidan)
// ---------------------------------------------------------------------------

/** Lista alla elevkonton. Kräver lärarbehörighet (regeln nekar list för elever). */
export async function getStudents() {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Hämta ETT elevkonto (eller null). Läsbart för eleven själv, läraren och
 *  klasskamrater (se firestore.rules sharesClass). */
export async function getStudent(studentId) {
  if (!studentId) return null;
  const snap = await getDoc(doc(db, "students", studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Hämta specifika elevkonton PER ID (inte en collection-listning). Klassbyn
 * använder detta i stället för getStudents() eftersom en elev enligt reglerna
 * inte får LISTA hela students-kollektionen – bara läsa sig själv + kamrater i
 * samma klass, dokument för dokument. En saknad/nekad elev hoppas tyst över.
 */
export async function getStudentsByIds(ids) {
  const uniq = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
  const docs = await Promise.all(
    uniq.map((id) =>
      getDoc(doc(db, "students", id))
        .then((snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null))
        .catch(() => null)
    )
  );
  return docs.filter(Boolean);
}

/**
 * Lista alla elever tillsammans med sitt "utseende": grundavatar (avatarId),
 * burna klädsaker (avatarItems), husets palett (paletteId) och husskal
 * (husSkalId, framtida "Köp nytt hus"). Används av klassbyn (#/elev/by).
 *
 * avatarId finns redan på students-dokumentet, men resten ligger i
 * studentData/{id}. Vi läser alla studentData-dokument parallellt (Promise.all)
 * med en per-elev catch, så att en enda trasig/saknad elevdata inte fäller hela
 * vyn – då används bara students-dokumentets avatarId utan klädsel/palett.
 *
 * Utöver utseendet fylls även POSITIVA per-elev-mått ur SAMMA studentData-
 * läsning (ingen extra runda): `xp` (samlat, härlett vid behov), `completed`
 * (avklarade övningar) och `stars` (intjänade stjärnor). Klassbyn summerar dem
 * till en gemensam klass-nivå + klasstatistik (leveling.aggregateKlassStats) –
 * de visas aldrig per elev, bara som klasstotaler.
 *
 * @param {string[]|null} ids Om en id-lista skickas läses BARA de eleverna, per
 *   dokument (klassbyn: eleven själv + klasskamrater). Utan lista listas hela
 *   students-kollektionen – bara tillåtet för läraren enligt reglerna.
 * @returns {Promise<Array<{id, namn, username, avatarId, avatarItems: string[],
 *   paletteId: string|null, husSkalId: string|null,
 *   xp: number, completed: number, stars: number}>>}
 */
export async function getStudentsWithLooks(ids = null) {
  const students = ids ? await getStudentsByIds(ids) : await getStudents();
  return Promise.all(
    students.map(async (s) => {
      try {
        const snap = await getDoc(doc(db, "studentData", s.id));
        const d = snap.exists() ? snap.data() : {};
        const { completed, stars } = progressTotals(d.progress);
        return {
          ...s,
          avatarId: d.avatarId || s.avatarId || "fox",
          avatarItems: Array.isArray(d.avatarItems) ? d.avatarItems : [],
          paletteId: (d.room && d.room.paletteId) || null,
          husSkalId: d.husSkalId || null,
          xp: xpFromStudentData(d),
          completed,
          stars,
          locked: false,
        };
      } catch (err) {
        // En NEKAD läsning (permission-denied) betyder att kamraten låst sitt
        // hus (husLast → sharesClass-grenen i firestore.rules matchar inte).
        // Det är inget äkta fel: markera huset som `locked` så byn kan rita det
        // låst och visa en liten "🔒"-ruta i stället för att navigera in. Äkta
        // fel (nätverk, saknad data) faller tyst tillbaka på default-utseendet.
        const locked =
          err?.code === "permission-denied" ||
          /Missing or insufficient permissions/i.test(err?.message || "");
        return {
          ...s, avatarId: s.avatarId || "fox", avatarItems: [], paletteId: null,
          husSkalId: null, xp: 0, completed: 0, stars: 0, locked,
        };
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Utseende-projektion (looks/{studentId}) – publik (för inloggade) spegling av
// en elevs COSMETISKA fält, se firestore.rules match /looks (#114).
// ---------------------------------------------------------------------------
// Grannby-ÖVERSIKTEN läser den för alla elever i en ANNAN klass för att rita
// deras riktiga hus/avatarer utan att röra studentData (coins/progress). Bara
// eleven själv skriver sin egen looks; skrivningen är best-effort (fäller aldrig
// vyn). Fält: { namn, avatarId, avatarItems[], paletteId, husSkalId, husLast }.

/**
 * Spegla den egna elevens utseende till looks/{studentId}. Alla fält skickas
 * alltid (som strängar/lista/bool) så regelns typkoll passerar. Best-effort:
 * anropas med .catch(()=>{}) av vyn.
 * @param {string} studentId  eleven själv (currentStudentId)
 * @param {{namn?:string, avatarId?:string, avatarItems?:string[],
 *   paletteId?:string, husSkalId?:string, husLast?:boolean}} looks
 */
export async function setLooks(studentId, {
  namn, avatarId, avatarItems, paletteId, husSkalId, husLast,
} = {}) {
  if (!studentId) return;
  await setDoc(doc(db, "looks", studentId), {
    namn: String(namn ?? ""),
    avatarId: String(avatarId || "fox"),
    avatarItems: Array.isArray(avatarItems) ? avatarItems : [],
    paletteId: String(paletteId ?? ""),
    husSkalId: String(husSkalId ?? ""),
    husLast: !!husLast,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Läs looks-projektionen för en lista elev-id:n (grannby-översikten: alla elever
 * i den klickade klassen), per dokument. En saknad/nekad läsning hoppas tyst
 * över – vyn tål att en elev ännu inte speglat sin looks.
 * @param {string[]} ids
 * @returns {Promise<Array<{id:string, namn?:string, avatarId?:string,
 *   avatarItems?:string[], paletteId?:string, husSkalId?:string, husLast?:boolean}>>}
 */
export async function getLooks(ids) {
  const uniq = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
  const docs = await Promise.all(
    uniq.map((id) =>
      getDoc(doc(db, "looks", id))
        .then((snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null))
        .catch(() => null)
    )
  );
  return docs.filter(Boolean);
}

/**
 * Skapa (eller uppdatera) ett elevkonto.
 *
 *  - NY elev (studentId falsy): skapar ett Firebase Auth-konto via en sekundär
 *    app-instans (så lärarens egen session inte kastas ut). Auth-uid:t blir
 *    dokumentets id → students/{uid} + studentData/{uid}. Returnerar uid:t.
 *  - BEFINTLIG elev (studentId satt): uppdaterar bara namn/avatar på dokumentet.
 *    Användarnamn och lösenord är knutna till Auth-kontot och kan INTE ändras
 *    från klienten (SDK saknar behörighet). Lösenordsåterställning för en elev
 *    kräver admin-vägen – se admin/reset-student-password.mjs.
 *
 * @returns {Promise<string>} elevens id (= Auth-uid)
 */
export async function upsertStudent(studentId, { namn, username, password, avatarId }) {
  if (studentId) {
    // Uppdatera befintlig elev. Rör inte username/lösenord (bor i Auth).
    const ref = doc(db, "students", studentId);
    await setDoc(ref, { namn, avatarId: avatarId || "fox" }, { merge: true });
    await ensureStudentData(studentId, avatarId);
    return studentId;
  }
  // Ny elev: skapa Auth-kontot först; uid:t blir dokumentets id.
  const uid = await createStudentAuthAccount(username, password);
  await setDoc(doc(db, "students", uid), {
    namn,
    username: String(username).trim().toLowerCase(),
    avatarId: avatarId || "fox",
  });
  await ensureStudentData(uid, avatarId);
  return uid;
}

/**
 * Ta bort ett elevkonto och dess speldata (Firestore).
 *
 * OBS: själva Firebase Auth-kontot går INTE att radera från klienten (SDK:t kan
 * bara radera den inloggade användaren). Dokumenten tas bort här; för att även
 * radera Auth-kontot, kör admin/delete-student.mjs. Ett kvarblivet Auth-konto
 * utan students-dokument kommer inte åt någon annans data.
 */
export async function deleteStudent(studentId) {
  await deleteDoc(doc(db, "students", studentId));
  await deleteDoc(doc(db, "studentData", studentId)).catch(() => {});
}

/**
 * Finns användarnamnet redan (på någon ANNAN elev än exceptId)?
 * Används för att varna för dubletter innan man sparar.
 */
export async function usernameTaken(username, exceptId = null) {
  const uname = String(username || "").trim().toLowerCase();
  if (!uname) return false;
  const snap = await getDocs(
    query(collection(db, "students"), where("username", "==", uname))
  );
  return snap.docs.some((d) => d.id !== exceptId);
}
