// ============================================================================
// Pluggporten – intjäning med dagskvitto (data-mynt.js) · #853, SAKERHET-MYNT §6 B1
// ----------------------------------------------------------------------------
// tjanaMynt är den ENDA vägen för elevens egen intjäning i klienten: övningar
// (game-shared.js), Läsresan och Ämnesläsning (lasresan/rewards.js),
// Ekvationsresan (ekvationsresan/mynt.js) och gårdens gåva (data-farm.js).
// EN transaktion läser studentData + dagens kvitto myntDag/{dag}, klipper
// beloppet mot taken (mynt-dag.js planTjana) och skriver båda – reglerna
// (myntDagOk) binder kvittots ökning till saldots. Lärarens Ge mynt går kvar
// via data.addCoins.
//
// Laddas BARA dynamiskt (game-shared.js och data-farm.js ligger i den statiska
// bootgrafen, #271). Testerna kör tjanaMyntMed med ett injicerat SDK.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, defaultStudentData, invalidateStudentData } from "./data.js";
import { serverNow, syncServerClock } from "./data-class-lock.js";
import { xpFromStudentData } from "./leveling.js";
import { MYNT_DAG_KVITTON, grannDag, myntDag, planTjana } from "./mynt-dag.js";

export { MYNT_DAG_TAK_TEXT } from "./mynt-dag.js";

const nekad = (err) => err && (err.code === "permission-denied" || /permission/i.test(err.message || ""));

/**
 * Tjäna mynt (och XP för övningar) med dagskvitto.
 * @param {"ovning"|"lasresa"|"amnes"|"ekv"|"gard"} kalla
 * @param {number} mynt önskat belopp (klipps mot taken)
 * @param {{xp?:number, extra?:(object|function), gardUid?:string, studentId?:string}} [opts]
 *   `extra` = fältvägar som skrivs i samma skrivning (gåvans `farm.animals`),
 *   eller en funktion (studentData före) → fältvägar | null (null = avbryt,
 *   ingenting skrivs). Kräver att studentData finns.
 * @returns {Promise<{mynt:number, xp:number, tak:boolean, saldo:(number|null),
 *   xpTotal:(number|null), avbrutet?:boolean, nekad?:boolean}>}
 */
export async function tjanaMynt(kalla, mynt, opts = {}) {
  await syncServerClock().catch(() => 0);
  const res = await tjanaMyntMed({ db, doc, runTransaction, serverTimestamp, nu: serverNow }, kalla, mynt, opts);
  invalidateStudentData(opts.studentId || currentStudentId());
  return res;
}

/**
 * tjanaMynt med injicerat SDK ({db, doc, runTransaction, serverTimestamp, nu}).
 * Nekas kvittot försöker den EN gång till med dagen på andra sidan midnatt
 * (om klockan ligger nära den), annars { mynt: 0, nekad: true }.
 */
export async function tjanaMyntMed(sdk, kalla, mynt, { xp = 0, extra = null, gardUid = null, studentId = currentStudentId() } = {}) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const forsta = myntDag(sdk.nu());
  let dag = forsta;
  for (let forsok = 0; forsok < 2 && dag; forsok++) {
    try {
      return await skriv(sdk, { kalla, mynt, xp, extra, gardUid, studentId, dag });
    } catch (err) {
      if (!nekad(err)) throw err;
      console.warn(`[mynt] kvittot ${dag} nekades`, err);
    }
    // Ny dag sedan första försöket, annars dagen på andra sidan midnatt.
    const t = sdk.nu();
    dag = myntDag(t) !== forsta ? myntDag(t) : grannDag(t);
  }
  return { mynt: 0, xp: 0, tak: false, saldo: null, xpTotal: null, nekad: true };
}

function skriv(sdk, { kalla, mynt, xp, extra, gardUid, studentId, dag }) {
  const sRef = sdk.doc(sdk.db, "studentData", studentId);
  const kRef = sdk.doc(sdk.db, "studentData", studentId, MYNT_DAG_KVITTON, dag);
  return sdk.runTransaction(sdk.db, async (tx) => {
    const [sSnap, kSnap] = await Promise.all([tx.get(sRef), tx.get(kRef)]);
    const sd = sSnap.exists() ? sSnap.data() : null;
    const ext = typeof extra === "function" ? extra(sd) : extra;
    if (extra && (!ext || !sd)) return { mynt: 0, xp: 0, tak: false, saldo: null, xpTotal: null, avbrutet: true };
    const p = planTjana({ kalla, mynt, xp, sd, kvitto: kSnap.exists() ? kSnap.data() : null, gardUid });
    if (p.xpSaknas) console.warn("[mynt] studentData saknar xp – mynten betalas, XP väntar på migreringen (SAKERHET-MYNT §7).");
    if (p.kvitto) {
      tx.set(kRef, { ...p.kvitto, dag, lastAt: sdk.serverTimestamp() }, { merge: true });
    }
    const patch = { ...(p.sd || {}), ...(ext || {}) };
    if (!sd) {
      if (p.sd) tx.set(sRef, { ...defaultStudentData(), coins: p.sd.coins });
    } else if (Object.keys(patch).length) {
      tx.update(sRef, patch);
    }
    const saldo = p.sd ? p.sd.coins : sd ? Number(sd.coins) || 0 : null;
    const xpTotal = p.sd && p.sd.xp != null ? p.sd.xp : sd ? xpFromStudentData(sd) : null;
    return { mynt: p.mynt, xp: p.xp, tak: p.tak, saldo, xpTotal };
  });
}
