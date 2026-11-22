// ============================================================================
// Matchdagen på SERVERN – lobbyn och utmaningen (functions/md-vanskap-lobby.js, #874)
// ----------------------------------------------------------------------------
// Spec §11.1–11.2, mönstret från schackets lobby (functions/schack-lobby.js):
//   utmana  { classId, till } → { utmaningId }   en utmaning i taget (en ny ersätter den gamla)
//   svara   { utmaningId, ja, classId? } → { matchId } | { matchId: null }
//           ja = den utmanade antar → matchen startar; nej = den utmanade tackar nej ELLER
//           den som utmanade tar tillbaka sin utmaning.
// Grinden: båda går i klassen och har Matchdagen (enabledModules eller elevModuler), inget fokuslås,
// båda har en klubb.
// En utmaning försvinner efter VANSKAP.utmaning sekunder. Bara en vänskapsmatch åt gången per elev
// (mdVanskapElev/{uid}.aktiv, läses i transaktionen – håller även över klasser); en gammal match där
// någon varit borta i VANSKAP.inaktiv sekunder avslutas först (walkover/avbruten, tick).
// När matchen startar läses båda elevernas matchdagenInst (saknas den: klassens classes/{id}.matchdagenInst,
// annars tabellerna 0–10 – #876, som klientens md-inst.js effektivInst) och valda områden (en gång) och en frågebank
// per elev läggs i facit-dokumentet (md-vanskap-fragor.js). Lagen (namn, färg, lagbonus ur truppen)
// tas ur karriärerna matchdagen/{uid}. Den som utmanade är "a" och gör avspark.
// #899: elevens källor = de valda ∩ det eleven ser i Plugga (klasserna med eleven – EN fråga), och
// "Samma som Plugga" räknas fram ur synligheten med klientens rena kod (matchdagen/md-synlighet.js).
// Högst MAX_OMRADEN områden läses per elev, som förr.
// #903 (Veckoschema E): under en lektion (klass-schema.js schemaForStudent med SERVERNS tid, c.now())
// bara lektionens ämne, med reserven "Samma som Plugga inom ämnet" (md-synlighet.js lektionsKallor).
// Båda måste få frågor – annars ett vänligt besked (lektionsBesked) och ingen match. Extra läsningar
// bara när en av elevens klasser har en lektion som pågår: ämneslistan (1 fråga), vid hela biblioteket
// en områdesfråga (limit 1) per lektionsämne, och reserven läser områden bara i lektionens ämnen –
// fortfarande högst MAX_OMRADEN områden per elev.
// ============================================================================

