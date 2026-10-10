// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6): REN LOGIK för projektor-
// vyerna. Ingen DOM, ingen Firebase – testas i test/live-guldrush-projektor
// .test.js. Vyerna ritar bara det som räknas ut här; guld och placering kommer
// ALLTID ur serverns grPlayers/grEvents (designspec §1), aldrig ur en animation.
//
// INGEN UTHÄNGNING (Elias 2026-10-10, gäller alla Live-lägen; leaden #562):
// projektorn visar ingen namnlista, ingen topplista och inget guld per elev
// under spelet – inte heller avatarer i rangordning (de känns igen). Mitten är
// klassens EGET guldberg (ett per klass) som växer mot gemensamma delmål.
// Namn/avatarer syns bara i lobbyn, på pallen (topp 3) och i händelseflödet
// om läraren valt "Visa namn" – och där bara för den som haft TUR: den som
// blir bestulen, tappar guld eller hittar ett löv namnges aldrig. Inget
// "Ny ledare" (det är en rangordning). Statistiken är anonym.
//
// API
//   GR_TICK_S                     tick sista 10 s
//   GR_MILESTONES                 klassens gemensamma delmål (guld)
//   matchClock(s, now)            → { msLeft, secs, text, tension, phase }
//   bergLevel(gold)               → 0.18–1 – bergets höjd, monoton i guldet
//                                   (samma skala hela matchen)
//   milestone(total)              → { prev, next, frac } – nästa delmål
//   crossedMilestone(from, to)    → högsta delmål som passerades | null
//   feedItem(ev, { names })       → händelseflödets post (varsam text, ev.
//                                   avatar, stor?, ljud, banderoll) | null
//                                   (null = visas inte: ledningsbyte, 0 guld
//                                   tappat/dubblat)
//   weight(item) / trimPending(list, max?) → händelseflödets gallring vid
//                                   trängsel (småguld först, stora sist)
//   podiumGroups(players)         → [{ rank, players }] ≤ 3 steg, delad plats
//   classTitle(s)                 → "4B" / "4B + 5E"
//   togetherText(s, gold)         → "Tillsammans samlade 4B 4 380 guld!"
//   statSummary(standing)         → klassens anonyma siffror (statistikvyn)
//   goldBuckets(players, n?)      → anonym fördelning: [{ from, to, count }]
//   createRate({ windowMs? })     → { add(total, now), perMin(now) } – svar/min
//                                   (null de första 15 s – inget påhittat 0)
//   tal(n)                        → "2 140"
// ============================================================================

import { phaseAt, formatClock } from "../../live-core.js";
import { chestById, eventText } from "./delat/guldrush-regler.js";
import { GR_ANON } from "./delat/chests-config.js";

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

const NICE = [1, 1.5, 2, 3, 5, 7.5, 10];

function niceCeil(v) {
  if (!(v > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return p * NICE.find((m) => m * p >= v);
}

// Bergets höjd: logaritmisk mot BERG_FULL guld – samma skala hela matchen,
// så berget växer för varje guldmynt och krymper bara när guld försvinner.
const BERG_FULL = 30_000;

/** Höjd 0.18–1 ur guldet (monoton – ingen omskalning mitt i matchen). */
export function bergLevel(gold) {
  const g = Math.max(0, Number(gold) || 0);
  return Math.min(1, 0.18 + 0.82 * (Math.log10(1 + g / 100) / Math.log10(1 + BERG_FULL / 100)));
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

// Projektorns varsamma mallar (offer/otur namnges aldrig) – kistor som bara
// ger guld/sköld använder kistkonfigens egen eventText.
const SAFE = {
  steal: "🦝 {namn} knyckte {belopp} guld från en klasskamrat!",
  swap: "🔄 {namn} bytte guld med en klasskamrat!",
  shieldBlock: "🛡️ {offer}s sköld stoppade en tjuv!",
  lose: "🕳️ Hoppsan! Någon tappade {belopp} guld.",
  empty: "🍃 Någon hittade bara ett löv.",
};
const SAFE_ANON = { shieldBlock: "🛡️ En sköld stoppade en tjuv!" };

const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/**
 * Händelseflödets post. ev = grEvents-dokumentet ({ id, type, chest?, uid,
 * name, victimUid?, victimName?, amount }). null = visas inte (ledningsbyte
 * är en rangordning). Stora händelser (designspec §6.3) → banderoll:
 * Skattkammare och Byte. Ljud enligt §8: stöld = tassar + klirr, stor
 * händelse = kort fanfar. avatarUid bara när namn visas och bara för den
 * som haft tur.
 */
export function feedItem(ev, { names = true } = {}) {
  const type = ev?.type || "chest";
  if (type === "lead") return null;
  const chest = chestById(ev?.chest);
  const kind = type === "chest" ? chest?.effect?.kind : type;
  // Tomma fickor: "tappade 0 guld" / "dubblade (+0)" säger inget – visas inte.
  if ((kind === "lose" || kind === "double") && !(Math.abs(Number(ev?.amount) || 0) > 0)) return null;
  const vars = {
    namn: names ? ev?.name || "?" : GR_ANON.namn,
    offer: names ? ev?.victimName || "?" : GR_ANON.offer,
    belopp: tal(Math.abs(Number(ev?.amount) || 0)),
  };
  const tpl = (!names && SAFE_ANON[kind]) || SAFE[kind];
  const lucky = kind === "shieldBlock" ? ev?.victimUid : ["lose", "empty"].includes(kind) ? null : ev?.uid;
  const item = {
    id: ev?.id ?? null,
    type,
    chest: chest?.id || null,
    text: tpl ? fill(tpl, vars) : eventText(ev, { names }),
    avatarUid: names ? lucky || null : null,
    big: false,
    tone: "",
    cue: null,
    banner: null,
  };
  if (type === "swap") {
    item.big = true;
    item.cue = "fanfarKort";
    item.banner = { icon: "🔄", title: "BYTE!", sub: names ? `${vars.namn} bytte guld med en klasskamrat` : "Två skattjägare bytte guld", tone: "blue" };
  } else if (type === "steal") item.cue = "stold";
  else if (type === "shieldBlock") item.cue = "vosh";
  else if (chest?.id === "skattkammare") {
    item.big = true;
    item.cue = "fanfarKort";
    item.tone = "gold";
    item.banner = { icon: "👑", title: "SKATTKAMMARE!", sub: names ? `${vars.namn} hittade ${vars.belopp} guld` : `+${vars.belopp} guld till klassen`, tone: "gold" };
  }
  return item;
}

/** Hur viktig en post är när kön måste gallras (högre = behålls). */
export function weight(item) {
  if (item.big) return 3;
  if (["steal", "swap", "shieldBlock"].includes(item.type)) return 2;
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
