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
//                         åt eleven om koden saknas eller förslagen efter ett
//                         hack/en läcka gått ut (#832 §6.1 – återinfört efter #719)
//   giveOffers(tx, r, uid, sec, { all, rng, Timestamp, t, orsak, extra? }) → "Välj ny
//                         kod": 4 förslag (aldrig en tidigare egen kod eller
//                         någons aktuella), ~10 s, orsak "hack" | "lacka"
//
// KODBYTET (#832 §6.5): ny kod → codeVersion + 1 (minnet mot eleven börjar om
// för alla), kodKannsAv töms, den gamla koden läggs i tidigareKoder.
// dkSecret: { code, codeVersion, offers, offersExpiresAt, tidigareKoder,
// kodKannsAv, felIRad, virusFor, hacks, hack } – dkSelf speglar BARA code,
// codeVersion, offers, offersExpiresAt, kodbyte (aldrig räknarna).
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

const expired = (sec, t) => toMs(sec?.offersExpiresAt) != null && t >= toMs(sec.offersExpiresAt);

/** Koder eleven inte får få: andras aktuella + alla egna tidigare (§6.5). */
function hardAvoid(all, uid, sec) {
  const { codes, offers, decoys } = avoidSets(all, uid);
  const mine = [...(sec?.tidigareKoder || []), sec?.code].filter(Boolean);
  return [new Set([...codes, ...mine]), offers, decoys];
}

/** Ny aktuell kod: codeVersion + 1 (minnet mot eleven nollställs), förslagen bort. */
function writeCode(tx, r, uid, sec, code, Timestamp, t) {
  const st = {
    uid, code, codeVersion: (Number(sec?.codeVersion) || 0) + 1, offers: null, offersExpiresAt: null,
    codeAt: Timestamp.fromMillis(t), kodbyte: null,
  };
  const tidigareKoder = sec?.code ? [...new Set([...(sec.tidigareKoder || []), sec.code])] : sec?.tidigareKoder || [];
  tx.set(r.secret(uid), { ...st, tidigareKoder, kodKannsAv: [] }, { merge: true });
  tx.set(r.self(uid), st, { merge: true });
  return { ...sec, ...st, tidigareKoder, kodKannsAv: [] };
}

/**
 * Elevens kod när någon behöver den (matchen igång): saknas den, eller har
 * förslagen efter ett hack/en läcka gått ut, väljer servern nu.
 */
export function ensureCode(tx, r, uid, sec, { all, rng, Timestamp, t }) {
  if (sec?.code && !(sec.offers && expired(sec, t))) return sec;
  const code = sec?.offers?.length ? pickRandom(sec.offers, rng)
    : codeOffers(DK_CODES, hardAvoid(all, uid, sec), rng, 1, sec?.code ?? null)[0];
  return writeCode(tx, r, uid, sec, code, Timestamp, t);
}

/** "Välj ny kod" (efter hack eller läcka): fyra förslag, ~10 s, sedan väljer servern. */
export function giveOffers(tx, r, uid, sec, { all, rng, Timestamp, t, orsak, extra = {} }) {
  const fresh = {
    offers: codeOffers(DK_CODES, hardAvoid(all, uid, sec), rng, DK_RULES.codeOffers, sec?.code ?? null),
    offersExpiresAt: Timestamp.fromMillis(t + DK_RULES.codePickMs),
    kodbyte: { orsak, at: Timestamp.fromMillis(t) },
  };
  tx.set(r.secret(uid), { ...fresh, ...extra }, { merge: true });
  tx.set(r.self(uid), fresh, { merge: true });
  return { ...sec, ...fresh, ...extra };
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
      // Lobbyn, eller "Välj ny kod" efter ett hack/en läcka (#832 §6.1).
      if (sec.code && started && expired(sec, t)) {
        return state(ensureCode(tx, r, uid, sec, { all, rng, Timestamp, t }), { auto: true });
      }
      const code = sec.offers?.[index];
      if (!sec.offers) throw new KsError("failed-precondition", "Det finns inga kodförslag att välja just nu.");
      if (!code) throw bad("Välj en av kodförslagen.");
      return state(writeCode(tx, r, uid, sec, code, Timestamp, t));
    }
    // Matchen igång utan kod, eller förslagen har gått ut → servern väljer.
    if (started && (!sec.code || (sec.offers && expired(sec, t)))) {
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
