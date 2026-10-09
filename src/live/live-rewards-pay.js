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
// API
//   payLiveRewards(sdk, db, { sid, session, uid, defaults?, parallel? })
//       → Promise<[{ uid, total, status: "betald" | "redan" | "nekad", fel? }]>
//       sdk = { doc, getDoc, runTransaction, serverTimestamp }; defaults() = nytt
//       studentData-dokument (data.js defaultStudentData). Aldrig kastande.
// ============================================================================

import { payoutList } from "./live-rewards.js";

export const RECEIPTS = "coinReceipts";

async function payOne(sdk, db, { sid, post, uid, defaults }) {
  const kvitto = sdk.doc(db, "liveSessions", sid, RECEIPTS, post.uid);
  const elev = sdk.doc(db, "studentData", post.uid);
  return sdk.runTransaction(db, async (tx) => {
    if ((await tx.get(kvitto)).exists()) return "redan";
    const snap = await tx.get(elev);
    const cur = snap.exists() ? Number(snap.data().coins) || 0 : 0;
    if (snap.exists()) tx.update(elev, { coins: cur + post.total });
    else tx.set(elev, { ...(defaults ? defaults() : {}), coins: post.total });
    tx.set(kvitto, {
      uid: post.uid, prize: post.prize, correctCoins: post.correctCoins, total: post.total,
      at: sdk.serverTimestamp(), by: uid,
    });
    return "betald";
  });
}

export async function payLiveRewards(sdk, db, { sid, session, uid, defaults, parallel = 4 } = {}) {
  const kö = payoutList(sid, session);
  const ut = [];
  const arbetare = async () => {
    for (let post = kö.shift(); post; post = kö.shift()) {
      try {
        ut.push({ uid: post.uid, total: post.total, status: await payOne(sdk, db, { sid, post, uid, defaults }) });
      } catch (err) {
        // En annan lärarklient hann före (reglerna nekar ett andra kvitto).
        const redan = await sdk.getDoc(sdk.doc(db, "liveSessions", sid, RECEIPTS, post.uid)).then((d) => d.exists(), () => false);
        ut.push({ uid: post.uid, total: post.total, status: redan ? "redan" : "nekad", ...(redan ? {} : { fel: err?.code || String(err) }) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, kö.length)) }, arbetare));
  return ut;
}
