// ============================================================================
// Snilleblixten – TV-studion (#559): REN LOGIK för projektorvyerna. Ingen DOM,
// ingen Firebase – testas i test/live-snilleblixt-studio.test.js. Vyerna
// (sb-studio.js m.fl.) ritar bara det som räknas ut här; poäng, facit och
// placering kommer ALLTID ur verifierad data (sbScores, q.facit), aldrig ur
// en animation (designspec §1).
//
// SCENER (studioScene) – vad studion visar just nu, ur sessionens q-fas och
// serverns tid:
//   lobby · intro (3-2-1 / första frågan på väg) · fraga (öppen) · stangd
//   (trumvirvel före avslöjandet) · svar (avslöjandet) · topplista ·
//   hoppad (överhoppad fråga, kort) · final (status finished)
// Avslöjandet visas SB_REVEAL_HOLD_MS, sedan glider topplistan in – samma
// tidpunkt i kontrollpanelen och elevskärmen. Efter en omladdning räknas
// avslöjandets start ur closedAt (serverstämpel) + trumvirveln.
//
// API
//   SB_DRUM_MS, SB_REVEAL_HOLD_MS, SB_SKIP_HOLD_MS, SB_TENSION_S, SB_OPEN_DELAY_MS
//   studioScene(st, { now, revealSeenAt? }) → scen-id (se ovan)
//   questionClock(s, now) → { msLeft, secs, frac, tension } | null
//   shownScores(scores, scene, q) → sbScores som ställningen ska visa just nu
//     (under frågan/avslöjandet: bara tidigare frågor – topplistan visar
//     klättringen först när den glider in)
//   revealInfo(q, score, answerKind) → avslöjandets siffror
//   streaks(scores) → { uid: rätt i rad (till och med senaste räknade fråga) }
//   podiumGroups(ranking) → [{ rank, players }] högst tre pallsteg, delad
//     placering = samma steg, bara poäng > 0
//   audienceLayout(n) → { rows, perRow, scale } publikens rutnät
//   choreFor(s, { phase, now, progress }) → { action, fromIndex } | null –
//     lärarklientens automatik: första frågan efter KÖR!, stäng när tiden är
//     ute / alla svarat, avslöja efter trumvirveln
//   controlsFor(s) → vilka lärarknappar som gäller nu
// ============================================================================

import { toMs } from "../../live-time.js";
import { questionWindow } from "./snilleblixt-poang.js";

export const SB_DRUM_MS = 1100;
export const SB_REVEAL_HOLD_MS = 5500;
export const SB_SKIP_HOLD_MS = 2200;
export const SB_TENSION_S = 5;
// Första frågan öppnas så här länge efter KÖR! (nedräkningen hinner tona bort).
export const SB_OPEN_DELAY_MS = 700;

/** Vilken scen studion visar. revealSeenAt = serverns tid när fönstret såg avslöjandet. */
export function studioScene(st, { now, revealSeenAt = null } = {}) {
  const s = st?.session;
  const phase = st?.phase;
  if (!s || phase === "lobby") return "lobby";
  if (phase === "finished" || phase === "cancelled") return "final";
  const q = s.q;
  if (phase === "countdown" || !q) return "intro";
  if (q.phase === "open") return "fraga";
  if (q.phase === "closed") return "stangd";
  if (q.phase === "skipped") {
    const at = revealSeenAt ?? toMs(q.closedAt) ?? 0;
    return now - at < SB_SKIP_HOLD_MS ? "hoppad" : "topplista";
  }
  const start = revealSeenAt ?? ((toMs(q.closedAt) ?? 0) + SB_DRUM_MS);
  return now - start < SB_REVEAL_HOLD_MS ? "svar" : "topplista";
}

/** Frågans nedräkning ur serverstämpeln (openedAt + frågetid). */
export function questionClock(s, now) {
  const q = s?.q;
  const win = questionWindow(q, s?.questionSeconds);
  if (!win) return null;
  const total = Number(s.questionSeconds) * 1000;
  const end = q.phase === "open" ? win.startMs + total : win.endMs;
  const msLeft = Math.max(0, end - now);
  const secs = Math.ceil(msLeft / 1000);
  return {
    msLeft,
    secs,
    frac: total > 0 ? Math.min(1, msLeft / total) : 0,
    tension: q.phase === "open" && msLeft > 0 && secs <= SB_TENSION_S,
  };
}

/** Ställningens underlag just nu: under frågan/avslöjandet bara tidigare frågor. */
export function shownScores(scores, scene, q) {
  const list = scores || [];
  if (!q || !["fraga", "stangd", "svar", "hoppad"].includes(scene)) return list;
  return list.filter((sc) => sc && sc.index < q.index);
}

const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : 0);

