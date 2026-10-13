// ============================================================================
// Kistspel 🎁 – PROJEKTORNS REN LOGIK (#651, utbruten ur Guldrushens
// gr-proj-scen.js #565/#578/#579/#591/#592). Ingen DOM, ingen Firebase.
// Saldo och placering kommer ALLTID ur serverns spelar-/händelsedokument,
// aldrig ur en animation. Valutaneutralt: temat (formatet) ger texter,
// delmål, banderoller och ljud via createProjScen(…).
//
// API (rena, samma för alla kistformat)
//   KS_TOP                        10 platser i topplistan
//   KS_TICK_S                     tick sista 10 s
//   tal(n)                        → "2 140"
//   matchClock(s, now)            → { msLeft, secs, text, tension, phase }
//   topPiles(players, n?)         → de n rikaste (saldo > 0), rank-ordning
//   pileSlot(i)                   → { row: 0 överst | 1 underst, col 0–4 } –
//                                   läsordning: 1–5 överst, 6–10 underst
//   createPileScale(min?)         → { ref(max) } – skalans tak höjs bara
//   pileLevel(gold, ref)          → 0.18–1 (höjd som andel av taket)
//   isProtected(p, now)           → skyddad just nu (ks-regler)
//   podiumGroups(players)         → [{ rank, players }] ≤ 3 steg, delad plats
//   classTitle(s)                 → "4B" / "4B + 5E"
//   statSummary(standing)         → klassens siffror (statistikvyn)
//   standingRows(players, now)    → exakt ställning för alla elever
//   createRate({ windowMs? })     → { add(total, now), perMin(now) } – svar/min
//
// TEMAT
//   createProjScen({
//     regler,       formatets createKistRegler (chestById, eventText)
//     milestones,   klassens gemensamma delmål (stigande lista)
//     title,        finalens rubrik ("🏆 Guldrushen – Prispall")
//     unit, icon?   totalradens enhet ("guld") och ikon ("💰")
//     feed: {
//       lead:  { cue, tone?, banner(who, ev, names) }   ledningsbyte
//       swap:  { cue, tone?, banner(who, ev, names) }   byte
//       steal: { cue }                                  stöld
//       bigChests: { [kistans id]: { cue, tone?, banner(who, ev, names) } }
//       small: [kistans id]  – gallras först vid trängsel
//     }
//   }) → { milestones, milestone(total), crossedMilestone(from, to),
//          feedItem(ev, { names }), weight(item), trimPending(list, max?),
//          FINAL_TITLE, togetherHtml(total) }
// ============================================================================

import { phaseAt, formatClock } from "../live-core.js";
import { isProtected } from "./delat/ks-regler.js";

export { isProtected };

export const KS_TOP = 10;
export const KS_TICK_S = 10;

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
    tension: ph.phase === "live" && secs <= KS_TICK_S,
  };
}

