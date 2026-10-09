// ============================================================================
// Klasscentret – klasskassan: ren logik + skrivplan (#526).
// ----------------------------------------------------------------------------
// Ingen Firebase-import (samma mönster som kc-fund-plan.js): beskriver EXAKT
// vilka dokument en insättning (Live-priset) och ett uttag (kassören lägger
// på ett föremål) skriver för att firestore.rules ("Klasskassan") ska godta
// dem. kc-kassa-data.js kör planerna med gstatic-SDK:t, regeltesterna
// (test/firestore-rules-klasscenter-kassa.test.js) med npm-SDK:t.
//
// Dokument (DATAMODELL.md "Klasscentret" → "Klasskassan"):
//   classCenters/{classId}/kassa/saldo          { saldo, lastTxId }
//   classCenters/{classId}/kassaHistorik/{txId}
//       in  { typ:"in", kalla:"live", sessionId, titel, belopp, at, av }
//           txId = "live-<sessionId>" → EN insättning per match och klass
//       ut  { typ:"ut", itemId, belopp, uid, at }   txId = donationens id
//   Uttaget skapar dessutom donations/{txId} { …, kassa:true } och ökar
//   fund/{itemId} – samma mätare och samma cap som elevernas donationer.
//
// API
//   KASSA_FORSOK                       omförsök vid samtidiga uttag
//   kassaSaldo(data)                   → heltal ≥ 0 ur kassa/saldo-dokumentet
//   livePrisPoster(sid, session)       → [{ classId, txId, belopp, titel }]
//       (tom lista = inget att betala: inget pris, ej avslutad, inget result)
//   planKassaInWrites({ classId, post, uid, sessionId, fv }) → Write[] (2 st)
//   korLivePris(sdk, db, { sid, session, uid }) → Promise<[{ classId, belopp, status }]>
//       status "betald" | "redan" (fanns redan / annan klient hann före) | "nekad"
//   planKassaUt({ fund, item, amount, saldo }) → Plan | Fel  (som planDonation;
//       Plan.saldo = kassan efter uttaget)
//   planKassaUtWrites({ classId, uid, itemId, plan, txId, saldoFore, fv }) → Write[] (4 st)
//   korKassaUt(sdk, db, { classId, uid, itemId, amount, txId?, forsok? })
//       → Promise<Plan & { txId } | Fel>  (kastar om reglerna nekar, se kc-omforsok.js)
//   normaliseraHistorik(docs)          → poster nyast först
// ============================================================================

import { kcShopItem } from "./kc-shop-items.js";
import { planDonation, planDonationWrites } from "./kc-fund-plan.js";
import { medKrockOmforsok, sammaSomNekat, SAMMA_LAGE } from "./kc-omforsok.js";
import { sessionPrize, prizeShare } from "../live/formats/klassmatch/klassmatch-core.js";

export const KASSA_FORSOK = 8;

const heltal = (v) => Math.max(0, Math.floor(Number(v) || 0));
const kassaPath = (classId) => ["classCenters", classId, "kassa", "saldo"];
const histPath = (classId, txId) => ["classCenters", classId, "kassaHistorik", txId];

export function kassaSaldo(data) {
  return heltal(data?.saldo);
}

/** Vilka klasser får hur mycket av matchens pris? (reglerna räknar likadant) */
export function livePrisPoster(sid, session) {
  const prize = sessionPrize(session);
  const r = session?.result;
  if (!sid || !prize || !r || session.status !== "finished" || !session.startedAt) return [];
  const vinnare = Array.isArray(r.winnerClasses) ? [...new Set(r.winnerClasses)] : [];
  const belopp = prizeShare(prize, vinnare.length);
  if (!belopp) return [];
  const titel = String(session.name || "Live-match").slice(0, 80);
  return vinnare.map((classId) => ({ classId, txId: `live-${sid}`, belopp, titel }));
}

/** Insättningen: historikpost (create-only id) + saldot ökar lika mycket. */
export function planKassaInWrites({ classId, post, uid, sessionId, fv }) {
  return [
    {
      path: kassaPath(classId),
      data: { saldo: fv.increment(post.belopp), lastTxId: post.txId },
      merge: true,
    },
    {
      path: histPath(classId, post.txId),
      data: { typ: "in", kalla: "live", sessionId, titel: post.titel, belopp: post.belopp, at: fv.serverTimestamp(), av: uid },
      merge: false,
    },
  ];
}

/**
 * Betala matchens pris till vinnarklassernas kassor – en batch per klass
 * (oavgjort mellan många klasser ryms inte i reglernas anropsbudget i en
 * batch). Idempotent: historikposten har id "live-<sid>" och får bara skapas,
 * så två projektorer / en omladdning betalar aldrig två gånger.
 */
