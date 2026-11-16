// ============================================================================
// Mattematchen – ren lärarlogik (#459): formulär, status/kontroller,
// historik-ögonblicksbild och klasstabellens rader.
// ----------------------------------------------------------------------------
// Inga DOM-/Firebase-beroenden → testas i Node (test/mm-teacher-core.test.js).
// Statusdefinitionen delas med elevsidan (mm-core.competitionPhase).
//
// API
//   localMs(date, time)             → ms för "2026-10-12" + "08:00" (lokal tid) | NaN
//   toInputs(ms)                    → { date: "2026-10-12", time: "08:00" }
//   defaultPeriod(now)              → { startMs, endMs } (nästa hela timme → +14 dagar 15:00)
//   validateCompetition(form, now)  → { ok, errors[], fields } (fields → Firestore-doc minus tider)
//   PHASE_LABEL / phaseActions(phase) → vilka knappar som gäller i läget
//   resetConfirmOk(typed, name)     → true om läraren skrivit tävlingsnamnet exakt
//   splitCompetitions(comps, now)   → { current, history } (sorterade)
//   buildResult({ scores, stats, counters, classes, participatingIds, names, now })
//                                   → historik-ögonblicksbild (MathCompetition.result)
//   studentRows(students, statsById) → en rad per elev för klasstabellen
//   MM_COLUMNS, sortMmRows(rows, key, dir), nextMmSort(cur, key)
//   classTotals({ stats, classes, participatingIds, classIds, skola })
//                                   → rätt/fel/felprocent per klass, per årskurs
//                                     och hela skolan (#863)
//   formatFelprocent(pctWrong)      → "12,5 %" | "–"
//   formatPeriod(comp)              → "12 okt 08:00 – 23 okt 15:00"
// ============================================================================

import { TABLES, competitionPhase, classStandings, statsSummary, toMs, topList } from "./mm-core.js";
import { OVRIGA, arskursAvKlass, arskursLabel } from "./arskurs.js";

export const NAME_MAX = 80;
export const MAX_CLASSES = 50;
export const COUNTER_SHARDS = 5;
/** Så många elevresultat sparas i historiken (dokumentet får inte bli för stort). */
export const RESULT_STUDENTS_MAX = 2000;

const pad = (n) => String(n).padStart(2, "0");

/** "2026-10-12" + "08:00" → ms i webbläsarens lokala tid (NaN om ogiltigt). */
export function localMs(date, time) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(time || ""));
  if (!d || !t) return NaN;
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return NaN;
  const ms = new Date(y, mo - 1, da, h, mi, 0, 0);
  // 31 feb o.d. rullar över – godta inte det.
  if (ms.getMonth() !== mo - 1 || ms.getDate() !== da) return NaN;
  return ms.getTime();
}

/** ms → värden för <input type=date|time> (lokal tid). */
export function toInputs(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(ms)) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Förslag i formuläret: start nästa hela timme, slut 14 dagar senare kl 15:00. */
export function defaultPeriod(now) {
  const s = new Date(now);
  s.setMinutes(0, 0, 0);
  s.setHours(s.getHours() + 1);
  const e = new Date(s);
  e.setDate(e.getDate() + 14);
  e.setHours(15, 0, 0, 0);
  return { startMs: s.getTime(), endMs: e.getTime() };
}

/**
 * Validera skapa/ändra-formuläret.
 * @param {{name:string, classIds:string[], startMs:number, endMs:number, editing?:boolean}} form
 * @param {number} now  ms – en NY tävling får inte sluta i det förflutna
 */
export function validateCompetition(form, now) {
  const errors = [];
  const name = String(form?.name || "").trim().replace(/\s+/g, " ");
  const classIds = [...new Set((form?.classIds || []).filter(Boolean))];
  const { startMs, endMs } = form || {};
  if (!name) errors.push("Ge tävlingen ett namn.");
  else if (name.length > NAME_MAX) errors.push(`Namnet får vara högst ${NAME_MAX} tecken.`);
  if (classIds.length === 0) errors.push("Välj minst en deltagande klass.");
  if (classIds.length > MAX_CLASSES) errors.push(`Högst ${MAX_CLASSES} klasser.`);
  if (!Number.isFinite(startMs)) errors.push("Välj startdatum och starttid.");
  if (!Number.isFinite(endMs)) errors.push("Välj slutdatum och sluttid.");
  if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
    if (endMs <= startMs) errors.push("Slutet måste ligga efter starten.");
    else if (!form.editing && endMs <= now) errors.push("Slutet har redan passerat – välj en senare sluttid.");
  }
  return { ok: errors.length === 0, errors, fields: { name, participatingClassIds: classIds } };
}

