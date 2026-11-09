// ============================================================================
// Datakuppen 💾 – FILEN på servern (#832, uppdraget datakuppen-klassradet.md
// §3–§4). Samma flöde och spärrar som kistmotorns openChest (functions/
// kistspel-core.js), men med Datakuppens egen slump och effekt
// (./datakuppen/dk-filregler.js) – Guldrushen använder motorn orörd.
//   • Viruset finns bara i tabellen när svaret kom efter en felsvit:
//     dkSecret/{uid}.virusFor === attemptId (FELSVIT i datakuppen-server.js).
//   • Viruset tar fast 10–20 MB (aldrig under 0) och skrivs INTE i
//     händelseflödet (§15) – bara i lärarens räknare.
//   • Superservern (1 %, 1000 MB) skrivs i flödet och räknas.
// Översikten: datakuppen-core.js.
//
// API
//   openFile(deps, uid, { sid, attemptId, fileIndex }) → { file, kind, delta,
//     gold, protectedUntil (ms | null), pending?, virusMb? }
// ============================================================================

import { DK_RULES } from "./datakuppen/files-config.js";
import { isVictimKind, shieldUntil } from "./datakuppen/datakuppen-regler.js";
import { rollFile, applyFile } from "./datakuppen/dk-filregler.js";
import { KsError } from "./kistspel-rattning.js";
import { toMs } from "./kistspel/ks-regler.js";
import { SERVER, dkRefs, bumpStats, bad, isInt } from "./datakuppen-server.js";

const { sessionOf, assertLive, parseSid, victimsOn, noteLeader } = SERVER;
const ATTEMPT_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function openFile(deps, uid, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const rng = deps.rng || Math.random;
  const sid = parseSid(raw);
  const attemptId = raw?.attemptId;
  if (typeof attemptId !== "string" || !ATTEMPT_RE.test(attemptId)) throw bad("Svarets id saknas.");
  const fileIndex = raw?.fileIndex ?? 0;
  if (!isInt(fileIndex, 0, DK_RULES.chestsOffered - 1)) throw bad("Välj en av filerna.");
  const r = dkRefs(db, sid, uid);
  const out = await db.runTransaction(async (tx) => {
    const [sSnap, gSnap, aSnap, secSnap] = await tx.getAll(r.sess, r.gp, r.answer(attemptId), r.secret());
    const s = sessionOf(sSnap);
    const t = now();
    assertLive(s, t);
    const a = aSnap.exists ? aSnap.data() : null;
    if (!a || a.uid !== uid || a.format !== "datakuppen") {
      throw new KsError("permission-denied", "Filen hör inte till något av dina svar.");
    }
    if (a.isCorrect !== true) throw new KsError("failed-precondition", "Bara ett rätt svar ger en fil.");
    if (a.chest) throw new KsError("already-exists", "Den filen är redan öppnad.");
    const g = gSnap.data();
    if (g.pending) throw new KsError("failed-precondition", "Hacka klart först.");
    const last = toMs(g.lastChestAt);
    if (last != null && t - last < DK_RULES.minChestGapMs) throw new KsError("resource-exhausted", "En fil i taget!");
    const virus = secSnap.exists && secSnap.data().virusFor === attemptId;
    const file = rollFile({ hacking: victimsOn(s), virus }, rng);
    const kind = file.effect.kind;
    const stamp = Timestamp.fromMillis(t);
    tx.update(r.answer(attemptId), { chest: file.id, chestIndex: fileIndex, chestAt: FieldValue.serverTimestamp() });
    if (virus) tx.set(r.secret(), { virusFor: null }, { merge: true });
    if (isVictimKind(file)) {
      const pending = { kind, chest: file.id, attemptId, at: stamp, expiresAt: Timestamp.fromMillis(t + DK_RULES.victimPickMs) };
      tx.update(r.gp, { pending, chests: FieldValue.increment(1), lastChestAt: stamp });
      return {
        file: file.id, kind, delta: 0, gold: g.gold, protectedUntil: toMs(g.protectedUntil),
        pending: { kind, expiresAtMs: t + DK_RULES.victimPickMs },
      };
    }
    const eff = applyFile(file, g.gold, rng);
    const until = eff.protect ? shieldUntil(t) : toMs(g.protectedUntil);
    tx.update(r.gp, {
      gold: eff.gold, chests: FieldValue.increment(1), lastChestAt: stamp,
      ...(eff.protect ? { protectedUntil: Timestamp.fromMillis(until) } : {}),
    });
    if (kind === "lose") bumpStats(tx, r, FieldValue, "virus");
    else {
      if (file.id === "superserver") bumpStats(tx, r, FieldValue, "superservrar");
      tx.create(r.events.doc(), {
        type: "chest", chest: file.id, uid, name: g.name, classId: g.classId,
        amount: eff.delta, gold: eff.gold, at: FieldValue.serverTimestamp(),
      });
    }
    return {
      file: file.id, kind, delta: eff.delta, gold: eff.gold, protectedUntil: until,
      ...(eff.virusMb != null ? { virusMb: eff.virusMb } : {}),
    };
  });
  if (out.delta) await noteLeader(deps, sid).catch(() => null);
  return out;
}