export async function korLivePris(sdk, db, { sid, session, uid }) {
  const ut = [];
  const fv = { increment: sdk.increment, serverTimestamp: sdk.serverTimestamp };
  for (const post of livePrisPoster(sid, session)) {
    const finns = async () => (await sdk.getDoc(sdk.doc(db, ...histPath(post.classId, post.txId)))).exists();
    try {
      if (await finns()) {
        ut.push({ classId: post.classId, belopp: post.belopp, status: "redan" });
        continue;
      }
      const b = sdk.writeBatch(db);
      for (const w of planKassaInWrites({ classId: post.classId, post, uid, sessionId: sid, fv })) {
        b.set(sdk.doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
      }
      await b.commit();
      ut.push({ classId: post.classId, belopp: post.belopp, status: "betald" });
    } catch (err) {
      // En annan lärarklient hann före → posten finns nu: inget fel.
      const redan = await finns().catch(() => false);
      ut.push({ classId: post.classId, belopp: post.belopp, status: redan ? "redan" : "nekad", fel: redan ? undefined : err?.code || String(err) });
    }
  }
  return ut;
}

/** Uttaget planeras som en donation med kassans saldo i stället för elevens mynt. */
export function planKassaUt({ fund = null, item, amount, saldo } = {}) {
  const p = planDonation({ fund, item, amount, coins: saldo });
  if (!p.ok) {
    return p.kod === "for-lite-mynt" ? { ...p, error: "Klasskassan är tom." } : p;
  }
  const { coins, ...rest } = p;
  return { ...rest, saldo: coins };
}

/**
 * De fyra skrivningarna: kassan −n, historik "ut", donationspost (kassa:true,
 * läraren ser vem) och fund +n. fv med increment → relativa värden (räknas
 * mot det aktuella läget, #493); utan → absoluta (handbyggda tester).
 */
export function planKassaUtWrites({ classId, uid, itemId, plan, txId, saldoFore, fv }) {
  const rel = typeof fv.increment === "function";
  const [, don, fund] = planDonationWrites({ classId, uid, itemId, plan, donationId: txId, coinsFore: 0, fv });
  return [
    {
      path: kassaPath(classId),
      data: { saldo: rel ? fv.increment(-plan.amount) : heltal(saldoFore) - plan.amount, lastTxId: txId },
      merge: true,
    },
    {
      path: histPath(classId, txId),
      data: { typ: "ut", itemId, belopp: plan.amount, uid, at: fv.serverTimestamp() },
      merge: false,
    },
    { ...don, data: { ...don.data, kassa: true } },
    fund,
  ];
}

/**
 * Läs fund + kassan FRÅN SERVERN → planera (cappa till det som saknas och
 * till saldot) → EN batch. Samtidiga uttag/donationer körs om med färska
 * värden (kc-omforsok.js); samma txId genom alla försök (!exists i reglerna
 * stoppar en dubblett om ett "misslyckat" commit ändå landade).
 */
export async function korKassaUt(sdk, db, { classId, uid, itemId, amount, txId, forsok = KASSA_FORSOK } = {}) {
  const item = kcShopItem(itemId);
  if (!classId || !uid) return { ok: false, kod: "ogiltigt-belopp", error: "Ingen klass eller användare." };
  if (!item) return { ok: false, kod: "okant-foremal", error: "Föremålet finns inte." };
  const id = txId || sdk.doc(sdk.collection(db, "classCenters", classId, "donations")).id;
  const las = sdk.getDocFromServer || sdk.getDoc;
  return medKrockOmforsok(async (ctx, varv) => {
    const [fundSnap, kassaSnap] = await Promise.all([
      las(sdk.doc(db, "classCenters", classId, "fund", itemId)),
      las(sdk.doc(db, ...kassaPath(classId))),
    ]);
    const fund = fundSnap.exists() ? fundSnap.data() : null;
    const saldoFore = kassaSaldo(kassaSnap.exists() ? kassaSnap.data() : null);
    if (sammaSomNekat(ctx, `${fund?.lastDonationId ?? "-"}|${fund?.fundedAmount ?? 0}|${saldoFore}`)) return SAMMA_LAGE;
    const plan = planKassaUt({ fund, item, amount, saldo: saldoFore });
    if (!plan.ok) {
      return plan.kod === "redan-kopt" && varv > 1
        ? { ok: false, kod: "redan-kopt", error: "Klassen hann samla ihop allt – föremålet är köpt. Inget togs ur kassan." }
        : plan;
    }
    const fv = { serverTimestamp: sdk.serverTimestamp, increment: sdk.increment };
    const batch = sdk.writeBatch(db);
    for (const w of planKassaUtWrites({ classId, uid, itemId, plan, txId: id, saldoFore, fv })) {
      batch.set(sdk.doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
    }
    await batch.commit();
    return { ...plan, txId: id };
  }, { forsok });
}

/** kassaHistorik-dokument → [{ id, typ, belopp, … }] nyast först. */
export function normaliseraHistorik(docs = []) {
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : Number(t) || 0);
  return docs
    .map((d) => ({ id: d.id, ...(typeof d.data === "function" ? d.data() : d.data) }))
    .filter((p) => p.typ === "in" || p.typ === "ut")
    .map((p) => ({ ...p, belopp: heltal(p.belopp) }))
    .sort((a, b) => ms(b.at) - ms(a.at));
}