export const PHASE_LABEL = {
  kommande: "Kommande",
  aktiv: "Aktiv",
  pausad: "Stoppad",
  avslutad: "Avslutad",
};

/**
 * Lärarens knappar per läge. "Nollställ" finns i alla lägen (kräver bekräftelse).
 *   start  – kommande: "Starta nu" (startAt = nu)
 *   stop   – aktiv/kommande: pausa (svar nekas, eleverna ser inte tävlingen)
 *   resume – pausad: fortsätt (status active igen)
 *   finish – allt utom avslutad: avsluta + spara historik
 *   edit   – allt utom avslutad: ändra namn/klasser/tider
 */
export function phaseActions(phase) {
  switch (phase) {
    case "kommande": return ["start", "stop", "finish", "edit", "reset"];
    case "aktiv": return ["stop", "finish", "edit", "reset"];
    case "pausad": return ["resume", "finish", "edit", "reset"];
    default: return ["reset"];
  }
}

/** Nollställning kräver att läraren skriver tävlingsnamnet (skiftläge/mellanslag tolereras). */
export function resetConfirmOk(typed, name) {
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv");
  return norm(name).length > 0 && norm(typed) === norm(name);
}

/**
 * Lista → pågående/kommande (aktiv först, sedan närmast start) och historik
 * (senast avslutad först).
 */
export function splitCompetitions(comps, now) {
  const current = [];
  const history = [];
  for (const c of Array.isArray(comps) ? comps : []) {
    const phase = competitionPhase(c, now);
    (phase === "avslutad" ? history : current).push({ ...c, phase });
  }
  const order = { aktiv: 0, pausad: 1, kommande: 2 };
  current.sort((a, b) => order[a.phase] - order[b.phase] || toMs(a.startAt) - toMs(b.startAt));
  const ended = (c) => Math.min(toMs(c.endAt) || 0, toMs(c.finishedAt) || Infinity);
  history.sort((a, b) => ended(b) - ended(a));
  return { current, history };
}

/** Klasserna på placeringen (delad plats → alla), bara med minst ett rätt svar. */
function plats(klasser, rank) {
  return klasser.filter((k) => k.rank === rank && k.correct > 0).map((k) => k.classId);
}

/**
 * Historikens ögonblicksbild – sparas i mathCompetitions/{cid}.result vid
 * avslut. Underdokumenten (studentStats/scores/…) ligger dessutom kvar, så
 * per-tabell-detaljen per elev kan alltid öppnas i efterhand.
 * @param {{scores:object[], stats:object[], counters:object[], classes:object[],
 *   participatingIds:string[], names?:Map<string,string>, now:number}} a
 */
export function buildResult({ scores, stats, counters, classes, participatingIds, names, now }) {
  const nameOf = new Map(names || []);
  for (const s of scores || []) if (s?.uid && s.name) nameOf.set(s.uid, String(s.name));
  const top = topList(scores || [], 25);
  const klasser = classStandings(counters || [], classes || [], participatingIds || []);
  const students = (stats || [])
    .filter((s) => s && (s.uid || s.id))
    .map((s) => {
      const uid = s.uid || s.id;
      const sum = statsSummary(s);
      return { uid, name: nameOf.get(uid) || "Elev", classId: s.classId || "", correct: sum.correct, incorrect: sum.incorrect };
    })
    .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name, "sv"))
    .slice(0, RESULT_STUDENTS_MAX);
  const tables = TABLES.map((t) => ({ table: t, correct: 0, wrong: 0 }));
  let correct = 0;
  let incorrect = 0;
  for (const s of stats || []) {
    const sum = statsSummary(s);
    correct += sum.correct;
    incorrect += sum.incorrect;
    sum.tables.forEach((r, i) => {
      tables[i].correct += r.correct;
      tables[i].wrong += r.wrong;
    });
  }
  const w = top[0];
  return {
    savedAt: now,
    winner: w ? { uid: w.uid, name: w.name, classId: w.classId, correct: w.correct } : null,
    winnerClass: klasser[0] && klasser[0].correct > 0 ? klasser[0].classId : null,
    // Delad förstaplats (samma poäng/elev) = alla delade vinnare – Klasscentrets
    // pokal mm-klasskamp (#495) går till var och en (firestore.rules läser fältet).
    winnerClasses: plats(klasser, 1),
    // Plats 2 och 3 (#528) → pokalerna mm-silver/mm-brons; reglerna kräver
    // dessutom minst 3 deltagande klasser (kc-pokal-typer MM_PLATS_MIN_KLASSER).
    silverClasses: plats(klasser, 2),
    bronzeClasses: plats(klasser, 3),
    top,
    classes: klasser.map(({ rank, classId, name, correct: c, students: n, score }) => ({ rank, classId, name, correct: c, students: n, score })),
    students,
    totals: { correct, incorrect, total: correct + incorrect, participants: students.length },
    tables,
  };
}

