// ============================================================================
// Trollkarlsduellen (#536): MATCHDATA-adaptern (spec §19) – ren, ingen DOM.
// Läser projektorns färdiga Live-tillstånd (live-feed.js subscribeLiveSession)
// och lägger till trollkarlskopplingen. INGEN egen poänglogik: matchpoäng,
// ledare och vinnare kommer ur classStandings/decideWinner (st.classes,
// st.leaderIds, st.winnerId/draw) och slutresultatet ur st.result.winner.
//
// API
//   FINALE_WAIT_MS   4000 – så länge vi väntar på historikens result efter
//                    "finished" innan vi litar på live-ställningen
//   TENSION_MS       { high: 30 000, final: 10 000 } (§13, bara visuellt)
//   duelData(st) → {
//     sessionId, phase, status, clock, msLeft,
//     tension: "" | "high" | "final",
//     sides: [{ classId, name, who, wizardName, side: "left"|"right",
//               score, scoreText, correct, divisor, leading }],   // sessionens ordning
//     leaderId,              // EN ledare med poäng > 0, annars null
//     ended,                 // fasen ended/finished – inga nya attacker
//     outcome,               // se officialOutcome
//   }
//   officialOutcome(st, finishedSeenMs?, nowMs?) → null (inte avgjort än) |
//     { winnerId, draw, settled }  – settled = ur st.result (historiken)
// ============================================================================

import { formatScore } from "../live-core.js";
import { resolveWizards, WIZARD_NAMES } from "./trollkarl-val.js";

export const FINALE_WAIT_MS = 4000;
export const TENSION_MS = { high: 30_000, final: 10_000 };

export function officialOutcome(st, finishedSeenMs = null, nowMs = null) {
  if (st?.phase !== "finished") return null;
  const w = st.result?.winner;
  if (typeof w === "string" && w) return { winnerId: w === "draw" ? null : w, draw: w === "draw", settled: true };
  // Historiken skrivs ~2,5 s efter slut (sena svar hinner räknas). Vänta en stund.
  if (finishedSeenMs != null && nowMs != null && nowMs - finishedSeenMs < FINALE_WAIT_MS) return null;
  return { winnerId: st.draw ? null : st.winnerId || null, draw: !!st.draw, settled: false };
}

export function duelData(st, finishedSeenMs = null, nowMs = null) {
  const s = st?.session || {};
  const wizards = resolveWizards(s) || {};
  const classes = st?.classes || [];
  const anyScore = classes.some((c) => c.correct > 0);
  const leaderId = anyScore && st?.leaderIds?.length === 1 ? st.leaderIds[0] : null;
  const sides = classes.slice(0, 2).map((c, i) => ({
    classId: c.classId,
    name: c.name,
    who: wizards[c.classId] || (i ? "elias" : "rasmus"),
    wizardName: WIZARD_NAMES[wizards[c.classId] || (i ? "elias" : "rasmus")],
    side: i ? "right" : "left",
    score: c.score,
    scoreText: formatScore(c.score),
    correct: c.correct,
    divisor: c.divisor,
    leading: c.classId === leaderId,
  }));
  const phase = st?.phase || "lobby";
  const msLeft = Number(st?.msLeft) || 0;
  const tension = phase !== "live" ? "" : msLeft <= TENSION_MS.final ? "final" : msLeft <= TENSION_MS.high ? "high" : "";
  return {
    sessionId: st?.sessionId || "",
    phase,
    status: st?.status || null,
    clock: st?.clock || "00:00",
    msLeft,
    tension,
    sides,
    leaderId,
    ended: phase === "ended" || phase === "finished",
    outcome: officialOutcome(st, finishedSeenMs, nowMs),
  };
}
