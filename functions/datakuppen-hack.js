// ============================================================================
// Datakuppen 💾 – HACKET på servern (#652, spec §1.4–§1.6): välj mål →
// knäck koden bland tre. Minnesmomentet per par (hackare, mål) i
// dkSecret/{hackare}.hacks[mål]. Översikten: datakuppen-core.js.
//
// API
//   chooseTarget(deps, uid, { sid, targetUid? }) → { result: "target", targetUid,
//     targetName, options[3], expiresAtMs, auto } | { result: "fallback", file, delta, gold }
//   guessCode(deps, uid, { sid, index?, targetUid? }) → { result: "hacked"|"wrong"|
//     "timeout"|"changed"|"protected", targetUid, amount?, gold?, code?, left? }
// ============================================================================

import { DK_RULES } from "./datakuppen/files-config.js";
import { DK_REGLER, pickDecoys, hackOptions } from "./datakuppen/datakuppen-regler.js";
import { KsError } from "./kistspel-rattning.js";
import { toMs } from "./kistspel/ks-regler.js";
import { SERVER, COL, HACK, dkRefs, pickRandom, parseUid, bad, isInt } from "./datakuppen-server.js";
import { DK_CODES, secretsOf, avoidSets, ensureCode } from "./datakuppen-koder.js";

const { sessionOf, assertLive, parseSid, victimsOn, noteLeader } = SERVER;
const {
  chestById, applySelfEffect, victimProblem, victimMessage, eligibleVictims, resolveVictim,
  hitProtectionUntil, isProtected,
} = DK_REGLER;

function hackPending(g, texts = "Det finns inget hack att välja mål för.") {
  const p = g?.pending;
  if (!p || p.chest !== HACK) throw new KsError("failed-precondition", texts);
  return p;
}

export async function chooseTarget(deps, uid, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const rng = deps.rng || Math.random;
  const sid = parseSid(raw);
  const asked = parseUid(raw?.targetUid ?? null, "Ogiltig klasskamrat.");
  const r = dkRefs(db, sid, uid);

  const pre = hackPending((await r.gp.get()).data());
  if (pre.targetUid) throw new KsError("failed-precondition", "Du har redan valt vem du hackar.");
  const late = now() > toMs(pre.expiresAt) + DK_RULES.victimGraceMs;
  const auto = asked === null || late;
  let target = asked;
  if (auto) {
    const players = (await r.sess.collection(COL.players).get()).docs.map((d) => d.data());
    const cands = eligibleVictims("steal", (await r.gp.get()).data(), players, now());
    target = cands.length ? pickRandom(cands, rng).uid : null;
  }
  const all = await secretsOf(r);

  const out = await db.runTransaction(async (tx) => {
    const [sSnap, gSnap, mySnap, ...vSnaps] = await tx.getAll(r.sess, r.gp, r.secret(),
      ...(target ? [r.gpOf(target), r.secret(target)] : []));
    const s = sessionOf(sSnap);
    const t = now();
    assertLive(s, t);
    const g = gSnap.data();
    const pending = hackPending(g);
    if (pending.targetUid) throw new KsError("failed-precondition", "Du har redan valt vem du hackar.");
    const v = vSnaps[0]?.exists ? vSnaps[0].data() : null;
    const problem = !victimsOn(s) ? "av" : victimProblem("steal", g, v, t);
    if (problem && !auto && problem !== "av") {
      // Nekat val: pending ligger kvar – hackaren väljer om (tiden går vidare).
      throw new KsError(problem === "saknas" ? "not-found" : "failed-precondition", victimMessage(problem, v));
    }
    const at = FieldValue.serverTimestamp();
    if (problem) {
      // Ingen kan väljas (eller hackning av) → filens fallback (Mapp).
      const fb = chestById(chestById(pending.chest)?.fallback) || chestById("mapp");
      const eff = applySelfEffect(fb, g.gold);
      tx.update(r.gp, { gold: eff.gold, pending: null });
      tx.create(r.events.doc(), {
        type: "chest", chest: fb.id, fallbackFrom: pending.chest, uid, name: g.name, classId: g.classId,
        amount: eff.delta, gold: eff.gold, at,
      });
      return { result: "fallback", file: fb.id, delta: eff.delta, gold: eff.gold };
    }

    // Målets kod (väljs nu om den saknas / förslagen gått ut) + minnet för paret.
    const cur = ensureCode(tx, r, v.uid, vSnaps[1].exists ? vSnaps[1].data() : {}, { all, rng, Timestamp, t });
    const { codes, offers } = avoidSets(all, v.uid);
    const strict = new Set([...codes, cur.code]);
    const my = mySnap.exists ? mySnap.data() : {};
    let mem = my.hacks?.[v.uid];
    if (!mem || mem.codeVersion !== cur.codeVersion) {
      mem = { codeVersion: cur.codeVersion, decoys: pickDecoys(DK_CODES, cur.code, { strict, soft: offers }, rng), struck: [], shown: [] };
    } else {
      // En lockkod som nu är någons aktuella kod byts ut (aldrig avslöja andras koder).
      const keep = mem.decoys.filter((d) => !strict.has(d));
      if (keep.length < mem.decoys.length) {
        const extra = pickDecoys(DK_CODES, cur.code, { strict: new Set([...strict, ...keep]), soft: offers }, rng,
          mem.decoys.length - keep.length);
        mem = { ...mem, decoys: [...keep, ...extra], struck: (mem.struck || []).filter((c) => keep.includes(c)) };
      }
    }
    const options = hackOptions(cur.code, mem.decoys, mem.struck, rng, mem.shown);
    const expiresAt = t + DK_RULES.codeGuessMs;
    const hack = { targetUid: v.uid, targetName: v.name, options, expiresAt: Timestamp.fromMillis(expiresAt) };
    tx.update(r.gp, {
      pending: { ...pending, stage: "guess", targetUid: v.uid, targetName: v.name, guessExpiresAt: hack.expiresAt },
      lastVictimUid: v.uid, hackAttempts: FieldValue.increment(1),
    });
    tx.set(r.secret(), { uid, hacks: { [v.uid]: { ...mem, shown: options } }, hack: { ...hack, codeVersion: cur.codeVersion } }, { merge: true });
    tx.set(r.self(), { uid, hack }, { merge: true });
    return { result: "target", targetUid: v.uid, targetName: v.name, options, expiresAtMs: expiresAt, auto };
  });
  if (out.delta) await noteLeader(deps, sid).catch(() => null);
  return out;
}

