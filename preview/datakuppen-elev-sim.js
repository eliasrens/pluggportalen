// ============================================================================
// Förhandsvisning (#653): LÅTSASSERVER för Datakuppens elevvy – samma API som
// src/live/formats/datakuppen/datakuppen-data.js, men i minnet och med
// formatets DELADE regler (filtabellen, skyddet, koderna, lockkoderna,
// minnesmomentet). Ingen Firestore, inga riktiga koder, inga pluggmynt.
// Används bara av preview/preview-datakuppen-elev.html.
//
// Demoläget (#655, preview-datakuppen-demolage.html): shared:true → `me` och
// `players` är projektordemons EGNA spelardokument (inga kopior) – data som
// flyttas här syns direkt på projektorn; onAction(kind, data) berättar vad som
// hände så att projektorn kan skriva händelsen: "fil" { file, delta, gold },
// "hack" { targetUid, amount }, "fel" { targetUid }, "hackad" { byUid, amount }.
//
// API
//   createSim({ codes, me, players, latency(), forced(), shared?, onAction? }) → {
//     api,                    datakuppen-data.js-formen (answer, openFile, …)
//     state,                  { me, players, self, secret }
//     hackMe(byUid),          en klasskamrat knäcker min kod (notis + ny kod)
//     protect(uid, ms),       skydda en kamrat
//     emit()                  skicka nya ögonblicksbilder
//   }
// ============================================================================

import { DK_RULES } from "../src/live/formats/datakuppen/delat/files-config.js";
import {
  chestById, rollChest, applySelfEffect, shieldUntil, hitProtectionUntil, victimProblem, victimMessage, eligibleVictims,
  resolveVictim, codeOffers, pickDecoys, hackOptions,
} from "../src/live/formats/datakuppen/delat/datakuppen-regler.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const err = (code, message) => Object.assign(new Error(message), { code });

