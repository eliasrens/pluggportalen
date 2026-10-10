// ============================================================================
// Live – UTBETALNINGEN av Pluggmynt efter matchen (#557, spec §7.2.5).
// SDK:t injiceras (som kc-kassa-plan korLivePris) → samma kod körs mot
// emulatorn i test/firestore-rules-live-rewards.test.js; appen går via
// live-rewards-data.js.
//
// EXAKT EN GÅNG per elev och session: kvittot
//   liveSessions/{sid}/coinReceipts/{uid}  { uid, prize, correctCoins, total, at, by }
// skapas i SAMMA transaktion som saldot (studentData.coins, addCoins-mönstret)
// ökar. Reglerna: kvittot får bara SKAPAS (aldrig ändras/raderas), bara av
// en lärare, bara efter matchslut, beloppen = result.rewards[uid] och bara om
// saldot i samma skrivning ökar med exakt total. Två lärarflikar, en
// omladdning eller en avbruten utbetalning som körs om → transaktionen ser
// kvittot (eller nekas av reglerna / förvillkoret) → "redan".
//
// VEM BETALAR: Klassmatchens klientmönster (#526) – den lärarklient vars
// transaktion skrev `result` betalar direkt (live-data writeResultIfMissing),
// och historikvyn försöker igen (avbrott, projektorn stängd). Ingen Cloud
// Function: allt som behövs är redan verifierat i result, kvittot gör det
// idempotent och appen slipper ett deploy-beroende för Snilleblixten.
//
// OMFÖRSÖK (#580, QA-fynd F1 i #567): slutar två matcher med samma elever
// samtidigt skriver båda lärarklienterna samma studentData. Reglerna räknar
// "saldot ökar med exakt total" mot det SENAST sparade saldot → den som kom
// sist nekas (permission-denied) och kör inte om av sig själv. Samma mönster
// som donationerna (kc-omforsok.js, #493): läs om och försök igen med
// backoff + jitter. Läser nästa försök samma läge (kvitto saknas, samma
// saldo) har ingen skrivit emellan → verkligt nekad, sluta. Kvittot gör
// omförsöket ofarligt: hann någon betala under tiden blir svaret "redan".
//
// API
//   payLiveRewards(sdk, db, { sid, session, uid, defaults?, parallel? })
//       → Promise<[{ uid, total, status: "betald" | "redan" | "nekad", fel? }]>
//       sdk = { doc, getDoc, runTransaction, serverTimestamp }; defaults() = nytt
//       studentData-dokument (data.js defaultStudentData). Aldrig kastande.
//       forsok = försök per elev vid krock (KROCK_FORSOK), vanta(ms) bara för tester.
//   KROCK_FORSOK
// ============================================================================

import { payoutList } from "./live-rewards.js";
import { medKrockOmforsok, sammaSomNekat, SAMMA_LAGE } from "../klasscenter/kc-omforsok.js";

export const RECEIPTS = "coinReceipts";

/** Försök per elev när samtidiga utbetalningar krockar (se kc-omforsok.js). */
export const KROCK_FORSOK = 8;

async function payOne(sdk, db, { sid, post, uid, defaults, forsok, vanta }) {
  const kvitto = sdk.doc(db, "liveSessions", sid, RECEIPTS, post.uid);
  const elev = sdk.doc(db, "studentData", post.uid);
  return medKrockOmforsok((ctx) => sdk.runTransaction(db, async (tx) => {
    if ((await tx.get(kvitto)).exists()) return "redan";
    const snap = await tx.get(elev);
    const cur = snap.exists() ? Number(snap.data().coins) || 0 : 0;
    if (sammaSomNekat(ctx, `${snap.exists()}|${cur}`)) return SAMMA_LAGE;
    if (snap.exists()) tx.update(elev, { coins: cur + post.total });
    else tx.set(elev, { ...(defaults ? defaults() : {}), coins: post.total });
    tx.set(kvitto, {
      uid: post.uid, prize: post.prize, correctCoins: post.correctCoins, total: post.total,
      at: sdk.serverTimestamp(), by: uid,
    });
    return "betald";
  }), { forsok, ...(vanta ? { vanta } : {}) });
}

export async function payLiveRewards(sdk, db, {
  sid, session, uid, defaults, parallel = 4, forsok = KROCK_FORSOK, vanta,
} = {}) {
  const kö = payoutList(sid, session);
  const ut = [];
  const arbetare = async () => {
    for (let post = kö.shift(); post; post = kö.shift()) {
      try {
        ut.push({ uid: post.uid, total: post.total, status: await payOne(sdk, db, { sid, post, uid, defaults, forsok, vanta }) });
      } catch (err) {
        // Försöken slut, verkligt nekad eller annat fel – hann ändå en annan
        // lärarklient betala (reglerna nekar ett andra kvitto) är det "redan".
        const redan = await sdk.getDoc(sdk.doc(db, "liveSessions", sid, RECEIPTS, post.uid)).then((d) => d.exists(), () => false);
        ut.push({ uid: post.uid, total: post.total, status: redan ? "redan" : "nekad", ...(redan ? {} : { fel: err?.code || String(err) }) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, kö.length)) }, arbetare));
  return ut;
}
