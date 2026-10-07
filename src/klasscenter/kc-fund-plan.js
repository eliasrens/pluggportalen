// ============================================================================
// Klasscentret – crowdfunding: ren logik + skrivplan (#486, epic #475).
// ----------------------------------------------------------------------------
// Ingen Firebase-import (samma mönster som kc-exp-skriv.js): beskriver EXAKT
// vilka dokument en donation skriver för att firestore.rules ("KLASSCENTRET",
// fund/donations) ska godta den. Transaktionen (korDonation) tar SDK:t som
// argument → kc-fund-data.js kör den med gstatic-SDK:t i webbläsaren och
// regeltesterna (test/firestore-rules-klasscenter-fund.test.js) med npm-SDK:t
// mot emulatorn. Kontraktet kan inte glida isär.
//
// Dokument (DATAMODELL.md "Klasscentret" → "Crowdfunding"):
//   classCenters/{classId}/fund/{itemId}
//       { targetPrice, fundedAmount, isUnlocked, unlockedAt?, lastDonationId }
//   classCenters/{classId}/donations/{autoId}   { uid, itemId, amount, at }
//   studentData/{uid}.coins                      − amount (samma transaktion)
//
// Cappning: beloppet blir min(begärt, det som saknas, elevens saldo) – det
// som inte behövs dras aldrig, så inget går förlorat.
//
// API
//   planDonation({ fund, item, amount, coins }) → Plan | Fel
//     Plan = { ok:true, amount, begart, cappat, fundedAmount, targetPrice,
//              isUnlocked, kvar, coins }      (coins = saldo efter donationen)
//     Fel  = { ok:false, kod, error }  kod: "okant-foremal" | "redan-kopt" |
//            "ogiltigt-belopp" | "for-lite-mynt"
//   planDonationWrites({ classId, uid, itemId, plan, donationId, coinsFore, fv })
//       → Write[] (3 st) ; Write = { path, data, merge }
//   korDonation(sdk, db, { classId, uid, itemId, amount, donationId?, forsok? })
//       → Promise<Plan & { donationId } | Fel>   sdk = { runTransaction, doc,
//         collection, serverTimestamp }; kastar om reglerna nekar (efter
//         KROCK_FORSOK försök – en samtidig donation kan ge permission-denied)
//   normaliseraFunds(docs)  → { [itemId]: Fund } för HELA katalogen
//   unlockedItems(funds)    → katalogföremål med isUnlocked (möbellådan)
// ============================================================================

import { KC_SHOP_ITEMS, kcShopItem } from "./kc-shop-items.js";

function fel(kod, error) {
  return { ok: false, kod, error };
}