// --- Hacket, steg 2: koden ---------------------------------------------------------

export async function guessCode(deps, uid, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const now = deps.now || Date.now;
  const sid = parseSid(raw);
  const index = raw?.index ?? null;
  if (index !== null && !isInt(index, 0, DK_RULES.codeOptions - 1)) throw bad("Välj en av koderna.");
  const asked = parseUid(raw?.targetUid ?? null, "Ogiltig klasskamrat.");
  const r = dkRefs(db, sid, uid);

  const out = await db.runTransaction(async (tx) => {
    const [sSnap, gSnap, mySnap] = await tx.getAll(r.sess, r.gp, r.secret());
    const s = sessionOf(sSnap);
    const t = now();
    assertLive(s, t);
    const g = gSnap.data();
    const pending = hackPending(g, "Det finns inget hack att gissa på.");
    const my = mySnap.exists ? mySnap.data() : {};
    const hack = my.hack;
    if (pending.stage !== "guess" || !hack || hack.targetUid !== pending.targetUid) {
      throw new KsError("failed-precondition", "Välj först vem du ska hacka.");
    }
    if (asked !== null && asked !== hack.targetUid) throw new KsError("permission-denied", "Du hackar inte den eleven.");
    const [vSnap, vsSnap] = await tx.getAll(r.gpOf(hack.targetUid), r.secret(hack.targetUid));
    const v = vSnap.exists ? vSnap.data() : null;
    const vs = vsSnap.exists ? vsSnap.data() : {};

    // Hackförsöket är förbrukat oavsett utfall: EN gissning per försök.
    const done = (extra = {}) => {
      tx.update(r.gp, { pending: null, ...extra });
      tx.set(r.self(), { hack: null }, { merge: true });
    };
    if (index === null || t > toMs(hack.expiresAt) + DK_RULES.victimGraceMs) {
      done();
      tx.set(r.secret(), { hack: null }, { merge: true });
      return { result: "timeout", targetUid: hack.targetUid };
    }
    if (index >= hack.options.length) throw bad("Välj en av koderna.");
    if (!v || vs.codeVersion !== hack.codeVersion) {
      done();
      tx.set(r.secret(), { hack: null }, { merge: true });
      return { result: "changed", targetUid: hack.targetUid };
    }
    if (isProtected(v, t)) {
      done();
      tx.set(r.secret(), { hack: null }, { merge: true });
      return { result: "protected", targetUid: hack.targetUid, message: victimMessage("skyddad", v) };
    }
    const guess = hack.options[index];
    if (guess !== vs.code) {
      // Fel kod: inget flyttas, koden stryks för just det här paret.
      const mem = my.hacks?.[hack.targetUid] || { codeVersion: hack.codeVersion, decoys: [], struck: [], shown: [] };
      const struck = [...new Set([...(mem.struck || []), guess])];
      done();
      tx.set(r.secret(), { hack: null, hacks: { [hack.targetUid]: { ...mem, struck } } }, { merge: true });
      return { result: "wrong", targetUid: hack.targetUid, code: guess, left: hack.options.length - 1 };
    }
    // Rätt kod: 15 % flyttas i EN transaktion och målet skyddas 30 s. Koden
    // ligger KVAR (#719) – den som minns den kan hacka igen när skyddet är slut.
    const res = resolveVictim("steal", g, v);
    done({ gold: res.thiefGold, hackSuccess: FieldValue.increment(1) });
    tx.set(r.secret(), { hack: null }, { merge: true });
    tx.update(r.gpOf(v.uid), {
      gold: res.victimGold, protectedUntil: Timestamp.fromMillis(hitProtectionUntil(v, t)),
      lastHit: { kind: "steal", chest: HACK, byUid: uid, byName: g.name, amount: res.amount, at: Timestamp.fromMillis(t) },
    });
    tx.create(r.events.doc(), {
      type: "steal", chest: HACK, uid, name: g.name, classId: g.classId,
      victimUid: v.uid, victimName: v.name, victimClassId: v.classId,
      amount: res.amount, gold: res.thiefGold, victimGold: res.victimGold, at: FieldValue.serverTimestamp(),
    });
    return {
      result: "hacked", targetUid: v.uid, amount: res.amount, delta: res.thiefGold - g.gold,
      gold: res.thiefGold, victimGold: res.victimGold,
    };
  });
  if (out.amount) await noteLeader(deps, sid).catch(() => null);
  return out;
}