export function createSim({
  codes, me, players, latency = () => 150, forced = () => null, phase = () => "live", quiz = null, shared = false, onAction = () => {},
}) {
  const now = () => Date.now();
  const secret = {}; // uid → kod (bara "servern")
  const memory = {}; // mål → { version, decoys, struck, shown }
  const versions = {};
  const taken = () => new Set(Object.values(secret));
  for (const p of players) secret[p.uid] = codeOffers(codes, [taken()], Math.random, 1)[0];
  const state = { me: shared ? Object.assign(me, { pending: null, lastHit: null }) : { ...me, pending: null, lastHit: null }, players, self: { code: null, offers: null, offersExpiresAt: null, hack: null } };
  const pl = new Set();
  const sl = new Set();
  const all = () => [state.me, ...state.players];
  const emit = () => {
    const list = all().map((p) => ({ ...p }));
    for (const fn of pl) fn(list);
    for (const fn of sl) fn({ ...state.self });
  };
  const net = async () => { await sleep(latency()); };

  function writeCode(code) {
    secret[me.uid] = code;
    versions[me.uid] = (versions[me.uid] || 0) + 1;
    state.self = { ...state.self, code, offers: null, offersExpiresAt: null };
  }

  const api = {
    async answer({ attemptId, factorA, factorB, answer, q, choiceIndex }) {
      await net();
      let correct;
      let correctAnswer;
      if (quiz && Number.isInteger(q)) {
        correct = choiceIndex === quiz[q].a;
        correctAnswer = quiz[q].options[quiz[q].a];
      } else {
        correct = Number(answer) === factorA * factorB;
        correctAnswer = factorA * factorB;
      }
      state.me.correct = (state.me.correct || 0) + (correct ? 1 : 0);
      if (shared && !correct) state.me.incorrect = (state.me.incorrect || 0) + 1;
      const nextQ = quiz ? Math.floor(Math.random() * quiz.length) : null;
      return { attemptId, correct, correctAnswer, nextQ };
    },
    async openFile() {
      await net();
      if (state.me.pending) throw err("failed-precondition", "Välj först vem du hackar.");
      const file = chestById(forced()) || rollChest(true);
      if (file.effect.kind === "steal") {
        const expiresAtMs = now() + DK_RULES.victimPickMs;
        state.me.pending = { kind: "steal", chest: "hack", expiresAt: expiresAtMs };
        setTimeout(emit, 30);
        return { file: file.id, kind: "steal", delta: 0, gold: state.me.gold, protectedUntil: null, pending: { kind: "steal", expiresAtMs } };
      }
      const eff = applySelfEffect(file, state.me.gold);
      const prev = state.me.gold;
      state.me.gold = eff.gold;
      if (eff.protect) state.me.protectedUntil = shieldUntil(now());
      setTimeout(emit, 30);
      onAction("fil", { file: file.id, delta: eff.gold - prev, gold: eff.gold });
      return { file: file.id, kind: file.effect.kind, delta: eff.gold - prev, gold: eff.gold, protectedUntil: state.me.protectedUntil ?? null };
    },
    async pickCode({ index = null } = {}) {
      await net();
      const s = state.self;
      if (index != null) {
        const code = s.offers?.[index];
        if (!code) throw err("failed-precondition", "Det finns inga kodförslag att välja just nu.");
        writeCode(code);
      } else if (phase() === "live" && (!s.code || (s.offers && s.offersExpiresAt && now() >= s.offersExpiresAt))) {
        writeCode(s.offers?.length ? s.offers[Math.floor(Math.random() * s.offers.length)] : codeOffers(codes, [taken()], Math.random, 1)[0]);
        setTimeout(emit, 30);
        return { code: state.self.code, offers: null, expiresAtMs: null, auto: true };
      } else if (!s.code && !s.offers) {
        state.self = { ...s, offers: codeOffers(codes, [taken()], Math.random, DK_RULES.codeOffers), offersExpiresAt: null };
      }
      setTimeout(emit, 30);
      return { code: state.self.code, offers: state.self.offers, expiresAtMs: state.self.offersExpiresAt };
    },
    async chooseTarget({ targetUid = null }) {
      await net();
      const t = now();
      const p = state.me.pending;
      if (!p) throw err("failed-precondition", "Det finns inget hack att välja mål för.");
      const late = t > p.expiresAt + DK_RULES.victimGraceMs;
      let v = targetUid && !late ? state.players.find((x) => x.uid === targetUid) : null;
      if (v) {
        const problem = victimProblem("steal", state.me, v, t);
        if (problem) throw err("failed-precondition", victimMessage(problem, v));
      } else {
        const c = eligibleVictims("steal", state.me, state.players, t);
        v = c[Math.floor(Math.random() * c.length)] || null;
      }
      if (!v) {
        const fb = chestById("mapp");
        const eff = applySelfEffect(fb, state.me.gold);
        const prev = state.me.gold;
        state.me.gold = eff.gold;
        state.me.pending = null;
        setTimeout(emit, 30);
        onAction("fil", { file: fb.id, delta: eff.gold - prev, gold: eff.gold });
        return { result: "fallback", file: fb.id, delta: eff.gold - prev, gold: eff.gold };
      }
      const right = secret[v.uid];
      let mem = memory[v.uid];
      if (!mem || mem.version !== (versions[v.uid] || 0)) {
        mem = memory[v.uid] = { version: versions[v.uid] || 0, decoys: pickDecoys(codes, right, { strict: taken() }), struck: [], shown: [] };
      }
      const options = hackOptions(right, mem.decoys, mem.struck, Math.random, mem.shown);
      mem.shown = options;
      const expiresAtMs = t + DK_RULES.codeGuessMs;
      state.me.pending = { ...p, stage: "guess", targetUid: v.uid, targetName: v.name };
      state.me.lastVictimUid = v.uid;
      state.self = { ...state.self, hack: { targetUid: v.uid, targetName: v.name, options, expiresAt: expiresAtMs } };
      setTimeout(emit, 30);
      return { result: "target", targetUid: v.uid, targetName: v.name, options, expiresAtMs, auto: !targetUid };
    },
    async guessCode({ index = null }) {
      await net();
      const h = state.self.hack;
      if (!h) throw err("failed-precondition", "Välj först vem du ska hacka.");
      const done = () => { state.me.pending = null; state.self = { ...state.self, hack: null }; setTimeout(emit, 30); };
      if (index == null || now() > h.expiresAt + DK_RULES.victimGraceMs) { done(); return { result: "timeout", targetUid: h.targetUid }; }
      const guess = h.options[index];
      const v = state.players.find((x) => x.uid === h.targetUid);
      if (guess !== secret[h.targetUid]) {
        memory[h.targetUid].struck.push(guess);
        done();
        onAction("fel", { targetUid: h.targetUid });
        return { result: "wrong", targetUid: h.targetUid, code: guess, left: h.options.length - 1 };
      }
      const res = resolveVictim("steal", state.me, v);
      const prev = state.me.gold;
      state.me.gold = res.thiefGold;
      v.gold = res.victimGold;
      v.protectedUntil = hitProtectionUntil(v, now());
      secret[v.uid] = codeOffers(codes, [taken()], Math.random, 1)[0];
      versions[v.uid] = (versions[v.uid] || 0) + 1;
      done();
      onAction("hack", { targetUid: v.uid, amount: res.amount });
      return { result: "hacked", targetUid: v.uid, amount: res.amount, delta: res.thiefGold - prev, gold: res.thiefGold, victimGold: res.victimGold };
    },
    watchDkPlayers(_sid, cb) {
      pl.add(cb);
      setTimeout(() => cb(all().map((p) => ({ ...p }))), 50);
      return () => pl.delete(cb);
    },
    watchMySelf(_sid, _uid, cb) {
      sl.add(cb);
      setTimeout(() => cb({ ...state.self }), 60);
      return () => sl.delete(cb);
    },
    getQuestions: async () => (quiz || []).map(({ text, options }) => ({ text, options })),
    getMyAnswer: async () => null,
  };

  return {
    api,
    state,
    secret,
    emit,
    protect(uid, ms) {
      const p = state.players.find((x) => x.uid === uid);
      if (p) p.protectedUntil = now() + ms;
      emit();
    },
    /** En klasskamrat knäcker min kod: 15 % flyttas, skydd 30 s, fyra nya kodförslag. */
    hackMe(byUid) {
      const by = state.players.find((x) => x.uid === byUid) || state.players[0];
      const res = resolveVictim("steal", by, state.me);
      by.gold = res.thiefGold;
      state.me.gold = res.victimGold;
      state.me.protectedUntil = hitProtectionUntil(state.me, now());
      state.me.lastHit = { kind: "steal", chest: "hack", byUid: by.uid, byName: by.name, amount: res.amount, at: now() };
      state.self = {
        ...state.self,
        offers: codeOffers(codes, [taken()], Math.random, DK_RULES.codeOffers, state.self.code),
        offersExpiresAt: now() + DK_RULES.codePickMs,
      };
      emit();
      onAction("hackad", { byUid: by.uid, amount: res.amount });
    },
  };
}
