// ============================================================================
// Kurragömma på SERVERN – rörelsekanalen i Realtime Database
// (functions/kurragomma-rtdb.js, #838). Spec §5.3: servern skriver roll, med,
// hand och status (och den FÖRSTA pos-posten för en ny sökare – pulsen för
// regeln "det finns alltid en sökare"); sökarna skriver sedan sin egen pos.
// Gömmarnas positioner skrivs ALDRIG här. database.rules.json nekar allt
// annat för klienterna. kgAvsluta tar bort /kg/{sid}.
//
// deps.rtdb = Admin SDK:s Database (index.js: getDatabaseWithUrl(kgDatabaseUrl())).
//
//   kgDatabaseUrl()                  → KG_DATABASE_URL | FIREBASE_CONFIG.databaseURL
//                                      | https://{projekt}-default-rtdb.europe-west1.firebasedatabase.app
//   starta(rtdb, sid, { sokare: [{ uid, x, z }], med, status, t })
//   laggTillMed(rtdb, sid, uid)
//   puls(rtdb, sid, uid, t)         pos/{uid}/t = t (startsökarna vid letfasens början)
//   nySokare(rtdb, sid, { uid, x, z, t, varGomd })   roll + status + första pos
//   handelse(rtdb, sid, h)           { typ, x, z, plats, t, namn?, hittad? } → hand/{autoId}
//   status(rtdb, sid, patch)         fas/lasta/gomda/sokare (tal patchas, okning() räknar upp)
//   okning(n)                        ServerValue-ökning (samma form i Admin SDK och klienten)
//   sokarPulser(rtdb, sid)           → [{ uid, t }] ur roll + pos (en liten läsning per tick)
//   rensaHand(rtdb, sid, nu)         händelser äldre än HAND_RENSA_MS tas bort
//   taBort(rtdb, sid)
// ============================================================================

import { HAND_RENSA_MS } from "./kurragomma/kg-config.js";

export function kgDatabaseUrl(env = process.env) {
  if (env.KG_DATABASE_URL) return env.KG_DATABASE_URL;
  let cfg = {};
  try {
    cfg = JSON.parse(env.FIREBASE_CONFIG || "{}");
  } catch {
    cfg = {};
  }
  if (cfg.databaseURL) return cfg.databaseURL;
  const projekt = cfg.projectId || env.GCLOUD_PROJECT || env.PROJECT_ID || "pluggportalen-so-2026";
  return `https://${projekt}-default-rtdb.europe-west1.firebasedatabase.app`;
}

export const okning = (n) => ({ ".sv": { increment: n } });

const rot = (rtdb, sid) => rtdb.ref(`kg/${sid}`);
const pos = (uid, x, z, t) => ({ x, z, yaw: 0, t });

export async function starta(rtdb, sid, { sokare, med, status, t }) {
  const roll = {};
  const posar = {};
  for (const s of sokare) {
    roll[s.uid] = "sokare";
    posar[s.uid] = pos(s.uid, s.x, s.z, t);
  }
  await rot(rtdb, sid).set({
    roll, med: Object.fromEntries(med.map((uid) => [uid, true])), pos: posar, status,
  });
}

export async function laggTillMed(rtdb, sid, uid) {
  await rot(rtdb, sid).update({ [`med/${uid}`]: true });
}

export async function puls(rtdb, sid, uid, t) {
  await rot(rtdb, sid).child(`pos/${uid}/t`).set(t);
}

export async function nySokare(rtdb, sid, { uid, x, z, t, varGomd }) {
  await rot(rtdb, sid).update({
    [`roll/${uid}`]: "sokare",
    [`med/${uid}`]: true,
    [`pos/${uid}`]: pos(uid, x, z, t),
    "status/sokare": okning(1),
    ...(varGomd ? { "status/gomda": okning(-1) } : {}),
  });
}

export async function handelse(rtdb, sid, h) {
  await rot(rtdb, sid).child("hand").push(h);
}

export async function status(rtdb, sid, patch) {
  await rot(rtdb, sid).child("status").update(patch);
}

/** Sökarnas pulser: pos.t för varje uid i roll (saknad pos = ingen puls). */
export async function sokarPulser(rtdb, sid) {
  const [rollSnap, posSnap] = await Promise.all([rot(rtdb, sid).child("roll").once("value"), rot(rtdb, sid).child("pos").once("value")]);
  const roll = rollSnap.val() || {};
  const posar = posSnap.val() || {};
  return Object.keys(roll).filter((uid) => roll[uid] === "sokare").map((uid) => ({ uid, t: Number(posar[uid]?.t) || null }));
}

export async function rensaHand(rtdb, sid, nu) {
  const snap = await rot(rtdb, sid).child("hand").orderByChild("t").endAt(nu - HAND_RENSA_MS).once("value");
  const bort = {};
  snap.forEach((c) => { bort[c.key] = null; });
  if (Object.keys(bort).length) await rot(rtdb, sid).child("hand").update(bort);
  return Object.keys(bort).length;
}

export async function taBort(rtdb, sid) {
  await rot(rtdb, sid).remove();
}
