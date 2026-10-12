// ============================================================================
// Pluggporten – Hitta rätt! på SERVERN (functions/hitta-ratt-core.js, #609)
// ----------------------------------------------------------------------------
// Eleven skriver ALDRIG poäng, personbästa eller topplista (firestore.rules
// nekar). Klienten skapar bara hittaRattAttempts/{id} (startedAt = serverns
// tid via regeln) och skickar sina SVAR hit när omgången är slut. Kärnan
// räknar om allt med samma delade moduler som klienten (./hitta-ratt/ =
// GENERERAD kopia av src/hitta-ratt/delat/ + packens facit, npm run
// sync:hitta-ratt). Samma deps-injektion som guldrush-core/login-core, så
// kärnan testas direkt mot Firestore-emulatorn (test/functions-hitta-ratt-core.test.mjs).
//
// submit(deps, uid, { attemptId, svar }) – arkitektur §4.1:
//   1. Försöket måste finnas, tillhöra anroparen, vara "open" och ≤ 6 h gammalt.
//   2. Hitta rätt! måste vara aktiverat i någon av elevens klasser (och inte
//      dolt i någon) – samma regel som menyn (modulesHiddenForStudent).
//   3. raknaOmgang: svaren täcker exakt packens items, tider rimliga, allt
//      räknas om här. Klientens totalsumma finns inte i anropet.
//   4. EN transaktion: försöket → done + result · hittaRattBest/{uid}
//      (battre – ett sämre försök ökar bara attempts) · topplistans entry för
//      ANROPAREN (namn ur students/{uid}.namn, klass ur classes/{id}.name –
//      aldrig ur anropet) · leaders räknas om ur alla entries och
//      hittaRattMeta/ledare uppdateras om de ändrats · studentData.coins +=
//      godkända svar (§26).
//   5. Omförsök med samma attemptId (nätfel, dubbelklick) → samma svar,
//      coins: 0. Idempotent.
//
// taBortElev(deps, uid) – admin/delete-student.mjs: tar bort elevens entry ur
// alla topplistor, räknar om ledarna, raderar personbästa och försök.
//
// API (deps = { db, FieldValue, Timestamp, now?(), packs? })
//   submit → { packId, leaderboard, result, pb, nyttRekord, coins,
//              top, egen, plats, antal }   (rader: { plats, n, k, s | r,t, jag })
//   HrFel(code, message) – code = HttpsError-kod, message på svenska
// ============================================================================

import { PACKS } from "./hitta-ratt/packs.js";
import { raknaOmgang, HrFel } from "./hitta-ratt/omgang.js";
import { battre, matt, topplista, ledare } from "./hitta-ratt/rank.js";

export { HrFel };

export const MODUL_ID = "hittaratt";
export const MAX_ALDER_MS = 6 * 3600 * 1000;
const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_SVAR = 300;

const refs = (db, uid, packId, attemptId) => ({
  attempt: db.collection("hittaRattAttempts").doc(attemptId),
  best: db.collection("hittaRattBest").doc(uid),
  board: db.collection("hittaRattBoards").doc(packId || "-"),
  meta: db.collection("hittaRattMeta").doc("ledare"),
  data: db.collection("studentData").doc(uid),
});

const kortNamn = (v, max = 40) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Elevens namn och klass, läst på servern. Kräver att Hitta rätt! är
 * aktiverat i någon av elevens klasser och inte dolt i någon.
 */
export async function elevInfo(db, uid) {
  const [stu, klasser] = await Promise.all([
    db.collection("students").doc(uid).get(),
    db.collection("classes").where("studentIds", "array-contains", uid).get(),
  ]);
  const lista = klasser.docs.map((d) => ({ id: d.id, ...d.data() }));
  const har = (c, falt) => Array.isArray(c[falt]) && c[falt].includes(MODUL_ID);
  const pa = lista.filter((c) => har(c, "enabledModules"));
  if (!pa.length || lista.some((c) => har(c, "hiddenModules"))) {
    throw new HrFel("permission-denied", "Hitta rätt! är inte aktiverat för din klass.");
  }
  pa.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sv") || (a.id < b.id ? -1 : 1));
  return { namn: kortNamn(stu.exists ? stu.data().namn : "") || "Elev", klass: kortNamn(pa[0].name, 20) || "?" };
}

/** Rader för klienten: utan uid och tidsstämpel, med jag-flagga. */
function rad(r, uid, typ) {
  return { plats: r.plats, n: r.n, k: r.k, ...matt(r, typ), ...(r.uid === uid ? { jag: true } : {}) };
}

function svarMedLista(base, entries, typ, uid, leaderboard) {
  if (!leaderboard) return { ...base, top: [], egen: null, plats: null, antal: 0 };
  const t = topplista(entries, typ, uid);
  return {
    ...base,
    top: t.top.map((r) => rad(r, uid, typ)),
    egen: t.egen ? rad(t.egen, uid, typ) : null,
    plats: t.plats,
    antal: t.antal,
  };
}

const sammaLista = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