/**
 * Klasstabellens rader: en rad per elev i klassen, även de som inte svarat.
 * @param {object[]} students   [{ id, namn, username, avatarId }]
 * @param {Map<string,object>} statsById  uid → studentStats-dokument
 */
export function studentRows(students, statsById) {
  return (students || []).map((s) => {
    const raw = statsById?.get?.(s.id) || null;
    const sum = statsSummary(raw);
    return {
      studentId: s.id,
      namn: String(s.namn || s.username || s.id),
      started: sum.total > 0,
      correct: sum.correct,
      incorrect: sum.incorrect,
      total: sum.total,
      pctCorrect: sum.total > 0 ? sum.pctCorrect : null,
      pctWrong: sum.total > 0 ? sum.pctWrong : null,
      summary: sum,
    };
  });
}

const SKOLAN = "Hela skolan";

/** Felprocent med en decimal: fel / (rätt + fel); inga svar → null. */
function felprocent(correct, incorrect) {
  const total = correct + incorrect;
  return total > 0 ? Math.round((incorrect / total) * 1000) / 10 : null;
}

/** 12.5 → "12,5 %", null → "–". */
export function formatFelprocent(pctWrong) {
  return pctWrong == null ? "–" : `${pctWrong.toFixed(1).replace(".", ",")} %`;
}

const summa = (rows) => {
  const correct = rows.reduce((s, r) => s + r.correct, 0);
  const incorrect = rows.reduce((s, r) => s + r.incorrect, 0);
  return { correct, incorrect, total: correct + incorrect, pctWrong: felprocent(correct, incorrect) };
};

/**
 * Totalt rätt/fel/felprocent per klass, per årskurs och för hela skolan (#863).
 * @param {object} a
 * @param {object[]} a.stats            studentStats-dokument ELLER result.students
 *                                      ({ classId, correct, incorrect } räcker)
 * @param {object[]} a.classes          [{ id, name }] (namn; saknas → id)
 * @param {string[]} a.participatingIds matchens klasser (ordning = klassnamn)
 * @param {Set<string>|null} [a.classIds] årskurskontots klasser (null = admin, alla)
 * @param {object|null} [a.skola]       hela skolans totals när raderna är
 *                                      filtrerade (result.totals); annars
 *                                      summan av raderna
 * @returns {{ rows, arskurser, skola, filtrerad }}
 *   rows      [{ classId, name, correct, incorrect, total, pctWrong }] per klass
 *   arskurser [{ ak, label, correct, incorrect, total, pctWrong }] – bara när
 *             klasserna spänner över mer än en årskurs, annars []
 *   skola     { correct, incorrect, total, pctWrong } – hela skolan, eller
 *             null när kontot bara ser sina klasser och ingen skoltotal finns
 *   mina      summan av rows när de är filtrerade ("Mina klasser"), annars null
 *   filtrerad true när rows inte är alla matchens klasser (årskurskonto)
 */
