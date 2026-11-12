// ============================================================================
// Kurragömma på SERVERN – starten och fasbytet (functions/kurragomma-fas.js, #838)
// ----------------------------------------------------------------------------
// Spec §5.2: kgStarta drar startsökarna och sätter kgFas "gom" + kgGomSlut;
// fasbytet gom → leta sker när kgGomSlut passerat, i kgTick ELLER lat i
// kgAnslut/kgLas/kgSvara/kgLeta (redo). Allt är idempotent: varje steg prövas i
// en transaktion som läser sessionen färskt, så två anrop samtidigt ger samma
// resultat. Motorn (kurragomma/) avgör antal startsökare, laddningar och
// gömställen åt dem som inte låst.
//
//   startaIntern(deps, sid, s)   → sessionen efter starten (eller den som redan fanns)
//   bytTillLeta(deps, sid, s)    → sessionen (kgFas leta, kgLetStart = kgGomSlut)
//   placeraOlasta(deps, sid, s)  gömmare utan låst plats får ett gömställe nära ett
//                                föremål (när LAS_MARGINAL_MS passerat); kgPlacerade
//   redo(deps, sid)              → sessionen: start + fasbyte + placering, lat
//   spelareDoc(p, roll, nu)      → nytt kgPlayers-dokument
//   gorTillSokare(tx, r, { uid, kp, sec, nu, FieldValue, hittadAv?, hittadAvNamn? })
//                                den gömda blir sökare (Firestore-delen, i anroparens transaktion)
// ============================================================================

import { KsError } from "./kistspel-rattning.js";
import {
  antalStartsokare, valjSlumpade, laddningarVidLetStart, laddningarNySokare, poangVidHittad,
} from "./kurragomma/kg-regler.js";
import { gomstalleNaraForemal, skydd, platsNamn } from "./kurragomma/kg-geometri.js";
import { LAS_MARGINAL_MS } from "./kurragomma/kg-config.js";
import { refs, sessionFor, sattSession, tider, instFor, kartaFor } from "./kurragomma-sess.js";
import * as rt from "./kurragomma-rtdb.js";

/** Nytt kgPlayers-dokument (spec §5.1). tystRef finns bara hos gömda (tystnadsregelns fråga). */
export function spelareDoc({ uid, classId, name }, roll, nu) {
  return {
    uid, classId, name: String(name || ""), roll, poang: 0, ratt: 0, besvarade: 0, hittade: 0,
    laddningar: 0, harLast: false, senastSvarAt: null, sokareSedan: roll === "sokare" ? nu : null,
    ...(roll === "gomd" ? { tystRef: 0 } : {}),
  };
}

/** Firestore-delen av "blir sökare" – i anroparens transaktion. sec = kgSecret (gömstället). */
export function gorTillSokare(tx, r, { uid, kp, sec, nu, letStart, FieldValue, hittadAv = null, hittadAvNamn = null }) {
  const x = Number(sec?.x) || 0;
  const z = Number(sec?.z) || 0;
  tx.update(r.kgPlayer(uid), {
    roll: "sokare", laddningar: laddningarNySokare(), sokareSedan: nu, tystRef: FieldValue.delete(),
    poang: (Number(kp.poang) || 0) + poangVidHittad({ letStartAt: letStart ?? nu, hittadAt: nu }),
    ...(hittadAv ? { hittadAv, hittadAvNamn, hittadAt: nu } : { nySokareAt: nu }),
  });
  tx.set(r.secret(uid), { gomd: false, startpunkt: { x, z, at: nu }, senasteSok: null }, { merge: true });
  return { x, z, plats: platsNamn(x, z) };
}

/** kgStarta: startsökare, kgFas "gom", kgGomSlut, kgPlayers för alla som gått med, rörelsekanalen. */
export async function startaIntern(deps, sid, s) {
  if (s.kgFas) return s;
  const { db, Timestamp } = deps;
  const { t0 } = tider(s);
  if (s.status !== "live" || t0 == null) throw new KsError("failed-precondition", "Matchen har inte startat.");
  const r = refs(db, sid);
  const inst = instFor(s);
  const karta = kartaFor(s);
  const gomSlut = t0 + inst.gomtid * 1000;
  const spelare = (await r.players.get()).docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((p) => (s.participatingClassIds || []).includes(p.classId));
  const uids = spelare.map((p) => p.uid).sort();
  const sokare = new Set(valjSlumpade(uids, antalStartsokare(uids.length, inst.startsokare), deps.rng));
  const ut = await db.runTransaction(async (tx) => {
    const d = (await tx.get(r.sess)).data();
    if (d.kgFas) return { redan: true, s: d };
    tx.update(r.sess, { kgFas: "gom", kgGomSlut: Timestamp.fromMillis(gomSlut) });
    for (const p of spelare) {
      const roll = sokare.has(p.uid) ? "sokare" : "gomd";
      tx.set(r.kgPlayer(p.uid), spelareDoc(p, roll, t0));
      if (roll === "sokare") {
        tx.set(r.secret(p.uid), { gomd: false, startpunkt: { ...karta.sokarStart, at: t0 }, senasteSok: null, senastVisslingAt: null });
      }
    }
    return { redan: false, s: { ...d, kgFas: "gom", kgGomSlut: Timestamp.fromMillis(gomSlut) } };
  });
  if (!ut.redan) {
    await rt.starta(deps.rtdb, sid, {
      sokare: [...sokare].map((uid) => ({ uid, ...karta.sokarStart })), med: uids, t: deps.now(),
      status: { fas: "gom", lasta: 0, gomda: uids.length - sokare.size, sokare: sokare.size },
    });
  }
  return sattSession(deps, sid, ut.s);
}

