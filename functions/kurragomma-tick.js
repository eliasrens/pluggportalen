// ============================================================================
// Kurragömma på SERVERN – kgTick (functions/kurragomma-tick.js, #838)
// ----------------------------------------------------------------------------
// Värdlärarens projektor anropar var TICK_MS. Spec §5.2: fasbytet (redo),
// tystnadsregeln, regeln "det finns alltid en sökare", städning av hand och
// slutet (kgAvsluta när tiden är ute eller alla är hittade). Idempotent: varje
// steg läser färskt i en transaktion, och ett anrop som inte hittar något
// kostar en läsning, inte 25:
//   • tystnaden frågar kgPlayers där tystRef < nu − TYSTNAD_MS (fältet finns
//     bara hos gömda; svar/vissling flyttar det fram). Pulsen (players.lastSeenAt)
//     och gömstället (kgSecret) läses bara för kandidaterna.
//   • sökarnas pulser läses ur Realtime Database (pos.t – servern skriver den
//     första posten när någon blir sökare, klienten pulsar minst var POS_PULS_MS),
//     så regeln kostar inga Firestore-läsningar.
//
//   tick(deps, auth, raw) → { fas, klart, visslade, nySokare, rensade, result?, avslutade? }
//     avslutade: true bara i DET anrop som avslutade matchen (klassbonusen, #839 N5);
//     en redan avslutad match svarar klart: true, avslutade: false.
//   Tystnadsvisslingen skrivs i hand under en i förväg vald nyckel och samma id
//     läggs i den visslades kgPlayers.tystVissling (bara visslingsgrenen – tystRef
//     flyttas även utan vissling) så eleven känner igen sin egen vissling på id:t,
//     aldrig på en tidsstämpel (#839 N1b). Händelsen bär aldrig uid.
// ============================================================================

import { KsError } from "./kistspel-rattning.js";
import { tystnadVisslar, arFrankopplad, behoverNySokare, valjSlumpade, arSlut } from "./kurragomma/kg-regler.js";
import { TYSTNAD_MS, FRANKOPPLAD_MS } from "./kurragomma/kg-config.js";
import { toMs } from "./kistspel/ks-regler.js";
import { refs, parseSid, tider, playerFor, instFor, namnFor, larareFor, gomdaKvar } from "./kurragomma-sess.js";
import { redo, gorTillSokare } from "./kurragomma-fas.js";
import { avslutaIntern } from "./kurragomma-resultat.js";
import { visslaGomd } from "./kurragomma-vissling.js";
import * as rt from "./kurragomma-rtdb.js";

/** Tystnadsregeln (spec §1.3): gömda utan svar på TYSTNAD_MS visslar – inte frånkopplade. Visslingen: kurragomma-vissling.js. */
async function tystnad(deps, sid, s, nu) {
  const { db } = deps;
  const r = refs(db, sid);
  const { letStart } = tider(s);
  const kand = await r.kgPlayers.where("tystRef", "<", nu - TYSTNAD_MS).get();
  let visslade = 0;
  for (const d of kand.docs) {
    const [puls, sec] = await db.getAll(r.player(d.id), r.secret(d.id));
    const pulsAt = toMs(puls.data()?.lastSeenAt);
    const sd = sec.data();
    const kp = d.data();
    if (kp.roll !== "gomd" || !sd?.gomd) continue;
    const ref = Math.max(Number(kp.senastSvarAt) || 0, Number(sd.senastVisslingAt) || 0, letStart || 0);
    const visslar = tystnadVisslar({
      roll: kp.roll, fas: s.kgFas, tystnadPa: true, senastSvarAt: kp.senastSvarAt, senastVisslingAt: sd.senastVisslingAt, letStartAt: letStart, pulsAt, nu,
    });
    const { ev } = await visslaGomd(deps, sid, s, {
      uid: d.id, nu, event: { tyst: true },
      far: (kp2) => (visslar && (Number(kp2.tystRef) || 0) < nu - TYSTNAD_MS ? true : "inte-tyst"),
      // Inte tyst länge nog, eller frånkopplad: flytta fram referensen så kandidaten
      // inte läses varje tick (frånkopplad → prövas igen om TYSTNAD_MS).
      farPatch: (kp2) => ({ tystRef: arFrankopplad(pulsAt, nu) ? nu : Math.max(ref, Number(kp2.tystRef) || 0) }),
    });
    if (ev) visslade++;
  }
  return visslade;
}

