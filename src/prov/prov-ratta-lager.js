// ============================================================================
// Prov (#741, spec §6.3 + §7): rättningsvyns tillstånd och sparning – utan
// DOM. Håller alla rättningar för tillfället, fyller i förslagen (sparas
// direkt med auto: true), sparar ändrade elever automatiskt (prov-sparning.js
// med lärarens tak) och lämnar tillbaka / ångrar. Räkneverket på tillfället
// (rattStatus, "18 av 24 rättade") följer med sparningarna.
//
//   const lager = skapaRattningsLager({ data, med, onStatus, spara? })
//   lager.rattningar[uid]     elevens rättning (ändras av vyerna, sedan andrat([uid]))
//   lager.andrat(uids)        de här eleverna ska sparas
//   lager.lamnaTillbaka(uids, visaFacit) / lager.angra(uid)
//   lager.spola()             spara direkt (läraren lämnar vyn)
// ============================================================================

import { angraTillbaka, lamnaTillbaka, sparaRattningar } from "./prov-rattning-data.js";
import {
  angratDok, aterlamnadDok, kompletteraForslag, nyRattning, rattStatusSumma, sparDok,
} from "./prov-rattning-logik.js";
import { LARARENS_SPARNING, skapaSparare } from "./prov-sparning.js";
import { provInfoDok } from "./prov-statistik.js";

/**
 * @param {object} o
 * @param {{ tf, facit, svar, rattningar }} o.data  från laddaRattning
 * @param {string[]} o.med  eleverna som rättas (inlämnade)
 * @param {(s: { lage: "sparat"|"sparar"|"fel"|"nekad", tid?: number }) => void} [o.onStatus]
 */
export function skapaRattningsLager({ data, med, onStatus = () => {} }) {
  const { tf, facit, svar } = data;
  const t = tf.id;
  const fragor = tf.fragor || [];
  const rattningar = data.rattningar;
  const smutsiga = new Set();

  for (const uid of med) {
    const r = rattningar[uid];
    if (!r) {
      rattningar[uid] = nyRattning({ elevId: uid, classId: tf.classId, provNamn: tf.provNamn, fragor, svar: svar[uid]?.svar, facit });
      smutsiga.add(uid);
    } else if (!r.aterlamnad) {
      const k = kompletteraForslag(r, fragor, svar[uid]?.svar, facit);
      rattningar[uid] = k.r;
      if (k.andrad) smutsiga.add(uid);
    }
  }

  const status = () => rattStatusSumma(med, rattningar, fragor);
  // Hela dokumentet + provInfo (datum, gränser, andel) för statistikfliken "Prov" (#742).
  const dokFor = (uid) => sparDok(rattningar[uid], fragor, provInfoDok(rattningar[uid], fragor, tf));
  async function spara() {
    const uids = [...smutsiga].filter((uid) => !rattningar[uid]?.aterlamnad);
    smutsiga.clear();
    const st = status();
    const nyStatus = JSON.stringify(st) !== JSON.stringify(tf.rattStatus || null) ? st : null;
    if (!uids.length && !nyStatus) return;
    try {
      await sparaRattningar(t, Object.fromEntries(uids.map((uid) => [uid, dokFor(uid)])), nyStatus);
      if (nyStatus) tf.rattStatus = nyStatus;
    } catch (err) {
      uids.forEach((uid) => smutsiga.add(uid));
      throw err;
    }
  }
  const sparare = skapaSparare({
    spara, instl: LARARENS_SPARNING, onStatus,
    onSlutgiltigt: (err) => {
      console.warn("Prov: rättningen nekades", err);
      onStatus({ lage: "nekad" });
    },
  });
  if (smutsiga.size) sparare.andrat();

  return {
    rattningar,
    status,
    andrat(uids) {
      uids.forEach((uid) => smutsiga.add(uid));
      if (uids.length) sparare.andrat();
    },
    get osparat() { return sparare.osparat; },
    spola() { if (sparare.osparat) return sparare.spolaNu(); },

    /** Lämna tillbaka (§7) – osparat sparas först; facit bara om valt. */
    async lamnaTillbaka(uids, visaFacit) {
      await sparare.spolaNu().catch(() => {});
      const dok = Object.fromEntries(uids.map((uid) => [uid, aterlamnadDok(dokFor(uid), { visaFacit, facit })]));
      const efter = { ...rattningar, ...Object.fromEntries(Object.entries(dok).map(([uid, d]) => [uid, { ...d, aterlamnadAt: Date.now() }])) };
      const st = rattStatusSumma(med, efter, fragor);
      await lamnaTillbaka(t, dok, st);
      Object.assign(rattningar, efter);
      uids.forEach((uid) => smutsiga.delete(uid));
      tf.rattStatus = st;
    },

    /** Ångra tillbakalämningen (§7): aterlamnad false, facit bort. */
    async angra(uid) {
      const efter = { ...rattningar, [uid]: angratDok(rattningar[uid]) };
      const st = rattStatusSumma(med, efter, fragor);
      await angraTillbaka(t, uid, st);
      rattningar[uid] = efter[uid];
      tf.rattStatus = st;
    },
  };
}
