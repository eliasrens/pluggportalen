// ============================================================================
// Snilleblixten (#558): ELEVSKÄRMENS LÄGE – ren logik (ingen DOM/Firebase),
// testas i test/live-snilleblixt-elev.test.js. Vyn (snilleblixt-student.js)
// ritar bara det läge som räknas ut här (designspec §5.8).
//
// Allt kommer ur verifierad data: sessionens q (pågående fråga, facit först
// vid avslöjandet), elevens EGET svarsdokument (finns = har svarat, även efter
// omladdning) och sbScores (poängen läraren räknat ur serverstämplarna).
// Eleven räknar aldrig själv ut om svaret var rätt.
//
// API
//   elevLage({ s, player, uid, mine, scores, now }) → {
//     kind,      "ansluter" | "forsta" (start, ingen fråga än) | "fraga" |
//                "svarat" | "sen" (anslöt mitt i frågan → nästa) |
//                "tid-ute" (inget svar, väntar på avslöjandet) | "ratt" |
//                "fel" | "inget-svar" | "visa-svar" (sen: rätt svar utan
//                omdöme) | "hoppad"
//     index, number ("Fråga 3 av 10"), total,
//     question?  frågan (fraga/svarat), endMs? (fraga: svarsfönstrets slut)
//     points?    frågans poäng (ratt/fel), facit? (avslöjad), mine?
//     rank, totalPoints  placering/poäng hittills (ur alla sbScores)
//   }
//   mine = elevens svarsdokument för q.index ({ choiceIndex | answer }) | null
//   myStanding(s, scores, uid) → { rank, points, correct }
//   formatPoints(n) → "4 230"
// ============================================================================

import { canAnswer } from "./snilleblixt-flode.js";
import { computeStandings, questionWindow } from "./snilleblixt-poang.js";

/** Placering och poäng hittills. Elever utan poäng delar platsen efter alla med poäng. */
export function myStanding(s, scores, uid) {
  const st = computeStandings(s, { scores, players: [{ uid }] });
  const me = st.players.find((p) => p.uid === uid);
  return { rank: me?.rank || 1, points: me?.points || 0, correct: me?.correct || 0 };
}

export function formatPoints(n) {
  return (Math.round(Number(n) || 0)).toLocaleString("sv-SE").replace(/ /g, " ");
}

export function elevLage({ s, player, uid, mine = null, scores = [], now = null } = {}) {
  const q = s?.q || null;
  const total = Number(s?.questionCount) || 0;
  const standing = myStanding(s, scores, uid);
  const base = { index: q ? q.index : -1, number: q ? q.index + 1 : 0, total, rank: standing.rank, totalPoints: standing.points };
  if (!player) return { ...base, kind: "ansluter" };
  if (!q) return { ...base, kind: "forsta" };
  // Fick eleven vara med på frågan? (anslöt före öppningen, §5.7)
  const eligible = canAnswer({ ...s, status: "live", q: { ...q, phase: "open" } }, player);
  if (q.phase === "skipped") return { ...base, kind: "hoppad" };
  if (q.phase === "open" || q.phase === "closed") {
    if (mine) return { ...base, kind: "svarat", question: q.question, mine };
    if (!eligible) return { ...base, kind: "sen" };
    const win = questionWindow(q, s.questionSeconds);
    if (q.phase === "closed" || (win && now != null && now >= win.endMs)) return { ...base, kind: "tid-ute" };
    return { ...base, kind: "fraga", question: q.question, endMs: win?.endMs ?? null, startMs: win?.startMs ?? null };
  }
  // revealed: omdömet ur lärarens sbScores (skrivs i samma transaktion som facit).
  const sc = (scores || []).find((x) => x && x.index === q.index);
  if (!sc) return { ...base, kind: mine ? "svarat" : eligible ? "tid-ute" : "sen", question: q.question, mine };
  const facit = q.facit || null;
  if (sc.correct?.[uid] === true) return { ...base, kind: "ratt", points: Number(sc.points?.[uid]) || 0, facit, mine };
  if (mine || uid in (sc.points || {})) return { ...base, kind: "fel", points: 0, facit, mine };
  return { ...base, kind: eligible ? "inget-svar" : "visa-svar", facit };
}