/**
 * Regeln "det finns alltid en sökare" (spec §1.1): ingen sökare med puls → en slumpad
 * gömmare blir sökare. Idempotent: pulserna läses utanför transaktionen, så sessionens
 * kgNySokareAt (sätts i transaktionen) spärrar samtidiga ticks – en ny sökare räknas
 * som vid liv i FRANKOPPLAD_MS innan regeln får slå till igen.
 */
async function alltidEnSokare(deps, sid, s, nu, gomdaKvar) {
  const { db, FieldValue } = deps;
  const r = refs(db, sid);
  const pulser = await rt.sokarPulser(deps.rtdb, sid);
  if (!behoverNySokare({ fas: s.kgFas, sokare: pulser.map((p) => ({ pulsAt: p.t })), gomdaKvar, nu })) return null;
  const gomda = (await r.kgPlayers.where("roll", "==", "gomd").get()).docs.map((d) => d.id).sort();
  const [vald] = valjSlumpade(gomda, 1, deps.rng);
  if (!vald) return null;
  const { letStart } = tider(s);
  const ut = await db.runTransaction(async (tx) => {
    const [k, sec, sd] = await tx.getAll(r.kgPlayer(vald), r.secret(vald), r.sess);
    const kp = k.data();
    const senast = Number(sd.data()?.kgNySokareAt) || 0;
    if (!kp || kp.roll !== "gomd" || nu - senast < FRANKOPPLAD_MS) return null;
    tx.update(r.sess, { kgNySokareAt: nu });
    const pl = gorTillSokare(tx, r, { uid: vald, kp, sec: sec.data(), nu, letStart, FieldValue });
    tx.create(r.events.doc(), { t: nu, typ: "nySokare", x: pl.x, z: pl.z, plats: pl.plats, sokare: vald });
    return { uid: vald, namn: namnFor(s, kp.name), ...pl };
  });
  if (!ut) return null;
  await rt.nySokare(deps.rtdb, sid, { uid: ut.uid, x: ut.x, z: ut.z, t: nu, varGomd: true });
  await rt.handelse(deps.rtdb, sid, { typ: "nySokare", x: ut.x, z: ut.z, plats: ut.plats, t: nu, namn: ut.namn });
  return ut.uid;
}

export async function tick(deps, auth, raw) {
  const sid = parseSid(raw);
  let s = await redo(deps, sid);
  if (!larareFor(deps.roll ? await deps.roll(auth) : null, s)) await playerFor(deps, sid, auth?.uid, s);
  const nu = deps.now();
  if (s.status !== "live") return { fas: s.kgFas, klart: true, result: s.result || null, avslutade: false };
  const { slut } = tider(s);
  const kvar = s.kgFas === "leta" ? await gomdaKvar(deps, sid) : null;
  if (arSlut({ fas: s.kgFas, nu, slutAt: slut, gomdaKvar: kvar })) {
    const { result, redan } = await avslutaIntern(deps, sid, s, { nu });
    return { fas: s.kgFas, klart: true, result, avslutade: !redan };
  }
  const ut = { fas: s.kgFas, klart: false, visslade: 0, nySokare: null, rensade: 0 };
  if (s.kgFas === "leta") {
    if (instFor(s).tystnad) ut.visslade = await tystnad(deps, sid, s, nu);
    ut.nySokare = await alltidEnSokare(deps, sid, s, nu, kvar);
    ut.rensade = await rt.rensaHand(deps.rtdb, sid, nu);
  }
  if (!s.kgFas) throw new KsError("failed-precondition", "Matchen har inte startat.");
  return ut;
}
