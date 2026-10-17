// ============================================================================
// Prov (#740, spec §5.1–§5.4): lärarens provtillfällen – skapa ("Kör i klass"),
// öppna, stänga, öppna igen och radera, och läsa svaren för översikten.
// Statusflödet och vad reglerna kräver: docs/PROV.md. Läraren läser en klass i
// taget och aldrig med lyssnare på svaren (§5.3, §9.2).
// ============================================================================

import { db } from "../firebase-config.js";
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { buildLock } from "../class-lock.js";
import { clearClassLock, getClassLock, setClassLock } from "../data-class-lock.js";
import { FACIT_DOK, RATTNING, SAMLING_PROV, SAMLING_TILLFALLEN, STATUS, SVAR, delaUppProv } from "./prov-modell.js";
import { OPPNA_IGEN_BATCH, arProvetsLas, attOppnaIgen, attStangaIn } from "./prov-tillfalle-logik.js";
import { tillfalleInstallningar } from "./prov-validera.js";

const tfRef = (t) => doc(db, SAMLING_TILLFALLEN, t);
const facitRef = (t) => doc(db, SAMLING_TILLFALLEN, t, ...FACIT_DOK);

/** Lärarens prov (reglerna: alla lärare läser alla prov) – för "Kör i klass". */
export async function listaProv() {
  const snap = await getDocs(collection(db, SAMLING_PROV));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function hamtaProv(provId) {
  const snap = await getDoc(doc(db, SAMLING_PROV, provId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function hamtaTillfalle(t) {
  const snap = await getDoc(tfRef(t));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Tillfällena i lärarens klasser (where classId in …, högst 30 per fråga). */
export async function listaTillfallen(classIds) {
  const ids = [...new Set(classIds)];
  const delar = [];
  for (let i = 0; i < ids.length; i += 30) delar.push(ids.slice(i, i + 30));
  const snaps = await Promise.all(delar.map((d) => getDocs(query(collection(db, SAMLING_TILLFALLEN), where("classId", "in", d)))));
  return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** Elevernas svar i ett tillfälle (en läsning per elev som startat) → { [uid]: dok }. */
export async function hamtaSvar(t) {
  const snap = await getDocs(collection(db, SAMLING_TILLFALLEN, t, SVAR));
  return Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
}

/**
 * "Kör i klass" (§5.2): skapar tillfället som förberett. Frågorna kopieras
 * först när provet öppnas (då gäller provets senaste version).
 * @param {object} o
 * @param {{ id, namn, installningar? }} o.prov
 * @param {string} o.classId
 * @param {number|null} o.tidsgransMin
 * @param {{ pa: boolean, doljOvrigt: boolean }} o.fokus  lås klassen när provet öppnas
 * @param {{ uid, name }} o.larare
 * @param {Record<string, number>} [o.extraTid]  #748: extra minuter per elev
 * @param {string[]} [o.elevIds]   #748: omprov – bara de här eleverna
 * @param {string} [o.omprovAv]    #748: tillfället omprovet gäller
 * @returns {Promise<string>} tillfällets id
 */
export async function skapaTillfalle({ prov, classId, tidsgransMin, fokus, larare, extraTid, elevIds, omprovAv }) {
  const ref = await addDoc(collection(db, SAMLING_TILLFALLEN), {
    provId: prov.id, provNamn: prov.namn, classId,
    createdBy: larare.uid, createdByName: larare.name || "",
    status: STATUS.FORBERETT, fragor: [],
    installningar: tillfalleInstallningar(prov.installningar),
    tidsgransMin: tidsgransMin ?? null,
    fokus: { pa: !!fokus?.pa, doljOvrigt: fokus?.doljOvrigt !== false },
    ...(extraTid && Object.keys(extraTid).length ? { extraTid } : {}),
    ...(elevIds ? { elevIds, ...(omprovAv ? { omprovAv } : {}) } : {}),
    skapad: serverTimestamp(),
  });
  return ref.id;
}

/** Extra tid per elev (#748): hela mapen ersätts ({} = ingen). Går även medan provet pågår. */
export async function sparaExtraTid(t, extraTid) {
  await updateDoc(tfRef(t), { extraTid });
}

/**
 * Öppna (§5.2): ett förberett tillfälle får provets frågor UTAN facit, facit +
 * bedömningsstöd går till privat/facit, status "oppet" och oppnad = serverns
 * tid – i en batch. Ett stängt tillfälle öppnas igen: status "oppet" och
 * stängningens inlämnad-markeringar tas tillbaka (elevens egna står kvar).
 * Sedan fokusläget, om läraren valt det.
 * @param {object} tf  tillfället
 * @param {{ till: number, doljOvrigt: boolean } | null} las
 */
export async function oppnaTillfalle(tf, las) {
  if (tf.status === STATUS.FORBERETT) {
    const prov = await hamtaProv(tf.provId);
    if (!prov) throw new Error("Provet finns inte längre – det kan ha raderats.");
    const { fragor, facit, bedomningsstod } = delaUppProv(prov);
    if (!fragor.length) throw new Error("Provet har inga frågor än.");
    const batch = writeBatch(db);
    batch.update(tfRef(tf.id), {
      fragor, provNamn: prov.namn,
      installningar: tillfalleInstallningar(prov.installningar),
      status: STATUS.OPPET, oppnad: serverTimestamp(),
    });
    batch.set(facitRef(tf.id), { facit, bedomningsstod });
    await batch.commit();
  } else if (tf.status === STATUS.STANGT) {
    await updateDoc(tfRef(tf.id), { status: STATUS.OPPET, oppnad: serverTimestamp(), stangd: deleteField() });
    const svar = Object.values(await hamtaSvar(tf.id));
    // #743 F4: tillbakalämnade elever får inte skriva om (en läsning per rättning, bara vid Öppna igen).
    const tillbaka = (await getDocs(collection(db, SAMLING_TILLFALLEN, tf.id, RATTNING))).docs
      .filter((d) => d.data().aterlamnad === true).map((d) => d.id);
    const igen = attOppnaIgen(svar, tillbaka);
    for (let i = 0; i < igen.length; i += OPPNA_IGEN_BATCH) {
      const batch = writeBatch(db);
      for (const uid of igen.slice(i, i + OPPNA_IGEN_BATCH)) {
        batch.update(doc(db, SAMLING_TILLFALLEN, tf.id, SVAR, uid), { inlamnad: false, inlamnadNar: deleteField(), inlamnadAt: deleteField() });
      }
      await batch.commit();
    }
  }
  if (las) {
    const lock = buildLock({ typ: "prov", id: tf.id, namn: tf.provNamn, till: las.till, doljOvrigt: las.doljOvrigt });
    if (!lock) throw new Error("Provet är öppet, men fokusläget kunde inte sättas (välj ett klockslag senare idag).");
    await setClassLock(tf.classId, lock);
  }
}

/** Ta bort klassens fokuslås om det är just det här tillfällets. */
async function slappLas(tf) {
  const lock = await getClassLock(tf.classId).catch(() => null);
  if (arProvetsLas(lock, tf.id)) await clearClassLock(tf.classId);
}

/**
 * Stäng (§5.4): först status "stangt" (då kan eleverna inte skriva mer), sedan
 * markeras alla svar som inte lämnats in som inlämnade ("stangt"). Elevens
 * senast sparade svar gäller. Provets fokuslås tas bort.
 * @returns {Promise<number>} antal svar som markerades
 */
export async function stangTillfalle(tf) {
  await updateDoc(tfRef(tf.id), { status: STATUS.STANGT, stangd: serverTimestamp() });
  const svar = Object.values(await hamtaSvar(tf.id));
  const inte = attStangaIn(svar);
  for (let i = 0; i < inte.length; i += 450) {
    const batch = writeBatch(db);
    for (const uid of inte.slice(i, i + 450)) {
      batch.update(doc(db, SAMLING_TILLFALLEN, tf.id, SVAR, uid), { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() });
    }
    await batch.commit();
  }
  await slappLas(tf);
  return inte.length;
}

/**
 * Radera (§3, docs/PROV.md): klientbatch med alla svar, alla rättningar,
 * facit och tillfället. Ingen callable → ingen functions-deploy.
 */
export async function raderaTillfalle(tf) {
  const [svar, rattning] = await Promise.all([
    getDocs(collection(db, SAMLING_TILLFALLEN, tf.id, SVAR)),
    getDocs(collection(db, SAMLING_TILLFALLEN, tf.id, RATTNING)),
  ]);
  const refs = [...svar.docs.map((d) => d.ref), ...rattning.docs.map((d) => d.ref), facitRef(tf.id)];
  // Underdokumenten först (reglerna slår upp klassen på tillfället), tillfället sist.
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteDoc(tfRef(tf.id));
  await slappLas(tf);
}
