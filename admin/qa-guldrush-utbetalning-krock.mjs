// ============================================================================
// Guldrushen #580 (QA-fynd F1 i #567): två matcher med SAMMA elever slutar
// samtidigt → två lärarklienter (elias + rasmus) betalar ut Pluggmynten
// parallellt mot samma studentData. Appens egen payLiveRewards
// (src/live/live-rewards-pay.js) med reglerna – BARA emulatorn.
//
//   kontroll  forsok = 1 (som före #580): visar att krockarna finns (nekade)
//   omforsok  appens standard (KROCK_FORSOK): alla betalda, saldo exakt en
//             gång, ett kvitto per elev, sedan en "omladdning" → bara "redan"
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8568 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9568 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-guldrush-utbetalning-krock.mjs omforsok [varv]
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, runTransaction, serverTimestamp } from "firebase/firestore";
import { payLiveRewards } from "../src/live/live-rewards-pay.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const adb = admin.initializeApp({ projectId: PROJECT }).firestore();
const { Timestamp } = admin.firestore;

async function larare(uid) {
  const app = initializeApp({ apiKey: "qa", projectId: PROJECT }, `larare-${uid}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS.split(":")[0], Number(FS.split(":")[1]));
  await signInWithEmailAndPassword(auth, `${uid}@larare.pluggportalen.local`, "lilla123");
  // Räknar transaktionsförsök och nekade commits (= krockar) per klient.
  const n = { forsok: 0, nekade: 0 };
  const sdk = {
    doc, getDoc, serverTimestamp,
    runTransaction: (d, fn) => {
      n.forsok++;
      return runTransaction(d, fn).catch((err) => {
        n.nekade++;
        throw err;
      });
    },
  };
  return { uid, db, sdk, n };
}

/** Avslutad match där alla elever i 4B (+5E) får mynt; belopp skiljer per match. */
async function avslutad(sid, elever, bas) {
  const ref = adb.doc(`liveSessions/${sid}`);
  await adb.recursiveDelete(ref);
  const rewards = Object.fromEntries(elever.map((u, i) => {
    const prize = Math.max(1, bas - i * 7);
    return [u, { rank: i + 1, correct: 10, prize, correctCoins: 50, total: prize + 50 }];
  }));
  const t = Date.now();
  await ref.set({
    name: `QA #580 ${sid}`, format: "guldrush", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b", "5e"], status: "finished", createdBy: "elias",
    createdAt: Timestamp.fromMillis(t - 700_000), startedAt: Timestamp.fromMillis(t - 610_000),
    finishedAt: Timestamp.fromMillis(t - 1000), rewards: { firstPrize: 300, perCorrect: 5, cap: 300 },
    result: { totalGold: 1, ranking: [], rewards },
  });
  return rewards;
}

async function saldon(uids) {
  const ut = {};
  for (const u of uids) ut[u] = Number((await adb.doc(`studentData/${u}`).get()).get("coins")) || 0;
  return ut;
}

const per = (rader) => rader.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});

async function kor(lage, varv) {
  const elever = [
    ...(await adb.doc("classes/4b").get()).get("studentIds"),
    ...(await adb.doc("classes/5e").get()).get("studentIds"),
  ];
  const [elias, rasmus] = await Promise.all([larare("elias"), larare("rasmus")]);
  const extra = lage === "kontroll" ? { forsok: 1 } : {};
  let gront = true;
  for (let v = 1; v <= varv; v++) {
    const A = `qa-gr-580-a${v}`;
    const B = `qa-gr-580-b${v}`;
    const [rA, rB] = [await avslutad(A, elever, 300), await avslutad(B, elever, 100)];
    const fore = await saldon(elever);
    const sess = async (sid) => (await adb.doc(`liveSessions/${sid}`).get()).data();
    const [sA, sB] = [await sess(A), await sess(B)];
    for (const l of [elias, rasmus]) Object.assign(l.n, { forsok: 0, nekade: 0 });
    // Båda projektorerna avslutar samtidigt: elias betalar A, rasmus B.
    const [uA, uB] = await Promise.all([
      payLiveRewards(elias.sdk, elias.db, { sid: A, session: sA, uid: "elias", ...extra }),
      payLiveRewards(rasmus.sdk, rasmus.db, { sid: B, session: sB, uid: "rasmus", ...extra }),
    ]);
    const krockar = elias.n.nekade + rasmus.n.nekade;
    const forsok = elias.n.forsok + rasmus.n.forsok;
    // "Omladdning": båda lärarna kör båda matcherna igen → bara "redan".
    const igen = (await Promise.all([
      payLiveRewards(elias.sdk, elias.db, { sid: B, session: sB, uid: "elias" }),
      payLiveRewards(rasmus.sdk, rasmus.db, { sid: A, session: sA, uid: "rasmus" }),
    ])).flat();
    const nu = await saldon(elever);
    const kvitton = async (sid) => new Set((await adb.collection(`liveSessions/${sid}/coinReceipts`).get()).docs.map((d) => d.id));
    const [kA, kB] = [await kvitton(A), await kvitton(B)];
    // Exakt en gång: saldot ökade med precis summan av elevens kvitton.
    const fel = elever.filter((u) => nu[u] - fore[u] !== (kA.has(u) ? rA[u].total : 0) + (kB.has(u) ? rB[u].total : 0));
    const betalda = [...uA, ...uB].filter((r) => r.status === "betald").length;
    const ok = fel.length === 0 && (lage === "kontroll"
      || (betalda === 2 * elever.length && kA.size === elever.length && kB.size === elever.length && igen.every((r) => r.status === "redan")));
    const [kvA, kvB] = [kA.size, kB.size];
    gront &&= ok;
    console.log(JSON.stringify({
      lage, varv: v, elever: elever.length, A: per(uA), B: per(uB), forsok, krockar,
      kvitton: [kvA, kvB], omladdning: per(igen), saldoFel: fel, ok,
    }));
  }
  console.log(gront ? `✅ ${lage}: ${varv}/${varv} gröna` : `❌ ${lage}: något varv rött`);
  process.exit(gront ? 0 : 1);
}

const [lage = "omforsok", varv = "3"] = process.argv.slice(2);
if (!["kontroll", "omforsok"].includes(lage)) {
  console.log("kontroll | omforsok [varv]");
  process.exit(1);
}
await kor(lage, Number(varv) || 3);