/**
 * Startsökarna när letfasen börjar: laddningarna = 1 + det som laddades under
 * blundandet (en gång), och pulsen i rörelsekanalen sätts om till nu, så att
 * regeln "det finns alltid en sökare" räknar sina 30 s från letfasens början.
 */
async function letStartLaddningar(deps, sid, r, nu) {
  const snap = await r.kgPlayers.where("roll", "==", "sokare").get();
  for (const d of snap.docs) {
    const gjort = await deps.db.runTransaction(async (tx) => {
      const p = (await tx.get(d.ref)).data();
      if (!p || p.letStartGjord) return false;
      tx.update(d.ref, { laddningar: laddningarVidLetStart(p.laddningar), letStartGjord: true });
      return true;
    });
    if (gjort) await rt.puls(deps.rtdb, sid, d.id, nu);
  }
}

/** Fasbytet gom → leta (när kgGomSlut passerat). Idempotent. */
export async function bytTillLeta(deps, sid, s) {
  const { db, Timestamp } = deps;
  const { gomSlut } = tider(s);
  if (s.kgFas !== "gom" || gomSlut == null || deps.now() < gomSlut) return s;
  const r = refs(db, sid);
  const ut = await db.runTransaction(async (tx) => {
    const d = (await tx.get(r.sess)).data();
    if (d.kgFas !== "gom") return { redan: true, s: d };
    tx.update(r.sess, { kgFas: "leta", kgLetStart: Timestamp.fromMillis(gomSlut) });
    return { redan: false, s: { ...d, kgFas: "leta", kgLetStart: Timestamp.fromMillis(gomSlut) } };
  });
  if (!ut.redan) {
    await letStartLaddningar(deps, sid, r, deps.now());
    await rt.status(deps.rtdb, sid, { fas: "leta" });
  }
  return sattSession(deps, sid, ut.s);
}

/**
 * Gömmare som inte låst när gömfasen är slut (+ LAS_MARGINAL_MS, så klientens
 * automatiska skick hinner fram) får ett giltigt gömställe nära ett slumpat
 * föremål (spec §1.2). Sedan kgPlacerade på sessionen, så frågan inte körs igen.
 */
export async function placeraOlasta(deps, sid, s) {
  const { db } = deps;
  const { gomSlut, letStart } = tider(s);
  if (s.kgFas !== "leta" || s.kgPlacerade || gomSlut == null || deps.now() < gomSlut + LAS_MARGINAL_MS) return s;
  const r = refs(db, sid);
  const karta = kartaFor(s);
  const olasta = await r.kgPlayers.where("roll", "==", "gomd").where("harLast", "==", false).get();
  let lasta = 0;
  for (const d of olasta.docs) {
    const plats = gomstalleNaraForemal(karta, deps.rng);
    const placerad = await db.runTransaction(async (tx) => {
      const p = (await tx.get(d.ref)).data();
      if (!p || p.harLast || p.roll !== "gomd") return false;
      const gomstalle = { ...plats, skydd: skydd(plats.x, plats.z, karta), namn: platsNamn(plats.x, plats.z, karta) };
      tx.set(r.self(d.id), { gomstalle });
      tx.set(r.secret(d.id), { ...plats, skydd: gomstalle.skydd, gomd: true, lastAt: letStart, senastVisslingAt: null, auto: true }, { merge: true });
      tx.update(d.ref, { harLast: true, autoPlacerad: true });
      return true;
    });
    if (placerad) lasta++;
  }
  if (lasta) await rt.status(deps.rtdb, sid, { lasta: rt.okning(lasta) });
  await r.sess.update({ kgPlacerade: true });
  return sattSession(deps, sid, { ...s, kgPlacerade: true });
}

/** Det lata fasbytet i alla anrop: start → fasbyte → placering, bara det som behövs. */
export async function redo(deps, sid) {
  let s = await sessionFor(deps, sid);
  if (!s.kgFas) s = await startaIntern(deps, sid, s);
  if (s.kgFas === "gom") s = await bytTillLeta(deps, sid, s);
  if (s.kgFas === "leta" && !s.kgPlacerade) s = await placeraOlasta(deps, sid, s);
  return s;
}