export function classTotals({ stats, classes, participatingIds, classIds = null, skola = null }) {
  const byId = new Map((classes || []).map((k) => [k.id, k]));
  const alla = [...new Set(participatingIds || [])];
  const mina = classIds ? alla.filter((id) => classIds.has(id)) : alla;
  const sum = new Map(mina.map((id) => [id, { correct: 0, incorrect: 0 }]));
  for (const s of stats || []) {
    const acc = s && sum.get(s.classId);
    if (!acc) continue;
    acc.correct += Math.max(0, Number(s.correct) || 0);
    acc.incorrect += Math.max(0, Number(s.incorrect) || 0);
  }
  const rows = mina
    .map((classId) => {
      const { correct, incorrect } = sum.get(classId);
      const name = String(byId.get(classId)?.name || classId);
      return { classId, name, ak: arskursAvKlass(name), correct, incorrect, total: correct + incorrect, pctWrong: felprocent(correct, incorrect) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  // Delsumma per årskurs (#845 arskursAvKlass) – bara om det finns fler än en.
  const perAk = new Map();
  for (const r of rows) {
    if (!perAk.has(r.ak)) perAk.set(r.ak, []);
    perAk.get(r.ak).push(r);
  }
  const akOrdning = [...perAk.keys()].sort((a, b) => (a === OVRIGA ? 1 : b === OVRIGA ? -1 : a - b));
  // (och någon årskurs har fler än en klass – annars vore delsumman = klassraden).
  const arskurser = perAk.size > 1 && [...perAk.values()].some((l) => l.length > 1)
    ? akOrdning.map((ak) => ({ ak, label: arskursLabel(ak), ...summa(perAk.get(ak)) }))
    : [];
  const filtrerad = mina.length !== alla.length;
  const egen = summa(rows);
  // Hela skolan: det sparade result.totals när det finns (räknat på ALLA
  // elever vid avslutet – result.students är kapat vid RESULT_STUDENTS_MAX),
  // annars summan av raderna; filtrerade rader utan skoltotal → ingen rad.
  let total = egen;
  if (skola && Number.isFinite(Number(skola.correct))) {
    const c = Math.max(0, Number(skola.correct) || 0);
    const w = Math.max(0, Number(skola.incorrect) || 0);
    total = { correct: c, incorrect: w, total: c + w, pctWrong: felprocent(c, w) };
  } else if (filtrerad) {
    total = null;
  }
  return { rows, arskurser, skola: total, mina: filtrerad ? egen : null, filtrerad, skolanLabel: SKOLAN };
}

/** Kolumner i visningsordning (spec: Elev | Rätt | Fel | Totalt | Rätt % | Fel %). */
export const MM_COLUMNS = [
  { key: "namn", label: "Elev", num: false },
  { key: "correct", label: "Rätt", num: true },
  { key: "incorrect", label: "Fel", num: true },
  { key: "total", label: "Totalt", num: true },
  { key: "pctCorrect", label: "Rätt %", num: true },
  { key: "pctWrong", label: "Fel %", num: true },
];

/** Sortera; lika → namn, saknade värden (elev utan svar) alltid sist. */
export function sortMmRows(rows, key = "namn", dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  const byName = (a, b) => a.namn.localeCompare(b.namn, "sv");
  return (rows || []).slice().sort((a, b) => {
    if (key === "namn") return sign * byName(a, b);
    const va = a[key];
    const vb = b[key];
    const na = va == null;
    const nb = vb == null;
    if (na || nb) return na === nb ? byName(a, b) : na ? 1 : -1;
    return sign * (va - vb) || byName(a, b);
  });
}

/** Nästa sorteringsläge efter klick (talkolumner sorterar fallande först). */
export function nextMmSort(current, key) {
  if (current && current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  const col = MM_COLUMNS.find((c) => c.key === key);
  return { key, dir: col && col.num ? "desc" : "asc" };
}

const fmtDag = (ms) =>
  new Date(ms).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "");
const fmtTid = (ms) => new Date(ms).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

/** "12 okt 08:00 – 23 okt 15:00" (år läggs till om perioden inte är i år). */
export function formatPeriod(comp, now = Date.now()) {
  const s = toMs(comp?.startAt);
  const e = toMs(comp?.endAt);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return "–";
  const year = new Date(e).getFullYear() !== new Date(now).getFullYear() ? ` ${new Date(e).getFullYear()}` : "";
  return `${fmtDag(s)} ${fmtTid(s)} – ${fmtDag(e)} ${fmtTid(e)}${year}`;
}
