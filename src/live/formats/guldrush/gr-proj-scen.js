// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6): REN LOGIK för projektor-
// vyerna. Ingen DOM, ingen Firebase – testas i test/live-guldrush-projektor
// .test.js. Vyerna ritar bara det som räknas ut här; guld och placering kommer
// ALLTID ur serverns grPlayers/grEvents (designspec §1), aldrig ur en animation.
//
// ENLIGT SPECEN (Elias 2026-10-10, #578): Guldrushen visar rangordning –
// Snilleblixtens "ingen uthängning" gäller inte här. Skattkammaren: topp 10
// som avatarer vid egna guldhögar, händelseflöde med namn och små avatarer
// (lärarens "Visa namn" av → inga namn och inga avatarer i flödet), banderoll
// vid Skattkammare, Byte och ledningsbyte. Statistiken: exakt ställning för
// alla elever. Trygghetsreglerna (§6.5) gäller: lekfulla mallar, inget hån.
//
// API
//   GR_TOP                        10 guldhögar
//   GR_TICK_S                     tick sista 10 s
//   GR_MILESTONES                 klassens gemensamma delmål (guld)
//   matchClock(s, now)            → { msLeft, secs, text, tension, phase }
//   topPiles(players, n?)         → de n rikaste (guld > 0), rank-ordning
//   pileSlot(i)                   → { row: 0 överst | 1 underst, col 0–4 } –
//                                   läsordning: 1–5 överst, 6–10 underst (#579)
//   createPileScale(min?)         → { ref(maxGold) } – skalans tak höjs bara
//                                   (en hög krymper bara när DEN tappar guld)
//   pileLevel(gold, ref)          → 0.18–1 (höjd som andel av taket)
//   isProtected(p, now)           → sköld eller stöldskydd (§6.5: sköld vid namnet)
//   milestone(total)              → { prev, next, frac } – nästa delmål
//   crossedMilestone(from, to)    → högsta delmål som passerades | null
//   feedItem(ev, { names })       → händelseflödets post (text, avatarer,
//                                   stor?, ljud, banderoll, reaktioner) | null
//                                   (null = visas inte: 0 guld tappat/dubblat)
//   weight(item) / trimPending(list, max?) → händelseflödets gallring vid
//                                   trängsel (småguld först, stora sist)
//   podiumGroups(players)         → [{ rank, players }] ≤ 3 steg, delad plats
//   classTitle(s)                 → "4B" / "4B + 5E"
//   togetherText(s, gold)         → "Tillsammans samlade 4B 4 380 guld!"
//   statSummary(standing)         → klassens siffror (statistikvyn)
//   standingRows(players, now)    → exakt ställning för alla elever
//                                   [{ uid, rank, name, gold, correct,
//                                   answered, share, shield }]
//   createRate({ windowMs? })     → { add(total, now), perMin(now) } – svar/min
//                                   (null de första 15 s – inget påhittat 0)
//   tal(n)                        → "2 140"
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import { chestById, eventText } from "./delat/guldrush-regler.js";
import { toMs } from "../../live-time.js";

export const GR_TOP = 10;
export const GR_TICK_S = 10;

export const tal = (n) => (Math.round(Number(n) || 0)).toLocaleString("sv-SE");

/** Matchens klocka ur serverstämplarna (kärnans phaseAt). */
export function matchClock(s, now) {
  const ph = phaseAt(s, now);
  const secs = Math.ceil(Math.max(0, ph.msLeft) / 1000);
  return {
    phase: ph.phase,
    msLeft: ph.msLeft,
    secs,
    text: formatClock(ph.msLeft),
    tension: ph.phase === "live" && secs <= GR_TICK_S,
  };
}

/** De n rikaste (bara guld > 0) – computeStandings-ordning (delad plats). */
export function topPiles(players, n = GR_TOP) {
  return (players || []).filter((p) => p && p.uid && p.gold > 0).slice(0, n);
}

// Läsordning som en text (Elias 2026-10-10, #579): plats 1–5 i översta raden
// och 6–10 i nedersta, vänster → höger.
export function pileSlot(i) {
  return { row: i < 5 ? 0 : 1, col: i % 5 };
}

const NICE = [1, 1.5, 2, 3, 5, 7.5, 10];

