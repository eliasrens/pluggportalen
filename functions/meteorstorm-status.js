// ============================================================================
// Meteorstormen på SERVERN – loggen i minnet och msPublic/status
// (functions/meteorstorm-status.js, #821)
// ----------------------------------------------------------------------------
// Elias 2026-10-21: msPublic/status skrivs BARA av servern, throttlat i
// handlingsanropet (högst var MS_STATUS_MS per session) och i msAvsluta, räknat
// med motorn ur serverns logg – elevskärmarna fryser inte när projektorn stängs.
//
// Loggen läses EN gång per instans och session (alla msEvents), sedan bara
// händelser med t ≥ senast sedda t − MS_LOGG_OVERLAPP_MS (sena commits).
// Egna handlingar läggs till direkt efter commit. Samma logg används av
// dragstrålens kanAgera (meteorstorm-core.js).
//
//   somHandling(id, h)               → motorns handling ur ett händelsedokument
//   loggOf(deps, sid)                → { lista: Map id → handling, cursor, full }
//   uppdateraLogg(deps, sid)         → loggen efter en läsning av nya händelser
//   laggTillLogg(deps, sid, id, h)
//   statusFran(cfg, handlingar, now) → statusdokumentet (utan uppdaterad)
//   statusUrMinnet(deps, sid, cfg, now) → status | null (loggen inte läst än)
//   kanskeStatus(deps, sid, s, now)  → skriven status | null
//
// status = { tMs, visarMs (= now − RENDER_FORDROJNING_MS, som projektorn),
//   kvarMs, klart, handelse: { typ, slutMs } | null,
//   stationer: [{ classId, skrov, skold, laddning, skott, nedskjutna, flyter,
//                 hjalp, drag: { tillaten, kostnad, armerad, redoMs } }],
//   resultat? (msAvsluta), uppdaterad (serverns tid) }
// ============================================================================

import { simulera } from "./meteorstorm/ms-motor.js";
import { HANDLINGAR, RENDER_FORDROJNING_MS } from "./meteorstorm/ms-balans.js";
import { MS_STATUS_MS } from "./meteorstorm/ms-anrop.js";
import { minneOf, satt, refs, cfgFor, MINNE_SESSIONER } from "./meteorstorm-sess.js";

export const MS_LOGG_OVERLAPP_MS = 2000;

export const somHandling = (id, d) => ({ id, t: d.t, classId: d.classId, uid: d.uid, typ: d.typ, ...(d.mal ? { mal: d.mal } : {}) });

export function loggOf(deps, sid) {
  const m = minneOf(deps);
  let e = m.logg.get(sid);
  if (!e) satt(m.logg, sid, (e = { lista: new Map(), cursor: -Infinity, full: false }), MINNE_SESSIONER);
  return e;
}

export async function uppdateraLogg(deps, sid) {
  const e = loggOf(deps, sid);
  const col = refs(deps.db, sid).events;
  const snap = await (e.full ? col.where("t", ">=", e.cursor - MS_LOGG_OVERLAPP_MS) : col).get();
  for (const d of snap.docs) {
    const h = d.data();
    if (!HANDLINGAR.includes(h.typ) || !Number.isFinite(h.t)) continue;
    e.lista.set(d.id, somHandling(d.id, h));
    if (h.t > e.cursor) e.cursor = h.t;
  }
  e.full = true;
  return e;
}

export function laggTillLogg(deps, sid, id, h) {
  loggOf(deps, sid).lista.set(id, somHandling(id, h));
}

const runda = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

export function statusFran(cfg, handlingar, now) {
  const st = simulera({ ...cfg, handlingar }, Math.max(cfg.startMs, now - RENDER_FORDROJNING_MS));
  const h = st.handelser[0];
  return {
    tMs: now,
    visarMs: st.tMs,
    kvarMs: st.kvarMs,
    klart: st.klart,
    handelse: h ? { typ: h.typ, slutMs: h.slutMs } : null,
    stationer: st.stationer.map((x) => ({
      classId: x.classId, skrov: x.skrov, skold: runda(x.skold), laddning: runda(x.laddning, 2), skott: x.skott,
      nedskjutna: x.nedskjutna, flyter: x.flyter, hjalp: x.hjalp,
      drag: { tillaten: x.drag.tillaten, kostnad: x.drag.kostnad, armerad: x.drag.armerad, redoMs: x.drag.redoMs },
    })),
  };
}

export function statusUrMinnet(deps, sid, cfg, now) {
  const e = loggOf(deps, sid);
  return e.full ? statusFran(cfg, [...e.lista.values()], now) : null;
}

/**
 * Minnet släpper igenom ett försök per intervall och instans; statusdokumentets
 * tMs avgör mellan instanserna (transaktion).
 */
export async function kanskeStatus(deps, sid, s, now) {
  const m = minneOf(deps);
  if (now < (m.statusNasta.get(sid) ?? -Infinity)) return null;
  m.statusNasta.set(sid, now + MS_STATUS_MS);
  const r = refs(deps.db, sid);
  const cfg = cfgFor(s);
  return deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(r.status);
    const forra = snap.exists ? Number(snap.data().tMs) || 0 : 0;
    if (forra && now - forra < MS_STATUS_MS) {
      m.statusNasta.set(sid, forra + MS_STATUS_MS);
      return null;
    }
    const e = await uppdateraLogg(deps, sid);
    const status = statusFran(cfg, [...e.lista.values()], now);
    tx.set(r.status, { ...status, uppdaterad: deps.FieldValue.serverTimestamp() });
    return status;
  });
}
