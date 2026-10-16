// ============================================================================
// Prov (#746, spec §11): UTBETALNINGEN av Pluggmynt vid tillbakalämning.
// Samma mekanism som Live-mynten (src/live/live-rewards-pay.js, #557/#580):
// SDK:t injiceras (test/firestore-rules-prov-mynt.test.js kör samma kod mot
// emulatorn; appen går via prov-mynt-data.js), en transaktion per elev där
// saldot (studentData.coins) och ett KVITTO skrivs tillsammans, reglerna
// godkänner bara kvittot om saldot ökar med exakt beloppet, och krockar
// körs om med medKrockOmforsok (kc-omforsok.js).
//
// Skillnaden mot Live: ett prov kan lämnas tillbaka flera gånger (ångra →
// rätta om → lämna tillbaka igen). Kvittot är därför en LÖPANDE summa:
//   studentData/{elev}/provMynt/{t}  { total, tillfalleId, classId, at, by }
// total får bara öka (högst 200), och varje utbetalning betalar skillnaden
// mot förra total. Kvittot ligger hos eleven, inte under tillfället – att
// radera rättningen eller tillfället nollställer alltså ingenting.
// Rättningen speglar total i myntUtbetalt (det eleven ser, "+36 mynt"),
// i samma transaktion. Ångra rör varken kvittot eller myntUtbetalt.
//
// Två flikar, dubbelklick eller en omladdning som betalar igen: den som
// kommer sist läser kvittot (eller nekas av reglerna mot det nya saldot och
// läser om) → "redan".
//
// API
//   betalaProvMynt(sdk, db, { t, tf, elever, by, defaults?, parallel?, forsok?, vanta? })
//       → Promise<[{ uid, total, status: "betald" | "redan" | "ingen" | "nekad", fel? }]>
//       sdk = { doc, getDoc, runTransaction, serverTimestamp }; tf = tillfället
//       (installningar, classId); elever = uid:n. Aldrig kastande.
//   KVITTON, KROCK_FORSOK
// ============================================================================

import { medKrockOmforsok, sammaSomNekat, SAMMA_LAGE } from "../klasscenter/kc-omforsok.js";
import { RATTNING, SAMLING_TILLFALLEN, SVAR } from "./prov-modell.js";
import { provMyntBelopp } from "./prov-mynt.js";

export const KVITTON = "provMynt";
/** Försök per elev när samtidiga utbetalningar krockar – som Live (KROCK_FORSOK). */
export const KROCK_FORSOK = 8;

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

async function betalaEn(sdk, db, { t, tf, uid, by, defaults, forsok, vanta }) {
  const kvitto = sdk.doc(db, "studentData", uid, KVITTON, t);
  const elev = sdk.doc(db, "studentData", uid);
  const ratt = sdk.doc(db, SAMLING_TILLFALLEN, t, RATTNING, uid);
  const svar = sdk.doc(db, SAMLING_TILLFALLEN, t, SVAR, uid);
  return medKrockOmforsok((ctx) => sdk.runTransaction(db, async (tx) => {
    const k = await tx.get(kvitto);
    const r = await tx.get(ratt);
    const s = await tx.get(svar);
    const snap = await tx.get(elev);
    const redan = k.exists() ? int(k.data().total) : 0;
    const cur = snap.exists() ? Number(snap.data().coins) || 0 : 0;
    if (sammaSomNekat(ctx, `${redan}|${snap.exists()}|${cur}`)) return SAMMA_LAGE;
    const rd = r.exists() ? r.data() : null;
    const belopp = provMyntBelopp(tf.installningar, rd, s.exists() ? s.data() : null);
    if (belopp <= redan) {
      // Inget nytt att betala. Spegeln i rättningen rättas om den tappats
      // (en äldre flik sparade utan den) – utan att röra saldot.
      if (redan && rd?.aterlamnad === true && rd.myntUtbetalt !== redan) tx.update(ratt, { myntUtbetalt: redan });
      return { status: redan ? "redan" : "ingen", total: redan };
    }
    const diff = belopp - redan;
    // lastProvMynt = tillfället: reglerna knyter årskurskontots coins-ökning
    // till just det här kvittot (som lastLiveReceipt för Live).
    if (snap.exists()) tx.update(elev, { coins: cur + diff, lastProvMynt: t });
    else tx.set(elev, { ...(defaults ? defaults() : {}), coins: diff });
    tx.set(kvitto, { total: belopp, tillfalleId: t, classId: tf.classId, at: sdk.serverTimestamp(), by });
    tx.update(ratt, { myntUtbetalt: belopp });
    return { status: "betald", total: belopp };
  }), { forsok, ...(vanta ? { vanta } : {}) });
}

export async function betalaProvMynt(sdk, db, {
  t, tf, elever, by, defaults, parallel = 4, forsok = KROCK_FORSOK, vanta,
} = {}) {
  const ko = [...new Set(elever || [])];
  const ut = [];
  const arbetare = async () => {
    for (let uid = ko.shift(); uid; uid = ko.shift()) {
      try {
        ut.push({ uid, ...(await betalaEn(sdk, db, { t, tf, uid, by, defaults, forsok, vanta })) });
      } catch (err) {
        ut.push({ uid, total: 0, status: "nekad", fel: err?.code || String(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, ko.length)) }, arbetare));
  return ut;
}
