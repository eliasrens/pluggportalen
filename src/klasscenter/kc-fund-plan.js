// ============================================================================
// Klasscentret – crowdfunding: ren logik + skrivplan (#486, epic #475).
// ----------------------------------------------------------------------------
// Ingen Firebase-import (samma mönster som kc-exp-skriv.js): beskriver EXAKT
// vilka dokument en donation skriver för att firestore.rules ("KLASSCENTRET",
// fund/donations) ska godta den. Skrivningen (korDonation) tar SDK:t som
// argument → kc-fund-data.js kör den med gstatic-SDK:t i webbläsaren och
// regeltesterna (test/firestore-rules-klasscenter-fund.test.js) med npm-SDK:t
// mot emulatorn. Kontraktet kan inte glida isär.
//
// Dokument (DATAMODELL.md "Klasscentret" → "Crowdfunding"):
//   classCenters/{classId}/fund/{itemId}
//       { targetPrice, fundedAmount, isUnlocked, unlockedAt?, lastDonationId }
//   classCenters/{classId}/donations/{autoId}   { uid, itemId, amount, at }
//   studentData/{uid}.coins                      − amount (samma batch)
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
//       → Write[] (3 st) ; Write = { path, data, merge }  fv = { serverTimestamp,
//         increment? } (increment → relativa coins/fundedAmount)
//   korDonation(sdk, db, { classId, uid, itemId, amount, donationId?, forsok? })
//       → Promise<Plan & { donationId } | Fel>   sdk = { doc, collection,
//         getDocFromServer (el. getDoc), writeBatch, increment,
//         serverTimestamp }; samtidiga donationer körs om
//         (kc-omforsok.js). Kastar om reglerna nekar: err.krock = false =
//         verkligt nekad (läget oförändrat), true = försöken tog slut
//   normaliseraFunds(docs)  → { [itemId]: Fund } för HELA katalogen
//   unlockedItems(funds)    → katalogföremål med isUnlocked (möbellådan)
// ============================================================================

import { KC_SHOP_ITEMS, kcShopItem } from "./kc-shop-items.js";
import { medKrockOmforsok, sammaSomNekat, SAMMA_LAGE } from "./kc-omforsok.js";

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
 * som det lästes. fv = { serverTimestamp, increment? }: med increment blir
 * saldo/insamlat relativa (−n / +n) och räknas mot det AKTUELLA läget när
 * skrivningen landar (så skriver korDonation); utan blir de absoluta
 * (coinsFore − n / fundedAmount) – handbyggda skrivningar i testerna.
 */
export function planDonationWrites({ classId, uid, itemId, plan, donationId, coinsFore, fv }) {
  const rel = typeof fv.increment === "function";
  const fund = {
    targetPrice: plan.targetPrice,
    fundedAmount: rel ? fv.increment(plan.amount) : plan.fundedAmount,
    isUnlocked: plan.isUnlocked,
    lastDonationId: donationId,
  };
  if (plan.isUnlocked) fund.unlockedAt = fv.serverTimestamp();
  return [
    {
      path: ["studentData", uid],
      data: { coins: rel ? fv.increment(-plan.amount) : (Number(coinsFore) || 0) - plan.amount },
      merge: true,
    },
    {
      path: ["classCenters", classId, "donations", donationId],
      data: { uid, itemId, amount: plan.amount, at: fv.serverTimestamp() },
      merge: false,
    },
    { path: ["classCenters", classId, "fund", itemId], data: fund, merge: true },
  ];
}

/**
 * Läs fund + elevens saldo FRÅN SERVERN → planera → EN atomär batch: dra
 * mynt (−n), skapa donationspost, öka fund (+n). Ingen transaktion med lås:
 * med 28 givare samma sekund köade transaktionerna på fund-dokumentets lås
 * (1–2 s per försök i emulatorn) och gav upp. Relativa värden gör att
 * reglerna räknar mot det aktuella läget – samtidiga givare under målet går
 * alla igenom direkt. Hade någon hunnit före så att vår cappning/isUnlocked
 * inte längre stämmer nekar reglerna och kc-omforsok.js läser om och
 * cappar om (målet nått → "redan-kopt", inget dras).
 *
 * Samma donationId genom alla försök MED FLIT: ett nekat försök skrev
 * ingenting, och skulle ett "misslyckat" commit ändå ha landat (nätfel)
 * nekar reglerna (!exists) en dubblett i stället för att dra mynt två gånger.
 */
export async function korDonation(sdk, db, { classId, uid, itemId, amount, donationId, forsok = KROCK_FORSOK } = {}) {
  const item = kcShopItem(itemId);
  if (!classId || !uid) return fel("ogiltigt-belopp", "Ingen klass eller elev.");
  if (!item) return fel("okant-foremal", "Föremålet finns inte.");
  const id = donationId || sdk.doc(sdk.collection(db, "classCenters", classId, "donations")).id;
  return medKrockOmforsok((ctx, varv) => skrivDonation(sdk, db, { classId, uid, itemId, amount, item, id, ctx, varv }), { forsok });
}

/** Antal försök när samtidiga donationer krockar (se kc-omforsok.js). */
export const KROCK_FORSOK = 10;

async function skrivDonation(sdk, db, { classId, uid, itemId, amount, item, id, ctx, varv }) {
  const las = sdk.getDocFromServer || sdk.getDoc;
  const [fundSnap, dataSnap] = await Promise.all([
    las(sdk.doc(db, "classCenters", classId, "fund", itemId)),
    las(sdk.doc(db, "studentData", uid)),
  ]);
  const fund = fundSnap.exists() ? fundSnap.data() : null;
  const coinsFore = Number(dataSnap.exists() ? dataSnap.data().coins : 0) || 0;
  if (sammaSomNekat(ctx, `${fund?.lastDonationId ?? "-"}|${fund?.fundedAmount ?? 0}|${coinsFore}`)) return SAMMA_LAGE;
  const plan = planDonation({ fund, item, amount, coins: coinsFore });
  if (!plan.ok) {
    // Någon annan fyllde målet medan vi försökte igen → inget dras.
    return plan.kod === "redan-kopt" && varv > 1
      ? fel("redan-kopt", "Klassen hann samla ihop allt – föremålet är köpt. Inga mynt drogs.")
      : plan;
  }
  const fv = { serverTimestamp: sdk.serverTimestamp, increment: sdk.increment };
  const batch = sdk.writeBatch(db);
  for (const w of planDonationWrites({ classId, uid, itemId, plan, donationId: id, coinsFore, fv })) {
    batch.set(sdk.doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
  }
  await batch.commit();
  return { ...plan, donationId: id };
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
