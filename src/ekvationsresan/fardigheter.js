// ============================================================================
// Ekvationsresan – färdighetsmodellen (src/ekvationsresan/fardigheter.js) · #626
// ----------------------------------------------------------------------------
// Spec E2.4. Ren logik, INTERN (visas aldrig för eleven). Varje avslutat försök
// ger observationer för de färdigheter uppgiften visar:
//
//   observera(task, attempt) → { balans: { s: 0–100, h: 0|1 }, … }
//     s = hur det gick (samma skala som stjärnpoängen: ⭐⭐⭐ 100, ⭐⭐ 60, ⭐ 20, 0)
//     h = 1 om 💡/Visa lösningen (eller ett visat svar) behövdes
//
// Observationen sparas på försöket (`attempt.skills`) och läggs på modellen i
// progressdokumentet (`progress.skills`, framsteg.applyCompletion):
//
//   skills = { [färdighet]: { v: 0–100, h: 0–100, n } }
//     v = glidande medelvärde av s, h = andel uppgifter med hjälp, n = underlag
//
// Modellen går att bygga om ur försöken (modellUrForsok) – lärarvyn och
// testerna kontrollerar att sammanfattningen stämmer med försöken.
//
// Vad som observeras:
//   A/B/F (lösningsdel)  ekvationsslaget (ettSteg/tvaSteg/bada/addSub/multDiv ur
//                        den optimala vägen: löst själv / med hjälp / inte),
//                        operation (drag mot optimalt, spärrade drag – bara
//                        lösta), självständighet; A även balans (vågen)
//   C Nästa rad          förenkling (+ skrivsätt när eleven skriver raden själv)
//   D Bild → ekvation    skrivsätt (bild → symboler)
//   E Hitta felet        balans (fel i bara ena ledet / olika operation) eller
//                        förenkling (räknefel / delade bara x-termen)
//   F Problemlösning     text → ekvation (första frågan), problemlösning (hela kedjan)
// ============================================================================

import { SKILLS, FARDIGHET, STAR_POINTS10 } from "./config.js";
import { moveOperand } from "./operations.js";
import { helpCap, moveStars } from "./resultat.js";

export const SKILL_KEYS = Object.freeze(SKILLS.map((s) => s.key));
/** Ekvationsslagen – "rena ekvationer" (lösningsdelen). */
export const EKVATIONSSLAG = Object.freeze(["ettSteg", "tvaSteg", "bada", "addSub", "multDiv"]);

const pct = (stars) => (STAR_POINTS10[stars] ?? 0) * 10;

/** Vilka ekvationsslag uppgiften tränar – ur ekvationen och den optimala vägen. */
export function ekvationsslag(task) {
  const path = task.optimalPath || [];
  const eq = task.equation || { left: [], right: [] };
  const steps = path.map((s) => ({ op: s.op, ...moveOperand(s) }));
  const out = [];
  if (path.length === 1) out.push("ettSteg");
  if (eq.left.some((t) => t.x) && eq.right.some((t) => t.x)) out.push("bada");
  else if (path.length >= 2) out.push("tvaSteg");
  if (steps.some((s) => (s.op === "+" || s.op === "-") && !s.x)) out.push("addSub");
  if (steps.some((s) => s.op === "*" || s.op === "/")) out.push("multDiv");
  return out;
}

/**
 * Poäng för en grupp frågor i C–F (samma trappa som TYPE_STARS): rätt direkt
 * 100, ett fel 60, fler 20, ett visat svar 0. Svar som inte räknas (annan
 * form, följdrad) hoppas över. → { s, h } | null (inga sådana frågor).
 */
export function fragePoang(answers, kinds) {
  const list = (answers || []).filter((a) => a && kinds.includes(a.k) && !a.annan && !a.senare);
  if (!list.length) return null;
  if (list.some((a) => a.visad)) return { s: 0, h: 1 };
  const fel = list.filter((a) => !a.ok).length;
  return { s: fel === 0 ? 100 : fel === 1 ? 60 : 20, h: 0 };
}

/**
 * Lösningsdelen (A, B, F). Ekvationsslagen mäter OM eleven löser själv (löst +
 * hjälpgränsen, E1.7) – omvägar mäts bara i `operation`, så "många extra steg"
 * inte blir "svårt med tvåstegsekvationer". "Visa lösningen" säger inget om
 * dragen (ingen operation-observation).
 */
function losningsdel(task, attempt) {
  const revealed = !!attempt.revealed;
  const help = Number.isInteger(attempt.helpMax) ? attempt.helpMax : 0;
  // F: försökets stjärnor är det lägsta av frågorna och lösningen – räkna om lösningens egna.
  const solved = (task.type === "F" || !!attempt.solved) && !revealed;
  const moves = Number.isInteger(attempt.moveCount) ? attempt.moveCount : 0;
  const optimal = task.optimalMoves ?? attempt.optimalMoves ?? moves;
  const h = revealed || help > 0 ? 1 : 0;
  let op = solved ? pct(moveStars(moves, optimal)) : null;
  if (op && attempt.blocked > 0) op = Math.min(op, pct(2)); // spärrade drag = provade fel operation
  return { s: solved ? pct(helpCap(help)) : 0, h, op, sjalv: revealed ? 0 : 100 - 25 * Math.min(4, help) };
}