/**
 * Avslöjandets siffror ur q.facit + frågans sbScores-dokument.
 *   choice: { kind, correctIndex, counts[4], max, answered, correct, share }
 *   free:   { kind, correctText, answered, correct, share, topWrong[{answer,n}] }
 * score saknas (hinner inte fram) → nollor, facit visas ändå.
 */
export function revealInfo(q, score, answerKind) {
  const f = q?.facit || {};
  const answered = Number(score?.answered) || 0;
  const correct = Number(score?.correctCount) || 0;
  const base = { answered, correct, share: pct(correct, answered), ready: !!score };
  const n = Math.max(2, Math.min(4, q?.question?.options?.length || 4));
  if (answerKind === "choice") {
    const counts = (score?.choiceCounts || [0, 0, 0, 0]).slice(0, n).map((x) => Number(x) || 0);
    while (counts.length < n) counts.push(0);
    return { kind: "choice", correctIndex: Number.isInteger(f.answerIndex) ? f.answerIndex : -1, counts, max: Math.max(1, ...counts), ...base };
  }
  return {
    kind: "free",
    correctText: String(f.correctAnswer ?? ""),
    topWrong: (score?.topWrong || []).slice(0, 3).map((w) => ({ answer: String(w.answer), n: Number(w.n) || 0 })),
    ...base,
  };
}

/** Rätt i rad per elev, räknat bakifrån från senaste räknade (ej överhoppade) frågan. */
export function streaks(scores) {
  const counted = (scores || []).filter((sc) => sc && !sc.skipped).sort((a, b) => a.index - b.index);
  const out = {};
  for (const sc of counted) {
    const answered = sc.correct || {};
    // Fel svar eller inget svar bryter sviten.
    for (const u of Object.keys(out)) if (!(u in answered)) out[u] = 0;
    for (const [uid, ok] of Object.entries(answered)) out[uid] = ok ? (out[uid] || 0) + 1 : 0;
  }
  for (const u of Object.keys(out)) if (!out[u]) delete out[u];
  return out;
}

/** Pallstegen: delad placering = samma steg, högst tre steg, bara poäng > 0. */
export function podiumGroups(ranking) {
  const groups = [];
  for (const p of ranking || []) {
    if (!(p.points > 0) || p.rank > 3) continue;
    const g = groups.find((x) => x.rank === p.rank);
    if (g) g.players.push(p);
    else groups.push({ rank: p.rank, players: [p] });
  }
  return groups.sort((a, b) => a.rank - b.rank).slice(0, 3);
}

/** Publikens rutnät: en–tre rader, figurerna krymper när klassen är stor. */
export function audienceLayout(n) {
  const count = Math.max(0, n | 0);
  const rows = count <= 14 ? 1 : count <= 34 ? 2 : 3;
  const perRow = Math.max(1, Math.ceil(count / rows));
  // scale 1 = 15 per rad; fler per rad → mindre figurer (golv 0,55).
  const scale = Math.max(0.55, Math.min(1.25, 15 / Math.max(perRow, 12)));
  return { rows, perRow, scale };
}

/**
 * Lärarklientens automatik (körs ~4 ggr/s; varje övergång är en transaktion
 * ur aktuellt index, så flera lärarfönster ger ändå exakt ett steg).
 * progress = answerProgress(s, …) för den öppna frågan.
 */
export function choreFor(s, { phase, now, progress = null, startedMs = null } = {}) {
  if (s?.status !== "live" || phase !== "live") return null;
  const q = s.q;
  if (!q) {
    const t0 = startedMs ?? (toMs(s.startedAt) ?? 0) + (Number(s.countdownSeconds) || 0) * 1000;
    return now >= t0 + SB_OPEN_DELAY_MS ? { action: "open", fromIndex: -1 } : null;
  }
  if (q.phase === "open") {
    if (progress?.all) return { action: "close", fromIndex: q.index, reason: "alla" };
    const win = questionWindow(q, s.questionSeconds);
    return win && now >= win.endMs ? { action: "close", fromIndex: q.index, reason: "tid" } : null;
  }
  if (q.phase === "closed") {
    const closed = toMs(q.closedAt);
    return closed != null && now >= closed + SB_DRUM_MS ? { action: "reveal", fromIndex: q.index } : null;
  }
  return null;
}

/** Lärarknapparna just nu (§5.6). next: "open" | "finish" | null. */
export function controlsFor(s) {
  const q = s?.q;
  const live = s?.status === "live";
  const done = q && ["revealed", "skipped"].includes(q.phase);
  const last = !!q && q.index + 1 >= (Number(s?.questionCount) || 0);
  return {
    next: !live ? null : done ? (last ? "finish" : "open") : null,
    closeNow: live && q?.phase === "open",
    skip: live && !!q && ["open", "closed"].includes(q.phase),
    end: live,
    index: q ? q.index : -1,
  };
}
