// ============================================================================
// Datakuppen 💾 (#653): HACKET på spelytan i två steg (spec §1.4, §4.3).
//   steg 1  målväljaren (dk-offer.js) – chooseTarget; ingen att välja →
//           filens fallback (Mapp) och tillbaka till frågorna
//   steg 2  kodkorten (dk-kodkort.js) – guessCode; fel kod stryks och sparas
//           i minnet (createHackMemory, localStorage per match) så att nästa
//           försök mot samma mål visar den som borta
// Omladdning: dkPlayers.pending (steg 1) / pending.stage "guess" + dkSelf.hack
// (steg 2) öppnar rätt steg igen (resume). Avgörs hacket på annat håll (annan
// flik, servern slumpade/tiden gick ut) stängs det (settled).
//
// API
//   createHackFlow({ parts: { offer, kod }, api, sid, uid, now, pool, roster,
//                    stage, reduced?, sound?, show(lage), onGold(gold),
//                    onMood(mood), onDone() })
//     → { target(pending, me, players), resume(me, self, players) → bool,
//         update(me, players), settled(me) → bool, open() → bool, destroy() }
//     show("offer" | "kod" | "laddar")  vyn byter del i mitten
//     onDone()  hacket klart → vyn visar nästa fråga
// ============================================================================

import { pickTarget } from "./dk-offer.js";
import { playCodeCards } from "./dk-kodkort.js";
import { createHackMemory, hackState } from "./dk-elev.js";

export function createHackFlow({ parts, api, sid, uid, now, pool, roster, stage, reduced = false, sound = null, show, onGold, onMood, onDone }) {
  let offer = null;
  let chosen = false;
  let cards = null;
  let guessing = false;
  const key = `pp:dk:minne:${sid}:${uid}`;
  const memory = createHackMemory({
    get: () => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (v) => { try { localStorage.setItem(key, v); } catch {} },
  });

  function close() {
    offer?.destroy();
    offer = null;
    cards?.destroy();
    cards = null;
    guessing = false;
    chosen = false;
  }

  function target(pending, me, players) {
    if (offer || cards) return;
    show("offer");
    chosen = false;
    const o = pickTarget(parts.offer, {
      me: { ...(me || { uid, gold: 0 }), uid, pending }, players, pending,
      now, pool, roster, stage, reduced,
      choose: (targetUid) => {
        chosen = true;
        return api.chooseTarget({ sid, targetUid }).catch((err) => { chosen = false; throw err; });
      },
      onResult(v) {
        if (v.hack) {
          // Målet valt → kodkorten direkt (nedräkningen har redan börjat).
          o.destroy();
          if (offer === o) offer = null;
          codes(v.hack);
          return;
        }
        onGold(v.gold);
        if (v.mood) onMood(v.mood);
      },
    });
    offer = o;
    o.done.then(() => {
      if (offer !== o) return;
      offer = null;
      onDone();
    });
  }

  function codes(t) {
    if (cards) return;
    show("kod");
    memory.seen(t.targetUid, t.options);
    guessing = false;
    const c = playCodeCards(parts.kod, {
      target: t, struck: memory.struck(t.targetUid), now, sound, reduced,
      guess: (index) => {
        guessing = true;
        return api.guessCode({ sid, index, targetUid: t.targetUid });
      },
      onResult(v, res) {
        if (res?.result === "wrong") memory.strike(t.targetUid, res.code);
        if (res?.result === "hacked") onGold(res.gold);
        if (v.mood) onMood(v.mood);
      },
    });
    cards = c;
    c.done.then(() => {
      if (cards !== c) return;
      cards = null;
      onDone();
    });
  }

  return {
    target,
    /** Ett väntande hack: steg 2 om målet är valt (och koderna kommit), annars steg 1. */
    resume(me, self, players) {
      const p = me?.pending;
      if (!p || offer || cards) return !!(offer || cards);
      if (p.stage === "guess") {
        const h = hackState(self, me, now());
        if (h) codes(h);
        else show("laddar"); // koderna (dkSelf) är på väg
        return true;
      }
      target(p, me, players);
      return true;
    },
    update(me, players) {
      offer?.update(me, players);
    },
    /** Avgjort på annat håll (pending borta utan att eleven valt/gissat) → stäng. */
    settled(me) {
      if (me?.pending) return false;
      if ((offer && !chosen) || (cards && !guessing)) {
        close();
        return true;
      }
      return false;
    },
    open: () => !!(offer || cards),
    destroy: close,
  };
}