function niceCeil(v) {
  if (!(v > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return p * NICE.find((m) => m * p >= v);
}

/** Skalans tak följer den rikaste men sänks aldrig – en hög krymper bara när DEN tappar guld. */
export function createPileScale(min = 200) {
  let ref = min;
  return {
    ref(maxGold) {
      const want = niceCeil((Number(maxGold) || 0) * 1.1);
      if (want > ref) ref = want;
      return ref;
    },
  };
}

/** Höjd 0.18–1: roten ur andelen – små högar syns, stora växer lugnare. */
export function pileLevel(gold, ref) {
  const g = Math.max(0, Number(gold) || 0);
  if (!g || !(ref > 0)) return 0.18;
  return Math.min(1, 0.18 + 0.82 * Math.sqrt(Math.min(1, g / ref)));
}

/** Sköld (kista) eller stöldskydd efter stöld/byte – §6.5 "liten sköld vid namnet". */
export function isProtected(p, now) {
  return !!p?.shield || (toMs(p?.protectedUntil) ?? 0) > now;
}

export const GR_MILESTONES = Object.freeze([250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000]);

/** Nästa gemensamma delmål och hur långt klassen kommit dit (0–1). */
export function milestone(total) {
  const t = Math.max(0, Number(total) || 0);
  const next = GR_MILESTONES.find((m) => m > t) ?? null;
  const prev = [...GR_MILESTONES].reverse().find((m) => m <= t) ?? 0;
  return { prev, next, frac: next ? (t - prev) / (next - prev) : 1 };
}

/** Högsta delmål som passerades på vägen from → to (bara uppåt). */
export function crossedMilestone(from, to) {
  const a = Number(from) || 0;
  const b = Number(to) || 0;
  return [...GR_MILESTONES].reverse().find((m) => a < m && b >= m) ?? null;
}

const REACT = { gold: "glad", double: "glad", shield: "skyddad", lose: "aj" };

/**
 * Händelseflödets post. ev = grEvents-dokumentet ({ id, type, chest?, uid,
 * name, victimUid?, victimName?, amount }). Texten = kistkonfigens lekfulla
 * mall ("🦝 Alma knyckte 30 guld från Omar!"). names av (lärarens "Visa
 * namn") → "Någon"/"en klasskamrat" och inga avatarer. Stora händelser
 * (designspec §6.3): Skattkammare, Byte och ledningsbyte → banderoll. Ljud
 * (§8): stöld = tassar + klirr, stor händelse = kort fanfar, ledningsbyte =
 * swoosh. reactions = avatarernas reaktion vid guldhögarna.
 */
export function feedItem(ev, { names = true } = {}) {
  const type = ev?.type || "chest";
  const chest = chestById(ev?.chest);
  const kind = type === "chest" ? chest?.effect?.kind : type;
  // Tomma fickor: "tappade 0 guld" / "dubblade (+0)" säger inget – visas inte.
  if ((kind === "lose" || kind === "double") && !(Math.abs(Number(ev?.amount) || 0) > 0)) return null;
  const who = names ? ev?.name || "" : "";
  const item = {
    id: ev?.id ?? null,
    type,
    chest: chest?.id || null,
    text: eventText(ev, { names }),
    avatars: names ? [ev?.uid, ["steal", "swap", "shieldBlock"].includes(type) ? ev?.victimUid : null].filter(Boolean) : [],
    big: false,
    tone: "",
    cue: null,
    banner: null,
    reactions: [],
  };
  if (type === "lead") {
    item.big = true;
    item.tone = "gold";
    item.cue = "swoosh";
    item.banner = { icon: "⭐", title: who ? `Ny ledare: ${who}!` : "Ny ledare!", sub: "", tone: "gold" };
    item.reactions = [{ uid: ev?.uid, reaction: "jubel" }];
  } else if (type === "swap") {
    item.big = true;
    item.cue = "fanfarKort";
    item.banner = { icon: "🔄", title: "BYTE!", sub: names ? `${who} och ${ev?.victimName || ""} bytte guld` : "Två skattjägare bytte guld", tone: "blue" };
    item.reactions = [{ uid: ev?.uid, reaction: "glad" }, { uid: ev?.victimUid, reaction: "aj" }];
  } else if (type === "steal") {
    item.cue = "stold";
    item.reactions = [{ uid: ev?.uid, reaction: "glad" }, { uid: ev?.victimUid, reaction: "aj" }];
  } else if (type === "shieldBlock") {
    item.cue = "vosh";
    item.reactions = [{ uid: ev?.victimUid, reaction: "skyddad" }];
  } else if (chest?.id === "skattkammare") {
    item.big = true;
    item.cue = "fanfarKort";
    item.tone = "gold";
    item.banner = { icon: "👑", title: "SKATTKAMMARE!", sub: names ? `${who} hittade ${tal(ev?.amount)} guld` : `+${tal(ev?.amount)} guld`, tone: "gold" };
    item.reactions = [{ uid: ev?.uid, reaction: "jubel" }];
  } else if (REACT[kind]) item.reactions = [{ uid: ev?.uid, reaction: REACT[kind] }];
  item.reactions = item.reactions.filter((r) => r.uid);
  return item;
}

/** Hur viktig en post är när kön måste gallras (högre = behålls). */
export function weight(item) {
  if (item.big) return 3;
  if (["steal", "swap", "shieldBlock", "lead"].includes(item.type)) return 2;
  return item.type === "chest" && ["lite_guld", "tom"].includes(item.chest) ? 0 : 1;
}

/** Gallra kön: behåll högst max – släpp lägst vikt, äldst först. */
export function trimPending(list, max = 3) {
  const out = [...list];
  while (out.length > max) {
    let ix = 0;
    for (let i = 1; i < out.length; i++) if (weight(out[i]) < weight(out[ix])) ix = i;
    out.splice(ix, 1);
  }
  return out;
}

/** Pallsteg ur ställningen: högst tre steg, delad placering = samma steg, bara guld > 0. */
export function podiumGroups(players) {
  const groups = [];
  for (const p of players || []) {
    if (!(p.gold > 0) || p.rank > 3) continue;
    const g = groups.find((x) => x.rank === p.rank);
    if (g) g.players.push(p);
    else groups.push({ rank: p.rank, players: [p] });
  }
  return groups.sort((a, b) => a.rank - b.rank).slice(0, 3);
}

export function classTitle(s) {
  return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" + ");
}

export function togetherText(s, gold) {
  const k = classTitle(s);
  return `Tillsammans samlade ${k ? `${k} ` : "ni "}${tal(gold)} guld!`;
}

/** Klassens siffror (statistikvyn, ovanför ställningen). */
export function statSummary(standing) {
  const ps = standing?.players || [];
  const correct = ps.reduce((n, p) => n + (p.correct || 0), 0);
  const answered = ps.reduce((n, p) => n + (p.correct || 0) + (p.incorrect || 0), 0);
  return {
    joined: ps.length,
    active: ps.filter((p) => (p.correct || 0) + (p.incorrect || 0) > 0).length,
    totalGold: standing?.totalGold ?? ps.reduce((n, p) => n + (p.gold || 0), 0),
    correct,
    answered,
    share: answered ? Math.round((correct / answered) * 100) : 0,
    chests: ps.reduce((n, p) => n + (p.chests || 0), 0),
    classes: standing?.classes || [],
  };
}

/**
 * Exakt ställning för ALLA elever (funktionsspec §6.8): computeStandings-
 * ordningen (guld, delad plats vid lika). share = andel rätt i hela procent
 * (null innan eleven svarat).
 */
export function standingRows(players, now = 0) {
  return (players || []).filter((p) => p?.uid).map((p) => {
    const answered = (p.correct || 0) + (p.incorrect || 0);
    return {
      uid: p.uid,
      rank: p.rank,
      name: p.name || "",
      classId: p.classId ?? null,
      gold: p.gold || 0,
      correct: p.correct || 0,
      answered,
      share: answered ? Math.round(((p.correct || 0) / answered) * 100) : null,
      shield: isProtected(p, now),
    };
  });
}

const MIN_SPAN_MS = 15_000;

/** Svarsfrekvens: svar per minut över senaste fönstret (ur klassens totala antal svar). */
export function createRate({ windowMs = 60_000 } = {}) {
  let samples = []; // [ms, total]
  return {
    add(total, now) {
      const last = samples[samples.length - 1];
      if (last && last[1] === total && now - last[0] < 1000) return;
      samples.push([now, Number(total) || 0]);
      samples = samples.filter(([t]) => now - t <= windowMs + 1000);
    },
    /** null = har inte mätt länge nog än (minst MIN_SPAN_MS sedan första provet). */
    perMin(now) {
      const live = samples.filter(([t]) => now - t <= windowMs);
      if (!live.length || now - live[0][0] < MIN_SPAN_MS) return null;
      const [t0, a] = live[0];
      const [, b] = live[live.length - 1];
      const span = Math.max(MIN_SPAN_MS, now - t0);
      return Math.max(0, Math.round(((b - a) / span) * 60_000));
    },
  };
}