export async function submit(deps, uid, data) {
  const { db, FieldValue } = deps;
  const now = deps.now || Date.now;
  const packs = deps.packs || PACKS;
  const attemptId = data?.attemptId;
  if (typeof attemptId !== "string" || !ATTEMPT_RE.test(attemptId)) throw new HrFel("invalid-argument", "Ogiltigt försök.");
  if (!Array.isArray(data.svar) || data.svar.length > MAX_SVAR) throw new HrFel("invalid-argument", "Svaren saknas.");

  const info = await elevInfo(db, uid);
  const aRef = db.collection("hittaRattAttempts").doc(attemptId);

  return db.runTransaction(async (tx) => {
    const aSnap = await tx.get(aRef);
    if (!aSnap.exists) throw new HrFel("not-found", "Omgången finns inte.");
    const a = aSnap.data();
    if (a.uid !== uid) throw new HrFel("permission-denied", "Omgången är inte din.");
    const pack = packs[a.packId];
    if (!pack) throw new HrFel("not-found", "Okänd karta.");
    const r = refs(db, uid, pack.id, attemptId);
    const lb = pack.leaderboard !== false;

    const [bSnap, boardSnap, metaSnap] = await Promise.all([
      tx.get(r.best),
      lb ? tx.get(r.board) : null,
      lb ? tx.get(r.meta) : null,
    ]);
    const bestNu = bSnap.exists ? bSnap.data().packs?.[pack.id] || null : null;
    const entries = { ...(boardSnap?.exists ? boardSnap.data().entries || {} : {}) };

    if (a.status === "done") {
      // Omförsök: samma resultat, inga nya coins (idempotent).
      const base = { packId: pack.id, leaderboard: lb, result: a.result, pb: bestNu, nyttRekord: !!a.nyttRekord, coins: 0 };
      return svarMedLista(base, entries, pack.typ, uid, lb);
    }
    if (a.status !== "open") throw new HrFel("failed-precondition", "Omgången är redan avslutad.");
    const startMs = a.startedAt?.toMillis?.();
    const nuMs = now();
    if (!Number.isFinite(startMs) || nuMs - startMs > MAX_ALDER_MS) {
      throw new HrFel("deadline-exceeded", "Omgången är för gammal – starta en ny.");
    }

    const res = raknaOmgang(pack, data.svar, { startMs, nuMs });
    const nytt = battre(matt(res, pack.typ), bestNu, pack.typ);
    const pb = nytt
      ? { typ: pack.typ, ...matt(res, pack.typ), max: res.max, n: res.n, attempts: (bestNu?.attempts || 0) + 1, at: nuMs }
      : { ...bestNu, attempts: (bestNu.attempts || 0) + 1 };

    tx.set(r.best, { packs: { [pack.id]: pb } }, { merge: true });

    if (lb) {
      const gammal = entries[uid];
      const entry = { n: info.namn, k: info.klass, ...matt(pb, pack.typ), at: pb.at || nuMs };
      if (!gammal || nytt || gammal.n !== entry.n || gammal.k !== entry.k) {
        entries[uid] = entry;
        const leaders = ledare(entries, pack.typ);
        const boardData = boardSnap.exists ? boardSnap.data() : {};
        tx.set(
          r.board,
          {
            packId: pack.id, typ: pack.typ, titel: pack.titel, max: res.max,
            entries: { [uid]: entry }, leaders, updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        const metaNu = metaSnap.exists ? metaSnap.data().packs?.[pack.id]?.uids : null;
        if (!sammaLista(metaNu, leaders) || !sammaLista(boardData.leaders, leaders)) {
          tx.set(
            r.meta,
            { packs: { [pack.id]: { uids: leaders, titel: pack.titel, typ: pack.typ } }, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
      }
    }

    const coins = res.godkanda;
    if (coins > 0) tx.set(r.data, { coins: FieldValue.increment(coins) }, { merge: true });

    const result = { typ: res.typ, max: res.max, n: res.n, godkanda: res.godkanda, ...matt(res, pack.typ), fragor: res.fragor };
    tx.update(aRef, { status: "done", result, nyttRekord: nytt, coins, finishedAt: FieldValue.serverTimestamp() });

    return svarMedLista({ packId: pack.id, leaderboard: lb, result, pb, nyttRekord: nytt, coins }, entries, pack.typ, uid, lb);
  });
}

/**
 * Ta bort en elev ur Hitta rätt! (admin/delete-student.mjs, arkitektur §4.3):
 * entry ur alla topplistor + omräknade ledare, personbästa och försök.
 * @returns {Promise<{ boards: string[], attempts: number }>}
 */
export async function taBortElev(deps, uid) {
  const { db, FieldValue } = deps;
  const boards = await db.collection("hittaRattBoards").get();
  const andrade = [];
  for (const b of boards.docs) {
    if (!b.data().entries?.[uid]) continue;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(b.ref);
      const d = snap.data() || {};
      const entries = { ...(d.entries || {}) };
      delete entries[uid];
      const leaders = ledare(entries, d.typ);
      tx.set(b.ref, { ...d, entries, leaders, updatedAt: FieldValue.serverTimestamp() });
      tx.set(
        db.collection("hittaRattMeta").doc("ledare"),
        { packs: { [b.id]: { uids: leaders, titel: d.titel || b.id, typ: d.typ } }, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
    andrade.push(b.id);
  }
  const forsok = await db.collection("hittaRattAttempts").where("uid", "==", uid).get();
  const batch = db.batch();
  forsok.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection("hittaRattBest").doc(uid));
  await batch.commit();
  return { boards: andrade, attempts: forsok.size };
}
