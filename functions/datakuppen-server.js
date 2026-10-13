// ============================================================================
// Datakuppen 💾 – serverns GEMENSAMMA delar (#652): kistspelsservern med
// Datakuppens filtabell + referenser och små hjälpare som kodmodulen
// (datakuppen-koder.js) och hackmodulen (datakuppen-hack.js) delar.
// Översikten: datakuppen-core.js.
//
// API
//   SERVER        createKistServer(…) – answerQuestion, openChest, noteLeader,
//                 matchWindow, sessionOf, assertLive, parseSid, victimsOn
//   DK_FORMAT, DK_MODES, COL (samlingarna), HACK ("hack")
//   dkRefs(db, sid, uid) → kistmotorns refs + self(id?) (dkSelf) + secret(id?) (dkSecret)
//   joinedPlayer(snap, s) · pickRandom(list, rng) · parseUid(v, msg) · bad(msg) · isInt(v, lo, hi)
// ============================================================================

import { DK_RULES } from "./datakuppen/files-config.js";
import { DK_REGLER } from "./datakuppen/datakuppen-regler.js";
import { KsError } from "./kistspel-rattning.js";
import { createKistServer } from "./kistspel-core.js";

export const DK_FORMAT = "datakuppen";
export const DK_MODES = ["multiplication_0_10", "plugga_quiz"];

export const COL = { players: "dkPlayers", private: "dkPrivate", public: "dkPublic", meta: "dkMeta", events: "dkEvents" };
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const HACK = "hack"; // filens id = hackets markör i pending/händelser

export const SERVER = createKistServer({
  format: DK_FORMAT,
  regler: DK_REGLER,
  rules: DK_RULES,
  collections: COL,
  fallbackChest: "mapp",
  toggle: "hacking",
  texts: {
    wrongFormat: "Det här är ingen Datakupp.",
    modeUnsupported: "Spelläget stöds inte i Datakuppen.",
    pendingFirst: "Hacka klart först.",
    noPending: "Det finns inget hack att välja mål för.",
  },
});

const { refs } = SERVER;

export const bad = (msg) => new KsError("invalid-argument", msg);
export const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function parseUid(v, msg) {
  if (v === null) return null;
  if (typeof v !== "string" || !UID_RE.test(v)) throw bad(msg);
  return v;
}

export function dkRefs(db, sid, uid) {
  const r = refs(db, sid, uid);
  return {
    ...r,
    self: (id = uid) => r.sess.collection("dkSelf").doc(id),
    secret: (id = uid) => r.sess.collection("dkSecret").doc(id),
  };
}

export const pickRandom = (list, rng) => list[Math.min(list.length - 1, Math.floor((Number(rng()) || 0) * list.length))];

export function joinedPlayer(snap, s) {
  const p = snap.exists ? snap.data() : null;
  if (!p || !(s.participatingClassIds || []).includes(p.classId)) {
    throw new KsError("permission-denied", "Gå med i matchen först.");
  }
  return p;
}
