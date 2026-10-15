// ============================================================================
// Bråkresan – lärarvyns statistik (src/brakresan/larare/statistik.js) · K #716
// ----------------------------------------------------------------------------
// REN logik (ingen DOM, ingen Firebase) – testas i Node
// (test/brakresan-larare-statistik.test.js). Allt räknas ur elevernas
// state-dokument (studentData/{id}/brakresa/state, ETT per elev, #231) –
// klassöversikten och matrisen läser aldrig omgångar eller 50 dokument per elev.
//
// Spec §12 "Exakta definitioner":
//   • bedömt svar = uppgiftens FÖRSTA giltiga inlämning (firstTotal/firstCorrect)
//   • träffsäkerhet = rätta första svar / bedömda första svar · 100; inga svar → null ("–")
//   • klassens träffsäkerhet = summan av rätt / summan av bedömda – inte ett elevmedel
//   • stöd före svar = andel bedömda uppgifter med hjälp före första kontroll
//   • bemästrade = utmaningar med exakt tre stjärnor
//   • "Inte tränat" är en egen status, aldrig 0 %
//   • klassindikator kräver ≥ 3 elever och ≥ 20 bedömda svar, annars "Litet underlag"
//
//   elevRad(student, state)       → raden i elevlistan (state null = kunde inte läsas)
//   klassSumma(rader)             → klassens summor + antal elever bakom dem
//   utmaningsAggregat(states)     → Map(id → klassens underlag per utmaning)
//   svaraOchLatta(agg)            → { svara, latta, litet, inteTranat }
//   momentOversikt(states)        → per kunskapstagg (TAGS), i katalogens taggordning
//   matrisCell(entry)             → { stars, status, symbol, label } – läsbar utan färg
//   elevUtmaningar(state)         → individvyns lista över alla 50
//   forslagElev(state)            → förslag som tydligt bygger på resultat (inga diagnoser)
//   stjarnkurva(events)           → kumulativa stjärnor över tid (progression)
//   omgangRad(round)              → en historisk omgång i ord
//   aktivSedan(rad, dagar, nu)    → periodfiltret (senaste riktiga spelaktivitet)
//   recDokument(rek, teacherId)   → rekommendationen i reglernas form (kastar vid fel)
// ============================================================================

import { CHALLENGES, CHALLENGE_IDS, TAGS, challengeMeta } from "../schema/katalog.js";
import { MAX_STARS_PER_CHALLENGE, ROUND_SIZE, accuracy, challengeStatus, isSmallSample } from "../schema/regler.js";

