// ============================================================================
// Matchdagen på SERVERN – lobbyn och utmaningen (functions/md-vanskap-lobby.js, #874)
// ----------------------------------------------------------------------------
// Spec §11.1–11.2, mönstret från schackets lobby (functions/schack-lobby.js):
//   utmana  { classId, till } → { utmaningId }   en utmaning i taget (en ny ersätter den gamla)
//   svara   { utmaningId, ja, classId? } → { matchId } | { matchId: null }
//           ja = den utmanade antar → matchen startar; nej = den utmanade tackar nej ELLER
//           den som utmanade tar tillbaka sin utmaning.
// Grinden: båda går i klassen och har Matchdagen (elevModuler), inget fokuslås, båda har en klubb.
// En utmaning försvinner efter VANSKAP.utmaning sekunder. Bara en vänskapsmatch åt gången per elev
// (mdVanskapElev/{uid}.aktiv, läses i transaktionen – håller även över klasser); en gammal match där
// någon varit borta i VANSKAP.inaktiv sekunder avslutas först (walkover/avbruten, tick).
// När matchen startar läses båda elevernas matchdagenInst och valda områden (en gång) och en frågebank
// per elev läggs i facit-dokumentet (md-vanskap-fragor.js). Lagen (namn, färg, lagbonus ur truppen)
// tas ur karriärerna matchdagen/{uid}. Den som utmanade är "a" och gör avspark.
// ============================================================================

import { HALVLEK_MIN, HALVLEKAR, VANSKAP } from "./matchdagen/md-config.js";
import { fasSekunder, nyVanskap } from "./matchdagen/md-vanskap.js";
import { byggBank, byggKallor, harKallor, normInst, omradesNycklar } from "./md-vanskap-fragor.js";
import {
  MdFel, ctx, idEller, hamtaKlass, klassIdsForElev, namnFor, post, lobbyRef, matchRef, facitRef, elevRef, karriarRef,
  lobbyData, aktivFor, lagUr, rensaUtmaningar,
} from "./md-vanskap-state.js";
import { tick } from "./md-vanskap-spel.js";

export { MdFel };

/** Bankens storlek: lika många frågor som en match kan ha lägen (minsta steget). */
export const BANK = Math.ceil((HALVLEK_MIN * HALVLEKAR) / VANSKAP.steg.min) + 1;
const UTMANING_MS = VANSKAP.utmaning * 1000;

async function karriar(c, uid) {
  const s = await karriarRef(c, uid).get();
  return s.exists ? s.data() : null;
}

/** En gammal match (spärren) där någon varit borta för länge avslutas innan en ny börjar. */
async function stadaAktiva(c, uids) {
  for (const uid of uids) {
    const e = await elevRef(c, uid).get();
    const id = e.exists ? e.data().aktiv : null;
    if (typeof id === "string" && id) await tick(c, null, { matchId: id }).catch(() => null);
  }
}

function ledig(st, uid, vem) {
  if (st.aktiv) throw new MdFel("failed-precondition", `${vem} spelar redan en vänskapsmatch.`);
}

export async function utmana(deps, uid, data = {}) {
  const c = ctx(deps);
  idEller(uid, "elev-id");
  const classId = idEller(data.classId, "klass-id");
  const till = idEller(data.till, "kompis-id");
  if (till === uid) throw new MdFel("invalid-argument", "Du kan inte utmana dig själv.");
  await hamtaKlass(c.db, uid, classId, c.now(), till);
  const [namn, K] = await Promise.all([namnFor(c.db, classId, [uid]), karriar(c, uid)]);
  const lag = lagUr(K);
  if (!lag) throw new MdFel("failed-precondition", "Starta din klubb under Match först.");
  await stadaAktiva(c, [uid, till]);
  return c.db.runTransaction(async (tx) => {
    const nu = c.now();
    const lob = lobbyData(await tx.get(lobbyRef(c, classId)));
    ledig(await aktivFor(c, uid, (r) => tx.get(r)), uid, "Du");
    ledig(await aktivFor(c, till, (r) => tx.get(r)), till, "Kompisen");
    const utmaningId = c.rid(12);
    const utm = rensaUtmaningar(lob.utmaningar, nu, UTMANING_MS);
    for (const [id, u] of Object.entries(utm)) if (u.fran === uid) delete utm[id];
    utm[utmaningId] = { fran: uid, franNamn: namn[uid], franLag: lag.namn, till, sedan: nu };
    tx.set(lobbyRef(c, classId), { utmaningar: { ...utm }, matcher: { ...lob.matcher } });
    return { utmaningId };
  });
}

/** Klassen där utmaningen ligger – ur data.classId eller elevens klasser. */
async function klassForUtmaning(c, uid, data, utmaningId) {
  if (data.classId != null) return idEller(data.classId, "klass-id");
  for (const classId of await klassIdsForElev(c.db, uid)) {
    const snap = await lobbyRef(c, classId).get();
    if (snap.exists && post(snap.data().utmaningar, utmaningId)) return classId;
  }
  throw new MdFel("not-found", "Utmaningen finns inte längre.");
}

