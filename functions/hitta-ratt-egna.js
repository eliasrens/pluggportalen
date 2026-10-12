// ============================================================================
// Pluggporten – Hitta rätt! lärarens EGNA pack på servern (functions/hitta-ratt-egna.js, #633)
// ----------------------------------------------------------------------------
// Arkitektur §11.4. Bara Cloud Functions skriver hittaRattPacks och katalogen
// hittaRattMeta/egnaPack (reglerna nekar alla klientskrivningar) – reglerna kan
// inte loopa över items, så all validering ligger här (delat/egna.js). Samma
// deps-injektion som hitta-ratt-core.js (test/functions-hitta-ratt-egna.test.mjs).
//
// sparaPack(deps, uid, { pack }, { namn }) → { id, version, nollstalld }
//   (callable hittaRattSparaPack, bara lärare)
//   1. normaliseraPack (gränser, scope, områden) + classIds måste finnas (getAll).
//   2. EN transaktion: packen, katalogen, topplistan och ledarna läses.
//      Ny: ownerUid = anroparen, version 1. Befintlig: bara ägaren, geo och
//      typ låsta. Ändrad facitnyckel (sha1 av delat/facit.js facitNyckel) →
//      version + 1, facitAt = nu, topplistan och ledare.packs.{id} nollställs
//      (tom topplista med v om den är PÅ). Ändrad titel → topplistans och
//      ledarnas titel följer med. Packen + katalogposten skrivs.
//   `leaderboard` i indata ignoreras (ändras bara av hittaRattSattTopplista, D).
// raderaPack(deps, uid, { packId }) → { fanns }  (callable hittaRattRaderaPack)
//   EN transaktion: packen, katalogposten, topplistan och ledarna. Idempotent.
//   Försök och personbästa ligger kvar (ofarliga). Bilderna: F.
// sattTopplista(deps, uid, { packId, pa }) → { leaderboard, tillagda }
//   (callable hittaRattSattTopplista, bara ägaren – §11.5, #635). Idempotent.
//   AV: EN transaktion – leaderboard = false i packen och katalogen +
//     stangTopplistaTx (topplistan och ledare.packs.{id} bort). Personbästa kvar.
//   PÅ: tx 1 – leaderboard = true + tom topplista med v om den saknas (eller har
//     fel v) · fråga hittaRattBest där packs.{id}.v == version · namn ur
//     students (getAll), klass = elevens första klass (på namn) bland packens
//     classIds (getAll; elever som inte längre går där hoppas över, som submit) ·
//     tx 2 – poster läggs BARA till för uid som saknas (en omgång som sparats
//     efter tx 1 har redan skrivit elevens nuvarande personbästa), leaders räknas
//     om och ledarna skrivs. Har packen hunnit stängas eller fått ny version
//     mellan stegen görs ingenting i tx 2.
// lasEgetPack(tx, db, packId, info) – hittaRattSubmit för e-pack (core):
//   packen ur hittaRattPacks → kompakt facit + { v, facitAtMs, scope, klass }.
//   Saknas → not-found · elevens klasser ∩ classIds = ∅ → permission-denied.
//   klass = första klassen (på namn) som packen är delad med.
// ============================================================================

import { createHash } from "node:crypto";
import { GEO_OMRADEN } from "./hitta-ratt/packs.js";
import { HrFel } from "./hitta-ratt/omgang.js";
import { kompaktFacit, facitNyckel } from "./hitta-ratt/facit.js";
import { normaliseraPack, EGEN_ID_RE, GRANS } from "./hitta-ratt/egna.js";
import { GEO_SCOPE } from "./hitta-ratt/scope.js";
import { matt, ledare as raknaLedare } from "./hitta-ratt/rank.js";
// Cykeln core ↔ egna är ofarlig: bara funktioner som anropas efter laddningen.
import { stangTopplistaTx } from "./hitta-ratt-core.js";

export const arEget = (packId) => typeof packId === "string" && packId.startsWith("e-");
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
export const facitHash = (pack) => sha1(facitNyckel(pack));

