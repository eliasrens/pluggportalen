// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6): REN LOGIK för projektor-
// vyerna. Ingen DOM, ingen Firebase – testas i test/live-guldrush-projektor
// .test.js. Vyerna ritar bara det som räknas ut här; guld och placering kommer
// ALLTID ur serverns grPlayers/grEvents (designspec §1), aldrig ur en animation.
//
// INGEN UTHÄNGNING (Elias 2026-10-10, gäller alla Live-lägen): projektorn
// visar ingen namnlista eller guld per elev under spelet. Skattkammarens topp
// 10 är avatarer vid sina guldhögar – utan namn, utan siffror, utan
// placeringsnummer. Statistiken är anonym (klassen som helhet). Namn syns
// bara på pallen (topp 3) och i händelseflödet om läraren valt "Visa namn".
//
// API
//   GR_TOP                        10 guldhögar
//   GR_TICK_S                     tick sista 10 s
//   matchClock(s, now)            → { msLeft, secs, text, tension, phase }
//   topPiles(players, n?)         → de n rikaste (guld > 0), rank-ordning
//   pileSlot(i)                   → { row: 0 fram | 1 bak, col 0–4 } – rikast
//                                   i mitten, sedan utåt (ett berg av högar)
//   createPileScale(min?)         → { ref(maxGold) } – skalans tak höjs bara
//                                   (en hög krymper bara när DEN tappar guld)
//   pileLevel(gold, ref)          → 0.18–1 (höjd som andel av max)
//   feedItem(ev, { names })       → händelseflödets post (text, stor?, ljud,
//                                   reaktioner) ur ett grEvents-dokument
//   podiumGroups(players)         → [{ rank, players }] ≤ 3 steg, delad plats
//   classTitle(s)                 → "4B" / "4B + 5E"
//   togetherText(s, gold)         → "Tillsammans samlade 4B 4 380 guld!"
//   statSummary(standing)         → klassens anonyma siffror (statistikvyn)
//   goldBuckets(players, n?)      → anonym fördelning: [{ from, to, count }]
//   createRate({ windowMs? })     → { add(total, now), perMin(now) } – svar/min
//   tal(n)                        → "2 140"
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import { chestById, eventText } from "./delat/guldrush-regler.js";

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

// Kolumnordning per rad: index i raden (0 = rikast) → kolumn. Rikast i
// mitten, sedan växelvis vänster/höger – högarna bildar ett berg.
const COLS = [2, 1, 3, 0, 4];

export function pileSlot(i) {
  const row = i < 5 ? 0 : 1;
  return { row, col: COLS[i % 5] };
}

const NICE = [1, 1.5, 2, 3, 5, 7.5, 10];

function niceCeil(v) {
  if (!(v > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return p * NICE.find((m) => m * p >= v);
}

/** Skalans tak följer den rikaste men sänks aldrig (ingen hög krymper av att någon annan växer … för mycket). */
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

/**
 * Händelseflödets post. ev = grEvents-dokumentet ({ id, type, chest?, uid,
 * name, victimUid?, victimName?, amount }). Stora händelser (designspec §6.3):
 * Skattkammare, Byte och ledningsbyte → banderoll. Ljud enligt §8: stöld =
 * tassar + klirr, stor händelse = kort fanfar, ledningsbyte = swoosh.
 */
export function feedItem(ev, { names = true } = {}) {
  const chest = chestById(ev?.chest);
  const type = ev?.type || "chest";
  const item = {
    id: ev?.id ?? null,
    type,
    chest: chest?.id || null,
    uid: ev?.uid || null,
    victimUid: ev?.victimUid || null,
    text: eventText(ev, { names }),
    icon: type === "lead" ? "⭐" : type === "shieldBlock" ? "🛡️" : chest?.icon || "💰",
    big: false,
    tone: "",
    cue: null,
    banner: null,
    reactions: [],
  };
  const who = names ? ev?.name || "" : "";
  if (type === "lead") {
    item.big = true;
    item.cue = "swoosh";
    item.banner = { icon: "⭐", title: "Ny ledare!", sub: who, tone: "gold" };
    item.reactions = [{ uid: item.uid, reaction: "jubel" }];
  } else if (type === "swap") {
    item.big = true;
    item.cue = "fanfarKort";
    item.banner = { icon: "🔄", title: "BYTE!", sub: names ? `${who} och ${ev?.victimName || ""} bytte guld` : "Två skattjägare bytte guld", tone: "blue" };
    item.reactions = [{ uid: item.uid, reaction: "glad" }, { uid: item.victimUid, reaction: "aj" }];
  } else if (type === "steal") {
    item.cue = "stold";
    item.reactions = [{ uid: item.uid, reaction: "glad" }, { uid: item.victimUid, reaction: "aj" }];
  } else if (type === "shieldBlock") {
    item.cue = "vosh";
    item.reactions = [{ uid: item.victimUid, reaction: "skyddad" }];
  } else if (chest) {
    const kind = chest.effect?.kind;
    if (chest.id === "skattkammare") {
      item.big = true;
      item.cue = "fanfarKort";
      item.tone = "gold";
      item.banner = { icon: "👑", title: "SKATTKAMMARE!", sub: names ? `${who} hittade ${tal(ev?.amount)} guld` : `+${tal(ev?.amount)} guld`, tone: "gold" };
      item.reactions = [{ uid: item.uid, reaction: "jubel" }];
    } else if (kind === "lose") item.reactions = [{ uid: item.uid, reaction: "aj" }];
    else if (kind === "shield") item.reactions = [{ uid: item.uid, reaction: "skyddad" }];
    else if (kind === "gold" || kind === "double") item.reactions = [{ uid: item.uid, reaction: "glad" }];
  }
  item.reactions = item.reactions.filter((r) => r.uid);
  return item;
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

/** Klassens siffror – anonyma (inga per elev). */
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

/** Anonym fördelning: hur många elever har 0, 1–49, 50–99 … guld (jämna, avrundade steg). */
export function goldBuckets(players, n = 6) {
  const golds = (players || []).map((p) => Math.max(0, Number(p.gold) || 0));
  const max = Math.max(0, ...golds);
  const step = Math.max(10, niceCeil(max / Math.max(1, n - 1)) || 10);
  const out = [{ from: 0, to: 0, count: 0 }];
  for (let i = 0; i < n - 1; i++) out.push({ from: i * step + (i ? 0 : 1), to: (i + 1) * step - 1, count: 0 });
  for (const g of golds) {
    if (!g) { out[0].count++; continue; }
    const ix = Math.min(n - 1, 1 + Math.floor(g / step));
    out[ix].count++;
  }
  out[out.length - 1].to = null; // sista = "och mer"
  return out;
}

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
    perMin(now) {
      const live = samples.filter(([t]) => now - t <= windowMs);
      if (live.length < 2) return 0;
      const [t0, a] = live[0];
      const [t1, b] = live[live.length - 1];
      const span = Math.max(10_000, t1 - t0);
      return Math.max(0, Math.round(((b - a) / span) * 60_000));
    },
  };
}