/**
 * Observationerna för ett avslutat försök.
 * @param {object} task     generatorns uppgift (type, optimalPath, equation, nastaRad/fel)
 * @param {object} attempt  framsteg.buildAttempt-form (stars, solved, revealed, helpMax, moveCount, blocked, answers)
 * @returns {Object<string, {s:number, h:0|1}>}
 */
export function observera(task, attempt) {
  const o = {};
  const put = (key, r) => {
    if (r) o[key] = { s: Math.round(r.s), h: r.h ? 1 : 0 };
  };
  const type = task.type || "A";
  const answers = attempt.answers || [];
  if (type === "A" || type === "B" || type === "F") {
    const l = losningsdel(task, attempt);
    for (const key of ekvationsslag(task)) put(key, l);
    if (l.op !== null) put("operation", { s: l.op, h: l.h });
    put("sjalv", { s: l.sjalv, h: l.h });
    if (type === "A") put("balans", l);
  }
  if (type === "C") {
    const r = fragePoang(answers, ["rad"]);
    put("forenkling", r);
    if (task.nastaRad?.mode !== "valj") put("skrivsatt", r);
  }
  if (type === "D") put("skrivsatt", fragePoang(answers, ["ekvation"]));
  if (type === "E") {
    const kind = task.fel?.kind;
    put(kind === "enaSidan" || kind === "olika" ? "balans" : "forenkling", fragePoang(answers, ["steg"]));
  }
  if (type === "F") {
    put("text", fragePoang(answers, ["ekvation"]));
    put("problem", { s: pct(attempt.stars), h: attempt.revealed || answers.some((a) => a?.visad) || attempt.helpMax > 0 });
  }
  if (type === "C" || type === "D" || type === "E") {
    const all = fragePoang(answers, ["rad", "ekvation", "steg"]);
    if (all) put("sjalv", { s: all.h ? 0 : 100, h: all.h });
  }
  return o;
}

/** En färdighet ur modellen, tåligt läst. */
export function las(skills, key) {
  const e = skills && skills[key];
  if (!e || !Number.isInteger(e.n) || e.n <= 0) return { v: null, h: null, n: 0 };
  return { v: Number(e.v) || 0, h: Number(e.h) || 0, n: e.n };
}

/** Lägg en observation på modellen (glidande medelvärde). Ren – ny modell. */
export function uppdatera(skills, obs) {
  const out = { ...(skills && typeof skills === "object" ? skills : {}) };
  for (const [key, { s, h }] of Object.entries(obs || {})) {
    if (!SKILL_KEYS.includes(key)) continue;
    const cur = las(out, key);
    const n = cur.n + 1;
    const a = Math.max(1 / n, FARDIGHET.alphaMin);
    const v = cur.n ? cur.v + a * (s - cur.v) : s;
    const hv = cur.n ? cur.h + a * (100 * h - cur.h) : 100 * h;
    out[key] = { v: Math.round(v), h: Math.round(hv), n };
  }
  return out;
}

/** Bygg modellen ur försök (vilken ordning som helst – sorteras äldst först). */
export function modellUrForsok(attempts) {
  const t = (a) => (typeof a.completedAt === "number" ? a.completedAt : a.completedAt?.toMillis?.() ?? 0);
  return [...(attempts || [])]
    .filter((a) => a && a.skills && a.skills.obs)
    .sort((a, b) => t(a) - t(b))
    .reduce((m, a) => uppdatera(m, a.skills.obs), {});
}

// --- bedömningar (nästa uppgift + lärarvyn) -----------------------------------

const harUnderlag = (e) => e.n >= FARDIGHET.minN;
export const stark = (e) => harUnderlag(e) && e.v >= FARDIGHET.stark;
export const svag = (e) => harUnderlag(e) && e.v < FARDIGHET.svag;
export const hjalpOfta = (e) => harUnderlag(e) && e.h >= FARDIGHET.hjalpOfta;
export const sjalvstandig = (e) => harUnderlag(e) && e.h <= FARDIGHET.hjalpSallan;

/** "Rena ekvationer": ekvationsslagen sammanvägda efter underlag. */
export function ekvationer(skills) {
  let n = 0, v = 0, h = 0;
  for (const key of EKVATIONSSLAG) {
    const e = las(skills, key);
    if (!e.n) continue;
    n += e.n;
    v += e.v * e.n;
    h += e.h * e.n;
  }
  return n ? { v: Math.round(v / n), h: Math.round(h / n), n } : { v: null, h: null, n: 0 };
}

/** Lärarvyns indikatorer: alla färdigheter i spec-ordning (+ läge). */
export function indikatorer(skills) {
  return SKILLS.map(({ key, name }) => {
    const e = las(skills, key);
    const lage = !e.n ? "ingen" : !harUnderlag(e) ? "lite" : stark(e) ? "stark" : svag(e) ? "svag" : "mitt";
    return { key, name, ...e, lage };
  });
}