const refs = (db, id) => ({
  pack: db.collection("hittaRattPacks").doc(id),
  katalog: db.collection("hittaRattMeta").doc("egnaPack"),
  board: db.collection("hittaRattBoards").doc(id),
  ledare: db.collection("hittaRattMeta").doc("ledare"),
});

/** Katalogposten (§11.1) – det startsidan och lärarvyn läser med EN läsning. */
export function katalogPost(p, FieldValue) {
  return {
    title: p.title, description: p.description, ikon: p.ikon, type: p.type, geo: p.geo,
    antal: p.items.length, classIds: p.classIds, ownerUid: p.ownerUid, ownerNamn: p.ownerNamn,
    leaderboard: p.leaderboard === true, version: p.version, updatedAt: FieldValue.serverTimestamp(),
  };
}

/** Tom topplista för packens aktuella version (§11.4 punkt 2.3). */
export function tomTopplista(p, FieldValue) {
  const n = p.items.length;
  return {
    packId: p.id, typ: p.type === "area" ? "area" : "point", titel: p.title, max: p.type === "area" ? n : 100 * n,
    v: p.version, entries: {}, leaders: [], updatedAt: FieldValue.serverTimestamp(),
  };
}

/** Befintliga klass-id bland de klasser läraren skickat (en getAll). */
async function befintligaKlasser(db, lista) {
  if (!Array.isArray(lista)) return [];
  const ids = [...new Set(lista.filter((v) => typeof v === "string").map((v) => v.replace(/\s+/g, " ").trim()))]
    .filter((id) => /^[^/]{1,100}$/.test(id));
  if (!ids.length || ids.length > GRANS.klasser) return [];
  const snaps = await db.getAll(...ids.map((id) => db.collection("classes").doc(id)));
  return snaps.filter((s) => s.exists).map((s) => s.id);
}

