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
//     rel, totalPoints   läget relativt närmaste framför + poäng hittills
//   }
//   mine = elevens svarsdokument för q.index ({ choiceIndex | answer }) | null
//   names = { uid: förnamn } (klassprojektionen) – för "bakom <Namn>"
//   myStanding(s, scores, uid) → { rank, points, correct } (internt – visas ALDRIG)
//   relativeStanding(list, uid) → { kind: "leder"|"lika"|"lika-topp"|"bakom"|"ingen",
//                      name?, diff? }  list = [{ uid, points, name? }]
//   relativeText(rel) → "120 poäng bakom Alma" | "Du leder! ⚡" | "Lika med Alma" …
//   endStanding(result, uid) → { podium: 1|2|3|null, rel, row } (slutskärmen)
//   stageAction(phase) → "spel" | "lobby" | "slut" | null – vad elevytan ska
//                     rita i fasen. ALLA ritningar (även asynkrona: poäng, namn,
//                     eget svar) går via den, så avataren aldrig flyttas till
//                     den dolda spelytan i lobbyn (#561 F2).
//   formatPoints(n) → "4 230"
//
// INGEN PLACERING SOM NUMMER (Elias 2026-10-10): eleven ska aldrig få veta att
// hen ligger sist. Avslöjandet visar läget mot närmaste elev FRAMFÖR; bara
// topp 3 ser sin pallplats på slutskärmen (pallen visas ändå på projektorn).
// ============================================================================

import { canAnswer } from "./snilleblixt-flode.js";
import { computeStandings, questionWindow } from "./snilleblixt-poang.js";

/** Placering och poäng hittills. Elever utan poäng delar platsen efter alla med poäng. */
export function myStanding(s, scores, uid) {
  const st = computeStandings(s, { scores, players: [{ uid }] });
  const me = st.players.find((p) => p.uid === uid);
  return { rank: me?.rank || 1, points: me?.points || 0, correct: me?.correct || 0 };
}

/** Närmaste framför i poäng (lägst poäng > mina; lika poäng → namnordning). */
export function relativeStanding(list, uid) {
  const rows = (list || []).filter((p) => p && p.uid);
  const me = rows.find((p) => p.uid === uid);
  const mine = Number(me?.points) || 0;
  const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sv") || String(a.uid).localeCompare(String(b.uid));
  const others = rows.filter((p) => p.uid !== uid);
  const above = others.filter((p) => (Number(p.points) || 0) > mine);
  const tied = others.filter((p) => (Number(p.points) || 0) === mine).sort(byName);
  if (mine > 0 && tied.length) return { kind: above.length ? "lika" : "lika-topp", name: tied[0].name || "" };
  if (!above.length) return mine > 0 ? { kind: "leder" } : { kind: "ingen" };
  const top = Math.min(...above.map((p) => Number(p.points) || 0));
  const next = above.filter((p) => (Number(p.points) || 0) === top).sort(byName)[0];
  return { kind: "bakom", name: next.name || "", diff: top - mine };
}

const NAMNLOS = "en klasskompis";

/** Förnamnet ("Alma 4B" → "Alma"). */
export function firstName(n) {
  return String(n || "").trim().split(/\s+/)[0] || "";
}

/** Elevens rad – aldrig en placering som nummer. */
export function relativeText(rel) {
  const n = (rel?.name || "").trim() || NAMNLOS;
  switch (rel?.kind) {
    case "leder": return "Du leder! ⚡";
    case "lika-topp": return `Lika med ${n} – ni leder! ⚡`;
    case "lika": return `Lika med ${n}`;
    case "bakom": return `${formatPoints(rel.diff)} poäng bakom ${n}`;
    default: return "";
  }
}

/** Slutskärmen ur result.ranking (namn finns där): topp 3 → pallplats, annars relativt. */
export function endStanding(result, uid) {
  const ranking = result?.ranking || [];
  const row = ranking.find((p) => p.uid === uid) || null;
  const podium = row && row.points > 0 && row.rank <= 3 ? row.rank : null;
  const list = ranking.map((p) => ({ uid: p.uid, points: p.points, name: firstName(p.name) }));
  return { podium, row, rel: relativeStanding(list, uid) };
}

/** Vad elevytan ska rita i fasen (lobby: avataren i lobbyn, aldrig spelkortet). */
export function stageAction(phase) {
  if (phase === "live") return "spel";
  if (phase === "lobby") return "lobby";
  if (phase === "finished" || phase === "cancelled") return "slut";
  return null;
}

export function formatPoints(n) {
  return (Math.round(Number(n) || 0)).toLocaleString("sv-SE").replace(/ /g, " ");
}

export function elevLage({ s, player, uid, mine = null, scores = [], now = null, names = {} } = {}) {
  const q = s?.q || null;
  const total = Number(s?.questionCount) || 0;
  const st = computeStandings(s, { scores, players: [{ uid }] });
  const list = st.players.map((p) => ({ uid: p.uid, points: p.points, name: names?.[p.uid] || "" }));
  const rel = relativeStanding(list, uid);
  const totalPoints = st.players.find((p) => p.uid === uid)?.points || 0;
  const base = { index: q ? q.index : -1, number: q ? q.index + 1 : 0, total, rel, totalPoints };
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