import { HALVLEK_MIN, HALVLEKAR, VANSKAP } from "./matchdagen/md-config.js";
import { fasSekunder, nyVanskap } from "./matchdagen/md-vanskap.js";
import { byggBank, byggKallor, arStandard, effektivInst, flaggor, harKallor, omradesNycklar } from "./md-vanskap-fragor.js";
import {
  MAX_OMRADEN, effektivaKallor, harKonkretaKallor, iLektionen, klassOrdning, lektionsBesked, lektionsFilter, lektionsKallor,
  pluggaKallor, synligaOmraden, underlag,
} from "./matchdagen/md-synlighet.js";
import { aktivLektion, schemaForStudent } from "./matchdagen/kallor/klass-schema.js";
import {
  MdFel, ctx, idEller, hamtaKlass, klassIdsForElev, namnFor, post, lobbyRef, matchRef, facitRef, elevRef, karriarRef,
  lobbyData, aktivFor, lagUr, rensaUtmaningar, snabbTx,
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
  return snabbTx(c, async (tx) => {
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

const lasOmrade = async (c, k) => {
  const [s, a] = k.split("/");
  const snap = await c.db.collection("subjects").doc(s).collection("areas").doc(a).get().catch(() => null);
  return snap?.exists ? snap.data() : null;
};

/**
 * "Samma som Plugga" (#899): raderna { nyckel, plugga, rakna } för de MAX_OMRADEN första synliga
 * områdena (klassens ordning, eller bibliotekets: ämnenas och områdenas order – som Plugga-listan).
 * De lästa områdena läggs i `omraden`. Högst MAX_OMRADEN områden läses.
 */
async function pluggaRader(c, synliga, omraden, amnen = null) {
  if (synliga) {
    return Promise.all(synliga.slice(0, MAX_OMRADEN).map(async (k) => {
      omraden[k] = await lasOmrade(c, k);
      return { nyckel: k, ...(omraden[k] ? underlag(flaggor(omraden[k])) : { plugga: false, rakna: false }) };
    }));
  }
  const rader = [];
  const amnenSnap = await c.db.collection("subjects").orderBy("order").get();
  for (const s of amnenSnap.docs) {
    if (rader.length >= MAX_OMRADEN) break;
    if (amnen && !amnen.includes(s.id)) continue;
    const areas = await s.ref.collection("areas").orderBy("order").limit(MAX_OMRADEN - rader.length).get();
    for (const a of areas.docs) {
      const k = `${s.id}/${a.id}`;
      omraden[k] = a.data();
      rader.push({ nyckel: k, ...underlag(flaggor(omraden[k])) });
    }
  }
  return rader;
}

/** Elevens klasser i getClasses-ordningen (synligheten följer Plugga-listans klass – md-synlighet.js elevensKlass). */
async function elevensKlasser(c, uid) {
  const s = await c.db.collection("classes").where("studentIds", "array-contains", uid).get();
  return klassOrdning(s.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * Elevens schemaläge just nu (#903) med serverns tid – samma rena funktion som klientens grind
 * (klass-schema.js schemaForStudent). Ingen lektion pågår → null utan en enda läsning. Annars
 * ämneslistan (namnen och den gissade kopplingen) och, när Plugga-klassen ser hela biblioteket,
 * om lektionsämnena har några områden (en fråga med limit 1 per ämne) – som klientens bevakare.
 */
async function lektionFor(c, klasser, uid) {
  const now = c.now();
  const egna = klasser.filter((k) => Array.isArray(k.studentIds) && k.studentIds.includes(uid));
  const amnen = [...new Set(egna.map((k) => aktivLektion(k, now)?.amne).filter(Boolean))];
  if (!amnen.length) return null;
  const subjects = (await c.db.collection("subjects").orderBy("order").get()).docs.map((d) => ({ id: d.id, name: d.data().name }));
  const helaBiblioteket = synligaOmraden(klasser, uid) === null;
  const amnenMedOmraden = helaBiblioteket
    ? (await Promise.all(amnen.map(async (a) => ((await c.db.collection("subjects").doc(a).collection("areas").limit(1).get()).empty ? null : a))))
      .filter(Boolean)
    : null;
  return schemaForStudent(klasser, uid, now, { subjects, amnenMedOmraden });
}

/** Elevens lag, frågebank och tid per läge – läses EN gång när matchen startar. k = matchens klass. */
async function forbered(c, uid, vem, k) {
  const [K, is, klasser] = await Promise.all([karriar(c, uid), c.db.collection("matchdagenInst").doc(uid).get(), elevensKlasser(c, uid)]);
  const lag = lagUr(K);
  if (!lag) throw new MdFel("failed-precondition", `${vem} har ingen klubb än.`);
  const egen = is.exists ? is.data() : null;
  const vald = effektivInst(egen, k);
  const lektion = await lektionFor(c, klasser, uid);
  const amnen = lektion ? lektion.amnen : null;
  const synliga = lektion ? iLektionen(synligaOmraden(klasser, uid), amnen) : synligaOmraden(klasser, uid);
  const omraden = {};
  const plugga = vald.foljPlugga ? pluggaKallor(await pluggaRader(c, synliga, omraden, amnen)) : null;
  let inst = effektivaKallor(vald, { synliga, plugga, standard: arStandard(egen, k) });
  if (lektion) {
    // E.2: reserven "Samma som Plugga inom ämnet" läses bara när filtret inte lämnar något.
    const inom = harKonkretaKallor(lektionsFilter(inst, lektion)) ? null
      : plugga || pluggaKallor(await pluggaRader(c, synliga, omraden, amnen));
    const e = lektionsKallor(inst, lektion, inom);
    if (e.sparrad) throw new MdFel("failed-precondition", lektionsBesked(lektion, vem !== "Du"));
    inst = e.inst;
  }
  if (!harKallor(inst)) throw new MdFel("failed-precondition", `${vem === "Du" ? "Din" : "Kompisens"} lärare behöver välja frågor till Matchdagen.`);
  await Promise.all(omradesNycklar(inst).filter((n) => !(n in omraden)).map(async (n) => { omraden[n] = await lasOmrade(c, n); }));
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
    const k = await hamtaKlass(c.db, uid, classId, c.now(), fran);
    await stadaAktiva(c, [uid, fran]);
    [A, B, namn] = await Promise.all([forbered(c, fran, "Kompisen", k), forbered(c, uid, "Du", k), namnFor(c.db, classId, [uid, fran])]);
  }
  return snabbTx(c, async (tx) => {
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