/** De n rikaste (bara saldo > 0) – computeStandings-ordning (delad plats). */
export function topPiles(players, n = KS_TOP) {
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

/** Skalans tak följer den rikaste men sänks aldrig – en hög krymper bara när DEN tappar. */
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

/** Pallsteg ur ställningen: högst tre steg, delad placering = samma steg, bara saldo > 0. */
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
 * Exakt ställning för ALLA elever: computeStandings-ordningen (saldo, delad
 * plats vid lika). share = andel rätt i hela procent (null innan eleven svarat).
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

// Stämning per effekt → avatarens reaktion vid topplistan.
const REACT = { gold: "glad", double: "glad", shield: "skyddad", lose: "aj" };
const FEED_TYPES = ["chest", "steal", "swap", "lead"];

export function createProjScen({ regler, milestones, title, unit, icon = "", feed }) {
  const { chestById, eventText } = regler;
  const MILESTONES = Object.freeze([...milestones]);
  const small = feed.small || [];
  const bigChests = feed.bigChests || {};

  /** Nästa gemensamma delmål och hur långt klassen kommit dit (0–1). */
  function milestone(total) {
    const t = Math.max(0, Number(total) || 0);
    const next = MILESTONES.find((m) => m > t) ?? null;
    const prev = [...MILESTONES].reverse().find((m) => m <= t) ?? 0;
    return { prev, next, frac: next ? (t - prev) / (next - prev) : 1 };
  }

  /** Högsta delmål som passerades på vägen from → to (bara uppåt). */
  function crossedMilestone(from, to) {
    const a = Number(from) || 0;
    const b = Number(to) || 0;
    return [...MILESTONES].reverse().find((m) => a < m && b >= m) ?? null;
  }

  /**
   * Händelseflödets post. ev = händelsedokumentet ({ id, type, chest?, uid,
   * name, victimUid?, victimName?, amount }). Texten = kistkonfigens mall;
   * names av → anon-namnen och inga avatarer. Stora händelser (temats
   * bigChests, byte, ledningsbyte) → banderoll. null = visas inte (0 tappat/
   * dubblat, okänd typ).
   */
  function feedItem(ev, { names = true } = {}) {
    const type = ev?.type || "chest";
    const chest = chestById(ev?.chest);
    const kind = type === "chest" ? chest?.effect?.kind : type;
    // Tomma fickor: "tappade 0" / "dubblade (+0)" säger inget – visas inte.
    if ((kind === "lose" || kind === "double") && !(Math.abs(Number(ev?.amount) || 0) > 0)) return null;
    const who = names ? ev?.name || "" : "";
    if (!FEED_TYPES.includes(type)) return null;
    const item = {
      id: ev?.id ?? null,
      type,
      chest: chest?.id || null,
      text: eventText(ev, { names }),
      short: eventText(ev, { names, short: true }),
      avatars: names ? [ev?.uid, ["steal", "swap"].includes(type) ? ev?.victimUid : null].filter(Boolean) : [],
      big: false,
      tone: "",
      cue: null,
      banner: null,
      reactions: [],
    };
    const big = type === "chest" ? bigChests[chest?.id] : null;
    if (type === "lead") {
      Object.assign(item, { big: true, tone: feed.lead.tone || "", cue: feed.lead.cue, banner: feed.lead.banner(who, ev, names) });
      item.reactions = [{ uid: ev?.uid, reaction: "jubel" }];
    } else if (type === "swap") {
      Object.assign(item, { big: true, tone: feed.swap.tone || "", cue: feed.swap.cue, banner: feed.swap.banner(who, ev, names) });
      item.reactions = [{ uid: ev?.uid, reaction: "glad" }, { uid: ev?.victimUid, reaction: "aj" }];
    } else if (type === "steal") {
      item.cue = feed.steal.cue;
      item.reactions = [{ uid: ev?.uid, reaction: "glad" }, { uid: ev?.victimUid, reaction: "aj" }];
    } else if (big) {
      Object.assign(item, { big: true, tone: big.tone || "", cue: big.cue, banner: big.banner(who, ev, names) });
      item.reactions = [{ uid: ev?.uid, reaction: "jubel" }];
    } else if (REACT[kind]) item.reactions = [{ uid: ev?.uid, reaction: REACT[kind] }];
    item.reactions = item.reactions.filter((r) => r.uid);
    return item;
  }

  /** Hur viktig en post är när kön måste gallras (högre = behålls). */
  function weight(item) {
    if (item.big) return 3;
    if (["steal", "swap", "lead"].includes(item.type)) return 2;
    return item.type === "chest" && small.includes(item.chest) ? 0 : 1;
  }

  /** Gallra kön: behåll högst max – släpp lägst vikt, äldst först. */
  function trimPending(list, max = 3) {
    const out = [...list];
    while (out.length > max) {
      let ix = 0;
      for (let i = 1; i < out.length; i++) if (weight(out[i]) < weight(out[ix])) ix = i;
      out.splice(ix, 1);
    }
    return out;
  }

  /** Finalens lugna totalrad (#592): "Tillsammans: <strong>4 380 guld</strong> 💰". */
  function togetherHtml(total) {
    return `Tillsammans: <strong>${tal(total)} ${unit}</strong>${icon ? ` ${icon}` : ""}`;
  }

  return { milestones: MILESTONES, milestone, crossedMilestone, feedItem, weight, trimPending, FINAL_TITLE: title, togetherHtml };
}