/** Firestore-Timestamp, { seconds }, Date, tal eller ISO-text → ms (null om okänt). */
export function ms(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

const pct = (del, av) => (av > 0 ? Math.round((100 * del) / av) : null);
const entries = (state) => Object.entries(state?.challenges || {}).filter(([id]) => challengeMeta(id));

/** Totaler ur state.totals – eller summerade ur utmaningarna om totals saknas. */
function totaler(state) {
  const t = state?.totals;
  if (t && Number.isFinite(t.firstTotal)) return t;
  const s = { roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0 };
  for (const [, e] of entries(state)) for (const k of Object.keys(s)) s[k] += e[k] || 0;
  return s;
}

/** En rad i klassens elevlista (§12 Klassöversikt). */
export function elevRad(student, state) {
  const namn = student?.namn || student?.username || student?.id || "";
  if (!state) return { studentId: student?.id, namn, saknas: true, started: false };
  const t = totaler(state);
  const lista = entries(state);
  const active = lista.filter(([, e]) => e.activeRoundId).length;
  return {
    studentId: student?.id,
    namn,
    saknas: false,
    started: (t.firstTotal || 0) > 0 || (t.roundsCompleted || 0) > 0 || active > 0,
    stars: state.totalStars || 0,
    mastered: state.mastered ?? lista.filter(([, e]) => (e.stars || 0) >= MAX_STARS_PER_CHALLENGE).length,
    roundsCompleted: t.roundsCompleted || 0,
    roundsAborted: t.roundsAborted || 0,
    activeRounds: active,
    firstCorrect: t.firstCorrect || 0,
    firstTotal: t.firstTotal || 0,
    accuracy: accuracy(t.firstCorrect || 0, t.firstTotal || 0),
    helpBefore: t.helpBefore || 0,
    helpBeforePct: pct(t.helpBefore || 0, t.firstTotal || 0),
    helpAfter: t.helpAfter || 0,
    lastActivity: ms(state.lastActivityAt),
  };
}

/** Klassens summor. `elever` = antal elever summan bygger på (§12: "så summan kan förstås"). */
export function klassSumma(rader) {
  const lasta = rader.filter((r) => !r.saknas);
  const sum = (k) => lasta.reduce((s, r) => s + (r[k] || 0), 0);
  const firstCorrect = sum("firstCorrect");
  const firstTotal = sum("firstTotal");
  return {
    elever: lasta.length,
    saknas: rader.length - lasta.length,
    started: lasta.filter((r) => r.started).length,
    stars: sum("stars"),
    maxStars: lasta.length * MAX_STARS_PER_CHALLENGE * CHALLENGES.length,
    mastered: sum("mastered"),
    roundsCompleted: sum("roundsCompleted"),
    firstCorrect,
    firstTotal,
    accuracy: accuracy(firstCorrect, firstTotal), // summan av rätt / summan av bedömda
    helpBeforePct: pct(sum("helpBefore"), firstTotal),
  };
}

/** Klassens underlag per utmaning. `states` = elevernas state (null hoppas över). */
export function utmaningsAggregat(states) {
  const agg = new Map(CHALLENGES.map((c) => [c.id, {
    id: c.id, meta: c, students: 0, answers: 0, correct: 0, rounds: 0, helpBefore: 0, stars: 0, mastered: 0,
  }]));
  for (const s of states) {
    if (!s) continue;
    for (const [id, e] of entries(s)) {
      const a = agg.get(id);
      if ((e.firstTotal || 0) > 0) a.students += 1;
      a.answers += e.firstTotal || 0;
      a.correct += e.firstCorrect || 0;
      a.rounds += (e.roundsCompleted || 0) + (e.roundsAborted || 0);
      a.helpBefore += e.helpBefore || 0;
      a.stars += e.stars || 0;
      if ((e.stars || 0) >= MAX_STARS_PER_CHALLENGE) a.mastered += 1;
    }
  }
  for (const a of agg.values()) {
    a.accuracy = accuracy(a.correct, a.answers);
    a.inteTranat = a.answers === 0;
    a.litetUnderlag = !a.inteTranat && isSmallSample(a.students, a.answers);
    a.roundsPerStudent = a.students ? a.rounds / a.students : 0;
  }
  return agg;
}

/** Gränserna för klassens indikatorer (bara när underlaget räcker, §12). */
export const SVAR_GRANS = 65;
export const LATT_GRANS = 85;

/**
 * Utmaningar med låg respektive god träffsäkerhet – bara med tillräckligt underlag.
 * Svåra sorteras på lägst träffsäkerhet och därefter flest omgångar per elev.
 */
export function svaraOchLatta(agg, { max = 5 } = {}) {
  const alla = [...agg.values()];
  const nog = alla.filter((a) => !a.inteTranat && !a.litetUnderlag);
  return {
    svara: nog.filter((a) => a.accuracy < SVAR_GRANS)
      .sort((x, y) => x.accuracy - y.accuracy || y.roundsPerStudent - x.roundsPerStudent).slice(0, max),
    latta: nog.filter((a) => a.accuracy >= LATT_GRANS).sort((x, y) => y.accuracy - x.accuracy || y.answers - x.answers).slice(0, max),
    litet: alla.filter((a) => a.litetUnderlag),
    inteTranat: alla.filter((a) => a.inteTranat),
  };
}

/** Momentöversikten per kunskapstagg (en utmaning kan ha två taggar och räknas då i båda). */
export function momentOversikt(states) {
  const lasta = states.filter(Boolean);
  return Object.entries(TAGS).map(([tag, label]) => {
    const ids = CHALLENGES.filter((c) => c.tags.includes(tag)).map((c) => c.id);
    let students = 0;
    let answers = 0;
    let correct = 0;
    let stars = 0;
    let helpBefore = 0;
    for (const s of lasta) {
      let tranat = false;
      for (const id of ids) {
        const e = s.challenges?.[id];
        if (!e) continue;
        if ((e.firstTotal || 0) > 0) tranat = true;
        answers += e.firstTotal || 0;
        correct += e.firstCorrect || 0;
        stars += e.stars || 0;
        helpBefore += e.helpBefore || 0;
      }
      if (tranat) students += 1;
    }
    return {
      tag, label, challengeIds: ids, students, answers, correct, stars,
      maxStars: ids.length * MAX_STARS_PER_CHALLENGE * lasta.length,
      accuracy: accuracy(correct, answers),
      helpBeforePct: pct(helpBefore, answers),
      inteTranat: answers === 0,
      litetUnderlag: answers > 0 && isSmallSample(students, answers),
    };
  });
}

/** Matriscellens symbol per status – färgen är bara ett komplement (§12). */
export const SYMBOL = Object.freeze({
  "inte-paborjad": "–",
  tranar: "↻",
  pagaende: "◔",
  stjarnor: "",
  bemastrad: "✓",
});

/** Matriscellen: 0–3 stjärnor + symbol + text för skärmläsare/title. */
export function matrisCell(entry) {
  const e = entry || {};
  const { status, label } = challengeStatus(e);
  const stars = Math.min(MAX_STARS_PER_CHALLENGE, e.stars || 0);
  const acc = accuracy(e.firstCorrect || 0, e.firstTotal || 0);
  const delar = [label];
  if (status === "pagaende" && stars > 0) delar.push(`${stars} av 3 stjärnor`);
  if (acc !== null) delar.push(`${e.firstCorrect || 0} av ${e.firstTotal} första svar rätt`);
  return { stars, status, symbol: SYMBOL[status], label: delar.join(" · ") };
}

/** Individvyns kategori (§12: "försökt utan stjärna/inte försökt/bemästrad"). */
function kategori(e) {
  const stars = e.stars || 0;
  if (stars >= MAX_STARS_PER_CHALLENGE) return "bemastrad";
  if (stars > 0) return "stjarnor";
  if ((e.firstTotal || 0) > 0 || e.activeRoundId || (e.roundsCompleted || 0) > 0) return "forsokt-utan-stjarna";
  return "inte-forsokt";
}
export const KATEGORI_TEXT = Object.freeze({
  bemastrad: "Bemästrad",
  stjarnor: "Har stjärnor",
  "forsokt-utan-stjarna": "Försökt utan stjärna",
  "inte-forsokt": "Inte försökt",
});

/** Alla 50 utmaningar för en elev, i katalogordning. */
export function elevUtmaningar(state) {
  return CHALLENGES.map((c) => {
    const e = state?.challenges?.[c.id] || {};
    return {
      id: c.id, nr: c.nr, name: c.name, section: c.section, meta: c,
      stars: Math.min(MAX_STARS_PER_CHALLENGE, e.stars || 0),
      status: challengeStatus(e),
      kategori: kategori(e),
      roundsCompleted: e.roundsCompleted || 0,
      roundsAborted: e.roundsAborted || 0,
      active: !!e.activeRoundId,
      activeAnswered: e.activeAnswered || 0,
      best: Number.isInteger(e.best) ? e.best : null,
      last: Number.isInteger(e.last) ? e.last : null,
      firstCorrect: e.firstCorrect || 0,
      firstTotal: e.firstTotal || 0,
      accuracy: accuracy(e.firstCorrect || 0, e.firstTotal || 0),
      helpBefore: e.helpBefore || 0,
      helpAfter: e.helpAfter || 0,
      lastAt: ms(e.lastAt),
    };
  });
}

/** "12", "14" och "21" → "12, 14 och 21". */
export function idLista(ids) {
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} och ${ids[ids.length - 1]}`;
}
const gemen = (s) => s.charAt(0).toLocaleLowerCase("sv") + s.slice(1);

/** Minsta underlag (bedömda första svar inom momentet) för ett förslag. */
export const FORSLAG_MIN_SVAR = 6;
export const FORSLAG_GRANS = 70;

/**
 * Förslag på träning som tydligt bygger på elevens resultat (§12), t.ex.
 * "Öva likvärdiga bråk: 5 av 12 första svar rätt i 12 och 14". Läraren tolkar –
 * inga diagnoser eller betyg. Stöd före svar är information, aldrig ett fel.
 * @returns {{ ova: object[], bra: object[] }}
 */
export function forslagElev(state, { max = 3 } = {}) {
  const ova = [];
  const bra = [];
  for (const [tag, label] of Object.entries(TAGS)) {
    const ids = [];
    let c = 0;
    let t = 0;
    let hjalp = 0;
    for (const ch of CHALLENGES) {
      const e = state?.challenges?.[ch.id];
      if (!ch.tags.includes(tag) || !e || !(e.firstTotal > 0)) continue;
      ids.push(ch.id);
      c += e.firstCorrect || 0;
      t += e.firstTotal;
      hjalp += e.helpBefore || 0;
    }
    if (t < FORSLAG_MIN_SVAR) continue;
    const acc = accuracy(c, t);
    const underlag = `${c} av ${t} första svar rätt i ${idLista(ids)}`;
    const stod = hjalp > 0 ? ` · stöd före svar i ${hjalp} av ${t} uppgifter` : "";
    if (acc < FORSLAG_GRANS) ova.push({ tag, accuracy: acc, ids, text: `Öva ${gemen(label)}: ${underlag}${stod}` });
    else if (acc >= LATT_GRANS && t >= 10) bra.push({ tag, accuracy: acc, ids, text: `${label}: ${underlag}${stod}` });
  }
  ova.sort((x, y) => x.accuracy - y.accuracy);
  bra.sort((x, y) => y.accuracy - x.accuracy);
  return { ova: ova.slice(0, max), bra: bra.slice(0, max) };
}

/**
 * Progression över tid ur stjärnhändelserna (brakresaRewards, type "stjarna"):
 * [{ t, total, challengeId }] kumulativt, äldst först.
 */
export function stjarnkurva(events = []) {
  const lista = events
    .filter((e) => e && e.type === "stjarna" && ms(e.createdAt) != null)
    .map((e) => ({ t: ms(e.createdAt), challengeId: e.challengeId || null }))
    .sort((a, b) => a.t - b.t);
  return lista.map((e, i) => ({ ...e, total: i + 1 }));
}

const STATUS_OMGANG = Object.freeze({ aktiv: "Pågår", avslutad: "Avslutad", avbruten: "Avbruten" });

/** En historisk omgång i ord: datum, resultat, stöd och bearbetning. */
export function omgangRad(round) {
  const svar = Array.isArray(round?.answers) ? round.answers : [];
  const besvarade = svar.filter((a) => a?.first);
  const ratt = besvarade.filter((a) => a.first.correct === true).length;
  const stodFore = besvarade.filter((a) => (a.helpBefore || []).length > 0).length;
  const stodEfter = svar.filter((a) => (a?.helpAfter || []).length > 0).length;
  const bearbetning = svar.reduce((s, a) => s + ((a?.rework || []).length), 0);
  const status = round?.status || "aktiv";
  const reward = round?.reward || null;
  return {
    roundId: round?.roundId || null,
    challengeId: round?.challengeId || null,
    status,
    statusText: STATUS_OMGANG[status] || status,
    mode: round?.mode || "elev",
    version: round?.version ?? null,
    startedAt: ms(round?.startedAt),
    finishedAt: ms(round?.finishedAt),
    besvarade: besvarade.length,
    ratt,
    stodFore,
    stodEfter,
    bearbetning,
    resultat: status === "avslutad" ? `${ratt} av ${ROUND_SIZE} rätt` : `${besvarade.length}/${ROUND_SIZE} besvarade, ${ratt} rätt`,
    beloning: reward?.kind === "stjarna" ? `Stjärna ${reward.starOrdinal ?? ""}`.trim()
      : reward?.kind === "uppmuntran" ? "Uppmuntransmynt"
        : reward?.kind === "repetition" ? "Repetition" : null,
  };
}

/** Periodfiltret: har eleven sparad spelaktivitet de senaste `dagar` dagarna? (0/null = alla) */
export function aktivSedan(rad, dagar, nu = Date.now()) {
  if (!dagar) return true;
  return rad.lastActivity != null && rad.lastActivity >= nu - dagar * 86_400_000;
}

/**
 * Rekommendationsdokumentet i den form firestore.rules kräver (brRecShapeOk):
 * exakt ett mål, kända id (sorterade, unika), kommentar ≤ 200 tecken. createdAt läggs av data-larare.js.
 */
export function recDokument({ classId = null, studentId = null, challengeIds, comment = null }, teacherId) {
  if (!!classId === !!studentId) throw new Error("Välj antingen klassen eller en elev.");
  const ids = [...new Set(challengeIds || [])].filter((id) => CHALLENGE_IDS.includes(id)).sort();
  if (!ids.length) throw new Error("Välj minst en utmaning.");
  const text = typeof comment === "string" ? comment.trim().slice(0, 200) : "";
  return {
    teacherId, classId: classId || null, studentId: studentId || null,
    challengeIds: ids, comment: text || null, active: true,
  };
}