function heltal(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Planera en donation. fund = befintligt fund-dokument (eller null om ingen
 * donerat än), item = katalogföremålet, coins = elevens saldo just nu.
 */
export function planDonation({ fund = null, item, amount, coins } = {}) {
  if (!item || !kcShopItem(item.id)) return fel("okant-foremal", "Föremålet finns inte.");
  // Priset låses i fund vid första donationen (reglerna godtar ingen ändring).
  const targetPrice = fund ? heltal(fund.targetPrice) : item.targetPrice;
  const funded = fund ? Math.max(0, heltal(fund.fundedAmount)) : 0;
  if ((fund && fund.isUnlocked === true) || funded >= targetPrice) {
    return fel("redan-kopt", "Föremålet är redan köpt.");
  }
  const begart = Math.floor(Number(amount));
  if (!Number.isFinite(begart) || begart < 1) return fel("ogiltigt-belopp", "Välj ett belopp på minst 1 mynt.");
  const saldo = Math.max(0, heltal(coins));
  if (saldo < 1) return fel("for-lite-mynt", "Du har inga mynt att donera.");
  const n = Math.min(begart, targetPrice - funded, saldo);
  const fundedAmount = funded + n;
  return {
    ok: true,
    amount: n,
    begart,
    cappat: n < begart,
    fundedAmount,
    targetPrice,
    isUnlocked: fundedAmount === targetPrice,
    kvar: targetPrice - fundedAmount,
    coins: (Number(coins) || 0) - n,
  };
}

/**
 * De tre skrivningarna för en planerad donation. coinsFore = elevens saldo
 * EXAKT som det lästes (reglerna kräver nytt saldo == gammalt − amount).
 * fv = { serverTimestamp }.
 */
export function planDonationWrites({ classId, uid, itemId, plan, donationId, coinsFore, fv }) {
  const fund = {
    targetPrice: plan.targetPrice,
    fundedAmount: plan.fundedAmount,
    isUnlocked: plan.isUnlocked,
    lastDonationId: donationId,
  };
  if (plan.isUnlocked) fund.unlockedAt = fv.serverTimestamp();
  return [
    { path: ["studentData", uid], data: { coins: (Number(coinsFore) || 0) - plan.amount }, merge: true },
    {
      path: ["classCenters", classId, "donations", donationId],
      data: { uid, itemId, amount: plan.amount, at: fv.serverTimestamp() },
      merge: false,
    },
    { path: ["classCenters", classId, "fund", itemId], data: fund, merge: true },
  ];
}

/**
 * EN transaktion: läs fund + elevens saldo → planera → dra mynt, skapa
 * donationspost, öka fund. Vid samtidiga donationer kör SDK:t om callbacken
 * med färska värden (cappningen räknas om varje försök).
 */
export async function korDonation(sdk, db, { classId, uid, itemId, amount, donationId, forsok = KROCK_FORSOK } = {}) {
  const item = kcShopItem(itemId);
  if (!classId || !uid) return fel("ogiltigt-belopp", "Ingen klass eller elev.");
  if (!item) return fel("okant-foremal", "Föremålet finns inte.");
  const id = donationId || sdk.doc(sdk.collection(db, "classCenters", classId, "donations")).id;
  for (let varv = 1; ; varv++) {
    try {
      return await transaktion(sdk, db, { classId, uid, itemId, amount, item, id });
    } catch (err) {
      // En samtidig donation hann före: reglerna (räknade mot den nyare
      // fund-versionen) svarar permission-denied i stället för en vanlig
      // transaktionskrock → kör om med färska värden några gånger.
      if (err?.code !== "permission-denied" || varv >= forsok) throw err;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 160 * varv));
    }
  }
}

/** Antal försök när en samtidig donation krockar (se korDonation). */
export const KROCK_FORSOK = 4;

function transaktion(sdk, db, { classId, uid, itemId, amount, item, id }) {
  const fundRef = sdk.doc(db, "classCenters", classId, "fund", itemId);
  const dataRef = sdk.doc(db, "studentData", uid);
  return sdk.runTransaction(db, async (tx) => {
    const fundSnap = await tx.get(fundRef);
    const dataSnap = await tx.get(dataRef);
    const fund = fundSnap.exists() ? fundSnap.data() : null;
    const coinsFore = Number(dataSnap.exists() ? dataSnap.data().coins : 0) || 0;
    const plan = planDonation({ fund, item, amount, coins: coinsFore });
    if (!plan.ok) return plan;
    const fv = { serverTimestamp: sdk.serverTimestamp };
    for (const w of planDonationWrites({ classId, uid, itemId, plan, donationId: id, coinsFore, fv })) {
      tx.set(sdk.doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
    }
    return { ...plan, donationId: id };
  });
}

/**
 * Fund-dokument → en post per katalogföremål (saknat dokument = 0 insamlat).
 * docs = [{ id, data }] (eller Firestore-snapshots med .id/.data()).
 */
export function normaliseraFunds(docs = []) {
  const per = new Map();
  for (const d of docs) {
    const data = typeof d.data === "function" ? d.data() : d.data;
    if (d && d.id) per.set(d.id, data || {});
  }
  const ut = {};
  for (const item of KC_SHOP_ITEMS) {
    const f = per.get(item.id);
    const targetPrice = f ? heltal(f.targetPrice) || item.targetPrice : item.targetPrice;
    const fundedAmount = f ? Math.max(0, heltal(f.fundedAmount)) : 0;
    ut[item.id] = {
      itemId: item.id,
      targetPrice,
      fundedAmount,
      isUnlocked: !!f && f.isUnlocked === true,
      unlockedAt: (f && f.unlockedAt) || null,
    };
  }
  return ut;
}

/** Klassens möbellåda: katalogföremålen vars fund är isUnlocked (katalogordning). */
export function unlockedItems(funds = {}) {
  return KC_SHOP_ITEMS.filter((it) => funds[it.id]?.isUnlocked === true);
}
