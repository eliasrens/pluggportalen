// ============================================================================
// Datakuppen 💾 – KODERNA på servern (#652, spec §1.2 + §1.5). Bara ur listan
// (./datakuppen/koder.json); eleven skickar aldrig en egen kod, bara ett index
// i sina förslag. Kod, förslag och lockkoder ligger i dkSecret/{uid} (BARA
// servern läser); dkSelf/{uid} är elevens egen spegel (bara eleven läser).
// Översikten: datakuppen-core.js.
//
// API
//   DK_CODES                         listans giltiga koder
//   pickCode(deps, uid, { sid, index? }) → { code, offers, expiresAtMs, auto? }
//   secretsOf(r) → Map uid → dkSecret-data (läses utanför transaktionen)
//   avoidSets(all, uid) → { codes, offers, decoys } – andras aktuella koder,
//                         andras utestående förslag, alla lockkoder
//   ensureCode(tx, r, uid, sec, { all, rng, Timestamp, t }) → kodläget; väljer
//                         åt eleven om koden saknas (#719: koden behålls sedan
//                         hela matchen – inget kodbyte efter ett hack)
// ============================================================================

import { readFileSync } from "node:fs";
import { DK_RULES } from "./datakuppen/files-config.js";
import { codeList, codeOffers } from "./datakuppen/datakuppen-regler.js";
import { KsError } from "./kistspel-rattning.js";
import { toMs } from "./kistspel/ks-regler.js";
import { SERVER, dkRefs, joinedPlayer, pickRandom, bad, isInt } from "./datakuppen-server.js";

const { sessionOf, parseSid, matchWindow } = SERVER;

export const DK_CODES = Object.freeze(codeList(JSON.parse(
  readFileSync(new URL("./datakuppen/koder.json", import.meta.url), "utf8"))));

/** Alla spelares hemliga dokument (läses UTANFÖR transaktionen) → Map uid → data. */
export async function secretsOf(r) {
  const snap = await r.sess.collection("dkSecret").get();
  return new Map(snap.docs.map((d) => [d.id, d.data()]));
}

/** Koder att undvika, i prioritetsordning: andras aktuella, andras förslag, lockkoder. */
export function avoidSets(all, uid) {
  const codes = new Set();
  const offers = new Set();
  const decoys = new Set();
  for (const [id, sec] of all) {
    if (id !== uid) {
      if (sec.code) codes.add(sec.code);
      for (const c of sec.offers || []) offers.add(c);
    }
    for (const m of Object.values(sec.hacks || {})) for (const c of m?.decoys || []) decoys.add(c);
  }
  return { codes, offers, decoys };
}

/** Elevens kod (en gång per match): codeVersion + 1, förslagen bort. */
function writeCode(tx, r, uid, sec, code, Timestamp, t) {
  const st = { uid, code, codeVersion: (Number(sec?.codeVersion) || 0) + 1, offers: null, offersExpiresAt: null, codeAt: Timestamp.fromMillis(t) };
  tx.set(r.secret(uid), st, { merge: true });
  tx.set(r.self(uid), st, { merge: true });
  return st;
}

/**
 * Elevens kod när någon behöver den (matchen igång): saknas den väljer
 * servern nu (bland lobbyns förslag om de finns). Finns den behålls den.
 */
export function ensureCode(tx, r, uid, sec, { all, rng, Timestamp, t }) {
  if (sec?.code) return sec;
  const { codes, offers, decoys } = avoidSets(all, uid);
  const code = sec?.offers?.length ? pickRandom(sec.offers, rng)
    : codeOffers(DK_CODES, [codes, offers, decoys], rng, 1, sec?.code ?? null)[0];
  return writeCode(tx, r, uid, sec, code, Timestamp, t);
}

export async function pickCode(deps, uid, raw) {
  const { db, Timestamp } = deps;
  const now = deps.now || Date.now;
  const rng = deps.rng || Math.random;
  const sid = parseSid(raw);
  const index = raw?.index ?? null;
  if (index !== null && !isInt(index, 0, DK_RULES.codeOffers - 1)) throw bad("Välj en av kodförslagen.");
  const r = dkRefs(db, sid, uid);
  const pSnap = await r.player.get();
  const all = await secretsOf(r);
  return db.runTransaction(async (tx) => {
    const [sSnap, secSnap] = await tx.getAll(r.sess, r.secret());
    const s = sessionOf(sSnap);
    const t = now();
    const w = matchWindow(s);
    if (!(s.status === "lobby" || (s.status === "live" && w && t < w.end))) {
      throw new KsError("failed-precondition", s.status === "live" ? "Tiden är ute! ⏰" : "Matchen pågår inte.");
    }
    joinedPlayer(pSnap, s);
    const sec = secSnap.exists ? secSnap.data() : {};
    const started = s.status === "live";
    const state = (st, extra = {}) => ({
      code: st.code ?? null, offers: st.offers ?? null, expiresAtMs: toMs(st.offersExpiresAt), ...extra,
    });
    if (index !== null) {
      // #719: koden väljs EN gång (lobbyn/vid start) och gäller hela matchen.
      if (sec.code) throw new KsError("failed-precondition", "Du har redan din kod – den gäller hela matchen.");
      const code = sec.offers?.[index];
      if (!sec.offers) throw new KsError("failed-precondition", "Det finns inga kodförslag att välja just nu.");
      if (!code) throw bad("Välj en av kodförslagen.");
      return state(writeCode(tx, r, uid, sec, code, Timestamp, t));
    }
    // Matchen igång utan kod → servern väljer.
    if (started && !sec.code) {
      return state(ensureCode(tx, r, uid, sec, { all, rng, Timestamp, t }), { auto: true });
    }
    if (sec.offers || sec.code) return state(sec);
    // Lobbyn: fyra förslag, olika varandra och helst inte tagna i matchen.
    const { codes, offers, decoys } = avoidSets(all, uid);
    const st = { uid, offers: codeOffers(DK_CODES, [codes, offers, decoys], rng, DK_RULES.codeOffers), offersExpiresAt: null, codeVersion: 0 };
    tx.set(r.secret(), st, { merge: true });
    tx.set(r.self(), st, { merge: true });
    return state(st);
  });
}