/** Elevens lag, frågebank och tid per läge – läses EN gång när matchen startar. */
async function forbered(c, uid, vem) {
  const [K, is] = await Promise.all([karriar(c, uid), c.db.collection("matchdagenInst").doc(uid).get()]);
  const lag = lagUr(K);
  if (!lag) throw new MdFel("failed-precondition", `${vem} har ingen klubb än.`);
  const inst = normInst(is.exists ? is.data() : null);
  if (!harKallor(inst)) throw new MdFel("failed-precondition", `${vem} har inga frågor valda av läraren än.`);
  const omraden = {};
  await Promise.all(omradesNycklar(inst).map(async (k) => {
    const [s, a] = k.split("/");
    const snap = await c.db.collection("subjects").doc(s).collection("areas").doc(a).get().catch(() => null);
    omraden[k] = snap?.exists ? snap.data() : null;
  }));
  const fro = Math.floor(c.rng() * 2 ** 32);
  const bank = byggBank(byggKallor(inst, omraden, fro), { antal: BANK, rng: c.rng, fro });
  if (!bank.length) throw new MdFel("failed-precondition", `Frågorna som ${vem === "Du" ? "du" : "kompisen"} har går inte att hitta just nu.`);
  return { lag, bank, tid: fasSekunder(inst.klocka) };
}

export async function svara(deps, uid, data = {}) {
  const c = ctx(deps);
  idEller(uid, "elev-id");
  const utmaningId = idEller(data.utmaningId, "utmanings-id");
  const ja = data.ja === true;
  const classId = await klassForUtmaning(c, uid, data, utmaningId);
  await hamtaKlass(c.db, uid, classId, c.now());
  const u0 = post(lobbyData(await lobbyRef(c, classId).get()).utmaningar, utmaningId);
  if (!u0 || (u0.till !== uid && u0.fran !== uid) || c.now() - u0.sedan >= UTMANING_MS) {
    throw new MdFel("not-found", "Utmaningen finns inte längre.");
  }
  if (ja && u0.fran === uid) throw new MdFel("invalid-argument", "Du kan inte anta din egen utmaning.");
  const fran = u0.fran;
  let A = null;
  let B = null;
  let namn = {};
  if (ja) {
    await hamtaKlass(c.db, uid, classId, c.now(), fran);
    await stadaAktiva(c, [uid, fran]);
    [A, B, namn] = await Promise.all([forbered(c, fran, "Kompisen"), forbered(c, uid, "Du"), namnFor(c.db, classId, [uid, fran])]);
  }
  return c.db.runTransaction(async (tx) => {
    const nu = c.now();
    const lob = lobbyData(await tx.get(lobbyRef(c, classId)));
    const u = post(lob.utmaningar, utmaningId);
    if (!u || u.fran !== fran || u.till !== u0.till) throw new MdFel("not-found", "Utmaningen finns inte längre.");
    const utm = rensaUtmaningar(lob.utmaningar, nu, UTMANING_MS);
    delete utm[utmaningId];
    if (!ja) {
      tx.set(lobbyRef(c, classId), { utmaningar: { ...utm }, matcher: { ...lob.matcher } });
      return { matchId: null };
    }
    ledig(await aktivFor(c, uid, (r) => tx.get(r)), uid, "Du");
    ledig(await aktivFor(c, fran, (r) => tx.get(r)), fran, "Kompisen");
    const matchId = c.rid(20);
    const V = nyVanskap({ a: A.lag, b: B.lag, avspark: "a" });
    tx.set(matchRef(c, matchId), {
      classId, a: fran, b: uid, spelare: [fran, uid], namn: { a: namn[fran], b: namn[uid] },
      tid: { a: A.tid, b: B.tid }, status: "pagar", V, h: null, fas: { nr: 1, start: nu }, halvtid: null, resultat: null,
      skapad: nu, uppdaterad: nu,
    });
    tx.set(facitRef(c, matchId, fran), { classId, sida: "a", bank: A.bank });
    tx.set(facitRef(c, matchId, uid), { classId, sida: "b", bank: B.bank });
    for (const s of [fran, uid]) tx.set(elevRef(c, s), { aktiv: matchId }, { merge: true });
    for (const [id, x] of Object.entries(utm)) if ([fran, uid].includes(x.fran) || [fran, uid].includes(x.till)) delete utm[id];
    const matcher = { ...lob.matcher, [matchId]: { a: fran, b: uid, aNamn: namn[fran], bNamn: namn[uid], aLag: V.lag.a.namn, bLag: V.lag.b.namn, start: nu } };
    tx.set(lobbyRef(c, classId), { utmaningar: { ...utm }, matcher });
    return { matchId };
  });
}
