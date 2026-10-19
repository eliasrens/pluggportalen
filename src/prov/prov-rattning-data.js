// ============================================================================
// Prov (#741, spec §6.3 + §7): rättningens läsningar och skrivningar.
// Läraren läser EN gång när rättningsvyn öppnas – tillfället, facit, alla
// svar och alla rättningar för klassen – och inga lyssnare (§6.3, §9.2).
// Skrivningarna är batchar med hela rättningsdokument (sparDok), så att
// reglernas validRattning alltid ser ett komplett dokument. Reglerna och
// statusflödet: firestore.rules "PROV", docs/PROV.md "Rättningen (D)".
// ============================================================================

import { db } from "../firebase-config.js";
import {
  FieldPath, collection, deleteField, doc, getDoc, getDocs, serverTimestamp, updateDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FACIT_DOK, RATTNING, SAMLING_TILLFALLEN } from "./prov-modell.js";
import { hamtaSvar, hamtaTillfalle } from "./prov-tillfalle-data.js";
import { delaIBatchar } from "./prov-ratta-alla.js";
import { glomAttRatta, raknareFalt } from "./prov-raknare.js";

const rattRef = (t, uid) => doc(db, SAMLING_TILLFALLEN, t, RATTNING, uid);

/**
 * Allt rättningen behöver, en gång: { tf, facit, bedomningsstod, kriterier, svar, rattningar }.
 * 1 + 1 + (elever som skrivit) + (rättningar) läsningar.
 */
export async function laddaRattning(t) {
  const tf = await hamtaTillfalle(t);
  if (!tf) return null;
  const [facitSnap, svar, rattSnap] = await Promise.all([
    getDoc(doc(db, SAMLING_TILLFALLEN, t, ...FACIT_DOK)),
    hamtaSvar(t),
    getDocs(collection(db, SAMLING_TILLFALLEN, t, RATTNING)),
  ]);
  const f = facitSnap.exists() ? facitSnap.data() : {};
  return {
    tf,
    facit: f.facit || {},
    bedomningsstod: f.bedomningsstod || {},
    kriterier: f.kriterier || {}, // #762: fritextens poängkriterier (lärarstöd)
    svar,
    rattningar: Object.fromEntries(rattSnap.docs.map((d) => [d.id, d.data()])),
  };
}

/**
 * Spara rättningar (autosparningen): hela dokumenten i en batch, och
 * räkneverket på tillfället ("18 av 24 rättade") om det ändrats.
 * Tillbakalämnade dokument skrivs aldrig här (ångra först).
 * @param {string} t
 * @param {Record<string, object>} dok  { [elevUid]: sparDok(...) }
 * @param {{ antal, rattade, tillbaka } | null} rattStatus
 */
export async function sparaRattningar(t, dok, rattStatus = null) {
  await iBatchar(t, Object.entries(dok), (batch, uid, d) => batch.set(rattRef(t, uid), d), rattStatus);
}

// EN skrivning per elev, högst 450 per batch (#764: under Firestores 500);
// räkneverket (+ flaggan attRatta, #807) följer med den första.
async function iBatchar(t, lista, skriv, rattStatus) {
  for (const [i, del] of delaIBatchar(lista).entries()) {
    const status = i === 0 && rattStatus;
    if (!del.length && !status) return;
    const batch = writeBatch(db);
    for (const [uid, d] of del) skriv(batch, uid, d);
    if (status) batch.update(doc(db, SAMLING_TILLFALLEN, t), raknareFalt(rattStatus));
    await batch.commit();
    if (status) glomAttRatta();
  }
}

/**
 * Facit i efterhand (#764, §6.0 "Godkänn även 'Björkö'"): frågans facit i
 * privat/facit byts mot `fa` (facitMedTillagg) – en skrivning. Används nästa
 * gång läraren trycker "Rätta alla automatiska frågor". Provet (prov/{id})
 * ändras inte – tillägget gäller bara det här tillfället.
 */
export async function sparaFacitTillagg(t, fragaId, fa) {
  await updateDoc(doc(db, SAMLING_TILLFALLEN, t, ...FACIT_DOK), new FieldPath("facit", fragaId), fa);
}

/**
 * Lämna tillbaka (§7): hela dokumentet med aterlamnad = true, serverns tid
 * och facit bara om läraren valt det (aterlamnadDok). En batch för alla.
 * @param {Record<string, object>} dok  { [elevUid]: aterlamnadDok(sparDok(...)) }
 */
export async function lamnaTillbaka(t, dok, rattStatus = null) {
  await iBatchar(t, Object.entries(dok), (batch, uid, d) => batch.set(rattRef(t, uid), { ...d, aterlamnadAt: serverTimestamp() }), rattStatus);
}

/** Ångra tillbakalämningen (§7): aterlamnad false, facit, kriterier (#762) och tiden bort. */
export async function angraTillbaka(t, uid, rattStatus = null) {
  const batch = writeBatch(db);
  batch.update(rattRef(t, uid), { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField(), kriterier: deleteField() });
  if (rattStatus) batch.update(doc(db, SAMLING_TILLFALLEN, t), raknareFalt(rattStatus));
  await batch.commit();
  if (rattStatus) glomAttRatta();
}

/**
 * Färggränserna för tillfället (#742, #796): installningar.granser på tillfället
 * – EN skrivning, och den enda källan: rättningsvyn, klassens Prov-flik, CSV
 * och utskrift läser alla tillfällets gränser (provInfo.granser i rättningen är
 * bara reserv).
 */
export async function sparaGranser(t, granser) {
  await updateDoc(doc(db, SAMLING_TILLFALLEN, t), { "installningar.granser": { gul: granser.gul, gron: granser.gron } });
}