export async function sparaPack(deps, uid, data, { namn } = {}) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const indata = data?.pack;
  if (!indata || typeof indata !== "object") throw new HrFel("invalid-argument", "Kartan saknas.");
  const klasser = await befintligaKlasser(db, indata.classIds);
  const ny = normaliseraPack(indata, { geoOmraden: GEO_OMRADEN, klasser });
  const nyckel = facitHash(ny);
  const r = refs(db, ny.id);

  return db.runTransaction(async (tx) => {
    const [pS, kS, bS, lS] = await Promise.all([tx.get(r.pack), tx.get(r.katalog), tx.get(r.board), tx.get(r.ledare)]);
    const gammal = pS.exists ? pS.data() : null;
    if (gammal) {
      if (gammal.ownerUid !== uid) throw new HrFel("permission-denied", "Bara läraren som skapade kartan kan ändra den.");
      if (gammal.geo !== ny.geo || gammal.type !== ny.type) {
        throw new HrFel("failed-precondition", "Kartan och frågetypen går inte att byta – duplicera kartan i stället.");
      }
    } else {
      const katalog = kS.exists ? kS.data().packs || {} : {};
      if (Buffer.byteLength(JSON.stringify(katalog)) > GRANS.katalogBytes) {
        throw new HrFel("resource-exhausted", "Skolan har för många egna kartor – radera några gamla först.");
      }
    }

    const andrad = !!gammal && gammal.facitNyckel !== nyckel;
    const nu = Timestamp.fromMillis(now());
    const pack = {
      ...ny,
      ownerUid: uid,
      ownerNamn: gammal?.ownerNamn || String(namn || "").trim().slice(0, 40) || "Lärare",
      leaderboard: gammal?.leaderboard === true,
      version: gammal ? (Number(gammal.version) || 1) + (andrad ? 1 : 0) : 1,
      facitNyckel: nyckel,
      facitAt: !gammal || andrad ? nu : gammal.facitAt,
      createdAt: gammal?.createdAt || nu,
      updatedAt: nu,
    };
    const iLedare = lS.exists && !!lS.data().packs?.[ny.id];
    const ledare = (falt) => tx.set(r.ledare, { packs: { [ny.id]: falt }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    if (andrad) {
      if (pack.leaderboard) tx.set(r.board, tomTopplista(pack, FieldValue));
      else if (bS.exists) tx.delete(r.board);
      if (iLedare) ledare(FieldValue.delete());
    } else if (gammal && gammal.title !== pack.title) {
      if (bS.exists) tx.update(r.board, { titel: pack.title });
      if (iLedare) ledare({ titel: pack.title });
    }
    tx.set(r.pack, pack);
    tx.set(r.katalog, { packs: { [ny.id]: katalogPost(pack, FieldValue) }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { id: ny.id, version: pack.version, nollstalld: andrad };
  });
}

export async function raderaPack(deps, uid, data) {
  const { db, FieldValue } = deps;
  const packId = data?.packId;
  if (typeof packId !== "string" || !EGEN_ID_RE.test(packId)) throw new HrFel("invalid-argument", "Okänd karta.");
  const r = refs(db, packId);
  return db.runTransaction(async (tx) => {
    const [pS, kS, lS] = await Promise.all([tx.get(r.pack), tx.get(r.katalog), tx.get(r.ledare)]);
    const post = kS.exists ? kS.data().packs?.[packId] : null;
    const tomKatalog = () => tx.set(r.katalog, { packs: { [packId]: FieldValue.delete() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (!pS.exists) {
      if (post && post.ownerUid === uid) tomKatalog(); // kvarglömd post – städa
      return { fanns: false };
    }
    if (pS.data().ownerUid !== uid) throw new HrFel("permission-denied", "Bara läraren som skapade kartan kan radera den.");
    tx.delete(r.pack);
    tx.delete(r.board);
    if (post) tomKatalog();
    if (lS.exists && lS.data().packs?.[packId]) {
      tx.set(r.ledare, { packs: { [packId]: FieldValue.delete() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { fanns: true };
  });
}

const sammaLista = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const kortNamn = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Ägarens pack i transaktionen – saknas → not-found, annan lärare → permission-denied. */
function agarensPack(pS, uid) {
  if (!pS.exists) throw new HrFel("not-found", "Kartan finns inte längre.");
  const p = pS.data();
  if (p.ownerUid !== uid) throw new HrFel("permission-denied", "Bara läraren som skapade kartan kan ändra topplistan.");
  return { ...p, id: pS.id, version: Number(p.version) || 1 };
}

/** Topplisteposter ur personbästa för packens nuvarande version (§11.5 punkt 2–3). */
async function posterUrPersonbasta(deps, p) {
  const { db, FieldPath } = deps;
  const typ = p.type === "area" ? "area" : "point";
  const best = await db.collection("hittaRattBest").where(new FieldPath("packs", p.id, "v"), "==", p.version).get();
  if (best.empty) return {};
  const ids = (Array.isArray(p.classIds) ? p.classIds : []).slice(0, GRANS.klasser);
  const [studs, klasser] = await Promise.all([
    db.getAll(...best.docs.map((d) => db.collection("students").doc(d.id))),
    ids.length ? db.getAll(...ids.map((id) => db.collection("classes").doc(id))) : [],
  ]);
  const namn = new Map(studs.map((s) => [s.id, kortNamn(s.exists ? s.data().namn : "", 40) || "Elev"]));
  const delade = klasser
    .filter((k) => k.exists)
    .map((k) => ({ name: kortNamn(k.data().name, 20) || "?", id: k.id, elever: new Set(k.data().studentIds || []) }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv") || (a.id < b.id ? -1 : 1));
  const poster = {};
  for (const d of best.docs) {
    const pb = d.data().packs?.[p.id];
    const klass = delade.find((k) => k.elever.has(d.id));
    if (!pb || !klass) continue;
    poster[d.id] = { n: namn.get(d.id), k: klass.name, ...matt(pb, typ), at: Number(pb.at) || 0 };
  }
  return poster;
}

export async function sattTopplista(deps, uid, data) {
  const { db, FieldValue } = deps;
  const packId = data?.packId;
  if (typeof packId !== "string" || !EGEN_ID_RE.test(packId)) throw new HrFel("invalid-argument", "Okänd karta.");
  if (typeof data.pa !== "boolean") throw new HrFel("invalid-argument", "Ange om topplistan ska vara på eller av.");
  const r = refs(db, packId);
  const flagga = (tx, kS, pa) => {
    tx.update(r.pack, { leaderboard: pa });
    if (kS.exists && kS.data().packs?.[packId]) {
      tx.set(r.katalog, { packs: { [packId]: { leaderboard: pa } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  };

  if (!data.pa) {
    return db.runTransaction(async (tx) => {
      const [pS, kS] = await Promise.all([tx.get(r.pack), tx.get(r.katalog)]);
      agarensPack(pS, uid);
      await stangTopplistaTx(tx, deps, packId);
      flagga(tx, kS, false);
      return { leaderboard: false, tillagda: 0 };
    });
  }

  // Tx 1: slå på + tom topplista för aktuell version.
  const p = await db.runTransaction(async (tx) => {
    const [pS, kS, bS] = await Promise.all([tx.get(r.pack), tx.get(r.katalog), tx.get(r.board)]);
    const pack = agarensPack(pS, uid);
    if (!bS.exists || bS.data().v !== pack.version) tx.set(r.board, tomTopplista(pack, FieldValue));
    flagga(tx, kS, true);
    return pack;
  });

  const poster = await posterUrPersonbasta(deps, p);

  // Tx 2: fyll på det som saknas och räkna om ledarna.
  return db.runTransaction(async (tx) => {
    const [pS, bS, lS] = await Promise.all([tx.get(r.pack), tx.get(r.board), tx.get(r.ledare)]);
    const nu = pS.exists ? pS.data() : null;
    const b = bS.exists ? bS.data() : null;
    if (!nu || nu.leaderboard !== true || (Number(nu.version) || 1) !== p.version || !b || b.v !== p.version) {
      return { leaderboard: nu?.leaderboard === true, tillagda: 0 };
    }
    const typ = b.typ === "area" ? "area" : "point";
    const entries = { ...(b.entries || {}) };
    const nya = Object.keys(poster).filter((id) => !entries[id]);
    nya.forEach((id) => { entries[id] = poster[id]; });
    const leaders = raknaLedare(entries, typ);
    if (nya.length || !sammaLista(b.leaders, leaders)) {
      tx.set(r.board, { entries: Object.fromEntries(nya.map((id) => [id, poster[id]])), leaders, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    const iMeta = lS.exists ? lS.data().packs?.[packId] : null;
    if (leaders.length && (!sammaLista(iMeta?.uids, leaders) || iMeta?.titel !== nu.title)) {
      const scope = GEO_SCOPE[nu.geo];
      tx.set(r.ledare, { packs: { [packId]: { uids: leaders, titel: nu.title, typ, ...(scope ? { scope } : {}) } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { leaderboard: true, tillagda: nya.length };
  });
}

/**
 * Ett eget pack för hittaRattSubmit (läses i submit-transaktionen).
 * @param info elevInfo – { klasser: [{ id, name }] } sorterade på namn
 */
export async function lasEgetPack(tx, db, packId, info) {
  const snap = await tx.get(db.collection("hittaRattPacks").doc(packId));
  if (!snap.exists) throw new HrFel("not-found", "Kartan finns inte längre.");
  const p = snap.data();
  const delade = Array.isArray(p.classIds) ? new Set(p.classIds) : new Set();
  const klass = info.klasser.find((k) => delade.has(k.id));
  if (!klass) throw new HrFel("permission-denied", "Kartan är inte delad med din klass.");
  return {
    ...kompaktFacit({ ...p, official: false }, Object.keys(GEO_OMRADEN[p.geo] || {})),
    v: Number(p.version) || 1,
    facitAtMs: p.facitAt?.toMillis?.() ?? 0,
    scope: GEO_SCOPE[p.geo] || null,
    klass: klass.name,
  };
}
